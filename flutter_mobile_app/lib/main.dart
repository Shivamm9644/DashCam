import 'dart:io';
import 'package:flutter/material.dart';

import 'package:flutter/services.dart';

import 'package:provider/provider.dart';

import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';

import 'core/providers/auth_provider.dart';

import 'core/providers/dashboard_provider.dart';

import 'core/providers/device_provider.dart';

import 'features/auth/screens/login_screen.dart';

import 'features/dashboard/screens/dashboard_screen.dart';

import 'features/fleet/screens/fleet_screen.dart';

import 'features/events/screens/events_screen.dart';

import 'features/device_mgmt/screens/device_management_screen.dart';

import 'features/camera/screens/camera_live_screen.dart';

import 'features/playback/screens/playback_screen.dart';

import 'features/quotas/screens/quotas_screen.dart';

import 'features/audit/screens/audit_screen.dart';
import 'features/profile/screens/profile_screen.dart';
import 'features/profile/widgets/retailer_management_dialog.dart';
import 'features/profile/widgets/customer_management_dialog.dart';
import 'features/splash/screens/splash_screen.dart';
import 'core/widgets/trackify_logo.dart';



class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

void main() async {
  HttpOverrides.global = MyHttpOverrides();

  WidgetsFlutterBinding.ensureInitialized();



  // Force portrait + landscape

  await SystemChrome.setPreferredOrientations([

    DeviceOrientation.portraitUp,

    DeviceOrientation.portraitDown,

    DeviceOrientation.landscapeLeft,

    DeviceOrientation.landscapeRight,

  ]);



  // Status bar styling
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFFF1F5F9),
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );



  runApp(

    MultiProvider(

      providers: [

        ChangeNotifierProvider(create: (_) => AuthProvider()),

        ChangeNotifierProvider(create: (_) => DashboardProvider()),

        ChangeNotifierProvider(create: (_) => DeviceProvider()),

      ],

      child: const InurumDashcamApp(),

    ),

  );

}



class InurumDashcamApp extends StatelessWidget {

  const InurumDashcamApp({super.key});



  @override

  Widget build(BuildContext context) {

    final authProvider = context.watch<AuthProvider>();



    final router = GoRouter(

      initialLocation: '/splash',

      redirect: (context, state) {

        final isLoggedIn = authProvider.isAuthenticated;

        final isSplash = state.matchedLocation == '/splash';

        final isLogin = state.matchedLocation == '/login';



        if (isSplash) return null;

        if (!isLoggedIn && !isLogin) return '/login';

        if (isLoggedIn && isLogin) return '/dashboard';

        return null;

      },

      routes: [

        GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),

        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

        ShellRoute(

          builder: (context, state, child) => MainShell(child: child),

          routes: [

            GoRoute(

              path: '/dashboard',

              builder: (_, __) => const DashboardScreen(),

            ),

            GoRoute(

              path: '/fleet',

              builder: (_, __) => const FleetScreen(),

            ),

            GoRoute(

              path: '/events',

              builder: (_, __) => const EventsScreen(),

            ),

            GoRoute(

              path: '/device-management',

              builder: (_, __) => const DeviceManagementScreen(),

            ),

            GoRoute(

              path: '/camera',

              builder: (_, __) => const CameraLiveScreen(),

            ),

            GoRoute(

              path: '/playback',

              builder: (_, __) => const PlaybackScreen(),

            ),

            GoRoute(

              path: '/quotas',

              builder: (_, __) => const QuotasScreen(),

            ),

            GoRoute(

              path: '/audit',

              builder: (_, __) => const AuditScreen(),

            ),

            GoRoute(

              path: '/profile',

              builder: (_, __) => const ProfileScreen(),

            ),

          ],

        ),

      ],

    );



    return MaterialApp.router(
      title: 'TrackAnywhere',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: router,
    );

  }

}



final GlobalKey<ScaffoldState> rootScaffoldKey = GlobalKey<ScaffoldState>();

class MainShell extends StatefulWidget {

  final Widget child;

  const MainShell({super.key, required this.child});



  @override

  State<MainShell> createState() => _MainShellState();

}



class _MainShellState extends State<MainShell> {
  DateTime? _lastBackPressTime;

