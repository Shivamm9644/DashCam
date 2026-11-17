import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:video_player/video_player.dart';

class LivePlayerView extends StatefulWidget {
  final int channel;
  final String terminalId;
  final bool isOnline;
  final VoidCallback? onRefresh;

  const LivePlayerView({
    super.key,
    required this.channel,
    required this.terminalId,
    this.isOnline = true,
    this.onRefresh,
  });

  @override
  State<LivePlayerView> createState() => _LivePlayerViewState();
}

class _LivePlayerViewState extends State<LivePlayerView> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isConnecting = true;
  String _statusMessage = 'Connecting...';
  String? _authToken;
  bool _isMuted = false;
  Timer? _retryTimer;
  int _retryCount = 0;

  @override
  void initState() {
    super.initState();
    if (widget.isOnline) {
      _startLiveWorkflow();
    } else {
      _isConnecting = false;
    }
  }

  @override
  void didUpdateWidget(covariant LivePlayerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channel != widget.channel ||
        oldWidget.terminalId != widget.terminalId ||
        oldWidget.isOnline != widget.isOnline) {
      _retryTimer?.cancel();
      _controller?.pause();
      _controller?.dispose();
      _controller = null;
      _isInitialized = false;
      if (widget.isOnline) {
        _startLiveWorkflow();
      } else {
        setState(() {
          _isConnecting = false;
        });
      }
    }
  }

  Future<void> _startLiveWorkflow() async {
    if (!mounted) return;
    setState(() {
      _isConnecting = true;
      _statusMessage = 'Connecting stream...';
    });

    String? streamUrl;

    try {
      final camId = (widget.channel == 2) ? 1 : 0;
      final roadeazyRes = await http
          .post(
            Uri.parse('https://100.31.90.51.sslip.io/api/v1/devices/${widget.terminalId}/live-stream?cameraId=$camId'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 4))
          .catchError((_) => http.Response('{}', 500));

      if (roadeazyRes.statusCode == 200) {
        final data = jsonDecode(roadeazyRes.body);
        if (data['url'] != null && data['url'].toString().isNotEmpty) {
          streamUrl = data['url'].toString();
        }
      }

      try {
        if (_authToken == null) {
          final loginRes = await http
              .post(
                Uri.parse('https://100.31.90.51.sslip.io/api/v1/auth/login'),
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode({'email': 'inurum@wanwaygps.com', 'password': 'cE7R0fZYY1cSrj'}),
              )
              .timeout(const Duration(seconds: 3))
              .catchError((_) => http.Response('{}', 500));

          if (loginRes.statusCode == 200) {
            final data = jsonDecode(loginRes.body);
            _authToken = data['token'] as String?;
          }
        }

        final startUrl = Uri.parse(
            'https://100.31.90.51.sslip.io/api/video/start-live?terminalId=${widget.terminalId}&channel=${widget.channel}&dataType=0');
        final headers = <String, String>{};
        if (_authToken != null) {
          headers['Authorization'] = 'Bearer $_authToken';
        }

        final socketRes = await http.get(startUrl, headers: headers).timeout(const Duration(seconds: 3)).catchError((_) => http.Response('{}', 200));
        if (streamUrl == null && socketRes.statusCode == 200) {
          final sData = jsonDecode(socketRes.body);
          if (sData['streamUrl'] != null) {
            final path = sData['streamUrl'].toString();
            streamUrl = path.startsWith('http') ? path : 'https://100.31.90.51.sslip.io$path';
          }
        }
      } catch (_) {}

      streamUrl ??= 'https://100.31.90.51.sslip.io/media/live/${widget.terminalId}_${widget.channel}/live.m3u8';
      await _attachPlayer(streamUrl);
    } catch (e) {
      streamUrl ??= 'https://100.31.90.51.sslip.io/media/live/${widget.terminalId}_${widget.channel}/live.m3u8';
      await _attachPlayer(streamUrl);
    }
  }

  Future<void> _attachPlayer(String hlsUrl) async {
    try {
      _controller?.dispose();
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(hlsUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      await _controller!.initialize().timeout(const Duration(seconds: 5));
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
    } catch (err) {
      _retryCount++;
      if (mounted) {
        setState(() {
          _isInitialized = false;
          _isConnecting = false;
          _statusMessage = 'Stream Standby';
        });
      }

      if (_retryCount <= 2) {
        _retryTimer?.cancel();
        _retryTimer = Timer(const Duration(seconds: 4), () {
          if (mounted && !_isInitialized && widget.isOnline) {
            _attachPlayer(hlsUrl);
          }
        });
      }
    }
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
    _retryTimer?.cancel();
    _controller?.pause();
    _controller?.dispose();
    try {
      http.get(Uri.parse('https://100.31.90.51.sslip.io/api/video/stop-live?terminalId=${widget.terminalId}&channel=${widget.channel}')).timeout(const Duration(seconds: 2)).catchError((_) => http.Response('{}', 200));
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 0. Offline State
    if (!widget.isOnline) {
      return _buildOfflinePlaceholder();
    }

    // 1. Real Video Playing State
    if (_isInitialized && _controller != null && _controller!.value.isInitialized) {
      return Stack(
        fit: StackFit.expand,
        children: [
          ClipRect(
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width > 0 ? _controller!.value.size.width : 16,
                height: _controller!.value.size.height > 0 ? _controller!.value.size.height : 9,
                child: VideoPlayer(_controller!),
              ),
            ),
          ),

          // Live badge
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.7),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFF10B981).withOpacity(0.5)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'LIVE • CH${widget.channel}',
                    style: const TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Audio Mute Toggle
          Positioned(
            top: 10,
            right: 10,
            child: GestureDetector(
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
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Color(0xFF00D4FF),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _statusMessage,
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

    // 3. Standby / No Feed Placeholder
    return Container(
      color: const Color(0xFF0F172A),
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
                Icons.videocam_outlined,
                size: 32,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'No Live Stream',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Camera is in standby',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00D4FF),
                side: BorderSide(color: const Color(0xFF00D4FF).withOpacity(0.4)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
              onPressed: _startLiveWorkflow,
              icon: const Icon(Icons.refresh_rounded, size: 14),
              label: const Text('Retry', style: TextStyle(fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfflinePlaceholder() {
    return Container(
      color: const Color(0xFF0F172A),
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
              'Vehicle Offline',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Dashcam is disconnected or powered off',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 11,
              ),
            ),
            if (widget.onRefresh != null) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF00D4FF),
                  side: BorderSide(color: const Color(0xFF00D4FF).withOpacity(0.4)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                ),
                onPressed: widget.onRefresh,
                icon: const Icon(Icons.refresh_rounded, size: 14),
                label: const Text('Refresh Status', style: TextStyle(fontSize: 11)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
