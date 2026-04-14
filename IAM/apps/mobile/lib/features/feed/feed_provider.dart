import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';
import 'feed_profile.dart';

/// Provider del feed de descubrimiento y swipes.
class FeedProvider extends ChangeNotifier {
  final ApiService _api;

  List<FeedProfile> _profiles = [];
  List<FeedProfile> get profiles => _profiles;

  int _currentIndex = 0;
  int get currentIndex => _currentIndex;

  FeedProfile? get currentProfile =>
      _currentIndex < _profiles.length ? _profiles[_currentIndex] : null;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  int _page = 0;
  bool _hasMore = true;
  bool get hasMore => _hasMore;

  // Último match creado (para mostrar dialog)
  Map<String, dynamic>? _lastMatch;
  Map<String, dynamic>? get lastMatch => _lastMatch;

  FeedProvider({required ApiService api}) : _api = api;

  /// Cargar perfiles del feed (primera página).
  Future<void> loadFeed({int? radius}) async {
    _isLoading = true;
    _error = null;
    _page = 0;
    _currentIndex = 0;
    notifyListeners();

    try {
      final query = radius != null ? '?radius=$radius&page=0' : '?page=0';
      final response = await _api.get('/feed$query');
      final list = response['profiles'] as List<dynamic>? ?? [];

      _profiles =
          list.map((p) => FeedProfile.fromJson(p as Map<String, dynamic>)).toList();
      _hasMore = list.length >= 20;
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

  /// Cargar más perfiles (paginación).
  Future<void> loadMore({int? radius}) async {
    if (!_hasMore || _isLoading) return;

    _page++;
    _isLoading = true;
    notifyListeners();

    try {
      final query =
          radius != null ? '?radius=$radius&page=$_page' : '?page=$_page';
      final response = await _api.get('/feed$query');
      final list = response['profiles'] as List<dynamic>? ?? [];

      final newProfiles =
          list.map((p) => FeedProfile.fromJson(p as Map<String, dynamic>)).toList();
      _profiles.addAll(newProfiles);
      _hasMore = list.length >= 20;
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _page--;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _page--;
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Dar like a un perfil.
  Future<bool> like(String targetUserId) async {
    return _swipe(targetUserId, 'like');
  }

  /// Pasar un perfil.
  Future<bool> pass(String targetUserId) async {
    return _swipe(targetUserId, 'pass');
  }

  Future<bool> _swipe(String targetUserId, String direction) async {
    try {
      final response = await _api.post('/swipes', body: {
        'targetUserId': targetUserId,
        'direction': direction,
      });

      _lastMatch = null;

      if (response['matched'] == true) {
        _lastMatch = response['match'] as Map<String, dynamic>?;
      }

      _advanceToNext();
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

  /// Bloquear un usuario.
  Future<bool> blockUser(String userId) async {
    try {
      await _api.post('/blocks', body: {'userId': userId});
      // Remover del feed local
      _profiles.removeWhere((p) => p.id == userId);
      if (_currentIndex >= _profiles.length && _currentIndex > 0) {
        _currentIndex = _profiles.length - 1;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Reportar un usuario.
  Future<bool> reportUser(String userId, String reason,
      {String? description}) async {
    try {
      await _api.post('/reports', body: {
        'userId': userId,
        'reason': reason,
        if (description != null) 'description': description,
      });
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void _advanceToNext() {
    _currentIndex++;
    // Pre-cargar más cuando quedan pocos
    if (_currentIndex >= _profiles.length - 3 && _hasMore) {
      loadMore();
    }
    notifyListeners();
  }

  /// Limpiar último match (después de cerrar dialog).
  void clearLastMatch() {
    _lastMatch = null;
    notifyListeners();
  }

  /// Limpiar error.
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// ¿Feed vacío?
  bool get isEmpty => _profiles.isEmpty && !_isLoading;

  /// ¿Se acabaron los perfiles?
  bool get isExhausted =>
      _currentIndex >= _profiles.length && !_hasMore && !_isLoading;
}
