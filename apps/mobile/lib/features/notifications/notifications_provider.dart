import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';

/// Notificación del usuario.
class AppNotification {
  final String id;
  final String type;
  final String title;
  final String? body;
  final String? actionUrl;
  final bool isRead;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    this.body,
    this.actionUrl,
    this.isRead = false,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      type: json['type'] as String? ?? 'general',
      title: json['title'] as String? ?? '',
      body: json['body'] as String?,
      actionUrl: json['actionUrl'] as String? ?? json['action_url'] as String?,
      isRead: json['isRead'] as bool? ?? json['is_read'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  String get typeLabel {
    switch (type) {
      case 'match':
        return 'Match';
      case 'message':
        return 'Mensaje';
      case 'meetup':
        return 'Meetup';
      case 'esencias':
        return 'Esencias';
      case 'system':
        return 'Sistema';
      default:
        return 'General';
    }
  }
}

/// Provider de Notificaciones.
class NotificationsProvider extends ChangeNotifier {
  final ApiService _api;

  List<AppNotification> _notifications = [];
  List<AppNotification> get notifications => _notifications;

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  NotificationsProvider({required ApiService api}) : _api = api;

  Future<void> loadNotifications({int limit = 50, int offset = 0}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response =
          await _api.get('/notifications?limit=$limit&offset=$offset');
      final list = response['notifications'] as List<dynamic>? ?? [];
      _notifications = list
          .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
          .toList();
      _unreadCount = _notifications.where((n) => !n.isRead).length;
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadUnreadCount() async {
    try {
      final response = await _api.get('/notifications/unread-count');
      _unreadCount = response['count'] as int? ?? 0;
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> markAsRead(String notificationId) async {
    try {
      await _api.post('/notifications/$notificationId/read');
      final idx =
          _notifications.indexWhere((n) => n.id == notificationId);
      if (idx != -1 && !_notifications[idx].isRead) {
        _notifications[idx] = AppNotification(
          id: _notifications[idx].id,
          type: _notifications[idx].type,
          title: _notifications[idx].title,
          body: _notifications[idx].body,
          actionUrl: _notifications[idx].actionUrl,
          isRead: true,
          createdAt: _notifications[idx].createdAt,
        );
        _unreadCount = _notifications.where((n) => !n.isRead).length;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> markAllAsRead() async {
    try {
      await _api.post('/notifications/read-all');
      _notifications = _notifications
          .map((n) => AppNotification(
                id: n.id,
                type: n.type,
                title: n.title,
                body: n.body,
                actionUrl: n.actionUrl,
                isRead: true,
                createdAt: n.createdAt,
              ))
          .toList();
      _unreadCount = 0;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
