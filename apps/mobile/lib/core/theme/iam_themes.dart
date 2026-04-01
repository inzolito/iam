import 'package:flutter/material.dart';

/// Temas de IAM según diagnóstico.
/// Referencia completa en docs/ux-themes.md
class IamThemes {
  // TEA — Zen: calma, predecibilidad, sin ruido visual
  static ThemeData tea() => ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFEEF4FB),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF7EB8D4),
          surface: Color(0xFFFFFFFF),
          onSurface: Color(0xFF2C3E50),
        ),
        fontFamily: 'Nunito',
      );

  // TDAH — Dashboard: energía controlada, accesos rápidos
  static ThemeData tdah() => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0F1A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF7C6AF7),
          secondary: Color(0xFFF7A16A),
          surface: Color(0xFF1A1A2E),
          onSurface: Color(0xFFE8E8F0),
        ),
        fontFamily: 'Nunito',
      );

  // AACC — Profundidad: capas, referencias intelectuales
  static ThemeData aacc() => ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8F6F0),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF4A7C59),
          secondary: Color(0xFFC9A84C),
          surface: Color(0xFFFFFFFF),
          onSurface: Color(0xFF1A1A2A),
        ),
        fontFamily: 'Nunito',
      );

  // Dislexia — Claridad: legibilidad máxima
  static ThemeData dislexia() => ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFFFF8E7),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF2E7D6E),
          surface: Color(0xFFFFFDF5),
          onSurface: Color(0xFF2C2C2C),
        ),
        fontFamily: 'OpenDyslexic',
      );

  // Default para usuarios sin diagnóstico seleccionado
  static ThemeData defaultTheme() => tea();
}
