import 'package:flutter/material.dart';

/// Paleta de colores de marca intercambiable.
///
/// Para probar o cambiar a otra identidad visual en el futuro, basta con
/// definir un nuevo preset aquí y asignarlo en [DesignTokens.activePalette]
/// (o editar los valores de [BrandPalette.opcion1Sky]).
class BrandPalette {
  final String name;
  final String logoAsset;

  // Escala primaria (Sky / Azul de marca)
  final Color primary50;
  final Color primary100;
  final Color primary200;
  final Color primary300; // Color base del lienzo del logo (heroBackground)
  final Color primary400; // Color primario interactivo (botones, controles activos)
  final Color primary500;
  final Color primary600;
  final Color primary700;

  // Escala secundaria (Acento complementario)
  final Color secondary50;
  final Color secondary100;
  final Color secondary200;
  final Color secondary300;
  final Color secondary400;
  final Color secondary500;
  final Color secondary600;

  // Lienzo Hero (Splash + Login)
  final Color heroBackground;
  final Color onHeroBackground;

  // Neutrales
  final Color surface;
  final Color background;
  final Color textPrimary;
  final Color textSecondary;
  final Color textDisabled;
  final Color divider;

  const BrandPalette({
    required this.name,
    required this.logoAsset,
    required this.primary50,
    required this.primary100,
    required this.primary200,
    required this.primary300,
    required this.primary400,
    required this.primary500,
    required this.primary600,
    required this.primary700,
    required this.secondary50,
    required this.secondary100,
    required this.secondary200,
    required this.secondary300,
    required this.secondary400,
    required this.secondary500,
    required this.secondary600,
    required this.heroBackground,
    required this.onHeroBackground,
    required this.surface,
    required this.background,
    required this.textPrimary,
    required this.textSecondary,
    required this.textDisabled,
    required this.divider,
  });

  /// Paleta activa derivada de `logoOpcion2` vectorizado (`#76C7E8` + `#F4B266`).
  static const BrandPalette celesteSereno = BrandPalette(
    name: 'Opción 2 — Celeste Claro Suave & Ámbar Miel',
    logoAsset: 'assets/images/logo.png',
    primary50: Color(0xFFF2FAFE),
    primary100: Color(0xFFDDF3FC),
    primary200: Color(0xFFA2DFF5),
    primary300: Color(0xFF76C7E8), // Celeste claro suave del logo
    primary400: Color(0xFF76C7E8), // Botones y primario siempre del celeste del logo
    primary500: Color(0xFF5CA3C7),
    primary600: Color(0xFF4A8FB3),
    primary700: Color(0xFF2B607D),
    secondary50: Color(0xFFFEF8F0),
    secondary100: Color(0xFFFDECD6),
    secondary200: Color(0xFFF9D5AA),
    secondary300: Color(0xFFF4B266), // Ámbar miel suave
    secondary400: Color(0xFFF4B266), // Acento secundario
    secondary500: Color(0xFFD68D3E),
    secondary600: Color(0xFFA86924),
    heroBackground: Color(0xFF76C7E8),
    onHeroBackground: Color(0xFFFFFFFF),
    surface: Color(0xFFFFFFFF),
    background: Color(0xFFF4FAFD),
    textPrimary: Color(0xFF1B3142),
    textSecondary: Color(0xFF4E687A),
    textDisabled: Color(0xFF96AEB4),
    divider: Color(0xFFD9ECF5),
  );

  /// Paleta anterior derivada de `logoOpcion2.jpg` original (Teal Sky `#7BC1CD` + Ámbar `#EBAF79`).
  static const BrandPalette opcion2Teal = BrandPalette(
    name: 'Opción 2 — Teal & Warm Amber',
    logoAsset: 'assets/images/logo.png',
    primary50: Color(0xFFF2FAFB),
    primary100: Color(0xFFDDF1F4),
    primary200: Color(0xFFBCE2E8),
    primary300: Color(0xFF7BC1CD), // Color exacto del cielo de logoOpcion2
    primary400: Color(0xFF3E9CAC), // Primario interactivo con contraste
    primary500: Color(0xFF287F8F),
    primary600: Color(0xFF1C6270),
    primary700: Color(0xFF134550),
    secondary50: Color(0xFFFEF7F1),
    secondary100: Color(0xFFFCEBDA),
    secondary200: Color(0xFFF6D3B5),
    secondary300: Color(0xFFEBAF79), // Ámbar exacto de la silueta central
    secondary400: Color(0xFFD98A48), // Acento secundario interactivo
    secondary500: Color(0xFFB86B2B),
    secondary600: Color(0xFF8F501D),
    heroBackground: Color(0xFF7BC1CD),
    onHeroBackground: Color(0xFFFFFFFF),
    surface: Color(0xFFFFFFFF),
    background: Color(0xFFF4FAFB),
    textPrimary: Color(0xFF1A3238),
    textSecondary: Color(0xFF4F6970),
    textDisabled: Color(0xFF96AEB4),
    divider: Color(0xFFD9ECEF),
  );

