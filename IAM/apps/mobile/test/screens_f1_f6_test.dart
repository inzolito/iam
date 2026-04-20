import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:iam_mobile/core/providers/auth_provider.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/core/services/auth_service.dart';
import 'package:iam_mobile/core/services/media_service.dart';
import 'package:iam_mobile/core/services/storage_service.dart';
import 'package:iam_mobile/features/onboarding/onboarding_provider.dart';
import 'package:iam_mobile/features/onboarding/onboarding_screen.dart';
import 'package:iam_mobile/features/auth/login_screen.dart';
import 'package:iam_mobile/features/auth/splash_screen.dart';
import 'package:iam_mobile/features/feed/feed_provider.dart';
import 'package:iam_mobile/features/feed/feed_screen.dart';
import 'package:iam_mobile/features/chat/chat_provider.dart';
import 'package:iam_mobile/features/chat/chat_list_screen.dart';
import 'package:iam_mobile/features/settings/settings_provider.dart';
import 'package:iam_mobile/features/settings/settings_screen.dart';
import 'package:iam_mobile/features/profile/profile_provider.dart';
import 'package:iam_mobile/features/profile/media_provider.dart';
import 'package:iam_mobile/features/profile/profile_screen.dart';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? _onGet;
  final Map<String, dynamic> Function(String path,
      {Map<String, dynamic>? body})? _onPost;

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

class MockAuthService extends AuthService {
  final AuthUser? _sessionUser;
  final bool _appleAvailable;

  MockAuthService({
    AuthUser? sessionUser,
    bool appleAvailable = false,
  })  : _sessionUser = sessionUser,
        _appleAvailable = appleAvailable,
        super(
          api: ApiService(baseUrl: 'http://localhost'),
          storage: StorageService(),
        );

  @override
  Future<AuthResult> signInWithGoogle() async =>
      const AuthResult(success: false, error: 'NO_MOCK');

  @override
  Future<AuthResult> signInWithApple() async =>
      const AuthResult(success: false, error: 'NO_MOCK');

  @override
  Future<AuthUser?> restoreSession() async => _sessionUser;

  @override
  Future<void> signOut() async {}

  @override
  bool get isAppleSignInAvailable => _appleAvailable;
}

class MockStorageService extends StorageService {
  @override
  Future<void> setOnboardingComplete(bool complete) async {}

  @override
  Future<bool> isOnboardingComplete() async => false;

