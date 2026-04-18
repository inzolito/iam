import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_service.dart';
import 'storage_service.dart';

/// Handler de mensajes en background (top-level, fuera de clase).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Mensaje en background: ${message.messageId}');
}

/// Servicio de push notifications — FCM + APNs.
///
/// Flujo:
/// 1. Inicializar Firebase + permisos
/// 2. Obtener token FCM
/// 3. Registrar token en backend (POST /notifications/devices)
/// 4. Escuchar mensajes foreground → mostrar notificación local
/// 5. Renovar token automáticamente cuando cambia
class PushNotificationService {
  final ApiService _api;
  final StorageService _storage;

  static final _localNotifications = FlutterLocalNotificationsPlugin();
  static const _channelId = 'iam_default';
  static const _channelName = 'IAM Notificaciones';

  PushNotificationService({
    required ApiService api,
    required StorageService storage,
  })  : _api = api,
        _storage = storage;

  Future<void> initialize() async {
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Permisos
    await _requestPermissions();

    // Canal Android
    await _setupLocalNotifications();

    // Token inicial
    await _registerToken();

    // Renovación de token
    FirebaseMessaging.instance.onTokenRefresh.listen(_onTokenRefresh);

    // Mensajes en foreground
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    debugPrint('[FCM] Push notification service inicializado');
  }

  Future<void> _requestPermissions() async {
    if (Platform.isIOS) {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
    } else if (Platform.isAndroid) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
  }

  Future<void> _setupLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _localNotifications.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );

    // Canal de alta importancia para Android
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);
  }

  Future<void> _registerToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      await _sendTokenToBackend(token);
      debugPrint('[FCM] Token registrado: ${token.substring(0, 20)}...');
    } catch (e) {
      debugPrint('[FCM] Error registrando token: $e');
    }
  }

  Future<void> _onTokenRefresh(String newToken) async {
    debugPrint('[FCM] Token renovado');
    await _sendTokenToBackend(newToken);
  }

  Future<void> _sendTokenToBackend(String token) async {
    try {
      await _api.post('/notifications/devices', body: {
        'token': token,
        'platform': Platform.isIOS ? 'apns' : 'fcm',
      });
    } catch (e) {
      debugPrint('[FCM] No se pudo registrar token en backend: $e');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );

    debugPrint('[FCM] Mensaje foreground: ${notification.title}');
  }

  /// Llama al cerrar sesión para limpiar el token del backend.
  Future<void> unregisterToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      await _api.post('/notifications/devices', body: {
        'token': token,
        'platform': Platform.isIOS ? 'apns' : 'fcm',
        'active': false,
      });

      await FirebaseMessaging.instance.deleteToken();
      debugPrint('[FCM] Token eliminado');
    } catch (e) {
      debugPrint('[FCM] Error eliminando token: $e');
    }
  }
}
