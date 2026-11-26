import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/design/design_tokens.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/services/media_service.dart';
import '../../core/widgets/profile_section_widgets.dart';
import 'media_provider.dart';
import 'profile_provider.dart';
import 'widgets/photo_gallery.dart';

/// Pantalla de perfil del usuario — ver y editar datos completos.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _allDiagnoses = [
    'TEA',
    'TDAH',
    'AACC',
    'DISLEXIA',
    'AUTOIDENTIFIED',
    'OTHER',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<ProfileProvider>();
      provider.loadProfile();
      provider.loadDiagnoses();
      provider.loadSpinTags();
      context.read<MediaProvider>().loadPhotos();
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
            icon: Icon(PhosphorIcons.pencilSimple(PhosphorIconsStyle.bold)),
            tooltip: 'Editar perfil',
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
                        onPressed: () {
                          profileProvider.loadProfile();
                          profileProvider.loadDiagnoses();
                          profileProvider.loadSpinTags();
                          context.read<MediaProvider>().loadPhotos();
                        },
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await Future.wait([
                      profileProvider.loadProfile(),
                      profileProvider.loadDiagnoses(),
                      profileProvider.loadSpinTags(),
                      context.read<MediaProvider>().loadPhotos(),
                    ]);
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(DesignTokens.spaceLG),
                    children: [
                      // Avatar con botón editar
                      Center(
                        child: _AvatarWithEdit(
                          profile: profile,
                          theme: theme,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Nombre + @username
                      Center(
                        child: Text(
                          profile.displayName ?? 'Sin nombre',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (profile.username != null) ...[
                        const SizedBox(height: 4),
                        Center(
                          child: Text(
                            '@${profile.username}',
                            style: TextStyle(
                              fontSize: 15,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.55),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Sobre mí / Descripción
                      _SectionCard(
                        title: 'Sobre mí',
                        icon: PhosphorIcons.quotes(PhosphorIconsStyle.regular),
                        theme: theme,
                        actionLabel: 'Editar',
                        onAction: () => _showEditSheet(context, profileProvider),
                        child: Text(
                          (profile.msnStatus != null &&
                                  profile.msnStatus!.trim().isNotEmpty)
                              ? profile.msnStatus!
                              : 'Cuéntales a otros sobre ti, tus intereses o cómo prefieres comunicarte...',
                          style: TextStyle(
                            fontSize: 14,
                            height: 1.45,
                            fontStyle: (profile.msnStatus == null ||
                                    profile.msnStatus!.trim().isEmpty)
                                ? FontStyle.italic
                                : FontStyle.normal,
                            color: (profile.msnStatus == null ||
                                    profile.msnStatus!.trim().isEmpty)
                                ? theme.colorScheme.onSurface
                                    .withValues(alpha: 0.45)
                                : theme.colorScheme.onSurface
                                    .withValues(alpha: 0.85),
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Galería de fotos
                      _SectionCard(
                        title: 'Galería',
                        icon: PhosphorIcons.imagesSquare(
                            PhosphorIconsStyle.regular),
                        theme: theme,
                        child: const PhotoGallery(),
                      ),

                      const SizedBox(height: 16),

                      // Neurodivergencia (editable, componente compartido)
                      ProfileDiagnosesSection(
                        diagnoses: profileProvider.diagnoses
                            .map((d) => ProfileDiagnosisBadgeData(
                                  code: d.diagnosis,
                                  isPrimary: d.isPrimary,
                                ))
                            .toList(),
                        emptyText:
                            'Toca Editar para agregar tus diagnósticos',
                        actionLabel: 'Editar',
                        onAction: () =>
                            _showDiagnosesSheet(context, profileProvider),
                      ),

                      const SizedBox(height: 16),

                      // Intereses Especiales (SpIn) (componente compartido)
                      ProfileSpinSection(
                        tags: profileProvider.spinTags,
                      ),

                      const SizedBox(height: 16),

                      // Información
                      ProfileSectionCard(
                        title: 'Información',
                        icon: PhosphorIcons.info(PhosphorIconsStyle.regular),
                        actionLabel: 'Editar',
                        onAction: () => _showEditSheet(context, profileProvider),
                        child: Column(
                          children: [
                            _InfoRow('Email', profile.email, theme),
                            _InfoRow('Género', _genderLabel(profile.gender),
                                theme),
                            _InfoRow('Energía',
                                _energyLabel(profile.energyLevel), theme),
                            _InfoRow('Notificaciones',
                                _notifLabel(profile.notifLevel), theme),
                          ],
                        ),
                      ),

                      const SizedBox(height: 28),

                      // Cerrar sesión
                      OutlinedButton.icon(
                        onPressed: () =>
                            context.read<AuthProvider>().signOut(),
                        icon: Icon(
                            PhosphorIcons.signOut(PhosphorIconsStyle.regular)),
                        label: const Text('Cerrar sesión'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.colorScheme.error,
                          side: BorderSide(color: theme.colorScheme.error),
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
    var selectedEnergy = profile.energyLevel.clamp(1, 3);
    var selectedGender = profile.gender;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final theme = Theme.of(ctx);
            return SingleChildScrollView(
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
                  Text('Editar perfil', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: usernameCtrl,
                    decoration: const InputDecoration(labelText: 'Username'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: statusCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Descripción / Sobre mí',
                      hintText: 'Cuenta sobre ti, intereses o cómo prefieres conversar...',
                    ),
                    maxLines: 3,
                    maxLength: 160,
                  ),
                  const SizedBox(height: 12),
                  Text('Nivel de energía hoy',
                      style: theme.textTheme.labelLarge),
                  const SizedBox(height: 8),
                  SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 1, label: Text('Baja')),
                      ButtonSegment(value: 2, label: Text('Media')),
                      ButtonSegment(value: 3, label: Text('Alta')),
                    ],
                    selected: {selectedEnergy},
                    onSelectionChanged: (v) =>
                        setModalState(() => selectedEnergy = v.first),
                  ),
                  const SizedBox(height: 14),
                  Text('Género', style: theme.textTheme.labelLarge),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Mujer'),
                        selected: selectedGender == 'female',
                        onSelected: (_) =>
                            setModalState(() => selectedGender = 'female'),
                      ),
                      ChoiceChip(
                        label: const Text('Hombre'),
                        selected: selectedGender == 'male',
                        onSelected: (_) =>
                            setModalState(() => selectedGender = 'male'),
                      ),
                      ChoiceChip(
                        label: const Text('Otro'),
                        selected: selectedGender == 'other',
                        onSelected: (_) =>
                            setModalState(() => selectedGender = 'other'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: provider.isSaving
                        ? null
                        : () async {
                            final result = await provider.updateProfile(
                              displayName: nameCtrl.text.trim(),
                              username: usernameCtrl.text.trim(),
                              msnStatus: statusCtrl.text.trim(),
                              energyLevel: selectedEnergy,
                              gender: selectedGender,
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
      },
    );
  }

  void _showDiagnosesSheet(BuildContext context, ProfileProvider provider) {
    final selected =
        provider.diagnoses.map((d) => d.diagnosis).toSet();
    var primary = provider.primaryDiagnosis ??
        (selected.isNotEmpty ? selected.first : 'TEA');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
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
                  Text('Editar diagnósticos',
                      style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Selecciona uno o más. El primero o marcado con ★ será el principal.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _allDiagnoses.map((diag) {
                      final isSelected = selected.contains(diag);
                      return FilterChip(
                        label: Text(diag),
                        selected: isSelected,
                        onSelected: (val) {
                          setModalState(() {
                            if (val) {
                              selected.add(diag);
                              if (selected.length == 1) primary = diag;
                            } else if (selected.length > 1) {
                              selected.remove(diag);
                              if (primary == diag) primary = selected.first;
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  if (selected.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Diagnóstico principal',
                        style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: selected.map((diag) {
                        return ChoiceChip(
                          label: Text('$diag ★'),
                          selected: primary == diag,
                          onSelected: (_) =>
                              setModalState(() => primary = diag),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: selected.isEmpty || provider.isSaving
                        ? null
                        : () async {
                            final ok = await provider.updateDiagnoses(
                              selected.toList(),
                              primary,
                            );
                            if (ok && ctx.mounted) Navigator.pop(ctx);
                          },
                    child: const Text('Guardar diagnósticos'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _genderLabel(String? gender) {
    switch (gender) {
      case 'female':
        return 'Mujer';
      case 'male':
        return 'Hombre';
      case 'other':
        return 'Otro';
      default:
        return 'Sin especificar';
    }
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
  final String? actionLabel;
  final VoidCallback? onAction;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.theme,
    required this.child,
    this.actionLabel,
    this.onAction,
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
                Icon(icon, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 16)),
                ),
                if (actionLabel != null && onAction != null)
                  TextButton(
                    onPressed: onAction,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: const Size(0, 32),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(actionLabel!),
                  ),
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

class _AvatarWithEdit extends StatelessWidget {
  final dynamic profile;
  final ThemeData theme;

  const _AvatarWithEdit({required this.profile, required this.theme});

  @override
  Widget build(BuildContext context) {
    final media = context.watch<MediaProvider>();
    final avatarUrl = media.avatarUrl ?? profile.avatarUrl;

    return Stack(
      children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.2),
          backgroundImage:
              avatarUrl != null ? NetworkImage(avatarUrl) : null,
          child: avatarUrl == null
              ? Text(
                  profile.initials,
                  style: TextStyle(
                    fontSize: 36,
                    color: theme.colorScheme.primary,
                  ),
                )
              : null,
        ),
        if (media.isUploading)
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black38,
              ),
              child: const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          bottom: 0,
          right: 0,
          child: Material(
            color: theme.colorScheme.primary,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _showAvatarSheet(context, media),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(PhosphorIcons.camera(PhosphorIconsStyle.fill),
                    size: 16, color: theme.colorScheme.onPrimary),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showAvatarSheet(BuildContext context, MediaProvider media) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(
                  PhosphorIcons.imagesSquare(PhosphorIconsStyle.regular)),
              title: const Text('Elegir de galería'),
              onTap: () {
                Navigator.pop(ctx);
                media.pickAndUploadAvatar(source: ImageSourceType.gallery);
              },
            ),
            ListTile(
              leading: Icon(PhosphorIcons.camera(PhosphorIconsStyle.regular)),
              title: const Text('Tomar foto'),
              onTap: () {
                Navigator.pop(ctx);
                media.pickAndUploadAvatar(source: ImageSourceType.camera);
              },
            ),
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
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
