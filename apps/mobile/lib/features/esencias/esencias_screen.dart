import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'esencias_provider.dart';
import 'esencias_models.dart';

/// Pantalla principal de Esencias — balance, transacciones, unlocks.
class EsenciasScreen extends StatefulWidget {
  const EsenciasScreen({super.key});

  @override
  State<EsenciasScreen> createState() => _EsenciasScreenState();
}

class _EsenciasScreenState extends State<EsenciasScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<EsenciasProvider>();
      provider.loadBalance();
      provider.loadTransactions();
      provider.loadUnlockRules();
      provider.loadUserUnlocks();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = context.watch<EsenciasProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Esencias'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Balance'),
            Tab(text: 'Historial'),
            Tab(text: 'Tienda'),
          ],
          labelColor: theme.colorScheme.primary,
          unselectedLabelColor:
              theme.colorScheme.onSurface.withValues(alpha: 0.5),
          indicatorColor: theme.colorScheme.primary,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _BalanceTab(provider: provider, theme: theme),
          _HistoryTab(provider: provider, theme: theme),
          _ShopTab(provider: provider, theme: theme),
        ],
      ),
    );
  }
}

class _BalanceTab extends StatelessWidget {
  final EsenciasProvider provider;
  final ThemeData theme;

  const _BalanceTab({required this.provider, required this.theme});

  @override
  Widget build(BuildContext context) {
    final balance = provider.balance;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.diamond_outlined,
              size: 64,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              '${balance.balance}',
              style: TextStyle(
                fontSize: 56,
                fontWeight: FontWeight.w900,
                color: theme.colorScheme.primary,
              ),
            ),
            Text(
              'Esencias',
              style: TextStyle(
                fontSize: 18,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _StatCard(
                  label: 'Ganadas',
                  value: '${balance.totalEarned}',
                  icon: Icons.arrow_upward,
                  color: Colors.green,
                  theme: theme,
                ),
                _StatCard(
                  label: 'Gastadas',
                  value: '${balance.totalSpent}',
                  icon: Icons.arrow_downward,
                  color: Colors.orange,
                  theme: theme,
                ),
              ],
            ),
            const SizedBox(height: 32),
            Text(
              'Gana Esencias con login diario y matches',
              style: TextStyle(
                fontSize: 14,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final ThemeData theme;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}

class _HistoryTab extends StatelessWidget {
  final EsenciasProvider provider;
  final ThemeData theme;

  const _HistoryTab({required this.provider, required this.theme});

  @override
  Widget build(BuildContext context) {
    if (provider.isLoading && provider.transactions.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.transactions.isEmpty) {
      return Center(
        child: Text(
          'Sin transacciones',
          style: TextStyle(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: provider.transactions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final tx = provider.transactions[index];
        return _TransactionTile(transaction: tx, theme: theme);
      },
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final EsenciasTransaction transaction;
  final ThemeData theme;

  const _TransactionTile({required this.transaction, required this.theme});

  @override
  Widget build(BuildContext context) {
    final isPositive = transaction.type != 'deduction' &&
        !(transaction.isTransfer && transaction.fromUserId != null);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: (isPositive ? Colors.green : Colors.orange)
            .withValues(alpha: 0.15),
        child: Icon(
          isPositive ? Icons.add : Icons.remove,
          color: isPositive ? Colors.green : Colors.orange,
        ),
      ),
      title: Text(transaction.reasonLabel),
      subtitle: transaction.message != null
          ? Text(transaction.message!,
              maxLines: 1, overflow: TextOverflow.ellipsis)
          : null,
      trailing: Text(
        '${isPositive ? '+' : '-'}${transaction.amount}',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: isPositive ? Colors.green : Colors.orange,
        ),
      ),
    );
  }
}

class _ShopTab extends StatelessWidget {
  final EsenciasProvider provider;
  final ThemeData theme;

  const _ShopTab({required this.provider, required this.theme});

  @override
  Widget build(BuildContext context) {
    if (provider.unlockRules.isEmpty) {
      return Center(
        child: Text(
          'Sin desbloqueos disponibles',
          style: TextStyle(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: provider.unlockRules.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final rule = provider.unlockRules[index];
        final isUnlocked = provider.isFeatureUnlocked(rule.featureKey);
        final canAfford = provider.balance.balance >= rule.requiredEsencias;

        return Card(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            title: Text(
              rule.featureName,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isUnlocked
                    ? theme.colorScheme.onSurface.withValues(alpha: 0.5)
                    : null,
              ),
            ),
            subtitle: Text(rule.description,
                maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: isUnlocked
                ? Chip(
                    label: const Text('Desbloqueado',
                        style: TextStyle(fontSize: 11)),
                    backgroundColor:
                        Colors.green.withValues(alpha: 0.15),
                  )
                : ElevatedButton(
                    onPressed: canAfford
                        ? () => provider.unlockFeature(rule.id)
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.colorScheme.primary,
                      foregroundColor: theme.colorScheme.onPrimary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text('${rule.requiredEsencias}'),
                  ),
          ),
        );
      },
    );
  }
}
