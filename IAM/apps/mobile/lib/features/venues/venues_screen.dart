import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'venues_provider.dart';

/// Pantalla de venues — lista de lugares cercanos con filtros.
class VenuesScreen extends StatefulWidget {
  const VenuesScreen({super.key});

  @override
  State<VenuesScreen> createState() => _VenuesScreenState();
}

class _VenuesScreenState extends State<VenuesScreen> {
  String? _selectedCategory;

  final _categories = [
    'cafe',
    'biblioteca',
    'parque',
    'centro_cultural',
    'coworking',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
    });
  }

  void _load() {
    context.read<VenuesProvider>().loadNearby(
          lat: 40.4168,
          lng: -3.7038,
          category: _selectedCategory,
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = context.watch<VenuesProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lugares'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Filtro de categorías
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _CategoryChip(
                  label: 'Todos',
                  selected: _selectedCategory == null,
                  onTap: () => setState(() {
                    _selectedCategory = null;
                    _load();
                  }),
                  theme: theme,
                ),
                ..._categories.map((c) => _CategoryChip(
                      label: c.replaceAll('_', ' '),
                      selected: _selectedCategory == c,
                      onTap: () => setState(() {
                        _selectedCategory = c;
                        _load();
                      }),
                      theme: theme,
                    )),
              ],
            ),
          ),

          // Lista principal
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : provider.error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(provider.error!,
                                style: TextStyle(
                                    color: theme.colorScheme.error)),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _load,
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      )
                    : provider.venues.isEmpty
                        ? Center(
                            child: Text(
                              'No hay lugares cerca',
                              style: TextStyle(
                                  color: theme.colorScheme.onSurface
                                      .withValues(alpha: 0.5)),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: () async => _load(),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: provider.venues.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (ctx, i) =>
                                  _VenueCard(venue: provider.venues[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final ThemeData theme;

  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: theme.colorScheme.primary.withValues(alpha: 0.2),
      ),
    );
  }
}

class _VenueCard extends StatelessWidget {
  final VenueSummary venue;

  const _VenueCard({required this.venue});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Icono/imagen
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: venue.imageUrl != null
                  ? Image.network(
                      venue.imageUrl!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      width: 64,
                      height: 64,
                      color: theme.colorScheme.primary.withValues(alpha: 0.1),
                      child: Icon(Icons.place,
                          size: 32, color: theme.colorScheme.primary),
                    ),
            ),
            const SizedBox(width: 16),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(venue.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                  if (venue.address != null) ...[
                    const SizedBox(height: 4),
                    Text(venue.address!,
                        style: TextStyle(
                          fontSize: 13,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.6),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (venue.sensoryRating != null) ...[
                        Icon(Icons.spa, size: 14,
                            color: theme.colorScheme.primary),
                        const SizedBox(width: 4),
                        Text(
                          venue.sensoryRating!.toStringAsFixed(1),
                          style: const TextStyle(fontSize: 13),
                        ),
                        const SizedBox(width: 12),
                      ],
                      if (venue.formattedDistance.isNotEmpty) ...[
                        Icon(Icons.directions_walk, size: 14,
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.5)),
                        const SizedBox(width: 4),
                        Text(venue.formattedDistance,
                            style: TextStyle(
                              fontSize: 13,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5),
                            )),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Favorito
            Icon(
              venue.isFavorite ? Icons.favorite : Icons.favorite_border,
              color: venue.isFavorite ? Colors.pink : theme.colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }
}
