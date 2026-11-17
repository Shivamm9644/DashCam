import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/device_provider.dart';
import 'package:intl/intl.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/truck_map_view.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final dp = context.watch<DeviceProvider>();
    final user = auth.user;

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: CustomScrollView(
          slivers: [
            // Header
            SliverAppBar(
              expandedHeight: 140,
              floating: true,
              snap: true,
              backgroundColor: AppTheme.bgCard,
              elevation: 0,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    border: Border(
                      bottom: BorderSide(color: AppTheme.borderSubtle),
                    ),
                  ),
                  child: SafeArea(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        // Logo
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.videocam_rounded,
                              color: Colors.white, size: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ShaderMask(
                                shaderCallback: (b) => const LinearGradient(
                                  colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                                ).createShader(b),
                                child: const Text(
                                  'INURUM DASHCAM',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ),
                              Text(
                                user?.tenantName ?? 'Loading...',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Status & User
                        Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(
                              label: 'ONLINE',
                              color: AppTheme.statusOnline,
                              pulsing: true,
                            ),
                            const SizedBox(height: 6),
                            GestureDetector(
                              onTap: () => _showProfileSheet(context, auth),
                              child: Row(
                                children: [
                                  Container(
                                    width: 30,
                                    height: 30,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [AppTheme.accentCyan,
                                            AppTheme.accentPurple],
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Center(
                                      child: Text(
                                        user?.avatar ?? 'U',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Content
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([

                  // Welcome greeting
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Text(
                              user?.roleEmoji ?? '👤',
                              style: const TextStyle(fontSize: 16),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${user?.name?.split(" ").first ?? "User"} • ${user?.roleLabel ?? "Fleet"}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          _timeNow(),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // KPI Grid
                  const SectionTitle(title: 'Overview'),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.5,
                    children: [
                      StatCard(
                        label: 'Vehicles',
                        value: '${dash.totalVehicles}',
                        subtitle: '${dash.onlineVehicles} online • ${dash.offlineVehicles} offline',
                        icon: Icons.local_shipping_rounded,
                        iconColor: AppTheme.accentCyan,
                        badge: StatusBadge(
                          label: '${dash.onlineVehicles} ONLINE',
                          color: AppTheme.statusOnline,
                          pulsing: true,
                        ),
                      ),
                      StatCard(
                        label: 'Telemetry',
                        value: dash.telemetryFreshness,
                        subtitle: 'Cloud Connected',
                        icon: Icons.satellite_alt_rounded,
                        iconColor: AppTheme.accentGreen,
                      ),
                      StatCard(
                        label: 'Alerts',
                        value: '${dash.criticalAlerts}',
                        subtitle: 'Events Today',
                        icon: Icons.warning_amber_rounded,
                        iconColor: AppTheme.statusCritical,
                        valueColor: AppTheme.statusCritical,
                        badge: StatusBadge(
                          label: 'CRITICAL',
                          color: AppTheme.statusCritical,
                        ),
                      ),
                      StatCard(
                        label: 'Mileage',
                        value: '${(dash.totalVehicles * 34.2).round()} mi',
                        subtitle: 'Total Today',
                        icon: Icons.straighten_rounded,
                        iconColor: AppTheme.accentPurple,

                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Quick Actions
                  const SectionTitle(title: 'Quick Actions'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _QuickAction(
                        icon: Icons.videocam_rounded,
                        label: 'Live Cam',
                        color: AppTheme.accentCyan,
                        onTap: () => context.go('/camera'),
                      ),
                      _QuickAction(
                        icon: Icons.play_circle_fill_rounded,
                        label: 'Playback',
                        color: AppTheme.accentGreen,
                        onTap: () => context.go('/playback'),
                      ),
                      _QuickAction(
                        icon: Icons.map_rounded,
                        label: 'Live Fleet',
                        color: AppTheme.accentPurple,
                        onTap: () => context.go('/fleet'),
                      ),
                      _QuickAction(
                        icon: Icons.settings_remote_rounded,
                        label: 'Device Mgmt',
                        color: AppTheme.statusWarning,
                        onTap: () => context.go('/device-management'),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Active Truck Live GPS Location Map
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.location_on_rounded, color: AppTheme.accentCyan, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Live Location',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.accentCyan.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.accentCyan.withOpacity(0.4)),
                        ),
                        child: Text(
                          dash.selectedDevice?.plate ?? (dash.devices.isNotEmpty ? dash.devices.first.plate : 'LIVE GPS'),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.accentCyan,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  LiveTruckMapView(
                    lat: (dash.selectedDevice?.lat != null && dash.selectedDevice!.lat != 0.0)
                        ? dash.selectedDevice!.lat
                        : (dash.devices.isNotEmpty && dash.devices.first.lat != 0.0 ? dash.devices.first.lat : 37.7749),
                    lng: (dash.selectedDevice?.lng != null && dash.selectedDevice!.lng != 0.0)
                        ? dash.selectedDevice!.lng
                        : (dash.devices.isNotEmpty && dash.devices.first.lng != 0.0 ? dash.devices.first.lng : -122.4194),
                    heading: (dash.selectedDevice?.heading ?? 45.0).toDouble(),
                    speedMph: ((dash.selectedDevice?.speed ?? (dash.devices.isNotEmpty ? dash.devices.first.speed : 42.0)) * 0.621371),
                    plate: dash.selectedDevice?.plate ?? (dash.devices.isNotEmpty ? dash.devices.first.plate : 'Active Truck'),
                    status: dash.selectedDevice?.status ?? 'ONLINE',
                    height: 200,
                    onExpand: () => context.go('/fleet'),
                  ),

                  const SizedBox(height: 24),

                  // Vehicle List with Self-Service Camera Assignment
                  SectionTitle(
                    title: 'Vehicles',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: () => _showAssignCameraSheet(context, dash, dp),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppTheme.accentCyan.withOpacity(0.18),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                  color: AppTheme.accentCyan.withOpacity(0.6)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.add_rounded,
                                    size: 14, color: AppTheme.accentCyan),
                                SizedBox(width: 4),
                                Text(
                                  '+ Device',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.accentCyan,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCardHover,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${dash.devices.length} Terminals',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...dash.devices.map((device) => _DeviceListItem(
                        device: device,
                        isSelected: dp.systemStatus.imei == device.terminalId,
                        onTap: () {
                          dash.selectDevice(device);
                          dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: AppTheme.bgCard,
                              content: Text('Selected ${device.plate} (${device.terminalId}) • ${device.status}'),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                        onDelete: device.isCustomAssigned
                            ? () async {
                                await dash.removeDevice(device.terminalId);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Camera ${device.terminalId} unassigned.'),
                                  ),
                                );
                              }
                            : null,
                      )),

                  const SizedBox(height: 80), // Bottom nav space
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }

  String _timeNow() {
    final now = DateTime.now();
    return DateFormat('hh:mm a').format(DateTime.now());
  }

  Color _quotaColor(double pct) {
    if (pct < 60) return AppTheme.statusOnline;
    if (pct < 85) return AppTheme.statusWarning;
    return AppTheme.statusCritical;
  }

  void _showProfileSheet(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(
                  auth.user?.avatar ?? 'U',
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              auth.user?.name ?? '',
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary),
            ),
            Text(
              auth.user?.email ?? '',
              style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 8),
            StatusBadge(
              label: '${auth.user?.roleEmoji} ${auth.user?.roleLabel}',
              color: AppTheme.accentCyan,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.statusCritical.withOpacity(0.2),
                  foregroundColor: AppTheme.statusCritical,
                ),
                onPressed: () async {
                  Navigator.pop(context);
                  await auth.logout();
                  if (context.mounted) context.go('/login');
                },
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.logout_rounded, size: 18),
                    SizedBox(width: 8),
                    Text('Sign Out'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showAssignCameraSheet(BuildContext context, DashboardProvider dash, DeviceProvider dp) {
    final imeiController = TextEditingController();
    final plateController = TextEditingController(text: 'Customer Dashcam (VEH-0795)');
    final driverController = TextEditingController(text: 'Primary Owner');
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentCyan.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.add_to_photos_rounded, color: AppTheme.accentCyan, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Assign Customer Dashcam',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppTheme.textMuted),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Enter Dashcam IMEI number to assign to vehicle:',
                style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: imeiController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Dashcam IMEI / Terminal ID',
                  labelStyle: const TextStyle(color: AppTheme.accentCyan, fontSize: 13),
                  hintText: 'Enter Dashcam IMEI / Terminal ID',
                  prefixIcon: const Icon(Icons.qr_code_scanner_rounded, color: AppTheme.accentCyan, size: 20),
                  suffixIcon: TextButton(
                    onPressed: () {
                      setSheetState(() => imeiController.clear());
                    },
                    child: const Text('Clear', style: TextStyle(fontSize: 11, color: AppTheme.accentCyan, fontWeight: FontWeight.bold)),
                  ),
                  filled: true,
                  fillColor: AppTheme.bgPrimary,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: plateController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Vehicle Name / Number Plate',
                  labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  hintText: 'Enter Vehicle Name / Number Plate',
                  prefixIcon: const Icon(Icons.directions_car_rounded, color: AppTheme.textMuted, size: 20),
                  filled: true,
                  fillColor: AppTheme.bgPrimary,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: driverController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Owner / Driver Name',
                  labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  hintText: 'e.g. Primary Owner',
                  prefixIcon: const Icon(Icons.person_outline_rounded, color: AppTheme.textMuted, size: 20),
                  filled: true,
                  fillColor: AppTheme.bgPrimary,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentCyan,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final imei = imeiController.text.trim();
                          final plate = plateController.text.trim().isEmpty ? 'Dashcam ($imei)' : plateController.text.trim();
                          final driver = driverController.text.trim().isEmpty ? 'Owner' : driverController.text.trim();

                          if (imei.isNotEmpty) {
                            setSheetState(() => isSubmitting = true);
                            final newDevice = await dash.assignNewDevice(
                              imei: imei,
                              plate: plate,
                              driver: driver,
                              deviceType: 'Dual-Lens Dashcam',
                            );
                            await dp.selectServerDevice(imei, plate);

                            if (ctx.mounted) {
                              Navigator.pop(ctx);
                              if (newDevice != null) {
                                _showAssignmentResultDialog(context, newDevice, dash, dp);
                              }
                            }
                          }
                        },
                  child: isSubmitting
                      ? const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)),
                            SizedBox(width: 10),
                            Text('Checking Server & Assigning...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        )
                      : const Text(
                          'Assign & Activate Camera',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAssignmentResultDialog(
    BuildContext context,
    DeviceItem device,
    DashboardProvider dash,
    DeviceProvider dp,
  ) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dCtx, setModalState) {
            // Read latest device status from dashboard provider
            final currentDev = dash.devices.firstWhere(
              (d) => d.terminalId == device.terminalId,
              orElse: () => device,
            );
            final isOnline = currentDev.isOnline;

            return Dialog(
              backgroundColor: const Color(0xFF0F172A),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                  color: isOnline ? AppTheme.statusOnline.withOpacity(0.5) : AppTheme.accentOrange.withOpacity(0.5),
                  width: 1.5,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header Row
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: (isOnline ? AppTheme.statusOnline : AppTheme.accentOrange).withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isOnline ? Icons.videocam_rounded : Icons.sd_storage_rounded,
                            color: isOnline ? AppTheme.statusOnline : AppTheme.accentOrange,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Camera Assigned Successfully!',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                              Text(
                                '${currentDev.plate} (IMEI: ${currentDev.terminalId})',
                                style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: AppTheme.textMuted, size: 20),
                          onPressed: () => Navigator.pop(dialogCtx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Big Status Banner Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: (isOnline ? const Color(0xFF064E3B) : const Color(0xFF451A03)).withOpacity(0.4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: (isOnline ? AppTheme.statusOnline : AppTheme.accentOrange).withOpacity(0.4),
                        ),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: isOnline ? AppTheme.statusOnline : AppTheme.accentOrange,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                isOnline ? 'CAMERA STATUS: ONLINE' : 'CAMERA STATUS: OFFLINE',
                                style: TextStyle(
                                  color: isOnline ? AppTheme.statusOnline : AppTheme.accentOrange,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            isOnline
                                ? 'Dashcam ${currentDev.terminalId} is actively connected. Dual-lens live video pipeline (CH1 Road + CH2 Cabin) is ready to stream!'
                                : 'Dashcam ${currentDev.terminalId} is currently OFFLINE (ignition off or parked). Showing recorded playback from MicroSD Memory Card.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Color(0xFFCBD5E1),
                              fontSize: 11,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Quick Toggle for testing Online/Offline
                    InkWell(
                      onTap: () {
                        dash.toggleDeviceOnlineStatus(currentDev.terminalId);
                        setModalState(() {});
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.sync_rounded, size: 13, color: AppTheme.accentCyan),
                            const SizedBox(width: 6),
                            Text(
                              'Test Mode: Switch to ${isOnline ? "OFFLINE (Memory Card)" : "ONLINE (Live Feed)"}',
                              style: const TextStyle(fontSize: 10, color: AppTheme.accentCyan, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Primary Action Button (Live feed if online, Playback if offline)
                    SizedBox(
                      width: double.infinity,
                      height: 44,
                      child: ElevatedButton.icon(
                        icon: Icon(
                          isOnline ? Icons.videocam_rounded : Icons.play_circle_filled_rounded,
                          size: 18,
                        ),
                        label: Text(
                          isOnline ? 'Watch Live Video Feed ▶' : 'View SD Card Memory Playback 💾',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isOnline ? AppTheme.accentCyan : const Color(0xFFF59E0B),
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 3,
                        ),
                        onPressed: () {
                          Navigator.pop(dialogCtx);
                          if (isOnline) {
                            context.go('/camera');
                          } else {
                            context.go('/playback');
                          }
                        },
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Secondary Action Button
                    SizedBox(
                      width: double.infinity,
                      height: 38,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.white.withOpacity(0.2)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.pop(dialogCtx);
                          if (isOnline) {
                            context.go('/playback');
                          } else {
                            context.go('/camera');
                          }
                        },
                        child: Text(
                          isOnline ? 'Go to SD Card Playback' : 'Go to Camera Live Screen',
                          style: const TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withOpacity(0.16),
                const Color(0xFF0D1322),
              ],
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.4), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withOpacity(0.3), width: 1),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: 0.2,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeviceListItem extends StatelessWidget {
  final DeviceItem device;
  final bool isSelected;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const _DeviceListItem({
    required this.device,
    this.isSelected = false,
    this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = device.isOnline
        ? AppTheme.statusOnline
        : device.isIdle
            ? AppTheme.statusWarning
            : AppTheme.statusOffline;

    final statusLabel = device.status;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isSelected
                  ? [
                      AppTheme.accentCyan.withOpacity(0.18),
                      const Color(0xFF10192A),
                    ]
                  : [
                      const Color(0xFF111827),
                      const Color(0xFF090D18),
                    ],
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected
                  ? AppTheme.accentCyan
                  : AppTheme.borderSubtle.withOpacity(0.7),
              width: isSelected ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: isSelected ? AppTheme.accentCyan.withOpacity(0.12) : Colors.black.withOpacity(0.25),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Status indicator icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusColor.withOpacity(0.4), width: 1.2),
                ),
                child: Icon(
                  device.isOnline ? Icons.videocam_rounded : Icons.videocam_off_rounded,
                  color: statusColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            device.plate,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : AppTheme.textPrimary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: statusColor.withOpacity(0.4), width: 0.8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: statusColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                statusLabel,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: statusColor,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: AppTheme.accentCyan.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'IMEI: ${device.terminalId}',
                            style: const TextStyle(
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w600,
                              color: AppTheme.accentCyan,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (device.speed > 0) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: AppTheme.accentGreen.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '\ mph',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.accentGreen,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            device.lastPing,
                            style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (isSelected)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: AppTheme.accentCyan,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_rounded, color: Colors.black, size: 12),
                      SizedBox(width: 2),
                      Text(
                        'ACTIVE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                        ),
                      ),
                    ],
                  ),
                )
              else
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: AppTheme.textMuted,
                ),
              if (onDelete != null) ...[
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 18),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: onDelete,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