  final List<_NavItem> _navItems = const [
    _NavItem(icon: Icons.dashboard_rounded, label: 'Dashboard', route: '/dashboard'),
    _NavItem(icon: Icons.videocam_rounded, label: 'Live', route: '/camera'),
    _NavItem(icon: Icons.play_circle_outline_rounded, label: 'Playback', route: '/playback'),
    _NavItem(icon: Icons.local_shipping_rounded, label: 'Fleet', route: '/fleet'),
    _NavItem(icon: Icons.person_rounded, label: 'Profile', route: '/profile'),
    _NavItem(icon: Icons.settings_rounded, label: 'Settings', route: '/device-management'),
  ];

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _navItems.length; i++) {
      if (location.startsWith(_navItems[i].route)) {
        return i;
      }
    }
    return 0;
  }

  int _calculateBottomNavIndex(String location) {
    if (location.startsWith('/playback')) return 1;
    if (location.startsWith('/fleet')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0; // /dashboard or default
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width >= 800;
    final location = GoRouterState.of(context).matchedLocation;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        // 1. If Drawer is currently open, close it on back press
        if (rootScaffoldKey.currentState?.isDrawerOpen == true) {
          rootScaffoldKey.currentState?.closeDrawer();
          return;
        }

        // 2. If user is on any screen other than /dashboard, go back to /dashboard
        if (location != '/dashboard' && location != '/') {
          context.go('/dashboard');
          return;
        }

        // 3. If on /dashboard, require double-tap within 2 seconds to exit app
        final now = DateTime.now();
        if (_lastBackPressTime == null ||
            now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.touch_app_rounded, color: Colors.white, size: 18),
                  SizedBox(width: 10),
                  Text(
                    'Press back again to exit TrackAnywhere',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF1E293B),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              margin: const EdgeInsets.only(bottom: 24, left: 24, right: 24),
              duration: const Duration(seconds: 2),
            ),
          );
          return;
        }

        // Second press: Exit app cleanly
        SystemNavigator.pop();
      },
      child: Scaffold(
        key: rootScaffoldKey,
        backgroundColor: AppTheme.bgPrimary,
        drawer: _buildDrawer(context),
        body: isWide
            ? Row(
                children: [
                  _buildPermanentSidebar(context),
                  Expanded(child: widget.child),
                ],
              )
            : widget.child,
        bottomNavigationBar: isWide ? null : _buildBottomNavBar(context, location),
      ),
    );
  }

  Widget _buildBottomNavBar(BuildContext context, String currentRoute) {
    final selectedIndex = _calculateBottomNavIndex(currentRoute);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildBottomNavItem(
                context,
                index: 0,
                icon: Icons.home_rounded,
                label: 'Home',
                isSelected: selectedIndex == 0,
                route: '/dashboard',
              ),
              _buildBottomNavItem(
                context,
                index: 1,
                icon: Icons.play_circle_fill_rounded,
                label: 'Playback',
                isSelected: selectedIndex == 1,
                route: '/playback',
              ),
              _buildBottomNavItem(
                context,
                index: 2,
                icon: Icons.local_shipping_rounded,
                label: 'Fleet',
                isSelected: selectedIndex == 2,
                route: '/fleet',
              ),
              _buildBottomNavItem(
                context,
                index: 3,
                icon: Icons.person_rounded,
                label: 'Profile',
                isSelected: selectedIndex == 3,
                route: '/profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNavItem(
    BuildContext context, {
    required int index,
    required IconData icon,
    required String label,
    required bool isSelected,
    required String route,
  }) {
    return InkWell(
      onTap: () {
        if (!isSelected) {
          context.go(route);
        }
      },
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 22,
              color: isSelected ? const Color(0xFF0284C7) : const Color(0xFF94A3B8),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                color: isSelected ? const Color(0xFF0284C7) : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }



  Widget _buildPermanentSidebar(BuildContext context) {

    final selectedIndex = _calculateSelectedIndex(context);



    return Container(

      width: 220,

      decoration: BoxDecoration(

        color: AppTheme.bgCard,

        border: Border(right: BorderSide(color: AppTheme.borderSubtle)),

      ),

      child: SafeArea(

        child: Column(

          children: [

            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 16),
              child: TrackifyLogo(size: 32),
            ),

            const Divider(color: AppTheme.borderSubtle, height: 1),

            const SizedBox(height: 8),

            Expanded(

              child: ListView(

                padding: const EdgeInsets.symmetric(horizontal: 10),

                children: [

                  ...List.generate(_navItems.length, (i) {

                    final item = _navItems[i];

                    final isActive = selectedIndex == i;

                    return Padding(

                      padding: const EdgeInsets.only(bottom: 2),

                      child: ListTile(

                        dense: true,

                        leading: Icon(

                          item.icon,

                          color: isActive ? AppTheme.accentCyan : AppTheme.textMuted,

                          size: 19,

                        ),

                        title: Text(

                          item.label,

                          style: TextStyle(

                            fontSize: 13,

                            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,

                            color: isActive ? AppTheme.accentCyan : AppTheme.textPrimary,

                          ),

                        ),

                        selected: isActive,

                        selectedTileColor: AppTheme.accentCyan.withOpacity(0.12),

                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),

                        onTap: () => context.go(item.route),

                      ),

                    );

                  }),

                  const SizedBox(height: 6),

                  const Divider(color: AppTheme.borderSubtle, height: 1),

                  const SizedBox(height: 6),

                  ListTile(

                    dense: true,

                    leading: const Icon(Icons.history_edu_rounded, color: AppTheme.textMuted, size: 19),

                    title: const Text('Audit Logs', style: TextStyle(fontSize: 13, color: AppTheme.textPrimary)),

                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),

                    onTap: () => context.go('/audit'),

                  ),

                  ListTile(

                    dense: true,

                    leading: const Icon(Icons.data_usage_rounded, color: AppTheme.textMuted, size: 19),

                    title: const Text('Data Quotas', style: TextStyle(fontSize: 13, color: AppTheme.textPrimary)),

                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),

                    onTap: () => context.go('/quotas'),

                  ),

                ],

              ),

            ),

          ],

        ),

      ),

    );

  }



  Widget _buildDrawer(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final user = auth.user;
    final currentRoute = GoRouterState.of(context).matchedLocation;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Top Drawer Branding Header (Matching Web App)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(bottom: BorderSide(color: AppTheme.borderSubtle)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const TrackifyLogo(size: 38),
                  const SizedBox(height: 6),
                  Text(
                    user?.tenantName ?? 'TrackAnywhere Master',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0284C7),
                      letterSpacing: 0.5,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 12),
                  // Active Fleet Connection Pill
                  Builder(
                    builder: (context) {
                      final hasOnline = dash.onlineVehicles > 0;
                      final stColor = hasOnline ? AppTheme.statusOnline : const Color(0xFF64748B);
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: stColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: stColor.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: stColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              hasOnline
                                  ? '${dash.devices.length} Terminals • ${dash.onlineVehicles} Online'
                                  : '${dash.devices.length} Terminals • Standby',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: stColor,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            // Scrollable Operational Navigation Tree
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                children: [
                  // GROUP 1: FLEET MONITORING
                  _buildDrawerSectionHeader('FLEET MONITORING'),
                  _buildDrawerItem(
                    context,
                    icon: Icons.dashboard_rounded,
                    title: 'Dashboard Overview',
                    route: '/dashboard',
                    isSelected: currentRoute == '/dashboard' || currentRoute == '/',
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.videocam_rounded,
                    title: 'Live Video Monitoring',
                    route: '/camera',
                    badge: dash.onlineVehicles > 0 ? '${dash.onlineVehicles} LIVE' : null,
                    badgeColor: AppTheme.accentGreen,
                    isSelected: currentRoute == '/camera',
                  ),

                  const SizedBox(height: 14),

                  // GROUP 2: SAFETY & VIDEO
                  _buildDrawerSectionHeader('SAFETY & VIDEO'),
                  _buildDrawerItem(
                    context,
                    icon: Icons.wifi_tethering_rounded,
                    title: 'Offline Cam (MC Tool)',
                    route: '/camera?mode=offline',
                    badge: 'DIRECT AP',
                    badgeColor: AppTheme.accentTeal,
                    isSelected: currentRoute.contains('mode=offline'),
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.play_circle_fill_rounded,
                    title: 'Video Center',
                    route: '/playback',
                    isSelected: currentRoute == '/playback',
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.warning_amber_rounded,
                    title: 'Safety Inbox',
                    route: '/events',
                    badge: dash.criticalAlerts > 0 ? '${dash.criticalAlerts} Alert' : null,
                    badgeColor: AppTheme.accentSaffron,
                    isSelected: currentRoute == '/events',
                  ),

                  const SizedBox(height: 14),

                  // GROUP 3: OPERATIONS & HARDWARE
                  _buildDrawerSectionHeader('OPERATIONS & FLEET'),
                  _buildDrawerItem(
                    context,
                    icon: Icons.local_shipping_rounded,
                    title: 'Vehicles & Devices',
                    route: '/fleet',
                    isSelected: currentRoute == '/fleet',
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.settings_remote_rounded,
                    title: 'Device & Subscription',
                    route: '/device-management',
                    isSelected: currentRoute == '/device-management',
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.history_edu_rounded,
                    title: 'Audit Logs',
                    route: '/audit',
                    isSelected: currentRoute == '/audit',
                  ),
                  _buildDrawerItem(
                    context,
                    icon: Icons.data_usage_rounded,
                    title: 'Reports & Analytics',
                    route: '/quotas',
                    isSelected: currentRoute == '/quotas',
                  ),

                  // GROUP 4: ROLE-SPECIFIC ADMINISTRATIVE ACCESS
                  if (user?.role == 'SUPER_ADMIN') ...[
                    const SizedBox(height: 14),
                    _buildDrawerSectionHeader('SAAS CLIENT & ADMIN ACCESS'),
                    _buildDrawerActionTile(
                      context,
                      icon: Icons.admin_panel_settings_rounded,
                      iconColor: const Color(0xFF0284C7),
                      title: '+ Create Client / Admin Account',
                      subtitle: 'Provision tenant logins & assign dashcams',
                      onTap: () {
                        Navigator.pop(context);
                        RetailerManagementSheet.show(context);
                      },
                    ),
                    _buildDrawerActionTile(
                      context,
                      icon: Icons.add_to_queue_rounded,
                      iconColor: const Color(0xFF9333EA),
                      title: '+ Register New Dashcam',
                      subtitle: 'Pair JT1078 terminal to fleet',
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/fleet');
                      },
                    ),
                    _buildDrawerActionTile(
                      context,
                      icon: Icons.person_add_rounded,
                      iconColor: const Color(0xFF16A34A),
                      title: '+ Add Fleet Driver',
                      subtitle: 'Register driver to client vehicles',
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/fleet');
                      },
                    ),
                  ],

                  if (user?.role == 'RETAILER') ...[
                    const SizedBox(height: 14),
                    _buildDrawerSectionHeader('CUSTOMER & DRIVER MANAGEMENT'),
                    _buildDrawerActionTile(
                      context,
                      icon: Icons.person_add_alt_1_rounded,
                      iconColor: const Color(0xFF0284C7),
                      title: '+ Create Customer Login',
                      subtitle: 'Grant 1-vehicle access to retail customer',
                      onTap: () {
                        Navigator.pop(context);
                        CustomerManagementSheet.show(context);
                      },
                    ),
                    _buildDrawerActionTile(
                      context,
                      icon: Icons.badge_rounded,
                      iconColor: const Color(0xFF16A34A),
                      title: '+ Add / Assign Driver',
                      subtitle: 'Assign driver to company trucks',
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/fleet');
                      },
                    ),
                  ],
                ],
              ),
            ),

            // Bottom Profile & Sign Out Footer
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(top: BorderSide(color: AppTheme.borderSubtle)),
              ),
              child: Row(
                children: [
                  InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/profile');
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0284C7), Color(0xFF0D9488)],
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              user?.avatar ?? 'U',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        context.go('/profile');
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'Kamlesh Soni',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'TrackAnywhere Profile • Manage >',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF0284C7),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                    tooltip: 'Sign Out',
                    onPressed: () async {
                      Navigator.pop(context);
                      await auth.logout();
                      if (context.mounted) context.go('/login');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: AppTheme.textMuted,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildDrawerItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String route,
    required bool isSelected,
    String? badge,
    Color? badgeColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: isSelected ? AppTheme.accentSaffron.withOpacity(0.18) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected ? AppTheme.accentSaffron.withOpacity(0.6) : Colors.transparent,
          width: 1.2,
        ),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
        leading: Icon(
          icon,
          color: isSelected ? AppTheme.accentSaffron : AppTheme.textSecondary,
          size: 20,
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? const Color(0xFFC2410C) : AppTheme.textPrimary,
          ),
        ),
        trailing: badge != null
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: (badgeColor ?? AppTheme.accentCyan).withOpacity(0.18),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: (badgeColor ?? AppTheme.accentCyan).withOpacity(0.5)),
                ),
                child: Text(
                  badge,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: badgeColor ?? AppTheme.accentCyan,
                  ),
                ),
              )
            : null,
        onTap: () {
          Navigator.pop(context);
          context.go(route);
        },
      ),
    );
  }

  Widget _buildDrawerActionTile(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: iconColor.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: iconColor.withOpacity(0.25),
          width: 1,
        ),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
        leading: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconColor, size: 18),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: iconColor,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(
            fontSize: 10,
            color: Color(0xFF64748B),
          ),
        ),
        trailing: Icon(Icons.arrow_forward_ios_rounded, size: 12, color: iconColor.withOpacity(0.6)),
        onTap: onTap,
      ),
    );
  }
}

class _NavItem {

  final IconData icon;

  final String label;

  final String route;

  const _NavItem({required this.icon, required this.label, required this.route});

}

