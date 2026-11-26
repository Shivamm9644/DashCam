import 'package:flutter/material.dart';

class AppTheme {
  // === Trackify DashCam Modern Palette ===
  static const Color accentBlue    = Color(0xFF0284C7); // Trackify Signature Ocean Blue
  static const Color accentTeal    = Color(0xFF0D9488); // Modern Electric Teal
  static const Color accentCyan    = Color(0xFF0284C7);
  static const Color accentGreen   = Color(0xFF10B981); 
  static const Color accentSaffron = Color(0xFFF59E0B); 
  static const Color accentNavy    = Color(0xFF0F172A); 
  static const Color accentPurple  = Color(0xFF8B5CF6);
  static const Color accentOrange  = Color(0xFFEA580C);

  // Backgrounds: Clean, High-Contrast Modern Light Theme (Matching Trackify)
  static const Color bgPrimary   = Color(0xFFF8FAFC); // Crisp Cool Slate 50
  static const Color bgCard      = Color(0xFFFFFFFF); // Pure White Card
  static const Color bgCardHover = Color(0xFFF1F5F9); // Light Tint Slate 100
  static const Color bgGlass     = Color(0xFFFFFFFF);

  // Telematics Connection Statuses
  static const Color statusOnline   = Color(0xFF10B981);
  static const Color statusWarning  = Color(0xFFF59E0B);
  static const Color statusCritical = Color(0xFFEF4444);
  static const Color statusOffline  = Color(0xFF64748B);

  // Typography
  static const Color textPrimary   = Color(0xFF0F172A); // Deep Slate 900
  static const Color textSecondary = Color(0xFF334155); // Slate 700
  static const Color textMuted     = Color(0xFF64748B); // Slate 500

  // Borders
  static const Color borderSubtle = Color(0xFFE2E8F0); // Slate 200
  static const Color borderLight  = Color(0xFFCBD5E1); // Slate 300
  static const Color borderActive = Color(0xFF0284C7);

  // === Gradients ===
  static const LinearGradient trackifyGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
  );

  static const LinearGradient saffronGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0284C7), Color(0xFF0D9488)],
  );

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0284C7), Color(0xFF0D9488)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
  );

  static BoxDecoration glassCard({double radius = 16, Color? borderColor}) => BoxDecoration(
    color: bgCard,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: borderColor ?? borderSubtle),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.04),
        blurRadius: 8,
        offset: const Offset(0, 2),
      ),
    ],
  );

  static BoxDecoration accentCard({Color? color, double radius = 16}) {
    final c = color ?? accentBlue;
    return BoxDecoration(
      color: bgCard,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: c.withOpacity(0.3)),
      boxShadow: [
        BoxShadow(
          color: c.withOpacity(0.08),
          blurRadius: 10,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }

  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    splashFactory: InkRipple.splashFactory,
    brightness: Brightness.light,
    scaffoldBackgroundColor: bgPrimary,
    colorScheme: const ColorScheme.light(
      primary: accentBlue,
      secondary: accentTeal,
      surface: bgCard,
      error: statusCritical,
    ),
    fontFamily: 'Montserrat',
    textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.5,
        ),
        displayMedium: TextStyle(
          fontSize: 24, fontWeight: FontWeight.w700, color: textPrimary, letterSpacing: -0.3,
        ),
        headlineLarge: TextStyle(
          fontSize: 20, fontWeight: FontWeight.w700, color: textPrimary,
        ),
        headlineMedium: TextStyle(
          fontSize: 17, fontWeight: FontWeight.w700, color: textPrimary,
        ),
        headlineSmall: TextStyle(
          fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 14, fontWeight: FontWeight.w700, color: textPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 13, fontWeight: FontWeight.w600, color: textSecondary,
        ),
        bodyLarge: TextStyle(
          fontSize: 14, fontWeight: FontWeight.w500, color: textSecondary,
        ),
        bodyMedium: TextStyle(
          fontSize: 13, fontWeight: FontWeight.w500, color: textSecondary,
        ),
        bodySmall: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w400, color: textMuted,
        ),
        labelLarge: TextStyle(
          fontSize: 13, fontWeight: FontWeight.w700, color: textPrimary,
        ),
        labelMedium: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w600, color: textSecondary,
        ),
        labelSmall: TextStyle(
          fontSize: 10, fontWeight: FontWeight.w700, color: textMuted, letterSpacing: 0.5,
        ),
      ),
    appBarTheme: const AppBarTheme(
      backgroundColor: bgCard,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 17, fontWeight: FontWeight.w700, color: textPrimary,
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      color: bgCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: borderSubtle),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: accentBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: accentBlue,
        side: const BorderSide(color: borderSubtle),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
  );
}
