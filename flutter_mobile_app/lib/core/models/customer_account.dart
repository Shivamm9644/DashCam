class CustomerAccount {
  final String id;
  final String name;
  final String email;
  final String username;
  final String password;
  final String phone;
  final String assignedTerminalId;
  final String vehiclePlate;
  final String clientCompanyName;
  final DateTime createdAt;
  final bool isActive;

  CustomerAccount({
    required this.id,
    required this.name,
    required this.email,
    required this.username,
    required this.password,
    required this.phone,
    required this.assignedTerminalId,
    required this.vehiclePlate,
    required this.clientCompanyName,
    required this.createdAt,
    this.isActive = true,
  });

  factory CustomerAccount.fromJson(Map<String, dynamic> json) => CustomerAccount(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    email: json['email'] ?? '',
    username: json['username'] ?? '',
    password: json['password'] ?? '',
    phone: json['phone'] ?? '',
    assignedTerminalId: json['assignedTerminalId'] ?? '',
    vehiclePlate: json['vehiclePlate'] ?? '',
    clientCompanyName: json['clientCompanyName'] ?? '',
    createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
    isActive: json['isActive'] ?? true,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'username': username,
    'password': password,
    'phone': phone,
    'assignedTerminalId': assignedTerminalId,
    'vehiclePlate': vehiclePlate,
    'clientCompanyName': clientCompanyName,
    'createdAt': createdAt.toIso8601String(),
    'isActive': isActive,
  };
}
