================================================================================
           INURUM 4G DASHCAM CLIENT RELEASE PACKAGE
================================================================================

This package contains both the Android Mobile APK and the Web Portal build.

--------------------------------------------------------------------------------
1. ANDROID MOBILE APP (For Android Phones / Tablets)
--------------------------------------------------------------------------------
Folder: Android_App/
File:   Inurum_Dashcam_Client.apk

How to Install on Phone:
1. Transfer 'Inurum_Dashcam_Client.apk' to your Android phone via WhatsApp, Google Drive, or USB cable.
2. Tap the APK file on your phone.
3. If prompted, allow "Install from Unknown Sources".
4. Open the installed "DashCAM" app.
5. Tap on "Live Camera" or "Fleet" to view the live dual dashcam feed.

--------------------------------------------------------------------------------
2. WEB / DESKTOP PORTAL (For PC, Laptop & Web Hosting)
--------------------------------------------------------------------------------
Folder: Web_App/

Option A - Run on Windows PC / Laptop:
1. Open the 'Web_App' folder.
2. Double-click 'Start_Web_App.bat'.
3. It will automatically launch the dashboard in your browser at:
   http://localhost:8090/#/camera

Option B - Deploy on Web Hosting (Cloud / Nginx / Vercel / Netlify):
1. Upload the entire contents of the 'Web_App' folder to any static web host, S3, Firebase Hosting, or Nginx server.
2. The web app is completely standalone and connects directly to the 4G JT1078 media gateway.

--------------------------------------------------------------------------------
CAMERA & AUDIO DETAILS
--------------------------------------------------------------------------------
- Terminal / IMEI ID: 872312858278 (LA-CAT4 / GD19 Dual Cam)
- CH1: Front Road Lens (1080P FHD)
- CH2: Cabin / Driver Lens (720P HD)
- Audio: Tap the "🔊 Unmute Audio" button on the video player to listen to live cabin audio.
================================================================================