  /// Paleta anterior derivada de `logoOpcion1.png` (Sky Cyan `#89DDF5` + blanco).
  static const BrandPalette opcion1Sky = BrandPalette(
    name: 'Opción 1 — Sky Cyan',
    logoAsset: 'assets/images/logo.png',
    primary50: Color(0xFFF2FBFE),
    primary100: Color(0xFFDFF6FD),
    primary200: Color(0xFFB8ECFA),
    primary300: Color(0xFF89DDF5), // Color exacto del fondo de logoOpcion1
    primary400: Color(0xFF38BEE9), // Primario interactivo con contraste
    primary500: Color(0xFF1BA3D1),
    primary600: Color(0xFF127FA6),
    primary700: Color(0xFF0C5975),
    secondary50: Color(0xFFF5F3FF),
    secondary100: Color(0xFFE9E4FF),
    secondary200: Color(0xFFD4CAFF),
    secondary300: Color(0xFFB7A7F7),
    secondary400: Color(0xFF9681F2),
    secondary500: Color(0xFF7A63DF),
    secondary600: Color(0xFF5E47C4),
    heroBackground: Color(0xFF89DDF5),
    onHeroBackground: Color(0xFFFFFFFF),
    surface: Color(0xFFFFFFFF),
    background: Color(0xFFF5FCFF),
    textPrimary: Color(0xFF1E3545),
    textSecondary: Color(0xFF526A7A),
    textDisabled: Color(0xFF9AB0BF),
    divider: Color(0xFFDCEEF6),
  );

  /// Paleta histórica anterior (azul pastel + lavanda).
  static const BrandPalette classicPastel = BrandPalette(
    name: 'Classic Pastel',
    logoAsset: 'assets/images/logo.png',
    primary50: Color(0xFFF3F8FC),
    primary100: Color(0xFFE3EFF9),
    primary200: Color(0xFFC7DFF3),
    primary300: Color(0xFFA3CBEA),
    primary400: Color(0xFF7EB8D4),
    primary500: Color(0xFF5FA0C4),
    primary600: Color(0xFF4685A8),
    primary700: Color(0xFF335F79),
    secondary50: Color(0xFFF7F3FC),
    secondary100: Color(0xFFEBE1F7),
    secondary200: Color(0xFFD8C7EF),
    secondary300: Color(0xFFC0A8E3),
    secondary400: Color(0xFFA98BD4),
    secondary500: Color(0xFF8E6FBA),
    secondary600: Color(0xFF71599B),
    heroBackground: Color(0xFFF3F8FC),
    onHeroBackground: Color(0xFF2C3E50),
    surface: Color(0xFFFFFFFF),
    background: Color(0xFFF6FAFD),
    textPrimary: Color(0xFF2C3E50),
    textSecondary: Color(0xFF5C6B7A),
    textDisabled: Color(0xFFA0ACB8),
    divider: Color(0xFFE1E9F0),
  );
}

/// Design tokens de IAM — única fuente de verdad para colores, logo,
/// espaciado, radios y tipografía.
///
/// Cambiar la paleta o el logo de toda la app = cambiar [activePalette]
/// o editar el preset activo en [BrandPalette].
class DesignTokens {
  DesignTokens._();

  /// Paleta activa de la aplicación.
  static const BrandPalette activePalette = BrandPalette.celesteSereno;

  // ── Assets de marca (PNG fallback + 3 capas SVG vectoriales) ──
  static const String logoAsset = 'assets/images/logo.png';
  static const String wordmarkSvgAsset = 'assets/images/iam_wordmark.svg';
  static const String headerWordmarkSvgAsset =
      'assets/images/iam_header_wordmark.svg';
  static const String crowdSvgAsset = 'assets/images/iam_crowd.svg';

  // ── Lienzo Hero (Splash & Login estilo Celeste Claro Suave) ──
  static const Color heroBackground = Color(0xFF76C7E8);
  static const Color onHeroBackground = Color(0xFFFFFFFF);

  // ── Color: Celeste Claro Suave (primario = mismo color que el logo y botones) ──
  static const Color blue50 = Color(0xFFF2FAFE);
  static const Color blue100 = Color(0xFFDDF3FC);
  static const Color blue200 = Color(0xFFA2DFF5);
  static const Color blue300 = Color(0xFF76C7E8); // color exacto del cielo del logo
  static const Color blue400 = Color(0xFF76C7E8); // botones y controles siempre celeste del logo
  static const Color blue500 = Color(0xFF5CA3C7);
  static const Color blue600 = Color(0xFF4A8FB3);
  static const Color blue700 = Color(0xFF2B607D);

  // ── Color: Ámbar Miel Suave (secundario, silueta central #F4B266) ──
  static const Color lavender50 = Color(0xFFFEF8F0);
  static const Color lavender100 = Color(0xFFFDECD6);
  static const Color lavender200 = Color(0xFFF9D5AA);
  static const Color lavender300 = Color(0xFFF4B266);
  static const Color lavender400 = Color(0xFFF4B266); // secondary base
  static const Color lavender500 = Color(0xFFD68D3E);
  static const Color lavender600 = Color(0xFFA86924);

  // ── Neutrales ──
  static const Color surface = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF4FAFD);
  static const Color textPrimary = Color(0xFF1B3142);
  static const Color textSecondary = Color(0xFF4E687A);
  static const Color textDisabled = Color(0xFF96AEB4);
  static const Color divider = Color(0xFFD9ECF5);

  // ── Semánticos ──
  static const Color success = Color(0xFF52B788);
  static const Color warning = Color(0xFFE0A85C);
  static const Color error = Color(0xFFE06D6D);

  // ── Espaciado (múltiplos de 4) ──
  static const double spaceXS = 4;
  static const double spaceSM = 8;
  static const double spaceMD = 16;
  static const double spaceLG = 24;
  static const double spaceXL = 32;
  static const double spaceXXL = 48;

  // ── Radios ──
  static const double radiusSM = 8;
  static const double radiusMD = 16;
  static const double radiusLG = 24;
  static const double radiusPill = 999;

  // ── Tipografía (tamaños base; familia se define en AppTheme) ──
  static const double fontXS = 12;
  static const double fontSM = 14;
  static const double fontMD = 16;
  static const double fontLG = 18;
  static const double fontXL = 22;
  static const double fontXXL = 28;
  static const double fontDisplay = 34;
}
