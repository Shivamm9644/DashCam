import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static final ApiService instance = ApiService._();
  ApiService._();

  /// Real Google Maps API Key
  static const String googleMapsApiKey = 'AIzaSyBa6Sfh7UbFlueqmLXSJbWEEoIYoeIpEXs';

  // Live Spring Boot Java Backend on Cloud Server (3.85.81.10)
  static const String serverHost = 'https://3.85.81.10';
  static const String liveServerBaseUrl = 'https://3.85.81.10/api/v1';

  static String get defaultBaseUrl {
    return liveServerBaseUrl;
  }

  String _baseUrl = defaultBaseUrl;
  String? _token;
  final Map<String, String> _headers = {'Content-Type': 'application/json'};

  String? get currentToken => _token;
  String get baseUrl => _baseUrl;

  void setBaseUrl(String url) => _baseUrl = url;

  /// Sets real Bearer JWT token
  void setToken(String token) {
    _token = token;
    _headers['Authorization'] = 'Bearer $token';
  }

  void clearToken() {
    _token = null;
    _headers.remove('Authorization');
  }

  /// Parses real JWT claims (Payload) in client
  Map<String, dynamic>? parseJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = _decodeBase64(parts[1]);
      final payloadMap = jsonDecode(payload);
      if (payloadMap is Map<String, dynamic>) {
        return payloadMap;
      }
    } catch (_) {}
    return null;
  }

  bool isTokenExpired(String token) {
    final claims = parseJwt(token);
    if (claims == null || !claims.containsKey('exp')) return false;
    final exp = claims['exp'] as int;
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return now > exp;
  }

  String _decodeBase64(String str) {
    String output = str.replaceAll('-', '+').replaceAll('_', '/');
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += '==';
        break;
      case 3:
        output += '=';
        break;
      default:
        throw Exception('Illegal base64url string!');
    }
    return utf8.decode(base64Url.decode(output));
  }

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handle(response);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 15));
    return _handle(response);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 15));
    return _handle(response);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 15));
    return _handle(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await http.delete(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handle(response);
  }

  Map<String, dynamic> _handle(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return <String, dynamic>{};
      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return {
          'data': decoded,
          'rows': decoded,
          'vehicles': decoded,
          'events': decoded,
          'trips': decoded,
          'count': decoded.length,
        };
      }
      return decoded as Map<String, dynamic>;
    } else {
      dynamic errorData;
      try {
        errorData = jsonDecode(response.body);
      } catch (_) {}
      throw ApiException(
        statusCode: response.statusCode,
        message: (errorData is Map)
            ? (errorData['message'] ?? errorData['error'] ?? 'Request failed')
            : 'Request failed (${response.statusCode})',
      );
    }
  }
  // --- Fleet / Non-ELD Management Endpoints ---

  Future<Map<String, dynamic>> createVehicle({
    required String plateNumber,
    required String vin,
    String? make,
    String? model,
    int? year,
    double? odometerKm,
    String? odometerSource,
  }) async {
    return post('/vehicles', {
      'plateNumber': plateNumber,
      'vin': vin,
      if (make != null && make.isNotEmpty) 'make': make,
      if (model != null && model.isNotEmpty) 'model': model,
      if (year != null) 'year': year,
      if (odometerKm != null) 'odometerKm': odometerKm,
      'odometerSource': odometerSource ?? 'GPS_ESTIMATED',
    });
  }

  Future<Map<String, dynamic>> createDriver({
    required String name,
    required String phone,
    required String licenseNumber,
  }) async {
    return post('/drivers', {
      'name': name,
      'phone': phone,
      'licenseNumber': licenseNumber,
      'status': 'ACTIVE',
    });
  }

  Future<Map<String, dynamic>> assignDriver({
    required String vehicleId,
    String? driverId,
    String? driverName,
    String? driverPhone,
    String? driverLicense,
  }) async {
    final body = <String, dynamic>{};
    if (driverId != null && driverId.isNotEmpty) {
      body['driverId'] = driverId;
    } else if (driverName != null && driverName.isNotEmpty) {
      body['driverName'] = driverName;
      if (driverPhone != null) body['driverPhone'] = driverPhone;
      if (driverLicense != null) body['driverLicense'] = driverLicense;
    }
    return post('/vehicles/' + vehicleId + '/assign-driver', body);
  }

  Future<Map<String, dynamic>> unassignDriver(String vehicleId) async {
    return post('/vehicles/' + vehicleId + '/unassign-driver', {});
  }

  Future<List<dynamic>> getDrivers() async {
    try {
      final res = await get('/drivers/all');
      if (res['drivers'] is List) return res['drivers'] as List;
    } catch (_) {}
    return [];
  }

  // --- DashCam VIN + IMEI Pairing APIs ---

  Future<Map<String, dynamic>> pairDevice({
    required String vin,
    required String imei,
    String? deviceName,
    String? plateNumber,
    String? deviceModel,
    bool forceReassign = false,
    String? notes,
  }) async {
    return post('/devices/pair', {
      'vin': vin.trim().toUpperCase(),
      'imei': imei.trim(),
      if (deviceName != null && deviceName.isNotEmpty) 'deviceName': deviceName.trim(),
      if (plateNumber != null && plateNumber.isNotEmpty) 'plateNumber': plateNumber.trim().toUpperCase(),
      'deviceModel': (deviceModel != null && deviceModel.isNotEmpty) ? deviceModel.trim() : 'GD19',
      'forceReassign': forceReassign,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<Map<String, dynamic>> unpairDevice(String vehicleIdOrVin, {String? reason}) async {
    final query = reason != null && reason.isNotEmpty
        ? '/devices/unpair?vehicleIdOrVin=$vehicleIdOrVin&reason=${Uri.encodeComponent(reason)}'
        : '/devices/unpair?vehicleIdOrVin=$vehicleIdOrVin';
    return post(query, {});
  }

  Future<Map<String, dynamic>> resolveImei(String imei) async {
    return get('/devices/resolve-imei/${imei.trim()}');
  }

  Future<List<dynamic>> getPairingHistory(String vehicleIdOrVin) async {
    try {
      final res = await get('/devices/pairing-history/$vehicleIdOrVin');
      if (res['history'] is List) return res['history'] as List;
    } catch (_) {}
    return [];
  }

}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
