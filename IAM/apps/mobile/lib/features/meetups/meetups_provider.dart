import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';

/// Meetup presencial.
class Meetup {
  final String id;
  final String matchId;
  final String status;
  final bool userAConfirmed;
  final bool userBConfirmed;
  final DateTime? expiresAt;
  final DateTime createdAt;

  const Meetup({
    required this.id,
    required this.matchId,
    required this.status,
    this.userAConfirmed = false,
    this.userBConfirmed = false,
    this.expiresAt,
    required this.createdAt,
  });

  factory Meetup.fromJson(Map<String, dynamic> json) {
    return Meetup(
      id: json['id'] as String,
      matchId: json['matchId'] as String? ?? json['match_id'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      userAConfirmed: json['userAConfirmed'] as bool? ??
          json['user_a_confirmed'] as bool? ??
          false,
      userBConfirmed: json['userBConfirmed'] as bool? ??
          json['user_b_confirmed'] as bool? ??
          false,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : json['expires_at'] != null
              ? DateTime.parse(json['expires_at'] as String)
              : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  bool get isPending => status == 'pending';
  bool get isConfirmed => status == 'confirmed';
  bool get isExpired =>
      expiresAt != null && DateTime.now().isAfter(expiresAt!);
}

/// Provider de Meetups.
class MeetupsProvider extends ChangeNotifier {
  final ApiService _api;

  List<Meetup> _meetups = [];
  List<Meetup> get meetups => _meetups;

  List<Meetup> _pending = [];
  List<Meetup> get pending => _pending;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  MeetupsProvider({required ApiService api}) : _api = api;

  Future<void> loadMeetups({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final query = status != null ? '?status=$status' : '';
      final response = await _api.get('/meetups$query');
      final list = response['meetups'] as List<dynamic>? ?? [];
      _meetups = list
          .map((m) => Meetup.fromJson(m as Map<String, dynamic>))
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

  Future<void> loadPending() async {
    try {
      final response = await _api.get('/meetups/pending');
      final list = response['meetups'] as List<dynamic>? ?? [];
      _pending = list
          .map((m) => Meetup.fromJson(m as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> initiateMeetup(String matchId,
      {double? lat, double? lng}) async {
    try {
      await _api.post('/meetups/initiate', body: {
        'matchId': matchId,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      await loadMeetups();
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

  Future<bool> confirmMeetup(String meetupId,
      {double? lat, double? lng}) async {
    try {
      await _api.post('/meetups/$meetupId/confirm', body: {
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      await loadMeetups();
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

  Future<bool> disputeMeetup(String meetupId) async {
    try {
      await _api.post('/meetups/$meetupId/dispute');
      await loadMeetups();
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
