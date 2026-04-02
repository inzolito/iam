import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../onboarding_provider.dart';

/// Paso 2: Selección de SpIn (Special Interests).
/// Búsqueda con autocomplete, chips seleccionados, límites visibles.
class SpinStep extends StatefulWidget {
  const SpinStep({super.key});

  @override
  State<SpinStep> createState() => _SpinStepState();
}

class _SpinStepState extends State<SpinStep> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OnboardingProvider>();
    final theme = provider.currentTheme;
    final remaining =
        OnboardingProvider.maxSpinTotal - provider.selectedTagIds.length;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Mis SpIn',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Tus Special Interests. Lo que te apasiona, hiperfija o te hace brillar.',
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$remaining disponibles (máx ${OnboardingProvider.maxSpinTotal})',
            style: TextStyle(
              fontSize: 12,
              color: remaining > 0
                  ? theme.colorScheme.onSurface.withValues(alpha: 0.5)
                  : Colors.red,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),

          // Selected tags (chips)
          if (provider.selectedTags.isNotEmpty) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: provider.selectedTags.map((tag) {
                return Chip(
                  label: Text(
                    tag['display_name'] ?? tag['slug'] ?? '',
                    style: TextStyle(
                      color: theme.colorScheme.onSurface,
                      fontSize: 13,
                    ),
                  ),
                  backgroundColor:
                      theme.colorScheme.primary.withValues(alpha: 0.1),
                  deleteIcon: Icon(
                    Icons.close,
                    size: 18,
                    color: theme.colorScheme.primary,
                  ),
                  onDeleted: () => provider.removeTag(tag['id']),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      color: theme.colorScheme.primary.withValues(alpha: 0.3),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],

          // Search bar
          TextField(
            controller: _searchController,
            onChanged: (value) => provider.searchTags(value),
            style: TextStyle(color: theme.colorScheme.onSurface),
            decoration: InputDecoration(
              hintText: 'Buscar intereses... (ej: anime, ajedrez, café)',
              hintStyle: TextStyle(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
              ),
              prefixIcon: Icon(
                Icons.search,
                color: theme.colorScheme.primary,
              ),
              filled: true,
              fillColor: theme.colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.15),
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.15),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: theme.colorScheme.primary),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Search results
          Expanded(
            child: provider.searchResults.isNotEmpty
                ? ListView.separated(
                    itemCount: provider.searchResults.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final tag = provider.searchResults[index];
                      final isSelected =
                          provider.selectedTagIds.contains(tag['id']);
                      final canAdd = provider.canAddTag(tag);

                      return ListTile(
                        title: Text(
                          tag['display_name'] ?? tag['slug'] ?? '',
                          style: TextStyle(
                            color: theme.colorScheme.onSurface,
                            fontWeight: isSelected
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                        subtitle: tag['is_curated'] == true
                            ? Text(
                                '✨ Curado',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: theme.colorScheme.primary,
                                ),
                              )
                            : null,
                        trailing: isSelected
                            ? Icon(Icons.check_circle,
                                color: theme.colorScheme.primary)
                            : canAdd
                                ? Icon(Icons.add_circle_outline,
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.4))
                                : Icon(Icons.block,
                                    color: Colors.red.withValues(alpha: 0.4)),
                        onTap: isSelected
                            ? () => provider.removeTag(tag['id'])
                            : canAdd
                                ? () {
                                    provider.addTag(tag);
                                    _searchController.clear();
                                    provider.searchTags('');
                                  }
                                : null,
                      );
                    },
                  )
                : Center(
                    child: Text(
                      _searchController.text.length >= 2
                          ? 'Sin resultados. ¡Prueba con otras palabras!'
                          : 'Escribe al menos 2 letras para buscar',
                      style: TextStyle(
                        color:
                            theme.colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ),
          ),
          const SizedBox(height: 16),

          // Navigation
          Row(
            children: [
              TextButton(
                onPressed: provider.previousStep,
                child: Text(
                  '← Atrás',
                  style: TextStyle(color: theme.colorScheme.primary),
                ),
              ),
              const Spacer(),
              SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed:
                      provider.canProceedFromSpin ? provider.nextStep : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text('Continuar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
