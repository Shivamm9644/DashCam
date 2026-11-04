# Fix Milestones (2026-10-28)

Priority order: client delivery ke liye live feed pehle, phir security, phir cleanup.

## Live feed diagnosis (2026-10-28)

- Is repo mein JT808/JT1078 gateway nahi hai. Camera connection aur HLS conversion remote server `100.31.90.51` pe hota hai (ports 7800 / 10780 / 3000 open).
- `GET http://100.31.90.51:3000/api/devices` → saare 4 cameras `Offline`:
  - `505073583696` last online 2026-10-27 13:42 UTC
  - `872312860795` last online 2026-10-26 21:21 UTC
  - `860871080043592` (WanWay H20P) last online 2026-10-26 07:44 UTC
  - `872312858278` last online 2026-10-22 21:54 UTC
- `start-live` hamesha `"ONLINE" / "dispatched"` return karta hai (galat), aur `live.m3u8` → `302 /videos/road_cam.mp4` (standby). Camera socket nahi hai isliye video nahi aata.
- `/api/v1/devices` aur `/api/v1/positions/latest` fake `ONLINE` aur default coordinates dikhate hain. Asli status ke liye `/api/devices` dekho.

## L0 — Live feed chalana (BLOCKER, client delivery)

| # | Task | Done when |
|---|---|---|
| L0.1 | ✅ (2026-10-28 14:10) `505073583696` Online. Live start dispatch hota hai par `live.m3u8` abhi bhi 302 → L0.9 (H.265) blocker. Camera config sahi karo: Server IP `100.31.90.51`, Port `7800`, Protocol JT808 (2013/2019 as per device), APN/SIM data on, phone live preview band | `/api/devices` mein camera `Online` |
| L0.2 | Live start karo, RTP port 10780 pe aaye | `live.m3u8` 200 deta hai (302 nahi) |
| L0.3 | ✅ (2026-10-28) Player fix: hardcoded `http://100.31.90.51:3000` hata kar same-origin `/media/live/...` proxy; gateway URL ab `GATEWAY_URL` env/config mein (`src/services/gateway.js`) | Code done; video verify camera online hone par |
| L0.4 | ✅ (2026-10-28) Status honest: backend har 5s gateway `/api/devices` sync karta hai; offline camera pe live-start `409 DEVICE_OFFLINE`; player asli status + last online + sahi camera settings dikhata hai (`GET /api/live/device-status`) | Tested: `505073583696` → OFFLINE |
| L0.7 | ✅ (2026-10-28) cleanup done: 0 → 596 MB free (92%). **Gateway disk 100% full (asli blocker, 2026-10-28)**: 6.7G disk, 0 free; 27 Oct 13:42 se SQLite `disk is full`, HLS nahi ban raha. Disk badhana option nahi hai → safe cleanup (apt/npm cache, journal, spam pm2 out-log ~140M) | `df` mein free space, `live.m3u8` 200 |
| L0.8 | ✅ (2026-10-28) line 1821 commented (backup `src/server.js.bak-20261028`), pm2-logrotate 10M×3 compressed. Disk dobara full na ho: gateway `src/server.js:1821` per-packet `RAW MEDIA` log band karo; `pm2-logrotate` (max 10M, 3 files) | Log size stable |
| L0.9 | ✅ (2026-10-28) user ne app mein Main Stream CH1/CH2 → H264 kiya. **Camera H.265 bhej raha hai** (packet capture: video PT 99, audio PT 6 G.711A). Gateway `media-handler.js:51` sirf PT 98 (H.264) + 19 (AAC) leta hai → sab drop. Camera dono channels **H.264** pe set karo | `live.m3u8` 200 |
| L0.11 | ✅ (2026-10-28 14:30) **LIVE CHAL GAYA.** Patch gateway pe laga (backup `*.bak-20261028`), `pm2 restart`; dono channels `live.m3u8` 200, segments 200 local proxy se bhi. Local proxy (`src/server.js` `/media/live`) ka 3s timeout `.ts` ke liye 15s kiya (1MB segment 3s mein nahi aata tha). Pehle ka diagnosis: **Asli blocker mila.** Camera ab H.264 bhejta hai (PT 98; SPS/PPS/IDR theek, L0.9 done) aur gateway segments banata hai, par har write `ENOENT` pe fail hoti hai. Disk 92% (>=90% CRITICAL) hone se `storage-service.checkDiskUsage()` har 60s `pruneAbandonedAndStaleData()` ko **bina active keys** ke chalata hai. Jis live dir mein >15s purana grace segment ho, use poora delete kar deta hai; `media-handler.finalize()` dir dobara nahi banata. Fix ready: session scratchpad mein `patch_live_dir.js` (finalize mein mkdirSync + `activeKeysProvider`). Gateway pe lagana + `pm2 restart dashcam-server` baaki (permission chahiye) | `live.m3u8` 200 |
| L0.12 | (2026-10-28 14:40) Video beech-beech mein ruk raha tha. Playlist theek thi (regular 5.6s segments), isliye hls.js config badla: `lowLatencyMode` false, `liveSyncDurationCount` 3, buffer 30s, frag timeout 20s (`player.html` + `app.js`). User verify baaki. Agar ab bhi ruke → camera Main Stream bitrate kam karo / sub-stream | Smooth playback |
| L0.13 | (2026-10-28 15:00) Dashboard `#live` slow/choppy — diagnosis: (a) ek "Start Live" click = 6 start-live calls × gateway har call pe dono channels ko 0x9101 = 12 commands; har 0x9101 pe camera stream restart. ✅ Fix: `gateway.shouldDispatchLive()` 20s dedupe (`src/services/gateway.js`, `server.js` proxy, `routes/api.js`). (b) **CH1 bandwidth-starved**: ~33KB/frame, camera 1s video ~4s mein bhej pata hai, phir ~4s skip karta hai (pcap arrival vs camera timestamp se pakka). CH2 2s/30 frames theek. **Fix: camera app mein CH1+CH2 Main Stream bitrate ~1024 kbps, 15 fps, 720p** (user action) | Segments mein frames = EXTINF × fps |
| L0.10a | ✅ (2026-10-28 ~16:00 IST) **Audio LIVE deployed** (user approved; backup `media-handler.js.bak-audio-20261028`). Live test: CH1 segment mein aac, -31.6 dB. Video abhi bhi choppy: CH1 4.5s slot mein 0.9s video, ~26KB/frame (~3 Mbps encode), uplink ~0.5 Mbps → camera bitrate kam karna zaroori. Pehle ka note: Audio ready. Camera audio = G.711A raw, 320B/40ms, PT 6. Naya `audio-transcoder.js` (ffmpeg per stream: alaw 8k → AAC 16k 32kbps ADTS, +10dB + limiter), `patch_audio.js` media-handler mein PT 6 allow + session close pe ffmpeg band. Offline test (`/tmp/gwtest`, captured stream): segment mein h264 + aac, 2.0s video / 2.048s audio, -28 dB mean. Scripts scratchpad + gateway `/tmp/gwtest` | Live mein awaaz |
| L0.10 | Audio: gateway mein G.711A → AAC transcode (abhi audio drop hota hai) | Live mein awaaz |
| L0.5 | ✅ (2026-10-28 ~15:15 IST) Patch gateway pe laga (`video-center-service.js`, backup `.bak-20261028`), `pm2 restart`. Test: live 1401 pkts/5s → stop ke 8s baad 1 pkt/5s, 30s baad bhi 1. Pehle ka: ❌ (2026-10-28 tested) Dashboard 120s auto-stop OK, par **gateway 0x9102 nahi bhejta** (`/api/video/start-live` session nahi banata → `stopLiveSession` "No active session"). Camera stop ke baad bhi stream karta raha. Fix ready: scratchpad `patch_stop_live.js`, permission baaki. Full report: `docs/LIVE_TEST_REPORT_2026-10-28.md`. Stop-live + 120s session limit verify | Stop ke baad playlist band ho |
| L0.6 | Client demo checklist: dono channels, audio, mobile app (APK) | Screen recording evidence |

