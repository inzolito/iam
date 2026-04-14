import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'feed_provider.dart';
import 'widgets/profile_card.dart';
import 'widgets/match_dialog.dart';

/// Pantalla principal del feed — descubrir perfiles y hacer swipe.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FeedProvider>().loadFeed();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final feed = context.watch<FeedProvider>();

    // Mostrar dialog de match si hay uno
    if (feed.lastMatch != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showMatchDialog(context, feed);
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'IAM',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            letterSpacing: 4,
            color: theme.colorScheme.primary,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _buildBody(context, feed, theme),
    );
  }

  Widget _buildBody(BuildContext context, FeedProvider feed, ThemeData theme) {
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
              Icon(Icons.wifi_off,
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
                icon: const Icon(Icons.refresh),
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
              Icon(Icons.explore_off,
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
                icon: const Icon(Icons.refresh),
                label: const Text('Actualizar'),
              ),
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
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => MatchDialog(
        onDismiss: () {
          feed.clearLastMatch();
          Navigator.of(context).pop();
        },
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
                    Icon(Icons.block, color: theme.colorScheme.error),
                title: const Text('Bloquear usuario'),
                onTap: () {
                  Navigator.pop(ctx);
                  feed.blockUser(userId);
                },
              ),
              ListTile(
                leading: Icon(Icons.flag,
                    color: theme.colorScheme.error.withValues(alpha: 0.7)),
                title: const Text('Reportar'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showReportReasonDialog(context, feed, userId);
                },
              ),
              ListTile(
                leading: Icon(Icons.close,
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
