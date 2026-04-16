/// Perfil completo del usuario.
class UserProfile {
  final String id;
  final String email;
  final String? username;
  final String? displayName;
  final String? birthDate;
  final bool isTeen;
  final String? avatarUrl;
  final String? msnStatus;
  final int energyLevel;
  final int notifLevel;
  final bool isActive;
  final bool onboardingCompleted;
  final DateTime createdAt;

  const UserProfile({
    required this.id,
    required this.email,
    this.username,
    this.displayName,
    this.birthDate,
    this.isTeen = false,
    this.avatarUrl,
    this.msnStatus,
    this.energyLevel = 1,
    this.notifLevel = 1,
    this.isActive = true,
    this.onboardingCompleted = false,
    required this.createdAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      username: json['username'] as String?,
      displayName: json['display_name'] as String?,
      birthDate: json['birth_date'] as String?,
      isTeen: json['is_teen'] as bool? ?? false,
      avatarUrl: json['avatar_url'] as String?,
      msnStatus: json['msn_status'] as String?,
      energyLevel: json['energy_level'] as int? ?? 1,
      notifLevel: json['notif_level'] as int? ?? 1,
      isActive: json['is_active'] as bool? ?? true,
      onboardingCompleted: json['onboarding_completed'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  /// Iniciales para avatar placeholder.
  String get initials {
    if (displayName != null && displayName!.isNotEmpty) {
      return displayName![0].toUpperCase();
    }
    if (username != null && username!.isNotEmpty) {
      return username![0].toUpperCase();
    }
    return '?';
  }
}

/// Diagnóstico del usuario.
class UserDiagnosis {
  final String diagnosis;
  final bool isPrimary;

  const UserDiagnosis({
    required this.diagnosis,
    this.isPrimary = false,
  });

  factory UserDiagnosis.fromJson(Map<String, dynamic> json) {
    return UserDiagnosis(
      diagnosis: json['diagnosis'] as String,
      isPrimary: json['is_primary'] as bool? ?? false,
    );
  }
}
