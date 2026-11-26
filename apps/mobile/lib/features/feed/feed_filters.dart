/// Orden de resultados del feed.
enum FeedSort {
  compatibility, // Por matchScore descendente (default)
  distance, // Más cercanos primero
  recent, // Últimos activos
}

extension FeedSortX on FeedSort {
  String get apiValue {
    switch (this) {
      case FeedSort.compatibility:
        return 'compatibility';
      case FeedSort.distance:
        return 'distance';
      case FeedSort.recent:
        return 'recent';
    }
  }

  String get label {
    switch (this) {
      case FeedSort.compatibility:
        return 'Compatibilidad';
      case FeedSort.distance:
        return 'Distancia';
      case FeedSort.recent:
        return 'Actividad reciente';
    }
  }
}

/// Filtros aplicables al feed de descubrimiento.
///
/// Se serializan a query string para el endpoint `/feed`.
class FeedFilters {
  /// Conjunto de diagnósticos aceptados. Vacío = todos.
  final Set<String> diagnoses;

  /// Edad mínima (inclusivo). null = sin mínimo.
  final int? minAge;

  /// Edad máxima (inclusivo). null = sin máximo.
  final int? maxAge;

  /// Radio de búsqueda en metros. null = sin límite (backend default).
  final int? radiusMeters;

  /// IDs de SpIn tags que el perfil debe tener al menos uno. Vacío = todos.
  final Set<String> tagIds;

  /// Nivel de energía mínimo (1-3). null = cualquiera.
  final int? minEnergyLevel;

  /// ¿Incluir perfiles adolescentes? Default: null (backend decide por edad del viewer).
  final bool? includeTeens;

  /// Géneros aceptados ('male', 'female', 'other'). Vacío = todos.
  final Set<String> genders;

  /// Orden.
  final FeedSort sort;

  const FeedFilters({
    this.diagnoses = const {},
    this.minAge,
    this.maxAge,
    this.radiusMeters,
    this.tagIds = const {},
    this.minEnergyLevel,
    this.includeTeens,
    this.genders = const {},
    this.sort = FeedSort.compatibility,
  });

  Map<String, dynamic> toJson() => {
        'diagnoses': diagnoses.toList(),
        'minAge': minAge,
        'maxAge': maxAge,
        'radiusMeters': radiusMeters,
        'tagIds': tagIds.toList(),
        'minEnergyLevel': minEnergyLevel,
        'includeTeens': includeTeens,
        'genders': genders.toList(),
        'sort': sort.apiValue,
      };

  factory FeedFilters.fromJson(Map<String, dynamic> json) {
    final sortStr = json['sort'] as String?;
    final sort = sortStr == 'distance'
        ? FeedSort.distance
        : sortStr == 'recent'
            ? FeedSort.recent
            : FeedSort.compatibility;
    return FeedFilters(
      diagnoses: ((json['diagnoses'] as List<dynamic>?) ?? [])
          .map((e) => e.toString())
          .toSet(),
      minAge: json['minAge'] as int?,
      maxAge: json['maxAge'] as int?,
      radiusMeters: json['radiusMeters'] as int?,
      tagIds: ((json['tagIds'] as List<dynamic>?) ?? [])
          .map((e) => e.toString())
          .toSet(),
      minEnergyLevel: json['minEnergyLevel'] as int?,
      includeTeens: json['includeTeens'] as bool?,
      genders: ((json['genders'] as List<dynamic>?) ?? [])
          .map((e) => e.toString())
          .toSet(),
      sort: sort,
    );
  }

  /// Default sin filtros.
  static const FeedFilters none = FeedFilters();

  /// Diagnósticos soportados en la app.
  static const List<String> supportedDiagnoses = [
    'TEA',
    'TDAH',
    'AACC',
    'DISLEXIA',
    'AUTOIDENTIFIED',
    'OTHER',
  ];

  /// Géneros soportados en la app.
  static const List<Map<String, String>> supportedGenders = [
    {'key': 'female', 'label': 'Mujeres'},
    {'key': 'male', 'label': 'Hombres'},
    {'key': 'other', 'label': 'Otro'},
  ];

  /// ¿Hay algún filtro no-default aplicado?
  bool get hasActiveFilters =>
      diagnoses.isNotEmpty ||
      minAge != null ||
      maxAge != null ||
      radiusMeters != null ||
      tagIds.isNotEmpty ||
      minEnergyLevel != null ||
      includeTeens != null ||
      genders.isNotEmpty ||
      sort != FeedSort.compatibility;

  /// Cantidad de filtros activos (para badge en UI).
  int get activeCount {
    var count = 0;
    if (diagnoses.isNotEmpty) count++;
    if (minAge != null || maxAge != null) count++;
    if (radiusMeters != null) count++;
    if (tagIds.isNotEmpty) count++;
    if (minEnergyLevel != null) count++;
    if (includeTeens != null) count++;
    if (genders.isNotEmpty) count++;
    if (sort != FeedSort.compatibility) count++;
    return count;
  }

