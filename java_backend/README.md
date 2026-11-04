# Inurum Dashcam Java backend

Spring Boot 3 / Java 17 REST API for the web console (`public/`). It runs on the gateway server (100.31.90.51) on port **8021**.

```
browser ──> web console (src/server.js, :3001)
              ├─ /api/v1/*    ──> this backend (:8021) ──> MySQL dashcam_db
              │                                     └──> JT808/JT1078 gateway (:3000, same server)
              └─ /media/live/* ──> gateway (:3000)          cameras connect to :7800 / :10780
```

The Node gateway (`~/DashCam-main`, pm2 `dashcam-server`) owns the camera sockets. This backend never talks to a camera directly. It asks the gateway for:

- `/api/devices`: connection status, GPS, firmware, SIM
- `/api/video/start-live` and `/api/video/stop-live`: JT1078 0x9101 / 0x9102
- `/api/video/sd-list`, `/api/video/playback-start` and `/api/video/playback-stop`: SD card footage
- `/api/events`: camera alarm events, synced when the gateway exposes them

Nothing is invented. A value the cameras don't report is `null` or `"Not Available"`, and an offline camera shows as `OFFLINE`.

## Security
- Every `/api/v1/**` route needs `Authorization: Bearer <jwt>`, except `POST /api/v1/auth/login`.
- Passwords are stored as BCrypt hashes. Tokens are HS256 and expire after 12 h.
- Roles: `SUPER_ADMIN` (all organizations), `ADMIN`, `DISPATCHER`, `SAFETY_MANAGER`, `CUSTOMER`. Everyone except `SUPER_ADMIN` sees only their organization. A user can also be restricted to specific cameras.

## Live video limits (₹500 / vehicle / year)
Each organization has cost controls (`/api/v1/admin/cost-controls`):

- A session stops after `maxStreamDurationSeconds`.
- Live minutes per month = paired cameras × `monthlyStreamingQuotaMinutes`. Starting a stream returns 402 once that is used up.
- At most `maxConcurrentStreams` cameras can be live at a time.
- A stream stops 30 s after the last viewer heartbeat.

## Run
```bash
mvn -B package -DskipTests
java -jar target/inurum-dashcam-backend-1.0.0.jar
```
Without `SPRING_DATASOURCE_*` it uses a local H2 file database (`./data`).

## Environment

| Variable | Purpose |
|---|---|
| `SPRING_DATASOURCE_URL` / `_DRIVER` / `_USERNAME` / `_PASSWORD` | MySQL connection (see `dashcam-backend.service`) |
| `JWT_SECRET` | Token signing key. If it is not set, a random key is used and everyone must log in again after a restart |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | Creates one SUPER_ADMIN, but only while the users table is empty |
| `GATEWAY_URL` | Gateway base URL, default `http://127.0.0.1:3000` |

On the server, the secrets are in `/home/ubuntu/dashcam-backend/db.env` (chmod 600). That file is loaded by the systemd unit `dashcam-backend.service`.

API docs: `http://<host>:8021/swagger-ui.html`
