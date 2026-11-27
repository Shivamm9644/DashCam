import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Professional Dark-themed Map widget displaying real-time truck position,
/// directional heading, live speed in MPH, and satellite tracking telemetry.
/// Uses high-performance CartoDB / OpenStreetMap dark tiles with zero API key dependencies.
class LiveTruckMapView extends StatefulWidget {
  final double lat;
  final double lng;
  final double heading;
  final double speedMph;
  final double? speedKmh;
  final String plate;
  final String status;
  final double height;
  final bool showControls;
  final VoidCallback? onExpand;
  final VoidCallback? onTap;
  final VoidCallback? onWatchLive;
  final VoidCallback? onPlayback;
  final String? driver;
  final String? terminalId;

  const LiveTruckMapView({
    super.key,
    required this.lat,
    required this.lng,
    this.heading = 0.0,
    this.speedMph = 0.0,
    this.speedKmh,
    required this.plate,
    this.status = 'OFFLINE',
    this.height = 200,
    this.showControls = true,
    this.onExpand,
    this.onTap,
    this.onWatchLive,
    this.onPlayback,
    this.driver,
    this.terminalId,
  });

  @override
  State<LiveTruckMapView> createState() => _LiveTruckMapViewState();
}

class _LiveTruckMapViewState extends State<LiveTruckMapView>
    with SingleTickerProviderStateMixin {
  int _zoom = 14;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _zoomIn() {
    if (_zoom < 17) setState(() => _zoom++);
  }

  void _zoomOut() {
    if (_zoom > 10) setState(() => _zoom--);
  }

  void _openFullScreen(BuildContext context, double effectiveLat, double effectiveLng) {
    if (widget.onTap != null) {
      widget.onTap!();
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FullScreenTruckMapPage(
          lat: effectiveLat,
          lng: effectiveLng,
          heading: widget.heading,
          speedKmh: widget.speedKmh ?? (widget.speedMph * 1.60934),
          plate: widget.plate,
          status: widget.status,
          driver: (widget.driver != null && widget.driver!.isNotEmpty && widget.driver != 'Assigned Driver') ? widget.driver! : 'Unassigned',
          terminalId: widget.terminalId ?? '',
          onWatchLive: widget.onWatchLive,
          onPlayback: widget.onPlayback,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // If coordinates are uninitialized or 0, fallback to default active truck location (Indore, MP, India)
    final effectiveLat = (widget.lat != 0.0) ? widget.lat : 22.7196;
    final effectiveLng = (widget.lng != 0.0) ? widget.lng : 75.8577;

    // Slippy Map tile calculation (OpenStreetMap / CartoDB standard EPSG:3857)
    final n = math.pow(2.0, _zoom.toDouble()).toDouble();
    final xExact = (effectiveLng + 180.0) / 360.0 * n;
    final latRad = effectiveLat * math.pi / 180.0;
    final yExact = (1.0 - math.log(math.tan(latRad) + 1.0 / math.cos(latRad)) / math.pi) / 2.0 * n;

    final centerTileX = xExact.floor();
    final centerTileY = yExact.floor();

    // Pixel offset inside the center tile (0.0 to 256.0)
    final fracX = (xExact - centerTileX) * 256.0;
    final fracY = (yExact - centerTileY) * 256.0;

    return GestureDetector(
      onTap: () => _openFullScreen(context, effectiveLat, effectiveLng),
      child: Container(
        height: widget.height,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.accentCyan.withOpacity(0.35)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: LayoutBuilder(
        builder: (context, constraints) {
          final viewWidth = constraints.maxWidth;
          final viewHeight = constraints.maxHeight;
          final centerX = viewWidth / 2.0;
          final centerY = viewHeight / 2.0;

          return Stack(
            children: [
              // 3x3 Tile Grid rendered behind the truck marker
              ..._buildTiles(centerTileX, centerTileY, centerX, centerY, fracX, fracY),

              // Semi-transparent dark vignette for military-grade HUD feel
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.9,
                      colors: [
                        Colors.transparent,
                        Colors.black.withOpacity(0.4),
                      ],
                    ),
                  ),
                ),
              ),

              // Top Left Badge: Truck Identification Pill
              Positioned(
                top: 10,
                left: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.accentCyan.withOpacity(0.6)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: widget.status == 'ONLINE'
                              ? AppTheme.statusOnline
                              : Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        widget.plate,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: widget.status == 'ONLINE'
                              ? AppTheme.accentGreen.withOpacity(0.2)
                              : Colors.white.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          widget.status == 'ONLINE'
                              ? '${((widget.speedKmh ?? (widget.speedMph * 1.60934))).round()} KM/H'
                              : 'OFFLINE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: widget.status == 'ONLINE' ? AppTheme.accentGreen : Colors.white70,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Top Right Controls (Zoom In, Zoom Out, Center)
              if (widget.showControls)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildMapButton(
                        icon: Icons.add_rounded,
                        onTap: _zoomIn,
                        tooltip: 'Zoom In',
                      ),
                      const SizedBox(width: 6),
                      _buildMapButton(
                        icon: Icons.remove_rounded,
                        onTap: _zoomOut,
                        tooltip: 'Zoom Out',
                      ),
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: () => _openFullScreen(context, effectiveLat, effectiveLng),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accentSaffron,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.fullscreen_rounded, color: Colors.black, size: 15),
                              SizedBox(width: 3),
                              Text(
                                'Full Screen',
                                style: TextStyle(
                                  color: Colors.black,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // CENTER: Animated Truck Marker & Radar Pulsing Beacon
              Positioned(
                left: centerX - 24,
                top: centerY - 24,
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Radar pulse wave (only when online)
                      if (widget.status.toUpperCase() == 'ONLINE')
                        FadeTransition(
                          opacity: _pulseController,
                          child: Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.accentCyan.withOpacity(0.2),
                              border: Border.all(
                                color: AppTheme.accentCyan.withOpacity(0.6),
                                width: 1.5,
                              ),
                            ),
                          ),
                        ),
                      // Directional arrow / Truck icon
                      Transform.rotate(
                        angle: (widget.heading) * math.pi / 180.0,
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0A0E1A),
                            shape: BoxShape.circle,
                            border: Border.all(color: AppTheme.accentCyan, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.accentCyan.withOpacity(0.8),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.navigation_rounded,
                              color: AppTheme.accentCyan,
                              size: 18,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Bottom Coordinates & Telemetry Overlay
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withOpacity(0.9),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.satellite_alt_rounded,
                          color: AppTheme.accentGreen, size: 13),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          (widget.lat != 0.0 && widget.lng != 0.0)
                              ? '🇮🇳 GPS: ${effectiveLat.toStringAsFixed(4)}°N, ${effectiveLng.toStringAsFixed(4)}°E • Heading: ${widget.heading.toInt()}° • ${widget.status}'
                              : '📡 No GPS Lock (Awaiting Satellite Fix) • ${widget.status}',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontFamily: 'monospace',
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Map Zoom ${_zoom}x',
                        style: const TextStyle(
                          fontSize: 9,
                          color: AppTheme.textMuted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

  Widget _buildMapButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.8),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AppTheme.borderSubtle),
          ),
          child: Icon(icon, color: Colors.white, size: 16),
        ),
      ),
    );
  }

  List<Widget> _buildTiles(
    int centerTileX,
    int centerTileY,
    double centerX,
    double centerY,
    double fracX,
    double fracY,
  ) {
    final tiles = <Widget>[];
    // Render 3x3 tiles surrounding the vehicle coordinate
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        final tx = centerTileX + dx;
        final ty = centerTileY + dy;

        // Position on canvas
        final left = centerX - fracX + (dx * 256.0);
        final top = centerY - fracY + (dy * 256.0);

        final tileUrl = 'https://tile.openstreetmap.org/$_zoom/$tx/$ty.png';

        tiles.add(
          Positioned(
            left: left,
            top: top,
            width: 256,
            height: 256,
            child: Image.network(
              tileUrl,
              headers: const {'User-Agent': 'IndianDashCam/1.0 (Mobile Automotive Telematics)'},
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: const Color(0xFF111827),
                child: Center(
                  child: Container(
                    width: 254,
                    height: 254,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0x1500D4FF)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
    }
    return tiles;
  }
}

class FullScreenTruckMapPage extends StatefulWidget {
  final double lat;
  final double lng;
  final double heading;
  final double speedKmh;
  final String plate;
  final String status;
  final String driver;
  final String terminalId;
  final VoidCallback? onWatchLive;
  final VoidCallback? onPlayback;

  const FullScreenTruckMapPage({
    super.key,
    required this.lat,
    required this.lng,
    required this.heading,
    required this.speedKmh,
    required this.plate,
    required this.status,
    required this.driver,
    required this.terminalId,
    this.onWatchLive,
    this.onPlayback,
  });

  @override
  State<FullScreenTruckMapPage> createState() => _FullScreenTruckMapPageState();
}

class _FullScreenTruckMapPageState extends State<FullScreenTruckMapPage>
    with SingleTickerProviderStateMixin {
  int _zoom = 15;
  late AnimationController _pulseController;
  Offset _dragOffset = Offset.zero;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _zoomIn() {
    if (_zoom < 18) setState(() => _zoom++);
  }

  void _zoomOut() {
    if (_zoom > 9) setState(() => _zoom--);
  }

  void _centerTruck() {
    setState(() => _dragOffset = Offset.zero);
  }

  @override
  Widget build(BuildContext context) {
    final effectiveLat = (widget.lat != 0.0) ? widget.lat : 22.7196;
    final effectiveLng = (widget.lng != 0.0) ? widget.lng : 75.8577;
    final isOnline = widget.status.toUpperCase() == 'ONLINE';
    final hasGps = widget.lat != 0.0 && widget.lng != 0.0;

    Color statusColor;
    String statusLabel;
    if (isOnline) {
      if (!hasGps) {
        statusColor = const Color(0xFFF59E0B);
        statusLabel = 'ONLINE • NO GPS';
      } else if (widget.speedKmh > 0) {
        statusColor = AppTheme.accentTeal;
        statusLabel = 'MOVING ${widget.speedKmh.round()} KM/H';
      } else {
        statusColor = AppTheme.accentGreen;
        statusLabel = 'ONLINE • LIVE';
      }
    } else {
      statusColor = AppTheme.statusOffline;
      statusLabel = 'OFFLINE';
    }

    final n = math.pow(2.0, _zoom.toDouble()).toDouble();
    final xExact = (effectiveLng + 180.0) / 360.0 * n;
    final latRad = effectiveLat * math.pi / 180.0;
    final yExact = (1.0 - math.log(math.tan(latRad) + 1.0 / math.cos(latRad)) / math.pi) / 2.0 * n;

    final centerTileX = xExact.floor();
    final centerTileY = yExact.floor();

    final fracX = (xExact - centerTileX) * 256.0;
    final fracY = (yExact - centerTileY) * 256.0;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F17),
      body: SafeArea(
        child: Stack(
          children: [
            GestureDetector(
              onPanUpdate: (details) {
                setState(() {
                  _dragOffset += details.delta;
                });
              },
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final viewWidth = constraints.maxWidth;
                  final viewHeight = constraints.maxHeight;
                  final centerX = (viewWidth / 2.0) + _dragOffset.dx;
                  final centerY = (viewHeight / 2.0) + _dragOffset.dy;

                  return Stack(
                    children: [
                      ..._buildExpandedTiles(centerTileX, centerTileY, centerX, centerY, fracX, fracY),
                      Positioned(
                        left: centerX - 28,
                        top: centerY - 28,
                        child: SizedBox(
                          width: 56,
                          height: 56,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              FadeTransition(
                                opacity: _pulseController,
                                child: Container(
                                  width: 54,
                                  height: 54,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppTheme.accentSaffron.withOpacity(0.25),
                                    border: Border.all(
                                      color: AppTheme.accentSaffron.withOpacity(0.7),
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                              Transform.rotate(
                                angle: widget.heading * math.pi / 180.0,
                                child: Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppTheme.accentSaffron, width: 2.5),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppTheme.accentSaffron.withOpacity(0.6),
                                        blurRadius: 12,
                                      ),
                                    ],
                                  ),
                                  child: const Center(
                                    child: Icon(
                                      Icons.navigation_rounded,
                                      color: AppTheme.accentSaffron,
                                      size: 22,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 22),
                      onPressed: () => Navigator.pop(context),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(color: const Color(0xFF1E293B)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFF003399),
                              borderRadius: BorderRadius.circular(2),
                            ),
                            child: const Text(
                              'IND',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            widget.plate,
                            style: const TextStyle(
                              color: Colors.black,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(color: statusColor.withOpacity(0.5)),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: statusColor,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${widget.speedKmh.round()} km/h',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.accentTeal,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),

            Positioned(
              right: 14,
              top: 80,
              child: Column(
                children: [
                  _circleButton(icon: Icons.add_rounded, onTap: _zoomIn),
                  const SizedBox(height: 8),
                  _circleButton(icon: Icons.remove_rounded, onTap: _zoomOut),
                  const SizedBox(height: 8),
                  _circleButton(icon: Icons.my_location_rounded, onTap: _centerTruck, highlight: _dragOffset != Offset.zero),
                ],
              ),
            ),

            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.person_pin_rounded, color: AppTheme.accentSaffron, size: 18),
                            const SizedBox(width: 6),
                            Text(
                              widget.driver,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        if (widget.terminalId.isNotEmpty)
                          Text(
                            'IMEI: ${widget.terminalId}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                              fontFamily: 'monospace',
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.satellite_alt_rounded, color: Color(0xFF0284C7), size: 14),
                        const SizedBox(width: 6),
                        Text(
                          hasGps
                              ? 'GPS: ${effectiveLat.toStringAsFixed(4)}°N, ${effectiveLng.toStringAsFixed(4)}°E'
                              : 'No GPS Fix (Awaiting Satellite Lock)',
                          style: TextStyle(
                            fontSize: 11,
                            color: hasGps ? const Color(0xFF0284C7) : const Color(0xFFD97706),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () {
                              Navigator.pop(context);
                              if (widget.onWatchLive != null) {
                                widget.onWatchLive!();
                              }
                            },
                            icon: const Icon(Icons.videocam_rounded, size: 20),
                            label: const Text(
                              'WATCH LIVE STREAM',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0284C7),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () {
                              Navigator.pop(context);
                              if (widget.onPlayback != null) {
                                widget.onPlayback!();
                              }
                            },
                            icon: const Icon(Icons.history_rounded, size: 18),
                            label: const Text('Playback', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _circleButton({required IconData icon, required VoidCallback onTap, bool highlight = false}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: highlight ? AppTheme.accentSaffron : Colors.black.withOpacity(0.85),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: highlight ? AppTheme.accentSaffron : AppTheme.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 8,
            ),
          ],
        ),
        child: Icon(icon, color: highlight ? Colors.black : Colors.white, size: 20),
      ),
    );
  }

  List<Widget> _buildExpandedTiles(
    int centerTileX,
    int centerTileY,
    double centerX,
    double centerY,
    double fracX,
    double fracY,
  ) {
    final tiles = <Widget>[];
    for (int dx = -2; dx <= 2; dx++) {
      for (int dy = -2; dy <= 2; dy++) {
        final tx = centerTileX + dx;
        final ty = centerTileY + dy;
        final left = centerX - fracX + (dx * 256.0);
        final top = centerY - fracY + (dy * 256.0);
        final tileUrl = 'https://tile.openstreetmap.org/$_zoom/$tx/$ty.png';

        tiles.add(
          Positioned(
            left: left,
            top: top,
            width: 256,
            height: 256,
            child: Image.network(
              tileUrl,
              headers: const {'User-Agent': 'IndianDashCam/1.0 (Mobile Automotive Telematics)'},
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: const Color(0xFF111827),
              ),
            ),
          ),
        );
      }
    }
    return tiles;
  }
}

