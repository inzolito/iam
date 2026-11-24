import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/theme/app_theme.dart';

/// Se ejecuta automáticamente antes de CADA archivo de test en este
/// directorio.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Evita que `AppTheme` (usa GoogleFonts) dispare fetches de red en
  // segundo plano — el sandbox de test no tiene acceso a internet, y esos
  // fetches fallidos "contaminan" tests no relacionados con errores async
  // fuera de tiempo.
  AppTheme.disableGoogleFonts = true;

  // El plugin `geolocator` no tiene implementación de canal en tests;
  // sin este mock, cualquier pantalla que pida ubicación (FeedScreen)
  // se queda esperando para siempre (o lanza MissingPluginException).
  // Simulamos el camino feliz (GPS activo, permiso concedido, posición
  // fija). El nombre del canal difiere por plataforma — en Windows es
  // "flutter.baseflow.com/geolocator" (sin sufijo), en Android
  // "flutter.baseflow.com/geolocator_android" — mockeamos ambos.
  Future<dynamic> geolocatorHandler(MethodCall call) async {
    switch (call.method) {
      case 'isLocationServiceEnabled':
        return true;
      case 'checkPermission':
      case 'requestPermission':
        return 2; // LocationPermission.whileInUse
      case 'getCurrentPosition':
        return {'latitude': -33.4489, 'longitude': -70.6693};
      default:
        return null;
    }
  }

  for (final name in [
    'flutter.baseflow.com/geolocator',
    'flutter.baseflow.com/geolocator_android',
  ]) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(MethodChannel(name), geolocatorHandler);
  }

  await testMain();
}
