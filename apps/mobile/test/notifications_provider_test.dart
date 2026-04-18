import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/notifications/notifications_provider.dart';

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? _onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPost;

  MockApiService({
    Map<String, dynamic> Function(String path)? onGet,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
        onPost,
  })  : _onGet = onGet,
        _onPost = onPost,
        super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (_onGet != null) return _onGet!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body}) async {
    if (_onPost != null) return _onPost!(path, body: body);
    return {};
  }
}

Map<String, dynamic> _makeNotif(String id,
        {String type = 'match', bool isRead = false}) =>
    {
      'id': id,
      'type': type,
      'title': 'Notif $id',
      'body': 'Cuerpo de la notif',
      'actionUrl': '/feed',
      'isRead': isRead,
      'created_at': '2026-01-01T00:00:00Z',
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = NotificationsProvider(api: MockApiService());

      expect(provider.notifications, isEmpty);
      expect(provider.unreadCount, 0);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadNotifications carga notificaciones', () async {
      final api = MockApiService(
        onGet: (path) => {
              'notifications': [
                _makeNotif('n1'),
                _makeNotif('n2', isRead: true),
              ],
            },
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.notifications.length, 2);
      expect(provider.unreadCount, 1);
      expect(provider.isLoading, false);
    });

    test('loadNotifications con paginación', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path) {
          capturedPath = path;
          return {'notifications': []};
        },
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications(limit: 20, offset: 10);

      expect(capturedPath, contains('limit=20'));
      expect(capturedPath, contains('offset=10'));
    });

    test('loadUnreadCount actualiza contador', () async {
      final api = MockApiService(
        onGet: (path) => {'count': 5},
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadUnreadCount();

      expect(provider.unreadCount, 5);
    });

    test('markAsRead marca notificación como leída', () async {
      final api = MockApiService(
        onGet: (path) => {
              'notifications': [_makeNotif('n1'), _makeNotif('n2')],
            },
        onPost: (path, {body}) => {'success': true},
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();
      expect(provider.unreadCount, 2);

      final result = await provider.markAsRead('n1');

      expect(result, true);
      expect(provider.notifications[0].isRead, true);
      expect(provider.unreadCount, 1);
    });

    test('markAllAsRead marca todas como leídas', () async {
      final api = MockApiService(
        onGet: (path) => {
              'notifications': [_makeNotif('n1'), _makeNotif('n2')],
            },
        onPost: (path, {body}) => {'success': true},
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();
      expect(provider.unreadCount, 2);

      final result = await provider.markAllAsRead();

      expect(result, true);
      expect(provider.unreadCount, 0);
      expect(provider.notifications.every((n) => n.isRead), true);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadNotifications con ApiException', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 401, message: 'Unauthorized'),
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.error, 'Unauthorized');
      expect(provider.notifications, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadNotifications con excepción genérica', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Network'),
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.error, contains('Network'));
    });

    test('markAsRead con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = NotificationsProvider(api: api);

      final result = await provider.markAsRead('n1');

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('markAllAsRead con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = NotificationsProvider(api: api);

      final result = await provider.markAllAsRead();

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('loadUnreadCount silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Fail'),
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadUnreadCount();

      expect(provider.unreadCount, 0);
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('notificaciones vacías', () async {
      final api = MockApiService(
        onGet: (path) => {'notifications': []},
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.notifications, isEmpty);
      expect(provider.unreadCount, 0);
    });

    test('respuesta sin campo notifications', () async {
      final api = MockApiService(
        onGet: (path) => {'other': 'data'},
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.notifications, isEmpty);
    });

    test('markAsRead id inexistente no rompe', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
      );
      final provider = NotificationsProvider(api: api);

      final result = await provider.markAsRead('no-existe');

      expect(result, true);
      expect(provider.unreadCount, 0);
    });

    test('AppNotification.typeLabel para cada tipo', () {
      expect(AppNotification.fromJson(_makeNotif('n1', type: 'match')).typeLabel, 'Match');
      expect(AppNotification.fromJson(_makeNotif('n2', type: 'message')).typeLabel, 'Mensaje');
      expect(AppNotification.fromJson(_makeNotif('n3', type: 'meetup')).typeLabel, 'Meetup');
      expect(AppNotification.fromJson(_makeNotif('n4', type: 'esencias')).typeLabel, 'Esencias');
      expect(AppNotification.fromJson(_makeNotif('n5', type: 'system')).typeLabel, 'Sistema');
      expect(AppNotification.fromJson(_makeNotif('n6', type: 'unknown')).typeLabel, 'General');
    });

    test('notificación con campos mínimos', () {
      final n = AppNotification.fromJson({
        'id': 'min',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(n.id, 'min');
      expect(n.type, 'general');
      expect(n.title, '');
      expect(n.body, isNull);
      expect(n.isRead, false);
    });

    test('notificación con snake_case', () {
      final n = AppNotification.fromJson({
        'id': 'sc',
        'type': 'match',
        'title': 'Test',
        'action_url': '/profile',
        'is_read': true,
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(n.actionUrl, '/profile');
      expect(n.isRead, true);
    });

    test('todas leídas → unreadCount es 0', () async {
      final api = MockApiService(
        onGet: (path) => {
              'notifications': [
                _makeNotif('n1', isRead: true),
                _makeNotif('n2', isRead: true),
              ],
            },
      );
      final provider = NotificationsProvider(api: api);

      await provider.loadNotifications();

      expect(provider.unreadCount, 0);
    });
  });
}
