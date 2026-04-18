import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'notifications_provider.dart';

/// Pantalla de notificaciones del usuario.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = context.watch<NotificationsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (provider.unreadCount > 0)
            TextButton(
              onPressed: () => provider.markAllAsRead(),
              child: const Text('Marcar todo'),
            ),
        ],
      ),
      body: provider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : provider.error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(provider.error!,
                          style:
                              TextStyle(color: theme.colorScheme.error)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => provider.loadNotifications(),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : provider.notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.notifications_none,
                              size: 64,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.3)),
                          const SizedBox(height: 16),
                          Text(
                            'Sin notificaciones',
                            style: TextStyle(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => provider.loadNotifications(),
                      child: ListView.separated(
                        itemCount: provider.notifications.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1),
                        itemBuilder: (ctx, i) => _NotifTile(
                          notif: provider.notifications[i],
                          onTap: () => provider
                              .markAsRead(provider.notifications[i].id),
                        ),
                      ),
                    ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final AppNotification notif;
  final VoidCallback onTap;

  const _NotifTile({required this.notif, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
            backgroundColor:
                theme.colorScheme.primary.withValues(alpha: 0.1),
            child: Icon(
              _iconForType(notif.type),
              color: theme.colorScheme.primary,
              size: 20,
            ),
          ),
          if (!notif.isRead)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
      title: Text(
        notif.title,
        style: TextStyle(
          fontWeight: notif.isRead ? FontWeight.normal : FontWeight.bold,
        ),
      ),
      subtitle: notif.body != null
          ? Text(notif.body!,
              maxLines: 2, overflow: TextOverflow.ellipsis)
          : null,
      trailing: Text(
        notif.typeLabel,
        style: TextStyle(
          fontSize: 11,
          color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
        ),
      ),
      tileColor: notif.isRead
          ? null
          : theme.colorScheme.primary.withValues(alpha: 0.04),
      onTap: onTap,
    );
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'match':
        return Icons.favorite;
      case 'message':
        return Icons.chat_bubble;
      case 'meetup':
        return Icons.handshake;
      case 'esencias':
        return Icons.auto_awesome;
      case 'system':
        return Icons.info;
      default:
        return Icons.notifications;
    }
  }
}
