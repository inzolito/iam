import 'package:flutter/material.dart';
import 'core/theme/iam_themes.dart';

void main() {
  runApp(const IamApp());
}

class IamApp extends StatelessWidget {
  const IamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IAM',
      debugShowCheckedModeBanner: false,
      theme: IamThemes.defaultTheme(),
      home: const PlaceholderScreen(),
    );
  }
}

/// Pantalla temporal de Stage 1 — se reemplazará con el onboarding.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'I AM',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                    letterSpacing: 8,
                  ),
            ),
            const SizedBox(height: 16),
            Text(
              'Conectando mentes que se entienden',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.6),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
