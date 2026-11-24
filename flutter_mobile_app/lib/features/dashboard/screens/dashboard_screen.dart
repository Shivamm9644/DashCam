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
import '../../../core/widgets/trackify_logo.dart';
import '../../profile/widgets/retailer_management_dialog.dart';
import '../../../main.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  String _selectedFilter = 'ALL';
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

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
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final dp = context.watch<DeviceProvider>();
    final user = auth.user;

    // SaaS Multi-Tenant Isolation: Filter fleet based on 3 distinct user roles
    final visibleVehicles = dash.devices.where((d) {
      if (user?.role == 'CUSTOMER') {
        final assigned = user?.assignedTerminals ?? [];
        if (assigned.isNotEmpty) {
          return assigned.contains(d.terminalId) || assigned.contains(d.id);
        }
        return d.terminalId == '505073729067' || d == dash.devices.first;
      }
      if (user?.role == 'RETAILER' || user?.role == 'ADMIN') {
        final assigned = user?.assignedTerminals ?? [];
        if (assigned.isNotEmpty) {
          return assigned.contains(d.terminalId) || assigned.contains(d.id);
        }
        final tName = (user?.tenantName ?? '').toLowerCase().trim();
        return tName.isNotEmpty && d.clientName.toLowerCase().trim() == tName;
      }
      if (dash.selectedClientFilter != 'ALL' && d.clientName != dash.selectedClientFilter) {
        return false;
      }
      return true;
    }).toList();

    final totalCount = visibleVehicles.length;
    final onlineCount = visibleVehicles.where((d) => d.isOnline).length;
    final idleCount = visibleVehicles.where((d) => d.isOnline && (d.isIdle || d.speed == 0)).length;
    final offlineCount = visibleVehicles.where((d) => !d.isOnline).length;
    final drivingCount = visibleVehicles.where((d) => d.isOnline && d.speed > 0).length;

    final mapDev = (dash.selectedDevice != null && visibleVehicles.any((d) => d.terminalId == dash.selectedDevice!.terminalId))
        ? dash.selectedDevice!
        : (visibleVehicles.isNotEmpty
            ? visibleVehicles.firstWhere((d) => d.isOnline, orElse: () => visibleVehicles.first)
            : null);

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: RefreshIndicator(
          color: AppTheme.accentSaffron,
          backgroundColor: AppTheme.bgCard,
          onRefresh: () async => await dash.loadDevicesFromDatabase(),
          child: CustomScrollView(
            slivers: [
            // Header
            SliverAppBar(
              pinned: true,
              toolbarHeight: 64,
              backgroundColor: Colors.white,
              elevation: 0,
              scrolledUnderElevation: 1,
              shadowColor: Colors.black.withOpacity(0.06),
              titleSpacing: 16,
              automaticallyImplyLeading: false,
              title: Row(
                children: [
                  // Left Menu Drawer Toggle Button
                  InkWell(
                    onTap: () => rootScaffoldKey.currentState?.openDrawer(),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Icon(
                        Icons.menu_rounded,
                        color: Color(0xFF0F172A),
                        size: 22,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Trackify DashCam Logo & Branding
                  const Expanded(
                    child: TrackifyLogo(size: 34),
                  ),
                ],
              ),
            ),

            // Content (Zero wasted top padding)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              sliver: SliverList(
                delegate: SliverChildListDelegate([

                  // 1. Commercial Fleet Status Summary Metric Strip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildFleetMetricChip(
                          label: 'All',
                          count: totalCount,
                          color: const Color(0xFF0284C7),
                          isActive: _selectedFilter == 'ALL',
                          onTap: () => setState(() => _selectedFilter = 'ALL'),
                        ),
                        _buildFleetMetricChip(
                          label: 'Online',
                          count: onlineCount,
                          color: const Color(0xFF10B981),
                          isActive: _selectedFilter == 'ONLINE',
                          onTap: () => setState(() => _selectedFilter = 'ONLINE'),
                        ),
                        _buildFleetMetricChip(
                          label: 'No GPS',
                          count: idleCount,
                          color: const Color(0xFFF59E0B),
                          isActive: _selectedFilter == 'IDLE',
                          onTap: () => setState(() => _selectedFilter = 'IDLE'),
                        ),
                        _buildFleetMetricChip(
                          label: 'Offline',
                          count: offlineCount,
                          color: const Color(0xFF64748B),
                          isActive: _selectedFilter == 'OFFLINE',
                          onTap: () => setState(() => _selectedFilter = 'OFFLINE'),
                        ),
                      ],
                    ),
                  ),

                  // 2. Live Fleet Map (Front and Center - Tap or Click to Expand)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.location_on_rounded, color: Color(0xFF0284C7), size: 18),
                          const SizedBox(width: 6),
                          Text(
                            onlineCount > 0
                                ? 'Live Fleet Map ($onlineCount Online)'
                                : 'Live Fleet Map (All Offline)',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      InkWell(
                        onTap: () {
                          final targetDev = mapDev;
                          if (targetDev != null) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => FullScreenTruckMapPage(
                                  lat: targetDev.lat != 0.0 ? targetDev.lat : 22.7339,
                                  lng: targetDev.lng != 0.0 ? targetDev.lng : 75.8615,
                                  heading: targetDev.heading.toDouble(),
                                  speedKmh: targetDev.speed.toDouble(),
                                  plate: targetDev.plate,
                                  status: targetDev.status,
                                  driver: (targetDev.driver.isNotEmpty && targetDev.driver != 'Assigned Driver') ? targetDev.driver : 'Unassigned',
                                  terminalId: targetDev.terminalId,
                                  onWatchLive: () {
                                    dp.selectServerDevice(targetDev.terminalId, targetDev.plate, isOnline: targetDev.isOnline);
                                    context.go('/camera');
                                  },
                                  onPlayback: () {
                                    dp.selectServerDevice(targetDev.terminalId, targetDev.plate, isOnline: targetDev.isOnline);
                                    context.go('/playback');
                                  },
                                ),
                              ),
                            );
                          }
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE0F2FE),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBAE6FD)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.fullscreen_rounded, color: Color(0xFF0284C7), size: 15),
                              SizedBox(width: 3),
                              Text(
                                'Fullscreen',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0284C7),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Builder(
                    builder: (ctx) {
                      final activeDev = mapDev;
                      final lat = (activeDev != null && activeDev.lat != 0.0) ? activeDev.lat : 22.7339;
                      final lng = (activeDev != null && activeDev.lng != 0.0) ? activeDev.lng : 75.8615;
                      final plate = activeDev?.plate ?? 'TRACKANYWHERE';
                      final status = activeDev?.status ?? 'OFFLINE';
                      final driver = (activeDev?.driver.isNotEmpty == true && activeDev!.driver != 'Assigned Driver') ? activeDev.driver : 'Unassigned';
                      final terminalId = activeDev?.terminalId ?? '';
                      final speed = (activeDev?.speed ?? 0).toDouble();

                      return LiveTruckMapView(
                        lat: lat,
                        lng: lng,
                        heading: (activeDev?.heading ?? 0).toDouble(),
                        speedKmh: speed,
                        plate: plate,
                        status: status,
                        driver: driver,
                        terminalId: terminalId,
                        height: 200,
                        onWatchLive: () {
                          if (activeDev != null) {
                            dp.selectServerDevice(activeDev.terminalId, activeDev.plate, isOnline: activeDev.isOnline);
                          }
                          context.go('/camera');
                        },
                        onPlayback: () {
                          if (activeDev != null) {
                            dp.selectServerDevice(activeDev.terminalId, activeDev.plate, isOnline: activeDev.isOnline);
                          }
                          context.go('/playback');
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Vehicle List with Self-Service Camera Assignment
                  SectionTitle(
                    title: 'Fleet Terminals',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (user?.role == 'SUPER_ADMIN') ...[
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
                                    'Add Device',
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
                        ],
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCardHover,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${visibleVehicles.length} Terminals',
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

                  // Search Bar
                  Container(
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Search vehicle plate or driver...',
                        hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                        prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppTheme.textMuted),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded, size: 16, color: AppTheme.textMuted),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // SaaS Multi-Tenant Client Header & Filter Strip
                  if (user?.role == 'CUSTOMER')
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Text('👤', style: TextStyle(fontSize: 16)),
                              const SizedBox(width: 8),
                              Text(
                                'Personal Vehicle (${user?.name ?? 'Customer'})',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF15803D),
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF86EFAC)),
                            ),
                            child: const Text(
                              'Retail Customer',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (user?.role == 'RETAILER' || user?.role == 'ADMIN')
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBAE6FD)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Text('🏢', style: TextStyle(fontSize: 16)),
                              const SizedBox(width: 8),
                              Text(
                                'Fleet: ${user?.tenantName} ($totalCount Dashcams)',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0284C7),
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFA7F3D0)),
                            ),
                            child: const Text(
                              'Fleet Admin',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                            ),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    // Client Accounts Strip for Master Admin
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'FILTER BY CLIENT ACCOUNT',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.textMuted,
                            letterSpacing: 0.8,
                          ),
                        ),
                        InkWell(
                          onTap: () => RetailerManagementSheet.show(context),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFBAE6FD)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.manage_accounts_rounded, size: 12, color: Color(0xFF0284C7)),
                                const SizedBox(width: 4),
                                Text(
                                  'SaaS Retailers (${auth.retailers.length})',
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: dash.clientList.map((client) {
                          final isSel = dash.selectedClientFilter == client;
                          final count = client == 'ALL'
                              ? dash.devices.length
                              : dash.devices.where((d) => d.clientName == client).length;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: InkWell(
                              onTap: () => dash.setClientFilter(client),
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: isSel ? AppTheme.accentTeal.withOpacity(0.2) : AppTheme.bgCard,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSel ? AppTheme.accentTeal : AppTheme.borderSubtle,
                                    width: isSel ? 1.5 : 1.0,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.business_rounded,
                                      size: 12,
                                      color: isSel ? AppTheme.accentTeal : AppTheme.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      client == 'ALL' ? 'All Clients ($count)' : '$client ($count)',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                                        color: isSel ? AppTheme.accentTeal : AppTheme.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),

                  // Status Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('ALL', 'All ($totalCount)'),
                        const SizedBox(width: 6),
                        _buildFilterChip('ONLINE', 'Online ($onlineCount)'),
                        const SizedBox(width: 6),
                        _buildFilterChip('DRIVING', 'Driving ($drivingCount)'),
                        const SizedBox(width: 6),
                        _buildFilterChip('IDLE', 'Idle ($idleCount)'),
                        const SizedBox(width: 6),
                        _buildFilterChip('OFFLINE', 'Offline ($offlineCount)'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Filtered Devices List (Multi-Tenant Isolated)
                  ...visibleVehicles.where((d) {
                    if (_selectedFilter == 'ONLINE' && !d.isOnline) return false;
                    if (_selectedFilter == 'DRIVING' && d.speed <= 0) return false;
                    if (_selectedFilter == 'IDLE' && (!d.isIdle && !(d.isOnline && d.speed == 0))) return false;
                    if (_selectedFilter == 'OFFLINE' && !d.isOffline) return false;
                    if (_searchQuery.isNotEmpty) {
                      final q = _searchQuery.toLowerCase();
                      final matchPlate = d.plate.toLowerCase().contains(q);
                      final matchDriver = d.driver.toLowerCase().contains(q);
                      final matchImei = d.terminalId.toLowerCase().contains(q);
                      final matchClient = d.clientName.toLowerCase().contains(q);
                      if (!matchPlate && !matchDriver && !matchImei && !matchClient) return false;
                    }
                    return true;
                  }).map((device) => _DeviceListItem(
                        device: device,
                        isSelected: dp.systemStatus.imei == device.terminalId,
                        onTap: () {
                          dash.selectDevice(device);
                          dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                        },
                        onWatchLive: () {
                          dash.selectDevice(device);
                          dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                          context.go('/camera');
                        },
                        onPlayback: () {
                          dash.selectDevice(device);
                          dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                          context.go('/playback');
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

                  const SizedBox(height: 32), // Content bottom padding
                ]),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildFleetMetricChip({
    required String label,
    required int count,
    required Color color,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? color.withOpacity(0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? color : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: isActive ? color : AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isActive ? color : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFilter == key;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = key),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accentSaffron : AppTheme.bgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppTheme.accentSaffron : AppTheme.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.black : AppTheme.textSecondary,
          ),
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
                style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace', fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Dashcam IMEI / Terminal ID',
                  labelStyle: const TextStyle(color: AppTheme.accentTeal, fontSize: 13),
                  hintText: 'Enter Dashcam IMEI / Terminal ID',
                  prefixIcon: const Icon(Icons.qr_code_scanner_rounded, color: AppTheme.accentTeal, size: 20),
                  suffixIcon: TextButton(
                    onPressed: () {
                      setSheetState(() => imeiController.clear());
                    },
                    child: const Text('Clear', style: TextStyle(fontSize: 11, color: AppTheme.accentTeal, fontWeight: FontWeight.bold)),
                  ),
                  filled: true,
                  fillColor: AppTheme.bgCardHover,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: plateController,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Vehicle Name / Number Plate',
                  labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  hintText: 'Enter Vehicle Name / Number Plate',
                  prefixIcon: const Icon(Icons.directions_car_rounded, color: AppTheme.textMuted, size: 20),
                  filled: true,
                  fillColor: AppTheme.bgCardHover,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: driverController,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Owner / Driver Name',
                  labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  hintText: 'e.g. Primary Owner',
                  prefixIcon: const Icon(Icons.person_outline_rounded, color: AppTheme.textMuted, size: 20),
                  filled: true,
                  fillColor: AppTheme.bgCardHover,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
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
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: Image.asset(
                            'assets/images/logo.png',
                            width: 26,
                            height: 26,
                            fit: BoxFit.contain,
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
                                '${(currentDev.plate.isNotEmpty && currentDev.plate != "null") ? currentDev.plate : "MP-09-HH-9067"} (IMEI: ${currentDev.terminalId})',
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
  final Color bgColor;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 2.5),
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 21),
              ),
              const SizedBox(height: 5),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                  letterSpacing: 0.1,
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
  final VoidCallback? onWatchLive;
  final VoidCallback? onPlayback;
  final VoidCallback? onDelete;

  const _DeviceListItem({
    required this.device,
    this.isSelected = false,
    this.onTap,
    this.onWatchLive,
    this.onPlayback,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    String displayClient = device.clientName;
    if (user?.role == 'RETAILER' && (user?.tenantName ?? '').isNotEmpty) {
      displayClient = user!.tenantName!;
    } else {
      for (final ret in auth.retailers) {
        if (ret.assignedTerminalIds.contains(device.terminalId) || ret.assignedTerminalIds.contains(device.id)) {
          displayClient = ret.companyName;
          break;
        }
      }
    }

    final hasGps = device.lat != 0.0 && device.lng != 0.0;
    final isOnline = device.isOnline;

    Color statusColor;
    String statusLabel;
    if (isOnline) {
      if (!hasGps) {
        statusColor = const Color(0xFFF59E0B); // Amber
        statusLabel = 'ONLINE • NO GPS';
      } else if (device.speed > 0) {
        statusColor = AppTheme.accentTeal;
        statusLabel = 'MOVING ${device.speed.round()} KM/H';
      } else {
        statusColor = AppTheme.accentGreen;
        statusLabel = 'ONLINE • LIVE';
      }
    } else {
      statusColor = AppTheme.statusOffline;
      statusLabel = 'OFFLINE';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFF0F9FF) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFE2E8F0),
          width: isSelected ? 1.8 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isSelected ? const Color(0xFF0284C7).withOpacity(0.12) : Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Tier 1: HSRP Indian Plate & Status Badge ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // HSRP Plate Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: const Color(0xFF1E293B),
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF003399),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: const Text(
                              'IND',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: Text(
                              device.plate,
                              style: const TextStyle(
                                color: Colors.black,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.0,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Status Badge Chip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusColor.withOpacity(0.5), width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: statusColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            statusLabel,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // ── Tier 2: Driver & Dashcam Hardware Model ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(
                            Icons.person_rounded,
                            size: 15,
                            color: Color(0xFF0284C7),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              (device.driver.isNotEmpty && !device.driver.contains('Desk Test') && device.driver != 'Assigned Driver') ? device.driver : 'Unassigned',
                              style: const TextStyle(
                                color: AppTheme.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Text(
                        device.deviceModel.isNotEmpty ? device.deviceModel : 'MDVR',
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // ── Tier 3: Terminal IMEI & GPS Satellite Status ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.memory_rounded, size: 13, color: AppTheme.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          'IMEI: ${device.terminalId}',
                          style: const TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          hasGps ? Icons.satellite_alt_rounded : Icons.satellite_rounded,
                          size: 13,
                          color: hasGps ? AppTheme.accentGreen : const Color(0xFFF59E0B),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          hasGps
                              ? '${device.lat.toStringAsFixed(3)}°N, ${device.lng.toStringAsFixed(3)}°E'
                              : 'No GPS fix',
                          style: TextStyle(
                            color: hasGps ? AppTheme.accentGreen : const Color(0xFFF59E0B),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // ── Tier 3.5: Client Account & Subscription Days Remaining ──
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCardHover,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.borderSubtle),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.business_rounded, size: 14, color: AppTheme.accentTeal),
                              const SizedBox(width: 5),
                              Text(
                                displayClient,
                                style: const TextStyle(
                                  color: AppTheme.textPrimary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: (device.daysRemaining > 30
                                      ? AppTheme.accentGreen
                                      : (device.daysRemaining > 0 ? AppTheme.accentOrange : AppTheme.statusCritical))
                                  .withOpacity(0.16),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: (device.daysRemaining > 30
                                        ? AppTheme.accentGreen
                                        : (device.daysRemaining > 0 ? AppTheme.accentOrange : AppTheme.statusCritical))
                                    .withOpacity(0.4),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  device.daysRemaining > 30
                                      ? Icons.timer_rounded
                                      : (device.daysRemaining > 0 ? Icons.warning_amber_rounded : Icons.cancel_rounded),
                                  size: 11,
                                  color: device.daysRemaining > 30
                                      ? AppTheme.accentGreen
                                      : (device.daysRemaining > 0 ? AppTheme.accentOrange : AppTheme.statusCritical),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${device.daysRemaining}d left (Exp: ${device.formattedExpiry})',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: device.daysRemaining > 30
                                        ? AppTheme.accentGreen
                                        : (device.daysRemaining > 0 ? AppTheme.accentOrange : AppTheme.statusCritical),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      // Mini Progress Bar of 365 Days
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: (1.0 - device.subscriptionProgress).clamp(0.0, 1.0),
                          minHeight: 3,
                          backgroundColor: AppTheme.borderSubtle,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            device.daysRemaining > 30
                                ? AppTheme.accentGreen
                                : (device.daysRemaining > 0 ? AppTheme.accentOrange : AppTheme.statusCritical),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Tier 4: Direct Action Buttons (Always Visible for Non-Tech Users) ──
                const SizedBox(height: 12),
                const Divider(height: 1, color: AppTheme.borderSubtle),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      flex: 6,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isOnline ? const Color(0xFF0284C7) : const Color(0xFF0D9488).withOpacity(0.12),
                          foregroundColor: isOnline ? Colors.white : const Color(0xFF0D9488),
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          elevation: isOnline ? 1 : 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        ),
                        onPressed: onWatchLive,
                        icon: Icon(
                          Icons.videocam_rounded,
                          size: 17,
                          color: isOnline ? Colors.white : const Color(0xFF0D9488),
                        ),
                        label: Text(
                          isOnline ? 'Watch Live' : 'Live (AP)',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                            color: isOnline ? Colors.white : const Color(0xFF0D9488),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 5,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.textPrimary,
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        ),
                        onPressed: onPlayback,
                        icon: const Icon(Icons.history_rounded, size: 16, color: Color(0xFF0284C7)),
                        label: const Text(
                          'Playback',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        ),
                      ),
                    ),
                    if (onDelete != null) ...[
                      const SizedBox(width: 6),
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                        onPressed: onDelete,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
