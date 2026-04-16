import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';
import 'profile_models.dart';

/// Provider del perfil de usuario — lectura y edición.
class ProfileProvider extends ChangeNotifier {
  final ApiService _api;

  UserProfile? _profile;
  UserProfile? get profile => _profile;

  List<UserDiagnosis> _diagnoses = [];
  List<UserDiagnosis> get diagnoses => _diagnoses;

  String? _primaryDiagnosis;
  String? get primaryDiagnosis =>
      _primaryDiagnosis ??
      _diagnoses.where((d) => d.isPrimary).map((d) => d.diagnosis).firstOrNull;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  String? _error;
  String? get error => _error;

  ProfileProvider({required ApiService api}) : _api = api;

  // ── Load ──

  /// Cargar perfil completo.
  Future<void> loadProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/users/me/profile');
      _profile = UserProfile.fromJson(response);
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

  /// Cargar diagnósticos.
  Future<void> loadDiagnoses() async {
    try {
      final response = await _api.get('/users/me/diagnoses');
      final list = response['diagnoses'] as List<dynamic>? ?? [];
      _diagnoses = list
          .map((d) => UserDiagnosis.fromJson(d as Map<String, dynamic>))
          .toList();

      final primary = _diagnoses.where((d) => d.isPrimary).toList();
      _primaryDiagnosis = primary.isNotEmpty ? primary.first.diagnosis : null;
      notifyListeners();
    } catch (_) {
      // Silenciar — diagnoses no son críticos
    }
  }

  // ── Update ──

  /// Actualizar campos del perfil.
  Future<bool> updateProfile({
    String? displayName,
    String? username,
    String? msnStatus,
    int? energyLevel,
    int? notifLevel,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final body = <String, dynamic>{};
      if (displayName != null) body['displayName'] = displayName;
      if (username != null) body['username'] = username;
      if (msnStatus != null) body['msnStatus'] = msnStatus;
      if (energyLevel != null) body['energyLevel'] = energyLevel;
      if (notifLevel != null) body['notifLevel'] = notifLevel;

      if (body.isEmpty) {
        _isSaving = false;
        notifyListeners();
        return false;
      }

      final response = await _api.patch('/users/me/profile', body: body);
      _profile = UserProfile.fromJson(response);
      _isSaving = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      _isSaving = false;
      notifyListeners();
      return false;
    }
  }

  /// Limpiar error.
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
