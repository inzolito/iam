import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Shell con navegación inferior — contenedor principal de la app.
class HomeShell extends StatelessWidget {
  final Widget child;

  const HomeShell({super.key, required this.child});

  static const _tabs = [
    _TabConfig(icon: Icons.explore, label: 'Feed', path: '/feed'),
    _TabConfig(icon: Icons.chat_bubble_outline, label: 'Chat', path: '/chat'),
    _TabConfig(icon: Icons.map_outlined, label: 'Explorar', path: '/explore'),
    _TabConfig(icon: Icons.person_outline, label: 'Perfil', path: '/profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentPath = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexWhere((t) => currentPath.startsWith(t.path));

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex >= 0 ? currentIndex : 0,
        onDestinationSelected: (index) {
          context.go(_tabs[index].path);
        },
        backgroundColor: theme.colorScheme.surface,
        indicatorColor: theme.colorScheme.primary.withValues(alpha: 0.15),
        destinations: _tabs
            .map(
              (tab) => NavigationDestination(
                icon: Icon(tab.icon),
                selectedIcon: Icon(tab.icon, color: theme.colorScheme.primary),
                label: tab.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _TabConfig {
  final IconData icon;
  final String label;
  final String path;

  const _TabConfig({
    required this.icon,
    required this.label,
    required this.path,
  });
}
