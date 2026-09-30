const assert=require('assert');const fs=require('fs');const path=require('path');const os=require('os');
process.env.STORAGE_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'dashcam-regression-'));
const config=require('../src/config');const {execFileSync,spawn}=require('child_process');
const server=require('../src/server');const simulator=require('../src/simulator/engine');const media=require('../src/protocols/jtt1078/media-handler');const db=require('../src/storage/db');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<2400;i++){if(await fn())return;await sleep(100);}throw Error('Timed out');}
const terminal='013812345678';const count=Number(process.argv[2]||30);
function probe(file){return JSON.parse(execFileSync(config.FFPROBE_PATH,['-v','error','-show_entries','stream=codec_type,duration,start_time:format=duration,start_time','-of','json',file],{encoding:'utf8'}));}
async function run(){
 await sleep(300);
 const url=`http://127.0.0.1:${config.API_PORT}`;
 assert.equal((await fetch(url+'/media/live/'+terminal+'_1/live.m3u8')).status,404);
 for(const asset of ['/vendor/hls/hls.min.js','/vendor/leaflet/leaflet.js','/vendor/leaflet/leaflet.css'])assert.equal((await fetch(url+asset)).status,200);
 const request=await fetch(url+'/api/simulator/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:JSON.stringify({action:'startSimulation',terminalId:terminal,telemetryCount:count,durationSeconds:count,startTimeUtc:'2026-09-21T09:30:00Z',playbackRate:50})})});assert.equal(request.status,200);
 await until(()=>simulator.status==='STOPPED');await sleep(300);await media.drain();await sleep(100);
 const rows=db.getSegmentsForReels(terminal,1);
 assert.equal(db.getTelemetryCount(terminal),count);assert.equal(rows.length,Math.ceil(count/3));
 let videoTotal=0,maxAv=0,errors=0,priorEnd=null;
 for(const row of rows){
  const p=probe(row.file_path),v=p.streams.find(x=>x.codec_type==='video'),a=p.streams.find(x=>x.codec_type==='audio');assert(v&&a);
  videoTotal+=Number(v.duration);maxAv=Math.max(maxAv,Math.abs(Number(a.duration)-Number(v.duration)));
  assert(Math.abs(Number(v.duration)-row.duration_sec)<.05);
  if(priorEnd!==null)assert.equal(row.start_utc_ms,priorEnd);priorEnd=row.end_utc_ms;
  const ts=probe(path.join(config.MEDIA_DIR,row.hls_segment_url.replace(/^\/media\//,'')));
  assert(Math.abs(Number(ts.format.start_time)-(row.start_pts_ms-rows[0].start_pts_ms)/1000-1)<.05);
  const d=require('child_process').spawnSync(config.FFMPEG_PATH,['-v','error','-i',row.file_path,'-f','null','-'],{encoding:'utf8'});if(d.stderr.trim())errors++;assert.equal(d.status,0);assert.equal(d.stderr.trim(),'');
 }
 assert.equal(errors,0);assert(Math.abs(videoTotal-count)<.05);assert(maxAv<.06);
 const playlist=await (await fetch(url+'/media/live/'+terminal+'_1/live.m3u8')).text();assert(playlist.includes('#EXT-X-ENDLIST'));assert(playlist.includes(`#EXT-X-MEDIA-SEQUENCE:${Math.max(0,rows.length-10)}`));
 const oldFile=rows[0].file_path,oldBytes=fs.readFileSync(oldFile);
 await simulator.start({terminalId:terminal,telemetryCount:4,durationSeconds:4,startTimeUtc:'2026-09-22T09:30:00Z',playbackRate:10});
 await until(()=>simulator.status==='STOPPED');await sleep(300);await media.drain();await sleep(100);
 assert.deepEqual(fs.readFileSync(oldFile),oldBytes);assert.equal(db.getSegmentsForReels(terminal,1).length,rows.length+2);
 const summary={telemetry:count,segments:rows.length,videoTotalSeconds:videoTotal,maxAvDurationDifferenceSeconds:maxAv,decodeErrors:errors,secondSessionPreserved:true,storage:config.STORAGE_DIR};
 console.log('REGRESSION_RESULT '+JSON.stringify(summary));
 fs.writeFileSync(path.join(__dirname,'..',`verification-${count}.json`),JSON.stringify(summary,null,2));
 await Promise.all([server.server,server.server808,server.server1078].map(s=>new Promise(r=>s.close(r))));
 const child=spawn(process.execPath,['src/server.js'],{cwd:path.join(__dirname,'..'),env:process.env,stdio:'ignore'});
 try{await until(async()=>{try{return(await fetch(url+'/api/status')).ok;}catch{return false;}});
  const restored=await(await fetch(url+'/api/media/segments')).json();assert.equal(restored.length,rows.length+2);
  assert.equal((await fetch(url+rows[0].mp4_clip_url)).status,200);
  console.log('ACTUAL_PROCESS_RESTART_PASS');
 }finally{child.kill();}
 process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1);});
