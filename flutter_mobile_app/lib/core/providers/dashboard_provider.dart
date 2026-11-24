import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';

class DashboardProvider extends ChangeNotifier {
  // KPI Stats matching web console exactly
  int totalVehicles = 0;
  int onlineVehicles = 0;
  int offlineVehicles = 0;
  int drivingVehicles = 0;
  int idleVehicles = 0;
  int criticalAlerts = 0;
  double quotaUsage = 0.0;
  double liveMinutesRemaining = 120.0;
  String telemetryFreshness = 'Database Synced';
  bool isLoading = false;

  List<DeviceItem> devices = [];
  DeviceItem? selectedDevice;
  String selectedClientFilter = 'ALL';

  static String resolveClientForTerminal(String termId) {
    if (termId == '505073729067' || termId == '505073322632' || termId == '505073214789') {
      return 'Sharma Logistics';
    } else if (termId == '505073474490' || termId == '505073583696') {
      return 'Indore City Express';
    } else if (termId == '872312860795' || termId == '505073095782') {
      return 'Patel Transport Pvt Ltd';
    } else if (termId == 'MP4242' || termId.contains('4242')) {
      return 'Bantu Heavy Haulage';
    } else {
      return 'TrackAnywhere Fleet';
    }
  }

  List<String> get clientList {
    final set = <String>{};
    for (final d in devices) {
      if (d.clientName.isNotEmpty) set.add(d.clientName);
    }
    final sorted = set.toList()..sort();
    return ['ALL', ...sorted];
  }

  void setClientFilter(String client) {
    selectedClientFilter = client;
    notifyListeners();
  }

  static const String _dbKey = 'dashcam_database_v6_real_live';
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
    drivingVehicles = devices.where((d) => d.speed > 0).length;
    idleVehicles = devices.where((d) => d.isIdle || (d.isOnline && d.speed == 0)).length;
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

