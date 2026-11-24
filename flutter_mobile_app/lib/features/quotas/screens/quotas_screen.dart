import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../main.dart';

class QuotasScreen extends StatelessWidget {
  const QuotasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final user = auth.user;
    final totalDevs = (user?.role == 'CUSTOMER' || user?.role == 'RETAILER')
        ? (user?.assignedTerminals.length ?? 1)
        : dash.devices.length;
    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              automaticallyImplyLeading: false,
              backgroundColor: AppTheme.bgCard,
              title: Row(
                children: [
                  InkWell(
                    onTap: () => context.go('/dashboard'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: const Icon(Icons.arrow_back_rounded,
                          color: Color(0xFF0F172A), size: 20),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text('Fleet Bandwidth & Quotas'),
                ],
              ),
              floating: true,
              snap: true,
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Cost Architecture Card
                  GlassCard(
                    borderColor: AppTheme.accentGreen.withOpacity(0.3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            ShaderMask(
                              shaderCallback: (b) => const LinearGradient(
                                colors: [AppTheme.accentGreen, AppTheme.accentCyan],
                              ).createShader(b),
                              child: const Text(
                                '100 GB',
                                style: TextStyle(
                                  fontSize: 42,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'Monthly Data Pool',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                StatusBadge(
                                  label: 'ENTERPRISE POOL',
                                  color: AppTheme.accentGreen,
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: 2.2,
                          children: const [
                            _CostBox(
                                label: 'Fleet Bandwidth',
                                value: '100 GB',
                                sub: 'High-speed 4G LTE',
                                color: AppTheme.accentCyan),
                            _CostBox(
                                label: 'Edge SD Storage',
                                value: '128 GB',
                                sub: 'FIFO Loop Buffer',
                                color: AppTheme.statusOnline),
                            _CostBox(
                                label: 'Live Video Relay',
                                value: '120 min',
                                sub: 'Per device quota',
                                color: AppTheme.statusWarning),
                            _CostBox(
                                label: 'Network Uptime',
                                value: '99.98%',
                                sub: 'Tier-1 SLA',
                                color: AppTheme.accentGreen),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCardHover,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Text(
                            '💡 No continuous cloud streaming. Footage stays on device SD card (up to 256GB). Cloud storage is event-triggered only (Crash, SOS, Fatigue) with 7-day rolling expiry.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                              height: 1.6,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Quota Meters
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.data_usage_rounded,
                                color: AppTheme.accentCyan, size: 18),
                            const SizedBox(width: 8),
                            const Text(
                              'Tenant Quota Consumption',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const Spacer(),
                            StatusBadge(
                              label: 'HEALTHY',
                              color: AppTheme.statusOnline,
                              pulsing: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _QuotaMeter(
                          label: 'Stored Event Media (7-day Rolling TTL)',
                          used: 84,
                          total: 250,
                          unit: 'MB',
                          color: AppTheme.accentCyan,
                        ),
                        const SizedBox(height: 16),
                        _QuotaMeter(
                          label: 'Monthly Cloud Upload Allowance',
                          used: 420,
                          total: 1024,
                          unit: 'MB',
                          color: AppTheme.accentPurple,
                        ),
                        const SizedBox(height: 16),
                        _QuotaMeter(
                          label: 'Live Stream Relay (30 min / device cap)',
                          used: 14.5,
                          total: 30.0,
                          unit: 'min',
                          color: AppTheme.statusWarning,
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCardHover,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: const [
                              Icon(Icons.lock_outline_rounded,
                                  size: 14, color: AppTheme.statusCritical),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Hard ceiling enforcement. At 100%, metadata preserved as MEDIA_NOT_SAVED_QUOTA — zero billing surprise guarantee.',
                                  style: TextStyle(
                                      fontSize: 11, color: AppTheme.textMuted, height: 1.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Subscription status
                  GlassCard(
                    borderColor: AppTheme.accentPurple.withOpacity(0.3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.card_membership_rounded,
                                color: AppTheme.accentPurple, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'Active Subscription',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _SubRow('Plan', user?.role == 'SUPER_ADMIN' ? 'Platform Master Enterprise' : (user?.role == 'RETAILER' ? 'Commercial Fleet Dual-Cam SaaS' : 'Retail Vehicle Telematics')),
                        _SubRow('Billing', 'Commercial Fleet Video Telematics'),
                        _SubRow('Tenant', user?.tenantName ?? 'TrackAnywhere Fleet'),
                        _SubRow('Devices', '$totalDevs Licensed Dashcams'),
                        _SubRow('Licensing', 'Annual SaaS Active'),
                        _SubRow('Status', 'ACTIVE', valueColor: AppTheme.statusOnline),
                      ],
                    ),
                  ),

                  const SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CostBox extends StatelessWidget {
  final String label, value, sub;
  final Color color;

  const _CostBox({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label,
              style: TextStyle(fontSize: 9, color: AppTheme.textMuted)),
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: color)),
          Text(sub,
              style: TextStyle(fontSize: 9, color: AppTheme.textMuted),
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _QuotaMeter extends StatelessWidget {
  final String label, unit;
  final double used, total;
  final Color color;

  const _QuotaMeter({
    required this.label,
    required this.used,
    required this.total,
    required this.unit,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final pct = (used / total).clamp(0.0, 1.0);
    final pctDisplay = (pct * 100).toStringAsFixed(1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary)),
            ),
            Text(
              '$used $unit / $total $unit ($pctDisplay%)',
              style: const TextStyle(
                  fontSize: 11, color: AppTheme.textMuted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 8,
            backgroundColor: AppTheme.bgCardHover,
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
      ],
    );
  }
}

class _SubRow extends StatelessWidget {
  final String label, value;
  final Color? valueColor;

  const _SubRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor ?? AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
