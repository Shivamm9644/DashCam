class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String tenantId;
  final String tenantName;
  final String avatar;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.tenantId,
    required this.tenantName,
    required this.avatar,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    email: json['email'] ?? '',
    role: json['role'] ?? 'CUSTOMER',
    tenantId: json['tenantId'] ?? '',
    tenantName: json['tenantName'] ?? '',
    avatar: json['avatar'] ?? 'U',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
    'tenantId': tenantId,
    'tenantName': tenantName,
    'avatar': avatar,
  };

  String get roleLabel {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'ADMIN': return 'Fleet Admin';
      case 'CUSTOMER': return 'Retail Customer';
      default: return role;
    }
  }

  String get roleEmoji {
    switch (role) {
      case 'SUPER_ADMIN': return '👑';
      case 'ADMIN': return '🏢';
      case 'CUSTOMER': return '👤';
      default: return '❓';
    }
  }
}
