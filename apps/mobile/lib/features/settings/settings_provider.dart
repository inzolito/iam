import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';

/// Usuario bloqueado.
class BlockedUser {
  final String id;
  final String userId;
  final String displayName;
  final String? photoUrl;
  final DateTime blockedAt;

  const BlockedUser({
    required this.id,
    required this.userId,
    required this.displayName,
    this.photoUrl,
    required this.blockedAt,
  });

  factory BlockedUser.fromJson(Map<String, dynamic> json) {
    return BlockedUser(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? json['userId'] as String? ?? '',
      displayName:
          json['display_name'] as String? ?? json['displayName'] as String? ?? 'Usuario',
      photoUrl: json['photo_url'] as String? ?? json['photoUrl'] as String?,
      blockedAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : json['blockedAt'] != null
              ? DateTime.parse(json['blockedAt'] as String)
              : DateTime.now(),
    );
  }
}

/// Reporte enviado por el usuario.
class UserReport {
  final String id;
  final String targetUserId;
  final String reason;
  final String status;
  final DateTime createdAt;

  const UserReport({
    required this.id,
    required this.targetUserId,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  factory UserReport.fromJson(Map<String, dynamic> json) {
    return UserReport(
      id: json['id'] as String? ?? '',
      targetUserId:
          json['target_user_id'] as String? ?? json['targetUserId'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}

/// Preferencias del usuario (tema, privacidad, notificaciones).
class UserPreferences {
  final bool pushEnabled;
  final bool emailEnabled;
  final bool showInFeed;
  final bool shareLocation;
  final String language;

  const UserPreferences({
    this.pushEnabled = true,
    this.emailEnabled = true,
    this.showInFeed = true,
    this.shareLocation = true,
    this.language = 'es',
  });

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      pushEnabled: json['pushEnabled'] as bool? ?? true,
      emailEnabled: json['emailEnabled'] as bool? ?? true,
      showInFeed: json['showInFeed'] as bool? ?? true,
      shareLocation: json['shareLocation'] as bool? ?? true,
      language: json['language'] as String? ?? 'es',
    );
  }

  Map<String, dynamic> toJson() => {
        'pushEnabled': pushEnabled,
        'emailEnabled': emailEnabled,
        'showInFeed': showInFeed,
        'shareLocation': shareLocation,
        'language': language,
      };

  UserPreferences copyWith({
    bool? pushEnabled,
    bool? emailEnabled,
    bool? showInFeed,
    bool? shareLocation,
    String? language,
  }) {
    return UserPreferences(
      pushEnabled: pushEnabled ?? this.pushEnabled,
      emailEnabled: emailEnabled ?? this.emailEnabled,
      showInFeed: showInFeed ?? this.showInFeed,
      shareLocation: shareLocation ?? this.shareLocation,
      language: language ?? this.language,
    );
  }
}

/// Provider de configuración — maneja blocks, reports, preferencias.
class SettingsProvider extends ChangeNotifier {
  final ApiService _api;

  List<BlockedUser> _blocks = [];
  List<BlockedUser> get blocks => _blocks;

  List<UserReport> _reports = [];
  List<UserReport> get reports => _reports;

  UserPreferences _preferences = const UserPreferences();
  UserPreferences get preferences => _preferences;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  SettingsProvider({required ApiService api}) : _api = api;

  // ── Blocks ──

  Future<void> loadBlocks() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/blocks');
      final list = response['blocks'] as List<dynamic>? ?? [];
      _blocks = list
          .map((b) => BlockedUser.fromJson(b as Map<String, dynamic>))
          .toList();
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> unblockUser(String userId) async {
    try {
      await _api.delete('/blocks/$userId');
      _blocks.removeWhere((b) => b.userId == userId);
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

  // ── Reports ──

  Future<void> loadReports() async {
    try {
      final response = await _api.get('/reports/mine');
      final list = response['reports'] as List<dynamic>? ?? [];
      _reports = list
          .map((r) => UserReport.fromJson(r as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
    } catch (_) {
      // silent fail — reports is a secondary feature
    }
  }

  // ── Preferences ──

  Future<void> loadPreferences() async {
    try {
      final response = await _api.get('/users/me/preferences');
      _preferences = UserPreferences.fromJson(response);
      notifyListeners();
    } catch (_) {
      // usar defaults si endpoint falla
    }
  }

  Future<bool> updatePreferences(UserPreferences newPrefs) async {
    final previous = _preferences;
    _preferences = newPrefs;
    notifyListeners();

    try {
      await _api.patch('/users/me/preferences', body: newPrefs.toJson());
      return true;
    } on ApiException catch (e) {
      // rollback
      _preferences = previous;
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _preferences = previous;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> togglePush() async {
    return updatePreferences(
        _preferences.copyWith(pushEnabled: !_preferences.pushEnabled));
  }

  Future<bool> toggleEmail() async {
    return updatePreferences(
        _preferences.copyWith(emailEnabled: !_preferences.emailEnabled));
  }

  Future<bool> toggleShowInFeed() async {
    return updatePreferences(
        _preferences.copyWith(showInFeed: !_preferences.showInFeed));
  }

  Future<bool> toggleShareLocation() async {
    return updatePreferences(
        _preferences.copyWith(shareLocation: !_preferences.shareLocation));
  }

  // ── Account ──

  /// Solicitar borrado de cuenta (GDPR). El backend procesa async.
  Future<bool> requestAccountDeletion() async {
    try {
      await _api.post('/users/me/delete-request');
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

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
