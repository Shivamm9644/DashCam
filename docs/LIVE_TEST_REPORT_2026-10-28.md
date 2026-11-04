# Live Feed Test Report — 2026-10-28

**Camera:** `505073583696` (MDVR Dual Cam), gateway `100.31.90.51`
**Dashboard:** `http://localhost:3001/#live`, login `inurum@wanwaygps.com` (SUPER_ADMIN)
**Test kaise kiya:** headless Edge ne poora flow automate kiya: login → #live → "Start Live" → har 2 second pe dono channel players ka playback sample → 120s auto-stop. Saath mein gateway pe packet capture aur ffprobe se segment check kiya.

## Saar (summary)

| Cheez | Result | Note |
|---|---|---|
| Camera gateway se connected (JT808) | ✅ Working | Ek baar ~09:24 UTC pe disconnect hoke 1 min mein khud reconnect hua |
| Camera H.264 bhej raha hai | ✅ Working | Main Stream CH1/CH2 = H264 (H.265 pe kuch nahi chalta tha) |
| Gateway HLS banana (`live.m3u8`) | ✅ Working (fix ke baad) | Disk-cleanup bug fix kiya (L0.11) |
| Login + live page + vehicle select | ✅ Working | |
| "Start Live" → camera ko command | ✅ Working | Ab 1 hi baar jaata hai (pehle 12 baar jaata tha, fix L0.13) |
| **CH2 (cabin) video** | ✅ **Smooth** | Click ke ~4s baad video. Pehle ~12s thoda atka, phir 2 min tak 13-16s buffer ke saath bina ruke chala |
| **CH1 (road) video** | ❌ **Atakta hai** | Camera ki bandwidth se zyada bitrate (~6 Mbps). Har 4.5s mein sirf ~1.2s video aati hai, picture ~70% time ruki rehti hai |
| Offline camera pe sahi message | ✅ Working | "CAM OFFLINE" + 409 DEVICE_OFFLINE, fake video nahi dikhata |
| 120s auto-stop (dashboard side) | ✅ Working | Timer 0 pe player band, stop-live request jaati hai |
| **Stop ke baad camera stream band** | ✅ **Fixed (re-test)** | Pehle gateway 0x9102 nahi bhejta tha. Patch ke baad: live 1401 pkts/5s → stop ke 8s baad 1, 30s baad bhi 1 |
| Audio | ❌ Not working | Camera G.711A bhejta hai, gateway sirf AAC leta hai (L0.10) |

## Detail

### 1. CH1 atakna — camera setting ka issue (code se fix nahi hoga)
- ffprobe: CH1 segment = 4.5s ka slot, andar sirf 26-28 frames (~1.2s), bitrate ~6 Mbps. CH2 = 2s mein 30 frames, ~2.3 Mbps (theek).
- Packet capture: camera CH1 ka 1 second video ~4 second mein bhej pata hai, phir ~4s skip karke aage kood jaata hai. Network pe packet loss zero hai, matlab camera ka 4G upload kam pad raha hai.
- Dashboard test mein CH1: pehle ~75s tak player har ~17s mein aage koodta raha (31 stall samples / 65). Uske baad time aage badhta dikha, lekin woh gaps ke upar se kood raha tha.

**Zaroori action (camera app → Main Stream, CH1 aur CH2 dono):** Bitrate **1024 kbps** (ya 768), Frame rate **15 fps**, Resolution **720p**. Test ke time tak yeh setting nahi badli thi (CH1 abhi bhi ~6 Mbps).

### 2. Stop kaam nahi karta — gateway bug
- Gateway ka `/api/video/start-live` seedha 0x9101 bhejta hai, koi session record nahi banata.
- `stopLiveSession()` (`src/services/video-center-service.js:191` gateway pe) session na mile toh `No active session` return kar deta hai, **0x9102 bhejta hi nahi**.
- Asar: camera live band hi nahi hota, SIM ka data lagataar kharch hota hai (~8 Mbps dono channel).
- **✅ Fix laga diya (user approval ke baad):** session na ho tab bhi 0x9102 bhejta hai. Gateway log: `Stopping stream ... (no tracked session; sending 0x9102 anyway)` → `Dispatched JT808 0x9102`. Backup: `video-center-service.js.bak-20261028`.

### 3. Startup time
- CH2: click ke ~4s mein pehla frame, ~16s mein smooth playback.
- CH1: ~8s mein pehla frame, phir atakta hai (upar dekho).
- Standalone `player.html` (CH1): ~21s mein start, phir real-time.

### 4. Aaj ke fixes (sab test hue)
| # | Fix | Kahan |
|---|---|---|
| L0.11 | Disk-cleanup chalu stream ka folder delete kar deta tha → har segment ENOENT | Gateway `media-handler.js`, `storage-service.js` (backup `.bak-20261028`) |
| — | Local proxy `.ts` timeout 3s → 15s (1MB segment 3s mein nahi aata tha) | `src/server.js` |
| L0.12 | Player buffer: lowLatency off, 3 segment peeche, 30s buffer | `public/player.html`, `public/app.js` |
| L0.13 | Start-live 20s dedupe (1 click = 12 commands → 1) | `src/services/gateway.js`, `src/server.js`, `src/routes/api.js` |

## Aage kya karna hai (priority order)
1. **Camera bitrate kam karo** (CH1+CH2: 1024 kbps / 15 fps / 720p). Isse CH1 ka atakna theek hoga. *(Aapka kaam, camera app se)*
2. ~~Stop-live gateway patch~~ ✅ laga diya aur test ho gaya.
3. Audio: G.711A → AAC transcode gateway pe (L0.10).
4. Gateway disk 91% bhari hai, isliye emergency cleanup har 60s chalta hai. Ab stream nahi todta, par space badhao ya purana data saaf karo.
5. Bina login ke "Start Live" dabane pe kuch nahi hota, koi message bhi nahi dikhta. Login maangna chahiye.
6. Security (S1): demo passwords code mein hardcoded hain (`db.js`); docs wala `Inurum@2026` galat hai.
