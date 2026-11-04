@echo off
title Inurum Dashcam Client Portal
echo ============================================================
echo   STARTING INURUM DASHCAM ENTERPRISE CLIENT PORTAL
echo ============================================================
echo.
echo Launching local server on port 8090...
start "" "http://localhost:8090/#/camera"
npx --yes serve -s . -p 8090 --cors
pause
