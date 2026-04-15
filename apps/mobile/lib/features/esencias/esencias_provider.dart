import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';
import 'esencias_models.dart';

/// Provider de Esencias — balance, transacciones, transfers, unlocks.
class EsenciasProvider extends ChangeNotifier {
  final ApiService _api;

  EsenciasBalance _balance = const EsenciasBalance();
  EsenciasBalance get balance => _balance;

  List<EsenciasTransaction> _transactions = [];
  List<EsenciasTransaction> get transactions => _transactions;

  int _transactionsTotal = 0;
  int get transactionsTotal => _transactionsTotal;

  List<UnlockRule> _unlockRules = [];
  List<UnlockRule> get unlockRules => _unlockRules;

  List<UserUnlock> _userUnlocks = [];
  List<UserUnlock> get userUnlocks => _userUnlocks;

  Set<String> _unlockedFeatureKeys = {};
  Set<String> get unlockedFeatureKeys => _unlockedFeatureKeys;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  EsenciasProvider({required ApiService api}) : _api = api;

  // ── Balance ──

  Future<void> loadBalance() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/esencias/balance');
      _balance = EsenciasBalance.fromJson(response);
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

  // ── Transacciones ──

  Future<void> loadTransactions({int limit = 50, int offset = 0}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api
          .get('/esencias/transactions?limit=$limit&offset=$offset');
      final list = response['transactions'] as List<dynamic>? ?? [];

      _transactions = list
          .map((t) =>
              EsenciasTransaction.fromJson(t as Map<String, dynamic>))
          .toList();
      _transactionsTotal = response['total'] as int? ?? 0;
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

  // ── Transfer ──

  Future<bool> transfer({
    required String toUserId,
    required int amount,
    String? message,
  }) async {
    _error = null;

    try {
      final response = await _api.post('/esencias/transfer', body: {
        'toUserId': toUserId,
        'amount': amount,
        if (message != null) 'message': message,
      });

      final newBalance = response['newBalance'] as int? ?? _balance.balance;
      _balance = EsenciasBalance(
        balance: newBalance,
        totalEarned: _balance.totalEarned,
        totalSpent: _balance.totalSpent + amount,
      );
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  // ── Unlock Rules ──

  Future<void> loadUnlockRules({String? diagnosis}) async {
    try {
      final path = diagnosis != null
          ? '/unlocks/rules/$diagnosis'
          : '/unlocks/rules';
      final response = await _api.get(path);
      final list = response['rules'] as List<dynamic>? ?? [];

      _unlockRules = list
          .map((r) => UnlockRule.fromJson(r as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  // ── User Unlocks ──

  Future<void> loadUserUnlocks() async {
    try {
      final response = await _api.get('/unlocks/my-unlocks');
      final unlocks = <UserUnlock>[];

      if (response is Map<String, dynamic>) {
        for (final entry in response.entries) {
          if (entry.value is List) {
            for (final u in entry.value) {
              unlocks.add(UserUnlock.fromJson(u as Map<String, dynamic>));
            }
          }
        }
      }

      _userUnlocks = unlocks;
      _unlockedFeatureKeys =
          unlocks.where((u) => u.isActive).map((u) => u.featureKey).toSet();
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  // ── Unlock Feature ──

  Future<bool> unlockFeature(String unlockId) async {
    _error = null;

    try {
      final response = await _api.post('/unlocks/$unlockId/unlock');
      final success = response['success'] as bool? ?? false;

      if (success) {
        final newBalance =
            response['newBalance'] as int? ?? _balance.balance;
        _balance = EsenciasBalance(
          balance: newBalance,
          totalEarned: _balance.totalEarned,
          totalSpent: _balance.totalSpent,
        );
        // Recargar unlocks
        await loadUserUnlocks();
      }
      return success;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Verificar si un feature está desbloqueado.
  bool isFeatureUnlocked(String featureKey) {
    return _unlockedFeatureKeys.contains(featureKey);
  }

  /// Limpiar error.
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