  /// Validación: rango de edad coherente.
  bool get isValid {
    if (minAge != null && minAge! < 13) return false;
    if (maxAge != null && maxAge! > 120) return false;
    if (minAge != null && maxAge != null && minAge! > maxAge!) return false;
    if (radiusMeters != null && radiusMeters! < 0) return false;
    if (minEnergyLevel != null &&
        (minEnergyLevel! < 1 || minEnergyLevel! > 3)) return false;
    return true;
  }

  /// Genera los query params para GET /feed.
  ///
  /// Los valores null o vacíos no se incluyen.
  Map<String, String> toQueryParams() {
    final params = <String, String>{};

    if (diagnoses.isNotEmpty) {
      params['diagnoses'] = diagnoses.join(',');
    }
    if (minAge != null) params['minAge'] = '$minAge';
    if (maxAge != null) params['maxAge'] = '$maxAge';
    if (radiusMeters != null) params['radius'] = '$radiusMeters';
    if (tagIds.isNotEmpty) {
      params['tags'] = tagIds.join(',');
    }
    if (minEnergyLevel != null) {
      params['minEnergy'] = '$minEnergyLevel';
    }
    if (includeTeens != null) {
      params['includeTeens'] = includeTeens! ? 'true' : 'false';
    }
    if (genders.isNotEmpty) {
      params['genders'] = genders.join(',');
    }
    if (sort != FeedSort.compatibility) {
      params['sort'] = sort.apiValue;
    }

    return params;
  }

  /// Serializa los params a string query ("?k=v&k2=v2").
  ///
  /// Si no hay parámetros, devuelve "".
  String toQueryString() {
    final params = toQueryParams();
    if (params.isEmpty) return '';

    final parts = params.entries
        .map((e) =>
            '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .toList();
    return '?${parts.join('&')}';
  }

  FeedFilters copyWith({
    Set<String>? diagnoses,
    int? minAge,
    int? maxAge,
    int? radiusMeters,
    Set<String>? tagIds,
    int? minEnergyLevel,
    bool? includeTeens,
    Set<String>? genders,
    FeedSort? sort,
    bool clearMinAge = false,
    bool clearMaxAge = false,
    bool clearRadius = false,
    bool clearMinEnergy = false,
    bool clearIncludeTeens = false,
  }) {
    return FeedFilters(
      diagnoses: diagnoses ?? this.diagnoses,
      minAge: clearMinAge ? null : (minAge ?? this.minAge),
      maxAge: clearMaxAge ? null : (maxAge ?? this.maxAge),
      radiusMeters:
          clearRadius ? null : (radiusMeters ?? this.radiusMeters),
      tagIds: tagIds ?? this.tagIds,
      minEnergyLevel:
          clearMinEnergy ? null : (minEnergyLevel ?? this.minEnergyLevel),
      includeTeens:
          clearIncludeTeens ? null : (includeTeens ?? this.includeTeens),
      genders: genders ?? this.genders,
      sort: sort ?? this.sort,
    );
  }

  /// Alterna un diagnóstico en el filtro.
  FeedFilters toggleDiagnosis(String diagnosis) {
    final next = Set<String>.from(diagnoses);
    if (next.contains(diagnosis)) {
      next.remove(diagnosis);
    } else {
      next.add(diagnosis);
    }
    return copyWith(diagnoses: next);
  }

  /// Alterna un tag en el filtro.
  FeedFilters toggleTag(String tagId) {
    final next = Set<String>.from(tagIds);
    if (next.contains(tagId)) {
      next.remove(tagId);
    } else {
      next.add(tagId);
    }
    return copyWith(tagIds: next);
  }

  /// Alterna un género en el filtro.
  FeedFilters toggleGender(String gender) {
    final next = Set<String>.from(genders);
    if (next.contains(gender)) {
      next.remove(gender);
    } else {
      next.add(gender);
    }
    return copyWith(genders: next);
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! FeedFilters) return false;
    return _setEquals(diagnoses, other.diagnoses) &&
        minAge == other.minAge &&
        maxAge == other.maxAge &&
        radiusMeters == other.radiusMeters &&
        _setEquals(tagIds, other.tagIds) &&
        minEnergyLevel == other.minEnergyLevel &&
        includeTeens == other.includeTeens &&
        _setEquals(genders, other.genders) &&
        sort == other.sort;
  }

  @override
  int get hashCode => Object.hash(
        Object.hashAllUnordered(diagnoses),
        minAge,
        maxAge,
        radiusMeters,
        Object.hashAllUnordered(tagIds),
        minEnergyLevel,
        includeTeens,
        Object.hashAllUnordered(genders),
        sort,
      );
}

bool _setEquals<T>(Set<T> a, Set<T> b) {
  if (a.length != b.length) return false;
  for (final x in a) {
    if (!b.contains(x)) return false;
  }
  return true;
}
