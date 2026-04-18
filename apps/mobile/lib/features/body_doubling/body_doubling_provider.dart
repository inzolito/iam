import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';

/// Sesión de body doubling.
class BdSession {
  final String id;
  final String hostId;
  final String? hostName;
  final String title;
  final String activityType;
  final int durationMinutes;
  final String? description;
  final int maxParticipants;
  final int currentParticipants;
  final String status;
  final bool isPublic;
  final DateTime createdAt;

  const BdSession({
    required this.id,
    required this.hostId,
    this.hostName,
    required this.title,
    required this.activityType,
    required this.durationMinutes,
    this.description,
    this.maxParticipants = 5,
    this.currentParticipants = 0,
    this.status = 'waiting',
    this.isPublic = true,
    required this.createdAt,
  });

  factory BdSession.fromJson(Map<String, dynamic> json) {
    return BdSession(
      id: json['id'] as String,
      hostId: json['hostId'] as String? ?? json['host_id'] as String? ?? '',
      hostName: json['hostName'] as String? ?? json['host_name'] as String?,
      title: json['title'] as String,
      activityType:
          json['activityType'] as String? ?? json['activity_type'] as String? ?? '',
      durationMinutes:
          json['durationMinutes'] as int? ?? json['duration_minutes'] as int? ?? 25,
      description: json['description'] as String?,
      maxParticipants:
          json['maxParticipants'] as int? ?? json['max_participants'] as int? ?? 5,
      currentParticipants: json['currentParticipants'] as int? ??
          json['current_participants'] as int? ??
          0,
      status: json['status'] as String? ?? 'waiting',
      isPublic: json['isPublic'] as bool? ?? json['is_public'] as bool? ?? true,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  bool get isFull => currentParticipants >= maxParticipants;
  bool get isActive => status == 'active';
  bool get isWaiting => status == 'waiting';
}

/// Provider de Body Doubling.
class BodyDoublingProvider extends ChangeNotifier {
  final ApiService _api;

  List<BdSession> _sessions = [];
  List<BdSession> get sessions => _sessions;

  List<BdSession> _mySessions = [];
  List<BdSession> get mySessions => _mySessions;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  BodyDoublingProvider({required ApiService api}) : _api = api;

  Future<void> loadSessions({String? activity}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final query = activity != null ? '?activity=$activity' : '';
      final response = await _api.get('/body-doubling/sessions$query');
      final list = response['sessions'] as List<dynamic>? ?? [];
      _sessions = list
          .map((s) => BdSession.fromJson(s as Map<String, dynamic>))
          .toList();
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMySessions() async {
    try {
      final response = await _api.get('/body-doubling/my-sessions');
      final list = response['sessions'] as List<dynamic>? ?? [];
      _mySessions = list
          .map((s) => BdSession.fromJson(s as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> createSession({
    required String title,
    required String activityType,
    required int durationMinutes,
    String? description,
    int? maxParticipants,
  }) async {
    try {
      await _api.post('/body-doubling/sessions', body: {
        'title': title,
        'activityType': activityType,
        'durationMinutes': durationMinutes,
        if (description != null) 'description': description,
        if (maxParticipants != null) 'maxParticipants': maxParticipants,
      });
      await loadSessions();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> joinSession(String sessionId) async {
    try {
      await _api.post('/body-doubling/sessions/$sessionId/join');
      await loadSessions();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> leaveSession(String sessionId) async {
    try {
      await _api.post('/body-doubling/sessions/$sessionId/leave');
      await loadSessions();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
