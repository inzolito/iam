import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'api_service.dart';
import 'storage_service.dart';

/// Resultado de autenticación.
class AuthResult {
  final bool success;
  final String? userId;
  final String? error;
  final bool isNewUser;

  const AuthResult({
    required this.success,
    this.userId,
    this.error,
    this.isNewUser = false,
  });
}

/// Datos del usuario autenticado.
class AuthUser {
  final String id;
  final String email;
  final String? displayName;
  final String? avatarUrl;
  final String? diagnosis;
  final bool onboardingComplete;

  const AuthUser({
    required this.id,
    required this.email,
    this.displayName,
    this.avatarUrl,
    this.diagnosis,
    this.onboardingComplete = false,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      displayName: json['display_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      diagnosis: json['diagnosis'] as String?,
      onboardingComplete: json['onboarding_complete'] as bool? ?? false,
    );
  }
}

/// Servicio de autenticación con Google y Apple.
class AuthService {
  final ApiService _api;
  final StorageService _storage;
  final GoogleSignIn _googleSignIn;

  AuthService({
    required ApiService api,
    required StorageService storage,
    GoogleSignIn? googleSignIn,
  })  : _api = api,
        _storage = storage,
        _googleSignIn = googleSignIn ?? GoogleSignIn(scopes: ['email']);

  // ── Google Sign In ──

  Future<AuthResult> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        return const AuthResult(success: false, error: 'LOGIN_CANCELLED');
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;

      if (idToken == null) {
        return const AuthResult(success: false, error: 'NO_ID_TOKEN');
      }

      return _authenticateWithBackend('google', idToken);
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ── Apple Sign In ──

  Future<AuthResult> signInWithApple() async {
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final idToken = credential.identityToken;
      if (idToken == null) {
        return const AuthResult(success: false, error: 'NO_ID_TOKEN');
      }

      return _authenticateWithBackend('apple', idToken);
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ── Backend auth ──

  Future<AuthResult> _authenticateWithBackend(
    String provider,
    String idToken,
  ) async {
    try {
      final response = await _api.post('/auth/$provider', body: {
        'idToken': idToken,
      });

      final accessToken = response['accessToken'] as String?;
      final refreshToken = response['refreshToken'] as String?;
      final user = response['user'] as Map<String, dynamic>?;

      if (accessToken == null || user == null) {
        return const AuthResult(success: false, error: 'INVALID_RESPONSE');
      }

      // Guardar tokens y datos del usuario
      await _storage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      _api.setToken(accessToken);

      final userId = user['id'] as String;
      await _storage.saveUserId(userId);

      final diagnosis = user['diagnosis'] as String?;
      if (diagnosis != null) {
        await _storage.saveDiagnosis(diagnosis);
      }

      final onboardingDone = user['onboarding_complete'] as bool? ?? false;
      await _storage.setOnboardingComplete(onboardingDone);

      return AuthResult(
        success: true,
        userId: userId,
        isNewUser: !onboardingDone,
      );
    } on ApiException catch (e) {
      return AuthResult(success: false, error: e.message);
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ── Restaurar sesión ──

  Future<AuthUser?> restoreSession() async {
    final token = await _storage.getAccessToken();
    if (token == null) return null;

    _api.setToken(token);

    try {
      final response = await _api.get('/auth/me');
      final user = AuthUser.fromJson(response);

      await _storage.saveUserId(user.id);
      if (user.diagnosis != null) {
        await _storage.saveDiagnosis(user.diagnosis!);
      }
      await _storage.setOnboardingComplete(user.onboardingComplete);

      return user;
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        // Token expirado, intentar refresh
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          return restoreSession();
        }
        await _storage.clearTokens();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> _tryRefreshToken() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await _api.post('/auth/refresh', body: {
        'refreshToken': refreshToken,
      });

      final newAccessToken = response['accessToken'] as String?;
      if (newAccessToken == null) return false;

      await _storage.saveTokens(accessToken: newAccessToken);
      _api.setToken(newAccessToken);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Logout ──

  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    _api.setToken('');
    await _storage.clearAll();
  }

  // ── Helpers ──

  bool get isAppleSignInAvailable {
    try {
      return Platform.isIOS || Platform.isMacOS;
    } catch (_) {
      return false; // Web o test
    }
  }
}
