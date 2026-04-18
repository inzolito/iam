import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'meetups_provider.dart';

/// Pantalla de Meetups — encuentros presenciales con matches.
class MeetupsScreen extends StatefulWidget {
  const MeetupsScreen({super.key});

  @override
  State<MeetupsScreen> createState() => _MeetupsScreenState();
}

class _MeetupsScreenState extends State<MeetupsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MeetupsProvider>().loadMeetups();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = context.watch<MeetupsProvider>();

    final pending =
        provider.meetups.where((m) => m.isPending && !m.isExpired).toList();
    final history =
        provider.meetups.where((m) => m.isConfirmed || m.isExpired).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meetups'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Pendientes'),
            Tab(text: 'Historial'),
          ],
        ),
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
                        onPressed: () => provider.loadMeetups(),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _MeetupList(
                      meetups: pending,
                      emptyText: 'No hay meetups pendientes',
                      provider: provider,
                      showActions: true,
                    ),
                    _MeetupList(
                      meetups: history,
                      emptyText: 'Sin historial aún',
                      provider: provider,
                      showActions: false,
                    ),
                  ],
                ),
    );
  }
}

class _MeetupList extends StatelessWidget {
  final List<Meetup> meetups;
  final String emptyText;
  final MeetupsProvider provider;
  final bool showActions;

  const _MeetupList({
    required this.meetups,
    required this.emptyText,
    required this.provider,
    required this.showActions,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (meetups.isEmpty) {
      return Center(
        child: Text(
          emptyText,
          style: TextStyle(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => provider.loadMeetups(),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: meetups.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (ctx, i) => _MeetupCard(
          meetup: meetups[i],
          provider: provider,
          showActions: showActions,
        ),
      ),
    );
  }
}

class _MeetupCard extends StatelessWidget {
  final Meetup meetup;
  final MeetupsProvider provider;
  final bool showActions;

  const _MeetupCard({
    required this.meetup,
    required this.provider,
    required this.showActions,
  });

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
                  child: Text(
                    'Match ${meetup.matchId.length > 8 ? '${meetup.matchId.substring(0, 8)}...' : meetup.matchId}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                _StatusChip(meetup: meetup, theme: theme),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _ConfirmIcon(confirmed: meetup.userAConfirmed, label: 'A'),
                const SizedBox(width: 8),
                _ConfirmIcon(confirmed: meetup.userBConfirmed, label: 'B'),
                const Spacer(),
                if (meetup.expiresAt != null)
                  Text(
                    meetup.isExpired ? 'Expirado' : _daysLeft(meetup.expiresAt!),
                    style: TextStyle(
                      fontSize: 12,
                      color: meetup.isExpired
                          ? theme.colorScheme.error
                          : theme.colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
              ],
            ),
            if (showActions && !meetup.isExpired) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => provider.confirmMeetup(meetup.id),
                      child: const Text('Confirmar'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => provider.disputeMeetup(meetup.id),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: theme.colorScheme.error,
                      side: BorderSide(color: theme.colorScheme.error),
                    ),
                    child: const Text('Disputar'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _daysLeft(DateTime expires) {
    final diff = expires.difference(DateTime.now());
    if (diff.inDays > 0) return 'Expira en ${diff.inDays}d';
    if (diff.inHours > 0) return 'Expira en ${diff.inHours}h';
    return 'Expira pronto';
  }
}

class _StatusChip extends StatelessWidget {
  final Meetup meetup;
  final ThemeData theme;

  const _StatusChip({required this.meetup, required this.theme});

  @override
  Widget build(BuildContext context) {
    final color = meetup.isConfirmed
        ? Colors.green
        : meetup.isExpired
            ? theme.colorScheme.error
            : theme.colorScheme.primary;

    final label = meetup.isConfirmed
        ? 'Confirmado'
        : meetup.isExpired
            ? 'Expirado'
            : 'Pendiente';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _ConfirmIcon extends StatelessWidget {
  final bool confirmed;
  final String label;

  const _ConfirmIcon({required this.confirmed, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          confirmed ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 16,
          color: confirmed ? Colors.green : Colors.grey,
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 13)),
      ],
    );
  }
}
