import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/venues/venues_provider.dart';
import 'package:iam_mobile/features/venues/venues_screen.dart';
import 'package:iam_mobile/features/body_doubling/body_doubling_provider.dart';
import 'package:iam_mobile/features/body_doubling/body_doubling_screen.dart';
import 'package:iam_mobile/features/meetups/meetups_provider.dart';
import 'package:iam_mobile/features/meetups/meetups_screen.dart';
import 'package:iam_mobile/features/notifications/notifications_provider.dart';
import 'package:iam_mobile/features/notifications/notifications_screen.dart';

// ---------------------------------------------------------------------------
// Mock API
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

Widget _wrap(Widget child, List<ChangeNotifierProvider> providers) {
  return MultiProvider(
    providers: providers,
    child: MaterialApp(home: child),
  );
}

Map<String, dynamic> _makeVenue(String id) => {
      'id': id,
      'name': 'Café $id',
      'category': 'cafe',
      'address': 'Calle $id',
      'sensoryRating': 4.0,
      'averageRating': 4.5,
      'reviewCount': 20,
      'distance': 300.0,
      'imageUrl': null,
      'isFavorite': false,
    };

Map<String, dynamic> _makeSession(String id) => {
      'id': id,
      'hostId': 'host1',
      'hostName': 'Host',
      'title': 'Sesión $id',
      'activityType': 'study',
      'durationMinutes': 25,
      'maxParticipants': 5,
      'currentParticipants': 1,
      'status': 'waiting',
      'isPublic': true,
      'created_at': '2026-01-01T00:00:00Z',
    };

Map<String, dynamic> _makeMeetup(String id) => {
      'id': id,
      'matchId': 'match1',
      'status': 'pending',
      'userAConfirmed': false,
      'userBConfirmed': false,
      'expiresAt': '2099-12-31T23:59:59Z',
      'created_at': '2026-01-01T00:00:00Z',
    };

Map<String, dynamic> _makeNotif(String id) => {
      'id': id,
      'type': 'match',
      'title': 'Notif $id',
      'body': 'Cuerpo',
      'isRead': false,
      'created_at': '2026-01-01T00:00:00Z',
    };

// ---------------------------------------------------------------------------
// F7 — VenuesScreen
// ---------------------------------------------------------------------------

