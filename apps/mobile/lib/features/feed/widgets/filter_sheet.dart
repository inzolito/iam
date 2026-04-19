import 'package:flutter/material.dart';

import '../feed_filters.dart';

/// Bottom sheet para editar filtros del feed.
///
/// Devuelve el `FeedFilters` aplicado, o `null` si el usuario canceló.
class FilterSheet extends StatefulWidget {
  final FeedFilters initial;

  const FilterSheet({super.key, required this.initial});

  static Future<FeedFilters?> show(
    BuildContext context, {
    required FeedFilters initial,
  }) {
    return showModalBottomSheet<FeedFilters>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => FilterSheet(initial: initial),
    );
  }

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late FeedFilters _draft;

  static const _diagnosisLabels = <String, String>{
    'TEA': 'TEA',
    'TDAH': 'TDAH',
    'AACC': 'Altas Capacidades',
    'DISLEXIA': 'Dislexia',
    'AUTOIDENTIFIED': 'Me identifico',
    'OTHER': 'Otro',
  };

  @override
  void initState() {
    super.initState();
    _draft = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final mediaHeight = MediaQuery.of(context).size.height;

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollController) {
        return Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: Row(
                children: [
                  Text(
                    'Filtros',
                    style: theme.textTheme.titleLarge,
                  ),
                  const Spacer(),
                  if (_draft.hasActiveFilters)
                    TextButton(
                      onPressed: () => setState(() => _draft = FeedFilters.none),
                      child: const Text('Limpiar'),
                    ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                children: [
                  _SectionTitle('Diagnósticos', theme: theme),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: _diagnosisLabels.entries.map((e) {
                      final selected = _draft.diagnoses.contains(e.key);
                      return FilterChip(
                        label: Text(e.value),
                        selected: selected,
                        onSelected: (_) => setState(() {
                          _draft = _draft.toggleDiagnosis(e.key);
                        }),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),
                  _SectionTitle('Rango de edad', theme: theme),
                  const SizedBox(height: 8),
                  RangeSlider(
                    min: 13,
                    max: 99,
                    divisions: 86,
                    labels: RangeLabels(
                      '${(_draft.minAge ?? 18)}',
                      '${(_draft.maxAge ?? 65)}',
                    ),
                    values: RangeValues(
                      (_draft.minAge ?? 18).toDouble(),
                      (_draft.maxAge ?? 65).toDouble(),
                    ),
                    onChanged: (range) => setState(() {
                      _draft = _draft.copyWith(
                        minAge: range.start.round(),
                        maxAge: range.end.round(),
                      );
                    }),
                  ),
                  Center(
                    child: Text(
                      '${_draft.minAge ?? 18} — ${_draft.maxAge ?? 65} años',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                  _SectionTitle('Distancia máxima', theme: theme),
                  const SizedBox(height: 8),
                  Slider(
                    min: 1,
                    max: 100,
                    divisions: 99,
                    label: _draft.radiusMeters == null
                        ? 'Sin límite'
                        : '${(_draft.radiusMeters! / 1000).toStringAsFixed(0)} km',
                    value: _draft.radiusMeters == null
                        ? 50
                        : (_draft.radiusMeters! / 1000).clamp(1, 100).toDouble(),
                    onChanged: (v) => setState(() {
                      _draft = _draft.copyWith(
                        radiusMeters: (v * 1000).round(),
                      );
                    }),
                  ),
                  Center(
                    child: Text(
                      _draft.radiusMeters == null
                          ? 'Sin límite'
                          : 'Hasta ${(_draft.radiusMeters! / 1000).toStringAsFixed(0)} km',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (_draft.radiusMeters != null)
                    Center(
                      child: TextButton(
                        onPressed: () => setState(() {
                          _draft = _draft.copyWith(clearRadius: true);
                        }),
                        child: const Text('Quitar límite'),
                      ),
                    ),

                  const SizedBox(height: 16),
                  _SectionTitle('Energía mínima', theme: theme),
                  const SizedBox(height: 8),
                  SegmentedButton<int?>(
                    segments: const [
                      ButtonSegment(value: null, label: Text('Cualquiera')),
                      ButtonSegment(value: 1, label: Text('Baja+')),
                      ButtonSegment(value: 2, label: Text('Media+')),
                      ButtonSegment(value: 3, label: Text('Alta')),
                    ],
                    selected: {_draft.minEnergyLevel},
                    onSelectionChanged: (set) => setState(() {
                      final val = set.first;
                      _draft = val == null
                          ? _draft.copyWith(clearMinEnergy: true)
                          : _draft.copyWith(minEnergyLevel: val);
                    }),
                  ),

                  const SizedBox(height: 24),
                  _SectionTitle('Ordenar por', theme: theme),
                  const SizedBox(height: 8),
                  Column(
                    children: FeedSort.values.map((s) {
                      return RadioListTile<FeedSort>(
                        value: s,
                        groupValue: _draft.sort,
                        title: Text(s.label),
                        onChanged: (v) => setState(() {
                          if (v != null) {
                            _draft = _draft.copyWith(sort: v);
                          }
                        }),
                        contentPadding: EdgeInsets.zero,
                      );
                    }).toList(),
                  ),

                  SizedBox(height: mediaHeight * 0.02),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(
                  top: BorderSide(
                    color: theme.colorScheme.outline.withValues(alpha: 0.2),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: _draft.isValid
                          ? () => Navigator.pop(context, _draft)
                          : null,
                      child: Text(
                        _draft.activeCount > 0
                            ? 'Aplicar (${_draft.activeCount})'
                            : 'Aplicar',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String label;
  final ThemeData theme;

  const _SectionTitle(this.label, {required this.theme});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: theme.textTheme.titleSmall?.copyWith(
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
