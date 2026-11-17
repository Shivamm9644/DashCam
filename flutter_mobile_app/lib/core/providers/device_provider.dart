import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class DeviceProvider extends ChangeNotifier {
  // Device Management Settings (mirrors 192.168.1.1 UI)
  DeviceSettings settings = DeviceSettings();
  bool isLoading = false;

  DeviceProvider() {
    _loadSavedImeiFromDb();
  }

  Future<void> _loadSavedImeiFromDb() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedImei = prefs.getString('active_selected_device_id');
      if (savedImei != null && savedImei.isNotEmpty) {
        systemStatus = SystemStatus(
          firmware: systemStatus.firmware,
          imei: savedImei,
          simIccid: '8991${savedImei}001',
          networkType: systemStatus.networkType,
          signalStrength: systemStatus.signalStrength,
          voltage: systemStatus.voltage,
          temperature: systemStatus.temperature,
          sdCardTotal: systemStatus.sdCardTotal,
          sdCardFree: systemStatus.sdCardFree,
          uptime: systemStatus.uptime,
          isOnline: systemStatus.isOnline,
        );
        notifyListeners();
      }
    } catch (_) {}
  }

  // System Status
  SystemStatus systemStatus = SystemStatus(
    firmware: 'v1.2.6-GD19',
    imei: '',
    simIccid: '8991001',
    networkType: '4G LTE Cat 4',
    signalStrength: 0,
    voltage: '12.4V',
    temperature: '36°C',
    sdCardTotal: '128 GB',
    sdCardFree: '96 GB',
    uptime: 'Offline',
    isOnline: false, // Strictly offline until server signals connection
  );

  // GPS Status
  GpsStatus gpsStatus = GpsStatus(
    lat: 0.0,
    lng: 0.0,
    altitude: 85,
    speed: 0,
    heading: 0,
    satellites: 14,
    accuracy: 1.8,
    isFixed: true,
    fixTime: '2026-10-30 07:05:19 UTC',
  );

  // Live Camera Streaming State
  int activeChannel = 1; // 1 = Front/Road, 2 = Cabin/DMS, 3 = Dual Split
  bool isStreaming = true;
  bool isRecording = true;
  bool isAudioMuted = false;
  String streamQuality = '1080P (FHD)';
  String connectionMode = 'WIFI_HOTSPOT'; // 'WIFI_HOTSPOT' or 'CLOUD_4G'
  String deviceIp = '192.168.1.1';
  int rtspPort = 554;
  int httpPort = 8080;
  String customStreamUrl = 'rtsp://192.168.1.1:554/live/ch0';
  int snapshotCount = 0;
  String lastSnapshotPath = '';
  int liveTtlSeconds = 120;
  bool isEmergencyRecording = false;

  Future<void> switchChannel(int channel) async {
    activeChannel = channel;
    if (connectionMode == 'CLOUD_4G') {
      final chIndex = (channel == 2) ? 1 : 0;
      try {
        final res = await ApiService.instance.post(
          '/devices/${systemStatus.imei}/live-stream?cameraId=$chIndex',
          {},
        );
        if (res.containsKey('url') && res['url'] != null) {
          customStreamUrl = res['url'].toString();
        } else {
          customStreamUrl = 'https://100.31.90.51.sslip.io/api/v1/devices/${systemStatus.imei}/live-stream?cameraId=$chIndex';
        }
      } catch (_) {
        customStreamUrl = 'https://100.31.90.51.sslip.io/api/v1/devices/${systemStatus.imei}/live-stream?cameraId=$chIndex';
      }
    } else {
      if (channel == 1) {
        customStreamUrl = 'rtsp://$deviceIp:$rtspPort/live/ch0';
      } else if (channel == 2) {
        customStreamUrl = 'rtsp://$deviceIp:$rtspPort/live/ch1';
      }
    }
    notifyListeners();
  }

  void toggleStream() {
    isStreaming = !isStreaming;
    notifyListeners();
  }

  void toggleAudio() {
    isAudioMuted = !isAudioMuted;
    notifyListeners();
  }

  void setQuality(String quality) {
    streamQuality = quality;
    notifyListeners();
  }

  void setConnectionMode(String mode) {
    connectionMode = mode;
    notifyListeners();
  }

  void setOnlineStatus(bool online) {
    if (systemStatus.isOnline != online) {
      systemStatus = SystemStatus(
        firmware: systemStatus.firmware,
        imei: systemStatus.imei,
        simIccid: systemStatus.simIccid,
        networkType: systemStatus.networkType,
        signalStrength: online ? 4 : 0,
        voltage: systemStatus.voltage,
        temperature: systemStatus.temperature,
        sdCardTotal: systemStatus.sdCardTotal,
        sdCardFree: systemStatus.sdCardFree,
        uptime: online ? 'Online' : 'Offline',
        isOnline: online,
      );
      notifyListeners();
    }
  }

  Future<void> selectServerDevice(String terminalId, String name, {bool isOnline = false}) async {
    systemStatus = SystemStatus(
      firmware: systemStatus.firmware,
      imei: terminalId,
      simIccid: systemStatus.simIccid,
      networkType: '4G LTE Cat 4',
      signalStrength: isOnline ? 4 : 0,
      voltage: '12.4V',
      temperature: '38°C',
      sdCardTotal: systemStatus.sdCardTotal,
      sdCardFree: systemStatus.sdCardFree,
      uptime: isOnline ? 'Online' : 'Offline',
      isOnline: isOnline,
    );
    connectionMode = 'CLOUD_4G';
    final chIndex = (activeChannel == 2) ? 1 : 0;
    if (isOnline) {
      try {
        final res = await ApiService.instance.post(
          '/devices/$terminalId/live-stream?cameraId=$chIndex',
          {},
        );
        if (res.containsKey('url') && res['url'] != null) {
          customStreamUrl = res['url'].toString();
        } else {
          customStreamUrl = 'https://100.31.90.51.sslip.io/api/v1/devices/$terminalId/live-stream?cameraId=$chIndex';
        }
      } catch (_) {
        customStreamUrl = 'https://100.31.90.51.sslip.io/api/v1/devices/$terminalId/live-stream?cameraId=$chIndex';
      }
    } else {
      customStreamUrl = 'https://100.31.90.51.sslip.io/media/live/${terminalId}_$activeChannel/live.m3u8';
    }
    notifyListeners();
    fetchDeviceSettings(terminalId);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('active_selected_device_id', terminalId);
    } catch (_) {}
  }

  void updateDeviceIp(String ip) {
    deviceIp = ip;
    customStreamUrl = 'rtsp://$deviceIp:$rtspPort/live/ch0';
    notifyListeners();
  }

  Future<void> takeSnapshot() async {
    snapshotCount++;
    final chIndex = (activeChannel == 2) ? 1 : 0;
    try {
      final res = await ApiService.instance.get('/devices/${systemStatus.imei}/snapshot?cameraId=$chIndex');
      if (res.containsKey('url') && res['url'] != null) {
        lastSnapshotPath = res['url'].toString();
      } else {
        lastSnapshotPath = 'SNAP_${DateTime.now().millisecondsSinceEpoch}.jpg';
      }
    } catch (_) {
      lastSnapshotPath = 'SNAP_${DateTime.now().millisecondsSinceEpoch}.jpg';
    }
    notifyListeners();
  }

  Future<void> triggerEmergencyClip() async {
    isEmergencyRecording = true;
    notifyListeners();
    try {
      await ApiService.instance.post('/events', {
        'terminalId': systemStatus.imei,
        'type': 'EMERGENCY_SOS',
      });
    } catch (_) {}
    Future.delayed(const Duration(seconds: 4), () {
      isEmergencyRecording = false;
      notifyListeners();
    });
  }

  Future<void> saveSettings() async {
    isLoading = true;
    notifyListeners();
    try {
      await ApiService.instance.put('/devices/${systemStatus.imei}/settings', {
        'entityId': systemStatus.imei,
        'overrideFleetSettings': true,
        'ignitionOffStandbyDelay': 300,
        'roadCamEnable': true,
        'roadCamQuality': settings.videoResolution,
        'driverCamEnable': true,
        'driverCamQuality': settings.videoResolution,
        'driverAudioEnable': settings.audioEnabled,
        'apn': settings.apn,
        'platformServer': settings.serverIp,
        'platformPort': settings.serverPort,
        'wlanSsid': settings.wlanSsid,
      });
    } catch (_) {
      await Future.delayed(const Duration(milliseconds: 400));
    }
    isLoading = false;
    notifyListeners();
  }

  Future<void> fetchDeviceSettings(String imei) async {
    try {
      final res = await ApiService.instance.get('/devices/$imei/settings');
      if (res.containsKey('settings') && res['settings'] is Map<String, dynamic>) {
        final s = res['settings'] as Map<String, dynamic>;
        if (s['apn'] != null) settings.apn = s['apn'].toString();
        if (s['platformServer'] != null) settings.serverIp = s['platformServer'].toString();
        if (s['platformPort'] != null) settings.serverPort = (s['platformPort'] as num).toInt();
        if (s['wlanSsid'] != null) settings.wlanSsid = s['wlanSsid'].toString();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> sendDeviceCommand(String command) async {
    isLoading = true;
    notifyListeners();
    try {
      await ApiService.instance.post('/devices/${systemStatus.imei}/power', {
        'mode': command,
      });
    } catch (_) {
      await Future.delayed(const Duration(milliseconds: 300));
    }
    isLoading = false;
    notifyListeners();
  }

  void updatePlatform({required String serverIp, required int serverPort, required String apn}) {
    settings.serverIp = serverIp;
    settings.serverPort = serverPort;
    settings.apn = apn;
    notifyListeners();
  }

  void updatePowerSettings({required String ignitionOff, required String vibrationWake}) {
    settings.ignitionOff = ignitionOff;
    settings.vibrationWake = vibrationWake;
    notifyListeners();
  }

  void updateMediaSettings({
    String? resolution,
    int? fps,
    String? codec,
    bool? audioEnabled,
    int? preBuffer,
    int? postBuffer,
  }) {
    if (resolution != null) settings.videoResolution = resolution;
    if (fps != null) settings.videoFps = fps;
    if (codec != null) settings.audioBitrate = codec;
    if (audioEnabled != null) settings.audioEnabled = audioEnabled;
    if (preBuffer != null) settings.preBuffer = preBuffer;
    if (postBuffer != null) settings.postBuffer = postBuffer;
    notifyListeners();
  }

  void updateAiSettings({
    bool? adasEnabled,
    double? collisionWarningDistance,
    bool? laneChangeWarning,
    bool? dmsEnabled,
    bool? fatiguDetection,
    bool? phoneDetection,
    bool? smokingDetection,
  }) {
    if (adasEnabled != null) settings.adasEnabled = adasEnabled;
    if (collisionWarningDistance != null) settings.collisionWarningDistance = collisionWarningDistance;
    if (laneChangeWarning != null) settings.laneChangeWarning = laneChangeWarning;
    if (dmsEnabled != null) settings.dmsEnabled = dmsEnabled;
    if (fatiguDetection != null) settings.fatiguDetection = fatiguDetection;
    if (phoneDetection != null) settings.phoneDetection = phoneDetection;
    if (smokingDetection != null) settings.smokingDetection = smokingDetection;
    notifyListeners();
  }

  void updateWlanSettings({bool? enabled, String? ssid}) {
    if (enabled != null) settings.wlanEnabled = enabled;
    if (ssid != null) settings.wlanSsid = ssid;
    notifyListeners();
  }
}

class DeviceSettings {
  // Platform
  String serverIp = '103.21.58.100';
  int serverPort = 7800;
  String apn = 'airtelgprs.com';

  // Power
  String ignitionOff = 'Deep Sleep (5 min)';
  String vibrationWake = 'Enabled';

  // Media
  String videoResolution = '1080p';
  int videoFps = 25;
  String audioBitrate = 'AAC 48kHz';
  bool audioEnabled = true;
  int preBuffer = 10;
  int postBuffer = 20;

  // WLAN
  String wlanSsid = 'LA-CAT4-58278';
  bool wlanEnabled = true;

  // ADAS/DMS
  bool adasEnabled = true;
  double collisionWarningDistance = 1.5;
  bool laneChangeWarning = true;
  bool dmsEnabled = true;
  bool fatiguDetection = true;
  bool phoneDetection = true;
  bool smokingDetection = false;
}

class SystemStatus {
  final String firmware;
  final String imei;
  final String simIccid;
  final String networkType;
  final int signalStrength;
  final String voltage;
  final String temperature;
  final String sdCardTotal;
  final String sdCardFree;
  final String uptime;
  final bool isOnline;

  SystemStatus({
    required this.firmware,
    required this.imei,
    required this.simIccid,
    required this.networkType,
    required this.signalStrength,
    required this.voltage,
    required this.temperature,
    required this.sdCardTotal,
    required this.sdCardFree,
    required this.uptime,
    required this.isOnline,
  });
}

class GpsStatus {
  final double lat;
  final double lng;
  final double altitude;
  final double speed;
  final double heading;
  final int satellites;
  final double accuracy;
  final bool isFixed;
  final String fixTime;

  GpsStatus({
    required this.lat,
    required this.lng,
    required this.altitude,
    required this.speed,
    required this.heading,
    required this.satellites,
    required this.accuracy,
    required this.isFixed,
    required this.fixTime,
  });
}
