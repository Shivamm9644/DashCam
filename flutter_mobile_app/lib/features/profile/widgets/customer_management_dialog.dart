import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/models/customer_account.dart';

class CustomerManagementSheet extends StatefulWidget {
  const CustomerManagementSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CustomerManagementSheet(),
    );
  }

  @override
  State<CustomerManagementSheet> createState() => _CustomerManagementSheetState();
}

class _CustomerManagementSheetState extends State<CustomerManagementSheet> {
  bool _isCreatingNew = false;
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController(text: 'Cust@2026');
  final _phoneCtrl = TextEditingController(text: '+91 98260 ');
  String? _selectedTerminalId;
  String? _selectedPlate;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final user = auth.user;

    // Filter customers: if Fleet Admin (RETAILER), show only their company's customers
    final visibleCustomers = auth.customers.where((c) {
      if (user?.role == 'RETAILER') {
        final tName = (user?.tenantName ?? '').toLowerCase().trim();
        return tName.isEmpty || c.clientCompanyName.toLowerCase().trim() == tName;
      }
      return true;
    }).toList();

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
                      'Customer Account Management',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Create logins & assign single-vehicle dashcam access (${visibleCustomers.length} Active)',
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
                : _buildCustomerList(context, auth, dash, visibleCustomers),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerList(BuildContext context, AuthProvider auth, DashboardProvider dash, List<CustomerAccount> visibleCustomers) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        // Action: Create New Customer Button
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
                _nameCtrl.clear();
                _emailCtrl.clear();
                _passwordCtrl.text = 'Cust@${DateTime.now().year}';
                _phoneCtrl.text = '+91 98260 ';
                _selectedTerminalId = null;
                _selectedPlate = null;
              });
            },
            icon: const Icon(Icons.person_add_alt_1_rounded, size: 20),
            label: const Text(
              '+ Create New Customer Login',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
            ),
          ),
        ),

        if (visibleCustomers.isEmpty)
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: const [
                Icon(Icons.people_outline_rounded, size: 48, color: Color(0xFF94A3B8)),
                SizedBox(height: 12),
                Text(
                  'No Customer Accounts Created Yet',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                ),
                SizedBox(height: 4),
                Text(
                  'Tap "+ Create New Customer Login" above to provision 1-vehicle access for your retail clients.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          )
        else
          ...visibleCustomers.map((cust) => _buildCustomerCard(context, auth, cust)),
      ],
    );
  }

  Widget _buildCustomerCard(BuildContext context, AuthProvider auth, CustomerAccount cust) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: const Center(
                    child: Icon(Icons.person_outline_rounded, color: Color(0xFF16A34A), size: 22),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cust.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Assigned Truck: ${(cust.vehiclePlate.isNotEmpty && cust.vehiclePlate != "null") ? cust.vehiclePlate : (cust.assignedTerminalId == "505073729067" ? "MP-09-HH-9067" : "DashCam")} (${cust.assignedTerminalId})',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0284C7),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    cust.clientCompanyName,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFFF1F5F9), height: 1),

          // Credentials Box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: const Color(0xFFF8FAFC),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'LOGIN EMAIL',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        cust.email,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PASSWORD',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        cust.password,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 16, color: Color(0xFF64748B)),
                  tooltip: 'Copy Credentials',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: 'Email: ${cust.email}\nPassword: ${cust.password}'));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Customer credentials copied to clipboard!')),
                    );
                  },
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFFF1F5F9), height: 1),

          // Action Buttons
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton.icon(
                  onPressed: () async {
                    await auth.quickSwitchToCustomer(cust);
                    if (context.mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Switched to customer view: ${cust.name}')),
                      );
                    }
                  },
                  icon: const Icon(Icons.login_rounded, size: 15, color: Color(0xFF0284C7)),
                  label: const Text(
                    'Quick Login as Customer',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0284C7)),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Colors.redAccent),
                  tooltip: 'Delete Account',
                  onPressed: () async {
                    await auth.deleteCustomer(cust.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Customer account removed.')),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCreateForm(BuildContext context, AuthProvider auth, DashboardProvider dash) {
    final user = auth.user;

    // Available vehicles for this Admin to assign
    final availableDevices = dash.devices.where((d) {
      if (user?.role == 'RETAILER') {
        final assigned = user?.assignedTerminals ?? [];
        if (assigned.isNotEmpty) {
          return assigned.contains(d.terminalId) || assigned.contains(d.id);
        }
      }
      return true;
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Create Customer Credentials',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              TextButton(
                onPressed: () => setState(() => _isCreatingNew = false),
                child: const Text('Back to List', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Name
          const Text('Customer Full Name *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _nameCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Ramesh Patel',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            ),
          ),
          const SizedBox(height: 14),

          // Email / Login
          const Text('Login Email / Username *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              hintText: 'e.g. ramesh@gmail.com',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            ),
          ),
          const SizedBox(height: 14),

          // Password
          const Text('Login Password *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _passwordCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Cust@2026',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            ),
          ),
          const SizedBox(height: 14),

          // Phone
          const Text('Contact Phone', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              hintText: '+91 98260 00000',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            ),
          ),
          const SizedBox(height: 16),

          // Assigned Dashcam / Vehicle
          const Text('Assign Vehicle / DashCam (Single Access) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedTerminalId,
                hint: const Text('Choose a vehicle from fleet...', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                items: availableDevices.map((d) {
                  return DropdownMenuItem<String>(
                    value: d.terminalId,
                    child: Text(
                      '${(d.plate.isNotEmpty && d.plate != "null") ? d.plate : (d.terminalId == "505073729067" ? "MP-09-HH-9067" : "DashCam")} • IMEI: ${d.terminalId}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    final matched = availableDevices.firstWhere((d) => d.terminalId == val);
                    setState(() {
                      _selectedTerminalId = val;
                      _selectedPlate = matched.plate;
                    });
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Submit Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final name = _nameCtrl.text.trim();
                final email = _emailCtrl.text.trim();
                final pass = _passwordCtrl.text.trim();
                final phone = _phoneCtrl.text.trim();

                if (name.isEmpty || email.isEmpty || _selectedTerminalId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter name, email, and choose an assigned vehicle.')),
                  );
                  return;
                }

                final company = user?.tenantName.isNotEmpty == true
                    ? user!.tenantName
                    : (user?.name ?? 'Sharma Logistics');

                await auth.createCustomer(
                  name: name,
                  email: email,
                  username: email.split('@')[0],
                  password: pass.isNotEmpty ? pass : 'Cust@2026',
                  phone: phone,
                  assignedTerminalId: _selectedTerminalId!,
                  vehiclePlate: _selectedPlate ?? 'VEH-9067',
                  clientCompanyName: company,
                );

                setState(() => _isCreatingNew = false);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Customer account for $name created successfully!')),
                  );
                }
              },
              icon: const Icon(Icons.check_circle_rounded, size: 20),
              label: const Text(
                'Save Customer Credentials',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
