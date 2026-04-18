import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/body_doubling/body_doubling_provider.dart';

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

Map<String, dynamic> _makeSession(String id,
        {String? title, String status = 'waiting', int current = 1}) =>
    {
      'id': id,
      'hostId': 'host1',
      'hostName': 'Host User',
      'title': title ?? 'Session $id',
      'activityType': 'study',
      'durationMinutes': 25,
      'description': 'Focus time',
      'maxParticipants': 5,
      'currentParticipants': current,
      'status': status,
      'isPublic': true,
      'created_at': '2026-01-01T00:00:00Z',
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = BodyDoublingProvider(api: MockApiService());

      expect(provider.sessions, isEmpty);
      expect(provider.mySessions, isEmpty);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadSessions carga sesiones', () async {
      final api = MockApiService(
        onGet: (path) => {
              'sessions': [_makeSession('s1'), _makeSession('s2')],
            },
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();

      expect(provider.sessions.length, 2);
      expect(provider.sessions[0].title, 'Session s1');
      expect(provider.isLoading, false);
    });

    test('loadSessions con filtro de actividad', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path) {
          capturedPath = path;
          return {'sessions': []};
        },
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions(activity: 'study');

      expect(capturedPath, contains('activity=study'));
    });

    test('loadMySessions carga mis sesiones', () async {
      final api = MockApiService(
        onGet: (path) => {
              'sessions': [_makeSession('ms1', title: 'Mi sesión')],
            },
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadMySessions();

      expect(provider.mySessions.length, 1);
      expect(provider.mySessions[0].title, 'Mi sesión');
    });

    test('createSession retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'id': 'new1'},
        onGet: (path) => {'sessions': []},
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.createSession(
        title: 'Nueva',
        activityType: 'study',
        durationMinutes: 25,
      );

      expect(result, true);
    });

    test('joinSession retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
        onGet: (path) => {'sessions': []},
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.joinSession('s1');

      expect(result, true);
    });

    test('leaveSession retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
        onGet: (path) => {'sessions': []},
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.leaveSession('s1');

      expect(result, true);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadSessions con ApiException', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 401, message: 'Unauthorized'),
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();

      expect(provider.error, 'Unauthorized');
      expect(provider.sessions, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadSessions con excepción genérica', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Network'),
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();

      expect(provider.error, contains('Network'));
      expect(provider.isLoading, false);
    });

    test('createSession con error ApiException', () async {
      final api = MockApiService(
        onPost: (path, {body}) =>
            throw ApiException(statusCode: 400, message: 'INVALID_DURATION'),
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.createSession(
        title: 'Bad',
        activityType: 'study',
        durationMinutes: -1,
      );

      expect(result, false);
      expect(provider.error, 'INVALID_DURATION');
    });

    test('joinSession con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) =>
            throw ApiException(statusCode: 409, message: 'SESSION_FULL'),
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.joinSession('s1');

      expect(result, false);
      expect(provider.error, 'SESSION_FULL');
    });

    test('leaveSession con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = BodyDoublingProvider(api: api);

      final result = await provider.leaveSession('s1');

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('loadMySessions silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Fail'),
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadMySessions();

      expect(provider.mySessions, isEmpty);
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('sesiones vacías', () async {
      final api = MockApiService(
        onGet: (path) => {'sessions': []},
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();

      expect(provider.sessions, isEmpty);
    });

    test('respuesta sin campo sessions', () async {
      final api = MockApiService(
        onGet: (path) => {'other': 'data'},
      );
      final provider = BodyDoublingProvider(api: api);

      await provider.loadSessions();

      expect(provider.sessions, isEmpty);
    });

    test('BdSession.isFull', () {
      final s = BdSession.fromJson(_makeSession('s1', current: 5));
      expect(s.isFull, true);
    });

    test('BdSession.isActive', () {
      final s = BdSession.fromJson(_makeSession('s1', status: 'active'));
      expect(s.isActive, true);
      expect(s.isWaiting, false);
    });

    test('BdSession.isWaiting', () {
      final s = BdSession.fromJson(_makeSession('s1', status: 'waiting'));
      expect(s.isWaiting, true);
      expect(s.isActive, false);
    });

    test('sesión con campos mínimos', () {
      final s = BdSession.fromJson({
        'id': 'min',
        'title': 'Minimal',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(s.id, 'min');
      expect(s.hostId, '');
      expect(s.activityType, '');
      expect(s.durationMinutes, 25);
      expect(s.maxParticipants, 5);
      expect(s.currentParticipants, 0);
      expect(s.status, 'waiting');
      expect(s.isPublic, true);
    });
  });
}
