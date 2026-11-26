import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/retailer_account.dart';
import '../models/customer_account.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _errorMessage;
  String? _token;
  List<RetailerAccount> _retailers = [];
  List<CustomerAccount> _customers = [];

  UserModel? get user => _user;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get token => _token;
  List<RetailerAccount> get retailers => _retailers;
  List<CustomerAccount> get customers => _customers;

  final Completer<void> _initCompleter = Completer<void>();
  Future<void> get isInitialized => _initCompleter.future;

  static const String _retailersKey = 'saas_retailers_registry_v2';
  static const String _customersKey = 'saas_customers_registry_v2';

  AuthProvider() {
    _loadFromStorage();
  }

  Future<void> _loadFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Load SaaS Retailers Registry
      final savedRetailersJson = prefs.getString(_retailersKey);
      if (savedRetailersJson != null && savedRetailersJson.isNotEmpty) {
        try {
          final List list = jsonDecode(savedRetailersJson);
          _retailers = list.map((item) {
            final r = RetailerAccount.fromJson(item);
            return RetailerAccount(
              id: r.id,
              companyName: r.companyName,
              email: r.email,
              username: r.username,
              password: r.password,
              phone: r.phone,
              assignedTerminalIds: r.assignedTerminalIds,
              subscriptionPlan: r.subscriptionPlan,
              createdAt: DateTime.now(),
              expiresAt: DateTime.now().add(const Duration(days: 365)),
              isActive: r.isActive,
            );
          }).toList();
        } catch (_) {
          _retailers = _defaultRetailers();
        }
      } else {
        _retailers = _defaultRetailers();
        await _saveRetailers();
      }

      // Load SaaS Customers Registry
      final savedCustomersJson = prefs.getString(_customersKey);
      if (savedCustomersJson != null && savedCustomersJson.isNotEmpty) {
        try {
          final List cList = jsonDecode(savedCustomersJson);
          _customers = cList.map((item) => CustomerAccount.fromJson(item)).toList();
        } catch (_) {
          _customers = _defaultCustomers();
        }
      } else {
        _customers = _defaultCustomers();
        await _saveCustomers();
      }

      final savedToken = prefs.getString('auth_token');
      final savedUser = prefs.getString('user_data');

      if (savedToken != null && savedUser != null) {
        _token = savedToken;
        _user = UserModel.fromJson(jsonDecode(savedUser));
        _isAuthenticated = true;
        ApiService.instance.setToken(savedToken);
      } else {
        // Fresh install: Require explicit Login (Standard SaaS Enterprise Flow)
        _isAuthenticated = false;
        _user = null;
        _token = null;
      }
    } catch (_) {}
    if (!_initCompleter.isCompleted) _initCompleter.complete();
    notifyListeners();
  }

  List<CustomerAccount> _defaultCustomers() {
    final now = DateTime.now();
    return [
      CustomerAccount(
        id: 'cust-sharma-01',
        name: 'Rajesh Kumar',
        email: 'customer@trackanywhere.com',
        username: 'rajesh_customer',
        password: 'customer123',
        phone: '+91 98260 12345',
        assignedTerminalId: '505073729067',
        vehiclePlate: 'IND VEH-9067',
        clientCompanyName: 'Sharma Logistics',
        createdAt: now.subtract(const Duration(days: 45)),
      ),
    ];
  }

  Future<void> _saveCustomers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(_customers.map((c) => c.toJson()).toList());
      await prefs.setString(_customersKey, jsonStr);
    } catch (_) {}
  }

  Future<CustomerAccount> createCustomer({
    required String name,
    required String email,
    required String username,
    required String password,
    required String phone,
    required String assignedTerminalId,
    required String vehiclePlate,
    required String clientCompanyName,
  }) async {
    final now = DateTime.now();
    final newCust = CustomerAccount(
      id: 'cust-${now.millisecondsSinceEpoch}',
      name: name.trim(),
      email: email.trim(),
      username: username.trim().isNotEmpty ? username.trim() : email.trim().split('@')[0],
      password: password.trim().isNotEmpty ? password.trim() : 'Customer@123',
      phone: phone.trim(),
      assignedTerminalId: assignedTerminalId.trim(),
      vehiclePlate: vehiclePlate.trim(),
      clientCompanyName: clientCompanyName.trim(),
      createdAt: now,
      isActive: true,
    );

    _customers.insert(0, newCust);
    await _saveCustomers();
    notifyListeners();
    return newCust;
  }

  Future<void> deleteCustomer(String id) async {
    _customers.removeWhere((c) => c.id == id);
    await _saveCustomers();
    notifyListeners();
  }

  List<RetailerAccount> _defaultRetailers() {
    final now = DateTime.now();
    final expireInOneYear = now.add(const Duration(days: 365));
    return [
      RetailerAccount(
        id: 'ret-sharma-01',
        companyName: 'Sharma Logistics',
        email: 'sharma@trackify.com',
        username: 'sharma_logistics',
        password: 'sharma123',
        phone: '+91 98260 45222',
        assignedTerminalIds: ['505073095782', '505073729067', '505073322632'],
        subscriptionPlan: 'Enterprise Dual-Cam SaaS (365 Days)',
        createdAt: now,
        expiresAt: expireInOneYear,
        isActive: true,
      ),
      RetailerAccount(
        id: 'ret-indore-02',
        companyName: 'Indore City Express',
        email: 'indore@trackify.com',
        username: 'indore_express',
        password: 'indore123',
        phone: '+91 98261 88392',
        assignedTerminalIds: ['505073474490', '505073583696'],
        subscriptionPlan: 'Smart City MDVR Fleet (365 Days)',
        createdAt: now,
        expiresAt: expireInOneYear,
        isActive: true,
      ),
      RetailerAccount(
        id: 'ret-patel-03',
        companyName: 'Patel Transport Pvt Ltd',
        email: 'patel@trackify.com',
        username: 'patel_transport',
        password: 'patel123',
        phone: '+91 94250 11990',
        assignedTerminalIds: ['872312860795', '505073214789'],
        subscriptionPlan: 'Commercial Transport Dual AI Cam (365 Days)',
        createdAt: now,
        expiresAt: expireInOneYear,
        isActive: true,
      ),
      RetailerAccount(
        id: 'ret-bantu-04',
        companyName: 'Bantu Heavy Haulage',
        email: 'bantu@trackify.com',
        username: 'bantu_haulage',
        password: 'bantu123',
        phone: '+91 97550 44211',
        assignedTerminalIds: ['MP4242'],
        subscriptionPlan: 'Heavy Commercial Vehicle Plan (365 Days)',
        createdAt: now,
        expiresAt: expireInOneYear,
        isActive: true,
      ),
    ];
  }

  Future<void> _saveRetailers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(_retailers.map((r) => r.toJson()).toList());
      await prefs.setString(_retailersKey, jsonStr);
    } catch (_) {}
  }

  Future<RetailerAccount> createRetailer({
    required String companyName,
    required String email,
    required String username,
    required String password,
    required String phone,
    required List<String> assignedTerminalIds,
    String subscriptionPlan = 'Commercial Fleet Dual-Cam SaaS (365 Days)',
  }) async {
    final now = DateTime.now();
    final newRet = RetailerAccount(
      id: 'ret-${now.millisecondsSinceEpoch}',
      companyName: companyName.trim(),
      email: email.trim(),
      username: username.trim().isNotEmpty ? username.trim() : email.trim().split('@')[0],
      password: password.trim().isNotEmpty ? password.trim() : 'Trackify@2026',
      phone: phone.trim(),
      assignedTerminalIds: assignedTerminalIds,
      subscriptionPlan: subscriptionPlan,
      createdAt: now,
      expiresAt: now.add(const Duration(days: 365)),
      isActive: true,
    );

    _retailers.insert(0, newRet);
    await _saveRetailers();
    notifyListeners();
    return newRet;
  }

  Future<void> deleteRetailer(String id) async {
    _retailers.removeWhere((r) => r.id == id);
    await _saveRetailers();
    notifyListeners();
  }

  Future<bool> login({
    required String email,
    required String password,
    String? role,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final cleanEmail = email.trim().toLowerCase();
      final cleanPass = password.trim();

      if (cleanEmail.isEmpty || cleanPass.isEmpty) {
        _errorMessage = 'Please enter username/email and password';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // 1. Any user logging into GBT Dashcam has full Enterprise access to all vehicles on 3.85.81.10
      final adminUser = UserModel(
        id: 'user-admin-01',
        name: cleanEmail.isNotEmpty ? (cleanEmail.contains('@') ? cleanEmail.split('@')[0].toUpperCase() : cleanEmail) : 'GBT Enterprise Admin',
        email: cleanEmail.isNotEmpty ? cleanEmail : 'admin@gbtdashcam.com',
        role: 'SUPER_ADMIN',
        tenantId: 'gbt-dashcam-master',
        tenantName: 'GBT Dashcam Enterprise',
        avatar: '👑',
        assignedTerminals: const [], // Sees all fleet vehicles on 3.85.81.10
      );

      _user = adminUser;
      _token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.master.admin.token';
      _isAuthenticated = true;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('user_data', jsonEncode(adminUser.toJson()));

      ApiService.instance.setToken(_token!);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Authentication error. Please try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> updateUserProfile({
    required String name,
    required String email,
    String? phone,
    String? vehiclePlate,
    String? sosContact,
  }) async {
    if (_user == null) return;
    _user = UserModel(
      id: _user!.id,
      name: name,
      email: email,
      role: _user!.role,
      tenantId: _user!.tenantId,
      tenantName: _user!.tenantName,
      avatar: name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'U',
      assignedTerminals: _user!.assignedTerminals,
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_data', jsonEncode(_user!.toJson()));
    if (phone != null) await prefs.setString('user_phone', phone);
    if (vehiclePlate != null) await prefs.setString('user_vehicle_plate', vehiclePlate);
    if (sosContact != null) await prefs.setString('user_sos_contact', sosContact);
    notifyListeners();
  }

  // Instant 1-Click switch for live client presentation
  Future<void> quickSwitchToRetailer(RetailerAccount retailer) async {
    final retailerUser = UserModel(
      id: retailer.id,
      name: retailer.companyName,
      email: retailer.email,
      role: 'RETAILER',
      tenantId: retailer.id,
      tenantName: retailer.companyName,
      avatar: retailer.companyName.substring(0, retailer.companyName.length >= 2 ? 2 : 1).toUpperCase(),
      assignedTerminals: retailer.assignedTerminalIds,
    );

    _user = retailerUser;
    _token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.retailer.${retailer.id}.token';
    _isAuthenticated = true;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    await prefs.setString('user_data', jsonEncode(retailerUser.toJson()));

    ApiService.instance.setToken(_token!);
    notifyListeners();
  }

  Future<void> quickSwitchToCustomer(CustomerAccount customer) async {
    final customerUser = UserModel(
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: 'CUSTOMER',
      tenantId: 'personal-cust',
      tenantName: '${customer.clientCompanyName} (${customer.vehiclePlate})',
      avatar: '👤',
      assignedTerminals: [customer.assignedTerminalId],
    );

    _user = customerUser;
    _token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.customer.${customer.id}.token';
    _isAuthenticated = true;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    await prefs.setString('user_data', jsonEncode(customerUser.toJson()));

    ApiService.instance.setToken(_token!);
    notifyListeners();
  }

  Future<void> quickSwitchToAdmin() async {
    final adminUser = UserModel(
      id: 'user-admin-01',
      name: 'Inurum Admin',
      email: 'admin@trackify.com',
      role: 'SUPER_ADMIN',
      tenantId: 'inurum-master',
      tenantName: 'Inurum Master SaaS',
      avatar: '👑',
      assignedTerminals: const [],
    );

    _user = adminUser;
    _token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.master.admin.token';
    _isAuthenticated = true;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    await prefs.setString('user_data', jsonEncode(adminUser.toJson()));

    ApiService.instance.setToken(_token!);
    notifyListeners();
  }

  Future<void> logout() async {
    _user = null;
    _token = null;
    _isAuthenticated = false;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');

    ApiService.instance.clearToken();
    notifyListeners();
  }
}
