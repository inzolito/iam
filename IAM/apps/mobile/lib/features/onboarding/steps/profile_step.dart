import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../onboarding_provider.dart';

/// Paso 3: Configuración del perfil (nombre, username, fecha de nacimiento).
class ProfileStep extends StatefulWidget {
  const ProfileStep({super.key});

  @override
  State<ProfileStep> createState() => _ProfileStepState();
}

class _ProfileStepState extends State<ProfileStep> {
  final _displayNameController = TextEditingController();
  final _usernameController = TextEditingController();
  DateTime? _selectedDate;

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(BuildContext context) async {
    final provider = context.read<OnboardingProvider>();
    final now = DateTime.now();
    final maxDate = DateTime(now.year - 16, now.month, now.day);
    final minDate = DateTime(now.year - 100);

    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? maxDate,
      firstDate: minDate,
      lastDate: maxDate,
      helpText: 'Fecha de nacimiento',
      cancelText: 'Cancelar',
      confirmText: 'Confirmar',
    );

    if (picked != null) {
      setState(() => _selectedDate = picked);
      provider.setBirthDate(
        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
      );
    }
  }

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
            'Tu perfil',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Así te verán otros. Puedes cambiarlo después.',
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 32),

          // Display Name
          _buildLabel('Nombre visible *', theme),
          const SizedBox(height: 8),
          TextField(
            controller: _displayNameController,
            onChanged: provider.setDisplayName,
            style: TextStyle(color: theme.colorScheme.onSurface),
            decoration: _inputDecoration(
              hint: 'Cómo quieres que te llamen',
              theme: theme,
            ),
          ),
          const SizedBox(height: 20),

          // Username
          _buildLabel('Username (opcional)', theme),
          const SizedBox(height: 8),
          TextField(
            controller: _usernameController,
            onChanged: provider.setUsername,
            style: TextStyle(color: theme.colorScheme.onSurface),
            decoration: _inputDecoration(
              hint: 'letras, números, punto, guión',
              theme: theme,
              prefix: '@',
            ),
          ),
          const SizedBox(height: 20),

          // Birth date
          _buildLabel('Fecha de nacimiento *', theme),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => _pickDate(context),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border.all(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.15),
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                _selectedDate != null
                    ? '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}'
                    : 'Seleccionar fecha',
                style: TextStyle(
                  color: _selectedDate != null
                      ? theme.colorScheme.onSurface
                      : theme.colorScheme.onSurface.withValues(alpha: 0.4),
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Debes tener al menos 16 años',
            style: TextStyle(
              fontSize: 12,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ),

          const Spacer(),

          // Error message
          if (provider.error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                provider.error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ),

          // Navigation
          Row(
            children: [
              TextButton(
                onPressed: provider.isLoading ? null : provider.previousStep,
                child: Text(
                  '← Atrás',
                  style: TextStyle(color: theme.colorScheme.primary),
                ),
              ),
              const Spacer(),
              SizedBox(
                height: 48,
                width: 160,
                child: FilledButton(
                  onPressed: provider.canComplete && !provider.isLoading
                      ? () async {
                          final success = await provider.submitOnboarding();
                          if (success && context.mounted) {
                            // Navigate to main app
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('¡Bienvenido a IAM! 🎉'),
                              ),
                            );
                          }
                        }
                      : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: provider.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Comenzar 🚀',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text, ThemeData theme) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: theme.colorScheme.onSurface,
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hint,
    required ThemeData theme,
    String? prefix,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefix,
      hintStyle: TextStyle(
        color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
      ),
      prefixStyle: TextStyle(
        color: theme.colorScheme.primary,
        fontWeight: FontWeight.w600,
      ),
      filled: true,
      fillColor: theme.colorScheme.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(
          color: theme.colorScheme.onSurface.withValues(alpha: 0.15),
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(
          color: theme.colorScheme.onSurface.withValues(alpha: 0.15),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: theme.colorScheme.primary),
      ),
    );
  }
}
