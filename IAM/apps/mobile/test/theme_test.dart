import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/theme/iam_themes.dart';

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('TEA theme es light con color calmado', () {
      final theme = IamThemes.tea();
      expect(theme.brightness, Brightness.light);
      expect(theme.colorScheme.primary, const Color(0xFF7EB8D4));
      expect(theme.scaffoldBackgroundColor, const Color(0xFFEEF4FB));
    });

    test('TDAH theme es dark con energía', () {
      final theme = IamThemes.tdah();
      expect(theme.brightness, Brightness.dark);
      expect(theme.colorScheme.primary, const Color(0xFF7C6AF7));
      expect(theme.colorScheme.secondary, const Color(0xFFF7A16A));
    });

    test('AACC theme es light con profundidad', () {
      final theme = IamThemes.aacc();
      expect(theme.brightness, Brightness.light);
      expect(theme.colorScheme.primary, const Color(0xFF4A7C59));
    });

    test('DISLEXIA theme es light con claridad', () {
      final theme = IamThemes.dislexia();
      expect(theme.brightness, Brightness.light);
      expect(theme.colorScheme.primary, const Color(0xFF2E7D6E));
      expect(theme.scaffoldBackgroundColor, const Color(0xFFFFF8E7));
    });

    test('defaultTheme es TEA', () {
      final defaultT = IamThemes.defaultTheme();
      final tea = IamThemes.tea();
      expect(defaultT.colorScheme.primary, tea.colorScheme.primary);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('todos los temas tienen fontFamily Nunito excepto Dislexia', () {
      expect(IamThemes.tea().textTheme.bodyMedium?.fontFamily, 'Nunito');
      expect(IamThemes.tdah().textTheme.bodyMedium?.fontFamily, 'Nunito');
      expect(IamThemes.aacc().textTheme.bodyMedium?.fontFamily, 'Nunito');
      expect(IamThemes.dislexia().textTheme.bodyMedium?.fontFamily, 'OpenDyslexic');
    });

    test('todos los temas tienen surface y onSurface definidos', () {
      for (final themeGetter in [
        IamThemes.tea,
        IamThemes.tdah,
        IamThemes.aacc,
        IamThemes.dislexia,
      ]) {
        final theme = themeGetter();
        expect(theme.colorScheme.surface, isNotNull);
        expect(theme.colorScheme.onSurface, isNotNull);
      }
    });

    test('TDAH es el único tema dark', () {
      expect(IamThemes.tea().brightness, Brightness.light);
      expect(IamThemes.tdah().brightness, Brightness.dark);
      expect(IamThemes.aacc().brightness, Brightness.light);
      expect(IamThemes.dislexia().brightness, Brightness.light);
    });
  });
}
