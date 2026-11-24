import 'package:flutter/material.dart';

class TrackifyLogo extends StatelessWidget {
  final double size;
  final bool showText;
  final Color? textColor;

  const TrackifyLogo({
    super.key,
    this.size = 38,
    this.showText = true,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Real Official TrackAnywhere Brand Logo Image
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(size * 0.22),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0284C7).withOpacity(0.18),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.asset(
            'assets/images/logo.png',
            fit: BoxFit.contain,
          ),
        ),
        if (showText) ...[
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'TrackAnywhere',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: size * 0.42,
                  fontWeight: FontWeight.w900,
                  color: textColor ?? const Color(0xFF0F172A),
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                'Commercial Fleet Video Telematics',
                style: TextStyle(
                  fontSize: size * 0.25,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF64748B),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
