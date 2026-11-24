import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:video_player/video_player.dart';
import '../../../core/services/api_service.dart';

class LivePlayerView extends StatefulWidget {
  final int channel;
  final String terminalId;
  final bool isOnline;
  final VoidCallback? onRefresh;
  final bool isOfflineWifiMode;
  final String localWifiGateway;
  final bool showAlignmentGrid;
  final VoidCallback? onSwitchToOfflineWifi;
  final VoidCallback? onOpenMCTool;
  final VoidCallback? onOpenWifiSettings;

  const LivePlayerView({
    super.key,
    required this.channel,
    required this.terminalId,
    this.isOnline = true,
    this.onRefresh,
    this.isOfflineWifiMode = false,
    this.localWifiGateway = '192.168.169.1',
    this.showAlignmentGrid = false,
    this.onSwitchToOfflineWifi,
    this.onOpenMCTool,
    this.onOpenWifiSettings,
  });

  @override
  State<LivePlayerView> createState() => _LivePlayerViewState();
}

class _LivePlayerViewState extends State<LivePlayerView> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isConnecting = true;
  String _statusMessage = 'Connecting...';
  bool _isMuted = false;
  bool _isFitCover = false;
  Timer? _retryTimer;
  Timer? _heartbeatTimer;
  int _retryCount = 0;

  @override
  void initState() {
    super.initState();
    if (widget.isOfflineWifiMode) {
      _startOfflineWifiWorkflow();
    } else {
      _startLiveWorkflow();
    }
  }

  @override
  void didUpdateWidget(covariant LivePlayerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channel != widget.channel ||
        oldWidget.terminalId != widget.terminalId ||
        oldWidget.isOnline != widget.isOnline ||
        oldWidget.isOfflineWifiMode != widget.isOfflineWifiMode ||
        oldWidget.localWifiGateway != widget.localWifiGateway) {
      _stopSession();
      _retryTimer?.cancel();
      _heartbeatTimer?.cancel();
      _controller?.pause();
      _controller?.dispose();
      _controller = null;
      _isInitialized = false;

      if (widget.isOfflineWifiMode) {
        _startOfflineWifiWorkflow();
      } else {
        _startLiveWorkflow();
      }
    }
  }

  Future<void> _startOfflineWifiWorkflow() async {
    if (!mounted) return;
    setState(() {
      _isConnecting = true;
      _statusMessage = 'Connecting to DashCam AP (${widget.localWifiGateway})...';
    });

    final localUrls = [
      'http://${widget.localWifiGateway}:8080/live',
      'http://${widget.localWifiGateway}:8080/?action=stream',
      'rtsp://${widget.localWifiGateway}:554/live/ch${widget.channel}',
    ];

    bool connected = false;
    for (final url in localUrls) {
      try {
        _controller?.dispose();
        _controller = VideoPlayerController.networkUrl(
          Uri.parse(url),
          videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
        );
        await _controller!.initialize().timeout(const Duration(seconds: 3));
        await _controller!.setVolume(_isMuted ? 0.0 : 1.0);
        await _controller!.play();
        _controller!.setLooping(true);

        if (mounted) {
          setState(() {
            _isInitialized = true;
            _isConnecting = false;
            _retryCount = 0;
          });
        }
        connected = true;
        break;
      } catch (_) {
        // try next local url
      }
    }

    if (!connected && mounted) {
      setState(() {
        _isInitialized = false;
        _isConnecting = false;
        _statusMessage = 'DashCam AP not detected at ${widget.localWifiGateway}';
      });
    }
  }

  Future<void> _startLiveWorkflow() async {
    if (!mounted) return;
    setState(() {
      _isConnecting = true;
      _statusMessage = 'Connecting live video stream...';
    });

    String streamUrl = '${ApiService.serverHost}/media/live/${widget.terminalId}_${widget.channel}/live.m3u8';

    try {
      // 1. Get or authenticate token
      String? token = ApiService.instance.currentToken;
      if (token == null) {
        try {
          final loginRes = await http.post(
            Uri.parse('${ApiService.serverHost}/api/v1/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
          ).timeout(const Duration(seconds: 4));

          if (loginRes.statusCode == 200) {
            final lData = jsonDecode(loginRes.body);
            token = lData['token'] as String?;
            if (token != null) ApiService.instance.setToken(token);
          }
        } catch (_) {}
      }

      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null) headers['Authorization'] = 'Bearer $token';

      // 1. Dispatch 4G hardware live start (0x9101 on JT/T 808 & 1078) in parallel (non-blocking)
      http.get(
        Uri.parse('${ApiService.serverHost}/api/video/start-live?terminalId=${widget.terminalId}&channel=${widget.channel}&dataType=0'),
        headers: headers,
      ).catchError((_) => http.Response('{}', 500));

      // 2. Register live session on server in parallel
      http.post(
        Uri.parse('${ApiService.serverHost}/api/v1/live-sessions'),
        headers: headers,
        body: jsonEncode({
          'terminalId': widget.terminalId,
          'channel': widget.channel,
        }),
      ).catchError((_) => http.Response('{}', 500));

      // 3. Attach player immediately without waiting for HTTP POST round-trip latency
      await _attachPlayer(streamUrl);

      // Start periodic 6-second heartbeat to keep live session and hardware socket alive
      _heartbeatTimer?.cancel();
      _heartbeatTimer = Timer.periodic(const Duration(seconds: 6), (_) {
        http.post(
          Uri.parse('${ApiService.serverHost}/api/video/heartbeat'),
          headers: headers,
          body: jsonEncode({'terminalId': widget.terminalId}),
        ).catchError((_) => http.Response('{}', 500));
      });
    } catch (e) {
      await _attachPlayer(streamUrl);
    }
  }

  Future<void> _attachPlayer(String streamUrl) async {
    String activeUrl = streamUrl;

    try {
      // Fast reactive check: poll every 350ms (up to 30 times) so video starts the exact split-second 4G packets arrive
      bool streamReady = false;
      for (int i = 0; i < 30; i++) {
        try {
          final headReq = await http.get(Uri.parse(activeUrl)).timeout(const Duration(milliseconds: 800));
          if (headReq.statusCode == 200 &&
              headReq.body.contains('#EXTM3U') &&
              !headReq.body.contains('.mp4') &&
              headReq.body.contains('.ts')) {
            streamReady = true;
            break;
          }
        } catch (_) {}
        if (i < 29) await Future.delayed(const Duration(milliseconds: 350));
      }

      if (!streamReady) {
        // Stream not broadcasting yet - show clean standby, NEVER play any fallback mp4!
        if (mounted) {
          setState(() {
            _isInitialized = false;
            _isConnecting = false;
            _statusMessage = 'DashCam Stream Standby\nAwaiting live video broadcast from Terminal ${widget.terminalId} (CH${widget.channel})';
          });
        }
        _scheduleAutoRetry();
        return;
      }

      _controller?.dispose();
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(activeUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      _controller!.addListener(() {
        if (!mounted) return;
        if (_controller!.value.hasError && _isInitialized) {
          _scheduleAutoRetry();
        }
      });


      await _controller!.initialize().timeout(const Duration(seconds: 8));
      await _controller!.setVolume(_isMuted ? 0.0 : 1.0);
      await _controller!.play();

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isConnecting = false;
          _retryCount = 0;
        });
      }
    } catch (e) {
      _controller?.dispose();
      _controller = null;
      if (mounted) {
        setState(() {
          _isInitialized = false;
          _isConnecting = false;
          _statusMessage = 'DashCam Stream Standby\nAwaiting live video broadcast from Terminal ${widget.terminalId} (CH${widget.channel})';
        });
      }
      _scheduleAutoRetry();
    }
  }

  void _scheduleAutoRetry() {
    _retryTimer?.cancel();
    if (_retryCount < 10) {
      _retryTimer = Timer(const Duration(seconds: 3), () {
        if (mounted && !_isInitialized) {
          _retryCount++;
          _startLiveWorkflow();
        }
      });
    }
  }

  void _stopSession() {
    try {
      final token = ApiService.instance.currentToken;
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null) headers['Authorization'] = 'Bearer $token';
      http.post(
        Uri.parse('${ApiService.serverHost}/api/video/stop-live?terminalId=${widget.terminalId}'),
        headers: headers,
        body: jsonEncode({'terminalId': widget.terminalId}),
      ).catchError((_) => http.Response('{}', 500));
      http.post(
        Uri.parse('${ApiService.serverHost}/api/v1/live-sessions/stop'),
        headers: headers,
        body: jsonEncode({'terminalId': widget.terminalId}),
      ).catchError((_) => http.Response('{}', 500));
    } catch (_) {}
  }

  void _toggleAudio() {
    if (_controller == null || !_isInitialized) return;
    setState(() {
      _isMuted = !_isMuted;
    });
    _controller!.setVolume(_isMuted ? 0.0 : 1.0);
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _retryTimer?.cancel();
    _stopSession();
    _controller?.pause();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 1. Real Video Playing State - prioritize active stream
    if (_isInitialized && _controller != null && _controller!.value.isInitialized) {
      final videoSize = _controller!.value.size;

      return Stack(
        fit: StackFit.expand,
        children: [
          Container(
            color: Colors.black,
            alignment: Alignment.center,
            child: ClipRect(
              child: FittedBox(
                fit: _isFitCover ? BoxFit.cover : BoxFit.contain,
                child: SizedBox(
                  width: videoSize.width > 0 ? videoSize.width : 16,
                  height: videoSize.height > 0 ? videoSize.height : 9,
                  child: VideoPlayer(_controller!),
                ),
              ),
            ),
          ),

          // ADAS Alignment Grid Overlay
          if (widget.showAlignmentGrid)
            CustomPaint(
              size: Size.infinite,
              painter: AlignmentGridPainter(),
            ),

          // Live / Offline AP badge with 4K HD label
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.75),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: widget.isOfflineWifiMode
                      ? const Color(0xFF0D9488)
                      : const Color(0xFF10B981).withOpacity(0.7),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: widget.isOfflineWifiMode
                          ? const Color(0xFF0D9488)
                          : const Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    widget.isOfflineWifiMode
                        ? '📶 OFFLINE WI-FI (MC TOOL) • CH${widget.channel}'
                        : '🔴 LIVE 4G • 4K HD • CH${widget.channel}',
                    style: TextStyle(
                      color: widget.isOfflineWifiMode
                          ? const Color(0xFF2DD4BF)
                          : const Color(0xFF10B981),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Top right controls: Fit/Fill aspect toggle + Audio Mute
          Positioned(
            top: 10,
            right: 10,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => setState(() => _isFitCover = !_isFitCover),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isFitCover ? Icons.fullscreen_exit_rounded : Icons.crop_free_rounded,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: _toggleAudio,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    // 2. Connecting State
    if (_isConnecting) {
      return Container(
        color: const Color(0xFF0F172A),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: widget.isOfflineWifiMode ? const Color(0xFF0D9488) : const Color(0xFF00D4FF),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _statusMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // 3. Offline Wi-Fi Mode Not Yet Connected
    if (widget.isOfflineWifiMode) {
      return _buildOfflineWifiPrompt();
    }

    // 4. Standby / Offline Feed Placeholder
    return _buildOfflinePlaceholder();
  }

  Widget _buildOfflinePlaceholder() {
    return Container(
      color: const Color(0xFF0F172A),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.videocam_off_rounded,
                size: 32,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Live Stream Standby',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _statusMessage.isNotEmpty
                  ? _statusMessage
                  : 'Awaiting dashcam video feed connection.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00D4FF),
                side: BorderSide(color: const Color(0xFF00D4FF).withOpacity(0.4)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              onPressed: () {
                _startLiveWorkflow();
                widget.onRefresh?.call();
              },
              icon: const Icon(Icons.refresh_rounded, size: 14),
              label: const Text('Retry Stream', style: TextStyle(fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfflineWifiPrompt() {
    return Container(
      color: const Color(0xFF091E24),
      padding: const EdgeInsets.all(16),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF0D9488).withOpacity(0.2),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF0D9488).withOpacity(0.4)),
              ),
              child: const Icon(
                Icons.wifi_tethering_rounded,
                size: 32,
                color: Color(0xFF2DD4BF),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Offline Wi-Fi Direct Mode (MC Tool)',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Connect phone to DashCam Wi-Fi AP to view feed offline without SIM or server\nGateway: ${widget.localWifiGateway}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF99F6E4),
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                if (widget.onOpenWifiSettings != null)
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D9488),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    onPressed: widget.onOpenWifiSettings,
                    icon: const Icon(Icons.wifi_rounded, size: 15),
                    label: const Text('Connect Wi-Fi', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                if (widget.onOpenMCTool != null)
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF9933),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    onPressed: widget.onOpenMCTool,
                    icon: const Icon(Icons.open_in_new_rounded, size: 15),
                    label: const Text('Open MC Tool', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF2DD4BF),
                    side: const BorderSide(color: Color(0xFF0D9488)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  onPressed: _startOfflineWifiWorkflow,
                  icon: const Icon(Icons.refresh_rounded, size: 15),
                  label: const Text('Retry Stream', style: TextStyle(fontSize: 11)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class AlignmentGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final horizonPaint = Paint()
      ..color = const Color(0xFF10B981)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final centerPaint = Paint()
      ..color = const Color(0xFFFF9933)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final dashedPaint = Paint()
      ..color = Colors.white.withOpacity(0.4)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    // Horizon line at Y = 52%
    final horizonY = size.height * 0.52;
    canvas.drawLine(Offset(0, horizonY), Offset(size.width, horizonY), horizonPaint);

    // Center Hood Line at X = 50%
    final centerX = size.width * 0.5;
    canvas.drawLine(Offset(centerX, horizonY - 40), Offset(centerX, size.height), centerPaint);

    // ADAS Road Lane Guides
    final path = Path();
    path.moveTo(centerX - 40, horizonY);
    path.lineTo(size.width * 0.12, size.height);
    path.moveTo(centerX + 40, horizonY);
    path.lineTo(size.width * 0.88, size.height);
    canvas.drawPath(path, dashedPaint);

    // Horizon label
    final textPainter = TextPainter(
      text: const TextSpan(
        text: 'HORIZON (50% ROAD / SKY)',
        style: TextStyle(
          color: Color(0xFF10B981),
          fontSize: 9,
          fontWeight: FontWeight.w700,
          backgroundColor: Color(0x99000000),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(canvas, Offset(8, horizonY - 14));

    // Hood center label
    final hoodPainter = TextPainter(
      text: const TextSpan(
        text: 'VEHICLE HOOD CENTER',
        style: TextStyle(
          color: Color(0xFFFF9933),
          fontSize: 9,
          fontWeight: FontWeight.w700,
          backgroundColor: Color(0x99000000),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    hoodPainter.paint(canvas, Offset(centerX - (hoodPainter.width / 2), size.height - 18));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
