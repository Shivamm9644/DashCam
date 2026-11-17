import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/glass_card.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailCtrl = TextEditingController(text: 'inurum@wanwaygps.com');
  final _passwordCtrl = TextEditingController(text: 'cE7R0fZYY1cSrj');
  String _selectedRole = 'SUPER_ADMIN';
  bool _obscurePassword = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  final _roles = [
    {'key': 'SUPER_ADMIN', 'label': 'Super Admin', 'emoji': '👑'},
    {'key': 'ADMIN', 'label': 'Fleet Admin', 'emoji': '🏢'},
    {'key': 'CUSTOMER', 'label': 'Retail Customer', 'emoji': '👤'},
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..forward();

    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _animController.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final auth = context.read<AuthProvider>();
    final success = await auth.login(
      email: _emailCtrl.text,
      password: _passwordCtrl.text,
      role: _selectedRole,
    );
    if (success && mounted) {
      context.go('/dashboard');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF050810), Color(0xFF0A0E1A), Color(0xFF0D1527)],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: SlideTransition(
              position: _slideAnim,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 40),

                    // Logo & Brand
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.accentCyan.withOpacity(0.3),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.videocam_rounded,
                              color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 14),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ShaderMask(
                              shaderCallback: (bounds) => const LinearGradient(
                                colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                              ).createShader(bounds),
                              child: const Text(
                                'INURUM',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: 3,
                                ),
                              ),
                            ),
                            Text(
                              'DASHCAM SAAS',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppTheme.textMuted,
                                letterSpacing: 2,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 48),

                    Text(
                      'Welcome back',
                      style: Theme.of(context).textTheme.displayMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sign in to your fleet dashboard',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                    ),

                    const SizedBox(height: 36),

                    // Role Selector
                    Text(
                      'Select Role',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: _roles.map((role) {
                        final isSelected = _selectedRole == role['key'];
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedRole = role['key']!),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              margin: EdgeInsets.only(
                                right: role['key'] != 'CUSTOMER' ? 8 : 0,
                              ),
                              padding: const EdgeInsets.symmetric(
                                  vertical: 12, horizontal: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppTheme.accentCyan.withOpacity(0.15)
                                    : AppTheme.bgCard,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? AppTheme.accentCyan
                                      : AppTheme.borderSubtle,
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Column(
                                children: [
                                  Text(role['emoji']!, style: const TextStyle(fontSize: 20)),
                                  const SizedBox(height: 4),
                                  Text(
                                    role['label']!,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: isSelected
                                          ? AppTheme.accentCyan
                                          : AppTheme.textMuted,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                    const SizedBox(height: 24),

                    // Email field
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: AppTheme.textPrimary),
                      decoration: const InputDecoration(
                        labelText: 'Email Address',
                        hintText: 'Enter your email',
                        prefixIcon: Icon(Icons.email_outlined, color: AppTheme.textMuted),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Password field
                    TextField(
                      controller: _passwordCtrl,
                      obscureText: _obscurePassword,
                      style: const TextStyle(color: AppTheme.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded,
                            color: AppTheme.textMuted),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: AppTheme.textMuted,
                          ),
                          onPressed: () =>
                              setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Error message
                    if (auth.errorMessage != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(top: 8),
                        decoration: AppTheme.accentCard(
                            color: AppTheme.statusCritical),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: AppTheme.statusCritical, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              auth.errorMessage!,
                              style: const TextStyle(
                                color: AppTheme.statusCritical,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 32),

                    // Login button
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: auth.isLoading ? null : _login,
                        child: auth.isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation(Colors.white),
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  Icon(Icons.login_rounded, size: 20),
                                  SizedBox(width: 8),
                                  Text('Sign In to Dashboard'),
                                ],
                              ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Demo info card
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.info_outline_rounded,
                                  color: AppTheme.accentCyan, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                'Demo Credentials',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.accentCyan,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _demoRow('Super Admin', 'shivam.inurum@gmail.com'),
                          const SizedBox(height: 6),
                          Text(
                            'Password: any (demo mode)',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.textMuted,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _demoRow(String role, String email) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppTheme.bgCardHover,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(role,
              style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
        ),
        const SizedBox(width: 8),
        Text(email, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
      ],
    ),
  );
}
