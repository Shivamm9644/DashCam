import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/device_provider.dart';
import '../widgets/retailer_management_dialog.dart';
import '../widgets/customer_management_dialog.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLockSwiped = false;
  bool _notificationsEnabled = true;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final dp = context.watch<DeviceProvider>();
    final user = auth.user;

    final visibleVehicles = dash.devices.where((d) {
      if (user?.role == 'RETAILER') {
        final assigned = user?.assignedTerminals ?? [];
        if (assigned.isNotEmpty) {
          return assigned.contains(d.terminalId) || assigned.contains(d.id);
        }
      }
      return true;
    }).toList();

    final primaryDevice = (dash.selectedDevice != null && visibleVehicles.contains(dash.selectedDevice))
        ? dash.selectedDevice
        : (visibleVehicles.isNotEmpty ? visibleVehicles.first : null);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. TOP USER PROFILE HEADER (Exact Trackify Style)
              _buildUserHeader(context, user),
              const SizedBox(height: 16),

              // 2. GOLD MEMBERSHIP BADGE (Upgrade to Plus)
              _buildUpgradeToPlusBanner(context),
              const SizedBox(height: 14),

              // 3. TRACKIFY ONBOARDING / EXPLORATION CARD
              _buildExplorationProgressCard(),
              const SizedBox(height: 14),

              // 4. PRIMARY VEHICLE CARD (Matching Trackify 100%)
              if (primaryDevice != null)
                _buildPrimaryVehicleCard(context, primaryDevice, dp, dash)
              else
                _buildNoVehicleCard(context),
              const SizedBox(height: 16),

              // 5. NAVIGATION MENU CARD (My Garage, Settings, MC Tool)
              _buildMenuCard(context, dash, primaryDevice),
              const SizedBox(height: 16),

              // 6. LOGOUT BUTTON
              _buildLogoutButton(context, auth),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUserHeader(BuildContext context, dynamic user) {
    final displayName = user?.name?.isNotEmpty == true ? user!.name : 'Fleet User';
    final username = user?.tenantName?.isNotEmpty == true ? user!.tenantName : (user?.role ?? 'Client');
    final userContact = user?.email?.isNotEmpty == true ? user!.email : 'Authorized Telematics Account';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        children: [
          // Circular Avatar with Trackify Gradient
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFF0284C7), Color(0xFF0D9488)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0284C7).withOpacity(0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                displayName.substring(0, 1).toUpperCase(),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          // User Information
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  username,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  userContact,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF0284C7),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 28),
            onPressed: () => _showAccountInfoSheet(context, user, userContact),
          ),
        ],
      ),
    );
  }

  Widget _buildUpgradeToPlusBanner(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFE6C187), Color(0xFFD6A462)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD6A462).withOpacity(0.35),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: () => _showPlusPlanDialog(context),
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 14, horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('👑', style: TextStyle(fontSize: 18)),
                SizedBox(width: 8),
                Text(
                  'TrackAnywhere Fleet Pro • Active',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF452205),
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExplorationProgressCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F9FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBAE6FD)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF0284C7), width: 2),
            ),
            child: const Center(
              child: Text(
                '100%',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0284C7),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DashCam Enterprise Ready',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0369A1),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Live Stream, GPS, SD Loop & JT1078 active',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
        ],
      ),
    );
  }

  Widget _buildPrimaryVehicleCard(
    BuildContext context,
    dynamic vehicle,
    DeviceProvider dp,
    DashboardProvider dash,
  ) {
    final plate = vehicle.plate ?? 'Active Dashcam';
    final model = (vehicle is DeviceItem && vehicle.deviceModel.isNotEmpty)
        ? vehicle.deviceModel
        : 'MDVR Dual-Cam Platform';
    final isOnline = vehicle.isOnline ?? false;
    final expDate = (vehicle is DeviceItem)
        ? vehicle.subscriptionExpiry
        : DateTime.now().add(const Duration(days: 365));
    final daysRemaining = expDate.difference(DateTime.now()).inDays.clamp(0, 999);
    final formattedExp = DateFormat('dd MMM yyyy').format(expDate);
    final warrantyDays = daysRemaining > 30 ? daysRemaining - 30 : daysRemaining;
    final formattedWarranty = DateFormat('dd MMM yyyy').format(expDate.subtract(const Duration(days: 30)));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          // Upper Vehicle Details
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.local_shipping_rounded,
                          color: Color(0xFF0284C7),
                          size: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            model,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Text(
                                plate,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isOnline
                                      ? const Color(0xFFECFDF5)
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: isOnline
                                        ? const Color(0xFFA7F3D0)
                                        : const Color(0xFFCBD5E1),
                                  ),
                                ),
                                child: Text(
                                  isOnline ? 'Online 4G' : 'Standby',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: isOnline
                                        ? const Color(0xFF059669)
                                        : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                      onPressed: () => context.go('/fleet'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // SWIPE TO LOCK / IMMOBILIZE BUTTON (Matching Trackify UI)
                GestureDetector(
                  onTap: () {
                    setState(() => _isLockSwiped = !_isLockSwiped);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          _isLockSwiped
                              ? '🔒 Dashcam Emergency Lock Engaged'
                              : '🔓 Dashcam Lock Released',
                        ),
                        backgroundColor: _isLockSwiped ? const Color(0xFF0F172A) : const Color(0xFF059669),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isLockSwiped ? Icons.lock_rounded : Icons.lock_open_rounded,
                          color: const Color(0xFF16A34A),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _isLockSwiped ? 'TAP TO UNLOCK VEHICLE' : 'TAP TO SECURE / LOCK VEHICLE',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF166534),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'ⓘ Tap to remotely secure the vehicle dashcam feed & alarm.',
                  style: TextStyle(
                    fontSize: 10,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 14),

                const Divider(color: Color(0xFFF1F5F9), height: 1),
                const SizedBox(height: 12),

                // ROW 1: DATA PLAN (Real Telematics Status)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Data Plan (4G SIM)',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isOnline ? 'Active • 4G Telematics Stream' : 'Standby • SIM Offline / Parked',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isOnline ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0F172A),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () => _showRechargeSheet(context, plate),
                      child: const Text(
                        'Recharge SIM',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // ROW 2: WARRANTY & AMC (Real Telematics Status)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Warranty & Cloud AMC',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isOnline ? 'Active Enterprise Support' : 'Standard Telematics License',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isOnline ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0F172A),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () => _showRenewSheet(context, plate),
                      child: const Text(
                        'Renew AMC',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Bottom Bar inside card: Notifications
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
              border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.notifications_active_outlined, color: Color(0xFF0284C7), size: 16),
                const SizedBox(width: 8),
                const Text(
                  'Dashcam Push Alerts',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0284C7),
                  ),
                ),
                const Spacer(),
                Switch(
                  value: _notificationsEnabled,
                  activeColor: const Color(0xFF0284C7),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onChanged: (val) {
                    setState(() => _notificationsEnabled = val);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoVehicleCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.local_shipping_outlined, size: 40, color: Color(0xFF94A3B8)),
            const SizedBox(height: 8),
            const Text('No primary dashcam assigned yet'),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => context.go('/fleet'),
              child: const Text('Add Vehicle DashCam'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuCard(BuildContext context, DashboardProvider dash, dynamic primaryDevice) {
    final user = context.watch<AuthProvider>().user;
    final assignedCount = (user?.assignedTerminals.isNotEmpty == true)
        ? user!.assignedTerminals.length
        : dash.devices.length;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          if (user?.role == 'SUPER_ADMIN') ...[
            _buildMenuItem(
              icon: Icons.admin_panel_settings_rounded,
              iconColor: const Color(0xFF0284C7),
              title: 'SaaS Client & Retailer Accounts',
              subtitle: 'Create client logins & allocate dashcams',
              onTap: () => RetailerManagementSheet.show(context),
            ),
            const Divider(color: Color(0xFFF1F5F9), height: 1, indent: 56),
          ],
          if (user?.role == 'RETAILER') ...[
            _buildMenuItem(
              icon: Icons.person_add_alt_1_rounded,
              iconColor: const Color(0xFF0284C7),
              title: 'Customer Accounts (Client Logins)',
              subtitle: 'Create customer logins & allocate dashcams',
              onTap: () => CustomerManagementSheet.show(context),
            ),
            const Divider(color: Color(0xFFF1F5F9), height: 1, indent: 56),
          ],
          _buildMenuItem(
            icon: Icons.garage_rounded,
            iconColor: const Color(0xFF0284C7),
            title: user?.role == 'CUSTOMER'
                ? 'My Assigned DashCam'
                : (user?.role == 'RETAILER'
                    ? 'Company DashCams (${user?.tenantName ?? "Fleet"})'
                    : 'My Garage (All Fleet Devices)'),
            subtitle: user?.role == 'CUSTOMER'
                ? 'View live telemetry & stream status'
                : (user?.role == 'SUPER_ADMIN'
                    ? 'Manage all ${dash.devices.length} registered Dashcams'
                    : 'Manage $assignedCount assigned Dashcams'),
            onTap: () => context.go('/fleet'),
          ),
          const Divider(color: Color(0xFFF1F5F9), height: 1, indent: 56),
          if (user?.role != 'CUSTOMER') ...[
            _buildMenuItem(
              icon: Icons.wifi_tethering_rounded,
              iconColor: const Color(0xFF0D9488),
              title: 'Camera Setup & IP Config (MC Tool)',
              subtitle: 'Direct AP mode, IP address, Port & SD Card',
              onTap: () => context.go('/camera?mode=offline'),
            ),
            const Divider(color: Color(0xFFF1F5F9), height: 1, indent: 56),
          ],
          _buildMenuItem(
            icon: Icons.sd_storage_rounded,
            iconColor: const Color(0xFFF59E0B),
            title: 'Storage & Memory Card Health',
            subtitle: 'Loop recording FIFO • Auto-overwrite enabled',
            onTap: () => _showStorageHealthSheet(context, primaryDevice),
          ),
          if (user?.role != 'CUSTOMER') ...[
            const Divider(color: Color(0xFFF1F5F9), height: 1, indent: 56),
            _buildMenuItem(
              icon: Icons.tune_rounded,
              iconColor: const Color(0xFF64748B),
              title: 'Device & Subscription Settings',
              subtitle: 'Network configs, server endpoints, alerts',
              onTap: () => context.go('/device-management'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0F172A),
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontSize: 11,
          color: Color(0xFF64748B),
        ),
      ),
      trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 22),
    );
  }

  Widget _buildLogoutButton(BuildContext context, AuthProvider auth) {
    return Column(
      children: [
        if (auth.user?.role == 'SUPER_ADMIN') ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () => RetailerManagementSheet.show(context),
              icon: const Icon(Icons.swap_horiz_rounded, size: 20),
              label: const Text(
                'SaaS Retailer Management (Admin Portal)',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (auth.user?.role == 'RETAILER') ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () => CustomerManagementSheet.show(context),
              icon: const Icon(Icons.person_add_alt_1_rounded, size: 20),
              label: const Text(
                'Customer Management (Client Portal)',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
              side: const BorderSide(color: Color(0xFFFECACA)),
              backgroundColor: const Color(0xFFFEF2F2),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: () => _confirmLogout(context, auth),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text(
              'Sign Out of TrackAnywhere',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        ),
      ],
    );
  }

  void _showAccountInfoSheet(BuildContext context, dynamic user, String phone) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Account Details',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 14),
              _buildInfoRow('Name', user?.name ?? 'Authorized User'),
              _buildInfoRow('Role', user?.role == 'SUPER_ADMIN' ? 'Super Administrator' : (user?.role == 'RETAILER' ? 'Client Fleet' : (user?.role == 'CUSTOMER' ? 'Retail Customer' : 'Fleet Admin'))),
              _buildInfoRow('Organization', user?.tenantName ?? 'GBT Fleet'),
              _buildInfoRow('Registered Email', user?.email ?? phone),
              _buildInfoRow('Assigned Devices', (user?.role == 'CUSTOMER' || user?.role == 'RETAILER') ? '${user?.assignedTerminals.length ?? 1} Dashcam' : 'Full Fleet Access'),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF64748B),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Close'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        final auth = context.read<AuthProvider>();
                        _showEditProfileSheet(context, auth);
                      },
                      icon: const Icon(Icons.edit_rounded, size: 16),
                      label: const Text('Edit Profile'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  void _showEditProfileSheet(BuildContext context, AuthProvider auth) {
    final user = auth.user;
    final nameCtrl = TextEditingController(text: user?.name ?? '');
    final emailCtrl = TextEditingController(text: user?.email ?? '');
    final phoneCtrl = TextEditingController(text: '+91 98765 43210');
    final sosCtrl = TextEditingController(text: '+91 91122 33445');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Edit Personal Profile',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Update your name, contact phone, and emergency SOS alerts.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Full Name', hintText: 'Enter your name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email Address', hintText: 'Enter email address'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile Phone', hintText: 'e.g. +91 98765 43210'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: sosCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Emergency SOS Contact Phone', hintText: 'Family or Fleet Dispatcher Phone'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await auth.updateUserProfile(
                      name: nameCtrl.text.trim(),
                      email: emailCtrl.text.trim(),
                      phone: phoneCtrl.text.trim(),
                      sosContact: sosCtrl.text.trim(),
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Profile updated successfully'),
                        behavior: SnackBarBehavior.floating,
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  child: const Text('Save Profile Changes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showPlusPlanDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Text('👑', style: TextStyle(fontSize: 22)),
            SizedBox(width: 8),
            Text('TrackAnywhere Fleet Pro', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your fleet is currently enjoying Enterprise Pro benefits:'),
            SizedBox(height: 10),
            Text('✓ 1080p Live Stream (JT1078 & HLS)'),
            Text('✓ Unlimited Cloud Incident Lock'),
            Text('✓ Real-time Driver Drowsiness Alarms'),
            Text('✓ MicroSD FIFO Overwrite Automation'),
            Text('✓ Multi-tenant Client Segregation'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Dismiss', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showRechargeSheet(BuildContext context, String plate) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recharge SIM for $plate',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('Cellular IoT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildRechargePack(ctx, 'Annual IoT Pack (365 Days)', '₹ 1,499', '50GB M2M High Speed Data + SMS Gateway'),
              _buildRechargePack(ctx, 'Semi-Annual Pack (180 Days)', '₹ 849', '25GB M2M Data with Auto-renew'),
              _buildRechargePack(ctx, 'Monthly Topup (30 Days)', '₹ 199', '5GB Topup Data'),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRechargePack(BuildContext ctx, String title, String price, String desc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
                const SizedBox(height: 2),
                Text(desc, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Recharge $price activated successfully!'),
                  backgroundColor: const Color(0xFF059669),
                ),
              );
            },
            child: Text(price, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  void _showRenewSheet(BuildContext context, String plate) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Renew Cloud Warranty & AMC ($plate)',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 14),
              _buildRechargePack(ctx, '1-Year Hardware + Cloud Extension', '₹ 2,999', 'Full MDVR Warranty, server license & 24/7 support'),
              _buildRechargePack(ctx, '2-Year Comprehensive Fleet Cover', '₹ 4,999', 'Includes free SD card replacement & instant swap'),
            ],
          ),
        );
      },
    );
  }

  void _showStorageHealthSheet(BuildContext context, dynamic vehicle) {
    final bool isOnline = vehicle?.isOnline ?? false;
    final String plate = vehicle?.plate ?? 'Dashcam';
    final String terminalId = vehicle?.terminalId ?? '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'MicroSD Storage & Loop Status \u2022 $plate',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isOnline ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isOnline ? const Color(0xFFA7F3D0) : const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  children: [
                    Icon(
                      isOnline ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                      color: isOnline ? const Color(0xFF059669) : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        isOnline
                            ? 'FIFO Auto-Overwrite Active: Continuous loop recording enabled. Oldest non-emergency clips recycled automatically.'
                            : 'Camera is currently OFFLINE: Local MicroSD loop recording initiates automatically when vehicle ignition turns on.',
                        style: TextStyle(
                          fontSize: 12,
                          color: isOnline ? const Color(0xFF065F46) : const Color(0xFF475569),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _buildInfoRow('Terminal IMEI', terminalId.isNotEmpty ? terminalId : 'Standby'),
              _buildInfoRow('Connection Status', isOnline ? 'ONLINE \u2022 CONNECTED' : 'OFFLINE (Parked / Standby)'),
              _buildInfoRow('FIFO Overwrite', 'Firmware Enabled (Automatic Recycle)'),
              _buildInfoRow('Hardware Telemetry', isOnline ? 'Live Polling Active (JT/T 808)' : 'Awaiting Camera Connection'),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.check_rounded),
                  label: const Text('OK'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Sign Out?', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text('Are you sure you want to log out of your TrackAnywhere session?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await auth.logout();
              if (context.mounted) context.go('/login');
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}
