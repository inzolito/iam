import 'package:flutter/material.dart';

/// Design tokens de IAM — única fuente de verdad para colores, espaciado,
/// radios y tipografía. Derivados del logo (azul pastel + acento lavanda).
///
/// Cambiar la marca = editar este archivo. Nada más debería tener
/// colores o medidas hardcodeadas.
class DesignTokens {
  DesignTokens._();

  // ── Color: Azul (primario, del logo) ──
  static const Color blue50 = Color(0xFFF3F8FC);
  static const Color blue100 = Color(0xFFE3EFF9);
  static const Color blue200 = Color(0xFFC7DFF3);
  static const Color blue300 = Color(0xFFA3CBEA);
  static const Color blue400 = Color(0xFF7EB8D4); // primary base
  static const Color blue500 = Color(0xFF5FA0C4);
  static const Color blue600 = Color(0xFF4685A8);
  static const Color blue700 = Color(0xFF335F79);

  // ── Color: Lavanda (secundario, acento) ──
  static const Color lavender50 = Color(0xFFF7F3FC);
  static const Color lavender100 = Color(0xFFEBE1F7);
  static const Color lavender200 = Color(0xFFD8C7EF);
  static const Color lavender300 = Color(0xFFC0A8E3);
  static const Color lavender400 = Color(0xFFA98BD4); // secondary base
  static const Color lavender500 = Color(0xFF8E6FBA);
  static const Color lavender600 = Color(0xFF71599B);

  // ── Neutrales ──
  static const Color surface = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF6FAFD);
  static const Color textPrimary = Color(0xFF2C3E50);
  static const Color textSecondary = Color(0xFF5C6B7A);
  static const Color textDisabled = Color(0xFFA0ACB8);
  static const Color divider = Color(0xFFE1E9F0);

  // ── Semánticos ──
  static const Color success = Color(0xFF6FBF8B);
  static const Color warning = Color(0xFFE0A85C);
  static const Color error = Color(0xFFE07A7A);

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
