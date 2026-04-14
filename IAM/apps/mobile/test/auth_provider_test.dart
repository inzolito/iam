import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/providers/auth_provider.dart';
import 'package:iam_mobile/core/services/auth_service.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/core/services/storage_service.dart';

/// Mock AuthService para tests sin HTTP ni OAuth real.
class MockAuthService extends AuthService {
  final AuthResult? _googleResult;
  final AuthResult? _appleResult;
  final AuthUser? _sessionUser;
  bool _signOutCalled = false;
  final bool _appleAvailable;

  MockAuthService({
    AuthResult? googleResult,
    AuthResult? appleResult,
    AuthUser? sessionUser,
    bool appleAvailable = false,
  })  : _googleResult = googleResult,
        _appleResult = appleResult,
        _sessionUser = sessionUser,
        _appleAvailable = appleAvailable,
        super(
          api: ApiService(baseUrl: 'http://localhost'),
          storage: StorageService(),
        );

  @override
  Future<AuthResult> signInWithGoogle() async {
    return _googleResult ?? const AuthResult(success: false, error: 'NO_MOCK');
  }

  @override
  Future<AuthResult> signInWithApple() async {
    return _appleResult ?? const AuthResult(success: false, error: 'NO_MOCK');
  }

  @override
  Future<AuthUser?> restoreSession() async {
    return _sessionUser;
  }

  @override
  Future<void> signOut() async {
    _signOutCalled = true;
  }

  @override
  bool get isAppleSignInAvailable => _appleAvailable;

  bool get signOutWasCalled => _signOutCalled;
}

/// Mock StorageService que guarda en memoria.
class MockStorageService extends StorageService {
  final Map<String, String> _data = {};

  @override
  Future<void> setOnboardingComplete(bool complete) async {
    _data['onboarding'] = complete ? 'true' : 'false';
  }

  @override
  Future<bool> isOnboardingComplete() async {
    return _data['onboarding'] == 'true';
  }

  @override
  Future<void> clearAll() async {
    _data.clear();
  }
}

void main() {
  late MockAuthService mockAuthService;
  late MockStorageService mockStorage;
  late AuthProvider provider;

  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial es initial', () {
      mockAuthService = MockAuthService();
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      expect(provider.status, AuthStatus.initial);
      expect(provider.user, isNull);
      expect(provider.error, isNull);
      expect(provider.isLoading, false);
    });

    test('initialize con sesión activa → authenticated', () async {
      mockAuthService = MockAuthService(
        sessionUser: const AuthUser(
          id: 'user-1',
          email: 'test@test.com',
          displayName: 'Test',
          diagnosis: 'TEA',
          onboardingComplete: true,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();

      expect(provider.status, AuthStatus.authenticated);
      expect(provider.user!.id, 'user-1');
      expect(provider.user!.diagnosis, 'TEA');
    });

    test('initialize sin sesión → unauthenticated', () async {
      mockAuthService = MockAuthService(sessionUser: null);
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();

      expect(provider.status, AuthStatus.unauthenticated);
      expect(provider.user, isNull);
    });

    test('initialize con usuario nuevo → onboarding', () async {
      mockAuthService = MockAuthService(
        sessionUser: const AuthUser(
          id: 'user-1',
          email: 'test@test.com',
          onboardingComplete: false,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();

      expect(provider.status, AuthStatus.onboarding);
    });

    test('signInWithGoogle exitoso → authenticated', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(success: true, userId: 'u1'),
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: true,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      final result = await provider.signInWithGoogle();

      expect(result, true);
      expect(provider.status, AuthStatus.authenticated);
    });

    test('signInWithGoogle usuario nuevo → onboarding', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(
          success: true,
          userId: 'u1',
          isNewUser: true,
        ),
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: false,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      final result = await provider.signInWithGoogle();

      expect(result, true);
      expect(provider.status, AuthStatus.onboarding);
    });

    test('completeOnboarding cambia a authenticated', () async {
      mockAuthService = MockAuthService(
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: false,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();
      expect(provider.status, AuthStatus.onboarding);

      await provider.completeOnboarding();
      expect(provider.status, AuthStatus.authenticated);
    });

    test('signOut limpia estado', () async {
      mockAuthService = MockAuthService(
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: true,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();
      expect(provider.status, AuthStatus.authenticated);

      await provider.signOut();

      expect(provider.status, AuthStatus.unauthenticated);
      expect(provider.user, isNull);
      expect(provider.error, isNull);
    });

    test('clearError limpia error', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(
          success: false,
          error: 'LOGIN_CANCELLED',
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.signInWithGoogle();
      expect(provider.error, 'LOGIN_CANCELLED');

      provider.clearError();
      expect(provider.error, isNull);
    });

    test('isAppleSignInAvailable refleja el servicio', () {
      mockAuthService = MockAuthService(appleAvailable: true);
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      expect(provider.isAppleSignInAvailable, true);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('signInWithGoogle fallido setea error', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(
          success: false,
          error: 'NETWORK_ERROR',
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      final result = await provider.signInWithGoogle();

      expect(result, false);
      expect(provider.error, 'NETWORK_ERROR');
      expect(provider.isLoading, false);
    });

    test('signInWithGoogle cancelado no cambia status', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(
          success: false,
          error: 'LOGIN_CANCELLED',
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.signInWithGoogle();

      expect(provider.status, AuthStatus.initial);
      expect(provider.error, 'LOGIN_CANCELLED');
    });

    test('signInWithApple fallido setea error', () async {
      mockAuthService = MockAuthService(
        appleResult: const AuthResult(
          success: false,
          error: 'APPLE_AUTH_FAILED',
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      final result = await provider.signInWithApple();

      expect(result, false);
      expect(provider.error, 'APPLE_AUTH_FAILED');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('initialize con excepción → unauthenticated', () async {
      mockAuthService = MockAuthService();
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();
      expect(provider.status, AuthStatus.unauthenticated);
    });

    test('doble signOut no falla', () async {
      mockAuthService = MockAuthService(
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: true,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.initialize();
      await provider.signOut();
      await provider.signOut();

      expect(provider.status, AuthStatus.unauthenticated);
    });

    test('signIn flag isLoading correcta después de completar', () async {
      mockAuthService = MockAuthService(
        googleResult: const AuthResult(success: true, userId: 'u1'),
        sessionUser: const AuthUser(
          id: 'u1',
          email: 'test@test.com',
          onboardingComplete: true,
        ),
      );
      mockStorage = MockStorageService();
      provider = AuthProvider(
        authService: mockAuthService,
        storage: mockStorage,
      );

      await provider.signInWithGoogle();
      expect(provider.isLoading, false);
    });

    test('AuthUser.fromJson con campos mínimos', () {
      final user = AuthUser.fromJson({'id': 'test-id'});

      expect(user.id, 'test-id');
      expect(user.email, '');
      expect(user.displayName, isNull);
      expect(user.diagnosis, isNull);
      expect(user.onboardingComplete, false);
    });

    test('AuthUser.fromJson con todos los campos', () {
      final user = AuthUser.fromJson({
        'id': 'u1',
        'email': 'test@test.com',
        'display_name': 'Test User',
        'avatar_url': 'https://example.com/avatar.png',
        'diagnosis': 'TDAH',
        'onboarding_complete': true,
      });

      expect(user.id, 'u1');
      expect(user.email, 'test@test.com');
      expect(user.displayName, 'Test User');
      expect(user.avatarUrl, 'https://example.com/avatar.png');
      expect(user.diagnosis, 'TDAH');
      expect(user.onboardingComplete, true);
    });
  });
}
