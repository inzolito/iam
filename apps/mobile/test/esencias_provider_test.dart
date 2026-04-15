import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/esencias/esencias_provider.dart';
import 'package:iam_mobile/features/esencias/esencias_models.dart';

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

Map<String, dynamic> _makeTransaction(String id,
    {String type = 'grant', String reason = 'login_bonus', int amount = 10}) {
  return {
    'id': id,
    'fromUserId': type == 'grant' ? null : 'other-user',
    'toUserId': 'me',
    'amount': amount,
    'reason': reason,
    'message': null,
    'type': type,
    'createdAt': '2026-01-01T12:00:00Z',
  };
}

Map<String, dynamic> _makeUnlockRule(String id,
    {String diagnosis = 'TEA', int cost = 50}) {
  return {
    'id': id,
    'diagnosis': diagnosis,
    'featureKey': 'feature_$id',
    'featureName': 'Feature $id',
    'description': 'Desc $id',
    'requiredEsencias': cost,
    'category': 'theme',
    'uiSettings': {},
  };
}

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider = EsenciasProvider(api: MockApiService());

      expect(provider.balance.balance, 0);
      expect(provider.transactions, isEmpty);
      expect(provider.unlockRules, isEmpty);
      expect(provider.userUnlocks, isEmpty);
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
    });

    test('loadBalance carga balance del backend', () async {
      final api = MockApiService(
        onGet: (path) =>
            {'balance': 150, 'totalEarned': 200, 'totalSpent': 50},
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadBalance();

      expect(provider.balance.balance, 150);
      expect(provider.balance.totalEarned, 200);
      expect(provider.balance.totalSpent, 50);
    });

    test('loadTransactions carga historial', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/transactions')) {
            return {
              'transactions': [
                _makeTransaction('t1'),
                _makeTransaction('t2', type: 'deduction',
                    reason: 'unlock_deduction'),
              ],
              'total': 2,
            };
          }
          return {};
        },
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadTransactions();

      expect(provider.transactions.length, 2);
      expect(provider.transactionsTotal, 2);
    });

    test('transfer envía esencias', () async {
      String? capturedPath;
      Map<String, dynamic>? capturedBody;
      final api = MockApiService(
        onGet: (path) =>
            {'balance': 100, 'totalEarned': 100, 'totalSpent': 0},
        onPost: (path, {body}) {
          capturedPath = path;
          capturedBody = body;
          return {'newBalance': 75, 'transaction': {'id': 'tx-1'}};
        },
      );
      final provider = EsenciasProvider(api: api);
      await provider.loadBalance();

      final result = await provider.transfer(
          toUserId: 'u2', amount: 25, message: 'Regalo');

      expect(result, true);
      expect(capturedPath, '/esencias/transfer');
      expect(capturedBody!['toUserId'], 'u2');
      expect(capturedBody!['amount'], 25);
      expect(capturedBody!['message'], 'Regalo');
      expect(provider.balance.balance, 75);
    });

    test('loadUnlockRules carga reglas', () async {
      final api = MockApiService(
        onGet: (path) => {
              'rules': [
                _makeUnlockRule('r1', cost: 50),
                _makeUnlockRule('r2', cost: 100),
              ]
            },
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadUnlockRules();

      expect(provider.unlockRules.length, 2);
      expect(provider.unlockRules[0].requiredEsencias, 50);
    });

    test('loadUnlockRules con diagnosis filtra', () async {
      String? capturedPath;
      final api = MockApiService(
        onGet: (path) {
          capturedPath = path;
          return {'rules': [_makeUnlockRule('r1', diagnosis: 'TDAH')]};
        },
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadUnlockRules(diagnosis: 'TDAH');

      expect(capturedPath, '/unlocks/rules/TDAH');
    });

    test('loadUserUnlocks carga desbloqueos del usuario', () async {
      final api = MockApiService(
        onGet: (path) => {
              'TEA': [
                {
                  'id': 'uu1',
                  'unlockId': 'r1',
                  'featureKey': 'sensory_dashboard',
                  'featureName': 'Sensory Dashboard',
                  'unlockedAt': '2026-01-01T00:00:00Z',
                  'isActive': true,
                }
              ],
            },
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadUserUnlocks();

      expect(provider.userUnlocks.length, 1);
      expect(provider.isFeatureUnlocked('sensory_dashboard'), true);
      expect(provider.isFeatureUnlocked('nonexistent'), false);
    });

    test('unlockFeature desbloquea y actualiza balance', () async {
      int getCallCount = 0;
      final api = MockApiService(
        onGet: (path) {
          getCallCount++;
          if (path.contains('/my-unlocks')) {
            return {
              'TEA': [
                {
                  'id': 'uu1',
                  'unlockId': 'r1',
                  'featureKey': 'deep_focus',
                  'featureName': 'Deep Focus',
                  'unlockedAt': '2026-01-01T00:00:00Z',
                  'isActive': true,
                }
              ],
            };
          }
          return {};
        },
        onPost: (path, {body}) =>
            {'success': true, 'newBalance': 50},
      );
      final provider = EsenciasProvider(api: api);

      final result = await provider.unlockFeature('r1');

      expect(result, true);
      expect(provider.balance.balance, 50);
      expect(provider.isFeatureUnlocked('deep_focus'), true);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Error'),
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadBalance();
      expect(provider.error, 'Error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadBalance con error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'DB error'),
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadBalance();

      expect(provider.error, 'DB error');
      expect(provider.balance.balance, 0);
    });

    test('transfer con balance insuficiente', () async {
      final api = MockApiService(
        onGet: (path) =>
            {'balance': 10, 'totalEarned': 10, 'totalSpent': 0},
        onPost: (path, {body}) => throw ApiException(
            statusCode: 400, message: 'INSUFFICIENT_BALANCE'),
      );
      final provider = EsenciasProvider(api: api);
      await provider.loadBalance();

      final result = await provider.transfer(toUserId: 'u2', amount: 100);

      expect(result, false);
      expect(provider.error, 'INSUFFICIENT_BALANCE');
    });

    test('unlockFeature con error', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw ApiException(
            statusCode: 400, message: 'DIAGNOSIS_MISMATCH'),
      );
      final provider = EsenciasProvider(api: api);

      final result = await provider.unlockFeature('r1');

      expect(result, false);
      expect(provider.error, 'DIAGNOSIS_MISMATCH');
    });

    test('loadTransactions con error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Timeout'),
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadTransactions();

      expect(provider.error, 'Timeout');
      expect(provider.transactions, isEmpty);
    });

    test('transfer con error genérico', () async {
      final api = MockApiService(
        onPost: (path, {body}) => throw Exception('Network'),
      );
      final provider = EsenciasProvider(api: api);

      final result = await provider.transfer(toUserId: 'u2', amount: 5);

      expect(result, false);
      expect(provider.error, isNotNull);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('loadBalance con respuesta vacía usa defaults', () async {
      final api = MockApiService(
        onGet: (path) => {},
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadBalance();

      expect(provider.balance.balance, 0);
      expect(provider.balance.totalEarned, 0);
      expect(provider.balance.totalSpent, 0);
    });

    test('loadUserUnlocks con respuesta vacía', () async {
      final api = MockApiService(
        onGet: (path) => {},
      );
      final provider = EsenciasProvider(api: api);

      await provider.loadUserUnlocks();

      expect(provider.userUnlocks, isEmpty);
      expect(provider.unlockedFeatureKeys, isEmpty);
    });

    test('transfer actualiza totalSpent local', () async {
      final api = MockApiService(
        onGet: (path) =>
            {'balance': 100, 'totalEarned': 100, 'totalSpent': 0},
        onPost: (path, {body}) =>
            {'newBalance': 75, 'transaction': {'id': 'tx-1'}},
      );
      final provider = EsenciasProvider(api: api);
      await provider.loadBalance();

      await provider.transfer(toUserId: 'u2', amount: 25);
      expect(provider.balance.totalSpent, 25);
    });

    test('isFeatureUnlocked sin cargar retorna false', () {
      final provider = EsenciasProvider(api: MockApiService());
      expect(provider.isFeatureUnlocked('any_key'), false);
    });

    test('unlockFeature con success=false no actualiza', () async {
      final api = MockApiService(
        onPost: (path, {body}) =>
            {'success': false, 'newBalance': 100},
      );
      final provider = EsenciasProvider(api: api);

      final result = await provider.unlockFeature('r1');
      expect(result, false);
    });
  });

  // ============================================================
  // MODELOS
  // ============================================================

  group('EsenciasModels', () {
    test('EsenciasBalance.fromJson', () {
      final b = EsenciasBalance.fromJson(
          {'balance': 50, 'totalEarned': 80, 'totalSpent': 30});
      expect(b.balance, 50);
      expect(b.totalEarned, 80);
      expect(b.totalSpent, 30);
    });

    test('EsenciasTransaction.fromJson grant', () {
      final tx = EsenciasTransaction.fromJson(
          _makeTransaction('t1', type: 'grant', reason: 'login_bonus'));
      expect(tx.isSystemGrant, true);
      expect(tx.isTransfer, false);
      expect(tx.reasonLabel, 'Bonus de login');
    });

    test('EsenciasTransaction.fromJson transfer', () {
      final tx = EsenciasTransaction.fromJson(
          _makeTransaction('t1', type: 'transfer', reason: 'user_transfer'));
      expect(tx.isTransfer, true);
      expect(tx.reasonLabel, 'Transferencia');
    });

    test('EsenciasTransaction.fromJson deduction', () {
      final tx = EsenciasTransaction.fromJson(
          _makeTransaction('t1', type: 'deduction', reason: 'unlock_deduction'));
      expect(tx.isDeduction, true);
      expect(tx.reasonLabel, 'Desbloqueo');
    });

    test('EsenciasTransaction reasonLabel default', () {
      final tx = EsenciasTransaction.fromJson(
          _makeTransaction('t1', reason: 'custom_reason'));
      expect(tx.reasonLabel, 'custom_reason');
    });

    test('UnlockRule.fromJson', () {
      final rule = UnlockRule.fromJson(_makeUnlockRule('r1', cost: 75));
      expect(rule.id, 'r1');
      expect(rule.featureKey, 'feature_r1');
      expect(rule.requiredEsencias, 75);
      expect(rule.category, 'theme');
    });

    test('UserUnlock.fromJson', () {
      final unlock = UserUnlock.fromJson({
        'id': 'uu1',
        'unlockId': 'r1',
        'featureKey': 'deep_focus',
        'featureName': 'Deep Focus',
        'unlockedAt': '2026-01-15T10:00:00Z',
        'isActive': true,
      });
      expect(unlock.featureKey, 'deep_focus');
      expect(unlock.isActive, true);
    });

    test('UserUnlock.fromJson isActive defaults true', () {
      final unlock = UserUnlock.fromJson({
        'id': 'uu1',
        'unlockId': 'r1',
        'featureKey': 'x',
        'featureName': 'X',
        'unlockedAt': '2026-01-01T00:00:00Z',
      });
      expect(unlock.isActive, true);
    });
  });
}
