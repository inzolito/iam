import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/theme/app_theme.dart';
import 'package:iam_mobile/core/design/design_tokens.dart';

void main() {
  // AppTheme.disableGoogleFonts se activa globalmente en
  // test/flutter_test_config.dart (evita fetches de red en el sandbox).

  group('Happy Path', () {
    test('AppTheme.light() es light con el azul de marca como primario', () {
      final theme = AppTheme.light();
      expect(theme.brightness, Brightness.light);
      expect(theme.colorScheme.primary, DesignTokens.blue400);
      expect(theme.colorScheme.secondary, DesignTokens.lavender400);
      expect(theme.scaffoldBackgroundColor, DesignTokens.background);
      expect(DesignTokens.heroBackground, DesignTokens.activePalette.heroBackground);
      expect(DesignTokens.logoAsset, DesignTokens.activePalette.logoAsset);
    });

    test('botones tienen forma pill (StadiumBorder)', () {
      final theme = AppTheme.light();
      final filledShape = theme.filledButtonTheme.style?.shape?.resolve({});
      expect(filledShape, isA<StadiumBorder>());
    });
  });

  group('Peor Caso', () {
    test('el tema es único y consistente entre llamadas', () {
      final t1 = AppTheme.light();
      final t2 = AppTheme.light();
      expect(t1.colorScheme.primary, t2.colorScheme.primary);
      expect(t1.scaffoldBackgroundColor, t2.scaffoldBackgroundColor);
    });

    test('surface y onSurface están definidos', () {
      final theme = AppTheme.light();
      expect(theme.colorScheme.surface, isNotNull);
      expect(theme.colorScheme.onSurface, DesignTokens.textPrimary);
    });

    test('useMaterial3 está activado', () {
      expect(AppTheme.light().useMaterial3, true);
    });
  });
}