## Storage architecture (decided 2026-10-28)

- Server disk 6.7G hi rahegi (badhana option nahi).
- Server pe sirf **live feed** (gateway already `RECORDING_MODE=LIVE_ONLY`, rolling HLS ~5MB).
- Event/incident video camera ke **SD card** pe hi rahegi; zarurat par on-demand laayi jayegi:
  - `0x9205` resource list query → `0x1205` file list
  - `0x9201` remote playback (RTP stream, live jaisa) — preferred, disk use nahi
  - `0x9206` FTP upload sirf download chahiye tab (temporary, retention ke saath delete)
- Camera spec: H.264/H.265 + audio G.711A. Browser HLS ke liye camera ko **H.264** pe rakho (H.265 browsers mein nahi chalta); audio G.711A → AAC transcode zaroori.

## SD1 — SD card video on-demand (L0 ke baad)

> (2026-10-28) Video Center ka "Video Retrieval" modal **SD video nahi chalata**: `openVideoRetrievalModal` live HLS (`getLiveHlsUrl`) bind karta hai. Map/route (NY 40.6234,-73.7533), "59 MPH", "Jun 20 2021" sab static/nakli. ✅ Fix: modal close (X/backdrop/Esc) ab har page se kaam karta hai (`bindVideoRetrievalModal()`, pehle sirf Safety Inbox kholne pe bind hota tha). Headless test PASS.

