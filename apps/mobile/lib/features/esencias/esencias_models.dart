/// Balance de Esencias del usuario.
class EsenciasBalance {
  final int balance;
  final int totalEarned;
  final int totalSpent;

  const EsenciasBalance({
    this.balance = 0,
    this.totalEarned = 0,
    this.totalSpent = 0,
  });

  factory EsenciasBalance.fromJson(Map<String, dynamic> json) {
    return EsenciasBalance(
      balance: json['balance'] as int? ?? 0,
      totalEarned: json['totalEarned'] as int? ?? 0,
      totalSpent: json['totalSpent'] as int? ?? 0,
    );
  }
}

/// Transacción del ledger de Esencias.
class EsenciasTransaction {
  final String id;
  final String? fromUserId;
  final String toUserId;
  final int amount;
  final String reason;
  final String? message;
  final String type; // 'grant' | 'transfer' | 'deduction'
  final DateTime createdAt;

  const EsenciasTransaction({
    required this.id,
    this.fromUserId,
    required this.toUserId,
    required this.amount,
    required this.reason,
    this.message,
    required this.type,
    required this.createdAt,
  });

  factory EsenciasTransaction.fromJson(Map<String, dynamic> json) {
    return EsenciasTransaction(
      id: json['id'] as String,
      fromUserId: json['fromUserId'] as String?,
      toUserId: json['toUserId'] as String,
      amount: json['amount'] as int,
      reason: json['reason'] as String,
      message: json['message'] as String?,
      type: json['type'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  bool get isSystemGrant => fromUserId == null && type == 'grant';
  bool get isTransfer => type == 'transfer';
  bool get isDeduction => type == 'deduction';

  /// Etiqueta amigable del motivo.
  String get reasonLabel {
    switch (reason) {
      case 'login_bonus':
        return 'Bonus de login';
      case 'match_creation':
        return 'Match creado';
      case 'user_transfer':
        return 'Transferencia';
      case 'unlock_deduction':
        return 'Desbloqueo';
      case 'admin_grant':
        return 'Otorgado por admin';
      default:
        return reason;
    }
  }
}

/// Regla de desbloqueo de feature.
class UnlockRule {
  final String id;
  final String diagnosis;
  final String featureKey;
  final String featureName;
  final String description;
  final int requiredEsencias;
  final String category;
  final Map<String, dynamic> uiSettings;

  const UnlockRule({
    required this.id,
    required this.diagnosis,
    required this.featureKey,
    required this.featureName,
    required this.description,
    required this.requiredEsencias,
    required this.category,
    this.uiSettings = const {},
  });

  factory UnlockRule.fromJson(Map<String, dynamic> json) {
    return UnlockRule(
      id: json['id'] as String,
      diagnosis: json['diagnosis'] as String,
      featureKey: json['featureKey'] as String,
      featureName: json['featureName'] as String,
      description: json['description'] as String,
      requiredEsencias: json['requiredEsencias'] as int,
      category: json['category'] as String,
      uiSettings: (json['uiSettings'] as Map?)?.cast<String, dynamic>() ?? {},
    );
  }
}

/// Feature desbloqueado por el usuario.
class UserUnlock {
  final String id;
  final String unlockId;
  final String featureKey;
  final String featureName;
  final DateTime unlockedAt;
  final bool isActive;

  const UserUnlock({
    required this.id,
    required this.unlockId,
    required this.featureKey,
    required this.featureName,
    required this.unlockedAt,
    this.isActive = true,
  });

  factory UserUnlock.fromJson(Map<String, dynamic> json) {
    return UserUnlock(
      id: json['id'] as String,
      unlockId: json['unlockId'] as String,
      featureKey: json['featureKey'] as String,
      featureName: json['featureName'] as String,
      unlockedAt: DateTime.parse(json['unlockedAt'] as String),
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
