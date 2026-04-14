/// Perfil mostrado en el feed de descubrimiento.
class FeedProfile {
  final String id;
  final String? displayName;
  final String? avatarUrl;
  final bool isTeen;
  final int energyLevel;
  final String? msnStatus;
  final List<String> spin;
  final double matchScore;
  final double distance;

  const FeedProfile({
    required this.id,
    this.displayName,
    this.avatarUrl,
    this.isTeen = false,
    this.energyLevel = 1,
    this.msnStatus,
    this.spin = const [],
    this.matchScore = 0,
    this.distance = 0,
  });

  factory FeedProfile.fromJson(Map<String, dynamic> json) {
    return FeedProfile(
      id: json['id'] as String,
      displayName: json['display_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      isTeen: json['is_teen'] as bool? ?? false,
      energyLevel: json['energy_level'] as int? ?? 1,
      msnStatus: json['msn_status'] as String?,
      spin: (json['spin'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      matchScore: (json['matchScore'] as num?)?.toDouble() ?? 0,
      distance: (json['distance'] as num?)?.toDouble() ?? 0,
    );
  }

  /// Distancia formateada (km o m).
  String get formattedDistance {
    if (distance >= 1000) {
      return '${(distance / 1000).toStringAsFixed(1)} km';
    }
    return '${distance.toInt()} m';
  }

  /// Porcentaje de compatibilidad.
  String get compatibilityPercent => '${(matchScore * 100).toInt()}%';
}
