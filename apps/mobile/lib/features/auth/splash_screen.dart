import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/design/design_tokens.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/widgets/iam_svg_picture.dart';

/// Pantalla de carga inicial — verifica sesión y redirige.
///
/// Usa el lienzo [DesignTokens.heroBackground] (`#89DDF5`, idéntico al fondo
/// de `logoOpcion1`) para que el logo blanco con sonrisa se funda de forma
/// continua con toda la pantalla y haga una transición fluida hacia [LoginScreen].
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();

    // Inicializar auth al montar la pantalla
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().initialize();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    return Scaffold(
      backgroundColor: DesignTokens.heroBackground,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Align(
            alignment: const Alignment(0, -0.36),
            child: FadeTransition(
              opacity: _fade,
              child: ScaleTransition(
                scale: _scale,
                child: IamSvgPicture.asset(
                  DesignTokens.wordmarkSvgAsset,
                  width: 230,
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: screenHeight * 0.42,
            child: FadeTransition(
              opacity: _fade,
              child: IamSvgPicture.asset(
                DesignTokens.crowdSvgAsset,
                fit: BoxFit.cover,
                alignment: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