  @override
  Future<void> clearAll() async {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

Widget _wrap(Widget child, List<dynamic> providers) {
  return MultiProvider(
    providers: providers.cast(),
    child: MaterialApp(home: child),
  );
}

Map<String, dynamic> _makeFeedProfile(String id) => {
      'id': id,
      'display_name': 'Persona $id',
      'birth_date': '1990-01-01',
      'avatar_url': null,
      'diagnoses': ['TEA'],
      'spin_tags': [],
      'msn_status': 'Hola',
      'compatibility_score': 0.85,
      'distance_meters': 1000,
    };

Map<String, dynamic> _makeConversation(String matchId) => {
      'match': {'id': matchId},
      'otherUser': {'id': 'u-$matchId', 'display_name': 'Otro $matchId'},
      'lastMessage': null,
      'unreadCount': 0,
    };

Map<String, dynamic> _makePreferences() => {
      'pushEnabled': true,
      'emailEnabled': false,
      'showInFeed': true,
      'showDistance': true,
      'teenMode': false,
    };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  // -------------------------------------------------------------------------
  // F1 — OnboardingScreen
  // -------------------------------------------------------------------------

  group('F1 OnboardingScreen', () {
    testWidgets('renderiza sin errores en paso inicial', (tester) async {
      final provider = OnboardingProvider(MockApiService());

      await tester.pumpWidget(_wrap(
        const OnboardingScreen(),
        [ChangeNotifierProvider<OnboardingProvider>.value(value: provider)],
      ));

      expect(find.byType(OnboardingScreen), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('muestra label del paso 0 (Diagnóstico)', (tester) async {
      final provider = OnboardingProvider(MockApiService());

      await tester.pumpWidget(_wrap(
        const OnboardingScreen(),
        [ChangeNotifierProvider<OnboardingProvider>.value(value: provider)],
      ));

      expect(find.text('Diagnóstico'), findsOneWidget);
    });

    testWidgets('progress bar tiene 3 segmentos para 3 pasos', (tester) async {
      final provider = OnboardingProvider(MockApiService());

      await tester.pumpWidget(_wrap(
        const OnboardingScreen(),
        [ChangeNotifierProvider<OnboardingProvider>.value(value: provider)],
      ));

      // 3 barras de progreso (Diagnóstico/SpIn/Perfil) — Container con BoxDecoration
      final containers = find.byWidgetPredicate((w) =>
          w is Container &&
          w.decoration is BoxDecoration &&
          (w.decoration as BoxDecoration).borderRadius != null);
      expect(containers, findsAtLeastNWidgets(3));
    });
  });

  // -------------------------------------------------------------------------
  // F2 — SplashScreen + LoginScreen
  // -------------------------------------------------------------------------

  group('F2 SplashScreen', () {
    testWidgets('renderiza con logo IAM y progress indicator', (tester) async {
      final auth = AuthProvider(
        authService: MockAuthService(),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const SplashScreen(),
        [ChangeNotifierProvider<AuthProvider>.value(value: auth)],
      ));

      expect(find.text('IAM'), findsOneWidget);
      expect(find.text('I Am Me'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('F2 LoginScreen', () {
    testWidgets('muestra logo y botón de Google', (tester) async {
      final auth = AuthProvider(
        authService: MockAuthService(appleAvailable: false),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const LoginScreen(),
        [ChangeNotifierProvider<AuthProvider>.value(value: auth)],
      ));

      expect(find.text('IAM'), findsOneWidget);
      expect(find.text('Conexiones neurodiversas'), findsOneWidget);
      expect(find.text('Continuar con Google'), findsOneWidget);
    });

    testWidgets('muestra botón Apple cuando está disponible', (tester) async {
      final auth = AuthProvider(
        authService: MockAuthService(appleAvailable: true),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const LoginScreen(),
        [ChangeNotifierProvider<AuthProvider>.value(value: auth)],
      ));

      expect(find.text('Continuar con Apple'), findsOneWidget);
    });

    testWidgets('no muestra Apple cuando no está disponible', (tester) async {
      final auth = AuthProvider(
        authService: MockAuthService(appleAvailable: false),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const LoginScreen(),
        [ChangeNotifierProvider<AuthProvider>.value(value: auth)],
      ));

      expect(find.text('Continuar con Apple'), findsNothing);
    });

    testWidgets('muestra footer de términos', (tester) async {
      final auth = AuthProvider(
        authService: MockAuthService(),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const LoginScreen(),
        [ChangeNotifierProvider<AuthProvider>.value(value: auth)],
      ));

      expect(
        find.textContaining('Términos de Servicio'),
        findsOneWidget,
      );
    });
  });

  // -------------------------------------------------------------------------
  // F3 — ProfileScreen
  // -------------------------------------------------------------------------

  group('F3 ProfileScreen', () {
    testWidgets('renderiza AppBar con título "Perfil"', (tester) async {
      final profile = ProfileProvider(api: MockApiService());
      final media = MediaProvider(api: MockApiService(), media: MediaService());

      await tester.pumpWidget(_wrap(
        const ProfileScreen(),
        [
          ChangeNotifierProvider<ProfileProvider>.value(value: profile),
          ChangeNotifierProvider<MediaProvider>.value(value: media),
        ],
      ));

      expect(find.text('Perfil'), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('muestra error con botón Reintentar cuando no hay perfil',
        (tester) async {
      final profile = ProfileProvider(api: MockApiService());
      final media = MediaProvider(api: MockApiService(), media: MediaService());

      await tester.pumpWidget(_wrap(
        const ProfileScreen(),
        [
          ChangeNotifierProvider<ProfileProvider>.value(value: profile),
          ChangeNotifierProvider<MediaProvider>.value(value: media),
        ],
      ));

      // Sin perfil cargado, muestra el bloque de error
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------------------
  // F4 — FeedScreen
  // -------------------------------------------------------------------------

  group('F4 FeedScreen', () {
    testWidgets('renderiza AppBar con título IAM y botón de filtros',
        (tester) async {
      final provider = FeedProvider(
        api: MockApiService(onGet: (p) => {'profiles': []}),
      );

      await tester.pumpWidget(_wrap(
        const FeedScreen(),
        [ChangeNotifierProvider<FeedProvider>.value(value: provider)],
      ));

      expect(find.text('IAM'), findsOneWidget);
      expect(find.byIcon(Icons.tune), findsOneWidget);
    });

    testWidgets('muestra mensaje vacío cuando no hay perfiles',
        (tester) async {
      final api = MockApiService(onGet: (p) => {'profiles': []});
      final provider = FeedProvider(api: api);
      await provider.loadFeed();

      await tester.pumpWidget(_wrap(
        const FeedScreen(),
        [ChangeNotifierProvider<FeedProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No hay mas perfiles'), findsOneWidget);
      expect(find.text('Actualizar'), findsOneWidget);
    });

    testWidgets('muestra error con botón reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) =>
            throw ApiException(statusCode: 500, message: 'Error servidor'),
      );
      final provider = FeedProvider(api: api);
      await provider.loadFeed();

      await tester.pumpWidget(_wrap(
        const FeedScreen(),
        [ChangeNotifierProvider<FeedProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No se pudo cargar el feed'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off), findsOneWidget);
    });

    testWidgets('muestra perfil cuando hay profiles cargados', (tester) async {
      final api = MockApiService(
        onGet: (p) => {
          'profiles': [_makeFeedProfile('1')],
        },
      );
      final provider = FeedProvider(api: api);
      await provider.loadFeed();

      await tester.pumpWidget(_wrap(
        const FeedScreen(),
        [ChangeNotifierProvider<FeedProvider>.value(value: provider)],
      ));
      await tester.pump();

      // Con un perfil cargado, no debería mostrar el mensaje "No hay mas perfiles"
      expect(find.text('No hay mas perfiles'), findsNothing);
    });

    testWidgets('botón de filtros no muestra badge sin filtros activos',
        (tester) async {
      final provider = FeedProvider(
        api: MockApiService(onGet: (p) => {'profiles': []}),
      );

      await tester.pumpWidget(_wrap(
        const FeedScreen(),
        [ChangeNotifierProvider<FeedProvider>.value(value: provider)],
      ));

      final badge = tester.widget<Badge>(find.byType(Badge).first);
      expect(badge.isLabelVisible, false);
    });
  });

  // -------------------------------------------------------------------------
  // F5 — ChatListScreen
  // -------------------------------------------------------------------------

  group('F5 ChatListScreen', () {
    testWidgets('renderiza AppBar con título "Mensajes"', (tester) async {
      final provider = ChatProvider(
        api: MockApiService(onGet: (p) => {'conversations': []}),
      );

      await tester.pumpWidget(_wrap(
        const ChatListScreen(),
        [ChangeNotifierProvider<ChatProvider>.value(value: provider)],
      ));

      expect(find.text('Mensajes'), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('muestra mensaje vacío cuando no hay conversaciones',
        (tester) async {
      final api = MockApiService(onGet: (p) => {'conversations': []});
      final provider = ChatProvider(api: api);
      await provider.loadConversations();

      await tester.pumpWidget(_wrap(
        const ChatListScreen(),
        [ChangeNotifierProvider<ChatProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Sin conversaciones'), findsOneWidget);
    });

    testWidgets('muestra error con botón Reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) =>
            throw ApiException(statusCode: 500, message: 'Error de red'),
      );
      final provider = ChatProvider(api: api);
      await provider.loadConversations();

      await tester.pumpWidget(_wrap(
        const ChatListScreen(),
        [ChangeNotifierProvider<ChatProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Error de red'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------------------
  // F6 — SettingsScreen
  // -------------------------------------------------------------------------

  group('F6 SettingsScreen', () {
    testWidgets('renderiza AppBar con título "Configuración"',
        (tester) async {
      final settings = SettingsProvider(
        api: MockApiService(
          onGet: (p) {
            if (p.contains('preferences')) return _makePreferences();
            if (p.contains('blocks')) return {'blocked': []};
            if (p.contains('reports')) return {'reports': []};
            return {};
          },
        ),
      );
      final auth = AuthProvider(
        authService: MockAuthService(),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: settings),
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ],
      ));

      expect(find.text('Configuración'), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('muestra sección de Notificaciones', (tester) async {
      final settings = SettingsProvider(
        api: MockApiService(
          onGet: (p) {
            if (p.contains('preferences')) return _makePreferences();
            return {'blocked': [], 'reports': []};
          },
        ),
      );
      final auth = AuthProvider(
        authService: MockAuthService(),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: settings),
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ],
      ));

      expect(find.text('NOTIFICACIONES'), findsOneWidget);
      expect(find.text('Notificaciones push'), findsOneWidget);
    });

    testWidgets('muestra sección de Privacidad', (tester) async {
      final settings = SettingsProvider(
        api: MockApiService(
          onGet: (p) {
            if (p.contains('preferences')) return _makePreferences();
            return {'blocked': [], 'reports': []};
          },
        ),
      );
      final auth = AuthProvider(
        authService: MockAuthService(),
        storage: MockStorageService(),
      );

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: settings),
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ],
      ));

      expect(find.text('PRIVACIDAD'), findsOneWidget);
    });
  });
}
