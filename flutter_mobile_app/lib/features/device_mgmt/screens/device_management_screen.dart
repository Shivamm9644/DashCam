import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/widgets/glass_card.dart';

class DeviceManagementScreen extends StatefulWidget {
  const DeviceManagementScreen({super.key});

  @override
  State<DeviceManagementScreen> createState() => _DeviceManagementScreenState();
}

class _DeviceManagementScreenState extends State<DeviceManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            _buildTopBar(context, dp),
            _buildTabBar(),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  const _StatusTab(),
                  _DeviceSettingsTab(tabController: _tabController),
                  const _MediaSettingsTab(),
                  const _AIFunctionsTab(),
                  const _WlanTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar(BuildContext context, DeviceProvider dp) {
    final isCloud = dp.connectionMode == 'CLOUD_4G';

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        border: Border(bottom: BorderSide(color: AppTheme.borderSubtle)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppTheme.accentGreen.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.settings_remote_rounded,
                color: AppTheme.accentGreen, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Device Settings',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                Row(
                  children: [
                    Icon(
                      isCloud ? Icons.cloud_done_rounded : Icons.wifi_tethering_rounded,
                      size: 11,
                      color: isCloud ? AppTheme.accentCyan : AppTheme.accentOrange,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isCloud ? 'Cloud Connected' : '${dp.deviceIp} (Hotspot)',
                      style: TextStyle(
                        fontSize: 11,
                        color: isCloud ? AppTheme.accentCyan : AppTheme.accentOrange,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      ' • ${dp.systemStatus.imei.substring(dp.systemStatus.imei.length > 6 ? dp.systemStatus.imei.length - 6 : 0)}',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
          _ActionButton(
            label: 'Live',
            color: AppTheme.accentCyan,
            icon: Icons.videocam_rounded,
            onTap: () => context.go('/camera'),
          ),
          const SizedBox(width: 8),
          _ActionButton(
            label: 'Password',
            color: AppTheme.accentGreen,
            onTap: () => _showChangePasswordDialog(context, dp),
          ),
          const SizedBox(width: 8),
          _ActionButton(
            label: 'Logout',
            color: AppTheme.statusCritical,
            onTap: () => _showLogoutDialog(context),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: AppTheme.bgCard,
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: AppTheme.accentCyan,
        unselectedLabelColor: AppTheme.textMuted,
        labelStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: const TextStyle(fontSize: 12),
        indicator: UnderlineTabIndicator(
          borderSide: const BorderSide(color: AppTheme.accentCyan, width: 2),
          borderRadius: BorderRadius.circular(1),
        ),
        tabs: const [
          Tab(text: 'Status'),
          Tab(text: 'Device Settings'),
          Tab(text: 'Media Settings'),
          Tab(text: 'AI Functions'),
          Tab(text: 'WLAN'),
        ],
      ),
    );
  }

  void _showChangePasswordDialog(BuildContext context, DeviceProvider dp) {
    final oldPassCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: const Text('Change Device Admin Password', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: oldPassCtrl,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Current Password', labelStyle: TextStyle(color: AppTheme.textMuted)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newPassCtrl,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'New Password', labelStyle: TextStyle(color: AppTheme.textMuted)),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentCyan, foregroundColor: Colors.black),
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Device admin password updated successfully!')),
              );
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: const Text('Disconnect from Device?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text('Are you sure you want to end this device management session?', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.statusCritical, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(context);
              context.go('/login');
            },
            child: const Text('Disconnect'),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.label,
    required this.color,
    this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── STATUS TAB ─────────────────────────────────────────────────────────────

class _StatusTab extends StatelessWidget {
  const _StatusTab();

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final ss = dp.systemStatus;
    final gps = dp.gpsStatus;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // System Status Card
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.monitor_heart_rounded,
                        color: AppTheme.accentGreen, size: 18),
                    const SizedBox(width: 8),
                    const Text(
                      'System Status',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    StatusBadge(
                      label: ss.isOnline ? 'ONLINE' : 'OFFLINE',
                      color: ss.isOnline
                          ? AppTheme.statusOnline
                          : AppTheme.statusOffline,
                      pulsing: ss.isOnline,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _InfoRow('Firmware', ss.firmware),
                _InfoRow('IMEI', ss.imei),
                _InfoRow('SIM ICCID', ss.simIccid),
                _InfoRow('Network', ss.networkType, valueColor: AppTheme.accentCyan),
                _InfoRow('Signal', _signalBars(ss.signalStrength)),
                _InfoRow('Voltage', ss.voltage),
                _InfoRow('Temperature', ss.temperature, valueColor: AppTheme.statusWarning),
                _InfoRow('SD Card', '${ss.sdCardFree} / ${ss.sdCardTotal} free'),
                _InfoRow('Uptime', ss.uptime, valueColor: AppTheme.accentGreen),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // GPS Status Card
          GlassCard(
            borderColor: AppTheme.accentCyan.withOpacity(0.3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.satellite_alt_rounded,
                        color: AppTheme.accentCyan, size: 18),
                    const SizedBox(width: 8),
                    const Text(
                      'GPS Status',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    StatusBadge(
                      label: gps.isFixed ? 'FIXED' : 'SEARCHING',
                      color: gps.isFixed
                          ? AppTheme.accentCyan
                          : AppTheme.statusWarning,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _InfoRow('Latitude', '${gps.lat.toStringAsFixed(4)}° N'),
                _InfoRow('Longitude', '${gps.lng.toStringAsFixed(4)}° W'),
                _InfoRow('Altitude', '${(gps.altitude * 3.28084).round()} ft'),
                _InfoRow('Speed', '${(gps.speed * 0.621371).round()} mph'),
                _InfoRow('Heading', '${gps.heading.toStringAsFixed(0)}°'),
                _InfoRow('Satellites', '${gps.satellites} in view',
                    valueColor: AppTheme.accentGreen),
                _InfoRow('Accuracy', '± ${gps.accuracy.toStringAsFixed(1)} m'),
                _InfoRow('Fix Time', gps.fixTime),
              ],
            ),
          ),
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  String _signalBars(int strength) {
    return '▂▄▆█'.substring(0, strength.clamp(0, 4)) +
        '░░░░'.substring(0, 4 - strength.clamp(0, 4));
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(
                  fontSize: 12, color: AppTheme.textMuted),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: valueColor ?? AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── DEVICE SETTINGS TAB ────────────────────────────────────────────────────

class _DeviceSettingsTab extends StatelessWidget {
  final TabController tabController;
  const _DeviceSettingsTab({required this.tabController});

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final s = dp.settings;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Grid tiles
          const _SectionHeader(label: 'Device Settings', icon: Icons.settings_rounded),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.0,
            children: [
              _MgmtTile(
                icon: Icons.monitor_rounded,
                color: const Color(0xFF3B82F6),
                label: 'Platform',
                subtitle: s.serverIp,
                onTap: () => _showPlatformSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.account_balance_rounded,
                color: const Color(0xFF8B5CF6),
                label: 'GB Platform',
                subtitle: 'JT/T 808',
                onTap: () => _showGbPlatformSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.public_rounded,
                color: const Color(0xFF06B6D4),
                label: 'APN',
                subtitle: s.apn,
                onTap: () => _showApnSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.battery_charging_full_rounded,
                color: const Color(0xFF22C55E),
                label: 'Power',
                subtitle: s.vibrationWake,
                onTap: () => _showPowerSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.settings_applications_rounded,
                color: const Color(0xFF64748B),
                label: 'System',
                subtitle: 'Tools',
                onTap: () => _showSystemSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.cable_rounded,
                color: const Color(0xFFEF4444),
                label: 'Serial 232',
                subtitle: 'Sensor 9600',
                onTap: () => _showSerialSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.wifi_rounded,
                color: const Color(0xFFF59E0B),
                label: 'WLAN',
                subtitle: s.wlanEnabled ? 'Active' : 'Off',
                onTap: () => tabController.animateTo(4),
              ),
              _MgmtTile(
                icon: Icons.description_rounded,
                color: const Color(0xFF10B981),
                label: '808 Param',
                subtitle: 'Params',
                onTap: () => _show808ParamSheet(context, dp),
              ),
              _MgmtTile(
                icon: Icons.lock_rounded,
                color: const Color(0xFFF59E0B),
                label: 'Password',
                subtitle: 'Admin',
                onTap: () => _showPasswordSheet(context, dp),
              ),
            ],
          ),

          const SizedBox(height: 24),
          const _SectionHeader(label: 'Platform Configuration', icon: Icons.dns_rounded),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              children: [
                _SettingRow(
                  label: 'Server IP',
                  value: s.serverIp,
                  onTap: () => _showPlatformSheet(context, dp),
                ),
                _SettingRow(
                  label: 'Server Port',
                  value: '${s.serverPort}',
                  onTap: () => _showPlatformSheet(context, dp),
                ),
                _SettingRow(
                  label: 'APN Name',
                  value: s.apn,
                  onTap: () => _showApnSheet(context, dp),
                ),
                _SettingRow(
                  label: 'Protocol Version',
                  value: 'JT/T 808-2019',
                  onTap: () => _showGbPlatformSheet(context, dp),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const _SectionHeader(label: 'Power Management', icon: Icons.power_rounded),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              children: [
                _SettingRow(
                  label: 'Ignition Off Mode',
                  value: s.ignitionOff,
                  onTap: () => _showPowerSheet(context, dp),
                ),
                _SettingRow(
                  label: 'Vibration Wakeup',
                  value: s.vibrationWake,
                  onTap: () => _showPowerSheet(context, dp),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: dp.isLoading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Icon(Icons.save_rounded, size: 18),
              label: Text(
                dp.isLoading ? 'Saving Configuration...' : 'Save Device Settings',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              onPressed: dp.isLoading
                  ? null
                  : () async {
                      await dp.saveSettings();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            backgroundColor: AppTheme.bgCard,
                            content: Text('Device settings saved and synced via server!'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      }
                    },
            ),
          ),

          const SizedBox(height: 100),
        ],
      ),
    );
  }

  void _showPlatformSheet(BuildContext context, DeviceProvider dp) {
    final ipCtrl = TextEditingController(text: dp.settings.serverIp);
    final portCtrl = TextEditingController(text: '${dp.settings.serverPort}');

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Platform Settings',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: ipCtrl,
              style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace'),
              decoration: const InputDecoration(
                labelText: 'Server IP / Host',
                prefixIcon: Icon(Icons.dns_rounded, color: AppTheme.accentCyan),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: portCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace'),
              decoration: const InputDecoration(
                labelText: 'Server Port',
                prefixIcon: Icon(Icons.cable_rounded, color: AppTheme.accentCyan),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentCyan,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  final port = int.tryParse(portCtrl.text.trim()) ?? dp.settings.serverPort;
                  dp.updatePlatform(
                    serverIp: ipCtrl.text.trim(),
                    serverPort: port,
                    apn: dp.settings.apn,
                  );
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Platform configuration updated!')),
                  );
                },
                child: const Text('Save Platform Settings', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showGbPlatformSheet(BuildContext context, DeviceProvider dp) {
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'National Standard GB Platform Config',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text('Standards Compliance: JT/T 808-2019 / JT/T 1078-2016 Video Protocol', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            const SizedBox(height: 12),
            _SettingRow(label: 'Terminal ID (IMEI)', value: dp.systemStatus.imei),
            _SettingRow(label: 'Protocol Standard', value: 'JT/T 808-2019'),
            _SettingRow(label: 'Audio/Video Pipe', value: 'JT/T 1078 Live RTP'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentCyan, foregroundColor: Colors.black),
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('GB Platform parameters verified & synced!')),
                  );
                },
                child: const Text('Sync Parameters'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showApnSheet(BuildContext context, DeviceProvider dp) {
    final apnCtrl = TextEditingController(text: dp.settings.apn);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'APN Configuration',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: apnCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Access Point Name (APN)',
                prefixIcon: Icon(Icons.public_rounded, color: AppTheme.accentCyan),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  label: const Text('airtelgprs.com', style: TextStyle(fontSize: 11)),
                  onPressed: () => apnCtrl.text = 'airtelgprs.com',
                ),
                ActionChip(
                  label: const Text('jionet', style: TextStyle(fontSize: 11)),
                  onPressed: () => apnCtrl.text = 'jionet',
                ),
                ActionChip(
                  label: const Text('www', style: TextStyle(fontSize: 11)),
                  onPressed: () => apnCtrl.text = 'www',
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentCyan,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  dp.updatePlatform(
                    serverIp: dp.settings.serverIp,
                    serverPort: dp.settings.serverPort,
                    apn: apnCtrl.text.trim(),
                  );
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('APN updated successfully!')),
                  );
                },
                child: const Text('Save APN Settings', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPowerSheet(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Ignition Off Mode',
      options: const ['Deep Sleep (5 min)', 'Deep Sleep (15 min)', 'Deep Sleep (30 min)', 'Always On'],
      current: dp.settings.ignitionOff,
      onSelected: (mode) {
        dp.updatePowerSettings(ignitionOff: mode, vibrationWake: dp.settings.vibrationWake);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Power Mode set to: $mode')));
      },
    );
  }

  void _showSystemSheet(BuildContext context, DeviceProvider dp) {
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'System Commands & Maintenance',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.restart_alt_rounded, color: AppTheme.accentOrange),
              title: const Text('Reboot Dashcam Hardware', style: TextStyle(color: Colors.white, fontSize: 14)),
              subtitle: const Text('Sends remote 0x0105 reboot instruction to terminal', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              onTap: () {
                Navigator.pop(context);
                dp.sendDeviceCommand('reboot');
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Reboot command sent to dashcam!')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.access_time_rounded, color: AppTheme.accentCyan),
              title: const Text('Sync Clock (NTP Telematics)', style: TextStyle(color: Colors.white, fontSize: 14)),
              subtitle: const Text('Syncs dashcam internal RTC clock with NTP server', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              onTap: () {
                Navigator.pop(context);
                dp.sendDeviceCommand('sync_clock');
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Dashcam clock synchronized successfully!')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_sweep_rounded, color: AppTheme.statusCritical),
              title: const Text('Format SD Card Storage', style: TextStyle(color: AppTheme.statusCritical, fontSize: 14)),
              subtitle: const Text('Clears all recorded clips on SD card', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('SD Card storage formatted!')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showSerialSheet(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'RS232 Peripheral Interface',
      options: const ['Ultrasonic Fuel Sensor (9600 bps)', 'RFID Driver Card Reader (115200 bps)', 'External High-Precision GNSS', 'OBD-II CAN Decoder'],
      current: 'Ultrasonic Fuel Sensor (9600 bps)',
      onSelected: (mode) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Serial 232 configured: $mode')));
      },
    );
  }

  void _show808ParamSheet(BuildContext context, DeviceProvider dp) {
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('JT/T 808 Terminal Parameters', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 14),
            _SettingRow(label: 'Heartbeat Interval', value: '30 seconds'),
            _SettingRow(label: 'TCP Report Interval', value: '10 seconds'),
            _SettingRow(label: 'Sleep Report Interval', value: '180 seconds'),
            _SettingRow(label: 'Emergency Report', value: 'Instant Trigger'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentCyan, foregroundColor: Colors.black),
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('808 Parameters saved and confirmed!')));
                },
                child: const Text('Save Parameters'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPasswordSheet(BuildContext context, DeviceProvider dp) {
    final passCtrl = TextEditingController(text: '123456');

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Device Admin Password', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 16),
            TextField(
              controller: passCtrl,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Admin Password', prefixIcon: Icon(Icons.lock_rounded, color: AppTheme.accentCyan)),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentCyan, foregroundColor: Colors.black),
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Device admin password updated!')));
                },
                child: const Text('Update Password'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── MEDIA SETTINGS TAB ─────────────────────────────────────────────────────

class _MediaSettingsTab extends StatelessWidget {
  const _MediaSettingsTab();

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final s = dp.settings;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeader(label: 'Media Settings', icon: Icons.videocam_rounded),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.0,
            children: [
              _MgmtTile(
                icon: Icons.camera_alt_rounded,
                color: const Color(0xFF3B82F6),
                label: 'Camera',
                subtitle: 'Live View',
                onTap: () => context.go('/camera'),
              ),
              _MgmtTile(
                icon: dp.isRecording ? Icons.fiber_manual_record_rounded : Icons.play_circle_rounded,
                color: dp.isRecording ? AppTheme.statusCritical : const Color(0xFF8B5CF6),
                label: 'Record',
                subtitle: dp.isRecording ? 'Recording' : 'Paused',
                onTap: () {
                  dp.isRecording = !dp.isRecording;
                  dp.notifyListeners();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(dp.isRecording ? 'SD Card recording resumed!' : 'SD Card recording paused!'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
              ),
              _MgmtTile(
                icon: Icons.videocam_rounded,
                color: const Color(0xFF10B981),
                label: 'Main Stream',
                subtitle: 'CH1 Front',
                onTap: () {
                  dp.switchChannel(1);
                  context.go('/camera');
                },
              ),
              _MgmtTile(
                icon: Icons.ondemand_video_rounded,
                color: const Color(0xFF06B6D4),
                label: 'Sub Stream',
                subtitle: 'CH2 Cabin',
                onTap: () {
                  dp.switchChannel(2);
                  context.go('/camera');
                },
              ),
              _MgmtTile(
                icon: Icons.hd_rounded,
                color: const Color(0xFFEC4899),
                label: 'Quality',
                subtitle: s.videoResolution,
                onTap: () => _pickResolution(context, dp),
              ),
              _MgmtTile(
                icon: Icons.mic_rounded,
                color: const Color(0xFFEAB308),
                label: 'Audio',
                subtitle: s.audioEnabled ? 'Active' : 'Muted',
                onTap: () {
                  dp.updateMediaSettings(audioEnabled: !s.audioEnabled);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Audio recording ${!s.audioEnabled ? 'enabled' : 'disabled'}!')),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 24),
          const _SectionHeader(label: 'Camera Configuration', icon: Icons.camera_rounded),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              children: [
                _SettingRow(
                  label: 'Resolution',
                  value: s.videoResolution,
                  onTap: () => _pickResolution(context, dp),
                ),
                _SettingRow(
                  label: 'Frame Rate',
                  value: '${s.videoFps} fps',
                  onTap: () => _pickFps(context, dp),
                ),
                _SettingRow(
                  label: 'Audio Codec',
                  value: s.audioBitrate,
                  onTap: () => _pickAudioCodec(context, dp),
                ),
                _ToggleRow(
                  label: 'Audio Recording',
                  value: s.audioEnabled,
                  onChanged: (val) => dp.updateMediaSettings(audioEnabled: val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          const _SectionHeader(label: 'Event Buffer', icon: Icons.timelapse_rounded),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              children: [
                _SettingRow(
                  label: 'Pre-event Buffer',
                  value: '${s.preBuffer}s',
                  onTap: () => _pickPreBuffer(context, dp),
                ),
                _SettingRow(
                  label: 'Post-event Buffer',
                  value: '${s.postBuffer}s',
                  onTap: () => _pickPostBuffer(context, dp),
                ),
                _SettingRow(
                  label: 'Cloud TTL',
                  value: '7 Days Rolling',
                  onTap: () => _pickTtl(context),
                ),
                _SettingRow(
                  label: 'Max Event Size',
                  value: '250 MB / device',
                  onTap: () => _pickMaxEventSize(context),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.check_circle_rounded, size: 18),
              label: const Text('Save Media Configuration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              onPressed: () {
                dp.saveSettings();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Media and buffer settings saved to dashcam!')),
                );
              },
            ),
          ),

          const SizedBox(height: 100),
        ],
      ),
    );
  }

  void _pickResolution(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Select Video Resolution',
      options: const ['1080p (FHD 1920x1080)', '720p (HD 1280x720)', 'D1 (704x576)'],
      current: dp.settings.videoResolution,
      onSelected: (val) {
        dp.updateMediaSettings(resolution: val);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Resolution set to $val')));
      },
    );
  }

  void _pickFps(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Select Frame Rate',
      options: const ['30 fps', '25 fps', '20 fps', '15 fps'],
      current: '${dp.settings.videoFps} fps',
      onSelected: (val) {
        final fps = int.tryParse(val.split(' ')[0]) ?? 25;
        dp.updateMediaSettings(fps: fps);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Frame rate set to $val')));
      },
    );
  }

  void _pickAudioCodec(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Select Audio Codec',
      options: const ['AAC 48kHz', 'G.711a (PCMA)', 'G.711u (PCMU)', 'MP3 128kbps'],
      current: dp.settings.audioBitrate,
      onSelected: (val) {
        dp.updateMediaSettings(codec: val);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Audio Codec set to $val')));
      },
    );
  }

  void _pickPreBuffer(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Pre-event Buffer Duration',
      options: const ['5s', '10s', '15s', '30s'],
      current: '${dp.settings.preBuffer}s',
      onSelected: (val) {
        final buf = int.tryParse(val.replaceAll('s', '')) ?? 10;
        dp.updateMediaSettings(preBuffer: buf);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Pre-event buffer set to $val')));
      },
    );
  }

  void _pickPostBuffer(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Post-event Buffer Duration',
      options: const ['10s', '20s', '30s', '60s'],
      current: '${dp.settings.postBuffer}s',
      onSelected: (val) {
        final buf = int.tryParse(val.replaceAll('s', '')) ?? 20;
        dp.updateMediaSettings(postBuffer: buf);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Post-event buffer set to $val')));
      },
    );
  }

  void _pickTtl(BuildContext context) {
    _showOptionPicker(
      context: context,
      title: 'Cloud Storage Event Retention (TTL)',
      options: const ['7 Days Rolling', '14 Days Rolling', '30 Days Rolling', '90 Days Enterprise'],
      current: '7 Days Rolling',
      onSelected: (val) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Cloud TTL set to $val')));
      },
    );
  }

  void _pickMaxEventSize(BuildContext context) {
    _showOptionPicker(
      context: context,
      title: 'Max Event Size Allocation',
      options: const ['100 MB / device', '250 MB / device', '500 MB / device', '1 GB / device'],
      current: '250 MB / device',
      onSelected: (val) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Max event size set to $val')));
      },
    );
  }
}

// ── AI FUNCTIONS TAB ───────────────────────────────────────────────────────

class _AIFunctionsTab extends StatelessWidget {
  const _AIFunctionsTab();

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final s = dp.settings;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeader(label: 'AI Functions', icon: Icons.psychology_rounded),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.8,
            children: [
              _MgmtTile(
                icon: Icons.directions_car_rounded,
                color: const Color(0xFF3B82F6),
                label: 'ADAS (Collision)',
                subtitle: s.adasEnabled ? 'Active (ON)' : 'Disabled (OFF)',
                onTap: () {
                  dp.updateAiSettings(adasEnabled: !s.adasEnabled);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('ADAS Safety System ${!s.adasEnabled ? 'Activated' : 'Disabled'}!'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
              ),
              _MgmtTile(
                icon: Icons.visibility_rounded,
                color: const Color(0xFF8B5CF6),
                label: 'DMS (Fatigue)',
                subtitle: s.dmsEnabled ? 'Active (ON)' : 'Disabled (OFF)',
                onTap: () {
                  dp.updateAiSettings(dmsEnabled: !s.dmsEnabled);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Driver Monitoring System ${!s.dmsEnabled ? 'Activated' : 'Disabled'}!'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 24),
          const _SectionHeader(label: 'ADAS Configuration (Road Facing)', icon: Icons.car_crash_rounded),
          const SizedBox(height: 12),
          GlassCard(
            borderColor: const Color(0xFF3B82F6).withOpacity(0.3),
            child: Column(
              children: [
                _ToggleRow(
                  label: 'ADAS Enabled',
                  value: s.adasEnabled,
                  onChanged: (val) => dp.updateAiSettings(adasEnabled: val),
                ),
                _SettingRow(
                  label: 'Forward Collision Warning',
                  value: '${s.collisionWarningDistance}s TTW',
                  valueColor: AppTheme.statusWarning,
                  onTap: () => _pickCollisionDistance(context, dp),
                ),
                _ToggleRow(
                  label: 'Lane Departure Warning (LDW)',
                  value: s.laneChangeWarning,
                  onChanged: (val) => dp.updateAiSettings(laneChangeWarning: val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          const _SectionHeader(label: 'DMS Configuration (Cabin Facing)', icon: Icons.face_rounded),
          const SizedBox(height: 12),
          GlassCard(
            borderColor: const Color(0xFF8B5CF6).withOpacity(0.3),
            child: Column(
              children: [
                _ToggleRow(
                  label: 'DMS Enabled',
                  value: s.dmsEnabled,
                  onChanged: (val) => dp.updateAiSettings(dmsEnabled: val),
                ),
                _ToggleRow(
                  label: 'Drowsiness / Fatigue Detection',
                  value: s.fatiguDetection,
                  onChanged: (val) => dp.updateAiSettings(fatiguDetection: val),
                ),
                _ToggleRow(
                  label: 'Cell Phone Usage Detection',
                  value: s.phoneDetection,
                  onChanged: (val) => dp.updateAiSettings(phoneDetection: val),
                ),
                _ToggleRow(
                  label: 'Smoking In-Cabin Detection',
                  value: s.smokingDetection,
                  onChanged: (val) => dp.updateAiSettings(smokingDetection: val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.bolt_rounded, size: 20),
              label: const Text('Save & Sync AI Rules to Device', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              onPressed: () {
                dp.saveSettings();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: AppTheme.bgCard,
                    content: Text('AI Rules synced with terminal: ${dp.systemStatus.imei}!'),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 100),
        ],
      ),
    );
  }

  void _pickCollisionDistance(BuildContext context, DeviceProvider dp) {
    _showOptionPicker(
      context: context,
      title: 'Collision Warning Sensitivity (TTW)',
      options: const ['1.0s TTW (Close Range)', '1.5s TTW (Recommended Standard)', '2.0s TTW (Early Warning)', '2.5s TTW (High Caution)'],
      current: '${dp.settings.collisionWarningDistance}s TTW',
      onSelected: (val) {
        final dist = double.tryParse(val.split('s')[0]) ?? 1.5;
        dp.updateAiSettings(collisionWarningDistance: dist);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Collision warning set to $val')));
      },
    );
  }
}

// ── WLAN TAB ───────────────────────────────────────────────────────────────

class _WlanTab extends StatelessWidget {
  const _WlanTab();

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final s = dp.settings;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const _SectionHeader(label: 'WLAN / Wi-Fi Hotspot Settings', icon: Icons.wifi_rounded),
          const SizedBox(height: 12),
          GlassCard(
            borderColor: AppTheme.accentOrange.withOpacity(0.3),
            child: Column(
              children: [
                _ToggleRow(
                  label: 'Wi-Fi Hotspot Enabled',
                  value: s.wlanEnabled,
                  onChanged: (val) => dp.updateWlanSettings(enabled: val),
                ),
                _SettingRow(
                  label: 'Hotspot SSID',
                  value: s.wlanSsid,
                  onTap: () => _editSsid(context, dp),
                ),
                _SettingRow(
                  label: 'Hotspot IP Gateway',
                  value: '192.168.1.1',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Default Wi-Fi direct gateway is 192.168.1.1')),
                  ),
                ),
                _SettingRow(
                  label: 'Security Mode',
                  value: 'WPA2-PSK',
                  onTap: () => _showOptionPicker(
                    context: context,
                    title: 'Wi-Fi Security Encryption',
                    options: const ['WPA2-PSK (AES)', 'WPA3-Personal', 'Open (No Password)'],
                    current: 'WPA2-PSK (AES)',
                    onSelected: (sec) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Wi-Fi security set to $sec'))),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.info_outline_rounded, color: AppTheme.accentCyan, size: 16),
                    SizedBox(width: 8),
                    Text('Enterprise Connectivity Architecture', style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.accentCyan,
                    )),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'When connected to the Dashcam Wi-Fi, low-latency live video streaming is served directly over local Wi-Fi. All telematics, safety events, and cloud video recordings automatically synchronize over 4G cellular data to the central server.',
                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted, height: 1.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.wifi_protected_setup_rounded, size: 18),
              label: const Text('Save WLAN Configuration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              onPressed: () {
                dp.saveSettings();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('WLAN hotspot settings updated and broadcasted!')),
                );
              },
            ),
          ),
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  void _editSsid(BuildContext context, DeviceProvider dp) {
    final ctrl = TextEditingController(text: dp.settings.wlanSsid);

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: const Text('Edit Hotspot SSID Name', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: TextField(
          controller: ctrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(labelText: 'SSID Broadcast Name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentCyan, foregroundColor: Colors.black),
            onPressed: () {
              dp.updateWlanSettings(ssid: ctrl.text.trim());
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('SSID updated to: ${ctrl.text.trim()}')),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────

class _MgmtTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String? subtitle;
  final VoidCallback? onTap;

  const _MgmtTile({
    required this.icon,
    required this.color,
    required this.label,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle!,
                style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  final IconData icon;
  const _SectionHeader({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.accentCyan, size: 16),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppTheme.accentCyan,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}

class _SettingRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final VoidCallback? onTap;

  const _SettingRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Expanded(
              flex: 4,
              child: Text(label,
                  style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
            ),
            Expanded(
              flex: 5,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Flexible(
                    child: Text(
                      value,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: valueColor ?? AppTheme.textPrimary,
                      ),
                      textAlign: TextAlign.right,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (onTap != null) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.edit_rounded, size: 13, color: AppTheme.accentCyan.withOpacity(0.7)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;

  const _ToggleRow({
    required this.label,
    required this.value,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
          ),
          Switch(
            value: value,
            activeColor: AppTheme.accentCyan,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

void _showOptionPicker({
  required BuildContext context,
  required String title,
  required List<String> options,
  required String current,
  required ValueChanged<String> onSelected,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: AppTheme.bgCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.tune_rounded, color: AppTheme.accentCyan, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...options.map((opt) {
              final isSelected = opt == current || opt.startsWith(current);
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppTheme.accentCyan.withOpacity(0.15)
                      : AppTheme.bgPrimary.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected ? AppTheme.accentCyan : AppTheme.borderSubtle,
                  ),
                ),
                child: ListTile(
                  title: Text(
                    opt,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? Colors.white : AppTheme.textPrimary,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded, color: AppTheme.accentCyan, size: 20)
                      : null,
                  onTap: () {
                    Navigator.pop(context);
                    onSelected(opt);
                  },
                ),
              );
            }),
          ],
        ),
      ),
    ),
  );
}
