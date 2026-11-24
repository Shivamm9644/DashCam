import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/models/retailer_account.dart';

class RetailerManagementSheet extends StatefulWidget {
  const RetailerManagementSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const RetailerManagementSheet(),
    );
  }

  @override
  State<RetailerManagementSheet> createState() => _RetailerManagementSheetState();
}

class _RetailerManagementSheetState extends State<RetailerManagementSheet> {
  bool _isCreatingNew = false;
  final _companyCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController(text: 'Trackify@2026');
  final _phoneCtrl = TextEditingController(text: '+91 98260 ');
  final List<String> _selectedCameraTerminals = [];

  @override
  void dispose() {
    _companyCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 5,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SaaS Client & Retailer Portal',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Manage Logins & Dashcam Allocations (${auth.retailers.length} Active)',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: Color(0xFFE2E8F0), height: 16),

          // Content
          Expanded(
            child: _isCreatingNew
                ? _buildCreateForm(context, auth, dash)
                : _buildRetailerList(context, auth, dash),
          ),
        ],
      ),
    );
  }

  Widget _buildRetailerList(BuildContext context, AuthProvider auth, DashboardProvider dash) {
    final currentUser = auth.user;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        // Action: Create New Retailer Button
        Container(
          margin: const EdgeInsets.only(bottom: 14),
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            onPressed: () {
              setState(() {
                _isCreatingNew = true;
                _companyCtrl.clear();
                _emailCtrl.clear();
                _passwordCtrl.text = 'Trackify@${DateTime.now().year}';
                _phoneCtrl.text = '+91 98260 ';
                _selectedCameraTerminals.clear();
              });
            },
            icon: const Icon(Icons.person_add_alt_1_rounded, size: 20),
            label: const Text(
              '+ Create New Client / Retailer Credentials',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
            ),
          ),
        ),

        // Master Admin Option (if currently logged in as retailer)
        if (currentUser?.role == 'RETAILER')
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Row(
              children: [
                const Text('👑', style: TextStyle(fontSize: 24)),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Master Fleet Admin (All Cameras)',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                      ),
                      Text(
                        'Switch back to master overview',
                        style: TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  onPressed: () async {
                    await auth.quickSwitchToAdmin();
                    dash.setClientFilter('ALL');
                    if (mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Switched to Master Admin view (All Fleets)')),
                      );
                    }
                  },
                  child: const Text('Switch', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              ],
            ),
          ),

        // List of Registered Retailers
        ...auth.retailers.map((ret) {
          final isCurrent = currentUser?.tenantName == ret.companyName;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isCurrent ? const Color(0xFF0284C7) : const Color(0xFFE2E8F0),
                width: isCurrent ? 2 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: isCurrent ? const Color(0xFF0284C7).withOpacity(0.08) : Colors.black.withOpacity(0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE0F2FE),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Icon(Icons.business_rounded, color: Color(0xFF0284C7), size: 20),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ret.companyName,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              'Login ID: ${ret.username}',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Text(
                        '${ret.daysRemaining}d Left',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF059669),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Credentials info row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.vpn_key_rounded, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(
                            'Pass: ${ret.password}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(Icons.phone_rounded, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(
                            ret.phone,
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Assigned Cameras list
                Row(
                  children: [
                    const Icon(Icons.videocam_rounded, size: 14, color: Color(0xFF0284C7)),
                    const SizedBox(width: 6),
                    Text(
                      '${ret.assignedTerminalIds.length} Cameras Assigned',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: ret.assignedTerminalIds.map((tId) {
                    final matchingDev = dash.devices.firstWhere(
                      (d) => d.terminalId == tId,
                      orElse: () => dash.devices.first,
                    );
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Text(
                        matchingDev.plate,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),

                // Action buttons: Switch Login & Copy Credentials
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0F172A),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(
                            text: 'Trackify Dashcam Login:\nUsername: ${ret.username}\nPassword: ${ret.password}\nCompany: ${ret.companyName}',
                          ));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Credentials for ${ret.companyName} copied to clipboard!')),
                          );
                        },
                        icon: const Icon(Icons.copy_rounded, size: 14),
                        label: const Text('Share Credentials', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isCurrent ? const Color(0xFF10B981) : const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                        onPressed: isCurrent
                            ? null
                            : () async {
                                await auth.quickSwitchToRetailer(ret);
                                dash.setClientFilter(ret.companyName);
                                if (mounted) {
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Logged in as ${ret.companyName} (SaaS Isolated View)')),
                                  );
                                }
                              },
                        icon: Icon(isCurrent ? Icons.check_circle_rounded : Icons.login_rounded, size: 14),
                        label: Text(
                          isCurrent ? 'Active Account' : 'Login / Switch',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildCreateForm(BuildContext context, AuthProvider auth, DashboardProvider dash) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
                onPressed: () => setState(() => _isCreatingNew = false),
              ),
              const SizedBox(width: 4),
              const Text(
                'New Retailer / Client Account',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Company Name
          const Text('Retailer / Transporter Company Name', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _companyCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Balaji Transport, Agrawal Cargo',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onChanged: (val) {
              if (_emailCtrl.text.isEmpty && val.isNotEmpty) {
                final clean = val.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
                _emailCtrl.text = '$clean@trackify.com';
              }
            },
          ),
          const SizedBox(height: 14),

          // Login Email / ID
          const Text('Login Email / Username', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _emailCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. balaji@trackify.com',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 14),

          // Password
          const Text('Password', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _passwordCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Balaji@2026',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 14),

          // Phone
          const Text('Contact Mobile Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              hintText: '+91 98260 12345',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 18),

          // Camera Allocation Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Assign Dashcams to this Retailer',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              Text(
                '${_selectedCameraTerminals.length} Selected',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
              ),
            ],
          ),
          const SizedBox(height: 8),

          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Column(
              children: dash.devices.map((dev) {
                final isSelected = _selectedCameraTerminals.contains(dev.terminalId);
                return CheckboxListTile(
                  value: isSelected,
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  activeColor: const Color(0xFF0284C7),
                  title: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF003399),
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: const Text('IND', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 6),
                      Text(dev.plate, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                      const SizedBox(width: 8),
                      Text(dev.deviceModel, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    ],
                  ),
                  subtitle: Text('Terminal IMEI: ${dev.terminalId}', style: const TextStyle(fontSize: 10, fontFamily: 'monospace')),
                  onChanged: (checked) {
                    setState(() {
                      if (checked == true) {
                        _selectedCameraTerminals.add(dev.terminalId);
                      } else {
                        _selectedCameraTerminals.remove(dev.terminalId);
                      }
                    });
                  },
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),

          // Create & Save Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () async {
                final company = _companyCtrl.text.trim();
                final email = _emailCtrl.text.trim();
                final pass = _passwordCtrl.text.trim();
                final phone = _phoneCtrl.text.trim();

                if (company.isEmpty || email.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter Company Name and Email ID.')),
                  );
                  return;
                }

                final newRet = await auth.createRetailer(
                  companyName: company,
                  email: email,
                  username: email.split('@')[0],
                  password: pass.isNotEmpty ? pass : 'Trackify@2026',
                  phone: phone,
                  assignedTerminalIds: _selectedCameraTerminals.isNotEmpty
                      ? List.from(_selectedCameraTerminals)
                      : (dash.devices.isNotEmpty ? [dash.devices.first.terminalId] : []),
                );

                // Update assigned devices in DashboardProvider
                for (final termId in newRet.assignedTerminalIds) {
                  final idx = dash.devices.indexWhere((d) => d.terminalId == termId);
                  if (idx != -1) {
                    final old = dash.devices[idx];
                    dash.devices[idx] = DeviceItem(
                      id: old.id,
                      plate: old.plate,
                      terminalId: old.terminalId,
                      driver: old.driver,
                      speed: old.speed,
                      status: old.status,
                      lat: old.lat,
                      lng: old.lng,
                      lastPing: old.lastPing,
                      heading: old.heading,
                      altitude: old.altitude,
                      deviceModel: old.deviceModel,
                      clientName: newRet.companyName,
                      subscriptionExpiry: old.subscriptionExpiry,
                      subscriptionStart: old.subscriptionStart,
                    );
                  }
                }
                await dash.saveDevices();

                setState(() => _isCreatingNew = false);

                // Show Success Credential Card Dialog
                if (mounted) {
                  _showCredentialGeneratedDialog(context, auth, dash, newRet);
                }
              },
              icon: const Icon(Icons.check_circle_rounded, size: 20),
              label: const Text(
                'Generate SaaS Credentials & Allocate Cameras',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showCredentialGeneratedDialog(BuildContext context, AuthProvider auth, DashboardProvider dash, RetailerAccount ret) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: const [
            Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 26),
            SizedBox(width: 10),
            Text('Credentials Created', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'New SaaS retailer account registered successfully. Share these credentials with your client:',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _credRow('Company', ret.companyName),
                  const Divider(color: Color(0xFFE2E8F0), height: 12),
                  _credRow('Login ID / Email', ret.email),
                  const Divider(color: Color(0xFFE2E8F0), height: 12),
                  _credRow('Password', ret.password),
                  const Divider(color: Color(0xFFE2E8F0), height: 12),
                  _credRow('Assigned Cameras', '${ret.assignedTerminalIds.length} Dashcam(s)'),
                  const Divider(color: Color(0xFFE2E8F0), height: 12),
                  _credRow('Validity', '1 Year (365 Days Plan)'),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(
                text: 'Trackify Dashcam Login Credentials:\nCompany: ${ret.companyName}\nLogin: ${ret.email}\nPassword: ${ret.password}\nValidity: 365 Days\nPortal: App Login Screen',
              ));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Credentials copied to clipboard!')),
              );
            },
            icon: const Icon(Icons.copy_rounded, size: 16),
            label: const Text('Copy Details'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await auth.quickSwitchToRetailer(ret);
              dash.setClientFilter(ret.companyName);
              if (mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Switched to ${ret.companyName} SaaS view!')),
                );
              }
            },
            icon: const Icon(Icons.login_rounded, size: 16),
            label: const Text('Login as Client Now'),
          ),
        ],
      ),
    );
  }

  Widget _credRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontFamily: 'monospace')),
      ],
    );
  }
}
