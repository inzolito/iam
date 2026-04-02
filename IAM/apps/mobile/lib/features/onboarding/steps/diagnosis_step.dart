import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../onboarding_provider.dart';

/// Paso 1: Selección de diagnóstico(s).
/// El usuario puede seleccionar uno o más. El primero es el primario (define el tema).
class DiagnosisStep extends StatelessWidget {
  const DiagnosisStep({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OnboardingProvider>();
    final theme = provider.currentTheme;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'I AM...',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Selecciona cómo te identificas.\nEl primero que elijas definirá tu tema visual.',
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 24),
          // Diagnosis options
          Expanded(
            child: ListView.separated(
              itemCount: OnboardingProvider.availableDiagnoses.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final diag = OnboardingProvider.availableDiagnoses[index];
                final key = diag['key']!;
                final isSelected = provider.selectedDiagnoses.contains(key);
                final isPrimary = provider.primaryDiagnosis == key;

                return _DiagnosisCard(
                  label: diag['label']!,
                  icon: diag['icon']!,
                  isSelected: isSelected,
                  isPrimary: isPrimary,
                  theme: theme,
                  onTap: () => provider.toggleDiagnosis(key),
                  onSetPrimary: isSelected && !isPrimary
                      ? () => provider.setPrimaryDiagnosis(key)
                      : null,
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          // Next button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed:
                  provider.canProceedFromDiagnosis ? provider.nextStep : null,
              style: FilledButton.styleFrom(
                backgroundColor: theme.colorScheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'Continuar',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DiagnosisCard extends StatelessWidget {
  final String label;
  final String icon;
  final bool isSelected;
  final bool isPrimary;
  final ThemeData theme;
  final VoidCallback onTap;
  final VoidCallback? onSetPrimary;

  const _DiagnosisCard({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.isPrimary,
    required this.theme,
    required this.onTap,
    this.onSetPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? theme.colorScheme.primary.withValues(alpha: 0.1)
              : theme.colorScheme.surface,
          border: Border.all(
            color: isSelected
                ? theme.colorScheme.primary
                : theme.colorScheme.onSurface.withValues(alpha: 0.15),
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  if (isPrimary)
                    Text(
                      'Tema principal',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
            ),
            if (isSelected && !isPrimary && onSetPrimary != null)
              TextButton(
                onPressed: onSetPrimary,
                child: Text(
                  'Hacer principal',
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
            if (isSelected)
              Icon(Icons.check_circle, color: theme.colorScheme.primary),
          ],
        ),
      ),
    );
  }
}
