import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'onboarding_provider.dart';
import 'steps/diagnosis_step.dart';
import 'steps/spin_step.dart';
import 'steps/profile_step.dart';

/// Pantalla principal de Onboarding.
/// Flujo: Diagnóstico → SpIn → Perfil
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<OnboardingProvider>(
      builder: (context, provider, _) {
        // Aplica el tema dinámico según diagnóstico seleccionado
        return Theme(
          data: provider.currentTheme,
          child: Scaffold(
            body: SafeArea(
              child: Column(
                children: [
                  // Progress indicator
                  _buildProgress(context, provider),
                  // Step content
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: _buildStep(provider),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildProgress(BuildContext context, OnboardingProvider provider) {
    final steps = ['Diagnóstico', 'SpIn', 'Perfil'];
    final theme = provider.currentTheme;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Step indicators
          Row(
            children: List.generate(steps.length, (index) {
              final isActive = index == provider.currentStep;
              final isDone = index < provider.currentStep;
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDone || isActive
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurface.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          // Step label
          Text(
            steps[provider.currentStep],
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(OnboardingProvider provider) {
    switch (provider.currentStep) {
      case 0:
        return const DiagnosisStep(key: ValueKey('diagnosis'));
      case 1:
        return const SpinStep(key: ValueKey('spin'));
      case 2:
        return const ProfileStep(key: ValueKey('profile'));
      default:
        return const SizedBox.shrink();
    }
  }
}
