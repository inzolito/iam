import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/venues/venues_provider.dart';

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

Map<String, dynamic> _makeVenue(String id, {String? name, double? distance}) => {
      'id': id,
      'name': name ?? 'Venue $id',
      'category': 'cafe',
      'address': 'Calle $id',
      'sensoryRating': 3.5,
      'averageRating': 4.0,
      'reviewCount': 10,
      'distance': distance ?? 500.0,
      'imageUrl': null,
      'isFavorite': false,
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = VenuesProvider(api: MockApiService());

      expect(provider.venues, isEmpty);
      expect(provider.favorites, isEmpty);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadNearby carga venues', () async {
      final api = MockApiService(
        onGet: (path) => {
              'venues': [_makeVenue('v1'), _makeVenue('v2')],
            },
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 40.0, lng: -3.0);

      expect(provider.venues.length, 2);
      expect(provider.venues[0].name, 'Venue v1');
      expect(provider.isLoading, false);
    });

    test('loadNearby con filtros', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path) {
          capturedPath = path;
          return {'venues': []};
        },
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 40.0, lng: -3.0, radius: 1000, category: 'cafe');

      expect(capturedPath, contains('lat=40.0'));
      expect(capturedPath, contains('lng=-3.0'));
      expect(capturedPath, contains('radius=1000'));
      expect(capturedPath, contains('category=cafe'));
    });

    test('loadFavorites carga favoritos', () async {
      final api = MockApiService(
        onGet: (path) => {
              'venues': [_makeVenue('fav1', name: 'Mi café')],
            },
      );
      final provider = VenuesProvider(api: api);

      await provider.loadFavorites();

      expect(provider.favorites.length, 1);
      expect(provider.favorites[0].name, 'Mi café');
    });

    test('toggleFavorite retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
      );
      final provider = VenuesProvider(api: api);

      final result = await provider.toggleFavorite('v1');

      expect(result, true);
    });

    test('checkIn retorna true', () async {
      final api = MockApiService(
        onPost: (path, {body}) => {'success': true},
      );
      final provider = VenuesProvider(api: api);

      final result = await provider.checkIn('v1', lat: 40.0, lng: -3.0);

      expect(result, true);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 0, lng: 0);
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadNearby con ApiException', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 403, message: 'Forbidden'),
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 0, lng: 0);

      expect(provider.error, 'Forbidden');
      expect(provider.venues, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadNearby con excepción genérica', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Network error'),
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 0, lng: 0);

      expect(provider.error, contains('Network error'));
      expect(provider.isLoading, false);
    });

    test('toggleFavorite con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = VenuesProvider(api: api);

      final result = await provider.toggleFavorite('v1');

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('checkIn con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Fail'),
      );
      final provider = VenuesProvider(api: api);

      final result = await provider.checkIn('v1', lat: 0, lng: 0);

      expect(result, false);
      expect(provider.error, isNotNull);
    });

    test('loadFavorites silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Fail'),
      );
      final provider = VenuesProvider(api: api);

      await provider.loadFavorites();

      expect(provider.favorites, isEmpty);
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('venues vacíos', () async {
      final api = MockApiService(
        onGet: (path) => {'venues': []},
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 0, lng: 0);

      expect(provider.venues, isEmpty);
    });

    test('respuesta sin campo venues', () async {
      final api = MockApiService(
        onGet: (path) => {'other': 'data'},
      );
      final provider = VenuesProvider(api: api);

      await provider.loadNearby(lat: 0, lng: 0);

      expect(provider.venues, isEmpty);
    });

    test('VenueSummary.formattedDistance metros', () {
      final v = VenueSummary.fromJson(_makeVenue('v1', distance: 750));
      expect(v.formattedDistance, '750 m');
    });

    test('VenueSummary.formattedDistance kilómetros', () {
      final v = VenueSummary.fromJson(_makeVenue('v1', distance: 2500));
      expect(v.formattedDistance, '2.5 km');
    });

    test('VenueSummary.formattedDistance null', () {
      final v = VenueSummary.fromJson({
        'id': 'v1',
        'name': 'Test',
      });
      expect(v.formattedDistance, '');
    });

    test('venue con campos mínimos', () {
      final v = VenueSummary.fromJson({
        'id': 'min',
        'name': 'Minimal',
      });
      expect(v.id, 'min');
      expect(v.category, isNull);
      expect(v.distance, isNull);
      expect(v.reviewCount, 0);
      expect(v.isFavorite, false);
    });
  });
}
