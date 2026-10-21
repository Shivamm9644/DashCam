const fs=require('fs');
const path=require('path');
const {randomUUID}=require('crypto');
const {execFile}=require('child_process');
const {promisify}=require('util');
const run=promisify(execFile);
const config=require('../../config');
const db=require('../../storage/db');
const parser=require('./media-parser');
const ws=require('../../services/websocket-service');
const Feeder=require('../../simulator/media-feeder');
const TsMuxer=require('./ts-muxer');
class MediaHandler {
 constructor(){
  this.sessions=new Map();
  this.pending=new Set();
  this.simulated=new Set();
  this.spsCache=new Map();
  this.ppsCache=new Map();
  this.streamMetrics=new Map();
  // Periodic disk retention check every 2 minutes
  setInterval(()=>this.pruneDiskSpace(), 120000).unref();
 }
 handleData(socket,data,callback){
  socket.mediaBuffer=Buffer.concat([socket.mediaBuffer||Buffer.alloc(0),data]);
  if(socket.mediaBuffer.length>4*1024*1024){socket.destroy();return;}
  while(socket.mediaBuffer.length>=18){
   const result=parser.parsePacket(socket.mediaBuffer);if(!result)break;
   if(result.error){socket.mediaBuffer=socket.mediaBuffer.subarray(Math.max(1,result.discardBytes));continue;}
   socket.mediaBuffer=socket.mediaBuffer.subarray(result.bytesConsumed);
   const p=result.packet;socket.sessionKeys ||=new Set();socket.sessionKeys.add(`${p.simNumber}_${p.channel}`);
   callback?.(p);this.processPacket(p);
  }
 }
 processPacket(p){
  // Do not silently route unsupported codecs into H.264/AAC decoders.
  if(!((p.isVideo&&p.payloadType===98&&p.dataType!==2)||(p.isAudio&&p.payloadType===19)))return;
  const key=`${p.simNumber}_${p.channel}`;
  let m = this.streamMetrics.get(key);
  if (!m) {
   m = { terminalId: p.simNumber, channel: p.channel, totalPackets: 0, totalBytes: 0, lastPacketTime: Date.now(), lastSegmentTime: null, lastSegmentName: null, segmentCount: 0, lastDurationSec: 0 };
   this.streamMetrics.set(key, m);
  }
  m.totalPackets++;
  m.totalBytes += p.body.length;
  m.lastPacketTime = Date.now();

  let s=this.sessions.get(key);
  if(!s){
   const id=`${Date.now()}-${randomUUID()}`;
   s={key,terminalId:p.simNumber,channel:p.channel,sessionId:id,anchorPtsMs:p.timestampMs,
    anchorUtcMs:p.timestampMs>1577836800000?p.timestampMs:Date.now(),seq:0,frames:[],fragments:{},
    sps:this.spsCache.get(key)||null,pps:this.ppsCache.get(key)||null,
    start:null,lastVideo:null,frameMs:40,segments:[],mux:new TsMuxer(),queue:Promise.resolve(),isSimulated:this.simulated.has(key)};
   s.dir=path.join(config.MEDIA_DIR,'sessions',key,id);fs.mkdirSync(s.dir,{recursive:true});
   s.url=`/media/sessions/${key}/${id}`;
   db.upsertSession({sessionId:id,terminalId:s.terminalId,channel:s.channel,startTimeUtc:new Date(s.anchorUtcMs).toISOString(),anchorUtcMs:s.anchorUtcMs,anchorPtsMs:s.anchorPtsMs,status:'ACTIVE',isSimulated:s.isSimulated?1:0});
   this.sessions.set(key,s);
  }
  const type=p.isVideo?'video':'audio';let data=p.body;
  if(p.subpackage===1){s.fragments[type]={parts:[data],pts:p.timestampMs,seq:p.sequenceNo,size:data.length,created:Date.now(),type:p.dataType};return;}
  if(p.subpackage!==0){
   const f=s.fragments[type];
   if(!f||f.pts!==p.timestampMs||Date.now()-f.created>5000||f.size+data.length>4*1024*1024){delete s.fragments[type];return;}
   const seqDiff = (p.sequenceNo - f.seq) & 65535;
   if(seqDiff < 1 || seqDiff > 10){delete s.fragments[type];return;}
   f.parts.push(data);f.size+=data.length;f.seq=p.sequenceNo;if(p.subpackage===3)return;
   if(p.subpackage!==2){delete s.fragments[type];return;}data=Buffer.concat(f.parts);delete s.fragments[type];
  }
  if(p.isAudio){if(s.start!==null && Feeder.parseAacFrames(data).length)s.frames.push({data,ptsMs:p.timestampMs,audio:true});return;}
  const nalus=Feeder.splitNalus(data);
  for(const n of nalus){
   if(n.type===7){s.sps=n.data;this.spsCache.set(key,n.data);}
   if(n.type===8){s.pps=n.data;this.ppsCache.set(key,n.data);}
  }
  if(!nalus.some(n=>n.type===1||n.type===5))return;
  const keyframe=nalus.some(n=>n.type===5);
  let framePts = Number(p.timestampMs);
  if(!s.isSimulated){
   if(p.lastFrameInterval>0 && p.lastFrameInterval<1000) s.frameMs = p.lastFrameInterval;
   if(s.lastVideo !== null && framePts <= s.lastVideo) {
    framePts = s.lastVideo + (s.frameMs || 40);
   }
  }else{
   if(s.lastVideo!==null && p.timestampMs<=s.lastVideo)return;
   if(p.lastFrameInterval>0 && p.lastFrameInterval<1000)s.frameMs=p.lastFrameInterval;
  }
  if(s.start===null){if(!keyframe)return;s.start=framePts;}
  const minSegDurationMs = s.isSimulated ? (config.DEFAULT_SEGMENT_DURATION_SEC * 1000) : 1800;
  if(keyframe && framePts-s.start>=minSegDurationMs && s.frames.length){this.finalize(s,framePts);s.start=framePts;}
  if(keyframe){
   const extras=[];if(!nalus.some(n=>n.type===9))extras.push(Buffer.from([0,0,0,1,9,0xf0]));
   const curSps = s.sps || this.spsCache.get(key);
   const curPps = s.pps || this.ppsCache.get(key);
   if(!nalus.some(n=>n.type===7)&&curSps)extras.push(curSps);
   if(!nalus.some(n=>n.type===8)&&curPps)extras.push(curPps);
   data=Buffer.concat([...extras,data]);
  }
  s.frames.push({data,ptsMs:framePts,audio:false});s.lastVideo=framePts;
  if(s.frames.reduce((n,f)=>n+f.data.length,0)>32*1024*1024)throw new Error('Media segment exceeds 32MB; check keyframe interval');
 }
 finalize(s,end){
  const frames=s.frames.filter(f=>f.ptsMs<end).sort((a,b)=>a.ptsMs-b.ptsMs||Number(a.audio)-Number(b.audio));
  s.frames=s.frames.filter(f=>f.ptsMs>=end);
  if(!frames.some(f=>!f.audio))return;
  const seq=s.seq++,start=s.start,duration=(end-start)/1000;
  const ts=s.mux.mux(frames,s.anchorPtsMs);
  if(!s.isSimulated){
   const base=`clip_${seq}`,tsPath=path.join(s.dir,`${base}.ts`),mp4=path.join(s.dir,`${base}.mp4`);
   try {
    fs.writeFileSync(tsPath,ts);
   } catch(writeErr) {
    console.error(`[MEDIA] Write failed for ${tsPath}: ${writeErr.message}. Running storage prune...`);
    this.pruneDiskSpace();
    try { fs.writeFileSync(tsPath,ts); } catch(fatalWrite) { console.error('[MEDIA] Fatal disk write error:', fatalWrite.message); return; }
   }
   const utc=s.anchorUtcMs+start-s.anchorPtsMs;
   const hasAudio=frames.some(f=>f.audio);
   const rec={segmentId:`SEG-${s.sessionId}-${seq}`,sessionId:s.sessionId,terminalId:s.terminalId,channel:s.channel,seqNum:seq,startPtsMs:start,endPtsMs:end,startUtcMs:utc,endUtcMs:utc+duration*1000,durationSec:duration,filePath:tsPath,hlsSegmentUrl:`${s.url}/${base}.ts`,mp4ClipUrl:`${s.url}/${base}.mp4`,thumbnailUrl:null,hasAudio:hasAudio?1:0,isKeyframe:1,status:'READY',isSimulated:0};
   db.insertSegment(rec);s.segments.push(rec);this.playlists(s,false);
   if(s.segments.length > 25){
    const stale = s.segments.slice(0, s.segments.length - 15);
    for(const old of stale){
     if(!old._cleaned){
      old._cleaned = true;
      const oldTs = path.join(s.dir, path.basename(old.hlsSegmentUrl));
      const oldMp4 = path.join(s.dir, path.basename(old.mp4ClipUrl || ''));
      try{ if(fs.existsSync(oldTs)) fs.unlinkSync(oldTs); }catch{}
      try{ if(fs.existsSync(oldMp4)) fs.unlinkSync(oldMp4); }catch{}
     }
    }
   }
   const m = this.streamMetrics.get(s.key);
   if (m) { m.lastSegmentTime = Date.now(); m.lastSegmentName = `${base}.ts`; m.segmentCount++; m.lastDurationSec = duration; }
   require('../../services/accident-service').linkMediaToAccidents(s.terminalId,s.channel,rec);
   ws.emit('media_segment',rec);
   run(config.FFMPEG_PATH,['-v','error','-y','-i',tsPath,'-c','copy','-movflags','+faststart',mp4],{timeout:10000}).catch(()=>{});
   return;
  }
  const task=s.queue.then(async()=>{
   const base=`clip_${seq}`,tsPath=path.join(s.dir,`${base}.ts`),mp4=path.join(s.dir,`${base}.mp4`),tmp=path.join(s.dir,`${base}.tmp.mp4`);
   fs.writeFileSync(tsPath,ts);
   // TS contains real PES timestamps. Remux, retaining A/V offsets, with a local MP4 timeline.
   let segDuration=duration,hasAudio=false,mp4Success=false;
   try{
    await run(config.FFMPEG_PATH,['-analyzeduration','100M','-probesize','100M','-v','error','-y','-i',tsPath,'-map','0:v:0','-map','0:a:0?','-c','copy','-t',String(duration),'-movflags','+faststart',tmp],{maxBuffer:1024*1024});
    const {stdout}=await run(config.FFPROBE_PATH,['-v','error','-show_entries','stream=codec_type,duration','-of','json',tmp]);
    const streams=JSON.parse(stdout).streams;
    const video=streams.find(x=>x.codec_type==='video');
    if(s.isSimulated){
     if(!video||Math.abs(Number(video.duration)-duration)>.12)throw new Error(`Video duration mismatch: expected ${duration}, got ${video?.duration}`);
    }else if(video&&video.duration){
     segDuration=Number(video.duration);
    }
    hasAudio=streams.some(x=>x.codec_type==='audio');
    fs.renameSync(tmp,mp4);
    mp4Success=true;
   }catch(err){
    if(s.isSimulated)throw err;
    console.warn(`[MEDIA] Remux notice on ${base}: ${err.message}. Preserving TS segment for continuous live HLS.`);
    try{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}catch{}
   }
   const utc=s.anchorUtcMs+start-s.anchorPtsMs;
   const rec={segmentId:`SEG-${s.sessionId}-${seq}`,sessionId:s.sessionId,terminalId:s.terminalId,channel:s.channel,seqNum:seq,startPtsMs:start,endPtsMs:end,startUtcMs:utc,endUtcMs:utc+segDuration*1000,durationSec:segDuration,filePath:mp4Success?mp4:tsPath,hlsSegmentUrl:`${s.url}/${base}.ts`,mp4ClipUrl:mp4Success?`${s.url}/${base}.mp4`:`${s.url}/${base}.ts`,thumbnailUrl:null,hasAudio:hasAudio,isKeyframe:1,status:'READY',isSimulated:s.isSimulated};
   db.insertSegment(rec);s.segments.push(rec);this.playlists(s,false);
   if(!s.isSimulated && s.segments.length > 25){
    const stale = s.segments.slice(0, s.segments.length - 20);
    for(const old of stale){
     if(!old._cleaned){
      old._cleaned = true;
      const oldTs = path.join(s.dir, path.basename(old.hlsSegmentUrl));
      try{ if(fs.existsSync(oldTs)) fs.unlinkSync(oldTs); }catch{}
     }
    }
   }
   require('../../services/accident-service').linkMediaToAccidents(s.terminalId,s.channel,rec);
   ws.emit('media_segment',rec);
  });
  // Chain failures without publishing invalid media. Visible diagnostic, no READY row on failure.
  s.queue=task.catch(e=>{if(s.isSimulated){s.failed=true;}console.error('[MEDIA]',e.message);ws.emit('media_error',{terminalId:s.terminalId,channel:s.channel,message:e.message});});
  const queued=s.queue;this.pending.add(queued);queued.finally(()=>this.pending.delete(queued));
 }
 playlists(s,closed){
  const write=(target,list,final)=>{
   if(!list || list.length === 0) return;
   const duration=Math.ceil(Math.max(config.DEFAULT_SEGMENT_DURATION_SEC,...list.map(x=>x.durationSec)));
   let body=`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${duration}\n#EXT-X-MEDIA-SEQUENCE:${list[0]?.seqNum||0}\n`;
   for(const x of list)body+=`#EXT-X-PROGRAM-DATE-TIME:${new Date(x.startUtcMs).toISOString()}\n#EXTINF:${x.durationSec.toFixed(3)},\n${x.hlsSegmentUrl}\n`;
   if(final)body+='#EXT-X-ENDLIST\n';
   fs.mkdirSync(path.dirname(target),{recursive:true});
   const tmp = target + '.' + Date.now() + '.tmp';
   try {
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, target);
   } catch(e) {
    try { fs.writeFileSync(target, body); } catch(_) {}
   }
  };
  write(path.join(s.dir,'recording.m3u8'),s.segments,closed);
  // Live playlist maintains sliding window of last 8 segments for low-latency
  if(!this.sessions.has(s.key)||this.sessions.get(s.key)===s)
   write(path.join(config.MEDIA_DIR,'live',s.key,'live.m3u8'),s.segments.slice(-8),closed);
 }
 pruneDiskSpace(){
  try {
   if (typeof fs.statfsSync !== 'function') return;
   const stats = fs.statfsSync(config.STORAGE_DIR);
   const freeMb = (stats.bavail * stats.bsize) / (1024 * 1024);
   if (freeMb < 1500) {
    console.warn(`[STORAGE] Low disk space (${freeMb.toFixed(1)} MB free). Pruning oldest inactive sessions and clips.`);
    const sessionsDir = path.join(config.MEDIA_DIR, 'sessions');
    if (fs.existsSync(sessionsDir)) {
     const activePaths = new Set([...this.sessions.values()].map(s => s.dir));
     const allDirs = [];
     for (const t of fs.readdirSync(sessionsDir)) {
      const tDir = path.join(sessionsDir, t);
      try {
       if (fs.statSync(tDir).isDirectory()) {
        for (const sd of fs.readdirSync(tDir)) {
         const sdDir = path.join(tDir, sd);
         try {
          const st = fs.statSync(sdDir);
          if (st.isDirectory()) allDirs.push({ path: sdDir, mtime: st.mtimeMs });
         } catch(_) {}
        }
       }
      } catch(_) {}
     }
     allDirs.sort((a,b) => a.mtime - b.mtime);
     for (const d of allDirs) {
      if (activePaths.has(d.path)) continue;
      try {
       fs.rmSync(d.path, { recursive: true, force: true });
       console.log(`[STORAGE] Pruned stale session: ${d.path}`);
       const curStats = fs.statfsSync(config.STORAGE_DIR);
       if ((curStats.bavail * curStats.bsize) / (1024 * 1024) > 2000) break;
      } catch(err) {
       console.error(`[STORAGE] Prune error on ${d.path}:`, err.message);
      }
     }
    }
   }
  } catch(e) {}
 }
 getStreamStats(terminalId, channel = 1){
  const key = `${terminalId}_${channel}`;
  const s = this.sessions.get(key);
  const m = this.streamMetrics.get(key);
  const active = Boolean(s);
  let lastSegAgeSec = null;
  if (m && m.lastSegmentTime) {
   lastSegAgeSec = Math.round((Date.now() - m.lastSegmentTime) / 1000);
  }
  return {
   key,
   terminalId,
   channel,
   active,
   sessionId: s?.sessionId || null,
   totalPackets: m?.totalPackets || 0,
   totalBytes: m?.totalBytes || 0,
   lastPacketTime: m?.lastPacketTime || null,
   lastSegmentTime: m?.lastSegmentTime || null,
   lastSegmentName: m?.lastSegmentName || null,
   lastDurationSec: m?.lastDurationSec || 0,
   segmentCount: s?.segments?.length || m?.segmentCount || 0,
   lastSegAgeSec,
   hasSps: Boolean(this.spsCache.get(key)),
   hasPps: Boolean(this.ppsCache.get(key)),
   state: active ? ((lastSegAgeSec !== null && lastSegAgeSec > 15) ? 'STALLED' : 'HEALTHY') : 'OFFLINE'
  };
 }
 async closeSession(terminalId,channel=1){
  const key=`${terminalId}_${channel}`,s=this.sessions.get(key);if(!s)return;
  this.sessions.delete(key);
  if(s.start!==null&&s.lastVideo!==null)this.finalize(s,s.lastVideo+s.frameMs);
  await s.queue;this.playlists(s,true);
  db.upsertSession({sessionId:s.sessionId,terminalId,channel,startTimeUtc:new Date(s.anchorUtcMs).toISOString(),endTimeUtc:new Date(s.anchorUtcMs+(s.lastVideo??s.anchorPtsMs)-s.anchorPtsMs+s.frameMs).toISOString(),anchorUtcMs:s.anchorUtcMs,anchorPtsMs:s.anchorPtsMs,status:s.failed?'ERROR':'CLOSED',isSimulated:s.isSimulated?1:0});
 }
 async drain(){await Promise.all([...this.pending]);}
}
module.exports=new MediaHandler();
