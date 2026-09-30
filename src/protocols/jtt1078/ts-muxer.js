// Timestamped MPEG-TS transport for the supported H.264 (no B frames) + ADTS AAC profile.
// Both PES PTS and PCR use the incoming media clock, never wall clock or inferred frame count.
function crc(data){let c=0xffffffff;for(const b of data){c^=b<<24;for(let i=0;i<8;i++)c=(c&0x80000000)?(c<<1)^0x04c11db7:c<<1;}const out=Buffer.alloc(4);out.writeUInt32BE(c>>>0);return out;}
function pts(value){const v=BigInt(Math.round(value))&((1n<<33n)-1n);return Buffer.from([0x21|Number((v>>29n)&14n),Number((v>>22n)&255n),Number((v>>14n)&254n)|1,Number((v>>7n)&255n),Number((v<<1n)&254n)|1]);}
class TsMuxer {
 constructor(){this.counters=new Map();}
 packetize(pid,payload,pcr=null){const packets=[];let pos=0,first=true;
  while(pos<payload.length){const packet=Buffer.alloc(188,255);packet[0]=0x47;packet[1]=((pid>>8)&31)|(first?64:0);packet[2]=pid&255;
   const cc=this.counters.get(pid)||0;this.counters.set(pid,(cc+1)&15);
   const hasPcr=first && pcr!==null;const take=Math.min(payload.length-pos,hasPcr?176:184);const adapt=184-take;
   packet[3]=(adapt?0x30:0x10)|cc;
   if(adapt){packet[4]=adapt-1;if(adapt>1)packet[5]=hasPcr?0x10:0;
    if(hasPcr){const b=BigInt(Math.round(pcr))&((1n<<33n)-1n);packet[6]=Number(b>>25n)&255;packet[7]=Number(b>>17n)&255;packet[8]=Number(b>>9n)&255;packet[9]=Number(b>>1n)&255;packet[10]=(Number(b&1n)<<7)|0x7e;packet[11]=0;}}
   payload.copy(packet,4+adapt,pos,pos+take);pos+=take;packets.push(packet);first=false;
  }return packets;
 }
 table(pid,section){return this.packetize(pid,Buffer.concat([Buffer.from([0]),section,crc(section)]));}
 mux(frames,anchor){const packets=[];
  packets.push(...this.table(0,Buffer.from([0,0xb0,13,0,1,0xc1,0,0,0,1,0xf0,0])));
  const audio=frames.some(f=>f.audio),length=13+(audio?10:5);
  packets.push(...this.table(4096,Buffer.from([2,0xb0,length,0,1,0xc1,0,0,0xe1,0,0xf0,0,0x1b,0xe1,0,0xf0,0,...(audio?[0x0f,0xe1,1,0xf0,0]:[])])));
  for(const f of frames){const clock=(f.ptsMs-anchor)*90+90000;const h=Buffer.alloc(14);h.set([0,0,1,f.audio?0xc0:0xe0]);h.writeUInt16BE(f.audio?f.data.length+8:0,4);h.set([0x80,0x80,5],6);pts(clock).copy(h,9);
   packets.push(...this.packetize(f.audio?257:256,Buffer.concat([h,f.data]),f.audio?null:clock));
  }return Buffer.concat(packets);
 }
}
module.exports=TsMuxer;
