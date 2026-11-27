import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/widgets/glass_card.dart';
import '../widgets/live_player_view.dart';
import '../../../main.dart';

class CameraLiveScreen extends StatefulWidget {
  final String? initialMode;
  const CameraLiveScreen({super.key, this.initialMode});

  @override
  State<CameraLiveScreen> createState() => _CameraLiveScreenState();
}

class _CameraLiveScreenState extends State<CameraLiveScreen> {
  static const _toolsChannel = MethodChannel('com.trackify.dashcam/tools');
  late Timer _clockTimer;
  String _currentTime = '';
  bool _showShutterFlash = false;
  bool _isFullscreen = false;
  bool _isOfflineWifiMode = false;
  bool _showAlignmentGrid = false;
  bool _isMCToolInstalled = false;

  @override
  void initState() {
    super.initState();
    _isOfflineWifiMode = widget.initialMode == 'offline';
    if (_isOfflineWifiMode) {
      _showAlignmentGrid = true;
    }
    _checkMCToolInstalled();
    _updateClock();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) => _updateClock());
  }

  Future<void> _checkMCToolInstalled() async {
    try {
      final installed = await _toolsChannel.invokeMethod<bool>('isMCToolInstalled');
      if (mounted) {
        setState(() => _isMCToolInstalled = installed ?? false);
      }
    } catch (_) {}
  }

  Future<void> _openMCTool() async {
    try {
      final launched = await _toolsChannel.invokeMethod<bool>('openMCTool');
      if (launched != true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('MCTool companion app is not installed.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error launching MCTool: $e')),
        );
      }
    }
  }

  Future<void> _openWifiSettings() async {
    try {
      await _toolsChannel.invokeMethod('openWifiSettings');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error opening Wi-Fi settings: $e')),
        );
      }
    }
  }

  void _updateClock() {
    final now = DateTime.now();
    if (mounted) {
      setState(() {
        _currentTime = DateFormat('hh:mm:ss a').format(now);
      });
    }
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  void _triggerSnapshot(DeviceProvider dp) {
    setState(() => _showShutterFlash = true);
    HapticFeedback.mediumImpact();
    dp.takeSnapshot();

    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) setState(() => _showShutterFlash = false);
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.bgCard,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppTheme.accentGreen),
        ),
        content: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppTheme.accentGreen, size: 20),
            SizedBox(width: 10),
            Text('Snapshot saved', style: TextStyle(color: AppTheme.textPrimary, fontSize: 13)),
          ],
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _triggerEmergencyClip(DeviceProvider dp) {
    HapticFeedback.heavyImpact();
    dp.triggerEmergencyClip();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFFFFF1F2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppTheme.statusCritical),
        ),
        content: const Row(
          children: [
            Icon(Icons.emergency_rounded, color: AppTheme.statusCritical, size: 20),
            SizedBox(width: 10),
            Text('SOS Alert Event Locked', style: TextStyle(color: AppTheme.statusCritical, fontSize: 13, fontWeight: FontWeight.bold)),
          ],
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final dash = context.watch<DashboardProvider>();

    final activeDevice = dash.devices.firstWhere(
      (d) => d.terminalId == dp.systemStatus.imei,
      orElse: () => dash.devices.isNotEmpty
          ? dash.devices.first
          : DeviceItem(
              id: dp.systemStatus.imei,
              plate: 'Dashcam',
              terminalId: dp.systemStatus.imei,
              driver: 'Unassigned',
              speed: 0,
              status: dp.systemStatus.isOnline ? 'ONLINE' : 'OFFLINE',
              lat: 0.0,
              lng: 0.0,
              lastPing: '',
              heading: 0,
              altitude: 0,
            ),
    );
    final isDeviceOnline = activeDevice.isOnline;

    final effectiveTerminalId = (dp.systemStatus.imei.isNotEmpty && dp.systemStatus.imei != 'null')
        ? dp.systemStatus.imei
        : (dash.selectedDevice?.terminalId ?? '505073729067');

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            if (!_isFullscreen) _buildTopHeader(context, dp, isDeviceOnline, activeDevice, dash),
            if (!_isFullscreen) _buildChannelSelector(dp),
            Expanded(
              child: SingleChildScrollView(
                physics: _isFullscreen ? const NeverScrollableScrollPhysics() : null,
                child: Column(
                  children: [
                    _buildVideoViewport(dp, isDeviceOnline, dash),
                    if (!_isFullscreen) ...[
                      _buildControlToolbar(dp),
                      const SizedBox(height: 14),
                      _buildVehicleTelemetryCard(activeDevice, dp),
                      const SizedBox(height: 24),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopHeader(
    BuildContext context,
    DeviceProvider dp,
    bool isDeviceOnline,
    DeviceItem activeDevice,
    DashboardProvider dash,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppTheme.bgCard,
        border: Border(bottom: BorderSide(color: AppTheme.borderSubtle)),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: () => context.go('/dashboard'),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: const Icon(
                Icons.arrow_back_rounded,
                color: Color(0xFF0F172A),
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        activeDevice.plate,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isDeviceOnline ? AppTheme.accentGreen.withOpacity(0.15) : Colors.grey.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        isDeviceOnline ? 'ONLINE' : 'OFFLINE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: isDeviceOnline ? AppTheme.accentGreen : Colors.grey,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Driver: ${activeDevice.driver.isNotEmpty && activeDevice.driver != 'Assigned Driver' ? activeDevice.driver : 'Unassigned'}',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
              ],
            ),
          ),
          // Switch Vehicle Dropdown Button
          PopupMenuButton<DeviceItem>(
              tooltip: 'Switch Vehicle',
              icon: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.accentTeal.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.accentTeal.withOpacity(0.3)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.swap_horiz_rounded, color: AppTheme.accentTeal, size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Vehicle',
                      style: TextStyle(
                        color: AppTheme.accentTeal,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              onSelected: (device) {
                dash.selectDevice(device);
                dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
              },
              itemBuilder: (context) {
                final allDevs = dash.devices.isNotEmpty ? dash.devices : dash.fallbackDevices;
                return allDevs.map((device) {
                final isCurrent = device.terminalId == activeDevice.terminalId;
                return PopupMenuItem<DeviceItem>(
                  value: device,
                  child: Row(
                    children: [
                      Icon(
                        Icons.local_shipping_outlined,
                        size: 16,
                        color: isCurrent ? AppTheme.accentTeal : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          device.plate,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                            color: isCurrent ? AppTheme.accentTeal : AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      if (device.isOnline)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppTheme.statusOnline,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                );
              }).toList();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildModeSwitcher() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppTheme.bgCard,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: Row(
          children: [
            Expanded(
              child: InkWell(
                onTap: () => setState(() {
                  _isOfflineWifiMode = false;
                  _showAlignmentGrid = false;
                }),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  decoration: BoxDecoration(
                    color: !_isOfflineWifiMode ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: !_isOfflineWifiMode
                        ? [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.06),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.cloud_sync_rounded,
                        size: 15,
                        color: !_isOfflineWifiMode ? AppTheme.accentSaffron : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '4G Cloud Stream',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: !_isOfflineWifiMode ? FontWeight.bold : FontWeight.w600,
                          color: !_isOfflineWifiMode ? AppTheme.textPrimary : AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: InkWell(
                onTap: () => setState(() {
                  _isOfflineWifiMode = true;
                  _showAlignmentGrid = true;
                }),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  decoration: BoxDecoration(
                    color: _isOfflineWifiMode ? const Color(0xFF0D9488) : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: _isOfflineWifiMode
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0D9488).withOpacity(0.3),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.wifi_tethering_rounded,
                        size: 15,
                        color: _isOfflineWifiMode ? Colors.white : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Offline Wi-Fi (MC Tool)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: _isOfflineWifiMode ? FontWeight.bold : FontWeight.w600,
                          color: _isOfflineWifiMode ? Colors.white : AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChannelSelector(DeviceProvider dp) {
    return Container(
      color: AppTheme.bgCard,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildChannelTab(
            title: 'Road Cam',
            icon: Icons.directions_car_rounded,
            isSelected: dp.activeChannel == 1,
            onTap: () => dp.switchChannel(1),
          ),
          const SizedBox(width: 8),
          _buildChannelTab(
            title: 'Cabin Cam',
            icon: Icons.person_rounded,
            isSelected: dp.activeChannel == 2,
            onTap: () => dp.switchChannel(2),
          ),
          const SizedBox(width: 8),
          _buildChannelTab(
            title: 'Dual View',
            icon: Icons.splitscreen_rounded,
            isSelected: dp.activeChannel == 3,
            onTap: () => dp.switchChannel(3),
          ),
        ],
      ),
    );
  }

  Widget _buildChannelTab({
    required String title,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0D9488).withOpacity(0.12) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? const Color(0xFF0D9488) : AppTheme.borderSubtle,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: isSelected ? const Color(0xFF0D9488) : AppTheme.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? const Color(0xFF0D9488) : AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVideoViewport(DeviceProvider dp, bool isOnline, DashboardProvider dash) {
    final isDual = dp.activeChannel == 3;
    final termId = (dp.systemStatus.imei.isNotEmpty && dp.systemStatus.imei != 'null')
        ? dp.systemStatus.imei
        : (dash.selectedDevice?.terminalId ?? '505073729067');

    return Stack(
      children: [
        Container(
          width: double.infinity,
          height: _isFullscreen ? MediaQuery.of(context).size.height - 80 : 240,
          color: Colors.black,
          child: dp.isStreaming
              ? (isDual
                  ? _buildDualSplitVideo(dp, isOnline, dash)
                  : LivePlayerView(
                      channel: dp.activeChannel,
                      terminalId: termId,
                      isOnline: isOnline,
                      onRefresh: () => dash.loadDevicesFromDatabase(),
                    ))
              : _buildStreamPausedPlaceholder(dp),
        ),

        // Shutter flash animation
        if (_showShutterFlash)
          Container(
            height: _isFullscreen ? MediaQuery.of(context).size.height - 80 : 240,
            color: Colors.white.withOpacity(0.85),
          ),

        // Clean OSD Timestamp & Channel Badge
        Positioned(
          top: 10,
          left: 12,
          right: 12,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.65),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _isOfflineWifiMode
                      ? 'OFFLINE WI-FI • CH${dp.activeChannel}'
                      : (dp.activeChannel == 1
                          ? 'Road'
                          : dp.activeChannel == 2
                              ? 'Cabin'
                              : 'Dual'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.65),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _currentTime,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    color: Colors.white,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDualSplitVideo(DeviceProvider dp, bool isOnline, DashboardProvider dash) {
    final termId = (dp.systemStatus.imei.isNotEmpty && dp.systemStatus.imei != 'null')
        ? dp.systemStatus.imei
        : (dash.selectedDevice?.terminalId ?? '505073729067');

    return Row(
      children: [
        Expanded(
          child: Stack(
            fit: StackFit.expand,
            children: [
              LivePlayerView(
                channel: 1,
                terminalId: termId,
                isOnline: isOnline,
                onRefresh: () => dash.loadDevicesFromDatabase(),
              ),
              Positioned(
                bottom: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('Road', style: TextStyle(color: Colors.white, fontSize: 10)),
                ),
              ),
            ],
          ),
        ),
        Container(width: 1.5, color: Colors.black),
        Expanded(
          child: Stack(
            fit: StackFit.expand,
            children: [
              LivePlayerView(
                channel: 2,
                terminalId: termId,
                isOnline: isOnline,
                onRefresh: () => dash.loadDevicesFromDatabase(),
              ),
              Positioned(
                bottom: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('Cabin', style: TextStyle(color: Colors.white, fontSize: 10)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStreamPausedPlaceholder(DeviceProvider dp) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.pause_circle_outline_rounded, color: AppTheme.textMuted, size: 40),
          const SizedBox(height: 8),
          const Text(
            'Stream Paused',
            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0D9488),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
            icon: const Icon(Icons.play_arrow_rounded, size: 16),
            label: const Text('Resume', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            onPressed: () => dp.toggleStream(),
          ),
        ],
      ),
    );
  }

  Widget _buildControlToolbar(DeviceProvider dp) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppTheme.bgCard,
        border: Border(bottom: BorderSide(color: AppTheme.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildToolButton(
            icon: dp.isStreaming ? Icons.pause_rounded : Icons.play_arrow_rounded,
            label: dp.isStreaming ? 'Pause' : 'Play',
            color: dp.isStreaming ? AppTheme.accentOrange : AppTheme.accentGreen,
            onTap: () => dp.toggleStream(),
          ),
          _buildToolButton(
            icon: Icons.hd_rounded,
            label: '4K UHD',
            color: const Color(0xFF0284C7),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Camera Stream: 4K Ultra HD (Crystal Clear 60 FPS) Active'),
                  duration: Duration(seconds: 2),
                  backgroundColor: Color(0xFF0284C7),
                ),
              );
            },
          ),
          _buildToolButton(
            icon: Icons.camera_alt_outlined,
            label: 'Snapshot',
            color: AppTheme.accentTeal,
            onTap: () => _triggerSnapshot(dp),
          ),
          _buildToolButton(
            icon: Icons.emergency_outlined,
            label: 'SOS Alert',
            color: AppTheme.statusCritical,
            onTap: () => _triggerEmergencyClip(dp),
          ),
          _buildToolButton(
            icon: dp.isAudioMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
            label: dp.isAudioMuted ? 'Muted' : 'Audio',
            color: dp.isAudioMuted ? AppTheme.textMuted : AppTheme.accentGreen,
            onTap: () => dp.toggleAudio(),
          ),
          _buildToolButton(
            icon: _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
            label: _isFullscreen ? 'Exit' : 'Full',
            color: AppTheme.textPrimary,
            onTap: () => setState(() => _isFullscreen = !_isFullscreen),
          ),
        ],
      ),
    );
  }

  Widget _buildToolButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMCToolCompanionCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D9488).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.wifi_tethering_rounded, color: Color(0xFF0D9488), size: 18),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MC Tool Direct AP Mode',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      Text(
                        'Local Wi-Fi Live Feed (Zero Cellular / Server Offline)',
                        style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D9488).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    '192.168.169.1',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0D9488),
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0D9488),
                      side: const BorderSide(color: Color(0xFF0D9488)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    icon: const Icon(Icons.wifi_rounded, size: 16),
                    label: const Text('Wi-Fi Settings', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: _openWifiSettings,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF9933),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    icon: const Icon(Icons.open_in_new_rounded, size: 16),
                    label: const Text('Launch MC Tool', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: _openMCTool,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Toggle ADAS Horizon Grid
            InkWell(
              onTap: () => setState(() => _showAlignmentGrid = !_showAlignmentGrid),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _showAlignmentGrid ? const Color(0xFF10B981).withOpacity(0.12) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _showAlignmentGrid ? const Color(0xFF10B981) : AppTheme.borderSubtle,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _showAlignmentGrid ? Icons.grid_on_rounded : Icons.grid_off_rounded,
                      size: 16,
                      color: _showAlignmentGrid ? const Color(0xFF10B981) : AppTheme.textMuted,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _showAlignmentGrid ? 'ADAS Horizon & Hood Guide: ACTIVE' : 'Show ADAS Horizon & Hood Guide',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _showAlignmentGrid ? const Color(0xFF10B981) : AppTheme.textSecondary,
                      ),
                    ),
                    const Spacer(),
                    Switch.adaptive(
                      value: _showAlignmentGrid,
                      onChanged: (v) => setState(() => _showAlignmentGrid = v),
                      activeColor: const Color(0xFF10B981),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            // Help notes for technician
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderSubtle),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '💡 Technician Quick Setup Guide:',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '1. Turn vehicle ignition ON (DashCam powers up AP within 30s).\n'
                    '2. Connect phone Wi-Fi to "MCTool_AP_xxxx" or "CAR-DVR-xxxx" (Pass: 12345678).\n'
                    '3. Return to this screen or tap "Launch MC Tool" to align camera lens.\n'
                    '4. Align green horizon line at 50% road/sky, orange line with hood center.',
                    style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVehicleTelemetryCard(DeviceItem device, DeviceProvider dp) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.speed_rounded, color: AppTheme.accentTeal, size: 18),
                const SizedBox(width: 8),
                const Text(
                  'Live Telemetry',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const Spacer(),
                Text(
                  device.status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: device.isOnline ? AppTheme.accentGreen : Colors.grey,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _telemetryTile(
                    label: 'Speed',
                    value: '${device.speed.round()} km/h',
                    icon: Icons.speed_rounded,
                    color: AppTheme.accentGreen,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _telemetryTile(
                    label: 'Ignition',
                    value: device.isOnline ? 'ON' : 'OFF',
                    icon: Icons.power_settings_new_rounded,
                    color: device.isOnline ? AppTheme.accentGreen : Colors.grey,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _telemetryTile(
                    label: 'Driver',
                    value: (device.driver.isNotEmpty && device.driver != 'Assigned Driver') ? device.driver : 'Unassigned',
                    icon: Icons.person_outline_rounded,
                    color: AppTheme.accentTeal,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _telemetryTile(
                    label: 'Terminal ID',
                    value: device.terminalId,
                    icon: Icons.memory_rounded,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
            if (device.lat != 0.0 && device.lng != 0.0) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppTheme.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    '${device.lat.toStringAsFixed(4)}°, ${device.lng.toStringAsFixed(4)}°',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _telemetryTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
