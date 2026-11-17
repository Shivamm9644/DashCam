import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/widgets/glass_card.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/truck_map_view.dart';
import '../../../core/services/api_service.dart';

class FleetScreen extends StatefulWidget {
  const FleetScreen({super.key});

  @override
  State<FleetScreen> createState() => _FleetScreenState();
}

class _FleetScreenState extends State<FleetScreen> {
  String _filter = 'ALL';
  String _search = '';
  DeviceItem? _selected;

  static final RegExp _vinRegex = RegExp(r'^[A-HJ-NPR-Z0-9]{17}$');
  static final RegExp _imeiRegex = RegExp(r'^\d{6,20}$');

  void _showAddVehicleDialog() {
    final plateCtrl = TextEditingController();
    final labelCtrl = TextEditingController();
    final modelCtrl = TextEditingController(text: 'MDVR (M16C)');
    final yearCtrl = TextEditingController(text: '2024');
    final driverNameCtrl = TextEditingController();
    final driverPhoneCtrl = TextEditingController();
    final driverLicenseCtrl = TextEditingController();
    final imeiCtrl = TextEditingController();

    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.directions_car_rounded, color: AppTheme.accentCyan),
              SizedBox(width: 8),
              Text('Add Fleet Vehicle', style: TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: plateCtrl,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    labelText: 'License Plate Number *',
                    hintText: 'e.g. IND VEH-9067 or MP-09-WW-4359',
                    labelStyle: TextStyle(color: AppTheme.accentCyan),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: labelCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Vehicle Label / Name (Optional)',
                    hintText: 'e.g. Desk Test Cable',
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: modelCtrl,
                        style: const TextStyle(color: AppTheme.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Model',
                          hintText: 'e.g. M16C / Tata Signa',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: yearCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: AppTheme.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Year',
                          hintText: '2024',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: imeiCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Paired DashCam Terminal IMEI (Optional)',
                    hintText: 'e.g. 505073474490',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: driverNameCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Driver Name (Optional)',
                    hintText: 'e.g. Desk Test',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: driverPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Driver Phone (Optional)',
                    hintText: 'e.g. +91 9876543210',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final plate = plateCtrl.text.trim().toUpperCase();
                      if (plate.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a vehicle license plate number.')));
                        return;
                      }
                      setDlgState(() => isSubmitting = true);
                      try {
                        await ApiService.instance.addFleetVehicle(
                          plateNumber: plate,
                          label: labelCtrl.text.trim().isNotEmpty ? labelCtrl.text.trim() : null,
                          model: modelCtrl.text.trim().isNotEmpty ? modelCtrl.text.trim() : null,
                          year: int.tryParse(yearCtrl.text.trim()) ?? 2024,
                          driverName: driverNameCtrl.text.trim().isNotEmpty ? driverNameCtrl.text.trim() : null,
                          driverPhone: driverPhoneCtrl.text.trim().isNotEmpty ? driverPhoneCtrl.text.trim() : null,
                          assignedDeviceId: imeiCtrl.text.trim().isNotEmpty ? imeiCtrl.text.trim() : null,
                        );
                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: AppTheme.bgCard,
                              content: Text('Vehicle ' + plate + ' added successfully!', style: const TextStyle(color: AppTheme.accentGreen)),
                            ),
                          );
                          context.read<DashboardProvider>().refreshStats();
                        }
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: Colors.red.shade900,
                            content: Text('Failed to add vehicle: ' + e.toString()),
                          ),
                        );
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Save Vehicle', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddDeviceDialog() {
    final vinCtrl = TextEditingController();
    final imeiCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final plateCtrl = TextEditingController();
    final modelCtrl = TextEditingController(text: 'GD19');
    final notesCtrl = TextEditingController();

    bool isSubmitting = false;
    bool isCheckingImei = false;
    String? imeiConflictMessage;
    bool forceReassign = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.add_to_queue_rounded, color: AppTheme.accentCyan),
              SizedBox(width: 8),
              Text('Add / Pair DashCam', style: TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Vehicle VIN (Mandatory, 17 chars)
                TextField(
                  controller: vinCtrl,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace', fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    labelText: 'Vehicle VIN (Optional, 17 Chars)',
                    hintText: 'e.g. 1HD1KAE12FB099999',
                    labelStyle: const TextStyle(color: AppTheme.accentCyan),
                    suffixIcon: vinCtrl.text.length == 17 && _vinRegex.hasMatch(vinCtrl.text.toUpperCase().trim())
                        ? const Icon(Icons.check_circle_rounded, color: AppTheme.accentGreen, size: 20)
                        : null,
                  ),
                  onChanged: (val) {
                    setDlgState(() {});
                  },
                ),
                if (vinCtrl.text.isNotEmpty && (!_vinRegex.hasMatch(vinCtrl.text.toUpperCase().trim()) || vinCtrl.text.length != 17))
                  const Padding(
                    padding: EdgeInsets.only(top: 4, left: 4),
                    child: Text(
                      'Must be exactly 17 chars (letters I, O, Q not allowed)',
                      style: TextStyle(color: Colors.redAccent, fontSize: 11),
                    ),
                  ),

                const SizedBox(height: 12),

                // 2. DashCam IMEI (Mandatory, 15 digits)
                TextField(
                  controller: imeiCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: AppTheme.textPrimary, fontFamily: 'monospace', fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    labelText: 'DashCam IMEI (6-20 Digits) *',
                    hintText: 'e.g. 505073474490 or 860871080043592',
                    labelStyle: const TextStyle(color: AppTheme.accentCyan),
                    suffixIcon: isCheckingImei
                        ? const SizedBox(width: 16, height: 16, child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)))
                        : (imeiCtrl.text.length >= 6 && _imeiRegex.hasMatch(imeiCtrl.text.trim())
                            ? const Icon(Icons.check_circle_rounded, color: AppTheme.accentGreen, size: 20)
                            : null),
                  ),
                  onChanged: (val) async {
                    setDlgState(() {});
                    if (val.trim().length >= 6 && _imeiRegex.hasMatch(val.trim())) {
                      setDlgState(() => isCheckingImei = true);
                      try {
                        final res = await ApiService.instance.resolveImei(val.trim());
                        if (res['isPaired'] == true) {
                          setDlgState(() {
                            imeiConflictMessage = 'Device currently paired to: ${res['pairedPlate']} (${res['pairedVin']})';
                          });
                        } else {
                          setDlgState(() {
                            imeiConflictMessage = null;
                          });
                        }
                      } catch (_) {}
                      setDlgState(() => isCheckingImei = false);
                    } else {
                      setDlgState(() => imeiConflictMessage = null);
                    }
                  },
                ),
                if (imeiCtrl.text.isNotEmpty && (!_imeiRegex.hasMatch(imeiCtrl.text.trim()) || imeiCtrl.text.trim().length < 6 || imeiCtrl.text.trim().length > 20))
                  const Padding(
                    padding: EdgeInsets.only(top: 4, left: 4),
                    child: Text(
                      'Must be 6 to 20 numeric digits (e.g. 505073474490)',
                      style: TextStyle(color: Colors.redAccent, fontSize: 11),
                    ),
                  ),

                // Reassignment Warning / Checkbox
                if (imeiConflictMessage != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.amber.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber.withOpacity(0.5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 16),
                            const SizedBox(width: 6),
                            Expanded(child: Text(imeiConflictMessage!, style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.w600))),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Checkbox(
                              value: forceReassign,
                              activeColor: AppTheme.accentCyan,
                              checkColor: Colors.black,
                              onChanged: (v) => setDlgState(() => forceReassign = v ?? false),
                            ),
                            const Expanded(
                              child: Text('Authorize reassignment from previous truck', style: TextStyle(color: AppTheme.textPrimary, fontSize: 11)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // 3. Device Name (Optional)
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Device Name (Optional)',
                    hintText: 'e.g. Truck 101 - Kenworth',
                    labelStyle: TextStyle(color: AppTheme.textMuted),
                  ),
                ),

                const SizedBox(height: 10),

                // 4. Vehicle Registration / Plate Number (Optional)
                TextField(
                  controller: plateCtrl,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Plate Number (Optional)',
                    hintText: 'e.g. KA01AB1234',
                    labelStyle: TextStyle(color: AppTheme.textMuted),
                  ),
                ),

                const SizedBox(height: 10),

                // 5. Device Model (Optional, default GD19)
                TextField(
                  controller: modelCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Device Model (Default: GD19)',
                    hintText: 'GD19',
                    labelStyle: TextStyle(color: AppTheme.textMuted),
                  ),
                ),

                const SizedBox(height: 10),

                // Optional Notes
                TextField(
                  controller: notesCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Pairing Notes (Optional)',
                    hintText: 'e.g. Front windshield install',
                    labelStyle: TextStyle(color: AppTheme.textMuted),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentCyan,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final cleanVin = vinCtrl.text.toUpperCase().trim();
                      final cleanImei = imeiCtrl.text.trim();

                      String effectiveVin = cleanVin;
                      if (effectiveVin.isEmpty) {
                        effectiveVin = 'VIN' + cleanImei.padLeft(14, '0');
                      } else if (!_vinRegex.hasMatch(effectiveVin) || effectiveVin.length != 17) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('VIN must be 17 characters, or leave blank to auto-generate.')));
                        return;
                      }
                      if (!_imeiRegex.hasMatch(cleanImei) || cleanImei.length < 6 || cleanImei.length > 20) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid numeric DashCam IMEI (6-20 digits).')));
                        return;
                      }
                      if (imeiConflictMessage != null && !forceReassign) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please tick "Authorize reassignment" to move this DashCam.')));
                        return;
                      }

                      setDlgState(() => isSubmitting = true);
                      try {
                        final res = await ApiService.instance.pairDevice(
                          vin: effectiveVin,
                          imei: cleanImei,
                          deviceName: nameCtrl.text.trim().isNotEmpty ? nameCtrl.text.trim() : null,
                          plateNumber: plateCtrl.text.trim().isNotEmpty ? plateCtrl.text.trim() : null,
                          deviceModel: modelCtrl.text.trim().isNotEmpty ? modelCtrl.text.trim() : 'GD19',
                          forceReassign: forceReassign,
                          notes: notesCtrl.text.trim().isNotEmpty ? notesCtrl.text.trim() : null,
                        );

                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            backgroundColor: AppTheme.bgCard,
                            content: Text(res['message'] ?? 'DashCam paired successfully!'),
                            duration: const Duration(seconds: 3),
                          ));
                          context.read<DashboardProvider>().loadDevicesFromDatabase();
                        }
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            backgroundColor: Colors.red.shade900,
                            content: Text('Pairing failed: $e'),
                          ));
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Pair Device', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showUnpairDialog(DeviceItem device) {
    final reasonCtrl = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.link_off_rounded, color: Colors.redAccent),
              SizedBox(width: 8),
              Text('Unpair DashCam', style: TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Unpair DashCam (${device.terminalId}) from vehicle ${device.plate}?', style: const TextStyle(color: AppTheme.textPrimary)),
              const SizedBox(height: 8),
              const Text('Historical video recordings and safety events will be preserved in the pairing history.', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: reasonCtrl,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Reason for unpairing (Optional)',
                  hintText: 'e.g. Maintenance, transferred to repair',
                  labelStyle: TextStyle(color: AppTheme.textMuted),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      setDlgState(() => isSubmitting = true);
                      try {
                        final res = await ApiService.instance.unpairDevice(
                          device.id,
                          reason: reasonCtrl.text.trim().isNotEmpty ? reasonCtrl.text.trim() : null,
                        );
                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(res['message'] ?? 'DashCam unpaired successfully.'),
                          ));
                          context.read<DashboardProvider>().loadDevicesFromDatabase();
                        }
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to unpair: $e')));
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Unpair', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showPairingHistoryDialog(DeviceItem device) async {
    List<dynamic> history = [];
    bool isLoading = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) {
          if (isLoading) {
            ApiService.instance.getPairingHistory(device.id).then((res) {
              if (mounted) {
                setDlgState(() {
                  history = res;
                  isLoading = false;
                });
              }
            }).catchError((_) {
              if (mounted) {
                setDlgState(() => isLoading = false);
              }
            });
          }

          return AlertDialog(
            backgroundColor: AppTheme.bgCard,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: [
                const Icon(Icons.history_rounded, color: AppTheme.accentCyan),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Pairing Log: ${device.plate}',
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            content: SizedBox(
              width: double.maxFinite,
              child: isLoading
                  ? const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppTheme.accentCyan)))
                  : (history.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No historical device pairings found.', style: TextStyle(color: AppTheme.textMuted)),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          itemCount: history.length,
                          separatorBuilder: (_, __) => const Divider(color: AppTheme.borderSubtle, height: 16),
                          itemBuilder: (context, idx) {
                            final h = history[idx] as Map<String, dynamic>;
                            final action = (h['action'] ?? 'PAIRED').toString();
                            final isCurrentlyActive = h['validTo'] == null;
                            final terminal = (h['terminalId'] ?? 'Unknown').toString();
                            final imei = (h['imei'] ?? '').toString();
                            final model = (h['deviceModel'] ?? 'GD19').toString();
                            final validFrom = (h['validFrom'] ?? '').toString();
                            final notes = (h['notes'] ?? '').toString();

                            Color actionColor = AppTheme.accentGreen;
                            if (action == 'UNPAIRED') actionColor = Colors.redAccent;
                            if (action == 'REASSIGNED') actionColor = Colors.amber;

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: actionColor.withOpacity(0.18),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: actionColor.withOpacity(0.5)),
                                      ),
                                      child: Text(action, style: TextStyle(color: actionColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '$model • $terminal',
                                        style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                                      ),
                                    ),
                                    if (isCurrentlyActive)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(color: AppTheme.statusOnline, borderRadius: BorderRadius.circular(4)),
                                        child: const Text('ACTIVE', style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.w900)),
                                      ),
                                  ],
                                ),
                                if (imei.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text('IMEI: $imei', style: const TextStyle(color: AppTheme.accentCyan, fontSize: 11, fontFamily: 'monospace')),
                                ],
                                const SizedBox(height: 2),
                                Text(
                                  isCurrentlyActive ? 'Paired on: $validFrom' : 'From: $validFrom -> To: ${h['validTo']}',
                                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                                ),
                                if (notes.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text('Note: $notes', style: const TextStyle(color: Colors.white70, fontSize: 10, fontStyle: FontStyle.italic)),
                                ],
                              ],
                            );
                          },
                        )),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close', style: TextStyle(color: AppTheme.accentCyan)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showAddDriverDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final licenseCtrl = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          title: Row(
            children: const [
              Icon(Icons.person_add_rounded, color: AppTheme.accentGreen),
              SizedBox(width: 8),
              Text('Add Driver', style: TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(labelText: 'Driver Full Name', labelStyle: TextStyle(color: AppTheme.textMuted)),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(labelText: 'Phone Number', labelStyle: TextStyle(color: AppTheme.textMuted)),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: licenseCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(labelText: 'Driver License #', labelStyle: TextStyle(color: AppTheme.textMuted)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentGreen),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Driver Name is required.')));
                        return;
                      }
                      setDlgState(() => isSubmitting = true);
                      try {
                        await ApiService.instance.createDriver(
                          name: nameCtrl.text.trim(),
                          phone: phoneCtrl.text.trim(),
                          licenseNumber: licenseCtrl.text.trim(),
                        );
                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Driver ' + nameCtrl.text + ' registered!')));
                        }
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to add driver: ' + e.toString())));
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Save Driver', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showChangeDriverDialog(DeviceItem device) async {
    List<dynamic> registeredDrivers = [];
    try {
      registeredDrivers = await ApiService.instance.getDrivers();
    } catch (_) {}

    String? selectedDriverId;
    final manualNameCtrl = TextEditingController();
    bool isSubmitting = false;

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          title: Row(
            children: const [
              Icon(Icons.badge_rounded, color: AppTheme.accentOrange),
              SizedBox(width: 8),
              Text('Change Driver', style: TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Vehicle: ' + device.plate, style: const TextStyle(color: AppTheme.accentCyan, fontWeight: FontWeight.w600)),
                Text('Current Driver: ' + device.driver, style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                const SizedBox(height: 14),
                if (registeredDrivers.isNotEmpty) ...[
                  const Text('Select Registered Driver:', style: TextStyle(color: AppTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.bgPrimary,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        dropdownColor: AppTheme.bgCard,
                        isExpanded: true,
                        value: selectedDriverId,
                        hint: const Text('Choose a driver...', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                        items: registeredDrivers.map<DropdownMenuItem<String>>((d) {
                          final dId = (d['id'] ?? '').toString();
                          final dName = (d['name'] ?? 'Driver').toString();
                          final dPhone = (d['phone'] ?? '').toString();
                          return DropdownMenuItem<String>(
                            value: dId,
                            child: Text(dName + (dPhone.isNotEmpty ? ' (' + dPhone + ')' : ''), style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setDlgState(() {
                            selectedDriverId = val;
                            if (val != null) manualNameCtrl.clear();
                          });
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Center(child: Text('— OR Enter Custom Driver —', style: TextStyle(color: AppTheme.textMuted, fontSize: 11))),
                  const SizedBox(height: 8),
                ],
                TextField(
                  controller: manualNameCtrl,
                  style: const TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Driver Full Name',
                    hintText: 'e.g. Marcus Vance',
                    labelStyle: TextStyle(color: AppTheme.textMuted),
                  ),
                  onChanged: (val) {
                    if (val.isNotEmpty && selectedDriverId != null) {
                      setDlgState(() => selectedDriverId = null);
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            if (device.driver != 'Unassigned Driver' && device.driver.isNotEmpty)
              TextButton(
                onPressed: isSubmitting
                    ? null
                    : () async {
                        setDlgState(() => isSubmitting = true);
                        try {
                          await ApiService.instance.unassignDriver(device.id);
                          if (mounted) {
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Driver unassigned.')));
                            context.read<DashboardProvider>().loadDevicesFromDatabase();
                          }
                        } catch (e) {
                          setDlgState(() => isSubmitting = false);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ' + e.toString())));
                          }
                        }
                      },
                child: const Text('Unassign', style: TextStyle(color: AppTheme.statusCritical)),
              ),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentOrange),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if ((selectedDriverId == null || selectedDriverId!.isEmpty) &&
                          manualNameCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select or enter a driver.')));
                        return;
                      }
                      setDlgState(() => isSubmitting = true);
                      try {
                        await ApiService.instance.assignDriver(
                          vehicleId: device.id,
                          driverId: selectedDriverId,
                          driverName: manualNameCtrl.text.trim().isNotEmpty ? manualNameCtrl.text.trim() : null,
                        );
                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Driver updated successfully!')));
                          context.read<DashboardProvider>().loadDevicesFromDatabase();
                        }
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error assigning driver: ' + e.toString())));
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Save Driver', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final dp = context.watch<DeviceProvider>();

    final activeDev = _selected ?? dash.selectedDevice ?? (dash.devices.isNotEmpty ? dash.devices.first : null);
    final lat = (activeDev != null && activeDev.lat != 0.0) ? activeDev.lat : 0.0;
    final lng = (activeDev != null && activeDev.lng != 0.0) ? activeDev.lng : 0.0;

    final filtered = dash.devices.where((d) {
      final matchFilter = _filter == 'ALL' || d.status == _filter;
      final matchSearch = _search.isEmpty ||
          d.plate.toLowerCase().contains(_search.toLowerCase()) ||
          d.terminalId.contains(_search) ||
          d.driver.toLowerCase().contains(_search.toLowerCase());
      return matchFilter && matchSearch;
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              color: AppTheme.bgCard,
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(Icons.map_rounded,
                          color: AppTheme.accentCyan, size: 22),
                      const SizedBox(width: 10),
                      const Text(
                        'Fleet',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.statusOnline.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: AppTheme.statusOnline,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '${dash.onlineVehicles} ONLINE',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.statusOnline,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),


                  // Quick Actions for Fleet & Drivers (Non-ELD support)
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: _showAddVehicleDialog,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.accentCyan.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.accentCyan.withOpacity(0.5)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.directions_car_rounded, size: 16, color: AppTheme.accentCyan),
                                SizedBox(width: 4),
                                Text(
                                  '+ Vehicle',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.accentCyan,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: InkWell(
                          onTap: _showAddDeviceDialog,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.accentPurple.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.accentPurple.withOpacity(0.5)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.add_to_queue_rounded, size: 16, color: AppTheme.accentPurple),
                                SizedBox(width: 4),
                                Text(
                                  '+ DashCam',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.accentPurple,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: InkWell(
                          onTap: _showAddDriverDialog,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.accentGreen.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.accentGreen.withOpacity(0.4)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.person_add_rounded, size: 16, color: AppTheme.accentGreen),
                                SizedBox(width: 4),
                                Text(
                                  '+ Driver',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.accentGreen,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Search
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    style: const TextStyle(
                        color: AppTheme.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search vehicles...',
                      prefixIcon: const Icon(Icons.search_rounded,
                          color: AppTheme.textMuted),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Filter pills
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: ['ALL', 'ONLINE', 'IDLE', 'OFFLINE']
                          .map((f) {
                        final isActive = _filter == f;
                        final color = f == 'ONLINE'
                            ? AppTheme.statusOnline
                            : f == 'IDLE'
                                ? AppTheme.statusWarning
                                : f == 'OFFLINE'
                                    ? AppTheme.statusOffline
                                    : AppTheme.accentCyan;
                        return GestureDetector(
                          onTap: () => setState(() => _filter = f),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? color.withOpacity(0.2)
                                  : AppTheme.bgCardHover,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isActive ? color : AppTheme.borderSubtle,
                                width: isActive ? 1.5 : 1,
                              ),
                            ),
                            child: Text(
                              f,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isActive ? color : AppTheme.textMuted,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),

            // Live Interactive Truck Map
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: LiveTruckMapView(
                lat: (lat != 0.0) ? lat : 37.7749,
                lng: (lng != 0.0) ? lng : -122.4194,
                heading: (activeDev?.heading ?? 0).toDouble(),
                speedMph: ((activeDev?.speed ?? 0) * 0.621371),
                plate: activeDev?.plate ?? 'Active Dashcam',
                status: activeDev?.status ?? 'ONLINE',
                height: 185,
              ),
            ),
            // Device list
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.search_off_rounded,
                              color: AppTheme.textMuted, size: 48),
                          SizedBox(height: 12),
                          Text('No vehicles found',
                              style: TextStyle(color: AppTheme.textMuted)),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) {
                        final device = filtered[i];
                        final isSelected = _selected?.id == device.id;
                        return GestureDetector(
                          onTap: () {
                            setState(() => _selected = device);
                            dash.selectDevice(device);
                            dp.selectServerDevice(device.terminalId, device.plate);
                          },
                          child: _FleetDeviceCard(
                            device: device,
                            isSelected: isSelected,
                            onChangeDriver: () => _showChangeDriverDialog(device),
                            onUnpair: () => _showUnpairDialog(device),
                            onShowHistory: () => _showPairingHistoryDialog(device),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FleetDeviceCard extends StatelessWidget {
  final DeviceItem device;
  final bool isSelected;
  final VoidCallback? onChangeDriver;
  final VoidCallback? onUnpair;
  final VoidCallback? onShowHistory;

  const _FleetDeviceCard({
    required this.device,
    required this.isSelected,
    this.onChangeDriver,
    this.onUnpair,
    this.onShowHistory,
  });

  @override
  Widget build(BuildContext context) {
    final dash = context.read<DashboardProvider>();
    final dp = context.read<DeviceProvider>();
    final statusColor = device.isOnline
        ? AppTheme.statusOnline
        : device.isIdle
            ? AppTheme.statusWarning
            : AppTheme.statusOffline;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected ? AppTheme.accentCyan : AppTheme.borderSubtle,
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: AppTheme.accentCyan.withOpacity(0.15),
                  blurRadius: 12,
                )
              ]
            : [],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.local_shipping_rounded,
                      color: statusColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          Text(
                            device.plate,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          StatusBadge(
                            label: device.status,
                            color: statusColor,
                            pulsing: device.isOnline,
                          ),
                          _PairingStatusBadge(status: device.pairingStatus),
                        ],
                      ),
                      if (device.vin.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          'VIN: ${device.vin}',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppTheme.textMuted,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              device.driver,
                              style: const TextStyle(
                                  fontSize: 12, color: AppTheme.textMuted),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: onChangeDriver,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: AppTheme.accentOrange.withOpacity(0.5)),
                              ),
                              child: const Text('Change', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.accentOrange)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            'Model: ${device.deviceModel.isNotEmpty ? device.deviceModel : "GD19"}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppTheme.accentCyan,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Terminal: ${device.terminalId}',
                              style: const TextStyle(
                                  fontSize: 10,
                                  color: AppTheme.textMuted,
                                  fontFamily: 'monospace'),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${(device.speed * 0.621371).round()}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const Text('mph',
                        style: TextStyle(
                            fontSize: 10, color: AppTheme.textMuted)),
                    Text(
                      device.lastPing,
                      style: const TextStyle(
                          fontSize: 10, color: AppTheme.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Expanded telemetry HUD
          if (isSelected)
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              decoration: BoxDecoration(
                color: AppTheme.bgPrimary.withOpacity(0.5),
                borderRadius:
                    const BorderRadius.vertical(bottom: Radius.circular(14)),
                border: Border(
                  top: BorderSide(color: AppTheme.borderSubtle),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      _HudItem(
                          label: 'Heading',
                          value: '${device.heading.toStringAsFixed(0)}° E'),
                      _HudItem(
                          label: 'Altitude',
                          value: '${(device.altitude * 3.28084).round()} ft'),
                      _HudItem(
                          label: 'Lat',
                          value: device.lat.toStringAsFixed(4)),
                      _HudItem(
                          label: 'Lng',
                          value: device.lng.toStringAsFixed(4)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.play_circle_rounded,
                          label: 'Live View',
                          color: AppTheme.accentCyan,
                          onTap: () {
                            dash.selectDevice(device);
                            dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                            context.go('/camera');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.settings_remote_rounded,
                          label: 'Settings',
                          color: AppTheme.accentGreen,
                          onTap: () {
                            dash.selectDevice(device);
                            dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                            context.go('/device-management');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.timeline_rounded,
                          label: 'History',
                          color: AppTheme.accentPurple,
                          onTap: () {
                            dash.selectDevice(device);
                            dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                            context.go('/playback');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.badge_rounded,
                          label: 'Driver',
                          color: AppTheme.accentOrange,
                          onTap: onChangeDriver ?? () {},
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.history_rounded,
                          label: 'Pairing Log',
                          color: AppTheme.accentCyan,
                          onTap: onShowHistory ?? () {},
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _ActionBtn(
                          icon: Icons.link_off_rounded,
                          label: 'Unpair DashCam',
                          color: AppTheme.statusCritical,
                          onTap: onUnpair ?? () {},
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PairingStatusBadge extends StatelessWidget {
  final String status;
  const _PairingStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    switch (status.toUpperCase()) {
      case 'PAIRED_VERIFIED':
        color = AppTheme.statusOnline;
        label = 'VERIFIED';
        break;
      case 'SUSPECTED_MISMATCH':
        color = AppTheme.statusCritical;
        label = 'MISMATCH';
        break;
      case 'ELD_OFFLINE':
        color = AppTheme.statusWarning;
        label = 'ELD OFFLINE';
        break;
      case 'DASHCAM_OFFLINE':
        color = AppTheme.statusOffline;
        label = 'CAM OFFLINE';
        break;
      case 'NO_ELD_CONNECTED':
        color = AppTheme.accentCyan;
        label = 'STANDALONE';
        break;
      case 'UNVERIFIED':
      default:
        color = Colors.amber;
        label = 'UNVERIFIED';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _HudItem extends StatelessWidget {
  final String label;
  final String value;
  const _HudItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label,
              style: const TextStyle(fontSize: 9, color: AppTheme.textMuted)),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w600, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x1200D4FF)
      ..strokeWidth = 1;

    for (double x = 0; x < size.width; x += 30) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 30) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
