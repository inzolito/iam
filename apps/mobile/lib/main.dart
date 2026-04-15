import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/iam_themes.dart';
import 'core/services/api_service.dart';
import 'core/services/storage_service.dart';
import 'core/services/auth_service.dart';
import 'core/providers/auth_provider.dart';
import 'core/router/app_router.dart';
import 'features/onboarding/onboarding_provider.dart';
import 'features/feed/feed_provider.dart';
import 'features/chat/chat_provider.dart';
import 'features/esencias/esencias_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const IamApp());
}

class IamApp extends StatefulWidget {
  const IamApp({super.key});

  @override
  State<IamApp> createState() => _IamAppState();
}

class _IamAppState extends State<IamApp> {
  late final ApiService _apiService;
  late final StorageService _storageService;
  late final AuthService _authService;
  late final AuthProvider _authProvider;
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();

    _apiService = ApiService();
    _storageService = StorageService();
    _authService = AuthService(
      api: _apiService,
      storage: _storageService,
    );
    _authProvider = AuthProvider(
      authService: _authService,
      storage: _storageService,
    );
    _appRouter = AppRouter(authProvider: _authProvider);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>.value(value: _apiService),
        Provider<StorageService>.value(value: _storageService),
        Provider<AuthService>.value(value: _authService),
        ChangeNotifierProvider<AuthProvider>.value(value: _authProvider),
        ChangeNotifierProvider<OnboardingProvider>(
          create: (ctx) => OnboardingProvider(ctx.read<ApiService>()),
        ),
        ChangeNotifierProvider<FeedProvider>(
          create: (ctx) => FeedProvider(api: ctx.read<ApiService>()),
        ),
        ChangeNotifierProvider<ChatProvider>(
          create: (ctx) => ChatProvider(api: ctx.read<ApiService>()),
        ),
        ChangeNotifierProvider<EsenciasProvider>(
          create: (ctx) => EsenciasProvider(api: ctx.read<ApiService>()),
        ),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          // Tema dinámico basado en diagnóstico guardado
          final theme = _resolveTheme(authProvider);

          return MaterialApp.router(
            title: 'IAM',
            debugShowCheckedModeBanner: false,
            theme: theme,
            routerConfig: _appRouter.router,
          );
        },
      ),
    );
  }

  ThemeData _resolveTheme(AuthProvider authProvider) {
    final diagnosis = authProvider.user?.diagnosis;
    if (diagnosis == null) return IamThemes.defaultTheme();

    switch (diagnosis) {
      case 'TEA':
        return IamThemes.tea();
      case 'TDAH':
        return IamThemes.tdah();
      case 'AACC':
        return IamThemes.aacc();
      case 'DISLEXIA':
        return IamThemes.dislexia();
      default:
        return IamThemes.defaultTheme();
    }
  }
}
