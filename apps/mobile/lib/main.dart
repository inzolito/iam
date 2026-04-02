import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/iam_themes.dart';
import 'core/services/api_service.dart';
import 'features/onboarding/onboarding_provider.dart';
import 'features/onboarding/onboarding_screen.dart';

void main() {
  runApp(const IamApp());
}

class IamApp extends StatelessWidget {
  const IamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        ChangeNotifierProvider<OnboardingProvider>(
          create: (ctx) => OnboardingProvider(ctx.read<ApiService>()),
        ),
      ],
      child: MaterialApp(
        title: 'IAM',
        debugShowCheckedModeBanner: false,
        theme: IamThemes.defaultTheme(),
        home: const OnboardingScreen(),
      ),
    );
  }
}
