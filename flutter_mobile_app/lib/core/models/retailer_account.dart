class RetailerAccount {
  final String id;
  final String companyName;
  final String email;
  final String username;
  final String password;
  final String phone;
  final List<String> assignedTerminalIds;
  final String subscriptionPlan;
  final DateTime createdAt;
  final DateTime expiresAt;
  final bool isActive;

  RetailerAccount({
    required this.id,
    required this.companyName,
    required this.email,
    required this.username,
    required this.password,
    required this.phone,
    required this.assignedTerminalIds,
    this.subscriptionPlan = 'Commercial Fleet Dual-Cam SaaS (365 Days)',
    required this.createdAt,
    required this.expiresAt,
    this.isActive = true,
  });

  factory RetailerAccount.fromJson(Map<String, dynamic> json) => RetailerAccount(
    id: json['id'] ?? '',
    companyName: json['companyName'] ?? '',
    email: json['email'] ?? '',
    username: json['username'] ?? '',
    password: json['password'] ?? '',
    phone: json['phone'] ?? '',
    assignedTerminalIds: (json['assignedTerminalIds'] is List)
        ? (json['assignedTerminalIds'] as List).map((e) => e.toString()).toList()
        : [],
    subscriptionPlan: json['subscriptionPlan'] ?? 'Commercial Fleet Dual-Cam SaaS (365 Days)',
    createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
    expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : DateTime.now().add(const Duration(days: 365)),
    isActive: json['isActive'] ?? true,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'companyName': companyName,
    'email': email,
    'username': username,
    'password': password,
    'phone': phone,
    'assignedTerminalIds': assignedTerminalIds,
    'subscriptionPlan': subscriptionPlan,
    'createdAt': createdAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'isActive': isActive,
  };

  int get daysRemaining {
    final diff = expiresAt.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }
}
