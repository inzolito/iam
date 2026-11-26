import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/api_service.dart';
import '../../core/widgets/profile_section_widgets.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Vista del perfil público de otro usuario (fotos, descripción, SpIn, diagnósticos).
class PublicProfileScreen extends StatefulWidget {
  final String userId;
  const PublicProfileScreen({super.key, required this.userId});

  @override
  State<PublicProfileScreen> createState() => _PublicProfileScreenState();
}

class _PublicProfileScreenState extends State<PublicProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;

  static const _diagnosisLabels = {
    'TEA': 'TEA (Autismo)',
    'TDAH': 'TDAH',
    'AACC': 'Altas Capacidades',
    'DISLEXIA': 'Dislexia',
    'AUTOIDENTIFIED': 'Autoidentificado',
    'OTHER': 'Otro',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<ApiService>();
      final res = await api.get('/profiles/${widget.userId}');
      setState(() {
        _profile = res;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(_profile?['display_name'] as String? ?? 'Perfil'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('No se pudo cargar el perfil'))
              : _buildContent(theme),
    );
  }

  Widget _buildContent(ThemeData theme) {
    final p = _profile!;
    final name = p['display_name'] as String? ?? '';
    final age = p['age'] as int?;
    final distanceMeters = (p['distance_meters'] as num?)?.toDouble();
    final msn = p['msn_status'] as String?;
    final avatar = p['avatar_url'] as String?;
    final gallery = (p['gallery'] as List<dynamic>? ?? [])
        .map((g) => (g as Map<String, dynamic>)['public_url'] as String?)
        .whereType<String>()
        .toList();
    final spin = (p['spin'] as List<dynamic>? ?? []).cast<String>();
    final diagnoses = (p['diagnoses'] as List<dynamic>? ?? [])
        .map((d) {
          final m = d as Map<String, dynamic>;
          final code = m['diagnosis'] as String?;
          if (code == null) return null;
          return ProfileDiagnosisBadgeData(
            code: code,
            isPrimary: m['is_primary'] as bool? ?? false,
          );
        })
        .whereType<ProfileDiagnosisBadgeData>()
        .toList();

    // Fotos: avatar primero, luego galería
    final photos = <String>[
      if (avatar != null && avatar.isNotEmpty) avatar,
      ...gallery,
    ];

    return ListView(
      children: [
        // Carrusel de fotos
        if (photos.isNotEmpty)
          SizedBox(
            height: 360,
            child: PageView.builder(
              itemCount: photos.length,
              itemBuilder: (_, i) => Image.network(
                photos[i],
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: theme.colorScheme.primary.withValues(alpha: 0.1),
                  child: Icon(PhosphorIcons.user(PhosphorIconsStyle.fill),
                      size: 100, color: theme.colorScheme.primary),
                ),
              ),
            ),
          )
        else
          Container(
            height: 360,
            color: theme.colorScheme.primary.withValues(alpha: 0.1),
            child: Icon(PhosphorIcons.user(PhosphorIconsStyle.fill),
                size: 100, color: theme.colorScheme.primary),
          ),

        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Nombre + edad
              Text(
                age != null ? '$name, $age' : name,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.primary,
                ),
              ),
              if (distanceMeters != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(
                      PhosphorIcons.mapPin(PhosphorIconsStyle.fill),
                      size: 16,
                      color: theme.colorScheme.secondary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      distanceMeters >= 1000
                          ? 'A ${(distanceMeters / 1000).toStringAsFixed(1)} km de ti'
                          : distanceMeters < 100
                              ? 'Muy cerca de ti (< 100 m)'
                              : 'A ${distanceMeters.round()} m de ti',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 12),

              // Descripción (msn_status)
              if (msn != null && msn.isNotEmpty) ...[
                Text(
                  msn,
                  style: TextStyle(
                    fontSize: 16,
                    fontStyle: FontStyle.italic,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.8),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Neurodivergencia (componente compartido)
              if (diagnoses.isNotEmpty) ...[
                ProfileDiagnosesSection(diagnoses: diagnoses),
                const SizedBox(height: 16),
              ],

              // SpIn (intereses) (componente compartido)
              if (spin.isNotEmpty)
                ProfileSpinSection(tags: spin),
            ],
          ),
        ),
      ],
    );
  }
}
