import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';

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
  late String _viewId;
  static final Set<String> _registeredViews = {};

  @override
  void initState() {
    super.initState();
    _registerView();
  }

  @override
  void didUpdateWidget(LivePlayerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channel != widget.channel ||
        oldWidget.terminalId != widget.terminalId ||
        oldWidget.isOnline != widget.isOnline ||
        oldWidget.isOfflineWifiMode != widget.isOfflineWifiMode) {
      _registerView();
      setState(() {});
    }
  }

  void _registerView() {
    final mode = widget.isOfflineWifiMode ? "offline" : (widget.isOnline ? "on" : "off");
    _viewId = 'live-dashcam-ch${widget.channel}-${widget.terminalId}-$mode';
    if (!_registeredViews.contains(_viewId)) {
      _registeredViews.add(_viewId);
      ui_web.platformViewRegistry.registerViewFactory(
        _viewId,
        (int id) => html.IFrameElement()
          ..src = '/player.html?ch=${widget.channel}&terminalId=${widget.terminalId}&isOnline=${widget.isOnline ? 1 : 0}&offline=${widget.isOfflineWifiMode ? 1 : 0}'
          ..style.border = 'none'
          ..style.width = '100%'
          ..style.height = '100%'
          ..id = 'iframe-dashcam-ch${widget.channel}'
          ..allow = 'autoplay; fullscreen; encrypted-media; microphone',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewId);
  }
}
