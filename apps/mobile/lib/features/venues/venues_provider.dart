import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';

/// Venue resumido para listas.
class VenueSummary {
  final String id;
  final String name;
  final String? category;
  final String? address;
  final double? sensoryRating;
  final double? averageRating;
  final int reviewCount;
  final double? distance;
  final String? imageUrl;
  final bool isFavorite;

  const VenueSummary({
    required this.id,
    required this.name,
    this.category,
    this.address,
    this.sensoryRating,
    this.averageRating,
    this.reviewCount = 0,
    this.distance,
    this.imageUrl,
    this.isFavorite = false,
  });

  factory VenueSummary.fromJson(Map<String, dynamic> json) {
    return VenueSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      address: json['address'] as String?,
      sensoryRating: (json['sensoryRating'] as num?)?.toDouble(),
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      reviewCount: json['reviewCount'] as int? ?? 0,
      distance: (json['distance'] as num?)?.toDouble(),
      imageUrl: json['imageUrl'] as String?,
      isFavorite: json['isFavorite'] as bool? ?? false,
    );
  }

  String get formattedDistance {
    if (distance == null) return '';
    if (distance! >= 1000) return '${(distance! / 1000).toStringAsFixed(1)} km';
    return '${distance!.toInt()} m';
  }
}

/// Provider de Venues.
class VenuesProvider extends ChangeNotifier {
  final ApiService _api;

  List<VenueSummary> _venues = [];
  List<VenueSummary> get venues => _venues;

  List<VenueSummary> _favorites = [];
  List<VenueSummary> get favorites => _favorites;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  VenuesProvider({required ApiService api}) : _api = api;

  Future<void> loadNearby({
    required double lat,
    required double lng,
    int? radius,
    String? category,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      var path = '/venues/nearby/me?lat=$lat&lng=$lng';
      if (radius != null) path += '&radius=$radius';
      if (category != null) path += '&category=$category';

      final response = await _api.get(path);
      final list = response['venues'] as List<dynamic>? ?? [];
      _venues = list
          .map((v) => VenueSummary.fromJson(v as Map<String, dynamic>))
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

  Future<void> loadFavorites() async {
    try {
      final response = await _api.get('/venues/user/favorites');
      final list = response['venues'] as List<dynamic>? ?? [];
      _favorites = list
          .map((v) => VenueSummary.fromJson(v as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> toggleFavorite(String venueId) async {
    try {
      await _api.post('/venues/$venueId/favorite');
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> checkIn(String venueId,
      {required double lat, required double lng}) async {
    try {
      await _api.post('/venues/$venueId/checkin',
          body: {'lat': lat, 'lng': lng});
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
