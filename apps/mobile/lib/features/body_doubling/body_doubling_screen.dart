import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'body_doubling_provider.dart';

/// Pantalla de Body Doubling — sesiones de foco compartido.
class BodyDoublingScreen extends StatefulWidget {
  const BodyDoublingScreen({super.key});

  @override
  State<BodyDoublingScreen> createState() => _BodyDoublingScreenState();
}

class _BodyDoublingScreenState extends State<BodyDoublingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BodyDoublingProvider>().loadSessions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = context.watch<BodyDoublingProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Body Doubling'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context, provider),
        icon: const Icon(Icons.add),
        label: const Text('Crear sesión'),
      ),
      body: provider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : provider.error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(provider.error!,
                          style: TextStyle(color: theme.colorScheme.error)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () =>
                            provider.loadSessions(),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : provider.sessions.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline,
                              size: 64,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.3)),
                          const SizedBox(height: 16),
                          Text(
                            'No hay sesiones activas',
                            style: TextStyle(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.5)),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Crea una para trabajar acompañado',
                            style: TextStyle(
                              fontSize: 13,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.4),
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => provider.loadSessions(),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.sessions.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 12),
                        itemBuilder: (ctx, i) => _SessionCard(
                          session: provider.sessions[i],
                          provider: provider,
                        ),
                      ),
                    ),
    );
  }

  void _showCreateSheet(BuildContext context, BodyDoublingProvider provider) {
    final titleCtrl = TextEditingController();
    String activityType = 'study';
    int duration = 25;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
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
              Text('Nueva sesión',
                  style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                    labelText: 'Título', hintText: 'Ej: Tesis capítulo 3'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: activityType,
                decoration:
                    const InputDecoration(labelText: 'Actividad'),
                items: const [
                  DropdownMenuItem(value: 'study', child: Text('Estudio')),
                  DropdownMenuItem(value: 'work', child: Text('Trabajo')),
                  DropdownMenuItem(value: 'creative', child: Text('Creación')),
                  DropdownMenuItem(value: 'exercise', child: Text('Ejercicio')),
                ],
                onChanged: (v) => setSheetState(() => activityType = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                value: duration,
                decoration:
                    const InputDecoration(labelText: 'Duración (min)'),
                items: [25, 45, 60, 90]
                    .map((d) => DropdownMenuItem(
                          value: d,
                          child: Text('$d minutos'),
                        ))
                    .toList(),
                onChanged: (v) => setSheetState(() => duration = v!),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  final result = await provider.createSession(
                    title: titleCtrl.text.trim(),
                    activityType: activityType,
                    durationMinutes: duration,
                  );
                  if (result && ctx.mounted) Navigator.pop(ctx);
                },
                child: const Text('Crear'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final BdSession session;
  final BodyDoublingProvider provider;

  const _SessionCard({required this.session, required this.provider});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(session.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                ),
                _StatusBadge(session: session, theme: theme),
              ],
            ),
            if (session.hostName != null) ...[
              const SizedBox(height: 4),
              Text(
                'Anfitrión: ${session.hostName}',
                style: TextStyle(
                  fontSize: 13,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.timer, size: 14,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                const SizedBox(width: 4),
                Text('${session.durationMinutes} min',
                    style: const TextStyle(fontSize: 13)),
                const SizedBox(width: 16),
                Icon(Icons.people, size: 14,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                const SizedBox(width: 4),
                Text('${session.currentParticipants}/${session.maxParticipants}',
                    style: TextStyle(
                      fontSize: 13,
                      color: session.isFull ? theme.colorScheme.error : null,
                    )),
              ],
            ),
            if (!session.isFull && !session.isActive) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => provider.joinSession(session.id),
                  child: const Text('Unirse'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final BdSession session;
  final ThemeData theme;

  const _StatusBadge({required this.session, required this.theme});

  @override
  Widget build(BuildContext context) {
    final color = session.isActive
        ? Colors.green
        : session.isFull
            ? theme.colorScheme.error
            : theme.colorScheme.primary;

    final label = session.isActive
        ? 'Activa'
        : session.isFull
            ? 'Llena'
            : 'Esperando';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
