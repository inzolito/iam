import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';

/// Pantalla de login — Google y Apple Sign In.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(flex: 2),

              // Logo
              Text(
                'IAM',
                style: TextStyle(
                  fontSize: 72,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 10,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Conexiones neurodiversas',
                style: TextStyle(
                  fontSize: 16,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  letterSpacing: 2,
                ),
              ),

              const Spacer(flex: 2),

              // Error message
              if (authProvider.error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _friendlyError(authProvider.error!),
                          style:
                              const TextStyle(color: Colors.red, fontSize: 13),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close,
                            color: Colors.red, size: 18),
                        onPressed: authProvider.clearError,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Google Sign In
              _LoginButton(
                onPressed: authProvider.isLoading
                    ? null
                    : () => authProvider.signInWithGoogle(),
                icon: Icons.g_mobiledata,
                label: 'Continuar con Google',
                backgroundColor: Colors.white,
                foregroundColor: Colors.black87,
                isLoading: authProvider.isLoading,
              ),

              const SizedBox(height: 12),

              // Apple Sign In (solo iOS/macOS)
              if (authProvider.isAppleSignInAvailable) ...[
                _LoginButton(
                  onPressed: authProvider.isLoading
                      ? null
                      : () => authProvider.signInWithApple(),
                  icon: Icons.apple,
                  label: 'Continuar con Apple',
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  isLoading: authProvider.isLoading,
                ),
                const SizedBox(height: 12),
              ],

              const Spacer(),

              // Footer
              Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Text(
                  'Al continuar, aceptas nuestros\nTérminos de Servicio y Política de Privacidad',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _friendlyError(String error) {
    if (error.contains('LOGIN_CANCELLED')) return 'Login cancelado';
    if (error.contains('NO_ID_TOKEN')) return 'Error de autenticación';
    if (error.contains('network')) return 'Sin conexión a internet';
    return 'Error al iniciar sesión. Intenta de nuevo.';
  }
}

class _LoginButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final bool isLoading;

  const _LoginButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: foregroundColor.withValues(alpha: 0.1),
            ),
          ),
        ),
        icon: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: foregroundColor,
                ),
              )
            : Icon(icon, size: 24),
        label: Text(
          label,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}
