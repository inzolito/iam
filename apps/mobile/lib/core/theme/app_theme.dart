import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../design/design_tokens.dart';

/// Tema único de marca IAM (azul pastel + acento lavanda).
///
/// Reemplaza el esquema anterior de 4 temas por diagnóstico: la marca
/// es consistente para todos los usuarios; la app ya no muta de color
/// según el diagnóstico seleccionado.
class AppTheme {
  AppTheme._();

  /// En tests, `GoogleFonts` intenta un fetch de red en segundo plano que
  /// no se puede cancelar y que falla en sandboxes sin internet, filtrando
  /// errores async hacia tests no relacionados. Los tests ponen esto en
  /// `true` para usar la fuente del sistema y evitar esa red.
  static bool disableGoogleFonts = false;

  static TextStyle _font({
    double? fontSize,
    FontWeight? fontWeight,
    double? letterSpacing,
    Color? color,
  }) {
    if (disableGoogleFonts) {
      return TextStyle(
        fontSize: fontSize,
        fontWeight: fontWeight,
        letterSpacing: letterSpacing,
        color: color,
      );
    }
    return GoogleFonts.plusJakartaSans(
      fontSize: fontSize,
      fontWeight: fontWeight,
      letterSpacing: letterSpacing,
      color: color,
    );
  }

  static TextTheme _baseTextTheme() {
    return disableGoogleFonts
        ? Typography.material2021().black
        : GoogleFonts.plusJakartaSansTextTheme();
  }

  static ThemeData light() {
    const colorScheme = ColorScheme.light(
      primary: DesignTokens.blue400,
      onPrimary: Colors.white,
      primaryContainer: DesignTokens.blue100,
      onPrimaryContainer: DesignTokens.blue700,
      secondary: DesignTokens.lavender400,
      onSecondary: Colors.white,
      secondaryContainer: DesignTokens.lavender100,
      onSecondaryContainer: DesignTokens.lavender600,
      surface: DesignTokens.surface,
      onSurface: DesignTokens.textPrimary,
      error: DesignTokens.error,
      onError: Colors.white,
    );

    // Plus Jakarta Sans — reemplaza Roboto (fuente por defecto de Android)
    // para que la app no se sienta genérica.
    final baseTextTheme = _baseTextTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: DesignTokens.background,
      dividerColor: DesignTokens.divider,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: DesignTokens.textPrimary,
        titleTextStyle: _font(
          fontSize: DesignTokens.fontLG,
          fontWeight: FontWeight.w700,
          color: DesignTokens.textPrimary,
        ),
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: _font(
          fontSize: DesignTokens.fontDisplay,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
          color: DesignTokens.textPrimary,
        ),
        headlineMedium: _font(
          fontSize: DesignTokens.fontXXL,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: DesignTokens.textPrimary,
        ),
        titleLarge: _font(
          fontSize: DesignTokens.fontXL,
          fontWeight: FontWeight.w700,
          color: DesignTokens.textPrimary,
        ),
        bodyLarge: _font(
          fontSize: DesignTokens.fontMD,
          color: DesignTokens.textPrimary,
        ),
        bodyMedium: _font(
          fontSize: DesignTokens.fontSM,
          color: DesignTokens.textSecondary,
        ),
        labelLarge: _font(
          fontSize: DesignTokens.fontMD,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: DesignTokens.blue400,
          foregroundColor: Colors.white,
          elevation: 3,
          shadowColor: DesignTokens.blue400.withValues(alpha: 0.4),
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.spaceLG,
            vertical: DesignTokens.spaceMD,
          ),
          textStyle: _font(
            fontSize: DesignTokens.fontMD,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
          shape: const StadiumBorder(),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: DesignTokens.blue400,
          foregroundColor: Colors.white,
          elevation: 3,
          shadowColor: DesignTokens.blue400.withValues(alpha: 0.4),
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.spaceLG,
            vertical: DesignTokens.spaceMD,
          ),
          textStyle: _font(
            fontSize: DesignTokens.fontMD,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
          shape: const StadiumBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: DesignTokens.blue500,
          side: const BorderSide(color: DesignTokens.blue300),
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.spaceLG,
            vertical: DesignTokens.spaceMD,
          ),
          textStyle: _font(
            fontSize: DesignTokens.fontMD,
            fontWeight: FontWeight.w700,
          ),
          shape: const StadiumBorder(),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: DesignTokens.blue500,
          textStyle: _font(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: DesignTokens.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMD),
          borderSide: const BorderSide(color: DesignTokens.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMD),
          borderSide: const BorderSide(color: DesignTokens.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMD),
          borderSide: const BorderSide(color: DesignTokens.blue400, width: 2),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: DesignTokens.blue50,
        labelStyle: _font(
          color: DesignTokens.textPrimary,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusPill),
        ),
      ),
      cardTheme: CardThemeData(
        color: DesignTokens.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusLG),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: DesignTokens.surface,
        selectedItemColor: DesignTokens.blue400,
        unselectedItemColor: DesignTokens.textDisabled,
      ),
    );
  }
}
