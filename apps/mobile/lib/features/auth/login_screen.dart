import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config/env.dart';
import '../../core/design/design_tokens.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/widgets/iam_svg_picture.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Pantalla de inicio / login — Google y Apple Sign In.
///
/// Diseñada sobre el lienzo [DesignTokens.heroBackground] (`#89DDF5`) para que
/// el logo `logoOpcion1` ("Iam" + sonrisa en blanco) sea el protagonista a
/// pantalla completa, gobernado 100% desde [DesignTokens].
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: DesignTokens.heroBackground,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Capa 2: Multitud + silueta central anclada en la base (bottom: 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: screenHeight * 0.36,
            child: IamSvgPicture.asset(
              DesignTokens.crowdSvgAsset,
              fit: BoxFit.cover,
              alignment: Alignment.bottomCenter,
            ),
          ),

          // Capa 1 + Controles de Login
          SafeArea(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: DesignTokens.spaceXL),
              child: Column(
                children: [
                  const Spacer(flex: 2),

                  // Tipografía vectorial iam (#FFFFFF)
                  IamSvgPicture.asset(
                    DesignTokens.wordmarkSvgAsset,
                    width: 220,
                  ),
                  const SizedBox(height: DesignTokens.spaceMD),
                  Text(
                    'Conexiones neurodiversas',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: DesignTokens.fontMD,
                      fontWeight: FontWeight.w600,
                      color:
                          DesignTokens.onHeroBackground.withValues(alpha: 0.92),
                      letterSpacing: 1.6,
                    ),
                  ),

                  const Spacer(flex: 2),

                  // Error message
                  if (authProvider.error != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(DesignTokens.spaceMD - 4),
                      decoration: BoxDecoration(
                        color: DesignTokens.surface.withValues(alpha: 0.95),
                        borderRadius:
                            BorderRadius.circular(DesignTokens.radiusMD),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            PhosphorIcons.warningCircle(
                                PhosphorIconsStyle.regular),
                            color: DesignTokens.error,
                            size: 20,
                          ),
                          const SizedBox(width: DesignTokens.spaceSM),
                          Expanded(
                            child: Text(
                              _friendlyError(authProvider.error!),
                              style: const TextStyle(
                                color: DesignTokens.error,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: Icon(
                              PhosphorIcons.x(PhosphorIconsStyle.bold),
                              color: DesignTokens.error,
                              size: 18,
                            ),
                            onPressed: authProvider.clearError,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: DesignTokens.spaceMD),
                  ],

                  // Google Sign In
                  _LoginButton(
                    onPressed: authProvider.isLoading
                        ? null
                        : () => authProvider.signInWithGoogle(),
                    icon: Icons.g_mobiledata,
                    label: 'Continuar con Google',
                    backgroundColor: DesignTokens.surface,
                    foregroundColor: DesignTokens.textPrimary,
                    isLoading: authProvider.isLoading,
                  ),

                  const SizedBox(height: DesignTokens.spaceSM + 4),

                  // Apple Sign In (solo iOS/macOS)
                  if (authProvider.isAppleSignInAvailable) ...[
                    _LoginButton(
                      onPressed: authProvider.isLoading
                          ? null
                          : () => authProvider.signInWithApple(),
                      icon: PhosphorIcons.appleLogo(PhosphorIconsStyle.fill),
                      label: 'Continuar con Apple',
                      backgroundColor: DesignTokens.textPrimary,
                      foregroundColor: DesignTokens.surface,
                      isLoading: authProvider.isLoading,
                    ),
                    const SizedBox(height: DesignTokens.spaceSM + 4),
                  ],

                  const Spacer(flex: 3),

                  // Footer
                  Padding(
                    padding:
                        const EdgeInsets.only(bottom: DesignTokens.spaceMD),
                    child: Text(
                      'Al continuar, aceptas nuestros\nTérminos de Servicio y Política de Privacidad',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: DesignTokens.fontXS,
                        color: DesignTokens.onHeroBackground
                            .withValues(alpha: 0.9),
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _friendlyError(String error) {
    // Fuera de prod mostramos el error técnico completo para diagnóstico.
    if (!Env.isProd) return error;

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
      height: 54,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          elevation: 2,
          shadowColor: Colors.black.withValues(alpha: 0.12),
          shape: const StadiumBorder(),
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
          style: const TextStyle(
            fontSize: DesignTokens.fontMD,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
