import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Modelo ligero compartido para mostrar un diagnóstico en cualquier vista.
class ProfileDiagnosisBadgeData {
  final String code;
  final bool isPrimary;

  const ProfileDiagnosisBadgeData({
    required this.code,
    this.isPrimary = false,
  });
}

/// Contenedor de sección compartido entre Perfil propio, Perfil público y Feed.
/// Modificar este widget actualiza el diseño de secciones en toda la app.
class ProfileSectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  const ProfileSectionCard({
    super.key,
    required this.title,
    required this.icon,
    required this.child,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final header = Row(
      children: [
        Icon(icon, size: compact ? 16 : 20, color: theme.colorScheme.primary),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: compact ? 13 : 16,
            ),
          ),
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
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          const SizedBox(height: 6),
          child,
        ],
      );
    }

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            header,
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

/// Sección compartida de Neurodivergencia (título + icono + chips).
class ProfileDiagnosesSection extends StatelessWidget {
  final List<ProfileDiagnosisBadgeData> diagnoses;
  final String? emptyText;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  const ProfileDiagnosesSection({
    super.key,
    required this.diagnoses,
    this.emptyText,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ProfileSectionCard(
      title: 'Neurodivergencia',
      icon: PhosphorIcons.brain(PhosphorIconsStyle.fill),
      actionLabel: actionLabel,
      onAction: onAction,
      compact: compact,
      child: diagnoses.isEmpty
          ? Text(
              emptyText ?? 'Sin neurodivergencias declaradas',
              style: TextStyle(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.45),
              ),
            )
          : Wrap(
              spacing: compact ? 6 : 8,
              runSpacing: compact ? 4 : 8,
              children: diagnoses
                  .map(
                    (d) => Chip(
                      label: Text(
                        d.isPrimary ? '${d.code} ★' : d.code,
                        style: compact ? const TextStyle(fontSize: 11) : null,
                      ),
                      materialTapTargetSize: compact
                          ? MaterialTapTargetSize.shrinkWrap
                          : null,
                      visualDensity:
                          compact ? VisualDensity.compact : VisualDensity.standard,
                      backgroundColor: d.isPrimary
                          ? theme.colorScheme.primary.withValues(alpha: 0.18)
                          : null,
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

/// Sección compartida de Intereses especiales (SpIn) (título + icono + chips).
class ProfileSpinSection extends StatelessWidget {
  final List<String> tags;
  final String? emptyText;
  final bool compact;
  final int? maxTags;

  const ProfileSpinSection({
    super.key,
    required this.tags,
    this.emptyText,
    this.compact = false,
    this.maxTags,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visibleTags =
        maxTags != null ? tags.take(maxTags!).toList() : tags;

    return ProfileSectionCard(
      title: 'Intereses especiales (SpIn)',
      icon: PhosphorIcons.sparkle(PhosphorIconsStyle.fill),
      compact: compact,
      child: visibleTags.isEmpty
          ? Text(
              emptyText ?? 'Aún no tienes intereses guardados',
              style: TextStyle(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.45),
              ),
            )
          : Wrap(
              spacing: compact ? 6 : 8,
              runSpacing: compact ? 4 : 8,
              children: visibleTags
                  .map(
                    (tag) => Chip(
                      label: Text(
                        tag,
                        style: compact ? const TextStyle(fontSize: 11) : null,
                      ),
                      materialTapTargetSize: compact
                          ? MaterialTapTargetSize.shrinkWrap
                          : null,
                      visualDensity:
                          compact ? VisualDensity.compact : VisualDensity.standard,
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

