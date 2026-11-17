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
  final String plate;
  final String status;
  final double height;
  final bool showControls;
  final VoidCallback? onExpand;

  const LiveTruckMapView({
    super.key,
    required this.lat,
    required this.lng,
    this.heading = 0.0,
    this.speedMph = 0.0,
    required this.plate,
    this.status = 'ONLINE',
    this.height = 200,
    this.showControls = true,
    this.onExpand,
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

  @override
  Widget build(BuildContext context) {
    // If coordinates are uninitialized or 0, fallback to default active truck location
    final effectiveLat = (widget.lat != 0.0) ? widget.lat : 22.7339;
    final effectiveLng = (widget.lng != 0.0) ? widget.lng : 75.8615;

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

    return Container(
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
                          color: AppTheme.accentGreen.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${widget.speedMph.toInt()} MPH',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.accentGreen,
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
                      if (widget.onExpand != null) ...[
                        const SizedBox(width: 6),
                        _buildMapButton(
                          icon: Icons.fullscreen_rounded,
                          onTap: widget.onExpand!,
                          tooltip: 'Full Map',
                        ),
                      ],
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
                      // Radar pulse wave
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
                          'US GPS: ${effectiveLat.toStringAsFixed(4)}°N, ${effectiveLng.toStringAsFixed(4)}°W • Heading: ${widget.heading.toInt()}° • Status: ${widget.status}',
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

        final tileUrl = 'https://a.basemaps.cartocdn.com/dark_all/$_zoom/$tx/$ty.png';

        tiles.add(
          Positioned(
            left: left,
            top: top,
            width: 256,
            height: 256,
            child: Image.network(
              tileUrl,
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

