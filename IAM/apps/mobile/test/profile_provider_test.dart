import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/profile/profile_provider.dart';
import 'package:iam_mobile/features/profile/profile_models.dart';

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? _onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPatch;

  MockApiService({
    Map<String, dynamic> Function(String path)? onGet,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
        onPatch,
  })  : _onGet = onGet,
        _onPatch = onPatch,
        super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (_onGet != null) return _onGet!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> patch(String path,
      {Map<String, dynamic>? body}) async {
    if (_onPatch != null) return _onPatch!(path, body: body);
    return {};
  }
}

Map<String, dynamic> _makeProfile({
  String id = 'u1',
  String? displayName = 'Ana',
  String? username = 'ana_test',
  String? msnStatus = 'Explorando',
  int energyLevel = 2,
}) {
  return {
    'id': id,
    'email': 'ana@test.com',
    'username': username,
    'display_name': displayName,
    'birth_date': '2000-05-15',
    'is_teen': false,
    'avatar_url': null,
    'msn_status': msnStatus,
    'energy_level': energyLevel,
    'notif_level': 2,
    'is_active': true,
    'onboarding_completed': true,
    'created_at': '2026-01-01T00:00:00Z',
  };
}

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = ProfileProvider(api: MockApiService());

      expect(provider.profile, isNull);
      expect(provider.diagnoses, isEmpty);
      expect(provider.isLoading, false);
      expect(provider.isSaving, false);
      expect(provider.error, isNull);
    });

    test('loadProfile carga perfil del backend', () async {
      final api = MockApiService(
        onGet: (path) => _makeProfile(),
      );
      final provider = ProfileProvider(api: api);

      await provider.loadProfile();

      expect(provider.profile, isNotNull);
      expect(provider.profile!.displayName, 'Ana');
      expect(provider.profile!.username, 'ana_test');
      expect(provider.profile!.energyLevel, 2);
    });

    test('loadDiagnoses carga diagnósticos', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/diagnoses')) {
            return {
              'diagnoses': [
                {'diagnosis': 'TEA', 'is_primary': true},
                {'diagnosis': 'TDAH', 'is_primary': false},
              ]
            };
          }
          return _makeProfile();
        },
      );
      final provider = ProfileProvider(api: api);

      await provider.loadDiagnoses();

      expect(provider.diagnoses.length, 2);
      expect(provider.primaryDiagnosis, 'TEA');
    });

    test('updateProfile actualiza y devuelve nuevo perfil', () async {
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onGet: (path) => _makeProfile(),
        onPatch: (path, {body}) {
          capturedBody = body;
          return _makeProfile(displayName: 'Ana Updated', msnStatus: 'Nuevo');
        },
      );
      final provider = ProfileProvider(api: api);
      await provider.loadProfile();

      final result = await provider.updateProfile(
        displayName: 'Ana Updated',
        msnStatus: 'Nuevo',
      );

      expect(result, true);
      expect(capturedBody!['displayName'], 'Ana Updated');
      expect(capturedBody!['msnStatus'], 'Nuevo');
      expect(provider.profile!.displayName, 'Ana Updated');
    });

    test('updateProfile con username', () async {
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onPatch: (path, {body}) {
          capturedBody = body;
          return _makeProfile(username: 'new_name');
        },
      );
      final provider = ProfileProvider(api: api);

      await provider.updateProfile(username: 'new_name');

      expect(capturedBody!['username'], 'new_name');
      expect(provider.profile!.username, 'new_name');
    });

    test('updateProfile con energyLevel', () async {
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onPatch: (path, {body}) {
          capturedBody = body;
          return _makeProfile(energyLevel: 3);
        },
      );
      final provider = ProfileProvider(api: api);

      await provider.updateProfile(energyLevel: 3);

      expect(capturedBody!['energyLevel'], 3);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = ProfileProvider(api: api);

      await provider.loadProfile();
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadProfile con error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 401, message: 'Unauthorized'),
      );
      final provider = ProfileProvider(api: api);

      await provider.loadProfile();

      expect(provider.error, 'Unauthorized');
      expect(provider.profile, isNull);
      expect(provider.isLoading, false);
    });

    test('updateProfile con error de validación', () async {
      final api = MockApiService(
        onPatch: (path, {body}) => throw ApiException(
            statusCode: 400, message: 'USERNAME_TAKEN'),
      );
      final provider = ProfileProvider(api: api);

      final result = await provider.updateProfile(username: 'taken');

      expect(result, false);
      expect(provider.error, 'USERNAME_TAKEN');
      expect(provider.isSaving, false);
    });

    test('updateProfile sin campos retorna false', () async {
      final provider = ProfileProvider(api: MockApiService());

      final result = await provider.updateProfile();

      expect(result, false);
    });

    test('loadDiagnoses silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => throw Exception('Network'),
      );
      final provider = ProfileProvider(api: api);

      await provider.loadDiagnoses();

      expect(provider.diagnoses, isEmpty);
      expect(provider.error, isNull); // Error silenciado
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('perfil con campos mínimos', () async {
      final api = MockApiService(
        onGet: (path) => {
              'id': 'u1',
              'created_at': '2026-01-01T00:00:00Z',
            },
      );
      final provider = ProfileProvider(api: api);

      await provider.loadProfile();

      expect(provider.profile!.id, 'u1');
      expect(provider.profile!.displayName, isNull);
      expect(provider.profile!.username, isNull);
      expect(provider.profile!.energyLevel, 1);
    });

    test('diagnósticos vacíos', () async {
      final api = MockApiService(
        onGet: (path) => {'diagnoses': []},
      );
      final provider = ProfileProvider(api: api);

      await provider.loadDiagnoses();

      expect(provider.diagnoses, isEmpty);
      expect(provider.primaryDiagnosis, isNull);
    });

    test('primaryDiagnosis sin primary flag', () async {
      final api = MockApiService(
        onGet: (path) => {
              'diagnoses': [
                {'diagnosis': 'TEA', 'is_primary': false},
              ]
            },
      );
      final provider = ProfileProvider(api: api);

      await provider.loadDiagnoses();

      expect(provider.primaryDiagnosis, isNull);
    });
  });

  // ============================================================
  // MODELOS
  // ============================================================

  group('ProfileModels', () {
    test('UserProfile.fromJson completo', () {
      final p = UserProfile.fromJson(_makeProfile());
      expect(p.id, 'u1');
      expect(p.email, 'ana@test.com');
      expect(p.displayName, 'Ana');
      expect(p.username, 'ana_test');
      expect(p.birthDate, '2000-05-15');
      expect(p.isTeen, false);
      expect(p.msnStatus, 'Explorando');
      expect(p.energyLevel, 2);
      expect(p.onboardingCompleted, true);
    });

    test('UserProfile.fromJson campos mínimos', () {
      final p = UserProfile.fromJson({
        'id': 'min',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(p.id, 'min');
      expect(p.email, '');
      expect(p.displayName, isNull);
      expect(p.energyLevel, 1);
      expect(p.isActive, true);
    });

    test('UserProfile.initials con displayName', () {
      final p = UserProfile.fromJson(_makeProfile(displayName: 'Bea'));
      expect(p.initials, 'B');
    });

    test('UserProfile.initials con username (sin displayName)', () {
      final p =
          UserProfile.fromJson(_makeProfile(displayName: null, username: 'zoe'));
      expect(p.initials, 'Z');
    });

    test('UserProfile.initials sin nombre', () {
      final p = UserProfile.fromJson(
          _makeProfile(displayName: null, username: null));
      expect(p.initials, '?');
    });

    test('UserDiagnosis.fromJson', () {
      final d = UserDiagnosis.fromJson(
          {'diagnosis': 'AACC', 'is_primary': true});
      expect(d.diagnosis, 'AACC');
      expect(d.isPrimary, true);
    });

    test('UserDiagnosis.fromJson isPrimary default false', () {
      final d = UserDiagnosis.fromJson({'diagnosis': 'TDAH'});
      expect(d.isPrimary, false);
    });
  });
}
