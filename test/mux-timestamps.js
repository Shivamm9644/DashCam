const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');const config=require('../src/config');const Feeder=require('../src/simulator/media-feeder');const Mux=require('../src/protocols/jtt1078/ts-muxer');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mux-clock-'));
const video=Feeder.parseH264Nalus(fs.readFileSync(path.join(config.FIXTURES_DIR,'generated/test_video_12s.h264')));
const audio=Feeder.parseAacFrames(fs.readFileSync(path.join(config.FIXTURES_DIR,'generated/test_audio_12s.aac')));
const frames=[...[0,40,120].map((t,i)=>({ptsMs:t,data:video[i].data,audio:false})),...[50,73].map((t,i)=>({ptsMs:t,data:audio[i].data,audio:true}))].sort((a,b)=>a.ptsMs-b.ptsMs);
const ts=path.join(dir,'offset.ts'),mp4=path.join(dir,'offset.mp4');fs.writeFileSync(ts,new Mux().mux(frames,0));
execFileSync(config.FFMPEG_PATH,['-v','error','-y','-i',ts,'-c','copy',mp4]);
const packets=JSON.parse(execFileSync(config.FFPROBE_PATH,['-v','error','-show_packets','-show_entries','packet=codec_type,pts_time','-of','json',mp4],{encoding:'utf8'})).packets;
for(const type of ['video','audio']){
 const actual=packets.filter(p=>p.codec_type===type).map(p=>Number(p.pts_time));
 const expected=type==='video'?[0,.04,.12]:[.05,.073];assert.equal(actual.length,expected.length);
 expected.forEach((t,i)=>assert(Math.abs(actual[i]-t)<.001,`${type} PTS ${actual[i]} != ${t}`));
}
console.log('PASS: irregular video timing and 50 ms initial audio offset survive TS -> MP4 remux');