**(2026-10-28 ~17:30 IST) SD findings + fixes:**
- ✅ Gateway parser ab multi-packet (sub-package) messages jodta hai (`patch_parser_subpackage.js`, backup `binary-parser.js.bak-subpkg-20261028`). 2-din list: 102 files, 27 Oct 16:38 → 28 Oct 15:54, 21.2 GB (~2.6 GB/hour recording).
- ⚠️ 28 Oct ~14:00 se pehle ki recordings **H.265** (PT 99) hain → browser/gateway nahi chala sakta. Uske baad ki H.264 recordings chalti hain. Option: gateway pe H.265→H.264 ffmpeg transcode (playback only) — not done.
- ⚠️ 15:54 ke baad SD pe nayi recording nahi (16:26 tak) — camera recording check karna.
- 1 week retention ~2.6 GB/hour pe possible nahi (card size pata nahi; 64GB ≈ 24h recording). Quality kam = zyada din.
- ✅ Video Retrieval map: nakli NY route hataya; GPS na ho toh "No GPS fix", ho toh asli marker. A/B rows hide, "SD FOOTAGE" asli time range. Past date chuno toh date sahi rehti hai.

**✅ (2026-10-28 ~17:15 IST) SD PLAYBACK WORKING — deployed + tested end-to-end** (headless, dashboard modal, 15:25:00 +30s): CH1 29.1s / CH2 29.6s of 30s played, continuous after start (~18-22s buffering). SD video = 704x480 (CH1) / 704x288 (CH2), ~256 kbps, with audio. Extra fixes found during deploy: gateway parser 0x1205/0x1206 `body is not defined` (backup `binary-parser.js.bak-sd-20261028`); every playback now starts a fresh media session (old session reuse = empty player); playback-start pre-checks SD list → 404 NO_RECORDING; player retries 404 manifest (hls.js doesn't retry 4xx), waits 8s buffer, jumps buffer gaps; modal pre-fills last recorded minute. **Camera SD pe 15:37 ke baad koi recording nahi** (user ko batana — recording settings check).

**(2026-10-28 ~16:45 IST) SD playback built:**
- Gateway `src/services/sd-playback.js` (new): `GET /api/video/sd-list` (0x9205→0x1205), `/api/video/playback-start` (0x9102 close live + 0x9201), `/api/video/playback-stop` (0x9202 end). Times camera-local `YYYY-MM-DD HH:mm:ss`.
- Gateway `server.js` patch (`patch_sd_playback.js`): **auto live-on-connect opt-in** (`AUTO_LIVE_ON_CONNECT=1`; pehle har reconnect pe ~8 Mbps stream chalu ho jaata tha = SIM data drain), 0x1205 → `activeSdQueries` resolve (pehle kabhi resolve nahi hota tha), routes register.
- Tested on gateway copy `/tmp/gwtest`: packets byte-sahi (0x9201 body 35B, 0x9202 9B), syntax OK.
- Local: Video Retrieval modal → "Retrieve Video" = SD playback dono channel (Time + Duration), close = 0x9202 stop; `FleetApi.listSdFiles/startSdPlayback/stopSdPlayback`; proxy timeout sd-list 8s; fake 59 mph badge hidden.

| # | Task |
|---|---|
| SD1.1 | App: event pe "SD card se video laao" → gateway `0x9205` query, file list dikhao |
| SD1.2 | `0x9201` playback stream ko HLS mein dikhao (live player reuse); `0x9202` pause/stop |
| SD1.3 | `fetch-sd` route (api.js) jo abhi fake `READY` + hardcoded `evt-101` URL deta hai, usko real flow se replace |
| SD1.4 | Gateway `storage/media/retrievals` ki auto-cleanup (TTL) taaki disk na bhare |

## MD1 — Multiple dashcams (2026-10-28 ~17:50 IST)

| # | Task | Status |
|---|---|---|
| MD1.1 | Naya camera gateway se connect → dashboard pe apne aap vehicle+device (`db.registerDiscoveredDevice`, `gateway.js` sync, plate `CAM-<last6>`, tenant-inurum) | ✅ tested: 3 cameras auto-added |
| MD1.2 | Fleet persist: `storage/fleet.json` (vehicles, devices, removedTerminals); add/update/delete/pair/unpair/toggle sab save; delete kiya camera dobara auto-add nahi hota | ✅ restart test pass |
| MD1.3 | `addDevice` random Pune location + fake ONLINE hataya | ✅ |
| MD1.4 | **Gateway: requested camera na mile toh command DUSRE camera ko jaati thi** (hardcoded `872312858278`/`860871080043592` + "any connected socket" fallback in start-live, stop, SD query) → privacy leak with many cameras. Patch `patch_multi_device.js` | ✅ deployed (backup `.bak-multi-20261028`); test: offline 872312860795 start-live → STANDBY, no 0x9101 to 505073 |
| MD1.6 | Auto-discovery sirf **online** cameras (gateway list mein purane test terminals the); 3 stale entries `fleet.json` se hataye (backup `fleet.json.bak-20261028`, removedTerminals mein nahi daale — asli connect pe wapas aa jayenge). Roster card: Offline / "Online · No GPS" sach dikhata hai, nakli "Desk Setup"/"Moving" nahi | ✅ |
| MD1.7 | (16:54 IST) 2nd dashcam `505073214789` → auto `CAM-214789`, ONLINE; H.264 + G.711A, ~300-360 kbps/ch; SD list OK. Check pending: recording live/stop ke baad chalti rehti hai ya nahi | ✅ / ⏳ |
| MD1.8 | (17:05 IST) GPS nahi aa raha: camera 0x0200 decode (`diag_gps.py`) → `505073214789` GPS_FIX=NO, lat/lng 0, **0 satellites**, alarm 0x11 = **GNSS module fault** (+SOS bit); camera 505073583696 bhi alarm 0x11. Hardware/antenna side issue (indoor / antenna port / module). Software: dashboard ab camera ki apni fix gateway `/api/devices` lat/lng se leta hai (sirf online + non-zero); `/api/v1/positions/latest` offline cameras ke liye nakli Indore point (speed 52) deta hai → skip | ⏳ user: antenna |
| MD1.9 | (17:24 IST) 3rd dashcam `505073322632` → auto `CAM-322632` ONLINE. Video **H.265 (PT 99)** → user ko app mein Main Stream H264 karna hai; GPS: 0 sats, alarm 0x11 GNSS fault (teeno cameras same) | ⏳ user: H264 + antenna |
| MD1.10 | (17:40 IST) 4th dashcam `505073474490` → auto `CAM-474490` ONLINE; **H.264 ✅** + G.711A, ~425 kbps CH1; GPS 0 sats / alarm 0x11 | ✅ / ⏳ antenna |
| MD1.14 | (18:56 IST) 6th ID `505073095782` = **wahi physical camera** (SD 114 files, timestamps 474490/729067 jaise). Har ID change = nayi dashboard entry (214789, 322632, 474490, 729067, 095782). CH2 intermittent (18:17 chala, ab nahi) → cable. User se: ek ID fix karo, duplicates hatane ki permission | ⏳ user |
| MD1.13 | (18:32 IST) 5th ID `505073729067` → auto `CAM-729067`. CH1 H.264 + audio ✅; **CH2 kuch nahi** (live + SD dono mein sirf CH1; SD recordings 18:24 se hi — naya/format card); GPS 0 sats, alarm 0x11 | ⏳ user: CH2 lens |
| MD1.12 | ✅ (18:17 IST) User ne CH2 theek kiya: CAM-474490 live test — CH1 H.264 ~510 kbps + audio, CH2 H.264 ~370 kbps + audio, dono alag connections pe | ✅ |
| MD1.11 | CH2 live nahi: camera 0x9101 CH2 ACK karta hai par media nahi bhejta; SD pe CH2 recording 17:04:21 ke baad band (sirf CH1) → CH2 lens cable/enable camera side. Note: 474490 aur 214789 ki SD files same timestamps → shayad ek hi camera, ID badla gaya | ⏳ user |
| MD1.5 | Gateway `/api/devices` khud `872312858278` (VEH-8278) inject karta hai; `MP-09-WW-4359` ki GPS 22.7339,75.8615 = app ka default map center (shayad nakli) | TODO |

## UI1 — Hardcoded/fake data removal (2026-10-28 ~19:30 IST)

- ✅ Back button / sidebar blank bug: incident view har page pe inline `display:none` lagata tha, `navigateTo` sirf class badalta tha → ab `navigateTo` inline display clear karta hai; incident view class-based; Back/Prev/Next bind on open. Headless test pass.
- ✅ Seeded fake incident (`db.js` SOS "now", Indore coords) hataya — Safety Inbox ab sirf real events (abhi 0).
- ✅ Incident detail: MTurner/Jamaica NY/PST/37672 fallbacks, AI bounding boxes, fake speed SVG, NY A/B stops, fake manager names hataye; time local TZ; map sirf real GPS (warna "No GPS fix"); video = "Play event video from SD card" (VR modal, event −10s).
- ✅ Inbox cards: Unsplash stock thumbs, fake 0.84G, "Straight Truck", "RKF", "Sanket Jain", PST hataye; "Fetch Clip" fake API → SD playback modal.
- ✅ Incident review modal + VR modal fake fallbacks (MP-09-WW-4359/Sanket Jain/Indore, 818/TOM/860871080043592) hataye.
- ✅ EV1 (2026-10-28 ~20:10 IST) Real events code: gateway `src/services/alarm-events.js` (0x0200 alarm word + JT1078 0x14-0x18 + ADAS 0x64/DSM 0x65; rising-edge only, first report = baseline, 5-min gap re-baseline, 60s cooldown; `storage/events.json` cap 5000; `GET /api/events?since=`), `patch_events.js` hooks TCP+UDP 0x0200. Unit test on `/tmp/gwtest` with real camera frame PASS (stuck SOS → no event; CH2 loss, collision, ADAS FCW → events; no dups). Local: `gateway.js syncEvents` (enrich plate/driver/tenant, skip unknown cameras) + `db.saveEvents/loadEvents` (`storage/events.json`), review persists, manual POST /events no fake fallbacks, inbox newest-first + category pill. Local sync test PASS. **Gateway deploy pending (permission)**; deploy: backup `server.js` → `.bak-events-20261028`, `node /tmp/gwtest/patch_events.js /home/ubuntu/DashCam-main`, `pm2 restart`.
- (old) TODO: real safety events banana camera alarms se (ADAS/DSM 0x0200 extras 0x64/0x65; SOS bit abhi hamesha on hai — usse events nahi banane).

## S1 — Security (client ko dene se pehle zaroori)

| # | Task |
|---|---|
| S1.1 | Saare `/api` routes pe `requireAuth()` (login chhod kar); null-user → SUPER_ADMIN fallback hatao (`/vehicles`, `/positions/latest`, `/events`) |
| S1.2 | `/safety/incidents/:id` + `/review` pe tenant check |
| S1.3 | `checkVehicleTenantAccess` ko device ke asli `tenantId` se compare karao |
| S1.4 | `/media` gate: sirf media ticket, terminalId match; `/media/live` proxy ko bhi gate ke peeche lao |
| S1.5 | ADMIN ko SUPER_ADMIN role assign karne se roko |
| S1.6 | Users API se `password` field hatao; suspended user login block |
| S1.7 | Hardcoded session tokens (`demo-token-superadmin` etc., `db.js:175`) hatao — koi bhi inse SUPER_ADMIN ban sakta hai |
| S1.8 | `/api/video/*` aur `/media/live/*` (server.js) bina auth ke chalte hain — auth lagao |
| S1.10 | Gateway server pe `.env` hi nahi hai → default `ADMIN_PASS=password`, `AUTH_SECRET=dashcam-enterprise-secret-2026` chal rahe hain; set karo. SSH private key chat mein share hui thi → rotate |
| S1.9 | `test/auth-isolation.test.js` purane `x-role` headers + purane device IDs use karta hai, pehle se fail — JWT login ke saath rewrite |

## S2 — Hardening

| # | Task |
|---|---|
| S2.1 | Password hashing (scrypt/bcrypt), default password `Inurum@2026` hatao |
| S2.2 | JWT secret + MySQL creds sirf env se; missing ho toh server start fail; secret rotate |
| S2.3 | Logout pe token revoke (denylist / short expiry + refresh) |
| S2.4 | Login rate limit, CORS allowlist |
| S2.5 | Java proxy (`/api/v1` → `100.31.90.51:8080` plain HTTP) review: auth ke baad, ya band |

## C1 — Cleanup

| # | Task |
|---|---|
| C1.1 | `100.31.90.51` ko config (`GATEWAY_URL`) mein, ~10 hardcoded jagah se hatao |
| C1.2 | Duplicate telemetry sync (server.js + api.js) ek function mein |
| C1.3 | `C:\Users\shiva\Downloads` path hatao |
| C1.4 | `fetch-sd` hardcoded `evt-101` URL fix |
| C1.5 | `POST /tenants` input validation (`code` missing crash) |
| C1.6 | Khaali `roadeazyService.js` hatao ya implement karo |

## Baad mein (existing MILESTONES.md ke M5–M7)
Quotas atomic enforcement, retention cleanup, reports, load/soak tests, backups — `MILESTONES.md` dekho.
