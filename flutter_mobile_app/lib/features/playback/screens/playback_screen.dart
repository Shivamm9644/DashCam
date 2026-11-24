import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../main.dart';

class PlaybackScreen extends StatefulWidget {
  const PlaybackScreen({super.key});

  @override
  State<PlaybackScreen> createState() => _PlaybackScreenState();
}

class _PlaybackScreenState extends State<PlaybackScreen> {
  DateTime _selectedDate = DateTime.now();
  int _activeChannel = 1; // 1 = Road Cam (Front), 2 = Cabin DMS
  int _selectedClipIndex = 0;
  double _playbackSpeed = 1.0;

  VideoPlayerController? _videoController;
  bool _isPlaying = false;
  bool _isPlayerInitialized = false;
  bool _isBuffering = true;
  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = const Duration(minutes: 5);
  Timer? _positionTimer;

  // Clip segments recorded on Dashcam MicroSD Card (strictly real/fresh from server)
  List<Map<String, dynamic>> _clips = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchClipsForDate(_selectedDate);
    });
  }

  Future<void> _fetchClipsForDate(DateTime date) async {
    _positionTimer?.cancel();
    _videoController?.dispose();
    _videoController = null;

    setState(() {
      _clips = [];
      _isBuffering = true;
      _isPlayerInitialized = false;
      _isPlaying = false;
      _currentPosition = Duration.zero;
      _totalDuration = Duration.zero;
    });

    final dp = context.read<DeviceProvider>();
    final dash = context.read<DashboardProvider>();
    final auth = context.read<AuthProvider>();
    final user = auth.user;

    // Resolve active vehicle terminal ID
    String terminalId = dp.systemStatus.imei;
    if (terminalId.isEmpty) {
      if (dash.selectedDevice != null && dash.selectedDevice!.terminalId.isNotEmpty) {
        terminalId = dash.selectedDevice!.terminalId;
      } else if (user?.assignedTerminals.isNotEmpty == true) {
        terminalId = user!.assignedTerminals.first;
      } else if (dash.devices.isNotEmpty) {
        terminalId = dash.devices.first.terminalId;
      }
    }

    final camId = _activeChannel == 2 ? 1 : 0;
    final dateStr = DateFormat('yyyy-MM-dd').format(date);

    if (terminalId.isNotEmpty) {
      try {
        final res = await ApiService.instance.get('/video/recordings?terminalId=$terminalId&channel=$camId&date=$dateStr');
        if (res.containsKey('recordings') && res['recordings'] is List) {
          final list = res['recordings'] as List;
          final List<Map<String, dynamic>> parsed = [];
          for (var item in list) {
            if (item is Map) {
              parsed.add({
                'start': item['startTime']?.toString() ?? '',
                'end': item['endTime']?.toString() ?? '',
                'type': (item['alarm'] == true) ? 'SOS Impact Lock' : 'Normal Loop',
                'size': item['fileSize'] != null ? '${((item['fileSize'] as num) / (1024 * 1024)).toStringAsFixed(1)} MB' : 'Local SD',
                'isSos': item['alarm'] == true,
                'url': item['url']?.toString() ?? '',
              });
            }
          }
          if (mounted) {
            setState(() {
              _clips = parsed;
              _isBuffering = false;
            });
            if (_clips.isNotEmpty) {
              _initializePlaybackStream();
            }
            return;
          }
        }
      } catch (_) {}
    }

    if (mounted) {
      setState(() {
        _clips = [];
        _isBuffering = false;
      });
    }
  }

  void _generateClipsForDate(DateTime date) {
    _fetchClipsForDate(date);
  }

  Future<void> _initializePlaybackStream() async {
    if (_clips.isEmpty) {
      setState(() {
        _isBuffering = false;
        _isPlayerInitialized = false;
        _isPlaying = false;
        _currentPosition = Duration.zero;
        _totalDuration = Duration.zero;
      });
      return;
    }

    setState(() {
      _isBuffering = true;
      _isPlayerInitialized = false;
    });

    _positionTimer?.cancel();
    _videoController?.dispose();
    _videoController = null;

    final dp = context.read<DeviceProvider>();
    final terminalId = dp.systemStatus.imei;
    final currentClip = _clips.isNotEmpty ? _clips[_selectedClipIndex % _clips.length] : null;
    final clipUrl = currentClip?['url']?.toString() ?? '';

    final streamUrl = clipUrl.isNotEmpty
        ? clipUrl
        : 'https://3.85.81.10/media/live/${terminalId}_$_activeChannel/live.m3u8';

    try {
      _videoController = VideoPlayerController.networkUrl(
        Uri.parse(streamUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      await _videoController!.initialize().timeout(const Duration(seconds: 5));
      await _videoController!.setPlaybackSpeed(_playbackSpeed);
      await _videoController!.play();

      if (mounted) {
        setState(() {
          _isPlayerInitialized = true;
          _isBuffering = false;
          _isPlaying = true;
          _totalDuration = _videoController!.value.duration > Duration.zero
              ? _videoController!.value.duration
              : const Duration(minutes: 5);
        });
      }

      _startPositionTracker();
    } catch (_) {
      if (mounted) {
        setState(() {
          _isPlayerInitialized = false;
          _isBuffering = false;
          _isPlaying = false;
        });
      }
    }
  }

  void _startPositionTracker() {
    _positionTimer?.cancel();
    _positionTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || !_isPlaying) return;
      if (_videoController != null && _videoController!.value.isInitialized) {
        setState(() {
          _currentPosition = _videoController!.value.position;
        });
      } else {
        setState(() {
          if (_currentPosition < _totalDuration) {
            _currentPosition += const Duration(seconds: 1);
          } else {
            _currentPosition = Duration.zero;
          }
        });
      }
    });
  }

  void _seekTo(Duration target) {
    var clamped = target;
    if (clamped < Duration.zero) clamped = Duration.zero;
    if (clamped > _totalDuration) clamped = _totalDuration;

    setState(() => _currentPosition = clamped);
    _videoController?.seekTo(clamped);
  }

  void _togglePlayPause() {
    setState(() => _isPlaying = !_isPlaying);
    if (_isPlaying) {
      _videoController?.play();
    } else {
      _videoController?.pause();
    }
  }

  void _toggleSpeed() {
    double nextSpeed = 1.0;
    if (_playbackSpeed == 1.0) nextSpeed = 2.0;
    else if (_playbackSpeed == 2.0) nextSpeed = 4.0;
    else nextSpeed = 1.0;

    setState(() => _playbackSpeed = nextSpeed);
    _videoController?.setPlaybackSpeed(nextSpeed);
  }

  @override
  void dispose() {
    _positionTimer?.cancel();
    _videoController?.pause();
    _videoController?.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final dp = context.watch<DeviceProvider>();
    final dash = context.watch<DashboardProvider>();
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    final visibleDevices = dash.devices.where((d) {
      if (user?.role == 'RETAILER') {
        final assigned = user?.assignedTerminals ?? [];
        if (assigned.isNotEmpty) {
          return assigned.contains(d.terminalId) || assigned.contains(d.id);
        }
      }
      return true;
    }).toList();

    final activeDevice = visibleDevices.firstWhere(
      (d) => d.terminalId == dp.systemStatus.imei,
      orElse: () => (visibleDevices.isNotEmpty
          ? visibleDevices.first
          : (dash.devices.isNotEmpty
              ? dash.devices.first
              : DeviceItem(
                  id: dp.systemStatus.imei,
                  plate: 'Dashcam ${dp.systemStatus.imei.isNotEmpty ? dp.systemStatus.imei : "101"}',
                  terminalId: dp.systemStatus.imei,
                  driver: 'Unassigned',
                  speed: 0,
                  status: dp.systemStatus.isOnline ? 'ONLINE' : 'OFFLINE',
                  lat: 0.0,
                  lng: 0.0,
                  lastPing: '',
                  heading: 0,
                  altitude: 0,
                ))),
    );

    final dateFormat = DateFormat('EEE, MM/dd/yyyy');
    final formattedDate = dateFormat.format(_selectedDate);

    final currentClip = _clips.isNotEmpty ? _clips[_selectedClipIndex % _clips.length] : null;

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar
            _buildHeader(dp, dash, visibleDevices, activeDevice),

            // UPPER HALF: Video Viewport & Camera Switcher
            _buildUpperCameraSection(dp, currentClip),

            // LOWER HALF: Date, Time Scrubber & Clip Timeline
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: 24),
                child: Column(
                  children: [
                    // 1. Date Selector Bar
                    _buildDateSelectorBar(formattedDate),

                    // 2. Interactive Scrubber Controls (Aage / Piche Control)
                    _buildScrubberControls(currentClip),

                    // 3. Time Segments / Clips List for Selected Date
                    _buildTimeSegmentsList(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    DeviceProvider dp,
    DashboardProvider dash,
    List<DeviceItem> visibleDevices,
    DeviceItem activeDevice,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
      decoration: BoxDecoration(
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
              child: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A), size: 22),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PopupMenuButton<DeviceItem>(
                  tooltip: 'Select Truck for Playback',
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          activeDevice.plate,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFF0284C7), size: 20),
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.accentGreen.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppTheme.accentGreen.withOpacity(0.4)),
                        ),
                        child: Text(
                          _activeChannel == 1 ? 'CH1 ROAD' : 'CH2 CABIN',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.accentGreen,
                          ),
                        ),
                      ),
                    ],
                  ),
                  onSelected: (device) {
                    dash.selectDevice(device);
                    dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
                    _initializePlaybackStream();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: AppTheme.bgCard,
                        content: Text('Switched playback to ${device.plate} (${device.terminalId})'),
                        duration: const Duration(seconds: 1),
                      ),
                    );
                  },
                  itemBuilder: (context) => visibleDevices.map((device) {
                    final isCurrent = device.terminalId == activeDevice.terminalId;
                    return PopupMenuItem<DeviceItem>(
                      value: device,
                      child: Row(
                        children: [
                          Icon(
                            Icons.local_shipping_rounded,
                            size: 18,
                            color: isCurrent ? const Color(0xFF0284C7) : AppTheme.textMuted,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  device.plate,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
                                    color: isCurrent ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  'IMEI: ${device.terminalId} • ${(device.driver.isNotEmpty && device.driver != 'Assigned Driver') ? device.driver : "Unassigned"}',
                                  style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                ),
                              ],
                            ),
                          ),
                          if (isCurrent)
                            const Icon(Icons.check_rounded, size: 16, color: Color(0xFF0284C7)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 2),
                Text(
                  'Terminal: ${activeDevice.terminalId} • MicroSD Playback',
                  style: const TextStyle(fontSize: 11, color: AppTheme.accentCyan, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          // Truck Quick Switcher
          PopupMenuButton<DeviceItem>(
            tooltip: 'Switch Dashcam Truck',
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF0284C7).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF0284C7).withOpacity(0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.swap_horiz_rounded, color: Color(0xFF0284C7), size: 16),
                  SizedBox(width: 4),
                  Text(
                    'Switch',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0284C7),
                    ),
                  ),
                ],
              ),
            ),
            onSelected: (device) {
              dash.selectDevice(device);
              dp.selectServerDevice(device.terminalId, device.plate, isOnline: device.isOnline);
              _initializePlaybackStream();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: AppTheme.bgCard,
                  content: Text('Switched playback to ${device.plate} (${device.terminalId})'),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
            itemBuilder: (context) => visibleDevices.map((device) {
              final isCurrent = device.terminalId == activeDevice.terminalId;
              return PopupMenuItem<DeviceItem>(
                value: device,
                child: Row(
                  children: [
                    Icon(
                      Icons.local_shipping_rounded,
                      size: 16,
                      color: isCurrent ? AppTheme.accentGreen : AppTheme.textMuted,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            device.plate,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                              color: isCurrent ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            'IMEI: ${device.terminalId}',
                            style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // UPPER SECTION: Video Frame & Camera Switcher
  Widget _buildUpperCameraSection(DeviceProvider dp, Map<String, dynamic>? currentClip) {
    return Column(
      children: [
        // Camera Channel Switcher (CH1 Front Road / CH2 Cabin DMS)
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (_activeChannel != 1) {
                      setState(() => _activeChannel = 1);
                      _initializePlaybackStream();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: _activeChannel == 1 ? const Color(0xFF0284C7) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _activeChannel == 1 ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1),
                        width: _activeChannel == 1 ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.directions_car_rounded,
                          size: 15,
                          color: _activeChannel == 1 ? Colors.white : const Color(0xFF475569),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'CH1: Road Cam (Front)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _activeChannel == 1 ? Colors.white : const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (_activeChannel != 2) {
                      setState(() => _activeChannel = 2);
                      _initializePlaybackStream();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: _activeChannel == 2 ? const Color(0xFF0284C7) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _activeChannel == 2 ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1),
                        width: _activeChannel == 2 ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.face_rounded,
                          size: 15,
                          color: _activeChannel == 2 ? Colors.white : const Color(0xFF475569),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'CH2: Cabin Cam (DMS)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _activeChannel == 2 ? Colors.white : const Color(0xFF475569),
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

        // Video Viewport (Playing .m3u8)
        Container(
          width: double.infinity,
          height: 220,
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_isPlayerInitialized && _videoController != null && _videoController!.value.isInitialized)
                FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _videoController!.value.size.width > 0 ? _videoController!.value.size.width : 16,
                    height: _videoController!.value.size.height > 0 ? _videoController!.value.size.height : 9,
                    child: VideoPlayer(_videoController!),
                  ),
                )
              else if (currentClip != null)
                Container(
                  color: const Color(0xFF090D18),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: AppTheme.accentGreen,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Reading MicroSD Segment (${currentClip['start']} - ${currentClip['end']})...',
                          style: const TextStyle(color: AppTheme.textMuted, fontSize: 11, fontFamily: 'monospace'),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Format: .m3u8 (HLS Low Bandwidth)',
                          style: TextStyle(color: AppTheme.accentGreen, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Container(
                  color: const Color(0xFF090D18),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.06),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.videocam_off_rounded, color: Color(0xFF94A3B8), size: 28),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'No Playback Video Available',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'No clips recorded for this date. Ignition was off.',
                          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ),

              // Top OSD Badge
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.75),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: currentClip != null ? AppTheme.accentGreen : const Color(0xFF64748B)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: currentClip != null ? AppTheme.accentGreen : const Color(0xFF64748B),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        currentClip != null
                            ? 'SD PLAYBACK • ${currentClip['start']} - ${currentClip['end']} • CH$_activeChannel'
                            : 'SD PLAYBACK • STANDBY • CH$_activeChannel',
                        style: TextStyle(
                          color: currentClip != null ? AppTheme.accentGreen : const Color(0xFF94A3B8),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Speed Badge
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.75),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${_playbackSpeed}x SPEED',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // LOWER SECTION 1: Date Selector
  Widget _buildDateSelectorBar(String formattedDate) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, color: Color(0xFF0284C7), size: 24),
            onPressed: () {
              setState(() {
                _selectedDate = _selectedDate.subtract(const Duration(days: 1));
                _generateClipsForDate(_selectedDate);
                _currentPosition = Duration.zero;
              });
              _initializePlaybackStream();
            },
          ),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime(2025),
                  lastDate: DateTime.now(),
                );
                if (picked != null) {
                  setState(() {
                    _selectedDate = picked;
                    _generateClipsForDate(picked);
                    _currentPosition = Duration.zero;
                  });
                  _initializePlaybackStream();
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.calendar_month_rounded, size: 16, color: Color(0xFF0284C7)),
                    const SizedBox(width: 8),
                    Text(
                      formattedDate,
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFF64748B), size: 20),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded, color: Color(0xFF0284C7), size: 24),
            onPressed: _selectedDate.isBefore(DateTime.now().subtract(const Duration(hours: 12)))
                ? () {
                    setState(() {
                      _selectedDate = _selectedDate.add(const Duration(days: 1));
                      _generateClipsForDate(_selectedDate);
                      _currentPosition = Duration.zero;
                    });
                    _initializePlaybackStream();
                  }
                : null,
          ),
        ],
      ),
    );
  }

  // LOWER SECTION 2: Interactive Scrubber (Aage / Piche Seek Control)
  Widget _buildScrubberControls(Map<String, dynamic>? currentClip) {
    final posSeconds = _currentPosition.inSeconds.toDouble();
    final maxSeconds = _totalDuration.inSeconds > 0 ? _totalDuration.inSeconds.toDouble() : 300.0;
    final clampedPos = (currentClip != null && _totalDuration > Duration.zero)
        ? posSeconds.clamp(0.0, maxSeconds)
        : 0.0;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        children: [
          // Time counters
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                currentClip != null
                    ? '${currentClip['start']} + ${_formatDuration(_currentPosition)}'
                    : '00:00 + 00:00',
                style: const TextStyle(
                  color: Color(0xFF0284C7),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              Text(
                currentClip != null
                    ? 'Segment Duration: ${_formatDuration(_totalDuration)}'
                    : 'Duration: 00:00',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ],
          ),

          // Interactive Drag Scrubber Slider
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              activeTrackColor: const Color(0xFF0284C7),
              inactiveTrackColor: const Color(0xFFE2E8F0),
              thumbColor: const Color(0xFF0284C7),
            ),
            child: Slider(
              value: clampedPos,
              min: 0.0,
              max: maxSeconds > 0 ? maxSeconds : 1.0,
              onChanged: currentClip != null
                  ? (val) {
                      _seekTo(Duration(seconds: val.toInt()));
                    }
                  : null,
            ),
          ),

          // Seek Buttons (Rewind -10s, Play/Pause, Fast Forward +10s, Speed)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Speed toggle
              InkWell(
                onTap: currentClip != null ? _toggleSpeed : null,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Text(
                    '${_playbackSpeed}x',
                    style: TextStyle(
                      color: currentClip != null ? const Color(0xFF0284C7) : const Color(0xFF94A3B8),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),

              // -10s Rewind
              IconButton(
                icon: const Icon(Icons.replay_10_rounded, color: Color(0xFF0F172A), size: 28),
                tooltip: 'Rewind 10 Seconds',
                onPressed: currentClip != null
                    ? () {
                        HapticFeedback.lightImpact();
                        _seekTo(_currentPosition - const Duration(seconds: 10));
                      }
                    : null,
              ),
              const SizedBox(width: 10),

              // Play / Pause Button
              GestureDetector(
                onTap: () {
                  if (currentClip != null) {
                    HapticFeedback.mediumImpact();
                    _togglePlayPause();
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('No recorded clips available for this date'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  }
                },
                child: Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: currentClip != null ? const Color(0xFF0284C7) : const Color(0xFF94A3B8),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: (currentClip != null ? const Color(0xFF0284C7) : const Color(0xFF94A3B8)).withOpacity(0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 30,
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // +10s Forward
              IconButton(
                icon: const Icon(Icons.forward_10_rounded, color: Color(0xFF0F172A), size: 28),
                tooltip: 'Forward 10 Seconds',
                onPressed: currentClip != null
                    ? () {
                        HapticFeedback.lightImpact();
                        _seekTo(_currentPosition + const Duration(seconds: 10));
                      }
                    : null,
              ),
            ],
          ),
        ],
      ),
    );
  }

  // LOWER SECTION 3: Time Segment Clips List
  Widget _buildTimeSegmentsList() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recorded Time Segments',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              Text(
                '${_clips.length} Clips Available',
                style: TextStyle(
                  fontSize: 12,
                  color: _clips.isNotEmpty ? const Color(0xFF0284C7) : const Color(0xFF64748B),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_clips.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Center(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.video_file_outlined, size: 28, color: Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'No Recorded Clips Found',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'No video segments found for the selected date.\nClips are automatically recorded when vehicle is moving with ignition ON.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                    ),
                  ],
                ),
              ),
            )
          else
            ...List.generate(_clips.length, (idx) {
            final clip = _clips[idx];
            final isSos = clip['isSos'] == true;
            final isSelected = _selectedClipIndex == idx;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFF0F9FF) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF0284C7)
                      : (isSos ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0)),
                  width: isSelected ? 1.8 : 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isSelected ? const Color(0xFF0284C7).withOpacity(0.08) : Colors.black.withOpacity(0.02),
                    blurRadius: 6,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() {
                      _selectedClipIndex = idx;
                      _currentPosition = Duration.zero;
                    });
                    _initializePlaybackStream();
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: isSos
                                ? const Color(0xFFFEF2F2)
                                : (isSelected ? const Color(0xFFE0F2FE) : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            isSelected ? Icons.play_arrow_rounded : (isSos ? Icons.warning_amber_rounded : Icons.videocam_outlined),
                            color: isSos
                                ? const Color(0xFFDC2626)
                                : (isSelected ? const Color(0xFF0284C7) : const Color(0xFF64748B)),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '${clip['start']} - ${clip['end']}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      fontFamily: 'monospace',
                                      color: isSelected ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isSos
                                          ? const Color(0xFFFEF2F2)
                                          : const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      clip['type'] as String,
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: isSos ? const Color(0xFFDC2626) : const Color(0xFF059669),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Duration: 5m 00s • Size: ${clip['size']} • MicroSD Loop Storage',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          isSelected ? Icons.volume_up_rounded : Icons.chevron_right_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

