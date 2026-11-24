import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/core/services/media_service.dart';
import 'package:iam_mobile/core/providers/auth_provider.dart';
import 'package:iam_mobile/core/services/auth_service.dart';
import 'package:iam_mobile/core/services/storage_service.dart'; // ignore: unused_import
import 'package:iam_mobile/features/settings/settings_provider.dart';
import 'package:iam_mobile/features/settings/settings_screen.dart';
import 'package:iam_mobile/features/profile/media_provider.dart';
import 'package:iam_mobile/features/profile/widgets/photo_gallery.dart';
import 'package:iam_mobile/features/feed/widgets/filter_sheet.dart';
import 'package:iam_mobile/features/feed/feed_filters.dart';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String)? _onGet;
  final Map<String, dynamic> Function(String, {Map<String, dynamic>? body})? _onPost;
  final Map<String, dynamic> Function(String, {Map<String, dynamic>? body})? _onPatch;

  MockApiService({
    Map<String, dynamic> Function(String)? onGet,
    Map<String, dynamic> Function(String, {Map<String, dynamic>? body})? onPost,
    Map<String, dynamic> Function(String, {Map<String, dynamic>? body})? onPatch,
  })  : _onGet = onGet,
        _onPost = onPost,
        _onPatch = onPatch,
        super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async =>
      _onGet != null ? _onGet!(path) : {};

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body}) async =>
      _onPost != null ? _onPost!(path, body: body) : {};

  @override
  Future<Map<String, dynamic>> patch(String path,
      {Map<String, dynamic>? body}) async =>
      _onPatch != null ? _onPatch!(path, body: body) : {};

  @override
  Future<Map<String, dynamic>> delete(String path) async => {};
}

class MockMediaService extends MediaService {
  @override
  Future<PickedImage?> pickImage({
    ImageSourceType source = ImageSourceType.gallery,
  }) async =>
      null;
}

class MockAuthService extends AuthService {
  MockAuthService()
      : super(
          api: ApiService(baseUrl: 'http://localhost'),
          storage: StorageService(),
        );

  @override
  Future<AuthResult> signInWithGoogle() async =>
      const AuthResult(success: true, isNewUser: false);

  @override
  Future<AuthResult> signInWithApple() async =>
      const AuthResult(success: true, isNewUser: false);

