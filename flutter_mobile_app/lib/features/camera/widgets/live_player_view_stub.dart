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
  // Coordinate start/stop across Dual View (CH1 + CH2) so channel switches and
  // simultaneous views do not repeatedly tear down the JT/T 1078 camera socket.
  static final Map<String, int> _mountedViewsByTerminal = {};
  static final Map<String, DateTime> _lastStartDispatchByTerminal = {};

  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isConnecting = true;
  String _statusMessage = 'Connecting...';
  bool _isMuted = false;
  bool _isFitCover = false;
  Timer? _retryTimer;
  Timer? _heartbeatTimer;
  Timer? _watchdogTimer;
  int _retryCount = 0;
  Duration _lastWatchPosition = Duration.zero;
  int _stalledTicks = 0;
  bool _disposed = false;

  void _registerMount(String terminalId) {
    if (terminalId.isEmpty) return;
    _mountedViewsByTerminal[terminalId] = (_mountedViewsByTerminal[terminalId] ?? 0) + 1;
  }

  void _unregisterMount(String terminalId) {
    if (terminalId.isEmpty) return;
    final next = (_mountedViewsByTerminal[terminalId] ?? 1) - 1;
    if (next <= 0) {
      _mountedViewsByTerminal.remove(terminalId);
    } else {
      _mountedViewsByTerminal[terminalId] = next;
    }
  }

  @override
  void initState() {
    super.initState();
    if (!widget.isOfflineWifiMode) {
      _registerMount(widget.terminalId);
    }
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
      final terminalChanged = oldWidget.terminalId != widget.terminalId;
      final switchedToOffline = !oldWidget.isOfflineWifiMode && widget.isOfflineWifiMode;

      if (terminalChanged || switchedToOffline) {
        if (!oldWidget.isOfflineWifiMode) {
          _unregisterMount(oldWidget.terminalId);
          if ((_mountedViewsByTerminal[oldWidget.terminalId] ?? 0) == 0) {
            _stopSessionFor(oldWidget.terminalId);
          }
        }
        if (!widget.isOfflineWifiMode) {
          _registerMount(widget.terminalId);
        }
      }

      _retryTimer?.cancel();
      _heartbeatTimer?.cancel();
      _watchdogTimer?.cancel();
      _controller?.pause();
      _controller?.dispose();
      _controller = null;
      _isInitialized = false;
      _stalledTicks = 0;

      if (widget.isOfflineWifiMode) {
        _startOfflineWifiWorkflow();
      } else {
        // If only switching CH1 <-> CH2 on the same terminal, keep the 4G socket alive
        // and attach immediately without killing the camera session.
        _startLiveWorkflow(skipStartDispatch: !terminalChanged && !switchedToOffline && oldWidget.isOnline == widget.isOnline);
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

  Future<void> _startLiveWorkflow({bool skipStartDispatch = false}) async {
    if (!mounted) return;
    setState(() {
      _isConnecting = true;
      _statusMessage = 'Connecting 1080p live stream...';
    });

    final streamUrl = '${ApiService.serverHost}/media/live/${widget.terminalId}_${widget.channel}/live.m3u8';

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

      final headers = <String, String>{
        'Content-Type': 'application/json',
        'X-API-KEY': 'gbt-tc-prod-key-9f82d14b',
      };
      if (token != null) headers['Authorization'] = 'Bearer $token';

      // Deduplicate 0x9101 start-live across Dual View (CH1 + CH2) within a 6s window
      final now = DateTime.now();
      final lastStart = _lastStartDispatchByTerminal[widget.terminalId];
      final shouldDispatch = !skipStartDispatch &&
          (lastStart == null || now.difference(lastStart).inSeconds >= 6);

      if (shouldDispatch) {
        _lastStartDispatchByTerminal[widget.terminalId] = now;

        // 1. Dispatch 4G hardware live start (0x9101, streamType=0 Main Stream Full HD)
        http.get(
          Uri.parse('${ApiService.serverHost}/api/video/start-live?terminalId=${widget.terminalId}&channel=${widget.channel}&dataType=0&streamType=0'),
          headers: headers,
        ).catchError((_) => http.Response('{}', 500));

        // 2. Register live session on Spring Boot backend (pass channelId so LiveController receives it)
        http.post(
          Uri.parse('${ApiService.serverHost}/api/v1/live-sessions'),
          headers: headers,
          body: jsonEncode({
            'terminalId': widget.terminalId,
            'channelId': widget.channel,
            'channel': widget.channel,
          }),
        ).catchError((_) => http.Response('{}', 500));
      }

      // 3. Attach player immediately without waiting for HTTP POST round-trip latency
      await _attachPlayer(streamUrl);

      // Start periodic 5-second heartbeat to BOTH Spring Boot (/api/v1/live-sessions/heartbeat)
      // and Node gateway (/api/video/heartbeat) so the 30s sweep never kills an active stream.
      _heartbeatTimer?.cancel();
      _heartbeatTimer = Timer.periodic(const Duration(seconds: 5), (_) {
        final payload = jsonEncode({'terminalId': widget.terminalId});
        http.post(
          Uri.parse('${ApiService.serverHost}/api/v1/live-sessions/heartbeat'),
          headers: headers,
          body: payload,
        ).catchError((_) => http.Response('{}', 500));
        http.post(
          Uri.parse('${ApiService.serverHost}/api/video/heartbeat'),
          headers: headers,
          body: payload,
        ).catchError((_) => http.Response('{}', 500));
      });
    } catch (e) {
      await _attachPlayer(streamUrl);
    }
  }

  Future<bool> _isHlsPlaylistReady(String url) async {
    final client = http.Client();
    try {
      final req = http.Request('GET', Uri.parse(url))..followRedirects = false;
      final streamed = await client.send(req).timeout(const Duration(milliseconds: 900));
      if (streamed.statusCode != 200) {
        await streamed.stream.drain();
        return false;
      }
      final body = await streamed.stream.bytesToString();
      return body.contains('#EXTM3U') && !body.contains('.mp4') && body.contains('.ts');
    } catch (_) {
      return false;
    } finally {
      client.close();
    }
  }

  Future<void> _attachPlayer(String streamUrl) async {
    final String activeUrl = streamUrl;

    try {
      // Fast non-redirecting check: avoids downloading fallback road_cam.mp4 on 302 redirects
      bool streamReady = false;
      for (int i = 0; i < 30; i++) {
        if (!mounted || _disposed) return;
        if (await _isHlsPlaylistReady(activeUrl)) {
          streamReady = true;
          break;
        }
        if (i < 29) await Future.delayed(const Duration(milliseconds: 350));
      }

      if (!streamReady) {
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

      _watchdogTimer?.cancel();
      _controller?.dispose();
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(activeUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      _controller!.addListener(() {
        if (!mounted || _disposed) return;
        if (_controller!.value.hasError && _isInitialized) {
          _scheduleAutoRetry();
        }
      });

      await _controller!.initialize().timeout(const Duration(seconds: 8));
      await _controller!.setVolume(_isMuted ? 0.0 : 1.0);
      await _controller!.play();

      _lastWatchPosition = Duration.zero;
      _stalledTicks = 0;
      _watchdogTimer = Timer.periodic(const Duration(seconds: 3), (_) {
        if (!mounted || _disposed || _controller == null || !_controller!.value.isInitialized) return;
        final val = _controller!.value;
        if (val.hasError) {
          _watchdogTimer?.cancel();
          _scheduleAutoRetry();
          return;
        }
        if (val.isPlaying) {
          if (val.position == _lastWatchPosition || val.isBuffering) {
            _stalledTicks++;
            if (_stalledTicks >= 4) {
              // Stalled >12s on 4G: smoothly re-attach HLS playlist without tearing down socket
              _watchdogTimer?.cancel();
              _attachPlayer(activeUrl);
            }
          } else {
            _lastWatchPosition = val.position;
            _stalledTicks = 0;
          }
        }
      });

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isConnecting = false;
          _retryCount = 0;
        });
      }
    } catch (e) {
      _watchdogTimer?.cancel();
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

  void _stopSessionFor(String terminalId) {
    if (terminalId.isEmpty) return;
    _lastStartDispatchByTerminal.remove(terminalId);
    try {
      final token = ApiService.instance.currentToken;
      final headers = <String, String>{
        'Content-Type': 'application/json',
        'X-API-KEY': 'gbt-tc-prod-key-9f82d14b',
      };
      if (token != null) headers['Authorization'] = 'Bearer $token';
      http.post(
        Uri.parse('${ApiService.serverHost}/api/video/stop-live?terminalId=$terminalId'),
        headers: headers,
        body: jsonEncode({'terminalId': terminalId}),
      ).catchError((_) => http.Response('{}', 500));
      http.post(
        Uri.parse('${ApiService.serverHost}/api/v1/live-sessions/stop'),
        headers: headers,
        body: jsonEncode({'terminalId': terminalId}),
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
    _disposed = true;
    _heartbeatTimer?.cancel();
    _retryTimer?.cancel();
    _watchdogTimer?.cancel();
    if (!widget.isOfflineWifiMode) {
      _unregisterMount(widget.terminalId);
      if ((_mountedViewsByTerminal[widget.terminalId] ?? 0) == 0) {
        _stopSessionFor(widget.terminalId);
      }
    }
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
                        : '🔴 LIVE 4G • 1080P FHD • CH${widget.channel}',
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