void main() {
  group('F7 VenuesScreen', () {
    testWidgets('pantalla renderiza sin errores en estado inicial', (tester) async {
      final provider = VenuesProvider(api: MockApiService(onGet: (p) => {'venues': []}));

      await tester.pumpWidget(_wrap(
        const VenuesScreen(),
        [ChangeNotifierProvider<VenuesProvider>.value(value: provider)],
      ));

      // Estado inicial: isLoading=false y venues vacíos (antes de postFrameCallback)
      expect(find.byType(VenuesScreen), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('muestra lista de venues', (tester) async {
      final api = MockApiService(
        onGet: (p) => {'venues': [_makeVenue('v1'), _makeVenue('v2')]},
      );
      final provider = VenuesProvider(api: api);
      await provider.loadNearby(lat: 0, lng: 0);

      await tester.pumpWidget(_wrap(
        const VenuesScreen(),
        [ChangeNotifierProvider<VenuesProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Café v1'), findsOneWidget);
      expect(find.text('Café v2'), findsOneWidget);
    });

    testWidgets('muestra mensaje vacío cuando no hay venues', (tester) async {
      final api = MockApiService(onGet: (p) => {'venues': []});
      final provider = VenuesProvider(api: api);
      await provider.loadNearby(lat: 0, lng: 0);

      await tester.pumpWidget(_wrap(
        const VenuesScreen(),
        [ChangeNotifierProvider<VenuesProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No hay lugares cerca'), findsOneWidget);
    });

    testWidgets('muestra error con botón reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) => throw ApiException(statusCode: 500, message: 'Error servidor'),
      );
      final provider = VenuesProvider(api: api);
      await provider.loadNearby(lat: 0, lng: 0);

      await tester.pumpWidget(_wrap(
        const VenuesScreen(),
        [ChangeNotifierProvider<VenuesProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Error servidor'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('chips de categoría presentes en AppBar', (tester) async {
      final provider = VenuesProvider(api: MockApiService(onGet: (p) => {'venues': []}));
      await provider.loadNearby(lat: 0, lng: 0);

      await tester.pumpWidget(_wrap(
        const VenuesScreen(),
        [ChangeNotifierProvider<VenuesProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Todos'), findsOneWidget);
      expect(find.text('cafe'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------------------
  // F8 — BodyDoublingScreen
  // -------------------------------------------------------------------------

  group('F8 BodyDoublingScreen', () {
    testWidgets('muestra lista de sesiones', (tester) async {
      final api = MockApiService(
        onGet: (p) => {'sessions': [_makeSession('s1'), _makeSession('s2')]},
      );
      final provider = BodyDoublingProvider(api: api);
      await provider.loadSessions();

      await tester.pumpWidget(_wrap(
        const BodyDoublingScreen(),
        [ChangeNotifierProvider<BodyDoublingProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Sesión s1'), findsOneWidget);
      expect(find.text('Sesión s2'), findsOneWidget);
    });

    testWidgets('muestra mensaje vacío cuando no hay sesiones', (tester) async {
      final api = MockApiService(onGet: (p) => {'sessions': []});
      final provider = BodyDoublingProvider(api: api);
      await provider.loadSessions();

      await tester.pumpWidget(_wrap(
        const BodyDoublingScreen(),
        [ChangeNotifierProvider<BodyDoublingProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No hay sesiones activas'), findsOneWidget);
    });

    testWidgets('FAB crear sesión visible', (tester) async {
      final api = MockApiService(onGet: (p) => {'sessions': []});
      final provider = BodyDoublingProvider(api: api);
      await provider.loadSessions();

      await tester.pumpWidget(_wrap(
        const BodyDoublingScreen(),
        [ChangeNotifierProvider<BodyDoublingProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Crear sesión'), findsOneWidget);
    });

    testWidgets('muestra error con botón reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) => throw ApiException(statusCode: 401, message: 'No autorizado'),
      );
      final provider = BodyDoublingProvider(api: api);
      await provider.loadSessions();

      await tester.pumpWidget(_wrap(
        const BodyDoublingScreen(),
        [ChangeNotifierProvider<BodyDoublingProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No autorizado'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('botón Unirse visible en sesión disponible', (tester) async {
      final api = MockApiService(
        onGet: (p) => {'sessions': [_makeSession('s1')]},
      );
      final provider = BodyDoublingProvider(api: api);
      await provider.loadSessions();

      await tester.pumpWidget(_wrap(
        const BodyDoublingScreen(),
        [ChangeNotifierProvider<BodyDoublingProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Unirse'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------------------
  // F9 — MeetupsScreen
  // -------------------------------------------------------------------------

  group('F9 MeetupsScreen', () {
    testWidgets('muestra 2 tabs: Pendientes / Historial', (tester) async {
      final api = MockApiService(onGet: (p) => {'meetups': []});
      final provider = MeetupsProvider(api: api);
      await provider.loadMeetups();

      await tester.pumpWidget(_wrap(
        const MeetupsScreen(),
        [ChangeNotifierProvider<MeetupsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Pendientes'), findsOneWidget);
      expect(find.text('Historial'), findsOneWidget);
    });

    testWidgets('tab Pendientes muestra mensaje vacío', (tester) async {
      final api = MockApiService(onGet: (p) => {'meetups': []});
      final provider = MeetupsProvider(api: api);
      await provider.loadMeetups();

      await tester.pumpWidget(_wrap(
        const MeetupsScreen(),
        [ChangeNotifierProvider<MeetupsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('No hay meetups pendientes'), findsOneWidget);
    });

    testWidgets('meetup pendiente muestra botones Confirmar y Disputar',
        (tester) async {
      final api = MockApiService(
        onGet: (p) => {'meetups': [_makeMeetup('m1')]},
        onPost: (p, {body}) => {'success': true},
      );
      final provider = MeetupsProvider(api: api);
      await provider.loadMeetups();

      await tester.pumpWidget(_wrap(
        const MeetupsScreen(),
        [ChangeNotifierProvider<MeetupsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.text('Disputar'), findsOneWidget);
    });

    testWidgets('muestra error con botón reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) => throw ApiException(statusCode: 500, message: 'Server error'),
      );
      final provider = MeetupsProvider(api: api);
      await provider.loadMeetups();

      await tester.pumpWidget(_wrap(
        const MeetupsScreen(),
        [ChangeNotifierProvider<MeetupsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Server error'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------------------
  // F10 — NotificationsScreen
  // -------------------------------------------------------------------------

  group('F10 NotificationsScreen', () {
    testWidgets('muestra lista de notificaciones', (tester) async {
      final api = MockApiService(
        onGet: (p) => {
              'notifications': [_makeNotif('n1'), _makeNotif('n2')],
            },
        onPost: (p, {body}) => {'success': true},
      );
      final provider = NotificationsProvider(api: api);
      await provider.loadNotifications();

      await tester.pumpWidget(_wrap(
        const NotificationsScreen(),
        [ChangeNotifierProvider<NotificationsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Notif n1'), findsOneWidget);
      expect(find.text('Notif n2'), findsOneWidget);
    });

    testWidgets('muestra mensaje vacío cuando no hay notificaciones',
        (tester) async {
      final api = MockApiService(onGet: (p) => {'notifications': []});
      final provider = NotificationsProvider(api: api);
      await provider.loadNotifications();

      await tester.pumpWidget(_wrap(
        const NotificationsScreen(),
        [ChangeNotifierProvider<NotificationsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Sin notificaciones'), findsOneWidget);
    });

    testWidgets('botón Marcar todo visible con no-leídas', (tester) async {
      final api = MockApiService(
        onGet: (p) => {'notifications': [_makeNotif('n1')]},
        onPost: (p, {body}) => {'success': true},
      );
      final provider = NotificationsProvider(api: api);
      await provider.loadNotifications();

      await tester.pumpWidget(_wrap(
        const NotificationsScreen(),
        [ChangeNotifierProvider<NotificationsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Marcar todo'), findsOneWidget);
    });

    testWidgets('botón Marcar todo oculto cuando todo está leído',
        (tester) async {
      final api = MockApiService(
        onGet: (p) => {
              'notifications': [
                {
                  'id': 'r1',
                  'type': 'match',
                  'title': 'Leída',
                  'isRead': true,
                  'created_at': '2026-01-01T00:00:00Z',
                }
              ],
            },
      );
      final provider = NotificationsProvider(api: api);
      await provider.loadNotifications();

      await tester.pumpWidget(_wrap(
        const NotificationsScreen(),
        [ChangeNotifierProvider<NotificationsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Marcar todo'), findsNothing);
    });

    testWidgets('muestra error con botón reintentar', (tester) async {
      final api = MockApiService(
        onGet: (p) => throw ApiException(statusCode: 401, message: 'Unauthorized'),
      );
      final provider = NotificationsProvider(api: api);
      await provider.loadNotifications();

      await tester.pumpWidget(_wrap(
        const NotificationsScreen(),
        [ChangeNotifierProvider<NotificationsProvider>.value(value: provider)],
      ));
      await tester.pump();

      expect(find.text('Unauthorized'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });
}
