import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/api_service.dart';
import '../../core/services/location_service.dart';
import 'feed_provider.dart';
import 'widgets/profile_card.dart';
import 'widgets/match_dialog.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Pantalla principal del feed — descubrir perfiles y hacer swipe.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  String? _locationMessage;
  bool _syncingLocation = false;
  bool _matchDialogShowing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final feed = context.read<FeedProvider>();
      if (feed.profiles.isEmpty) {
        _syncLocationAndLoad();
      }
    });
  }

  /// Pide ubicación y sincroniza con el backend antes de cargar el feed.
  Future<void> _syncLocationAndLoad() async {
    setState(() {
      _syncingLocation = true;
      _locationMessage = null;
    });

    final locationService = LocationService(api: context.read<ApiService>());
    final result = await locationService.syncLocation();

    if (!mounted) return;

    if (result == LocationSyncResult.ok) {
      setState(() => _syncingLocation = false);
      await context.read<FeedProvider>().loadFeed();
      return;
    }

    // Mensajes según el motivo del fallo
    String msg;
    switch (result) {
      case LocationSyncResult.serviceDisabled:
        msg = 'Activa el GPS de tu dispositivo para usar el feed.';
        break;
      case LocationSyncResult.permissionDenied:
        msg = 'Necesitamos tu ubicación para mostrarte personas cerca.';
        break;
      case LocationSyncResult.permissionDeniedForever:
        msg =
            'Permiso de ubicación bloqueado. Actívalo en Ajustes de la app.';
        break;
      default:
        msg = 'No pudimos obtener tu ubicación. Intenta de nuevo.';
    }
    setState(() {
      _syncingLocation = false;
      _locationMessage = msg;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final feed = context.watch<FeedProvider>();

    // Mostrar dialog de match si hay uno (una sola vez)
    if (feed.lastMatch != null && !_matchDialogShowing) {
      _matchDialogShowing = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showMatchDialog(context, feed);
      });
    }

    return _buildBody(context, feed, theme);
  }

  Widget _buildBody(BuildContext context, FeedProvider feed, ThemeData theme) {
    // Sincronizando ubicación
    if (_syncingLocation) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Obteniendo tu ubicación...'),
          ],
        ),
      );
    }

    // Ubicación no disponible / permiso denegado
    if (_locationMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(PhosphorIcons.mapPinLine(PhosphorIconsStyle.regular),
                  size: 64,
                  color: theme.colorScheme.primary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'Ubicación requerida',
                style: TextStyle(
                  fontSize: 18,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _locationMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _syncLocationAndLoad,
                icon: Icon(PhosphorIcons.crosshair(PhosphorIconsStyle.bold)),
                label: const Text('Activar ubicación'),
              ),
            ],
          ),
        ),
      );
    }

    // Loading inicial
    if (feed.isLoading && feed.profiles.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    // Error
    if (feed.error != null && feed.profiles.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(PhosphorIcons.wifiSlash(PhosphorIconsStyle.regular),
                  size: 64,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.3)),
              const SizedBox(height: 16),
              Text(
                'No se pudo cargar el feed',
                style: TextStyle(
                  fontSize: 18,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                feed.error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => feed.loadFeed(),
                icon: Icon(PhosphorIcons.arrowClockwise(PhosphorIconsStyle.bold)),
                label: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
    }

    // Feed vacío o agotado
    if (feed.isEmpty || feed.isExhausted) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(PhosphorIcons.compass(PhosphorIconsStyle.regular),
                  size: 64,
                  color: theme.colorScheme.primary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No hay mas perfiles',
                style: TextStyle(
                  fontSize: 18,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Vuelve luego para descubrir nuevas personas',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => feed.loadFeed(),
                icon: Icon(PhosphorIcons.arrowClockwise(PhosphorIconsStyle.bold)),
                label: const Text('Actualizar'),
              ),
              if (feed.filters.hasActiveFilters) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => feed.clearFilters(),
                  icon: Icon(PhosphorIcons.funnelSimpleX(PhosphorIconsStyle.regular)),
                  label: const Text('Limpiar filtros'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    // Card de perfil actual
    final profile = feed.currentProfile;
    if (profile == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: ProfileCard(
        profile: profile,
        onLike: () => feed.like(profile.id),
        onPass: () => feed.pass(profile.id),
        onReport: () => _showReportSheet(context, feed, profile.id),
      ),
    );
  }

  void _showMatchDialog(BuildContext context, FeedProvider feed) {
    final matched = feed.lastMatchProfile;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => MatchDialog(
        matchedUserName: matched?.displayName,
        matchedUserAvatar: matched?.avatarUrl,
        onDismiss: () {
          Navigator.of(dialogContext).pop();
          feed.clearLastMatch();
          _matchDialogShowing = false;
        },
        onSendMessage: matched != null
            ? () {
                Navigator.of(dialogContext).pop();
                final matchId = feed.lastMatch?['id'] as String?;
                feed.clearLastMatch();
                _matchDialogShowing = false;
                if (matchId != null) {
                  context.go('/chat/$matchId');
                }
              }
            : null,
      ),
    );
  }

  void _showReportSheet(
      BuildContext context, FeedProvider feed, String userId) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) {
        final theme = Theme.of(ctx);
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading:
                    Icon(PhosphorIcons.prohibit(PhosphorIconsStyle.regular), color: theme.colorScheme.error),
                title: const Text('Bloquear usuario'),
                onTap: () {
                  Navigator.pop(ctx);
                  feed.blockUser(userId);
                },
              ),
              ListTile(
                leading: Icon(PhosphorIcons.flag(PhosphorIconsStyle.fill),
                    color: theme.colorScheme.error.withValues(alpha: 0.7)),
                title: const Text('Reportar'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showReportReasonDialog(context, feed, userId);
                },
              ),
              ListTile(
                leading: Icon(PhosphorIcons.x(PhosphorIconsStyle.bold),
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                title: const Text('Cancelar'),
                onTap: () => Navigator.pop(ctx),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showReportReasonDialog(
      BuildContext context, FeedProvider feed, String userId) {
    const reasons = [
      'Perfil falso',
      'Contenido inapropiado',
      'Comportamiento abusivo',
      'Spam',
      'Otro',
    ];

    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Motivo del reporte'),
        children: reasons
            .map((reason) => SimpleDialogOption(
                  onPressed: () {
                    Navigator.pop(ctx);
                    feed.reportUser(userId, reason);
                  },
                  child: Text(reason),
                ))
            .toList(),
      ),
    );
  }
}
