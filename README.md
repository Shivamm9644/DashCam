# DashCam playback repair

## Start on Windows

Use Node.js 24.11 or newer. Extract this ZIP into a **new folder** so that old project files cannot override this build.

```powershell
npm ci
npm start
```

Open http://localhost:3000. Demo login: `admin` / `password`.
Open **Simulation Console**, then **Start Indore Demo**. The default run is 30 seconds. Open Live Monitor; allow roughly 4–8 seconds for the first complete segment. Click Play if your browser blocks autoplay and use Unmute Audio for sound.

The simulator produces a moving test chart with a timer and audible tone. It does not contain real road footage. A ready-to-play output clip is included in `evidence/verified-3-second-clip.mp4`.

In **Reels & History**, select a **Full recording** session for continuous playback and seeking, or play individual clips below it. Refresh Clips updates the clip list. Reopen History to refresh the session selector if needed.

Ports: dashboard 3000, JT808 TCP 7800, JT1078 TCP 10780.

## Changes

- Simulator groups H.264 NAL units into complete picture access units. SPS/PPS are not counted as video frames. Generated fixtures use AUD, baseline H.264 without B frames, a 3-second closed GOP, and repeated parameter sets.
- Audio scheduling uses the ADTS sample rate and sample count; video and audio are sent in timestamp order.
- The new timestamped MPEG-TS muxer writes incoming frame PTS and video PCR. FFmpeg remuxes TS to MP4 without replacing the media clock with a frame counter.
- HLS segments retain a continuous timestamp timeline, monotonic rolling sequence numbers, UTC program-date-time tags, and final ENDLIST. Full-session playlists provide continuous history.
- Each session has a unique folder and segment IDs. A second recording does not overwrite earlier files.
- FFmpeg runs asynchronously. Segments are marked READY only after successful remux and duration validation.
- The player retries missing or failed live manifests. The first segment of a new session reconnects the player. Explicit playback controls are available.
- New reels are appended rather than replacing the active video element. Live telemetry follows the displayed HLS fragment time instead of incoming WebSocket telemetry.
- HLS.js and Leaflet are served locally from installed dependencies. Map tiles still require Internet access.
- SIGINT/SIGTERM flush pending media. SQLite and the complete media directory must be kept together.
- Transparent packets use their separate header layout. Fragment assembly rejects missing/out-of-sequence parts and limits frame sizes.

## Module overview

| Module | Responsibility |
|---|---|
| `src/server.js` | HTTP routes, TCP ingress, shutdown, static player assets |
| `src/simulator/engine.js` | Simulator network clients and media pacing |
| `src/simulator/media-feeder.js` | H.264 access units and AAC frames |
| `src/protocols/jtt1078/media-parser.js` | Packet framing and headers |
| `src/protocols/jtt1078/media-handler.js` | Reassembly, session recordings, queued exports |
| `src/protocols/jtt1078/ts-muxer.js` | Timestamped H.264/AAC transport |
| `src/services/sync-service.js` | Playback UTC to telemetry lookup |
| `src/storage/db.js` | SQLite records and queries |
| `public/index.html` | Live, history, reels, console and maps |

## Verified results

Tested on Linux, Node 24.19.0, system FFmpeg/FFprobe. Windows has not been executed here; installer dependencies and cross-platform paths are retained.

- Original unit suite: 12/12 pass.
- 30-second TCP scenario: 30 records, 10 clips, 30.000 seconds video, zero decoder errors.
- 1000-second TCP scenario: 1000 records, 334 clips, 1000.000 seconds video, zero decoder errors across all clips.
- Maximum audio/video track-duration difference in the 1000-second run: approximately 19.23 ms. This is a duration measurement, not a perceptual lip-sync test.
- Independent timestamp test: irregular 0/40/120 ms video timing and 50 ms audio offset survive TS-to-MP4 remux.
- A second recording preserves the first recording's bytes and metadata.
- An actual new server process serves historical clips and metadata after restart.
- Local HLS and map JavaScript assets return HTTP 200.

```powershell
npm test
npm run test:playback
node test/mux-timestamps.js
npm run test:full
```

Run tests with the normal server stopped. Playback tests use separate temporary storage. Some older legacy test scripts use the project's normal database; use the new playback regression commands for isolated testing.

## Limits and remaining work

This is a playback repair for the supplied simulator, **not a claim of complete device-protocol compliance or production readiness**.

- Browser interaction could not be run in the available cloud browser because localhost was blocked. Player changes were reviewed and JavaScript syntax checked; actual browser playback, autoplay, pause/seek/map behavior and audibility still need local acceptance.
- H.264 without B frames and AAC ADTS are the supported media profile. H.265, other audio codecs, B-frame reordering, arbitrary vendor audio framing and a real camera have not been verified.
- The fallback access-unit grouping for older files targets progressive baseline streams. Generated fixtures contain explicit AUD boundaries.
- Relative device timestamps are initially anchored to receipt time. A real device needs a verified clock profile for accurate absolute GPS/video mapping.
- The original demo web login is not secure authorization. JT808 authentication enforcement and other security work remain before public deployment.
- Existing old videos without database records do not automatically acquire trustworthy UTC metadata. Preserve the original folder; do not import or relabel those files blindly.
- Simulator profile supports 1-second telemetry, generated 25 fps video, and the configured segment duration. It loops a 12-second source pattern while the recording timeline continues.
- Very long keyframe intervals, multiple real terminals/channels, resource saturation, and damaged networks need additional device/load tests.

Keep `storage/` when restarting or updating. Do not copy the old `node_modules` into this folder; use `npm ci`.