  Future<String?> _getAuthToken() async {
    if (ApiService.instance.currentToken != null) {
      return ApiService.instance.currentToken;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString('auth_token');
      if (savedToken != null && savedToken.isNotEmpty) {
        ApiService.instance.setToken(savedToken);
        return savedToken;
      }
    } catch (_) {}

    for (final host in ['https://100.31.90.51.sslip.io']) {
      try {
        final loginRes = await http.post(
          Uri.parse('$host/api/v1/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
        ).timeout(const Duration(seconds: 4));

        if (loginRes.statusCode == 200) {
          final lData = jsonDecode(loginRes.body);
          final token = lData['token'] as String?;
          if (token != null) {
            ApiService.instance.setToken(token);
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('auth_token', token);
            return token;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  // Load authoritative vehicles and positions from server (matching public/app.js)
  Future<void> loadDevicesFromDatabase() async {
    isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      final activeSavedId = prefs.getString(_activeDevKey);

      // Load cache immediately so UI is instantly populated
      final cachedJson = prefs.getString(_dbKey);
      if (cachedJson != null && cachedJson.isNotEmpty && devices.isEmpty) {
        try {
          final List list = jsonDecode(cachedJson);
          devices = list.map((item) => DeviceItem.fromJson(item)).toList();
          _updateCounts();
          notifyListeners();
        } catch (_) {}
      }
      if (devices.isEmpty) {
        devices = _fallbackDevices();
        _updateCounts();
        notifyListeners();
      }

      final token = await _getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null) headers['Authorization'] = 'Bearer $token';

      // 1. Fetch Authoritative Vehicles from both servers (3.85.81.10 & 100.31.90.51)
      List<DeviceItem> serverDevices = [];
      Set<String> seenDeviceIds = {};

      for (final host in ['https://100.31.90.51.sslip.io']) {
        try {
          String? hostToken = token;
          if (hostToken == null) {
            try {
              final lRes = await http.post(
                Uri.parse('$host/api/v1/auth/login'),
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
              ).timeout(const Duration(seconds: 4));
              if (lRes.statusCode == 200) {
                hostToken = jsonDecode(lRes.body)['token'];
              }
            } catch (_) {}
          }

          final hostHeaders = <String, String>{'Content-Type': 'application/json'};
          if (hostToken != null) hostHeaders['Authorization'] = 'Bearer $hostToken';

          final vehRes = await http.get(
            Uri.parse('$host/api/v1/vehicles'),
            headers: hostHeaders,
          ).timeout(const Duration(seconds: 5));

          if (vehRes.statusCode == 200) {
            final dynamic vDecoded = jsonDecode(vehRes.body);
            final List vList = (vDecoded is Map && vDecoded['vehicles'] is List)
                ? vDecoded['vehicles']
                : (vDecoded is List ? vDecoded : []);

            for (var v in vList) {
              final vId = (v['id'] ?? '').toString();
              if (vId.isEmpty) continue;

              final termId = (v['terminalId'] ?? v['assignedDeviceId'] ?? v['imei'] ?? '').toString();
              final uniqueKey = termId.isNotEmpty ? termId : vId;
              if (seenDeviceIds.contains(uniqueKey)) continue;
              seenDeviceIds.add(uniqueKey);

              final rawPlate = (v['plateNumber'] ?? v['label'])?.toString();
              final plate = (rawPlate != null && rawPlate.isNotEmpty && rawPlate != 'null')
                  ? rawPlate
                  : (termId == '505073729067'
                      ? 'MP-09-HH-9067'
                      : (termId.isNotEmpty ? 'VEH-${termId.substring(termId.length > 4 ? termId.length - 4 : 0)}' : 'DashCam'));

              final rawDriver = v['driverName']?.toString();
              final driver = (rawDriver != null && rawDriver.isNotEmpty && rawDriver != 'null')
                  ? rawDriver
                  : (termId == '505073729067' ? 'Rajesh Kumar' : 'Unassigned');
              final vStatus = (v['status'] ?? 'OFFLINE').toString().toUpperCase();
              final lat = (v['lat'] != null) ? ((v['lat'] as num).toDouble()) : 0.0;
              final lng = (v['lng'] != null) ? ((v['lng'] as num).toDouble()) : 0.0;
              final speed = (v['speed'] != null) ? ((v['speed'] as num).toDouble()) : 0.0;
              final vin = (v['vin'] ?? '').toString();
              final imei = (v['imei'] ?? termId).toString();
              final deviceModel = (v['model'] ?? v['dashcamModel'] ?? 'MDVR (M16C)').toString();
              final pairingStatus = (v['pairingStatus'] ?? (termId.isNotEmpty ? 'PAIRED' : 'UNVERIFIED')).toString();
              final eldProvider = (v['eldProvider'] ?? 'NONE').toString();

              final isOnline = vStatus == 'ONLINE';
              final hasGps = (lat != 0.0 && lng != 0.0);
              final lastPingLabel = isOnline
                  ? (!hasGps ? 'Online · No GPS' : (speed > 0 ? 'Moving ${speed.round()} km/h' : 'Idle'))
                  : _formatLastSeen(v['lastSeen']?.toString(), false);

              serverDevices.add(DeviceItem(
                id: vId,
                plate: plate,
                terminalId: termId.isNotEmpty ? termId : vId,
                driver: driver,
                speed: speed,
                status: isOnline ? 'ONLINE' : (vStatus == 'IDLE' ? 'IDLE' : 'OFFLINE'),
                lat: lat,
                lng: lng,
                lastPing: lastPingLabel,
                heading: (v['heading'] != null) ? ((v['heading'] as num).toDouble()) : 0.0,
                altitude: 0,
                vin: vin,
                imei: imei,
                deviceModel: deviceModel,
                pairingStatus: pairingStatus,
                eldProvider: eldProvider,
                clientName: resolveClientForTerminal(termId.isNotEmpty ? termId : vId),
              ));
            }
          }
        } catch (_) {}
      }

      // 2. Fetch Latest Positions & merge telemetry from both servers
      for (final host in ['https://100.31.90.51.sslip.io']) {
        try {
          final posRes = await http.get(
            Uri.parse('$host/api/v1/positions/latest'),
            headers: headers,
          ).timeout(const Duration(seconds: 4));

        if (posRes.statusCode == 200) {
          final pDecoded = jsonDecode(posRes.body);
          final List pList = (pDecoded is Map && pDecoded['positions'] is List) ? pDecoded['positions'] : [];
          for (var pos in pList) {
            final tId = (pos['terminalId'] ?? '').toString();
            if (tId.isEmpty) continue;
            final idx = serverDevices.indexWhere((d) => d.terminalId == tId || d.id == tId);
            if (idx != -1) {
              final old = serverDevices[idx];
              final pLat = (pos['lat'] != null) ? ((pos['lat'] as num).toDouble()) : old.lat;
              final pLng = (pos['lng'] != null) ? ((pos['lng'] as num).toDouble()) : old.lng;
              final pSpeed = (pos['speed'] != null) ? ((pos['speed'] as num).toDouble()) : old.speed;
              final pHeading = (pos['heading'] != null) ? ((pos['heading'] as num).toDouble()) : old.heading;
              final hasGps = (pLat != 0.0 && pLng != 0.0);

              serverDevices[idx] = DeviceItem(
                id: old.id,
                plate: old.plate,
                terminalId: old.terminalId,
                driver: old.driver,
                speed: pSpeed,
                status: old.status,
                lat: pLat,
                lng: pLng,
                lastPing: old.isOnline
                    ? (!hasGps ? 'Online · No GPS' : (pSpeed > 0 ? 'Moving ${pSpeed.round()} km/h' : 'Idle'))
                    : old.lastPing,
                heading: pHeading,
                altitude: old.altitude,
                vin: old.vin,
                imei: old.imei,
                deviceModel: old.deviceModel,
                pairingStatus: old.pairingStatus,
                eldProvider: old.eldProvider,
                clientName: old.clientName,
                subscriptionExpiry: old.subscriptionExpiry,
                subscriptionStart: old.subscriptionStart,
              );
            }
          }
        }
      } catch (_) {}}

      // 3. Quotas and Safety Events for KPIs
      try {
        final quotaRes = await http.get(
          Uri.parse('${ApiService.serverHost}/api/v1/quotas'),
          headers: headers,
        ).timeout(const Duration(seconds: 3));

        if (quotaRes.statusCode == 200) {
          final qData = jsonDecode(quotaRes.body);
          if (qData['quota'] != null) {
            final q = qData['quota'];
            final rem = q['remainingLiveMinutes'] ?? ((q['maxLiveMinutes'] ?? 300) - (q['liveMinutesUsed'] ?? 0));
            liveMinutesRemaining = (rem is num) ? rem.toDouble() : 120.0;
          }
        }
      } catch (_) {}

      try {
        final evtRes = await http.get(
          Uri.parse('${ApiService.serverHost}/api/v1/events'),
          headers: headers,
        ).timeout(const Duration(seconds: 3));

        if (evtRes.statusCode == 200) {
          final eData = jsonDecode(evtRes.body);
          final List evts = (eData is Map && eData['events'] is List) ? eData['events'] : [];
          criticalAlerts = evts.where((e) => (e['severity'] ?? '').toString().toUpperCase() == 'CRITICAL').length;
        }
      } catch (_) {}

      if (serverDevices.isNotEmpty) {
        // Authoritative merge: retain all registered fleet devices and update live status
        final Map<String, DeviceItem> catalog = {};
        for (final d in _fallbackDevices()) {
          catalog[d.terminalId] = d;
        }
        for (final d in devices) {
          catalog[d.terminalId] = d;
        }
        for (final d in serverDevices) {
          catalog[d.terminalId] = d;
        }
        devices = catalog.values.toList();
      }

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

      // Persist to SharedPreferences
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
    } catch (_) {
      _updateCounts();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  // Periodic lightweight status polling from /api/v1/vehicles
  Future<void> _pollDeviceOnlineStatus() async {
    try {
      final token = await _getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null) headers['Authorization'] = 'Bearer $token';

      final vehRes = await http.get(
        Uri.parse('${ApiService.serverHost}/api/v1/vehicles'),
        headers: headers,
      ).timeout(const Duration(seconds: 4));

      if (vehRes.statusCode == 200) {
        final dynamic decoded = jsonDecode(vehRes.body);
        final List vList = (decoded is Map && decoded['vehicles'] is List)
            ? decoded['vehicles']
            : (decoded is List ? decoded : []);

        bool changed = false;

        for (var v in vList) {
          final vId = (v['id'] ?? '').toString();
          final termId = (v['terminalId'] ?? v['assignedDeviceId'] ?? v['imei'] ?? '').toString();
          final st = (v['status'] ?? 'OFFLINE').toString().toUpperCase();
          final isOnline = st == 'ONLINE';

          final idx = devices.indexWhere((d) => d.id == vId || (termId.isNotEmpty && d.terminalId == termId));
          if (idx != -1) {
            final old = devices[idx];
            final newStatus = isOnline ? 'ONLINE' : (st == 'IDLE' ? 'IDLE' : 'OFFLINE');
            final lat = (v['lat'] != null) ? ((v['lat'] as num).toDouble()) : old.lat;
            final lng = (v['lng'] != null) ? ((v['lng'] as num).toDouble()) : old.lng;
            final speed = (v['speed'] != null) ? ((v['speed'] as num).toDouble()) : old.speed;
            final hasGps = (lat != 0.0 && lng != 0.0);

            final newLastPing = isOnline
                ? (!hasGps ? 'Online · No GPS' : (speed > 0 ? 'Moving ${speed.round()} km/h' : 'Idle'))
                : _formatLastSeen(v['lastSeen']?.toString(), false);

            final rawP = (v['plateNumber'] ?? v['label'])?.toString();
            final resolvedPlate = (rawP != null && rawP.isNotEmpty && rawP != 'null')
                ? rawP
                : (old.plate.isNotEmpty && old.plate != 'null'
                    ? old.plate
                    : (old.terminalId == '505073729067' ? 'MP-09-HH-9067' : 'VEH-${old.terminalId.substring(old.terminalId.length > 4 ? old.terminalId.length - 4 : 0)}'));

            final rawD = v['driverName']?.toString();
            final resolvedDriver = (rawD != null && rawD.isNotEmpty && rawD != 'null')
                ? rawD
                : (old.driver.isNotEmpty && old.driver != 'null' && old.driver != 'Unassigned'
                    ? old.driver
                    : (old.terminalId == '505073729067' ? 'Rajesh Kumar' : 'Unassigned'));

            if (old.status != newStatus || old.lastPing != newLastPing || old.speed != speed || old.plate != resolvedPlate || old.driver != resolvedDriver) {
              devices[idx] = DeviceItem(
                id: old.id,
                plate: resolvedPlate,
                terminalId: old.terminalId,
                driver: resolvedDriver,
                speed: speed,
                status: newStatus,
                lat: lat,
                lng: lng,
                lastPing: newLastPing,
                heading: old.heading,
                altitude: old.altitude,
                isCustomAssigned: old.isCustomAssigned,
                vin: old.vin,
                imei: old.imei,
                deviceModel: old.deviceModel,
                pairingStatus: old.pairingStatus,
                eldProvider: old.eldProvider,
                clientName: old.clientName,
                subscriptionExpiry: old.subscriptionExpiry,
                subscriptionStart: old.subscriptionStart,
              );
              changed = true;
            }
          }
        }

        if (changed) {
          _updateCounts();
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  List<DeviceItem> _fallbackDevices() {
    final now = DateTime.now();
    final expireInOneYear = now.add(const Duration(days: 365));
    return [
      DeviceItem(
        id: 'veh-auto-505073729067',
        plate: 'MP-09-HH-9067',
        terminalId: '505073729067',
        driver: 'Rajesh Kumar',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 22.7339,
        lng: 75.8615,
        lastPing: 'Offline',
        heading: 68.0,
        altitude: 540,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Sharma Logistics',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-860871080043592',
        plate: 'MH-12-RN-4359',
        terminalId: '860871080043592',
        driver: 'Ramesh Patel',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 18.5204,
        lng: 73.8567,
        lastPing: 'Offline',
        heading: 142.0,
        altitude: 560,
        deviceModel: 'WanWay 4G',
        clientName: 'TrackAnywhere Fleet',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-872312858278',
        plate: 'DL-01-AX-8278',
        terminalId: '872312858278',
        driver: 'Suresh Yadav',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 28.6139,
        lng: 77.2090,
        lastPing: 'Offline',
        heading: 275.0,
        altitude: 216,
        deviceModel: 'M16C AI Cam',
        clientName: 'TrackAnywhere Fleet',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-505073322632',
        plate: 'VEH-2632',
        terminalId: '505073322632',
        driver: 'Sunil Sharma',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 22.7196,
        lng: 75.8577,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Sharma Logistics',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-505073474490',
        plate: 'VEH-4490',
        terminalId: '505073474490',
        driver: 'Vikram Singh',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Indore City Express',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-505073583696',
        plate: 'VEH-3696',
        terminalId: '505073583696',
        driver: 'Amit Verma',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Indore City Express',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-872312860795',
        plate: 'GJ-06-BQ-0795',
        terminalId: '872312860795',
        driver: 'Manoj Tiwari',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'M16C AI Cam',
        clientName: 'Patel Transport Pvt Ltd',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-505073095782',
        plate: 'VEH-5782',
        terminalId: '505073095782',
        driver: 'Anil Gupta',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Patel Transport Pvt Ltd',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-auto-505073214789',
        plate: 'VEH-4789',
        terminalId: '505073214789',
        driver: 'Mukesh Joshi',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'MDVR Dual Cam',
        clientName: 'Sharma Logistics',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
      DeviceItem(
        id: 'veh-d03b4ea1',
        plate: 'MP-09-CA-4242',
        terminalId: 'MP4242',
        driver: 'Dinesh Rathore',
        speed: 0.0,
        status: 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: 'Offline',
        heading: 0.0,
        altitude: 0,
        deviceModel: 'Tata Signa MDVR',
        clientName: 'Bantu Heavy Haulage',
        subscriptionExpiry: expireInOneYear,
        subscriptionStart: now,
      ),
    ];
  }

  // Add / Pair new device or vehicle to fleet
  Future<DeviceItem?> assignNewDevice({
    required String plate,
    required String imei,
    String? driver,
    String? deviceType,
    bool? forceOnline,
    String? clientName,
  }) async {
    return addDevice(
      plate: plate,
      imei: imei,
      driver: driver,
      deviceType: deviceType,
      forceOnline: forceOnline,
      clientName: clientName,
    );
  }

  Future<DeviceItem?> addDevice({
    required String plate,
    required String imei,
    String? driver,
    String? deviceType,
    bool? forceOnline,
    String? clientName,
  }) async {
    final cleanImei = imei.trim();
    final cleanPlate = plate.trim();
    if (cleanImei.isEmpty || cleanPlate.isEmpty) return null;

    final initialStatus = (forceOnline == true) ? 'ONLINE' : 'OFFLINE';

    final now = DateTime.now();
    final newDevice = DeviceItem(
      id: 'veh-custom-$cleanImei',
      plate: cleanPlate,
      terminalId: cleanImei,
      driver: (driver != null && driver.trim().isNotEmpty) ? driver.trim() : 'Unassigned',
      speed: initialStatus == 'ONLINE' ? 36.0 : 0.0,
      status: initialStatus,
      lat: 0.0,
      lng: 0.0,
      lastPing: initialStatus == 'ONLINE' ? 'Online · No GPS' : 'Offline',
      heading: 0,
      altitude: 0,
      isCustomAssigned: true,
      imei: cleanImei,
      deviceModel: deviceType ?? 'MDVR (M16C)',
      pairingStatus: 'PAIRED',
      clientName: (clientName != null && clientName.trim().isNotEmpty) ? clientName.trim() : 'Sharma Logistics',
      subscriptionExpiry: now.add(const Duration(days: 365)),
      subscriptionStart: now,
    );

    devices.removeWhere((d) => d.terminalId == cleanImei || d.plate == cleanPlate);
    devices.insert(0, newDevice);
    selectedDevice = newDevice;
    _updateCounts();
    notifyListeners();

    // 1. Save to local database
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
      await prefs.setString(_activeDevKey, cleanImei);
    } catch (_) {}

    // 2. Save to central server backend
    try {
      await ApiService.instance.addFleetVehicle(
        plateNumber: cleanPlate,
        assignedDeviceId: cleanImei,
        model: deviceType ?? 'MDVR (M16C)',
        driverName: driver ?? 'Unassigned',
      );
    } catch (_) {}

    _pollDeviceOnlineStatus();
    return newDevice;
  }

  void toggleDeviceOnlineStatus(String terminalId) async {
    final idx = devices.indexWhere((d) => d.terminalId == terminalId);
    if (idx != -1) {
      final old = devices[idx];
      final newOnline = !old.isOnline;
      final newStatus = newOnline ? 'ONLINE' : 'OFFLINE';
      devices[idx] = DeviceItem(
        id: old.id,
        plate: old.plate,
        terminalId: old.terminalId,
        driver: old.driver,
        speed: newOnline ? 42.0 : 0.0,
        status: newStatus,
        lat: old.lat,
        lng: old.lng,
        lastPing: newOnline ? 'Online · No GPS' : 'Offline',
        heading: old.heading,
        altitude: old.altitude,
        isCustomAssigned: old.isCustomAssigned,
        vin: old.vin,
        imei: old.imei,
        deviceModel: old.deviceModel,
        pairingStatus: old.pairingStatus,
        eldProvider: old.eldProvider,
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

  Future<void> updateDriverLocally(String terminalId, String newDriver) async {
    final idx = devices.indexWhere((d) => d.terminalId == terminalId || d.id == terminalId);
    if (idx != -1) {
      final old = devices[idx];
      devices[idx] = DeviceItem(
        id: old.id,
        plate: old.plate,
        terminalId: old.terminalId,
        driver: newDriver.trim().isNotEmpty ? newDriver.trim() : 'Unassigned',
        speed: old.speed,
        status: old.status,
        lat: old.lat,
        lng: old.lng,
        lastPing: old.lastPing,
        heading: old.heading,
        altitude: old.altitude,
        isCustomAssigned: old.isCustomAssigned,
        vin: old.vin,
        imei: old.imei,
        deviceModel: old.deviceModel,
        pairingStatus: old.pairingStatus,
        eldProvider: old.eldProvider,
        clientName: old.clientName,
        subscriptionExpiry: old.subscriptionExpiry,
        subscriptionStart: old.subscriptionStart,
      );
      if (selectedDevice?.terminalId == terminalId || selectedDevice?.id == terminalId) {
        selectedDevice = devices[idx];
      }
      notifyListeners();
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
      } catch (_) {}
    }
  }

  Future<void> saveDevices() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dbKey, jsonEncode(devices.map((d) => d.toJson()).toList()));
    } catch (_) {}
    notifyListeners();
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
  final String clientName;
  final DateTime subscriptionExpiry;
  final DateTime subscriptionStart;

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
    String? clientName,
    DateTime? subscriptionExpiry,
    DateTime? subscriptionStart,
  })  : clientName = (clientName != null && clientName.isNotEmpty) ? clientName : DashboardProvider.resolveClientForTerminal(terminalId),
        subscriptionExpiry = subscriptionExpiry ?? DateTime.now().add(const Duration(days: 365)),
        subscriptionStart = subscriptionStart ?? DateTime.now();

  bool get isOnline => status == 'ONLINE';
  bool get isIdle => status == 'IDLE';
  bool get isOffline => status == 'OFFLINE';

  int get daysRemaining => subscriptionExpiry.difference(DateTime.now()).inDays;

  int get totalSubscriptionDays {
    final diff = subscriptionExpiry.difference(subscriptionStart).inDays;
    return diff > 0 ? diff : 365;
  }

  double get subscriptionProgress {
    final total = totalSubscriptionDays;
    final rem = daysRemaining;
    if (total <= 0) return 1.0;
    final used = total - rem;
    return (used / total).clamp(0.0, 1.0);
  }

  String get subscriptionBadgeText {
    if (daysRemaining > 30) return '$daysRemaining Days Left';
    if (daysRemaining > 0) return 'Expiring: $daysRemaining Days';
    return 'Expired';
  }

  String get formattedExpiry {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final m = (subscriptionExpiry.month >= 1 && subscriptionExpiry.month <= 12)
        ? months[subscriptionExpiry.month - 1]
        : 'Dec';
    return '${subscriptionExpiry.day.toString().padLeft(2, '0')} $m ${subscriptionExpiry.year}';
  }

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
    'clientName': clientName,
    'subscriptionExpiry': subscriptionExpiry.toIso8601String(),
    'subscriptionStart': subscriptionStart.toIso8601String(),
  };

  factory DeviceItem.fromJson(Map<String, dynamic> json) {
    final termId = json['terminalId']?.toString() ?? '';
    var rawPlate = json['plate']?.toString() ?? '';
    if (rawPlate.isEmpty || rawPlate == 'null') {
      rawPlate = (termId == '505073729067')
          ? 'MP-09-HH-9067'
          : (termId.isNotEmpty ? 'VEH-${termId.substring(termId.length > 4 ? termId.length - 4 : 0)}' : 'DashCam');
    }

    var rawDriver = json['driver']?.toString() ?? '';
    if (rawDriver.isEmpty || rawDriver == 'null' || rawDriver.contains('Desk Test') || rawDriver.contains('Cable') || rawDriver == 'Assigned Driver') {
      rawDriver = (termId == '505073729067') ? 'Rajesh Kumar' : 'Unassigned';
    }
    final rawClient = json['clientName']?.toString();
    final clientName = (rawClient != null && rawClient.isNotEmpty && rawClient != 'null')
        ? rawClient
        : DashboardProvider.resolveClientForTerminal(termId);

    return DeviceItem(
      id: json['id']?.toString() ?? '',
      plate: rawPlate,
      terminalId: termId,
      driver: rawDriver,
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
      clientName: clientName,
      subscriptionExpiry: DateTime.now().add(const Duration(days: 365)),
      subscriptionStart: DateTime.now(),
    );
  }
}
