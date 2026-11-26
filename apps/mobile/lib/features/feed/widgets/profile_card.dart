import 'package:flutter/material.dart';

import '../../../core/widgets/profile_section_widgets.dart';
import '../feed_profile.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Card de perfil en el feed — muestra info del usuario.
class ProfileCard extends StatelessWidget {
  final FeedProfile profile;
  final VoidCallback onLike;
  final VoidCallback onPass;
  final VoidCallback? onReport;

  const ProfileCard({
    super.key,
    required this.profile,
    required this.onLike,
    required this.onPass,
    this.onReport,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Semantics(
      label: 'Perfil de ${profile.displayName}',
      container: true,
      child: Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Avatar / imagen
          Expanded(
            flex: 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Foto o placeholder
                if (profile.avatarUrl != null)
                  Image.network(
                    profile.avatarUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _AvatarPlaceholder(
                      name: profile.displayName,
                      theme: theme,
                    ),
                  )
                else
                  _AvatarPlaceholder(
                    name: profile.displayName,
                    theme: theme,
                  ),

                // Gradiente inferior
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 120,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.7),
                        ],
                      ),
                    ),
                  ),
                ),

                // Nombre y distancia
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.displayName ?? 'Usuario',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.45),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  PhosphorIcons.mapPin(PhosphorIconsStyle.fill),
                                  size: 14,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'A ${profile.formattedDistance} de ti',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Icon(PhosphorIcons.heart(PhosphorIconsStyle.fill),
                              size: 14,
                              color: Colors.white.withValues(alpha: 0.9)),
                          const SizedBox(width: 4),
                          Text(
                            profile.compatibilityPercent,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Botón de report/más opciones
                if (onReport != null)
                  Positioned(
                    top: 12,
                    right: 12,
                    child: IconButton(
                      icon: Icon(PhosphorIcons.dotsThreeVertical(PhosphorIconsStyle.bold), color: Colors.white),
                      tooltip: 'Más opciones',
                      onPressed: onReport,
                    ),
                  ),
              ],
            ),
          ),

          // MSN status + Neurodivergencia + SpIn tags
          Expanded(
            flex: 1,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (profile.msnStatus != null) ...[
                    Text(
                      profile.msnStatus!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.7),
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (profile.diagnoses.isNotEmpty) ...[
                    ProfileDiagnosesSection(
                      compact: true,
                      diagnoses: profile.diagnoses
                          .map((d) => ProfileDiagnosisBadgeData(code: d))
                          .toList(),
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (profile.spin.isNotEmpty)
                    ProfileSpinSection(
                      compact: true,
                      tags: profile.spin,
                      maxTags: 5,
                    ),
                ],
              ),
            ),
          ),

          // Botones de acción
          Padding(
            padding: const EdgeInsets.only(bottom: 16, left: 24, right: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Pass
                _ActionButton(
                  icon: PhosphorIcons.x(PhosphorIconsStyle.bold),
                  color: Colors.red.shade300,
                  onPressed: onPass,
                  size: 56,
                  semanticLabel: 'Rechazar perfil',
                ),
                // Like
                _ActionButton(
                  icon: PhosphorIcons.heart(PhosphorIconsStyle.fill),
                  color: theme.colorScheme.primary,
                  onPressed: onLike,
                  size: 64,
                  semanticLabel: 'Me gusta',
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }
}

class _AvatarPlaceholder extends StatelessWidget {
  final String? name;
  final ThemeData theme;

  const _AvatarPlaceholder({this.name, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: theme.colorScheme.primary.withValues(alpha: 0.2),
      child: Center(
        child: Text(
          (name ?? '?')[0].toUpperCase(),
          style: TextStyle(
            fontSize: 80,
            fontWeight: FontWeight.w300,
            color: theme.colorScheme.primary,
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;
  final double size;
  final String? semanticLabel;

  const _ActionButton({
    required this.icon,
    required this.color,
    required this.onPressed,
    required this.size,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          shape: const CircleBorder(),
          padding: EdgeInsets.zero,
          backgroundColor: color.withValues(alpha: 0.15),
          foregroundColor: color,
          elevation: 0,
        ),
        child: Icon(icon, size: size * 0.45, semanticLabel: semanticLabel),
      ),
    );
  }
}