  @override
  Future<void> signOut() async {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

Widget _wrap(Widget child, List<ChangeNotifierProvider> providers) {
  return MultiProvider(
    providers: providers,
    child: MaterialApp(home: child),
  );
}

Map<String, dynamic> _makeBlock(String id) => {
      'id': id,
      'user_id': 'u$id',
      'display_name': 'Usuario $id',
      'created_at': '2026-01-01T00:00:00Z',
    };

Map<String, dynamic> _makeReport(String id) => {
      'id': id,
      'target_user_id': 'u$id',
      'reason': 'Spam',
      'status': 'pending',
      'created_at': '2026-01-01T00:00:00Z',
    };

Map<String, dynamic> _makePhoto(String id, {bool isPrimary = false}) => {
      'id': id,
      'url': 'https://example.com/$id.jpg',
      'order': 0,
      'is_primary': isPrimary,
      'created_at': '2026-01-01T00:00:00Z',
    };

AuthProvider _makeAuthProvider() {
  return AuthProvider(
    authService: MockAuthService(),
    storage: StorageService(),
  );
}

// ---------------------------------------------------------------------------
// F11 — SettingsScreen
// ---------------------------------------------------------------------------

void main() {
  group('F11 SettingsScreen', () {
    testWidgets('renderiza secciones principales', (tester) async {
      final api = MockApiService(
        onGet: (p) => p.contains('blocks')
            ? {'blocks': []}
            : p.contains('reports')
                ? {'reports': []}
                : {},
      );
      final provider = SettingsProvider(api: api);

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      expect(find.text('Configuración'), findsOneWidget);
      expect(find.text('Notificaciones push'), findsOneWidget);
      expect(find.text('Notificaciones por email'), findsOneWidget);
      expect(find.text('Aparecer en el feed'), findsOneWidget);
      expect(find.text('Compartir ubicación'), findsOneWidget);
      expect(find.text('Usuarios bloqueados'), findsOneWidget);
      expect(find.text('Mis reportes'), findsOneWidget);
      // Items al final del ListView — buscar incluso si están fuera del viewport
      expect(find.text('Cerrar sesión', skipOffstage: false), findsOneWidget);
      expect(find.text('Eliminar cuenta', skipOffstage: false), findsOneWidget);
    });

    testWidgets('muestra versión de la app', (tester) async {
      final api = MockApiService(onGet: (p) => {});
      final provider = SettingsProvider(api: api);

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      expect(find.textContaining('IAM v', skipOffstage: false), findsOneWidget);
    });

    testWidgets('contadores de bloqueos y reportes son 0 al inicio', (tester) async {
      final api = MockApiService(
        onGet: (p) => p.contains('blocks')
            ? {'blocks': []}
            : p.contains('reports')
                ? {'reports': []}
                : {},
      );
      final provider = SettingsProvider(api: api);

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      expect(find.text('0 usuario(s)'), findsOneWidget);
      expect(find.text('0 reporte(s)'), findsOneWidget);
    });

    testWidgets('muestra contador de bloqueados cargados', (tester) async {
      final api = MockApiService(
        onGet: (p) => p.contains('blocks')
            ? {'blocks': [_makeBlock('1'), _makeBlock('2')]}
            : {},
      );
      final provider = SettingsProvider(api: api);
      await provider.loadBlocks();

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      expect(find.text('2 usuario(s)'), findsOneWidget);
    });

    testWidgets('switches de notificaciones están activos por defecto', (tester) async {
      final api = MockApiService(onGet: (p) => {});
      final provider = SettingsProvider(api: api);

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      final switches = tester.widgetList<Switch>(find.byType(Switch)).toList();
      expect(switches.length, greaterThanOrEqualTo(4));
      // Los primeros 4 switches (push, email, showInFeed, shareLocation) deben estar ON
      expect(switches[0].value, isTrue);
      expect(switches[1].value, isTrue);
    });

    testWidgets('reportes con estado pending muestran 1 reporte(s)', (tester) async {
      final api = MockApiService(
        onGet: (p) => p.contains('reports')
            ? {'reports': [_makeReport('r1')]}
            : {},
      );
      final provider = SettingsProvider(api: api);
      await provider.loadReports();

      await tester.pumpWidget(_wrap(
        const SettingsScreen(),
        [
          ChangeNotifierProvider<SettingsProvider>.value(value: provider),
          ChangeNotifierProvider<AuthProvider>.value(value: _makeAuthProvider()),
        ],
      ));
      await tester.pump();

      expect(find.text('1 reporte(s)'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // F12 — PhotoGallery widget
  // ---------------------------------------------------------------------------

  group('F12 PhotoGallery', () {
    testWidgets('muestra contador 0/6 sin fotos', (tester) async {
      final provider = MediaProvider(
        api: MockApiService(),
        media: MockMediaService(),
      );

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('0/${MediaProvider.maxPhotos}'), findsOneWidget);
    });

    testWidgets('muestra tile de agregar foto cuando hay espacio', (tester) async {
      final provider = MediaProvider(
        api: MockApiService(),
        media: MockMediaService(),
      );

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.byIcon(PhosphorIcons.cameraPlus(PhosphorIconsStyle.regular)), findsOneWidget);
    });

    testWidgets('muestra fotos cargadas con contador correcto', (tester) async {
      final api = MockApiService(
        onGet: (p) => {
          'gallery': [_makePhoto('p1'), _makePhoto('p2')],
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('2/${MediaProvider.maxPhotos}'), findsOneWidget);
    });

    testWidgets('muestra badge "Principal" en foto marcada como principal', (tester) async {
      final api = MockApiService(
        onGet: (p) => {
          'gallery': [
            _makePhoto('p1', isPrimary: true),
            _makePhoto('p2'),
          ],
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Principal'), findsOneWidget);
    });

    testWidgets('no muestra tile de agregar cuando galería está llena', (tester) async {
      final photos = List.generate(
        MediaProvider.maxPhotos,
        (i) => _makePhoto('p$i'),
      );
      final api = MockApiService(onGet: (p) => {'gallery': photos});
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.byIcon(PhosphorIcons.cameraPlus(PhosphorIconsStyle.regular)), findsNothing);
    });

    testWidgets('muestra mensaje de error si ocurre uno', (tester) async {
      final api = MockApiService(
        onGet: (p) => throw ApiException(statusCode: 500, message: 'Error de red'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      await tester.pumpWidget(_wrap(
        const Scaffold(body: PhotoGallery()),
        [ChangeNotifierProvider<MediaProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.textContaining('Error de red'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // F13 — FilterSheet
  // ---------------------------------------------------------------------------

  group('F13 FilterSheet', () {
    testWidgets('renderiza secciones de filtros', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: FeedFilters.none),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Filtros'), findsOneWidget);
      expect(find.text('Mostrar'), findsOneWidget);
      expect(find.text('Diagnósticos'), findsOneWidget);
      // Secciones más abajo en el scroll — hacer scroll para que se construyan
      await tester.drag(find.byType(ListView), const Offset(0, -600));
      await tester.pump();
      expect(find.text('Rango de edad', skipOffstage: false), findsOneWidget);
      expect(find.text('Distancia máxima', skipOffstage: false), findsOneWidget);
      expect(find.text('Energía mínima', skipOffstage: false), findsOneWidget);
      expect(find.text('Conectar por', skipOffstage: false), findsOneWidget);
    });

    testWidgets('muestra chips de diagnóstico', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: FeedFilters.none),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('TEA'), findsOneWidget);
      expect(find.text('TDAH'), findsOneWidget);
      expect(find.text('Altas Capacidades'), findsOneWidget);
      expect(find.text('Dislexia'), findsOneWidget);
    });

    testWidgets('no muestra botón Limpiar con filtros vacíos', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: FeedFilters.none),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Limpiar'), findsNothing);
    });

    testWidgets('muestra botón Limpiar cuando hay filtros activos', (tester) async {
      final withFilter = FeedFilters.none.toggleDiagnosis('TEA');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: withFilter),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Limpiar'), findsOneWidget);
    });

    testWidgets('botón Aplicar muestra conteo cuando hay filtros activos', (tester) async {
      final withFilter = FeedFilters.none.toggleDiagnosis('TEA');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: withFilter),
          ),
        ),
      );
      await tester.pump();

      expect(find.textContaining('Aplicar ('), findsOneWidget);
    });

    testWidgets('botón Aplicar sin conteo con filtros vacíos', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: FeedFilters.none),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Aplicar'), findsOneWidget);
      expect(find.textContaining('Aplicar ('), findsNothing);
    });

    testWidgets('chip TEA se selecciona al tocar', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FilterSheet(initial: FeedFilters.none),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('TEA'));
      await tester.pump();

      expect(find.textContaining('Aplicar (1)'), findsOneWidget);
      expect(find.text('Limpiar'), findsOneWidget);
    });
  });
}
