import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/services/api_service.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  String _filter = 'ALL';
  bool _isLoading = false;
  List<_Event> _events = [];

  @override
  void initState() {
    super.initState();
    _fetchEvents();
  }

  Future<void> _fetchEvents() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.instance.get('/events');
      final raw = (res['events'] ?? []) as List;
      if (mounted) {
        setState(() {
          _events = raw.map((e) {
            return _Event(
              type: (e['eventCategory'] ?? e['eventName'] ?? 'SAFETY_ALERT')
                  .toString()
                  .toUpperCase()
                  .replaceAll(' ', '_'),
              plate: (e['assetName'] ?? 'Dashcam Vehicle').toString(),
              terminalId: (e['imei'] ?? '').toString(),
              driver: (e['driverName'] ?? 'Assigned Driver').toString(),
              time: (e['time'] ?? 'Just now').toString(),
              speed: ((e['speed'] ?? 0) as num).toDouble(),
              severity: (e['severity'] ?? 'MEDIUM').toString().toUpperCase(),
              mediaState: (e['roadCamVideoUrl'] != null || e['cabinCamVideoUrl'] != null)
                  ? 'READY'
                  : 'PROCESSING',
              audioAvailable: true,
              gForce: 0.0,
              videoUrl: (e['roadCamVideoUrl'] ?? e['cabinCamVideoUrl'])?.toString(),
            );
          }).toList();
        });
      }
    } catch (_) {
      // Empty or error from server
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'ALL'
        ? _events
        : _events.where((e) => e.type == _filter).toList();

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
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.statusCritical.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.warning_amber_rounded,
                            color: AppTheme.statusCritical, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Safety Events & Evidence',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            Text(
                              'Incident clips with synchronized AAC audio',
                              style: TextStyle(
                                  fontSize: 11, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                      StatusBadge(
                        label: '${_events.length} EVENTS',
                        color: AppTheme.statusCritical,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Filter chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        'ALL',
                        'EMERGENCY_SOS',
                        'COLLISION_ALERT',
                        'DMS_FATIGUE',
                        'OVERSPEED_WARNING',
                      ].map((f) {
                        final isActive = _filter == f;
                        return GestureDetector(
                          onTap: () => setState(() => _filter = f),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? AppTheme.statusCritical.withOpacity(0.2)
                                  : AppTheme.bgCardHover,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isActive
                                    ? AppTheme.statusCritical
                                    : AppTheme.borderSubtle,
                              ),
                            ),
                            child: Text(
                              f.replaceAll('_', ' '),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isActive
                                    ? AppTheme.statusCritical
                                    : AppTheme.textMuted,
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

            // Events list
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppTheme.accentCyan),
                    )
                  : filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: AppTheme.bgCard,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.shield_outlined,
                                  color: AppTheme.textMuted,
                                  size: 48,
                                ),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'No Safety Alerts Recorded',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Real-time collision, harsh braking, and SOS events\nwill appear here when detected by dashcam.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: _fetchEvents,
                                icon: const Icon(Icons.refresh_rounded, size: 16),
                                label: const Text('Refresh Alerts'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.bgCardHover,
                                  foregroundColor: AppTheme.accentCyan,
                                ),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _fetchEvents,
                          color: AppTheme.accentCyan,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) => _EventCard(event: filtered[i]),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  final _Event event;
  const _EventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    final severityColor = event.severity == 'CRITICAL'
        ? AppTheme.statusCritical
        : event.severity == 'HIGH'
            ? AppTheme.statusWarning
            : AppTheme.accentCyan;

    final mediaColor = event.mediaState == 'READY'
        ? AppTheme.statusOnline
        : event.mediaState == 'PROCESSING'
            ? AppTheme.statusWarning
            : AppTheme.statusOffline;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: severityColor.withOpacity(0.3),
          width: event.severity == 'CRITICAL' ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: severityColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: severityColor.withOpacity(0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _eventEmoji(event.type),
                            style: const TextStyle(fontSize: 12),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            event.type.replaceAll('_', ' '),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: severityColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      event.time,
                      style: const TextStyle(
                          fontSize: 11, color: AppTheme.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(Icons.local_shipping_rounded,
                        size: 14, color: AppTheme.textMuted),
                    const SizedBox(width: 6),
                    Text(
                      event.plate,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• ${event.driver}',
                      style: const TextStyle(
                          fontSize: 12, color: AppTheme.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _MetaChip(
                        label: '${(event.speed * 0.621371).round()} MPH',
                        icon: Icons.speed_rounded,
                        color: event.speed > 80
                            ? AppTheme.statusCritical
                            : AppTheme.textMuted),
                    const SizedBox(width: 8),
                    if (event.gForce > 0)
                      _MetaChip(
                        label: '${event.gForce.toStringAsFixed(1)}G',
                        icon: Icons.vibration_rounded,
                        color: event.gForce > 2
                            ? AppTheme.statusCritical
                            : AppTheme.statusWarning,
                      ),
                    if (event.gForce > 0) const SizedBox(width: 8),
                    if (event.audioAvailable)
                      _MetaChip(
                        label: 'AAC Audio',
                        icon: Icons.mic_rounded,
                        color: AppTheme.accentGreen,
                      ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            decoration: BoxDecoration(
              color: AppTheme.bgPrimary.withOpacity(0.5),
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(14)),
              border: Border(top: BorderSide(color: AppTheme.borderSubtle)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: mediaColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: mediaColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Media: ${event.mediaState}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: mediaColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  '7-Day TTL',
                  style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
                ),
                const Spacer(),
                if (event.mediaState == 'READY')
                  GestureDetector(
                    onTap: () => _showEvidenceSheet(context, event),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.accentCyan, AppTheme.accentPurple],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.play_circle_rounded,
                              color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'View Clip',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _eventEmoji(String type) {
    switch (type) {
      case 'EMERGENCY_SOS': return '🚨';
      case 'COLLISION_ALERT': return '💥';
      case 'DMS_FATIGUE': return '😴';
      case 'OVERSPEED_WARNING': return '⚡';
      default: return '⚠️';
    }
  }

  void _showEvidenceSheet(BuildContext context, _Event event) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (_, ctrl) => SingleChildScrollView(
          controller: ctrl,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_eventEmoji(event.type)} Evidence Clip',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded,
                        color: AppTheme.textMuted),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              Text(
                '${event.plate} • ${event.time}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 20),
              // Real Evidence Media Proof
              Container(
                height: 160,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: event.videoUrl != null
                          ? AppTheme.accentCyan.withOpacity(0.5)
                          : AppTheme.borderSubtle),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        event.videoUrl != null
                            ? Icons.videocam_rounded
                            : Icons.cloud_sync_outlined,
                        color: event.videoUrl != null
                            ? AppTheme.accentCyan
                            : Colors.white38,
                        size: 42,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        event.videoUrl != null
                            ? 'Recorded Evidence Clip Available'
                            : 'Hardware Storage Sync in Progress',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 13),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        event.videoUrl != null
                            ? event.videoUrl!
                            : 'Dashcam terminal: ${event.terminalId}',
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white38,
                            fontSize: 11,
                            fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              GlassCard(
                child: Column(
                  children: [
                    _InfoItem('Speed at Alert', '${(event.speed * 0.621371).round()} MPH'),
                    _InfoItem('Driver Assigned', event.driver),
                    _InfoItem('Dashcam IMEI', event.terminalId),
                    _InfoItem('Audio Stream',
                        event.audioAvailable ? 'AAC 48kHz (Active)' : 'Silent'),
                    _InfoItem('Media Status', event.mediaState),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (event.videoUrl != null && event.videoUrl!.isNotEmpty)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('Stream Recorded Clip'),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;
  const _InfoItem(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  const _MetaChip({required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}

class _Event {
  final String type, plate, terminalId, driver, time, severity, mediaState;
  final double speed, gForce;
  final bool audioAvailable;
  final String? videoUrl;

  const _Event({
    required this.type,
    required this.plate,
    required this.terminalId,
    required this.driver,
    required this.time,
    required this.speed,
    required this.severity,
    required this.mediaState,
    required this.audioAvailable,
    required this.gForce,
    this.videoUrl,
  });
}
