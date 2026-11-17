import 'package:flutter/material.dart';

class AppTheme {
  // === Color Palette ===
  static const Color bgPrimary   = Color(0xFF0A0E1A);
  static const Color bgCard      = Color(0xFF111827);
  static const Color bgCardHover = Color(0xFF1C2537);
  static const Color bgGlass     = Color(0x1AFFFFFF);

  static const Color accentCyan    = Color(0xFF00D4FF);
  static const Color accentGreen   = Color(0xFF10B981);
  static const Color accentPurple  = Color(0xFF8B5CF6);
  static const Color accentOrange  = Color(0xFFF59E0B);

  static const Color statusOnline   = Color(0xFF10B981);
  static const Color statusWarning  = Color(0xFFF59E0B);
  static const Color statusCritical = Color(0xFFEF4444);
  static const Color statusOffline  = Color(0xFF6B7280);

  static const Color textPrimary   = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFFD1D5DB);
  static const Color textMuted     = Color(0xFF9CA3AF);

  static const Color borderSubtle = Color(0x1AFFFFFF);
  static const Color borderLight  = Color(0x33FFFFFF);

  // === Gradients ===
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0A0E1A), Color(0xFF111827)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF00D4FF), Color(0xFF8B5CF6)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x1AFFFFFF), Color(0x0DFFFFFF)],
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    splashFactory: InkRipple.splashFactory,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: bgPrimary,
    colorScheme: const ColorScheme.dark(
      primary: accentCyan,
      secondary: accentPurple,
      surface: bgCard,
      error: statusCritical,
    ),
    fontFamily: 'PlusJakartaSans',
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
        fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary,
      ),
      titleMedium: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w500, color: textSecondary,
      ),
      bodyLarge: TextStyle(
        fontSize: 14, fontWeight: FontWeight.w400, color: textSecondary,
      ),
      bodyMedium: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w400, color: textSecondary,
      ),
      bodySmall: TextStyle(
        fontSize: 11, fontWeight: FontWeight.w400, color: textMuted,
      ),
      labelLarge: TextStyle(
        fontSize: 12, fontWeight: FontWeight.w600, color: textPrimary, letterSpacing: 0.5,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: bgCard,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontSize: 17, fontWeight: FontWeight.w700, color: textPrimary,
        fontFamily: 'PlusJakartaSans',
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      color: bgCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: borderSubtle, width: 1),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: bgCardHover,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: accentCyan, width: 1.5),
      ),
      hintStyle: TextStyle(color: textMuted, fontSize: 14),
      labelStyle: TextStyle(color: textSecondary),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: accentCyan,
        foregroundColor: bgPrimary,
        elevation: 0,
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        textStyle: TextStyle(
          fontSize: 14, fontWeight: FontWeight.w700, fontFamily: 'PlusJakartaSans',
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: bgCardHover,
      labelStyle: TextStyle(color: textSecondary, fontSize: 12),
      side: BorderSide(color: borderSubtle),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
    ),
    dividerTheme: const DividerThemeData(
      color: borderSubtle,
      thickness: 1,
    ),
  );

  // === Box Decorations ===
  static BoxDecoration glassCard({double radius = 16, Color? borderColor}) => BoxDecoration(
    gradient: cardGradient,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: borderColor ?? borderSubtle, width: 1),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.3),
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration accentCard({required Color color, double radius = 16}) => BoxDecoration(
    color: color.withOpacity(0.1),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: color.withOpacity(0.3), width: 1),
  );
}
