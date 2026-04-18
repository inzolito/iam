import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import 'settings_provider.dart';

/// Pantalla de Configuración / Ajustes.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<SettingsProvider>();
      provider.loadPreferences();
      provider.loadBlocks();
      provider.loadReports();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configuración'),
      ),
      body: Consumer<SettingsProvider>(
        builder: (context, provider, _) {
          return ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              _SectionHeader(label: 'Notificaciones', theme: theme),
              SwitchListTile(
                title: const Text('Notificaciones push'),
                subtitle: const Text('Alertas en tiempo real'),
                value: provider.preferences.pushEnabled,
                onChanged: (_) => provider.togglePush(),
                secondary: const Icon(Icons.notifications_outlined),
              ),
              SwitchListTile(
                title: const Text('Notificaciones por email'),
                subtitle: const Text('Resúmenes diarios'),
                value: provider.preferences.emailEnabled,
                onChanged: (_) => provider.toggleEmail(),
                secondary: const Icon(Icons.email_outlined),
              ),

              _SectionHeader(label: 'Privacidad', theme: theme),
              SwitchListTile(
                title: const Text('Aparecer en el feed'),
                subtitle: const Text(
                    'Si lo desactivas, nadie nuevo podrá encontrarte'),
                value: provider.preferences.showInFeed,
                onChanged: (_) => provider.toggleShowInFeed(),
                secondary: const Icon(Icons.visibility_outlined),
              ),
              SwitchListTile(
                title: const Text('Compartir ubicación'),
                subtitle:
                    const Text('Necesario para venues y meetups cercanos'),
                value: provider.preferences.shareLocation,
                onChanged: (_) => provider.toggleShareLocation(),
                secondary: const Icon(Icons.location_on_outlined),
              ),

              _SectionHeader(label: 'Moderación', theme: theme),
              ListTile(
                leading: const Icon(Icons.block),
                title: const Text('Usuarios bloqueados'),
                subtitle: Text('${provider.blocks.length} usuario(s)'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showBlocksSheet(context, provider),
              ),
              ListTile(
                leading: const Icon(Icons.report_outlined),
                title: const Text('Mis reportes'),
                subtitle: Text('${provider.reports.length} reporte(s)'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showReportsSheet(context, provider),
              ),

              _SectionHeader(label: 'Cuenta', theme: theme),
              ListTile(
                leading: Icon(Icons.logout, color: theme.colorScheme.primary),
                title: const Text('Cerrar sesión'),
                onTap: () => _confirmLogout(context),
              ),
              ListTile(
                leading: Icon(Icons.delete_forever,
                    color: theme.colorScheme.error),
                title: Text(
                  'Eliminar cuenta',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
                subtitle: const Text('Acción irreversible'),
                onTap: () => _confirmAccountDeletion(context, provider),
              ),

              const SizedBox(height: 16),
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'IAM v1.0.0',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showBlocksSheet(BuildContext context, SettingsProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollController) {
          return Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Usuarios bloqueados',
                style: Theme.of(ctx).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Consumer<SettingsProvider>(
                  builder: (context, p, _) {
                    if (p.blocks.isEmpty) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text(
                            'No has bloqueado a nadie',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      );
                    }
                    return ListView.builder(
                      controller: scrollController,
                      itemCount: p.blocks.length,
                      itemBuilder: (_, i) {
                        final b = p.blocks[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundImage: b.photoUrl != null
                                ? NetworkImage(b.photoUrl!)
                                : null,
                            child: b.photoUrl == null
                                ? Text(b.displayName[0].toUpperCase())
                                : null,
                          ),
                          title: Text(b.displayName),
                          subtitle: Text(
                              'Bloqueado el ${b.blockedAt.day}/${b.blockedAt.month}/${b.blockedAt.year}'),
                          trailing: TextButton(
                            onPressed: () => p.unblockUser(b.userId),
                            child: const Text('Desbloquear'),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showReportsSheet(BuildContext context, SettingsProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollController) {
          return Consumer<SettingsProvider>(
            builder: (context, p, _) {
              return Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Mis reportes',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: p.reports.isEmpty
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.all(32),
                              child: Text(
                                'No has enviado ningún reporte',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          )
                        : ListView.builder(
                            controller: scrollController,
                            itemCount: p.reports.length,
                            itemBuilder: (_, i) {
                              final r = p.reports[i];
                              return ListTile(
                                leading: Icon(
                                  _statusIcon(r.status),
                                  color: _statusColor(r.status),
                                ),
                                title: Text(r.reason),
                                subtitle: Text(
                                    '${_statusLabel(r.status)} · ${r.createdAt.day}/${r.createdAt.month}/${r.createdAt.year}'),
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Cerrar sesión?'),
        content: const Text('Tendrás que volver a iniciar sesión.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<AuthProvider>().signOut();
      if (context.mounted) context.go('/login');
    }
  }

  Future<void> _confirmAccountDeletion(
      BuildContext context, SettingsProvider provider) async {
    final theme = Theme.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('¿Eliminar cuenta?',
            style: TextStyle(color: theme.colorScheme.error)),
        content: const Text(
          'Esta acción es irreversible. Se eliminarán tus datos, matches, '
          'mensajes y Esencias después del período de gracia.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: theme.colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      final success = await provider.requestAccountDeletion();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success
                  ? 'Solicitud enviada. Recibirás un email de confirmación.'
                  : 'No se pudo procesar la solicitud.',
            ),
          ),
        );
      }
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'resolved':
        return Icons.check_circle_outline;
      case 'dismissed':
        return Icons.cancel_outlined;
      default:
        return Icons.pending_outlined;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
        return Colors.green;
      case 'dismissed':
        return Colors.grey;
      default:
        return Colors.orange;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'resolved':
        return 'Resuelto';
      case 'dismissed':
        return 'Desestimado';
      default:
        return 'Pendiente';
    }
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  final ThemeData theme;

  const _SectionHeader({required this.label, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Text(
        label.toUpperCase(),
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.primary,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}
