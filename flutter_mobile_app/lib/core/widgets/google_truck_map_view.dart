import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

String resolveIndianLocation(double lat, double lng) {
  if (lat >= 22.4 && lat <= 23.0 && lng >= 75.5 && lng <= 76.2) {
    return 'Indore, MP (India)';
  } else if (lat >= 23.0 && lat <= 23.5 && lng >= 75.6 && lng <= 76.2) {
    return 'Ujjain Highway, MP (India)';
  } else if (lat >= 23.1 && lat <= 23.5 && lng >= 77.2 && lng <= 77.7) {
    return 'Bhopal, MP (India)';
  } else if (lat >= 28.3 && lat <= 28.9 && lng >= 76.9 && lng <= 77.5) {
    return 'New Delhi (India)';
  } else if (lat >= 18.8 && lat <= 19.4 && lng >= 72.7 && lng <= 73.2) {
    return 'Mumbai, MH (India)';
  } else if (lat >= 18.3 && lat <= 18.8 && lng >= 73.6 && lng <= 74.1) {
    return 'Pune, MH (India)';
  } else if (lat >= 26.6 && lat <= 27.2 && lng >= 75.5 && lng <= 76.1) {
    return 'Jaipur, RJ (India)';
  } else if (lat >= 8.0 && lat <= 37.0 && lng >= 68.0 && lng <= 97.0) {
    return '${lat.toStringAsFixed(2)}°N, ${lng.toStringAsFixed(2)}°E (India)';
  }
  return 'Indore, MP (India)';
}

class GoogleTruckMapView extends StatefulWidget {
  final double lat;
  final double lng;
  final double heading;
  final double speedKmh;
  final String plate;
  final String status;
  final double height;
  final VoidCallback? onTap;
  final VoidCallback? onWatchLive;
  final VoidCallback? onPlayback;
  final String? driver;
  final String? terminalId;

  const GoogleTruckMapView({
    super.key,
    required this.lat,
    required this.lng,
    this.heading = 0.0,
    this.speedKmh = 0.0,
    required this.plate,
    this.status = 'OFFLINE',
    this.height = 200,
    this.onTap,
    this.onWatchLive,
    this.onPlayback,
    this.driver,
    this.terminalId,
  });

  @override
  State<GoogleTruckMapView> createState() => _GoogleTruckMapViewState();
}

class _GoogleTruckMapViewState extends State<GoogleTruckMapView> {
  Completer<GoogleMapController> _controllerCompleter = Completer();
  GoogleMapController? _mapController;
  String? _mapStyle;

  @override
  void initState() {
    super.initState();
    _loadMapStyle();
  }

  Future<void> _loadMapStyle() async {
    try {
      final style = await rootBundle.loadString('assets/map_styles/light_map.json');
      if (mounted) {
        setState(() {
          _mapStyle = style;
        });
      }
    } catch (e) {
      debugPrint('Failed to load map style: $e');
    }
  }

