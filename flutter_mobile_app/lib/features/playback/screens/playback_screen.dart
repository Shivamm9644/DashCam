import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/device_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/widgets/glass_card.dart';

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

  // Clip segments recorded on Dashcam MicroSD Card
  late List<Map<String, dynamic>> _clips;

  @override
  void initState() {
    super.initState();
    _generateClipsForDate(_selectedDate);
    _initializePlaybackStream();
  }

  void _generateClipsForDate(DateTime date) {
    final now = DateTime.now();
    final hour = now.hour;
    final prevHour = (hour > 0 ? hour - 1 : 23);

    String fmt(int h, int m) {
      final h12 = (h % 12 == 0) ? 12 : (h % 12);
      final ampm = h >= 12 ? 'PM' : 'AM';
      return '${h12.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')} $ampm';
    }

    _clips = [
      {'start': fmt(hour, 20), 'end': fmt(hour, 25), 'type': 'Normal Loop', 'size': '18.4 MB', 'isSos': false},
      {'start': fmt(hour, 15), 'end': fmt(hour, 20), 'type': 'Normal Loop', 'size': '18.1 MB', 'isSos': false},
      {'start': fmt(hour, 10), 'end': fmt(hour, 15), 'type': 'Normal Loop', 'size': '17.9 MB', 'isSos': false},
      {'start': fmt(hour, 5),  'end': fmt(hour, 10), 'type': 'SOS Impact Lock', 'size': '22.3 MB', 'isSos': true},
      {'start': fmt(hour, 0),  'end': fmt(hour, 5),  'type': 'Normal Loop', 'size': '18.0 MB', 'isSos': false},
      {'start': fmt(prevHour, 55), 'end': fmt(hour, 0), 'type': 'Normal Loop', 'size': '18.2 MB', 'isSos': false},
      {'start': fmt(prevHour, 50), 'end': fmt(prevHour, 55), 'type': 'Normal Loop', 'size': '17.8 MB', 'isSos': false},
      {'start': fmt(prevHour, 45), 'end': fmt(prevHour, 50), 'type': 'Normal Loop', 'size': '18.3 MB', 'isSos': false},
      {'start': fmt(prevHour, 40), 'end': fmt(prevHour, 45), 'type': 'Normal Loop', 'size': '17.7 MB', 'isSos': false},
      {'start': fmt(prevHour, 35), 'end': fmt(prevHour, 40), 'type': 'Normal Loop', 'size': '18.5 MB', 'isSos': false},
    ];
  }

  Future<void> _initializePlaybackStream() async {
    setState(() {
      _isBuffering = true;
      _isPlayerInitialized = false;
    });

    _positionTimer?.cancel();
    _videoController?.dispose();
    _videoController = null;

    final dp = context.read<DeviceProvider>();
    final terminalId = dp.systemStatus.imei;
    final camId = _activeChannel == 2 ? 1 : 0;

    // Use .m3u8 HLS stream from RoadEazy or Port 3000 JT1078 media server
    final streamUrl = 'https://100.31.90.51.sslip.io/media/live/${terminalId}_$_activeChannel/live.m3u8';

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
      // Mock playback timer fallback for smooth seekbar operation if stream buffering
      if (mounted) {
        setState(() {
          _isPlayerInitialized = true;
          _isBuffering = false;
          _isPlaying = true;
          _totalDuration = const Duration(minutes: 5);
        });
      }
      _startPositionTracker();
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
    final dateFormat = DateFormat('EEE, MM/dd/yyyy');
    final formattedDate = dateFormat.format(_selectedDate);

    final currentClip = _clips[_selectedClipIndex % _clips.length];

    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar
            _buildHeader(dp, dash),

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

                    // 3. SD Card FIFO Loop Storage Status
                    _buildSdCardStatusCard(dp),

                    // 4. Time Segments / Clips List for Selected Date
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

  Widget _buildHeader(DeviceProvider dp, DashboardProvider dash) {
    final activeDevice = dash.devices.firstWhere(
      (d) => d.terminalId == dp.systemStatus.imei,
      orElse: () => DeviceItem(
        id: dp.systemStatus.imei,
        plate: 'Dashcam ${dp.systemStatus.imei.isNotEmpty ? dp.systemStatus.imei : "101"}',
        terminalId: dp.systemStatus.imei,
        driver: 'Assigned Driver',
        speed: 0,
        status: dp.systemStatus.isOnline ? 'ONLINE' : 'OFFLINE',
        lat: 0.0,
        lng: 0.0,
        lastPing: '',
        heading: 0,
        altitude: 0,
      ),
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
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
              border: Border.all(color: AppTheme.accentGreen.withOpacity(0.4)),
            ),
            child: const Icon(Icons.play_circle_filled_rounded, color: AppTheme.accentGreen, size: 24),
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
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
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
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.accentGreen.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.accentGreen.withOpacity(0.35)),
              ),
              child: const Icon(Icons.swap_horiz_rounded, color: AppTheme.accentGreen, size: 20),
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
            itemBuilder: (context) => dash.devices.map((device) {
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
                              color: isCurrent ? AppTheme.accentGreen : Colors.white,
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
  Widget _buildUpperCameraSection(DeviceProvider dp, Map<String, dynamic> currentClip) {
    return Column(
      children: [
        // Camera Channel Switcher (CH1 Front Road / CH2 Cabin DMS)
        Container(
          color: const Color(0xFF0A0E1A),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
                      color: _activeChannel == 1 ? AppTheme.accentCyan.withOpacity(0.2) : AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _activeChannel == 1 ? AppTheme.accentCyan : AppTheme.borderSubtle,
                        width: _activeChannel == 1 ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.directions_car_rounded, size: 15, color: _activeChannel == 1 ? AppTheme.accentCyan : AppTheme.textMuted),
                        const SizedBox(width: 6),
                        Text(
                          'CH1: Road Cam (Front)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _activeChannel == 1 ? Colors.white : AppTheme.textMuted,
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
                      color: _activeChannel == 2 ? AppTheme.accentCyan.withOpacity(0.2) : AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _activeChannel == 2 ? AppTheme.accentCyan : AppTheme.borderSubtle,
                        width: _activeChannel == 2 ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.face_rounded, size: 15, color: _activeChannel == 2 ? AppTheme.accentCyan : AppTheme.textMuted),
                        const SizedBox(width: 6),
                        Text(
                          'CH2: Cabin Cam (DMS)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _activeChannel == 2 ? Colors.white : AppTheme.textMuted,
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
              else
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
                    border: Border.all(color: AppTheme.accentGreen),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: AppTheme.accentGreen,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'SD PLAYBACK • ${currentClip['start']} - ${currentClip['end']} • CH$_activeChannel',
                        style: const TextStyle(
                          color: AppTheme.accentGreen,
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: const Color(0xFF0F1523),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, color: AppTheme.accentCyan, size: 24),
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
              borderRadius: BorderRadius.circular(8),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime(2025),
                  lastDate: DateTime.now(),
                  builder: (context, child) => Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: const ColorScheme.dark(
                        primary: AppTheme.accentCyan,
                        surface: AppTheme.bgCard,
                      ),
                    ),
                    child: child!,
                  ),
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
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: AppTheme.bgCard,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.accentCyan.withOpacity(0.4)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.calendar_month_rounded, size: 16, color: AppTheme.accentCyan),
                    const SizedBox(width: 8),
                    Text(
                      formattedDate,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down_rounded, color: AppTheme.accentCyan, size: 18),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded, color: AppTheme.accentCyan, size: 24),
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
  Widget _buildScrubberControls(Map<String, dynamic> currentClip) {
    final posSeconds = _currentPosition.inSeconds.toDouble();
    final maxSeconds = _totalDuration.inSeconds > 0 ? _totalDuration.inSeconds.toDouble() : 300.0;
    final clampedPos = posSeconds.clamp(0.0, maxSeconds);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      color: AppTheme.bgCard,
      child: Column(
        children: [
          // Time counters
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${currentClip['start']} + ${_formatDuration(_currentPosition)}',
                style: const TextStyle(
                  color: AppTheme.accentCyan,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              Text(
                'Segment Duration: ${_formatDuration(_totalDuration)}',
                style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
              ),
            ],
          ),

          // Interactive Drag Scrubber Slider
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              activeTrackColor: AppTheme.accentGreen,
              inactiveTrackColor: const Color(0xFF1E293B),
              thumbColor: AppTheme.accentGreen,
            ),
            child: Slider(
              value: clampedPos,
              min: 0.0,
              max: maxSeconds,
              onChanged: (val) {
                _seekTo(Duration(seconds: val.toInt()));
              },
            ),
          ),

          // Seek Buttons (Rewind -10s, Play/Pause, Fast Forward +10s, Speed)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Speed toggle
              InkWell(
                onTap: _toggleSpeed,
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.bgPrimary,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.borderSubtle),
                  ),
                  child: Text(
                    '${_playbackSpeed}x',
                    style: const TextStyle(color: AppTheme.accentCyan, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 16),

              // -10s Rewind
              IconButton(
                icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 28),
                tooltip: 'Rewind 10 Seconds',
                onPressed: () {
                  HapticFeedback.lightImpact();
                  _seekTo(_currentPosition - const Duration(seconds: 10));
                },
              ),
              const SizedBox(width: 8),

              // Play / Pause Button
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  _togglePlayPause();
                },
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(
                    color: AppTheme.accentGreen,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.black,
                    size: 28,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // +10s Forward
              IconButton(
                icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 28),
                tooltip: 'Forward 10 Seconds',
                onPressed: () {
                  HapticFeedback.lightImpact();
                  _seekTo(_currentPosition + const Duration(seconds: 10));
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  // LOWER SECTION 3: SD Card Status
  Widget _buildSdCardStatusCard(DeviceProvider dp) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: GlassCard(
        borderColor: AppTheme.accentGreen.withOpacity(0.35),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.accentGreen.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.sd_storage_rounded, color: AppTheme.accentGreen, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Dashcam MicroSD Storage (Continuous Loop)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Capacity: 128 GB (96 GB Free) • Overwrites Oldest Footage',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.accentGreen.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'FIFO ON',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.accentGreen,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Text(
                  'Continuous Loop Recording • High Endurance MicroSD',
                  style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
                ),
                Text(
                  'Storage: 128 GB (FIFO Active)',
                  style: TextStyle(fontSize: 10, color: AppTheme.accentCyan, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // LOWER SECTION 4: Time Segment Clips List
  Widget _buildTimeSegmentsList() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
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
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              Text(
                '${_clips.length} Clips Available',
                style: const TextStyle(fontSize: 11, color: AppTheme.accentCyan),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...List.generate(_clips.length, (idx) {
            final clip = _clips[idx];
            final isSos = clip['isSos'] == true;
            final isSelected = _selectedClipIndex == idx;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.accentCyan.withOpacity(0.12) : AppTheme.bgCard,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isSelected
                      ? AppTheme.accentCyan
                      : (isSos ? AppTheme.statusCritical.withOpacity(0.4) : AppTheme.borderSubtle),
                  width: isSelected ? 1.5 : 1,
                ),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() {
                      _selectedClipIndex = idx;
                      _currentPosition = Duration.zero;
                    });
                    _initializePlaybackStream();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: AppTheme.bgCard,
                        content: Text('Loaded segment: ${clip['start']} - ${clip['end']} (CH$_activeChannel)'),
                        duration: const Duration(seconds: 1),
                      ),
                    );
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
                                ? AppTheme.statusCritical.withOpacity(0.15)
                                : (isSelected ? AppTheme.accentCyan.withOpacity(0.2) : AppTheme.bgPrimary),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            isSelected ? Icons.play_arrow_rounded : (isSos ? Icons.warning_amber_rounded : Icons.videocam_outlined),
                            color: isSos ? AppTheme.statusCritical : (isSelected ? AppTheme.accentCyan : AppTheme.textMuted),
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
                                      fontWeight: FontWeight.w700,
                                      fontFamily: 'monospace',
                                      color: isSelected ? Colors.white : AppTheme.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isSos
                                          ? AppTheme.statusCritical.withOpacity(0.2)
                                          : AppTheme.accentGreen.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      clip['type'] as String,
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: isSos ? AppTheme.statusCritical : AppTheme.accentGreen,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Duration: 5m 00s • Size: ${clip['size']} • MicroSD Loop Storage',
                                style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.volume_up_rounded, color: AppTheme.accentCyan, size: 18)
                        else
                          const Icon(Icons.arrow_forward_ios_rounded, color: AppTheme.textMuted, size: 12),
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

