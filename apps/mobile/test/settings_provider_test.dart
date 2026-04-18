import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/settings/settings_provider.dart';

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? _onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPost;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPatch;
  final Map<String, dynamic> Function(String path)? _onDelete;

  MockApiService({
    Map<String, dynamic> Function(String path)? onGet,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})? onPost,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})? onPatch,
    Map<String, dynamic> Function(String path)? onDelete,
  })  : _onGet = onGet,
        _onPost = onPost,
        _onPatch = onPatch,
        _onDelete = onDelete,
        super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (_onGet != null) return _onGet!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    if (_onPost != null) return _onPost!(path, body: body);
    return {};
  }

  @override
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    if (_onPatch != null) return _onPatch!(path, body: body);
    return {};
  }

  @override
  Future<Map<String, dynamic>> delete(String path) async {
    if (_onDelete != null) return _onDelete!(path);
    return {};
  }
}

Map<String, dynamic> _makeBlock(String id, String userId) => {
      'id': id,
      'user_id': userId,
      'display_name': 'User $userId',
      'photo_url': 'https://example.com/$userId.jpg',
      'created_at': '2026-01-01T00:00:00Z',
    };

Map<String, dynamic> _makeReport(String id, {String status = 'pending'}) => {
      'id': id,
      'target_user_id': 'user-x',
      'reason': 'Spam',
      'status': status,
      'created_at': '2026-01-01T00:00:00Z',
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial: todo vacío y preferencias por defecto', () {
      final provider = SettingsProvider(api: MockApiService());

      expect(provider.blocks, isEmpty);
      expect(provider.reports, isEmpty);
      expect(provider.preferences.pushEnabled, true);
      expect(provider.preferences.emailEnabled, true);
      expect(provider.preferences.showInFeed, true);
      expect(provider.preferences.shareLocation, true);
      expect(provider.preferences.language, 'es');
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadBlocks carga lista de bloqueados', () async {
      final api = MockApiService(onGet: (path) {
        expect(path, '/blocks');
        return {
          'blocks': [_makeBlock('b1', 'u1'), _makeBlock('b2', 'u2')],
        };
      });
      final provider = SettingsProvider(api: api);

      await provider.loadBlocks();

      expect(provider.blocks.length, 2);
      expect(provider.blocks[0].userId, 'u1');
      expect(provider.blocks[0].displayName, 'User u1');
      expect(provider.isLoading, false);
    });

    test('unblockUser elimina del local state', () async {
      final api = MockApiService(
        onGet: (_) => {
          'blocks': [_makeBlock('b1', 'u1'), _makeBlock('b2', 'u2')],
        },
        onDelete: (path) {
          expect(path, '/blocks/u1');
          return {};
        },
      );
      final provider = SettingsProvider(api: api);
      await provider.loadBlocks();

      final result = await provider.unblockUser('u1');

      expect(result, true);
      expect(provider.blocks.length, 1);
      expect(provider.blocks[0].userId, 'u2');
    });

    test('loadReports carga reportes del usuario', () async {
      final api = MockApiService(onGet: (path) {
        expect(path, '/reports/mine');
        return {
          'reports': [_makeReport('r1'), _makeReport('r2', status: 'resolved')],
        };
      });
      final provider = SettingsProvider(api: api);

      await provider.loadReports();

      expect(provider.reports.length, 2);
      expect(provider.reports[0].status, 'pending');
      expect(provider.reports[1].status, 'resolved');
    });

    test('loadPreferences carga preferencias del servidor', () async {
      final api = MockApiService(onGet: (_) => {
            'pushEnabled': false,
            'emailEnabled': true,
            'showInFeed': false,
            'shareLocation': true,
            'language': 'en',
          });
      final provider = SettingsProvider(api: api);

      await provider.loadPreferences();

      expect(provider.preferences.pushEnabled, false);
      expect(provider.preferences.showInFeed, false);
      expect(provider.preferences.language, 'en');
    });

    test('togglePush invierte la preferencia y envía patch', () async {
      Map<String, dynamic>? sentBody;
      final api = MockApiService(onPatch: (path, {body}) {
        expect(path, '/users/me/preferences');
        sentBody = body;
        return {};
      });
      final provider = SettingsProvider(api: api);

      final result = await provider.togglePush();

      expect(result, true);
      expect(provider.preferences.pushEnabled, false);
      expect(sentBody?['pushEnabled'], false);
    });

    test('toggleEmail invierte la preferencia', () async {
      final api = MockApiService(onPatch: (_, {body}) => {});
      final provider = SettingsProvider(api: api);

      await provider.toggleEmail();

      expect(provider.preferences.emailEnabled, false);
    });

    test('toggleShowInFeed invierte la preferencia', () async {
      final api = MockApiService(onPatch: (_, {body}) => {});
      final provider = SettingsProvider(api: api);

      await provider.toggleShowInFeed();

      expect(provider.preferences.showInFeed, false);
    });

    test('toggleShareLocation invierte la preferencia', () async {
      final api = MockApiService(onPatch: (_, {body}) => {});
      final provider = SettingsProvider(api: api);

      await provider.toggleShareLocation();

      expect(provider.preferences.shareLocation, false);
    });

    test('requestAccountDeletion envía POST correcto', () async {
      String? capturedPath;
      final api = MockApiService(onPost: (path, {body}) {
        capturedPath = path;
        return {};
      });
      final provider = SettingsProvider(api: api);

      final result = await provider.requestAccountDeletion();

      expect(result, true);
      expect(capturedPath, '/users/me/delete-request');
    });

    test('clearError limpia el mensaje', () async {
      final api = MockApiService(onGet: (_) => throw Exception('fail'));
      final provider = SettingsProvider(api: api);
      await provider.loadBlocks();
      expect(provider.error, isNotNull);

      provider.clearError();

      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadBlocks captura ApiException y guarda mensaje', () async {
      final api = MockApiService(onGet: (_) => throw ApiException(
            statusCode: 500,
            message: 'Server error',
          ));
      final provider = SettingsProvider(api: api);

      await provider.loadBlocks();

      expect(provider.error, 'Server error');
      expect(provider.blocks, isEmpty);
      expect(provider.isLoading, false);
    });

    test('loadBlocks captura excepción genérica', () async {
      final api = MockApiService(onGet: (_) => throw Exception('network down'));
      final provider = SettingsProvider(api: api);

      await provider.loadBlocks();

      expect(provider.error, contains('network down'));
      expect(provider.isLoading, false);
    });

    test('unblockUser devuelve false en ApiException', () async {
      final api = MockApiService(
        onDelete: (_) => throw ApiException(statusCode: 404, message: 'not found'),
      );
      final provider = SettingsProvider(api: api);

      final result = await provider.unblockUser('u-missing');

      expect(result, false);
      expect(provider.error, 'not found');
    });

    test('unblockUser devuelve false en excepción genérica', () async {
      final api = MockApiService(onDelete: (_) => throw Exception('boom'));
      final provider = SettingsProvider(api: api);

      final result = await provider.unblockUser('u1');

      expect(result, false);
      expect(provider.error, contains('boom'));
    });

    test('updatePreferences hace rollback en error', () async {
      final api = MockApiService(
        onPatch: (_, {body}) =>
            throw ApiException(statusCode: 400, message: 'bad prefs'),
      );
      final provider = SettingsProvider(api: api);
      final original = provider.preferences;

      final result = await provider.togglePush();

      expect(result, false);
      expect(provider.error, 'bad prefs');
      // rollback: debería volver al estado original
      expect(provider.preferences.pushEnabled, original.pushEnabled);
    });

    test('updatePreferences rollback en excepción genérica', () async {
      final api = MockApiService(onPatch: (_, {body}) => throw Exception('xx'));
      final provider = SettingsProvider(api: api);

      final result = await provider.togglePush();

      expect(result, false);
      expect(provider.preferences.pushEnabled, true); // rollback exitoso
    });

    test('requestAccountDeletion devuelve false en error', () async {
      final api = MockApiService(
        onPost: (_, {body}) =>
            throw ApiException(statusCode: 403, message: 'forbidden'),
      );
      final provider = SettingsProvider(api: api);

      final result = await provider.requestAccountDeletion();

      expect(result, false);
      expect(provider.error, 'forbidden');
    });

    test('loadReports falla silenciosamente en excepción genérica', () async {
      final api = MockApiService(onGet: (_) => throw Exception('xx'));
      final provider = SettingsProvider(api: api);

      await provider.loadReports();

      expect(provider.reports, isEmpty);
      // sin error porque es silencioso
    });

    test('loadReports setea error en ApiException', () async {
      final api = MockApiService(
        onGet: (_) => throw ApiException(statusCode: 500, message: 'oops'),
      );
      final provider = SettingsProvider(api: api);

      await provider.loadReports();

      expect(provider.error, 'oops');
    });

    test('loadPreferences mantiene defaults si falla', () async {
      final api = MockApiService(onGet: (_) => throw Exception('down'));
      final provider = SettingsProvider(api: api);

      await provider.loadPreferences();

      // defaults intactos
      expect(provider.preferences.pushEnabled, true);
      expect(provider.preferences.language, 'es');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('loadBlocks con response sin campo blocks', () async {
      final api = MockApiService(onGet: (_) => {});
      final provider = SettingsProvider(api: api);

      await provider.loadBlocks();

      expect(provider.blocks, isEmpty);
    });

    test('loadBlocks con lista vacía explícita', () async {
      final api = MockApiService(onGet: (_) => {'blocks': []});
      final provider = SettingsProvider(api: api);

      await provider.loadBlocks();

      expect(provider.blocks, isEmpty);
    });

    test('unblockUser de usuario que no está en la lista local', () async {
      final api = MockApiService(onDelete: (_) => {});
      final provider = SettingsProvider(api: api);

      final result = await provider.unblockUser('u-unknown');

      expect(result, true);
      expect(provider.blocks, isEmpty);
    });

    test('BlockedUser.fromJson con campos mínimos usa defaults', () {
      final block = BlockedUser.fromJson({});

      expect(block.id, '');
      expect(block.userId, '');
      expect(block.displayName, 'Usuario');
      expect(block.photoUrl, isNull);
    });

    test('BlockedUser.fromJson acepta snake_case y camelCase', () {
      final snakeCase = BlockedUser.fromJson({
        'id': '1',
        'user_id': 'u1',
        'display_name': 'Alice',
        'photo_url': 'x.jpg',
      });
      final camelCase = BlockedUser.fromJson({
        'id': '2',
        'userId': 'u2',
        'displayName': 'Bob',
        'photoUrl': 'y.jpg',
      });

      expect(snakeCase.userId, 'u1');
      expect(camelCase.userId, 'u2');
    });

    test('UserReport.fromJson con status inexistente usa pending', () {
      final report = UserReport.fromJson({'id': 'r1'});

      expect(report.status, 'pending');
      expect(report.reason, '');
    });

    test('UserPreferences.copyWith preserva valores no especificados', () {
      const original = UserPreferences(pushEnabled: false, language: 'en');

      final copy = original.copyWith(emailEnabled: false);

      expect(copy.pushEnabled, false); // preservado
      expect(copy.language, 'en'); // preservado
      expect(copy.emailEnabled, false); // cambiado
    });

    test('múltiples toggles consecutivos actualizan correctamente', () async {
      final api = MockApiService(onPatch: (_, {body}) => {});
      final provider = SettingsProvider(api: api);

      await provider.togglePush(); // true → false
      await provider.togglePush(); // false → true
      await provider.togglePush(); // true → false

      expect(provider.preferences.pushEnabled, false);
    });

    test('unblock después de rebuild del provider mantiene consistencia', () async {
      final deleted = <String>[];
      final api = MockApiService(
        onGet: (_) => {
          'blocks': [_makeBlock('b1', 'u1'), _makeBlock('b2', 'u2')],
        },
        onDelete: (path) {
          deleted.add(path);
          return {};
        },
      );
      final provider = SettingsProvider(api: api);
      await provider.loadBlocks();

      await provider.unblockUser('u1');
      await provider.unblockUser('u2');

      expect(deleted, ['/blocks/u1', '/blocks/u2']);
      expect(provider.blocks, isEmpty);
    });

    test('loadReports con lista vacía', () async {
      final api = MockApiService(onGet: (_) => {'reports': []});
      final provider = SettingsProvider(api: api);

      await provider.loadReports();

      expect(provider.reports, isEmpty);
    });
  });
}
