import 'package:geolocator/geolocator.dart';

import 'api_service.dart';

/// Resultado de sincronizar la ubicación con el backend.
enum LocationSyncResult {
  ok,
  serviceDisabled, // GPS apagado a nivel de sistema
  permissionDenied, // Usuario rechazó el permiso
  permissionDeniedForever, // Bloqueado permanentemente (hay que ir a Ajustes)
  error, // Falla obteniendo posición o enviando al backend
}

/// Obtiene la ubicación del dispositivo y la sincroniza con el backend.
class LocationService {
  final ApiService _api;

  LocationService({required ApiService api}) : _api = api;

  /// Pide permiso (si hace falta), obtiene el GPS y hace
  /// PATCH /users/me/location. Devuelve el resultado para que la UI
  /// pueda mostrar el mensaje adecuado.
  Future<LocationSyncResult> syncLocation() async {
    // 1. ¿El GPS del sistema está activo?
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationSyncResult.serviceDisabled;
    }

    // 2. Permiso de la app
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      return LocationSyncResult.permissionDenied;
    }
    if (permission == LocationPermission.deniedForever) {
      return LocationSyncResult.permissionDeniedForever;
    }

    // 3. Obtener posición (última conocida instantánea o GPS medio con timeout)
    try {
      var pos = await Geolocator.getLastKnownPosition();
      pos ??= await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );

      await _api.patch('/users/me/location', body: {
        'lat': pos.latitude,
        'lng': pos.longitude,
      });

      return LocationSyncResult.ok;
    } catch (_) {
      return LocationSyncResult.error;
    }
  }

  /// Abre los ajustes de la app (para el caso deniedForever).
  Future<void> openSettings() => Geolocator.openAppSettings();
}
