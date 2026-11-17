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

import 'features/splash/screens/splash_screen.dart';



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

      statusBarIconBrightness: Brightness.light,

      systemNavigationBarColor: Color(0xFF0A0E1A),

      systemNavigationBarIconBrightness: Brightness.light,

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

          ],

        ),

      ],

    );



    return MaterialApp.router(

      title: 'Inurum Dashcam',

      debugShowCheckedModeBanner: false,

      theme: AppTheme.darkTheme,

      routerConfig: router,

    );

  }

}



class MainShell extends StatefulWidget {

  final Widget child;

  const MainShell({super.key, required this.child});



  @override

  State<MainShell> createState() => _MainShellState();

}



class _MainShellState extends State<MainShell> {

  final List<_NavItem> _navItems = const [

    _NavItem(icon: Icons.dashboard_rounded, label: 'Dashboard', route: '/dashboard'),

    _NavItem(icon: Icons.videocam_rounded, label: 'Live', route: '/camera'),

    _NavItem(icon: Icons.play_circle_outline_rounded, label: 'Playback', route: '/playback'),

    _NavItem(icon: Icons.local_shipping_rounded, label: 'Fleet', route: '/fleet'),

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



  @override

  Widget build(BuildContext context) {

    final isWide = MediaQuery.of(context).size.width >= 800;



    if (isWide) {

      return Scaffold(

        backgroundColor: AppTheme.bgPrimary,

        body: Row(

          children: [

            _buildPermanentSidebar(context),

            Expanded(child: widget.child),

          ],

        ),

      );

    }



    return Scaffold(

      backgroundColor: AppTheme.bgPrimary,

      drawer: _buildDrawer(context),

      body: widget.child,

      bottomNavigationBar: _buildBottomNav(context),

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

            Padding(

              padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),

              child: Row(

                children: [

                  Container(

                    width: 34,

                    height: 34,

                    decoration: BoxDecoration(

                      gradient: const LinearGradient(

                        colors: [AppTheme.accentCyan, AppTheme.accentPurple],

                      ),

                      borderRadius: BorderRadius.circular(8),

                    ),

                    child: const Icon(Icons.videocam_rounded, color: Colors.white, size: 18),

                  ),

                  const SizedBox(width: 10),

                  const Text(

                    'INURUM',

                    style: TextStyle(

                      fontSize: 15,

                      fontWeight: FontWeight.w800,

                      color: Colors.white,

                      letterSpacing: 1.2,

                    ),

                  ),

                ],

              ),

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

    return Drawer(

      backgroundColor: AppTheme.bgCard,

      child: SafeArea(

        child: Column(

          children: [

            Padding(

              padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),

              child: Row(

                children: [

                  Container(

                    width: 36,

                    height: 36,

                    decoration: BoxDecoration(

                      gradient: const LinearGradient(

                        colors: [AppTheme.accentCyan, AppTheme.accentPurple],

                      ),

                      borderRadius: BorderRadius.circular(8),

                    ),

                    child: const Icon(Icons.videocam_rounded, color: Colors.white, size: 18),

                  ),

                  const SizedBox(width: 10),

                  const Text(

                    'INURUM',

                    style: TextStyle(

                      fontSize: 15,

                      fontWeight: FontWeight.w800,

                      color: Colors.white,

                      letterSpacing: 1.2,

                    ),

                  ),

                ],

              ),

            ),

            const Divider(color: AppTheme.borderSubtle, height: 1),

            Expanded(

              child: ListView(

                padding: const EdgeInsets.all(10),

                children: [

                  ..._navItems.map((item) => ListTile(

                    dense: true,

                    leading: Icon(item.icon, color: AppTheme.accentCyan, size: 19),

                    title: Text(item.label, style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary)),

                    onTap: () {

                      Navigator.pop(context);

                      context.go(item.route);

                    },

                  )),

                  const Divider(color: AppTheme.borderSubtle),

                  ListTile(

                    dense: true,

                    leading: const Icon(Icons.history_edu_rounded, color: AppTheme.textMuted, size: 19),

                    title: const Text('Audit Logs', style: TextStyle(fontSize: 13, color: AppTheme.textPrimary)),

                    onTap: () {

                      Navigator.pop(context);

                      context.go('/audit');

                    },

                  ),

                  ListTile(

                    dense: true,

                    leading: const Icon(Icons.data_usage_rounded, color: AppTheme.textMuted, size: 19),

                    title: const Text('Data Quotas', style: TextStyle(fontSize: 13, color: AppTheme.textPrimary)),

                    onTap: () {

                      Navigator.pop(context);

                      context.go('/quotas');

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



  Widget _buildBottomNav(BuildContext context) {

    final selectedIndex = _calculateSelectedIndex(context);



    return Container(

      decoration: BoxDecoration(

        color: AppTheme.bgCard,

        border: Border(

          top: BorderSide(color: AppTheme.borderSubtle, width: 1),

        ),

        boxShadow: [

          BoxShadow(

            color: Colors.black.withOpacity(0.3),

            blurRadius: 20,

            offset: const Offset(0, -5),

          ),

        ],

      ),

      child: SafeArea(

        child: Padding(

          padding: const EdgeInsets.symmetric(vertical: 8),

          child: Row(

            mainAxisAlignment: MainAxisAlignment.spaceAround,

            children: List.generate(_navItems.length, (i) {

              final item = _navItems[i];

              final isActive = selectedIndex == i;

              return GestureDetector(

                onTap: () {

                  context.go(item.route);

                },

                child: AnimatedContainer(

                  duration: const Duration(milliseconds: 200),

                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),

                  decoration: BoxDecoration(

                    color: isActive

                        ? AppTheme.accentCyan.withOpacity(0.15)

                        : Colors.transparent,

                    borderRadius: BorderRadius.circular(12),

                  ),

                  child: Column(

                    mainAxisSize: MainAxisSize.min,

                    children: [

                      Icon(

                        item.icon,

                        color: isActive ? AppTheme.accentCyan : AppTheme.textMuted,

                        size: 22,

                      ),

                      const SizedBox(height: 4),

                      Text(

                        item.label,

                        style: TextStyle(

                          fontSize: 10,

                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,

                          color: isActive ? AppTheme.accentCyan : AppTheme.textMuted,

                        ),

                      ),

                    ],

                  ),

                ),

              );

            }),

          ),

        ),

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

