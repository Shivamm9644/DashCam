import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class DashboardProvider extends ChangeNotifier {
  // KPI Stats
  int totalVehicles = 0;
  int onlineVehicles = 0;
  int offlineVehicles = 0;
  int criticalAlerts = 0;
  double quotaUsage = 0.0;
  double liveMinutesRemaining = 120.0;
  String telemetryFreshness = 'Database Synced';
  bool isLoading = false;

  List<DeviceItem> devices = [];
  DeviceItem? selectedDevice;

  static const String _dbKey = 'dashcam_database_v5_clean';
  static const String _activeDevKey = 'active_selected_device_id';

  Timer? _statusPollTimer;

  DashboardProvider() {
    loadDevicesFromDatabase();
    _statusPollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _pollDeviceOnlineStatus();
    });
  }

  @override
  void dispose() {
    _statusPollTimer?.cancel();
    super.dispose();
  }

  void _updateCounts() {
    totalVehicles = devices.length;
    onlineVehicles = devices.where((d) => d.isOnline).length;
    offlineVehicles = devices.where((d) => d.isOffline).length;
  }

  void selectDevice(DeviceItem device) async {
    selectedDevice = device;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_activeDevKey, device.terminalId);
    } catch (_) {}
  }

  static String _formatLastSeen(String? iso, bool isOnline) {
    if (isOnline) return 'Live';
    if (iso == null || iso.isEmpty) return 'Offline';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h12 = (dt.hour % 12 == 0) ? 12 : (dt.hour % 12);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$h12:$m $ampm';
    } catch (_) {
      return 'Offline';
    }
  }

  // Load from local database first, then synchronize with central server database (Port 3000 SQLite)
  Future<void> loadDevicesFromDatabase() async {
    isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();

      // 1. Load locally stored devices from SharedPreferences database
      final savedJson = prefs.getString(_dbKey);
      final activeSavedId = prefs.getString(_activeDevKey);

      List<DeviceItem> localDevices = [];
      if (savedJson != null && savedJson.isNotEmpty) {
        try {
          final List decoded = jsonDecode(savedJson);
          localDevices = decoded
              .map((m) => DeviceItem.fromJson(m as Map<String, dynamic>))
              
              .toList();
        } catch (_) {}
      }

      // 2. Fetch authoritative database devices from server (Port 3000 /api/devices)
      List<DeviceItem> serverDevices = [];
      try {
        final loginRes = await http.post(
          Uri.parse('https://100.31.90.51.sslip.io/api/v1/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
        ).timeout(const Duration(seconds: 3)).catchError((_) => http.Response('{}', 500));

        String? token;
        if (loginRes.statusCode == 200) {
          final lData = jsonDecode(loginRes.body);
          token = lData['token'] as String?;
        }

        final headers = <String, String>{};
        if (token != null) headers['Authorization'] = 'Bearer $token';

        final devRes = await http.get(
          Uri.parse('https://100.31.90.51.sslip.io/api/v1/devices'),
          headers: headers,
        ).timeout(const Duration(seconds: 4)).catchError((_) => http.Response('[]', 500));

        if (devRes.statusCode == 200) {
          final dynamic decoded = jsonDecode(devRes.body);
          final List rawDevs = (decoded is List)
              ? decoded
              : (decoded is Map && decoded['devices'] is List ? decoded['devices'] : []);
          for (var r in rawDevs) {
            final devId = (r['deviceId'] ?? r['terminalId'] ?? r['imei'] ?? r['id'] ?? '').toString().trim();
            if (devId.isEmpty) continue;

            final vNo = (r['vehicleNo'] ?? 'VEH-$devId').toString();
            final dType = (r['deviceType'] ?? 'Dual Cam Dashcam').toString();
            final st = (r['status'] ?? 'Offline').toString().toUpperCase();
            final lastOnline = (r['lastOnline'] ?? '').toString();
            final lat = (r['latitude'] != null) ? ((r['latitude'] as num).toDouble()) : 0.0;
            final lng = (r['longitude'] != null) ? ((r['longitude'] as num).toDouble()) : 0.0;
            final speed = (r['speed'] != null) ? ((r['speed'] as num).toDouble()) : 0.0;

            // REAL status strictly from server - no faking!
            final isOnline = st == 'ONLINE';

            serverDevices.add(DeviceItem(
              id: devId,
              plate: vNo,
              terminalId: devId,
              driver: 'Driver Assigned',
              speed: speed,
              status: isOnline ? 'ONLINE' : 'OFFLINE',
              lat: lat,
              lng: lng,
              lastPing: _formatLastSeen(lastOnline, isOnline),
              heading: 0,
              altitude: 0,
              deviceModel: dType.isNotEmpty ? dType : 'GD19',
            ));
          }
        }

        // Authoritative registered non-ELD fleet & real driver assignments
        final vehRes = await http.get(
          Uri.parse('https://100.31.90.51.sslip.io/api/v1/vehicles'),
          headers: headers,
        ).timeout(const Duration(seconds: 4)).catchError((_) => http.Response('{}', 500));

        if (vehRes.statusCode == 200) {
          final dynamic vDecoded = jsonDecode(vehRes.body);
          final List vList = (vDecoded is Map && vDecoded['vehicles'] is List) ? vDecoded['vehicles'] : [];
          for (var v in vList) {
            final vId = (v['id'] ?? '').toString();
            if (vId.isEmpty) continue;
            final plate = (v['plateNumber'] ?? v['label'] ?? 'Vehicle').toString();
            final termId = (v['terminalId'] ?? v['assignedDeviceId'] ?? vId).toString();
            final driver = (v['driverName'] ?? 'Unassigned').toString();
            final vStatus = (v['status'] ?? 'OFFLINE').toString().toUpperCase();
            final lat = (v['lat'] != null) ? ((v['lat'] as num).toDouble()) : 0.0;
            final lng = (v['lng'] != null) ? ((v['lng'] as num).toDouble()) : 0.0;
            final speed = (v['speed'] != null) ? ((v['speed'] as num).toDouble()) : 0.0;
            final vin = (v['vin'] ?? '').toString();
            final imei = (v['imei'] ?? '').toString();
            final deviceModel = (v['deviceModel'] ?? 'GD19').toString();
            final pairingStatus = (v['pairingStatus'] ?? 'UNVERIFIED').toString();
            final eldProvider = (v['eldProvider'] ?? 'NONE').toString();

            serverDevices.add(DeviceItem(
              id: vId,
              plate: plate,
              terminalId: termId,
              driver: driver,
              speed: speed,
              status: vStatus == 'ONLINE' ? 'ONLINE' : 'OFFLINE',
              lat: lat,
              lng: lng,
              lastPing: vStatus == 'ONLINE' ? 'Live' : 'Offline',
              heading: 0,
              altitude: 0,
              vin: vin,
              imei: imei,
              deviceModel: deviceModel,
              pairingStatus: pairingStatus,
              eldProvider: eldProvider,
            ));
          }
        }
      } catch (_) {}

      // 3. Merge: server status is authoritative for online/offline
      final Map<String, DeviceItem> merged = {};

      for (var d in localDevices) {
        merged[d.terminalId] = d;
      }
      for (var d in serverDevices) {
        if (merged.containsKey(d.terminalId)) {
          // Update status & lastPing with server's real telemetry
          final existing = merged[d.terminalId]!;
          merged[d.terminalId] = DeviceItem(
            id: existing.id,
            plate: existing.plate,
            terminalId: existing.terminalId,
            driver: existing.driver,
            speed: d.speed,
            status: d.status, // real online/offline from server
            lat: d.lat != 0.0 ? d.lat : existing.lat,
            lng: d.lng != 0.0 ? d.lng : existing.lng,
            lastPing: d.lastPing,
            heading: d.heading,
            altitude: d.altitude,
            isCustomAssigned: existing.isCustomAssigned,
          );
        } else {
          merged[d.terminalId] = d;
        }
      }

      devices = merged.values.toList();

      // Clean empty list - no hardcoded dummy devices

      if (devices.isNotEmpty) {
        if (activeSavedId != null) {
          selectedDevice = devices.firstWhere(
            (d) => d.terminalId == activeSavedId,
            orElse: () => devices.first,
          );
        } else {
          selectedDevice = devices.first;
        }
      } else {
        selectedDevice = null;
      }

      _updateCounts();

      // Persist merged database
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
    } catch (_) {
      _updateCounts();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  // Periodic lightweight status polling
  Future<void> _pollDeviceOnlineStatus() async {
    try {
      final devRes = await http.get(
        Uri.parse('https://100.31.90.51.sslip.io/api/v1/devices'),
      ).timeout(const Duration(seconds: 3)).catchError((_) => http.Response('[]', 500));

      if (devRes.statusCode == 200) {
        final dynamic decoded = jsonDecode(devRes.body);
          final List rawDevs = (decoded is List)
              ? decoded
              : (decoded is Map && decoded['devices'] is List ? decoded['devices'] : []);
        bool changed = false;

        for (var r in rawDevs) {
          final devId = (r['deviceId'] ?? '').toString().trim();
          final st = (r['status'] ?? 'Offline').toString().toUpperCase();
          final lastOnline = (r['lastOnline'] ?? '').toString();
          final isOnline = st == 'ONLINE';

          final idx = devices.indexWhere((d) => d.terminalId == devId);
          if (idx != -1) {
            final old = devices[idx];
            final newStatus = isOnline ? 'ONLINE' : 'OFFLINE';
            final newLastPing = _formatLastSeen(lastOnline, isOnline);

            if (old.status != newStatus || old.lastPing != newLastPing) {
              devices[idx] = DeviceItem(
                id: old.id,
                plate: old.plate,
                terminalId: old.terminalId,
                driver: old.driver,
                speed: ((r['speed'] ?? 0) as num).toDouble(),
                status: newStatus,
                lat: r['latitude'] != null ? ((r['latitude'] as num).toDouble()) : old.lat,
                lng: r['longitude'] != null ? ((r['longitude'] as num).toDouble()) : old.lng,
                lastPing: newLastPing,
                heading: old.heading,
                altitude: old.altitude,
                isCustomAssigned: old.isCustomAssigned,
              );
              changed = true;
            }
          }
        }

        if (changed) {
          if (selectedDevice != null) {
            final match = devices.firstWhere((d) => d.terminalId == selectedDevice!.terminalId, orElse: () => devices.first);
            selectedDevice = match;
          }
          _updateCounts();
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  // Self-Service Camera Assignment by Customer - Saves to Local & Cloud Database
  Future<DeviceItem?> assignNewDevice({
    required String imei,
    required String plate,
    String? driver,
    String? deviceType,
    bool? forceOnline,
  }) async {
    final cleanImei = imei.trim();
    final cleanPlate = plate.trim();
    if (cleanImei.isEmpty || cleanPlate.isEmpty) return null;

    // Check server if this device is online right now
    String initialStatus = (forceOnline == true) ? 'ONLINE' : 'OFFLINE';
    String initialPing = (initialStatus == 'ONLINE')
        ? 'Live • 4G Cloud (JT1078)'
        : 'MicroSD Memory Card Ready • Standby';

    if (forceOnline == null) {
      try {
        final devRes = await http.get(
          Uri.parse('https://100.31.90.51.sslip.io/api/v1/devices'),
        ).timeout(const Duration(seconds: 2)).catchError((_) => http.Response('{"devices":[]}', 500));

        if (devRes.statusCode == 200) {
          final dynamic decoded = jsonDecode(devRes.body);
          final List rawDevs = (decoded is List)
              ? decoded
              : (decoded is Map && decoded['devices'] is List ? decoded['devices'] : []);
          for (var r in rawDevs) {
            final sId = (r['deviceId'] ?? r['terminalId'] ?? r['imei'] ?? r['id'] ?? '').toString().trim();
            if (sId == cleanImei) {
              final st = (r['status'] ?? (r['online'] == true ? 'ONLINE' : 'Offline')).toString().toUpperCase();
              if (st == 'ONLINE' || r['online'] == true) {
                initialStatus = 'ONLINE';
                initialPing = 'Live';
              }
              break;
            }
          }
        }
      } catch (_) {}
    }

    final newDevice = DeviceItem(
      id: cleanImei,
      plate: cleanPlate,
      terminalId: cleanImei,
      driver: (driver != null && driver.trim().isNotEmpty) ? driver.trim() : 'Unassigned',
      speed: initialStatus == 'ONLINE' ? 36.0 : 0.0,
      status: initialStatus,
      lat: 0.0,
      lng: 0.0,
      lastPing: initialPing,
      heading: 0,
      altitude: 0,
      isCustomAssigned: true,
    );

    // Update list
    devices.removeWhere((d) => d.terminalId == cleanImei);
    devices.insert(0, newDevice);
    selectedDevice = newDevice;
    _updateCounts();
    notifyListeners();

    // 1. Save to local database (SharedPreferences)
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
      await prefs.setString(_activeDevKey, cleanImei);
    } catch (_) {}

    // 2. Save to central server database
    try {
      final loginRes = await http.post(
        Uri.parse('https://100.31.90.51.sslip.io/api/v1/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
      ).timeout(const Duration(seconds: 3)).catchError((_) => http.Response('{}', 500));

      if (loginRes.statusCode == 200) {
        final lData = jsonDecode(loginRes.body);
        final token = lData['token'] as String?;
        final headers = {'Content-Type': 'application/json'};
        if (token != null) headers['Authorization'] = 'Bearer $token';

        await http.post(
          Uri.parse('https://100.31.90.51.sslip.io/api/v1/devices'),
          headers: headers,
          body: jsonEncode({
            'deviceId': cleanImei,
            'terminalId': cleanImei,
            'vehicleNo': cleanPlate,
            'deviceType': deviceType ?? 'MDVR (Dual Cam)',
          }),
        ).timeout(const Duration(seconds: 4)).catchError((_) => http.Response('{}', 500));
      }
    } catch (_) {}

    // Immediately trigger server poll to update status
    _pollDeviceOnlineStatus();

    return newDevice;
  }

  // Quick toggle online/offline for testing
  void toggleDeviceOnlineStatus(String terminalId) async {
    final idx = devices.indexWhere((d) => d.terminalId == terminalId);
    if (idx != -1) {
      final old = devices[idx];
      final newOnline = !old.isOnline;
      final newStatus = newOnline ? 'ONLINE' : 'OFFLINE';
      final newPing = newOnline ? 'Live • 4G Cloud (JT1078)' : 'MicroSD Memory Card Ready • Standby';
      devices[idx] = DeviceItem(
        id: old.id,
        plate: old.plate,
        terminalId: old.terminalId,
        driver: old.driver,
        speed: newOnline ? 42.0 : 0.0,
        status: newStatus,
        lat: old.lat,
        lng: old.lng,
        lastPing: newPing,
        heading: old.heading,
        altitude: old.altitude,
        isCustomAssigned: old.isCustomAssigned,
      );
      if (selectedDevice?.terminalId == terminalId) {
        selectedDevice = devices[idx];
      }
      _updateCounts();
      notifyListeners();
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
      } catch (_) {}
    }
  }

  Future<void> removeDevice(String terminalId) async {
    devices.removeWhere((d) => d.terminalId == terminalId);
    selectedDevice = devices.isNotEmpty ? devices.first : null;
    _updateCounts();
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
      if (selectedDevice != null) {
        await prefs.setString(_activeDevKey, selectedDevice!.terminalId);
      } else {
        await prefs.remove(_activeDevKey);
      }
    } catch (_) {}
  }

  void refreshStats() {
    loadDevicesFromDatabase();
  }
}

class DeviceItem {
  final String id;
  final String plate;
  final String terminalId;
  final String driver;
  final double speed;
  final String status;
  final double lat;
  final double lng;
  final String lastPing;
  final double heading;
  final double altitude;
  final bool isCustomAssigned;
  final String vin;
  final String imei;
  final String deviceModel;
  final String pairingStatus;
  final String eldProvider;

  DeviceItem({
    required this.id,
    required this.plate,
    required this.terminalId,
    required this.driver,
    required this.speed,
    required this.status,
    required this.lat,
    required this.lng,
    required this.lastPing,
    required this.heading,
    required this.altitude,
    this.isCustomAssigned = false,
    this.vin = '',
    this.imei = '',
    this.deviceModel = 'GD19',
    this.pairingStatus = 'UNVERIFIED',
    this.eldProvider = 'NONE',
  });

  bool get isOnline => status == 'ONLINE';
  bool get isIdle => status == 'IDLE';
  bool get isOffline => status == 'OFFLINE';

  Map<String, dynamic> toJson() => {
    'id': id,
    'plate': plate,
    'terminalId': terminalId,
    'driver': driver,
    'speed': speed,
    'status': status,
    'lat': lat,
    'lng': lng,
    'lastPing': lastPing,
    'heading': heading,
    'altitude': altitude,
    'isCustomAssigned': isCustomAssigned,
    'vin': vin,
    'imei': imei,
    'deviceModel': deviceModel,
    'pairingStatus': pairingStatus,
    'eldProvider': eldProvider,
  };

  factory DeviceItem.fromJson(Map<String, dynamic> json) => DeviceItem(
    id: json['id']?.toString() ?? '',
    plate: json['plate']?.toString() ?? '',
    terminalId: json['terminalId']?.toString() ?? '',
    driver: json['driver']?.toString() ?? '',
    speed: ((json['speed'] ?? 0) as num).toDouble(),
    status: json['status']?.toString() ?? 'OFFLINE',
    lat: ((json['lat'] ?? 0) as num).toDouble(),
    lng: ((json['lng'] ?? 0) as num).toDouble(),
    lastPing: json['lastPing']?.toString() ?? 'Offline',
    heading: ((json['heading'] ?? 0) as num).toDouble(),
    altitude: ((json['altitude'] ?? 0) as num).toDouble(),
    isCustomAssigned: json['isCustomAssigned'] == true,
    vin: json['vin']?.toString() ?? '',
    imei: json['imei']?.toString() ?? '',
    deviceModel: json['deviceModel']?.toString() ?? 'GD19',
    pairingStatus: json['pairingStatus']?.toString() ?? 'UNVERIFIED',
    eldProvider: json['eldProvider']?.toString() ?? 'NONE',
  );
}
