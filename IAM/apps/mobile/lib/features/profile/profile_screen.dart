import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import 'profile_provider.dart';

/// Pantalla de perfil del usuario — ver y editar datos.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<ProfileProvider>();
      provider.loadProfile();
      provider.loadDiagnoses();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profileProvider = context.watch<ProfileProvider>();
    final profile = profileProvider.profile;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: profile != null
                ? () => _showEditSheet(context, profileProvider)
                : null,
          ),
        ],
      ),
      body: profileProvider.isLoading && profile == null
          ? const Center(child: CircularProgressIndicator())
          : profile == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        profileProvider.error ?? 'Error cargando perfil',
                        style: TextStyle(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.5)),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => profileProvider.loadProfile(),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await profileProvider.loadProfile();
                    await profileProvider.loadDiagnoses();
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      // Avatar
                      Center(
                        child: CircleAvatar(
                          radius: 48,
                          backgroundColor: theme.colorScheme.primary
                              .withValues(alpha: 0.2),
                          backgroundImage: profile.avatarUrl != null
                              ? NetworkImage(profile.avatarUrl!)
                              : null,
                          child: profile.avatarUrl == null
                              ? Text(
                                  profile.initials,
                                  style: TextStyle(
                                    fontSize: 36,
                                    color: theme.colorScheme.primary,
                                  ),
                                )
                              : null,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Nombre
                      Center(
                        child: Text(
                          profile.displayName ?? 'Sin nombre',
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                      ),
                      if (profile.username != null) ...[
                        const SizedBox(height: 4),
                        Center(
                          child: Text(
                            '@${profile.username}',
                            style: TextStyle(
                              fontSize: 16,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5),
                            ),
                          ),
                        ),
                      ],

                      // MSN Status
                      if (profile.msnStatus != null &&
                          profile.msnStatus!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Center(
                          child: Text(
                            profile.msnStatus!,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontStyle: FontStyle.italic,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 32),

                      // Diagnósticos
                      _SectionCard(
                        title: 'Diagnósticos',
                        icon: Icons.psychology,
                        theme: theme,
                        child: Wrap(
                          spacing: 8,
                          children: profileProvider.diagnoses.isEmpty
                              ? [
                                  Text('Sin diagnóstico',
                                      style: TextStyle(
                                          color: theme.colorScheme.onSurface
                                              .withValues(alpha: 0.4)))
                                ]
                              : profileProvider.diagnoses
                                  .map((d) => Chip(
                                        label: Text(d.diagnosis),
                                        backgroundColor: d.isPrimary
                                            ? theme.colorScheme.primary
                                                .withValues(alpha: 0.2)
                                            : null,
                                      ))
                                  .toList(),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Info
                      _SectionCard(
                        title: 'Información',
                        icon: Icons.info_outline,
                        theme: theme,
                        child: Column(
                          children: [
                            _InfoRow('Email', profile.email, theme),
                            _InfoRow('Energía',
                                _energyLabel(profile.energyLevel), theme),
                            _InfoRow('Notificaciones',
                                _notifLabel(profile.notifLevel), theme),
                          ],
                        ),
                      ),

                      const SizedBox(height: 32),

                      // Cerrar sesión
                      OutlinedButton.icon(
                        onPressed: () =>
                            context.read<AuthProvider>().signOut(),
                        icon: const Icon(Icons.logout),
                        label: const Text('Cerrar sesión'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.colorScheme.error,
                          side:
                              BorderSide(color: theme.colorScheme.error),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  void _showEditSheet(BuildContext context, ProfileProvider provider) {
    final profile = provider.profile!;
    final nameCtrl = TextEditingController(text: profile.displayName ?? '');
    final usernameCtrl = TextEditingController(text: profile.username ?? '');
    final statusCtrl = TextEditingController(text: profile.msnStatus ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final theme = Theme.of(ctx);
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Editar perfil',
                  style: theme.textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration:
                    const InputDecoration(labelText: 'Nombre'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: usernameCtrl,
                decoration:
                    const InputDecoration(labelText: 'Username'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: statusCtrl,
                decoration: const InputDecoration(
                    labelText: 'Estado MSN', hintText: 'Escuchando...'),
                maxLength: 160,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  final result = await provider.updateProfile(
                    displayName: nameCtrl.text.trim(),
                    username: usernameCtrl.text.trim(),
                    msnStatus: statusCtrl.text.trim(),
                  );
                  if (result && ctx.mounted) {
                    Navigator.pop(ctx);
                  }
                },
                child: const Text('Guardar'),
              ),
            ],
          ),
        );
      },
    );
  }

  String _energyLabel(int level) {
    switch (level) {
      case 1:
        return 'Baja';
      case 2:
        return 'Media';
      case 3:
        return 'Alta';
      default:
        return 'N/A';
    }
  }

  String _notifLabel(int level) {
    switch (level) {
      case 1:
        return 'Mínimas';
      case 2:
        return 'Normal';
      case 3:
        return 'Todas';
      default:
        return 'N/A';
    }
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final ThemeData theme;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.theme,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon,
                    size: 20,
                    color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final ThemeData theme;

  const _InfoRow(this.label, this.value, this.theme);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  color: theme.colorScheme.onSurface
                      .withValues(alpha: 0.6))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
