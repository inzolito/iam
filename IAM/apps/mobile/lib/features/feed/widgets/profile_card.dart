import 'package:flutter/material.dart';

import '../feed_profile.dart';

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

    return Card(
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
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on,
                              size: 14,
                              color: Colors.white.withValues(alpha: 0.8)),
                          const SizedBox(width: 4),
                          Text(
                            profile.formattedDistance,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Icon(Icons.favorite,
                              size: 14,
                              color: Colors.white.withValues(alpha: 0.8)),
                          const SizedBox(width: 4),
                          Text(
                            profile.compatibilityPercent,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 14,
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
                      icon: const Icon(Icons.more_vert, color: Colors.white),
                      onPressed: onReport,
                    ),
                  ),
              ],
            ),
          ),

          // MSN status + SpIn tags
          Expanded(
            flex: 1,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                  if (profile.spin.isNotEmpty)
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: profile.spin
                            .take(5)
                            .map((tag) => Chip(
                                  label: Text(tag,
                                      style: const TextStyle(fontSize: 11)),
                                  materialTapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                  backgroundColor: theme.colorScheme.primary
                                      .withValues(alpha: 0.1),
                                ))
                            .toList(),
                      ),
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
                  icon: Icons.close,
                  color: Colors.red.shade300,
                  onPressed: onPass,
                  size: 56,
                ),
                // Like
                _ActionButton(
                  icon: Icons.favorite,
                  color: theme.colorScheme.primary,
                  onPressed: onLike,
                  size: 64,
                ),
              ],
            ),
          ),
        ],
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

  const _ActionButton({
    required this.icon,
    required this.color,
    required this.onPressed,
    required this.size,
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
        child: Icon(icon, size: size * 0.45),
      ),
    );
  }
}
