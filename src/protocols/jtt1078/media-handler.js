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
 constructor(){this.sessions=new Map();this.pending=new Set();this.simulated=new Set();}
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
  let s=this.sessions.get(key);
  if(!s){
   const id=`${Date.now()}-${randomUUID()}`;
   s={key,terminalId:p.simNumber,channel:p.channel,sessionId:id,anchorPtsMs:p.timestampMs,
    anchorUtcMs:p.timestampMs>1577836800000?p.timestampMs:Date.now(),seq:0,frames:[],fragments:{},sps:null,pps:null,
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
   if(!f||f.pts!==p.timestampMs||Date.now()-f.created>5000||f.size+data.length>4*1024*1024||p.sequenceNo!==((f.seq+1)&65535)){delete s.fragments[type];return;}
   f.parts.push(data);f.size+=data.length;f.seq=p.sequenceNo;if(p.subpackage===3)return;
   if(p.subpackage!==2){delete s.fragments[type];return;}data=Buffer.concat(f.parts);delete s.fragments[type];
  }
  if(p.isAudio){if(s.start!==null && Feeder.parseAacFrames(data).length)s.frames.push({data,ptsMs:p.timestampMs,audio:true});return;}
  const nalus=Feeder.splitNalus(data);
  for(const n of nalus){if(n.type===7)s.sps=n.data;if(n.type===8)s.pps=n.data;}
  if(!nalus.some(n=>n.type===1||n.type===5))return;
  const keyframe=nalus.some(n=>n.type===5);
  if(s.start===null){if(!keyframe)return;s.start=p.timestampMs;}
  if(s.lastVideo!==null && p.timestampMs<=s.lastVideo)return;
  if(p.lastFrameInterval>0 && p.lastFrameInterval<1000)s.frameMs=p.lastFrameInterval;
  if(keyframe && p.timestampMs-s.start>=config.DEFAULT_SEGMENT_DURATION_SEC*1000 && s.frames.length){this.finalize(s,p.timestampMs);s.start=p.timestampMs;}
  if(keyframe){
   const extras=[];if(!nalus.some(n=>n.type===9))extras.push(Buffer.from([0,0,0,1,9,0xf0]));
   if(!nalus.some(n=>n.type===7)&&s.sps)extras.push(s.sps);
   if(!nalus.some(n=>n.type===8)&&s.pps)extras.push(s.pps);
   data=Buffer.concat([...extras,data]);
  }
  s.frames.push({data,ptsMs:p.timestampMs,audio:false});s.lastVideo=p.timestampMs;
  if(s.frames.reduce((n,f)=>n+f.data.length,0)>32*1024*1024)throw new Error('Media segment exceeds 32MB; check keyframe interval');
 }
 finalize(s,end){
  const frames=s.frames.filter(f=>f.ptsMs<end).sort((a,b)=>a.ptsMs-b.ptsMs||Number(a.audio)-Number(b.audio));
  s.frames=s.frames.filter(f=>f.ptsMs>=end);
  if(!frames.some(f=>!f.audio))return;
  const seq=s.seq++,start=s.start,duration=(end-start)/1000;
  const ts=s.mux.mux(frames,s.anchorPtsMs);
  const task=s.queue.then(async()=>{
   const base=`clip_${seq}`,tsPath=path.join(s.dir,`${base}.ts`),mp4=path.join(s.dir,`${base}.mp4`),tmp=path.join(s.dir,`${base}.tmp.mp4`);
   fs.writeFileSync(tsPath,ts);
   // TS contains real PES timestamps. Remux, retaining A/V offsets, with a local MP4 timeline.
   await run(config.FFMPEG_PATH,['-v','error','-y','-i',tsPath,'-map','0:v:0','-map','0:a:0?','-c','copy','-t',String(duration),'-movflags','+faststart',tmp],{maxBuffer:1024*1024});
   const {stdout}=await run(config.FFPROBE_PATH,['-v','error','-show_entries','stream=codec_type,duration','-of','json',tmp]);
   const streams=JSON.parse(stdout).streams;
   const video=streams.find(x=>x.codec_type==='video');
   if(!video||Math.abs(Number(video.duration)-duration)>.12)throw new Error(`Video duration mismatch: expected ${duration}, got ${video?.duration}`);
   fs.renameSync(tmp,mp4);
   const utc=s.anchorUtcMs+start-s.anchorPtsMs;
   const rec={segmentId:`SEG-${s.sessionId}-${seq}`,sessionId:s.sessionId,terminalId:s.terminalId,channel:s.channel,seqNum:seq,startPtsMs:start,endPtsMs:end,startUtcMs:utc,endUtcMs:utc+duration*1000,durationSec:duration,filePath:mp4,hlsSegmentUrl:`${s.url}/${base}.ts`,mp4ClipUrl:`${s.url}/${base}.mp4`,thumbnailUrl:null,hasAudio:streams.some(x=>x.codec_type==='audio'),isKeyframe:1,status:'READY',isSimulated:s.isSimulated};
   db.insertSegment(rec);s.segments.push(rec);this.playlists(s,false);
   require('../../services/accident-service').linkMediaToAccidents(s.terminalId,s.channel,rec);
   ws.emit('media_segment',rec);
  });
  // Chain failures without publishing invalid media. Visible diagnostic, no READY row on failure.
  s.queue=task.catch(e=>{s.failed=true;console.error('[MEDIA]',e.message);ws.emit('media_error',{terminalId:s.terminalId,channel:s.channel,message:e.message});});
  const queued=s.queue;this.pending.add(queued);queued.finally(()=>this.pending.delete(queued));
 }
 playlists(s,closed){
  const write=(target,list,final)=>{
   const duration=Math.ceil(Math.max(config.DEFAULT_SEGMENT_DURATION_SEC,...list.map(x=>x.durationSec)));
   let body=`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${duration}\n#EXT-X-MEDIA-SEQUENCE:${list[0]?.seqNum||0}\n`;
   for(const x of list)body+=`#EXT-X-PROGRAM-DATE-TIME:${new Date(x.startUtcMs).toISOString()}\n#EXTINF:${x.durationSec.toFixed(3)},\n${x.hlsSegmentUrl}\n`;
   if(final)body+='#EXT-X-ENDLIST\n';
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',body);fs.renameSync(target+'.tmp',target);
  };
  write(path.join(s.dir,'recording.m3u8'),s.segments,closed);
  // A previous session finishing must not replace a newer session's live playlist.
  if(!this.sessions.has(s.key)||this.sessions.get(s.key)===s)
   write(path.join(config.MEDIA_DIR,'live',s.key,'live.m3u8'),s.segments.slice(-10),closed);
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
