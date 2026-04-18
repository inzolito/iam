import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/meetups/meetups_provider.dart';

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

Map<String, dynamic> _makeMeetup(String id,
        {String status = 'pending', bool aConfirmed = false, bool bConfirmed = false}) =>
    {
      'id': id,
      'matchId': 'match1',
      'status': status,
      'userAConfirmed': aConfirmed,
      'userBConfirmed': bConfirmed,
      'expiresAt': '2026-12-31T23:59:59Z',
      'created_at': '2026-01-01T00:00:00Z',
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = MeetupsProvider(api: MockApiService());

      expect(provider.meetups, isEmpty);
      expect(provider.pending, isEmpty);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadMeetups carga meetups', () async {
      final api = MockApiService(
        onGet: (path) => {
              'meetups': [_makeMeetup('m1'), _makeMeetup('m2')],
            },
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();

      expect(provider.meetups.length, 2);
      expect(provider.meetups[0].id, 'm1');
      expect(provider.isLoading, false);
    });

    test('loadMeetups con filtro de status', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path) {
          capturedPath = path;
          return {'meetups': []};
        },
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups(status: 'confirmed');

      expect(capturedPath, contains('status=confirmed'));
    });

    test('loadPending carga pendientes', () async {
      final api = MockApiService(
        onGet: (path) => {
              'meetups': [_makeMeetup('p1')],
            },
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadPending();

      expect(provider.pending.length, 1);
    });

    test('initiateMeetup retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'id': 'new1'},
        onGet: (path) => {'meetups': []},
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.initiateMeetup('match1');

      expect(result, true);
    });

    test('initiateMeetup con coordenadas', () async {
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onPost: (path, {body}) {
          capturedBody = body;
          return {'id': 'new1'};
        },
        onGet: (path) => {'meetups': []},
      );
      final provider = MeetupsProvider(api: api);

      await provider.initiateMeetup('match1', lat: 40.0, lng: -3.0);

      expect(capturedBody!['matchId'], 'match1');
      expect(capturedBody!['lat'], 40.0);
      expect(capturedBody!['lng'], -3.0);
    });

    test('confirmMeetup retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
        onGet: (path) => {'meetups': []},
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.confirmMeetup('m1');

      expect(result, true);
    });

    test('disputeMeetup retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
        onGet: (path) => {'meetups': []},
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.disputeMeetup('m1');

      expect(result, true);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadMeetups con ApiException', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 401, message: 'Unauthorized'),
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();

      expect(provider.error, 'Unauthorized');
      expect(provider.meetups, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadMeetups con excepción genérica', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Network'),
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();

      expect(provider.error, contains('Network'));
    });

    test('initiateMeetup con ApiException', () async {
      final api = MockApiService(
        onPost: (path, {body}) =>
            throw ApiException(statusCode: 409, message: 'MEETUP_EXISTS'),
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.initiateMeetup('match1');

      expect(result, false);
      expect(provider.error, 'MEETUP_EXISTS');
    });

    test('confirmMeetup con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) =>
            throw ApiException(statusCode: 400, message: 'EXPIRED'),
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.confirmMeetup('m1');

      expect(result, false);
      expect(provider.error, 'EXPIRED');
    });

    test('disputeMeetup con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = MeetupsProvider(api: api);

      final result = await provider.disputeMeetup('m1');

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('loadPending silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Fail'),
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadPending();

      expect(provider.pending, isEmpty);
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('meetups vacíos', () async {
      final api = MockApiService(
        onGet: (path) => {'meetups': []},
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();

      expect(provider.meetups, isEmpty);
    });

    test('respuesta sin campo meetups', () async {
      final api = MockApiService(
        onGet: (path) => {'other': 'data'},
      );
      final provider = MeetupsProvider(api: api);

      await provider.loadMeetups();

      expect(provider.meetups, isEmpty);
    });

    test('Meetup.isPending', () {
      final m = Meetup.fromJson(_makeMeetup('m1', status: 'pending'));
      expect(m.isPending, true);
      expect(m.isConfirmed, false);
    });

    test('Meetup.isConfirmed', () {
      final m = Meetup.fromJson(_makeMeetup('m1', status: 'confirmed'));
      expect(m.isConfirmed, true);
      expect(m.isPending, false);
    });

    test('Meetup.isExpired con fecha pasada', () {
      final m = Meetup.fromJson({
        'id': 'exp',
        'matchId': 'match1',
        'status': 'pending',
        'expiresAt': '2020-01-01T00:00:00Z',
        'created_at': '2020-01-01T00:00:00Z',
      });
      expect(m.isExpired, true);
    });

    test('Meetup.isExpired sin fecha', () {
      final m = Meetup.fromJson({
        'id': 'noexp',
        'matchId': 'match1',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(m.expiresAt, isNull);
      expect(m.isExpired, false);
    });

    test('meetup con campos mínimos (snake_case)', () {
      final m = Meetup.fromJson({
        'id': 'min',
        'match_id': 'match_min',
        'user_a_confirmed': true,
        'user_b_confirmed': false,
        'expires_at': '2026-12-31T23:59:59Z',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(m.matchId, 'match_min');
      expect(m.userAConfirmed, true);
      expect(m.userBConfirmed, false);
      expect(m.status, 'pending');
    });

    test('meetup con confirmación de ambos usuarios', () {
      final m = Meetup.fromJson(
          _makeMeetup('m1', status: 'confirmed', aConfirmed: true, bConfirmed: true));
      expect(m.userAConfirmed, true);
      expect(m.userBConfirmed, true);
      expect(m.isConfirmed, true);
    });
  });
}
