import 'package:flutter/foundation.dart';

import '../services/auth_service.dart';
import '../services/storage_service.dart';

/// Estados posibles de autenticación.
enum AuthStatus {
  initial, // App recién abierta, verificando sesión
  authenticated, // Sesión activa
  unauthenticated, // Sin sesión
  onboarding, // Autenticado pero sin completar onboarding
}

/// Provider de autenticación — maneja el estado global de la sesión.
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final StorageService _storage;

  AuthStatus _status = AuthStatus.initial;
  AuthStatus get status => _status;

  AuthUser? _user;
  AuthUser? get user => _user;

  String? _error;
  String? get error => _error;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  AuthProvider({
    required AuthService authService,
    required StorageService storage,
  })  : _authService = authService,
        _storage = storage;

  /// Inicializar — verificar si hay sesión guardada.
  Future<void> initialize() async {
    _status = AuthStatus.initial;
    notifyListeners();

    try {
      final user = await _authService.restoreSession();

      if (user == null) {
        _status = AuthStatus.unauthenticated;
      } else {
        _user = user;
        if (!user.onboardingComplete) {
          _status = AuthStatus.onboarding;
        } else {
          _status = AuthStatus.authenticated;
        }
      }
    } catch (_) {
      _status = AuthStatus.unauthenticated;
    }

    notifyListeners();
  }

  /// Login con Google.
  Future<bool> signInWithGoogle() async {
    return _signIn(() => _authService.signInWithGoogle());
  }

  /// Login con Apple.
  Future<bool> signInWithApple() async {
    return _signIn(() => _authService.signInWithApple());
  }

  Future<bool> _signIn(Future<AuthResult> Function() signInMethod) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await signInMethod();

      if (!result.success) {
        _error = result.error;
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Restaurar datos del usuario
      final user = await _authService.restoreSession();
      _user = user;

      if (result.isNewUser || (user != null && !user.onboardingComplete)) {
        _status = AuthStatus.onboarding;
      } else {
        _status = AuthStatus.authenticated;
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Marcar onboarding como completo y pasar a authenticated.
  Future<void> completeOnboarding() async {
    await _storage.setOnboardingComplete(true);
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  /// Logout.
  Future<void> signOut() async {
    await _authService.signOut();
    _user = null;
    _status = AuthStatus.unauthenticated;
    _error = null;
    notifyListeners();
  }

  /// Limpiar error.
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// ¿Se puede hacer Apple Sign In?
  bool get isAppleSignInAvailable => _authService.isAppleSignInAvailable;
}
