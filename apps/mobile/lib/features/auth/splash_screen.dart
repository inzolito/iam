import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/design/design_tokens.dart';
import '../../core/providers/auth_provider.dart';

/// Pantalla de carga inicial — verifica sesión y redirige.
///
/// Fondo sólido (no degradado) + logo con entrada fade/scale, sin spinner
/// visible — estilo Tinder/Bumble/Hinge. El logo tiene tonos de azul
/// variados (no monocromático), por eso el fondo es claro y sólido: un
/// color muy saturado arriesgaría perder contraste con las partes más
/// claras del logo.
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
    return Scaffold(
      backgroundColor: DesignTokens.blue50,
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Image.asset(
              'assets/images/logo.png',
              width: 240,
              height: 240,
            ),
          ),
        ),
      ),
    );
  }
}
