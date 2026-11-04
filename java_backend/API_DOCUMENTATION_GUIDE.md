# 🚗 Inurum Enterprise Dashcam & Telematics SaaS
## Complete REST & Streaming API Documentation Guide (v1.0.0)

> **Document Classification:** Client & Developer Integration Guide  
> **Release Date:** November 2026  
> **Backend Framework:** Spring Boot 3.2.3 (Java 17 LTS)  
> **Protocol Standards:** JT/T 808 (Telematics), JT/T 1078 (Live Video HLS), RFC 7519 (JWT Bearer)  
> **Interactive Swagger UI:** `http://<SERVER_IP>:8080/swagger-ui/index.html`  
> **OpenAPI 3 JSON Specification:** `http://<SERVER_IP>:8080/v3/api-docs`

---

## 📌 Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Base URL & Protocol Standards](#2-base-url--protocol-standards)
3. [Authentication & Authorization (JWT)](#3-authentication--authorization-jwt)
4. [Vehicles & Hardware Terminals API](#4-vehicles--hardware-terminals-api)
5. [GPS Telematics & Real-Time Tracking (SSE)](#5-gps-telematics--real-time-tracking-sse)
6. [Live Video Streaming & Recordings (HLS)](#6-live-video-streaming--recordings-hls)
7. [ADAS & DMS Safety Incidents & Coaching](#7-adas--dms-safety-incidents--coaching)
8. [Historical Trips & Animated Route Replay](#8-historical-trips--animated-route-replay)
9. [Dashcam Hardware & Safety Configuration (17 Parameters)](#9-dashcam-hardware--safety-configuration-17-parameters)
10. [Multi-Tenant Fleet Administration & Cost Controls](#10-multi-tenant-fleet-administration--cost-controls)
11. [Reports & CSV Data Export](#11-reports--csv-data-export)
12. [Error Codes & HTTP Status Standards](#12-error-codes--http-status-standards)

---

## 1. Overview & Architecture

The **Inurum Enterprise Dashcam Backend** is a high-performance, 100% in-house native backend engineered for fleet management, dual-channel commercial dashcams, live telematic tracking, and AI safety alarms.

### Key Capabilities:
- **Zero Third-Party Dependency:** Built ground-up without external telematics vendor lock-in.
- **Dual-Lens Video Pipeline:** Road-facing camera (CH1 - 1080P FHD) and Cabin/DMS camera (CH2 - 720P Infrared Night Vision).
- **100% Database Persistence:** All fleet assets, configurations, users, trips, alarms, and quotas are persisted directly in SQL tables via JPA.
- **Reactive Telemetry (SSE):** Real-time GPS coordinates published every 2 seconds over HTTP Server-Sent Events to web and mobile clients.
- **Hardware Integration:** Compatible with JT/T 808 (GPS, status, alarm packets) and JT/T 1078 (video streaming).

---

## 2. Base URL & Protocol Standards

### Base URLs
- **Local Development:** `http://localhost:8080`
- **Production Server:** `http://<YOUR_SERVER_IP>:8080`
- **API Version Prefix:** All endpoints accept both `/api/v1` and `/api` prefixes.

### Default Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <YOUR_SIGNED_JWT_TOKEN>
```

---

## 3. Authentication & Authorization (JWT)

All protected API endpoints require an HMAC-SHA256 signed JWT Bearer Token passed via the `Authorization` header.

### 3.1 User Login
Authenticates an enterprise user and returns a signed cryptographic token and organization claims.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/login`
- **Access:** Public

#### Request Body:
```json
{
  "email": "Inurum",
  "password": "as123456"
}
```

#### Response (`200 OK`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwiZW1haWwiOiJJbnVydW0iLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJ0ZW5hbnRJZCI6InRlbmFudC1pbnVydW0tbWFzdGVyIn0.xxxxxx",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "user": {
    "id": "usr-001",
    "name": "Inurum WanWay Master",
    "email": "Inurum",
    "role": "SUPER_ADMIN",
    "tenantId": "tenant-inurum-master",
    "tenantName": "Inurum Global Fleet (WanWay Master)"
  }
}
```

### 3.2 Current User Profile (`/auth/me`)
- **Method:** `GET`
- **Endpoint:** `/api/v1/auth/me`
- **Headers:** `Authorization: Bearer <TOKEN>`

#### Response (`200 OK`):
```json
{
  "user": {
    "id": "usr-001",
    "name": "Inurum WanWay Master",
    "email": "Inurum",
    "role": "SUPER_ADMIN",
    "tenantId": "tenant-inurum-master",
    "tenantName": "Inurum Global Fleet (WanWay Master)"
  },
  "displayTimezone": "Asia/Kolkata (IST)",
  "deviceTimezone": "UTC"
}
```

### 3.3 SaaS Quotas & Live Streaming Usage
Tracks current data usage, cloud storage consumption, and remaining live minutes.

- **Method:** `GET`
- **Endpoint:** `/api/v1/quotas` (or `/api/v1/usage`)

#### Response (`200 OK`):
```json
{
  "planName": "Inurum Enterprise Dashcam Fleet Tier",
  "pricePerDeviceYearInr": 500,
  "quota": {
    "totalDevices": 4,
    "maxLiveMinutes": 120,
    "liveMinutesUsed": 16.2,
    "remainingLiveMinutes": 103.8
  },
  "storage": {
    "usedGb": 18.4,
    "limitGb": 100.0,
    "percentUsed": 18.4
  },
  "features": {
    "liveHlsEnabled": true,
    "dualChannelStream": true,
    "googleMapsIntegrated": true,
    "adasAlerts": true,
    "dmsDriverFatigue": true
  }
}
```

---

## 4. Vehicles & Hardware Terminals API

### 4.1 List All Fleet Vehicles
- **Method:** `GET`
- **Endpoint:** `/api/v1/vehicles` (or `/api/v1/assets`)
- **Query Parameters:**
  - `status` *(optional)*: `Active`, `Inactive`, `ONLINE`, `OFFLINE`
  - `search` *(optional)*: Filter by license plate, vehicle name, or driver name
  - `terminalId` *(optional)*: Filter by dashcam IMEI
  - `offset` *(default: 0)*, `limit` *(default: 100)*

#### Response (`200 OK`):
```json
{
  "total": 4,
  "filter": {
    "status": null,
    "search": null,
    "terminalId": null
  },
  "vehicles": [
    {
      "id": "860871080043592",
      "terminalId": "860871080043592",
      "label": "WanWay H20P Dual Dashcam",
      "plateNumber": "MP-09-WW-4359",
      "driverName": "Sanket Jain",
      "fleetName": "Inurum Global Fleet",
      "status": "ONLINE",
      "deviceStatus": "Active",
      "speed": 48.5,
      "lat": 22.7533,
      "lng": 75.8937,
      "heading": 216,
      "ignition": true,
      "terminalModel": "WanWay H20P"
    }
  ]
}
```

### 4.2 Get Vehicle By ID / IMEI
- **Method:** `GET`
- **Endpoint:** `/api/v1/vehicles/{id}`

### 4.3 Create New Vehicle Record
- **Method:** `POST`
- **Endpoint:** `/api/v1/vehicles`

#### Request Body:
```json
{
  "entityId": "860871080099999",
  "entityName": "Delivery Van Express #12",
  "licensePlate": "MH-12-AB-1234",
  "fleetName": "Inurum Global Fleet",
  "deviceStatus": "Active",
  "vehicleDynamicsStatus": "Moving",
  "speed": 35.0,
  "latitude": 19.0760,
  "longitude": 72.8777,
  "driverName": "Amit Sharma",
  "assignedDriverId": "drv-005"
}
```

### 4.4 Update Vehicle
- **Method:** `PUT`
- **Endpoint:** `/api/v1/vehicles/{id}`

### 4.5 Toggle Vehicle Active Status
- **Method:** `POST`
- **Endpoint:** `/api/v1/vehicles/{id}/toggle-status`

### 4.6 Pair / Unpair Hardware Dashcam
- **Pair:** `POST /api/v1/vehicles/{id}/pair-device` with body `{"terminalId": "860871080043592"}`
- **Unpair:** `POST /api/v1/vehicles/{id}/unpair-device`

### 4.7 Hardware Health Diagnostics
Retrieves live battery voltage, storage health, GPS fix status, and camera signals.
- **Method:** `GET`
- **Endpoint:** `/api/v1/devices/health`

#### Response (`200 OK`):
```json
{
  "total": 4,
  "serverTime": "2026-11-02T06:15:00Z",
  "devices": [
    {
      "terminalId": "860871080043592",
      "plateNumber": "MP-09-WW-4359",
      "status": "Active",
      "powerMode": "IGNITION_HIGH",
      "batteryVoltage": 12.6,
      "storageStatus": "OK",
      "sdCardCapacityGb": 128,
      "sdCardUsedGb": 42,
      "gpsFix": true,
      "satellites": 14,
      "cellularSignalBars": 4,
      "ch1VideoSignal": "NORMAL",
      "ch2VideoSignal": "NORMAL",
      "lastSeen": "2026-11-02T06:14:58Z"
    }
  ]
}
```

---

## 5. GPS Telematics & Real-Time Tracking (SSE)

### 5.1 Real-Time Server-Sent Events (SSE) Stream
Continuously pushes updated coordinates, speed, and ignition status to browser and mobile apps.

- **Method:** `GET`
- **Endpoint:** `/api/v1/devices/location/stream`
- **Headers:** `Accept: text/event-stream`

#### Stream Event Output (`event: live-location`):
```json
data: {
  "assetId": "860871080043592",
  "timestamp": "2026-11-02T06:15:22Z",
  "location": {
    "latitude": 22.7533,
    "longitude": 75.8937,
    "altitude": 540.0,
    "accuracy": 5.0,
    "speed": 48.5,
    "heading": 216.0
  },
  "additionalInfo": {
    "ignitionStatus": "on",
    "batteryVoltage": 12.6,
    "plateNumber": "MP-09-WW-4359",
    "driverName": "Sanket Jain",
    "address": "Indore-Dewas Bypass Rd, Nipania, MP 452010"
  }
}
```

### 5.2 Latest Vehicle Positions (REST Polling)
- **Method:** `GET`
- **Endpoint:** `/api/v1/positions/latest?terminalId=860871080043592`

---

## 6. Live Video Streaming & Recordings (HLS)

The backend natively manages JT/T 1078 live video distribution formatted as standard HLS (`.m3u8` playlist and `.ts` video chunks).

### 6.1 Initiate Live Video Session
- **Method:** `POST`
- **Endpoint:** `/api/v1/live-sessions` (or `/api/v1/live/start`)

#### Request Body:
```json
{
  "terminalId": "860871080043592",
  "channelId": 1
}
```
*Note: `channelId: 1` = Road-facing main camera; `channelId: 2` = Cabin driver DMS camera.*

#### Response (`200 OK`):
```json
{
  "sessionId": "live-860871080043592-ch1-1762064123",
  "terminalId": "860871080043592",
  "channelId": 1,
  "streamUrl": "http://100.31.90.51:3000/media/live/860871080043592_1/live.m3u8",
  "streamUrlM3u8": "http://100.31.90.51:3000/media/live/860871080043592_1/live.m3u8",
  "timeToLiveSeconds": 120,
  "remainingLiveMinutes": 28.5,
  "hasAudio": true,
  "videoCodec": "H.264",
  "audioCodec": "AAC"
}
```

### 6.2 Stop Live Session
- **Method:** `POST`
- **Endpoint:** `/api/v1/live-sessions/stop`
- **Request Body:** `{"terminalId": "860871080043592"}`

### 6.3 Heartbeat Watchdog
Extends live session TTL by 120 seconds during active player playback.
- **Method:** `POST` or `GET`
- **Endpoint:** `/api/v1/video/heartbeat`

### 6.4 Still Snapshot Frame
- **Method:** `GET`
- **Endpoint:** `/api/v1/devices/{imei}/snapshot?cameraId=0`
- **Response:**
```json
{
  "deviceId": "860871080043592",
  "cameraId": 0,
  "snapshotUrl": "http://100.31.90.51:3000/media/live/860871080043592_1/snapshot.jpg",
  "timestamp": "2026-11-02T06:15:30Z"
}
```

### 6.5 Video Recordings Archive
- **Method:** `GET`
- **Endpoint:** `/api/v1/video/recordings?terminalId=860871080043592&channel=1&date=2026-10-28`

---

## 7. ADAS & DMS Safety Incidents & Coaching

### 7.1 Safety Alarms Inbox
- **Method:** `GET`
- **Endpoint:** `/api/v1/safety/events` (or `/api/v1/events`, `/api/v1/safety/incidents`)
- **Query Parameters:**
  - `terminalId`: Filter by vehicle IMEI
  - `date`: Date filter (`YYYY-MM-DD`)
  - `severity`: `CRITICAL`, `MAJOR`, `WARNING`, `MINOR`
  - `type`: Violation type (e.g. `Overspeed`, `Fatigue`, `Braking`, `Phone`)

#### Response (`200 OK`):
```json
{
  "total": 4,
  "events": [
    {
      "id": "evt-1028-02",
      "imei": "860871080043592",
      "assetName": "WanWay H20P Dual Dashcam",
      "driverName": "Sanket Jain",
      "eventName": "Driver Fatigue Detected",
      "eventCategory": "DMS Behavior",
      "severity": "WARNING",
      "time": "2026-10-28T11:45:00Z",
      "speed": 46.0,
      "latitude": 22.7196,
      "longitude": 75.8577,
      "mediaState": "READY",
      "triageStatus": "COACHED",
      "mediaUrl": "http://100.31.90.51:3000/media/860871080043592_evt-1028-02.mp4",
      "roadCamVideoUrl": "http://100.31.90.51:3000/media/live/860871080043592_1/live.m3u8",
      "cabinCamVideoUrl": "http://100.31.90.51:3000/media/live/860871080043592_2/live.m3u8"
    }
  ]
}
```

### 7.2 Review & Coach Incident
- **Method:** `POST`
- **Endpoint:** `/api/v1/safety/incidents/{id}/review`
- **Request Body:**
```json
{
  "status": "COACHED",
  "notes": "Driver counseled regarding continuous 4-hour drive rest break guidelines."
}
```

### 7.3 Fetch Incident Video from MicroSD Card
- **Method:** `POST`
- **Endpoint:** `/api/v1/events/{id}/fetch-sd`

---

## 8. Historical Trips & Animated Route Replay

### 8.1 List Trips
- **Method:** `GET`
- **Endpoint:** `/api/v1/trips?terminalId=860871080043592&date=2026-10-26`

### 8.2 Get Trip Trajectory with GPS Breadcrumbs
Returns every interpolated coordinate for map route sliders and speed graph animation.

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{id}`

#### Response (`200 OK`):
```json
{
  "trip": {
    "entityId": "trip-wanway-1026-01",
    "imei": "860871080043592",
    "assetName": "WanWay H20P Dashcam",
    "vehiclePlate": "MP-09-WW-4359",
    "driverName": "Sanket Jain",
    "distanceTraveled": 24.8,
    "durationMinutes": 38,
    "maxSpeedKmH": 78.5,
    "avgSpeedKmH": 46.2,
    "safetyEventsCount": 2,
    "startTime": "2026-10-26T08:30:00Z",
    "endTime": "2026-10-26T09:08:00Z",
    "startAddress": "Indore MR-10 Toll Plaza, MP",
    "endAddress": "Dewas Industrial Area Bypass, MP",
    "points": [
      { "lat": 22.7533, "lng": 75.8937, "speed": 30.0, "timestamp": "2026-10-26T08:00:00Z" },
      { "lat": 22.7618, "lng": 75.9001, "speed": 42.5, "timestamp": "2026-10-26T08:01:30Z" },
      { "lat": 22.9676, "lng": 76.0534, "speed": 55.0, "timestamp": "2026-10-26T08:38:00Z" }
    ]
  }
}
```

---

## 9. Dashcam Hardware & Safety Configuration (17 Parameters)

Directly updates dashcam hardware firmware registers via JT/T 808 parameter command packets.

### 9.1 Fetch Device Configuration
- **Method:** `GET`
- **Endpoint:** `/api/v1/devices/{imei}/settings`

#### Response (`200 OK`):
```json
{
  "terminalId": "860871080043592",
  "deviceLocalIp": "192.168.1.1",
  "settings": {
    "entityId": "860871080043592",
    "apn": "iot.airtel.in",
    "platformServer": "100.31.90.51",
    "platformPort": 7800,
    "gbPlatformId": "3101150000",
    "wlanSsid": "DASHCAM_AP_4359",
    "serialBaudRate": "115200",
    "roadCamEnable": true,
    "roadCamQuality": "Standard Quality",
    "driverCamEnable": true,
    "driverCamQuality": "Extended Storage",
    "driverAudioEnable": false,
    "ignitionOffStandbyDelay": 300,
    "overrideFleetSettings": true
  }
}
```

### 9.2 Save Device Configuration
- **Method:** `PUT`
- **Endpoint:** `/api/v1/devices/{imei}/settings`

---

## 10. Multi-Tenant Fleet Administration & Cost Controls

### 10.1 SaaS Executive Dashboard Metrics
- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/saas-metrics`

#### Response (`200 OK`):
```json
{
  "totalVehicles": 4,
  "onlineVehicles": 4,
  "offlineVehicles": 0,
  "totalIncidentsToday": 4,
  "criticalAlarmsToday": 2,
  "totalDistanceTodayKm": 66.4,
  "totalLiveMinutesMonth": 16.2,
  "allocatedLiveMinutesMonth": 120,
  "activeTenants": 3,
  "monthlyRunRateInr": 166,
  "storageUsedGb": 18.4,
  "storageLimitGb": 100.0,
  "bandwidthUsedGb": 4.8
}
```

### 10.2 Organization / Tenant Management
- `GET /api/v1/admin/organizations` - List all tenant fleets
- `POST /api/v1/admin/organizations` - Create new company tenant
- `PUT /api/v1/admin/organizations/{id}` - Update tenant tier
- `POST /api/v1/admin/organizations/{id}/toggle-status` - Activate / Suspend tenant

### 10.3 Fleet Drivers Management
- `GET /api/v1/drivers` - List drivers
- `POST /api/v1/drivers` - Add driver (`name`, `licenseNumber`, `phone`, `assignedVehicle`)
- `PUT /api/v1/drivers/{id}` - Update driver
- `DELETE /api/v1/drivers/{id}` - Delete driver

### 10.4 Logistics Branches & Hubs
- `GET /api/v1/branches` - List regional logistics hubs
- `POST /api/v1/branches` - Register new depot

### 10.5 Audit Logs
- `GET /api/v1/admin/audit-logs` - Chronological administrative audit trail

---

## 11. Reports & CSV Data Export

### 11.1 Fleet Summary Report
- **Method:** `GET`
- **Endpoint:** `/api/v1/reports/summary?date=2026-10-28`

### 11.2 Streamed CSV Export
Directly streamable into Microsoft Excel or Google Sheets.
- **Method:** `GET`
- **Endpoint:** `/api/v1/reports/export-csv?date=2026-10-28&type=TRIPS`
- **Content-Type:** `text/csv`

---

## 12. Error Codes & HTTP Status Standards

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `200 OK` | — | Request succeeded successfully. |
| `201 Created` | — | Entity registered and persisted in database. |
| `202 Accepted` | — | Remote hardware job queued over JT/T 808 channel. |
| `400 Bad Request` | `VALIDATION_ERROR` | Missing required parameters or invalid syntax. |
| `401 Unauthorized`| `UNAUTHORIZED` | Expired, missing or invalid JWT Bearer token. |
| `403 Forbidden` | `ACCESS_DENIED` | User lacks role permissions for tenant resource. |
| `404 Not Found` | `NOT_FOUND` | Specified vehicle, trip, or incident ID does not exist. |
| `500 Server Error`| `INTERNAL_ERROR` | Unhandled backend exception logged to database. |

---

*Enterprise Support Contact: support@inurum.com | Portal: https://inurum.com*

