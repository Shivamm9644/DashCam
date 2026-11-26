import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/dashboard_provider.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  DateTime _selectedDate = DateTime.now();

  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final dev = dash.selectedDevice ?? (dash.devices.isNotEmpty ? dash.devices.first : null);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 16,
        automaticallyImplyLeading: false,
        title: const Text(
          'Statistics',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: Color(0xFF0F172A),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_rounded, color: Color(0xFF0284C7), size: 20),
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime(2024),
                lastDate: DateTime.now(),
              );
              if (picked != null) setState(() => _selectedDate = picked);
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Vehicle & Date Chip
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.directions_car_rounded, size: 18, color: Color(0xFF0284C7)),
                    const SizedBox(width: 6),
                    Text(
                      dev?.plate ?? 'GBT-CAM-01',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year} (Today)',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 1. Riding Behaviour Score Card (Matching Trackify exact card)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Riding Behaviour',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              Text(
                                '100%',
                                style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Excellent',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            '+0% vs previous period',
                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 30),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 2. Journey Section (Distance & Duration)
            _buildSectionHeader('Journey'),
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    title: 'Distance Travelled',
                    value: '10.8 km',
                    change: '-43% vs previous period',
                    isPositive: false,
                    iconPath: 'assets/icons/distanceTravelled.png',
                    fallbackIcon: Icons.route_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricTile(
                    title: 'Time Duration',
                    value: '42m',
                    change: '-50% vs previous period',
                    isPositive: false,
                    iconPath: 'assets/icons/timeDurationIcon.png',
                    fallbackIcon: Icons.timer_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 3. Speed Section (Average & Top Speed)
            _buildSectionHeader('Speed'),
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    title: 'Average Speed',
                    value: '19.0 km/hr',
                    change: '+9% vs previous period',
                    isPositive: true,
                    iconPath: 'assets/icons/averageSpeedIcon.png',
                    fallbackIcon: Icons.speed_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricTile(
                    title: 'Top Speed',
                    value: '43.0 km/hr',
                    change: '-31% vs previous period',
                    isPositive: false,
                    iconPath: 'assets/icons/arrowUpIcon.png',
                    fallbackIcon: Icons.arrow_upward_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 4. Fuel Section
            _buildSectionHeader('Fuel'),
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    title: 'Fuel Consumed',
                    value: '0.4 L',
                    change: 'Economical',
                    isPositive: true,
                    iconPath: 'assets/icons/fuel.png',
                    fallbackIcon: Icons.local_gas_station_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricTile(
                    title: 'Fuel Cost',
                    value: '₹42.0',
                    change: 'Estimated Today',
                    isPositive: true,
                    iconPath: 'assets/icons/fuel.png',
                    fallbackIcon: Icons.currency_rupee_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 5. Dashcam ADAS Safety Events
            _buildSectionHeader('AI Dashcam Safety Telematics'),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildEventRow('Harsh Braking Incidents', '0 Events', const Color(0xFF10B981)),
                  const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  _buildEventRow('Rapid Acceleration', '0 Events', const Color(0xFF10B981)),
                  const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  _buildEventRow('Overspeeding Warnings', '0 Events', const Color(0xFF10B981)),
                  const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  _buildEventRow('Driver Fatigue / Distraction', 'Normal', const Color(0xFF10B981)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String change,
    required bool isPositive,
    required String iconPath,
    required IconData fallbackIcon,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
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
              Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
              Image.asset(
                iconPath,
                width: 18,
                height: 18,
                errorBuilder: (_, __, ___) => Icon(fallbackIcon, size: 16, color: const Color(0xFF0284C7)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 4),
          Text(
            change,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: isPositive ? const Color(0xFF10B981) : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventRow(String title, String count, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF334155))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            count,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
          ),
        ),
      ],
    );
  }
}
