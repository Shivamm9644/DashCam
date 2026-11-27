import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/widgets/trackify_logo.dart';
import '../../../core/widgets/google_truck_map_view.dart';
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
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 400),
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
    final dash = context.watch<DashboardProvider>();
    final dp = context.watch<DeviceProvider>();

    // Single source of truth: authoritative devices list from server
    final allDevices = dash.devices.isNotEmpty ? dash.devices : dash.fallbackDevices;

    // Filter devices based on user's search query
    final filteredDevices = allDevices.where((d) {
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return d.plate.toLowerCase().contains(q) ||
          d.terminalId.toLowerCase().contains(q) ||
          d.driver.toLowerCase().contains(q);
    }).toList();

    final activeDev = filteredDevices.isNotEmpty
        ? (dash.selectedDevice != null && filteredDevices.contains(dash.selectedDevice)
            ? dash.selectedDevice!
            : filteredDevices.first)
        : (allDevices.isNotEmpty ? allDevices.first : null);

    final String plate = activeDev?.plate ?? 'CBL-01';
    final String terminalId = activeDev?.terminalId ?? '505073729067';
    final bool isOnline = activeDev?.isOnline ?? false;
    final double speed = (activeDev?.speed ?? 0).toDouble();
    final double lat = (activeDev != null && activeDev.lat != 0.0) ? activeDev.lat : 38.9072;
    final double lng = (activeDev != null && activeDev.lng != 0.0) ? activeDev.lng : -77.0369;
    final double heading = (activeDev?.heading ?? 0).toDouble();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: RefreshIndicator(
          color: const Color(0xFF0284C7),
          backgroundColor: Colors.white,
          onRefresh: () async => await dash.loadDevicesFromDatabase(),
          child: CustomScrollView(
            slivers: [
              // 1. Top AppBar (Drawer Button & GBT Dashcam Logo)
              SliverAppBar(
                pinned: true,
                toolbarHeight: 60,
                backgroundColor: Colors.white,
                elevation: 0,
                scrolledUnderElevation: 1,
                titleSpacing: 16,
                automaticallyImplyLeading: false,
                title: Row(
                  children: [
                    InkWell(
                      onTap: () => rootScaffoldKey.currentState?.openDrawer(),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Icon(
                          Icons.menu_rounded,
                          color: Color(0xFF0F172A),
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: TrackifyLogo(size: 32),
                    ),
                  ],
                ),
              ),

              // 2. Content Body
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([

                    // SEARCH BAR AT THE VERY TOP (User Requirement: "search wala uppar rahe")
                    Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (val) => setState(() => _searchQuery = val.trim()),
                        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                        decoration: InputDecoration(
                          hintText: 'Search Dashcam by plate or terminal ID...',
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                          prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF0284C7)),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF94A3B8)),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    setState(() => _searchQuery = '');
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // LIVE GOOGLE MAP (Embedded Native Google Map)
                    GoogleTruckMapView(
                      lat: lat,
                      lng: lng,
                      heading: heading,
                      speedKmh: speed,
                      plate: plate,
                      status: isOnline ? 'ONLINE' : 'OFFLINE',
                      driver: activeDev?.driver ?? 'Driver',
                      terminalId: terminalId,
                      height: 190,
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
                    ),
                    const SizedBox(height: 16),

                    // EXPLORE MORE: 3 Clean Dashcam Actions Only (Fleet map removed as requested)
                    const Padding(
                      padding: EdgeInsets.only(left: 4, bottom: 10),
                      child: Text(
                        'Explore More',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: _buildActionCard(
                            label: 'Live Camera',
                            sub: 'Dual Stream',
                            icon: Icons.videocam_rounded,
                            iconColor: const Color(0xFF0284C7),
                            bgColor: const Color(0xFFE0F2FE),
                            onTap: () {
                              if (activeDev != null) {
                                dp.selectServerDevice(activeDev.terminalId, activeDev.plate, isOnline: activeDev.isOnline);
                              }
                              context.go('/camera');
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildActionCard(
                            label: 'SD Playback',
                            sub: 'Footage',
                            icon: Icons.play_circle_fill_rounded,
                            iconColor: const Color(0xFF8B5CF6),
                            bgColor: const Color(0xFFEDE9FE),
                            onTap: () {
                              if (activeDev != null) {
                                dp.selectServerDevice(activeDev.terminalId, activeDev.plate, isOnline: activeDev.isOnline);
                              }
                              context.go('/playback');
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildActionCard(
                            label: 'ADAS Alerts',
                            sub: 'Safety',
                            icon: Icons.notifications_active_rounded,
                            iconColor: const Color(0xFFEA580C),
                            bgColor: const Color(0xFFFFEDD5),
                            onTap: () => context.go('/events'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // ALL DASHCAM HEADER & DEVICE CARD
                    // User Requirement: "MYgrage mein ko naam change akrke all DasCam aur search ka bi option rahna chaiye"
                    // User Requirement: "aur device dekhe aur usko touch karo toh turant live feed open hona chaiye"
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'All DashCam',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE0F2FE),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${filteredDevices.length} Connected',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0284C7),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // DEVICE LIST (Touch to IMMEDIATELY open LIVE FEED)
                    if (filteredDevices.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(24),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Text(
                          'No Dashcam matching your search',
                          style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      )
                    else
                      ...filteredDevices.map((dev) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Material(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            elevation: 0,
                            child: InkWell(
                              // USER REQUIREMENT: "aur device dekhe aur usko touch karo toh turant live feed open hona chaiye"
                              onTap: () {
                                dp.selectServerDevice(dev.terminalId, dev.plate, isOnline: dev.isOnline);
                                dash.selectDevice(dev);
                                context.go('/camera');
                              },
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.04),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    // Live Camera Thumbnail / Avatar Icon
                                    Stack(
                                      children: [
                                        Container(
                                          width: 52,
                                          height: 52,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF0284C7).withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(14),
                                            border: Border.all(color: const Color(0xFF0284C7).withOpacity(0.3)),
                                          ),
                                          child: const Icon(
                                            Icons.videocam_rounded,
                                            color: Color(0xFF0284C7),
                                            size: 28,
                                          ),
                                        ),
                                        Positioned(
                                          right: 2,
                                          bottom: 2,
                                          child: Container(
                                            width: 12,
                                            height: 12,
                                            decoration: BoxDecoration(
                                              color: dev.isOnline ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                                              shape: BoxShape.circle,
                                              border: Border.all(color: Colors.white, width: 2),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(width: 14),

                                    // Device Details
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                dev.plate,
                                                style: const TextStyle(
                                                  fontSize: 17,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF0F172A),
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: dev.isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                                  borderRadius: BorderRadius.circular(6),
                                                  border: Border.all(
                                                    color: dev.isOnline ? const Color(0xFF86EFAC) : const Color(0xFFCBD5E1),
                                                  ),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Container(
                                                      width: 6,
                                                      height: 6,
                                                      decoration: BoxDecoration(
                                                        shape: BoxShape.circle,
                                                        color: dev.isOnline ? const Color(0xFF16A34A) : const Color(0xFF94A3B8),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      dev.isOnline ? 'ONLINE' : 'OFFLINE',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w900,
                                                        color: dev.isOnline ? const Color(0xFF15803D) : const Color(0xFF64748B),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'Terminal ID: ${dev.terminalId} • ${dev.deviceModel}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                              color: Color(0xFF64748B),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Icon(
                                      Icons.arrow_forward_ios_rounded,
                                      size: 16,
                                      color: Color(0xFF0284C7),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      }),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionCard({
    required String label,
    required String sub,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 1),
            Text(
              sub,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: iconColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
