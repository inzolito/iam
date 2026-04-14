import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Almacenamiento seguro para tokens JWT y datos sensibles.
class StorageService {
  final FlutterSecureStorage _storage;

  static const _keyAccessToken = 'iam_access_token';
  static const _keyRefreshToken = 'iam_refresh_token';
  static const _keyUserId = 'iam_user_id';
  static const _keyDiagnosis = 'iam_diagnosis';
  static const _keyOnboardingComplete = 'iam_onboarding_complete';

  StorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  // ── Tokens ──

  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _keyRefreshToken, value: refreshToken);
    }
  }

  Future<String?> getAccessToken() async {
    return _storage.read(key: _keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    return _storage.read(key: _keyRefreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
  }

  // ── User info ──

  Future<void> saveUserId(String userId) async {
    await _storage.write(key: _keyUserId, value: userId);
  }

  Future<String?> getUserId() async {
    return _storage.read(key: _keyUserId);
  }

  Future<void> saveDiagnosis(String diagnosis) async {
    await _storage.write(key: _keyDiagnosis, value: diagnosis);
  }

  Future<String?> getDiagnosis() async {
    return _storage.read(key: _keyDiagnosis);
  }

  Future<void> setOnboardingComplete(bool complete) async {
    await _storage.write(
      key: _keyOnboardingComplete,
      value: complete ? 'true' : 'false',
    );
  }

  Future<bool> isOnboardingComplete() async {
    final value = await _storage.read(key: _keyOnboardingComplete);
    return value == 'true';
  }

  // ── Limpiar todo (logout) ──

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