  @override
  void didUpdateWidget(covariant GoogleTruckMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.lat != widget.lat || oldWidget.lng != widget.lng) {
      _mapController?.animateCamera(
        CameraUpdate.newLatLng(
          LatLng(
            widget.lat != 0.0 ? widget.lat : 22.7196,
            widget.lng != 0.0 ? widget.lng : 75.8577,
          ),
        ),
      );
    }
  }

  void _openFullScreen(BuildContext context) {
    if (widget.onTap != null) {
      widget.onTap!();
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FullScreenGoogleMapPage(
          lat: widget.lat != 0.0 ? widget.lat : 22.7196,
          lng: widget.lng != 0.0 ? widget.lng : 75.8577,
          heading: widget.heading,
          speedKmh: widget.speedKmh,
          plate: widget.plate,
          status: widget.status,
          driver: widget.driver ?? 'Unassigned',
          terminalId: widget.terminalId ?? '',
          onWatchLive: widget.onWatchLive,
          onPlayback: widget.onPlayback,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final double lat = widget.lat != 0.0 ? widget.lat : 22.7196;
    final double lng = widget.lng != 0.0 ? widget.lng : 75.8577;
    final pos = LatLng(lat, lng);
    final isOnline = widget.status.toUpperCase() == 'ONLINE';

    final markers = <Marker>{
      Marker(
        markerId: MarkerId(widget.plate),
        position: pos,
        rotation: widget.heading,
        anchor: const Offset(0.5, 0.5),
        infoWindow: InfoWindow(
          title: widget.plate,
          snippet: '${widget.speedKmh.toStringAsFixed(0)} km/h • ${widget.status}',
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          isOnline ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueAzure,
        ),
      ),
    };

    return Container(
      height: widget.height,
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
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: pos,
              zoom: 14.5,
            ),
            markers: markers,
            style: _mapStyle,
            myLocationEnabled: false,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            compassEnabled: true,
            mapToolbarEnabled: false,
            onMapCreated: (controller) {
              if (!_controllerCompleter.isCompleted) {
                _controllerCompleter.complete(controller);
              }
              _mapController = controller;
              if (_mapStyle != null) {
                controller.setMapStyle(_mapStyle);
              }
            },
            onTap: (_) => _openFullScreen(context),
          ),

          // Top Info Banner on Map
          Positioned(
            top: 10,
            left: 10,
            right: 10,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Vehicle Plate & Speed Chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.92),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOnline ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        widget.plate,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isOnline ? 'ONLINE' : 'OFFLINE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: isOnline ? const Color(0xFF15803D) : const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '• ${resolveIndianLocation(lat, lng)}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0284C7),
                        ),
                      ),
                    ],
                  ),
                ),

                // Fullscreen Button
                InkWell(
                  onTap: () => _openFullScreen(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0284C7).withOpacity(0.25),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.fullscreen_rounded, size: 14, color: Colors.white),
                        SizedBox(width: 4),
                        Text(
                          'Google Map',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
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
}

class FullScreenGoogleMapPage extends StatefulWidget {
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

  const FullScreenGoogleMapPage({
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
  State<FullScreenGoogleMapPage> createState() => _FullScreenGoogleMapPageState();
}

class _FullScreenGoogleMapPageState extends State<FullScreenGoogleMapPage> {
  MapType _currentMapType = MapType.normal;
  String? _mapStyle;

  @override
  void initState() {
    super.initState();
    _loadStyle();
  }

  Future<void> _loadStyle() async {
    try {
      final style = await rootBundle.loadString('assets/map_styles/light_map.json');
      if (mounted) setState(() => _mapStyle = style);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final pos = LatLng(widget.lat, widget.lng);
    final isOnline = widget.status.toUpperCase() == 'ONLINE';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.plate,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            Text(
              'Google Map Live Tracking • ${widget.status}',
              style: TextStyle(
                fontSize: 12,
                color: isOnline ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _currentMapType == MapType.normal ? Icons.satellite_alt_rounded : Icons.map_rounded,
              color: const Color(0xFF0284C7),
            ),
            tooltip: 'Toggle Satellite / Normal',
            onPressed: () {
              setState(() {
                _currentMapType = _currentMapType == MapType.normal ? MapType.satellite : MapType.normal;
              });
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(target: pos, zoom: 16),
            mapType: _currentMapType,
            style: _currentMapType == MapType.normal ? _mapStyle : null,
            myLocationEnabled: false,
            zoomControlsEnabled: true,
            markers: {
              Marker(
                markerId: MarkerId(widget.plate),
                position: pos,
                rotation: widget.heading,
                infoWindow: InfoWindow(
                  title: widget.plate,
                  snippet: '${widget.speedKmh.toStringAsFixed(0)} km/h • Driver: ${widget.driver}',
                ),
                icon: BitmapDescriptor.defaultMarkerWithHue(
                  isOnline ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueAzure,
                ),
              ),
            },
            onMapCreated: (_) {},
          ),

          // Bottom Action Card
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
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
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.plate,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            resolveIndianLocation(widget.lat, widget.lng),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0284C7),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Driver: ${widget.driver} • Status: ${widget.status}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${widget.speedKmh.toStringAsFixed(0)} km/h',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0284C7),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (widget.onWatchLive != null)
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0284C7),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.videocam_rounded, size: 18),
                            label: const Text('Live Camera', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () {
                              Navigator.pop(context);
                              widget.onWatchLive!();
                            },
                          ),
                        ),
                      if (widget.onWatchLive != null && widget.onPlayback != null)
                        const SizedBox(width: 10),
                      if (widget.onPlayback != null)
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF0284C7),
                              side: const BorderSide(color: Color(0xFF0284C7)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
                            label: const Text('SD Playback', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () {
                              Navigator.pop(context);
                              widget.onPlayback!();
                            },
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
    );
  }
}
