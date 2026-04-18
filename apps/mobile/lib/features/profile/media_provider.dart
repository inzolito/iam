import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';
import '../../core/services/media_service.dart';

/// Foto en la galería del usuario.
class UserPhoto {
  final String id;
  final String url;
  final String? thumbnailUrl;
  final int order;
  final bool isPrimary;
  final DateTime createdAt;

  const UserPhoto({
    required this.id,
    required this.url,
    this.thumbnailUrl,
    this.order = 0,
    this.isPrimary = false,
    required this.createdAt,
  });

  factory UserPhoto.fromJson(Map<String, dynamic> json) {
    return UserPhoto(
      id: json['id'] as String? ?? '',
      url: json['url'] as String? ?? '',
      thumbnailUrl:
          json['thumbnail_url'] as String? ?? json['thumbnailUrl'] as String?,
      order: json['order'] as int? ?? 0,
      isPrimary:
          json['is_primary'] as bool? ?? json['isPrimary'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}

/// Provider de medios del perfil (avatar + galería).
class MediaProvider extends ChangeNotifier {
  final ApiService _api;
  final MediaService _media;

  /// Galería (excluye el avatar principal).
  List<UserPhoto> _photos = [];
  List<UserPhoto> get photos => _photos;

  /// URL del avatar actual.
  String? _avatarUrl;
  String? get avatarUrl => _avatarUrl;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isUploading = false;
  bool get isUploading => _isUploading;

  double _uploadProgress = 0.0;
  double get uploadProgress => _uploadProgress;

  String? _error;
  String? get error => _error;

  /// Máximo de fotos en la galería (excluyendo avatar).
  static const int maxPhotos = 6;

  MediaProvider({
    required ApiService api,
    required MediaService media,
  })  : _api = api,
        _media = media;

  // ── Query ──

  bool get canAddMorePhotos => _photos.length < maxPhotos;
  int get remainingSlots => maxPhotos - _photos.length;

  Future<void> loadPhotos() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/users/me/photos');
      final list = response['photos'] as List<dynamic>? ?? [];
      _photos = list
          .map((p) => UserPhoto.fromJson(p as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Avatar ──

  /// Seleccionar y subir avatar desde galería o cámara.
  Future<bool> pickAndUploadAvatar({
    ImageSourceType source = ImageSourceType.gallery,
  }) async {
    final picked = await _media.pickImage(source: source);
    if (picked == null) return false; // usuario canceló
    return uploadAvatar(picked);
  }

  /// Subir un avatar ya seleccionado.
  Future<bool> uploadAvatar(PickedImage picked) async {
    if (picked.exceedsLimit) {
      _error = 'La imagen supera los 5 MB';
      notifyListeners();
      return false;
    }

    _isUploading = true;
    _uploadProgress = 0.1;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.uploadFile(
        '/users/me/avatar',
        bytes: picked.bytes,
        field: 'avatar',
        filename: picked.filename,
        method: 'PATCH',
      );
      _avatarUrl = response['avatarUrl'] as String? ??
          response['avatar_url'] as String?;
      _uploadProgress = 1.0;
      _isUploading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isUploading = false;
      _uploadProgress = 0;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      _isUploading = false;
      _uploadProgress = 0;
      notifyListeners();
      return false;
    }
  }

  // ── Gallery ──

  Future<bool> pickAndUploadPhoto({
    ImageSourceType source = ImageSourceType.gallery,
  }) async {
    if (!canAddMorePhotos) {
      _error = 'Ya tienes el máximo de $maxPhotos fotos';
      notifyListeners();
      return false;
    }
    final picked = await _media.pickImage(source: source);
    if (picked == null) return false;
    return uploadPhoto(picked);
  }

  Future<bool> uploadPhoto(PickedImage picked) async {
    if (!canAddMorePhotos) {
      _error = 'Ya tienes el máximo de $maxPhotos fotos';
      notifyListeners();
      return false;
    }
    if (picked.exceedsLimit) {
      _error = 'La imagen supera los 5 MB';
      notifyListeners();
      return false;
    }

    _isUploading = true;
    _uploadProgress = 0.1;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.uploadFile(
        '/users/me/photos',
        bytes: picked.bytes,
        field: 'photo',
        filename: picked.filename,
      );
      final newPhoto = UserPhoto.fromJson(response);
      _photos.add(newPhoto);
      _photos.sort((a, b) => a.order.compareTo(b.order));
      _uploadProgress = 1.0;
      _isUploading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isUploading = false;
      _uploadProgress = 0;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      _isUploading = false;
      _uploadProgress = 0;
      notifyListeners();
      return false;
    }
  }

  Future<bool> deletePhoto(String photoId) async {
    try {
      await _api.delete('/users/me/photos/$photoId');
      _photos.removeWhere((p) => p.id == photoId);
      notifyListeners();
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

  /// Reordenar fotos localmente (optimista) y persistir.
  Future<bool> reorderPhotos(int oldIndex, int newIndex) async {
    if (oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= _photos.length ||
        newIndex >= _photos.length ||
        oldIndex == newIndex) {
      return false;
    }

    final previous = List<UserPhoto>.from(_photos);
    final item = _photos.removeAt(oldIndex);
    _photos.insert(newIndex, item);
    notifyListeners();

    try {
      await _api.patch('/users/me/photos/order', body: {
        'order': _photos.map((p) => p.id).toList(),
      });
      return true;
    } on ApiException catch (e) {
      _photos = previous;
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _photos = previous;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> setPrimaryPhoto(String photoId) async {
    try {
      await _api.patch('/users/me/photos/$photoId/primary');
      _photos = _photos
          .map((p) => UserPhoto(
                id: p.id,
                url: p.url,
                thumbnailUrl: p.thumbnailUrl,
                order: p.order,
                isPrimary: p.id == photoId,
                createdAt: p.createdAt,
              ))
          .toList();
      notifyListeners();
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

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
