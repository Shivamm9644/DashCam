# Inurum Dashcam Enterprise - Web Application & Database

Complete Full-Stack Web Application + Integrated Database Engine for Enterprise Fleet Dashcam & Telematics.

## 🌐 Overview
- **Web Frontend**: High-definition dual camera live stream deck (CH1 Road + CH2 Driver Cabin DMS), dynamic HUD OSD telemetry, interactive Google Maps with real-time tracking, video playback with timeline scrubber, and multi-tenant fleet administration.
- **Backend Server & Database**: Node.js / Express backend with SQLite / JSON transactional persistence in `storage/` and complete REST API endpoints for vehicles, live sessions, events, drivers, and tenants.

---

## 🚀 How to Run

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### Setup & Launch
1. Open terminal inside this directory.
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
   Or in development mode:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```
   (Or configured port, e.g. `3001`).

---

## 📁 Directory Structure
- `public/`: Web frontend assets
  - `index.html`: Complete single-page enterprise console
  - `styles.css`: Glassmorphic dark cybernetic styling
  - `app.js`: Real live video streaming, OSD telemetry, Google Maps controller
  - `videos/`: Real dashcam video feeds (`road_cam.mp4`, `cabin_cam.mp4`)
- `src/`: Backend server & database logic
  - `server.js`: Express server and static asset hosting
  - `database/db.js`: Database engine with transactional isolation
  - `routes/`: API routes (telematics, live sessions, events, assets)
  - `middleware/`: Authentication and role-based access control
- `storage/`: Persistent database files
