import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/home/home_shell.dart';
import '../../features/feed/feed_screen.dart';
import '../../features/chat/chat_list_screen.dart';
import '../../features/chat/chat_screen.dart';
import '../../features/esencias/esencias_screen.dart';
import '../../features/profile/profile_screen.dart';

/// Rutas de la aplicación con redirección según estado de auth.
class AppRouter {
  final AuthProvider authProvider;

  AppRouter({required this.authProvider});

  late final GoRouter router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: authProvider,
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      // Shell principal con navegación inferior
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/feed',
            builder: (context, state) => const FeedScreen(),
          ),
          GoRoute(
            path: '/chat',
            builder: (context, state) => const ChatListScreen(),
            routes: [
              GoRoute(
                path: ':matchId',
                builder: (context, state) => ChatScreen(
                  matchId: state.pathParameters['matchId']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/explore',
            builder: (context, state) => const EsenciasScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
    ],
    redirect: (context, state) {
      final status = authProvider.status;
      final currentPath = state.matchedLocation;

      // Mientras se verifica la sesión, solo permitir splash
      if (status == AuthStatus.initial) {
        return currentPath == '/splash' ? null : '/splash';
      }

      // Sin autenticar → login
      if (status == AuthStatus.unauthenticated) {
        return currentPath == '/login' ? null : '/login';
      }

      // Autenticado pero sin onboarding → onboarding
      if (status == AuthStatus.onboarding) {
        return currentPath == '/onboarding' ? null : '/onboarding';
      }

      // Autenticado y onboarding completo → no permitir volver a login/onboarding
      if (status == AuthStatus.authenticated) {
        if (currentPath == '/login' ||
            currentPath == '/onboarding' ||
            currentPath == '/splash') {
          return '/feed';
        }
      }

      return null; // No redireccionar
    },
  );
}

/// Página placeholder para las secciones pendientes de implementar.
class _PlaceholderPage extends StatelessWidget {
  final String title;

  const _PlaceholderPage(this.title);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(
          title,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
      ),
    );
  }
}
