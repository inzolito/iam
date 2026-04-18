import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../notifications/notifications_provider.dart';

/// Shell con navegación inferior — contenedor principal de la app.
class HomeShell extends StatelessWidget {
  final Widget child;

  const HomeShell({super.key, required this.child});

  static const _tabs = [
    _TabConfig(icon: Icons.explore, label: 'Feed', path: '/feed'),
    _TabConfig(icon: Icons.chat_bubble_outline, label: 'Chat', path: '/chat'),
    _TabConfig(icon: Icons.auto_awesome_outlined, label: 'Esencias', path: '/explore'),
    _TabConfig(icon: Icons.person_outline, label: 'Perfil', path: '/profile'),
  ];

  static const _extraRoutes = [
    _ExtraRoute(icon: Icons.place_outlined, label: 'Venues', path: '/venues',
        description: 'Lugares seguros y accesibles cerca de ti'),
    _ExtraRoute(icon: Icons.people_outline, label: 'Body Doubling', path: '/body-doubling',
        description: 'Sesiones de foco compartido'),
    _ExtraRoute(icon: Icons.handshake_outlined, label: 'Meetups', path: '/meetups',
        description: 'Encuentros presenciales con matches'),
    _ExtraRoute(icon: Icons.notifications_outlined, label: 'Notificaciones',
        path: '/notifications', description: 'Tus alertas y mensajes del sistema'),
    _ExtraRoute(icon: Icons.settings_outlined, label: 'Configuración',
        path: '/settings', description: 'Privacidad, bloqueos y preferencias'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentPath = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexWhere((t) => currentPath.startsWith(t.path));
    final unread = context.watch<NotificationsProvider>().unreadCount;

    return Scaffold(
      appBar: _buildAppBar(context, theme, unread),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex >= 0 ? currentIndex : 0,
        onDestinationSelected: (index) => context.go(_tabs[index].path),
        backgroundColor: theme.colorScheme.surface,
        indicatorColor: theme.colorScheme.primary.withValues(alpha: 0.15),
        destinations: _tabs
            .map((tab) => NavigationDestination(
                  icon: Icon(tab.icon),
                  selectedIcon: Icon(tab.icon, color: theme.colorScheme.primary),
                  label: tab.label,
                ))
            .toList(),
      ),
    );
  }

  PreferredSizeWidget? _buildAppBar(
      BuildContext context, ThemeData theme, int unread) {
    // Solo mostrar AppBar con botón Más en rutas que no tienen su propio AppBar
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false,
      actions: [
        // Notificaciones con badge
        IconButton(
          icon: Badge(
            isLabelVisible: unread > 0,
            label: Text(unread > 9 ? '9+' : '$unread'),
            child: const Icon(Icons.notifications_outlined),
          ),
          tooltip: 'Notificaciones',
          onPressed: () => context.push('/notifications'),
        ),
        // Menú Más
        IconButton(
          icon: const Icon(Icons.apps_rounded),
          tooltip: 'Más',
          onPressed: () => _showMoreSheet(context, theme),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  void _showMoreSheet(BuildContext context, ThemeData theme) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('Comunidad', style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            )),
            const SizedBox(height: 16),
            ..._extraRoutes.map((route) => _ExtraRouteTile(
                  route: route,
                  onTap: () {
                    Navigator.pop(ctx);
                    context.push(route.path);
                  },
                  theme: theme,
                )),
          ],
        ),
      ),
    );
  }
}

class _ExtraRouteTile extends StatelessWidget {
  final _ExtraRoute route;
  final VoidCallback onTap;
  final ThemeData theme;

  const _ExtraRouteTile({
    required this.route,
    required this.onTap,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: theme.colorScheme.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(route.icon, color: theme.colorScheme.primary),
      ),
      title: Text(route.label,
          style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(route.description,
          style: TextStyle(
            fontSize: 12,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
          )),
      trailing: Icon(Icons.chevron_right,
          color: theme.colorScheme.onSurface.withValues(alpha: 0.3)),
      onTap: onTap,
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

class _ExtraRoute {
  final IconData icon;
  final String label;
  final String path;
  final String description;

  const _ExtraRoute({
    required this.icon,
    required this.label,
    required this.path,
    required this.description,
  });
}
