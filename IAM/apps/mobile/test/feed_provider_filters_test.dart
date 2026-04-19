import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/feed/feed_filters.dart';
import 'package:iam_mobile/features/feed/feed_provider.dart';

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})? onPost;

  MockApiService({this.onGet, this.onPost}) : super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (onGet != null) return onGet!(path);
    return {'profiles': []};
  }

  @override
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    if (onPost != null) return onPost!(path, body: body);
    return {};
  }
}

Map<String, dynamic> _profile(String id) => {
      'id': id,
      'display_name': 'User $id',
      'spin': <String>[],
      'matchScore': 0.9,
      'distance': 1000.0,
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('loadFeed sin filtros envía solo page=0', () async {
      String? lastPath;
      final api = MockApiService(onGet: (path) {
        lastPath = path;
        return {'profiles': [_profile('u1')]};
      });
      final provider = FeedProvider(api: api);

      await provider.loadFeed();

      expect(lastPath, '/feed?page=0');
      expect(provider.profiles.length, 1);
    });

    test('loadFeed con filtros aplica query params', () async {
      String? lastPath;
      final api = MockApiService(onGet: (path) {
        lastPath = path;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);

      await provider.applyFilters(const FeedFilters(
        diagnoses: {'TEA'},
        minAge: 25,
        maxAge: 40,
        radiusMeters: 20000,
        sort: FeedSort.distance,
      ));

      expect(lastPath, startsWith('/feed?'));
      expect(lastPath, contains('diagnoses=TEA'));
      expect(lastPath, contains('minAge=25'));
      expect(lastPath, contains('maxAge=40'));
      expect(lastPath, contains('radius=20000'));
      expect(lastPath, contains('sort=distance'));
      expect(lastPath, contains('page=0'));
    });

    test('applyFilters actualiza filters e invoca loadFeed', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);

      final result = await provider.applyFilters(
          const FeedFilters(diagnoses: {'TDAH'}));

      expect(result, true);
      expect(provider.filters.diagnoses, {'TDAH'});
      expect(getCount, 1);
    });

    test('applyFilters con mismos filtros no recarga', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);
      await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));
      final countAfterFirst = getCount;

      final result = await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));

      expect(result, true);
      expect(getCount, countAfterFirst); // no hubo segundo GET
    });

    test('clearFilters resetea a none y recarga', () async {
      var getCount = 0;
      String? lastPath;
      final api = MockApiService(onGet: (p) {
        getCount++;
        lastPath = p;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);
      await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));
      getCount = 0;

      await provider.clearFilters();

      expect(provider.filters.hasActiveFilters, false);
      expect(getCount, 1);
      expect(lastPath, '/feed?page=0');
    });

    test('clearFilters sin filtros activos no recarga', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);

      await provider.clearFilters();

      expect(getCount, 0); // no-op
    });

    test('loadMore preserva filtros en paginación', () async {
      final paths = <String>[];
      final api = MockApiService(onGet: (p) {
        paths.add(p);
        // devolver 20 para permitir loadMore
        return {
          'profiles': List.generate(20, (i) => _profile('u$i')),
        };
      });
      final provider = FeedProvider(api: api);
      await provider.applyFilters(const FeedFilters(diagnoses: {'AACC'}));

      await provider.loadMore();

      expect(paths.length, 2);
      expect(paths[1], contains('diagnoses=AACC'));
      expect(paths[1], contains('page=1'));
    });

    test('applyFilters con radius explícito legacy sigue funcionando', () async {
      String? path;
      final api = MockApiService(onGet: (p) {
        path = p;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);
      await provider.applyFilters(const FeedFilters(radiusMeters: 10000));

      await provider.loadFeed(radius: 5000);

      // el radius explícito sobrescribe al del filtro
      expect(path, contains('radius=5000'));
    });

    test('setFiltersLocal actualiza sin recargar', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);

      provider.setFiltersLocal(const FeedFilters(minAge: 30));

      expect(provider.filters.minAge, 30);
      expect(getCount, 0); // no recargó
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('applyFilters con filtros inválidos devuelve false', () async {
      final api = MockApiService();
      final provider = FeedProvider(api: api);

      final result = await provider.applyFilters(
          const FeedFilters(minAge: 50, maxAge: 20)); // inválido

      expect(result, false);
      expect(provider.error, contains('inválidos'));
      // no se aplicaron
      expect(provider.filters, FeedFilters.none);
    });

    test('applyFilters con edad < 13 rechaza', () async {
      final provider = FeedProvider(api: MockApiService());

      final result = await provider.applyFilters(
          const FeedFilters(minAge: 10));

      expect(result, false);
      expect(provider.filters, FeedFilters.none);
    });

    test('applyFilters con radius negativo rechaza', () async {
      final provider = FeedProvider(api: MockApiService());

      final result = await provider.applyFilters(
          const FeedFilters(radiusMeters: -50));

      expect(result, false);
    });

    test('applyFilters con error de backend captura el mensaje', () async {
      final api = MockApiService(
        onGet: (_) => throw ApiException(statusCode: 500, message: 'boom'),
      );
      final provider = FeedProvider(api: api);

      final result = await provider.applyFilters(
          const FeedFilters(diagnoses: {'TEA'}));

      // applyFilters devolvió true pero internamente loadFeed falló
      expect(result, true);
      expect(provider.error, 'boom');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('loadFeed con todos los filtros activos', () async {
      String? path;
      final api = MockApiService(onGet: (p) {
        path = p;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);

      await provider.applyFilters(const FeedFilters(
        diagnoses: {'TEA', 'TDAH'},
        minAge: 18,
        maxAge: 40,
        radiusMeters: 25000,
        tagIds: {'t1', 't2'},
        minEnergyLevel: 2,
        includeTeens: false,
        sort: FeedSort.recent,
      ));

      expect(path, startsWith('/feed?'));
      expect(path, contains('minAge=18'));
      expect(path, contains('maxAge=40'));
      expect(path, contains('radius=25000'));
      expect(path, contains('minEnergy=2'));
      expect(path, contains('includeTeens=false'));
      expect(path, contains('sort=recent'));
      expect(path, contains('page=0'));
    });

    test('cambiar filtros resetea página a 0 (currentIndex y _page)', () async {
      final api = MockApiService(onGet: (_) {
        return {
          'profiles': List.generate(20, (i) => _profile('u$i')),
        };
      });
      final provider = FeedProvider(api: api);
      await provider.loadFeed();
      await provider.loadMore(); // page = 1

      await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));

      // después de applyFilters, currentIndex debe ser 0
      expect(provider.currentIndex, 0);
    });

    test('estado inicial: filters es FeedFilters.none', () {
      final provider = FeedProvider(api: MockApiService());

      expect(provider.filters, FeedFilters.none);
      expect(provider.filters.hasActiveFilters, false);
    });

    test('applyFilters con filtros equivalentes via copyWith no recarga', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        return {'profiles': []};
      });
      final provider = FeedProvider(api: api);
      await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));
      getCount = 0;

      // construir un filtro equivalente via copyWith
      final sameViaCopy = const FeedFilters(diagnoses: {'TEA'}).copyWith();
      final result = await provider.applyFilters(sameViaCopy);

      expect(result, true);
      expect(getCount, 0); // no recargó porque == es true
    });

    test('clearFilters después de error limpia filtros aun si el GET falla', () async {
      final api = MockApiService(
        onGet: (_) => throw Exception('network'),
      );
      final provider = FeedProvider(api: api);
      // aplicamos unos filtros (aunque falle el GET los guarda)
      await provider.applyFilters(const FeedFilters(diagnoses: {'TEA'}));

      await provider.clearFilters();

      expect(provider.filters.hasActiveFilters, false);
    });

    test('loadMore con hasMore=false no dispara nada', () async {
      var getCount = 0;
      final api = MockApiService(onGet: (_) {
        getCount++;
        // devolver pocos para que hasMore quede false
        return {'profiles': [_profile('u1')]};
      });
      final provider = FeedProvider(api: api);
      await provider.loadFeed();
      final after = getCount;

      await provider.loadMore();

      expect(getCount, after);
      expect(provider.hasMore, false);
    });
  });
}
