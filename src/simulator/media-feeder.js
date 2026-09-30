// Annex-B helpers for progressive H.264 (the simulator generates baseline, no B frames).
class MediaFeeder {
    static splitNalus(buffer) {
        const starts = [];
        for (let i=0; i+2<buffer.length;) {
            let n=0;
            if (buffer[i]===0 && buffer[i+1]===0) {
                if (buffer[i+2]===1) n=3;
                else if (i+3<buffer.length && buffer[i+2]===0 && buffer[i+3]===1) n=4;
            }
            if(n){starts.push({i,n});i+=n;} else i++;
        }
        return starts.map((s,i)=>({data:buffer.subarray(s.i,starts[i+1]?.i ?? buffer.length), type:buffer[s.i+s.n]&31,prefix:s.n}));
    }
    static parseH264Nalus(buffer) {
        const units=this.splitNalus(buffer), frames=[];
        let pending=[], hasPicture=false, key=false;
        const flush=()=>{if(hasPicture) frames.push({data:Buffer.concat(pending),isKeyframe:key,dataType:key?0:1,naluType:key?5:1});pending=[];hasPicture=false;key=false;};
        // AUD is authoritative when present. For legacy baseline fixtures, first_mb_in_slice=0 starts a picture.
        const aud=units.some(u=>u.type===9);
        for(const u of units){
            if(u.type===9){flush();pending.push(u.data);continue;}
            const picture=u.type===1||u.type===5;
            if(!aud && hasPicture && ((picture && (u.data[u.prefix+1]&128)) || [6,7,8].includes(u.type))) flush();
            pending.push(u.data);
            if(picture){hasPicture=true;key ||=u.type===5;}
        }
        flush();return frames;
    }
    static parseAacFrames(buffer) {
        const rates=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
        const frames=[];let i=0;
        while(i+7<=buffer.length){
            if(buffer[i]===255 && (buffer[i+1]&246)===240){
                const len=((buffer[i+3]&3)<<11)|(buffer[i+4]<<3)|(buffer[i+5]>>5);
                const rate=rates[(buffer[i+2]>>2)&15],header=(buffer[i+1]&1)?7:9;
                if(rate && len>=header && i+len<=buffer.length){
                    frames.push({data:buffer.subarray(i,i+len),dataType:3,sampleRate:rate,samples:1024*((buffer[i+6]&3)+1),durationMs:1024*((buffer[i+6]&3)+1)*1000/rate});i+=len;continue;
                }
            }i++;
        }return frames;
    }
}
module.exports=MediaFeeder;
