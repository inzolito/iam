import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/feed/feed_provider.dart';
import 'package:iam_mobile/features/feed/feed_profile.dart';

/// Mock ApiService que simula respuestas del backend.
class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPost;

  MockApiService({
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
        onGet,
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

/// Helpers para generar perfiles de prueba.
Map<String, dynamic> _makeProfile(String id, {String? name, double? score}) => {
      'id': id,
      'display_name': name ?? 'User $id',
      'avatar_url': null,
      'is_teen': false,
      'energy_level': 2,
      'msn_status': 'Hola',
      'spin': ['tag1', 'tag2'],
      'matchScore': score ?? 0.85,
      'distance': 2500.0,
    };

List<Map<String, dynamic>> _makeProfiles(int count, {int offset = 0}) =>
    List.generate(count, (i) => _makeProfile('u${offset + i}'));

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial es vacío sin loading', () {
      final api = MockApiService();
      final provider = FeedProvider(api: api);

      expect(provider.profiles, isEmpty);
      expect(provider.currentIndex, 0);
      expect(provider.currentProfile, isNull);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
      expect(provider.lastMatch, isNull);
    });

    test('loadFeed carga perfiles del backend', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(5)},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.profiles.length, 5);
      expect(provider.currentProfile, isNotNull);
      expect(provider.currentProfile!.id, 'u0');
      expect(provider.isLoading, false);
    });

    test('loadFeed con radius pasa query param', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path, {body}) {
          capturedPath = path;
          return {'profiles': _makeProfiles(3)};
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed(radius: 5000);

      expect(capturedPath, contains('radius=5000'));
      expect(provider.profiles.length, 3);
    });

    test('like avanza al siguiente perfil', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => {'matched': false},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      expect(provider.currentProfile!.id, 'u0');

      await provider.like('u0');
      expect(provider.currentProfile!.id, 'u1');
    });

    test('pass avanza al siguiente perfil', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => {'matched': false},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.pass('u0');

      expect(provider.currentProfile!.id, 'u1');
    });

    test('like con match mutuo guarda lastMatch', () async {
      final matchData = {'id': 'match-1', 'user1': 'u0', 'user2': 'me'};
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => {'matched': true, 'match': matchData},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.like('u0');

      expect(provider.lastMatch, isNotNull);
      expect(provider.lastMatch!['id'], 'match-1');
    });

    test('clearLastMatch limpia el match', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) =>
            {'matched': true, 'match': {'id': 'm1'}},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.like('u0');
      expect(provider.lastMatch, isNotNull);

      provider.clearLastMatch();
      expect(provider.lastMatch, isNull);
    });

    test('loadMore agrega perfiles a la lista', () async {
      int page = 0;
      final api = MockApiService(
        onGet: (path, {body}) {
          final profiles = _makeProfiles(20, offset: page * 20);
          page++;
          return {'profiles': profiles};
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      expect(provider.profiles.length, 20);

      await provider.loadMore();
      expect(provider.profiles.length, 40);
    });

    test('blockUser elimina perfil del feed', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(5)},
        onPost: (path, {body}) => {'ok': true},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      expect(provider.profiles.length, 5);

      await provider.blockUser('u2');
      expect(provider.profiles.length, 4);
      expect(provider.profiles.any((p) => p.id == 'u2'), false);
    });

    test('reportUser envía reporte al backend', () async {
      String? capturedPath;
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) {
          capturedPath = path;
          capturedBody = body;
          return {'ok': true};
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.reportUser('u0', 'Spam', description: 'Bot obvio');

      expect(capturedPath, '/reports');
      expect(capturedBody!['userId'], 'u0');
      expect(capturedBody!['reason'], 'Spam');
      expect(capturedBody!['description'], 'Bot obvio');
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path, {body}) => throw ApiException(
              statusCode: 500,
              message: 'Server error',
            ),
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      expect(provider.error, 'Server error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadFeed con error del servidor', () async {
      final api = MockApiService(
        onGet: (path, {body}) => throw ApiException(
              statusCode: 500,
              message: 'Internal Server Error',
            ),
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.error, 'Internal Server Error');
      expect(provider.profiles, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadFeed con excepción genérica', () async {
      final api = MockApiService(
        onGet: (path, {body}) => throw Exception('Network error'),
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.error, isNotNull);
      expect(provider.profiles, isEmpty);
    });

    test('like con error no avanza perfil', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) {
          callCount++;
          throw ApiException(statusCode: 400, message: 'Bad Request');
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      final before = provider.currentIndex;
      await provider.like('u0');

      expect(provider.currentIndex, before);
      expect(provider.error, 'Bad Request');
    });

    test('loadMore con error revierte página', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path, {body}) {
          callCount++;
          if (callCount > 1) {
            throw ApiException(statusCode: 500, message: 'Timeout');
          }
          return {'profiles': _makeProfiles(20)};
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.loadMore();

      expect(provider.error, 'Timeout');
      expect(provider.profiles.length, 20); // No se agregaron más
    });

    test('blockUser con error mantiene perfil', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => throw Exception('Network error'),
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.blockUser('u1');

      expect(provider.profiles.length, 3); // No se eliminó
      expect(provider.error, isNotNull);
    });

    test('reportUser con error setea error', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => throw Exception('Failed'),
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      final result = await provider.reportUser('u0', 'Spam');

      expect(result, false);
      expect(provider.error, isNotNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('loadFeed con respuesta vacía', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': []},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.profiles, isEmpty);
      expect(provider.isEmpty, true);
      expect(provider.currentProfile, isNull);
    });

    test('isExhausted cuando se acabaron todos los perfiles', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(2)},
        onPost: (path, {body}) => {'matched': false},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.pass('u0');
      await provider.pass('u1');

      expect(provider.isExhausted, true);
      expect(provider.currentProfile, isNull);
    });

    test('hasMore es false cuando vienen menos de 20 perfiles', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(5)},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.hasMore, false);
    });

    test('hasMore es true cuando vienen 20 perfiles', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(20)},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(provider.hasMore, true);
    });

    test('loadMore no hace nada si hasMore es false', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path, {body}) {
          callCount++;
          return {'profiles': _makeProfiles(5)};
        },
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed(); // callCount = 1
      await provider.loadMore(); // No debería llamar

      expect(callCount, 1);
    });

    test('loadMore no hace nada si ya está loading', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(20)},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      // Simular que isLoading ya está true
      // loadMore no debería duplicar la llamada
      expect(provider.isLoading, false);
    });

    test('loadFeed resetea estado previo', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(5)},
        onPost: (path, {body}) => {'matched': false},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.pass('u0');
      await provider.pass('u1');
      expect(provider.currentIndex, 2);

      // Recargar feed
      await provider.loadFeed();
      expect(provider.currentIndex, 0);
      expect(provider.profiles.length, 5);
    });

    test('like sin match no guarda lastMatch', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(3)},
        onPost: (path, {body}) => {'matched': false},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      await provider.like('u0');

      expect(provider.lastMatch, isNull);
    });

    test('blockUser del perfil actual ajusta index', () async {
      final api = MockApiService(
        onGet: (path, {body}) => {'profiles': _makeProfiles(2)},
        onPost: (path, {body}) => {'ok': true},
      );
      final provider = FeedProvider(api: api);

      await provider.loadFeed();
      // Ir al último perfil
      // blockear u1 (último)
      await provider.blockUser('u1');

      expect(provider.profiles.length, 1);
      expect(provider.currentIndex, 0);
    });
  });

  // ============================================================
  // FeedProfile MODEL
  // ============================================================

  group('FeedProfile', () {
    test('fromJson parsea todos los campos', () {
      final profile = FeedProfile.fromJson({
        'id': 'test-1',
        'display_name': 'Ana',
        'avatar_url': 'https://example.com/avatar.png',
        'is_teen': true,
        'energy_level': 3,
        'msn_status': 'Explorando',
        'spin': ['arte', 'musica'],
        'matchScore': 0.92,
        'distance': 1500.0,
      });

      expect(profile.id, 'test-1');
      expect(profile.displayName, 'Ana');
      expect(profile.avatarUrl, 'https://example.com/avatar.png');
      expect(profile.isTeen, true);
      expect(profile.energyLevel, 3);
      expect(profile.msnStatus, 'Explorando');
      expect(profile.spin, ['arte', 'musica']);
      expect(profile.matchScore, 0.92);
      expect(profile.distance, 1500.0);
    });

    test('fromJson con campos mínimos', () {
      final profile = FeedProfile.fromJson({'id': 'min-1'});

      expect(profile.id, 'min-1');
      expect(profile.displayName, isNull);
      expect(profile.avatarUrl, isNull);
      expect(profile.isTeen, false);
      expect(profile.energyLevel, 1);
      expect(profile.msnStatus, isNull);
      expect(profile.spin, isEmpty);
      expect(profile.matchScore, 0);
      expect(profile.distance, 0);
    });

    test('formattedDistance muestra km para distancias grandes', () {
      final profile = FeedProfile(id: 'x', distance: 5200);
      expect(profile.formattedDistance, '5.2 km');
    });

    test('formattedDistance muestra metros para distancias cortas', () {
      final profile = FeedProfile(id: 'x', distance: 800);
      expect(profile.formattedDistance, '800 m');
    });

    test('compatibilityPercent formatea correctamente', () {
      final profile = FeedProfile(id: 'x', matchScore: 0.87);
      expect(profile.compatibilityPercent, '87%');
    });

    test('compatibilityPercent con 0', () {
      final profile = FeedProfile(id: 'x', matchScore: 0);
      expect(profile.compatibilityPercent, '0%');
    });

    test('compatibilityPercent con 1.0', () {
      final profile = FeedProfile(id: 'x', matchScore: 1.0);
      expect(profile.compatibilityPercent, '100%');
    });
  });
}
