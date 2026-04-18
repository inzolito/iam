import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

/// Resultado de selección de imagen.
class PickedImage {
  final List<int> bytes;
  final String filename;
  final String? path;

  const PickedImage({
    required this.bytes,
    required this.filename,
    this.path,
  });

  int get sizeBytes => bytes.length;
  bool get exceedsLimit => sizeBytes > MediaService.maxFileBytes;
}

/// Fuente de la imagen.
enum ImageSourceType { gallery, camera }

/// Servicio de selección de medios (imagen desde galería o cámara).
///
/// Abstracto/mock-able — en producción usa `image_picker`.
/// En tests se puede inyectar un mock con [MockMediaService].
class MediaService {
  /// Tamaño máximo permitido (5 MB). El backend aplicará el suyo propio.
  static const int maxFileBytes = 5 * 1024 * 1024;

  /// Resolución máxima (lado más largo) que se pide al picker.
  static const int maxImageDimension = 1600;

  /// Calidad JPEG que se pide al picker (0-100).
  static const int imageQuality = 85;

  final ImagePicker _picker;

  MediaService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  /// Seleccionar una imagen.
  Future<PickedImage?> pickImage({
    ImageSourceType source = ImageSourceType.gallery,
  }) async {
    final XFile? file = await _picker.pickImage(
      source: source == ImageSourceType.gallery
          ? ImageSource.gallery
          : ImageSource.camera,
      maxWidth: maxImageDimension.toDouble(),
      maxHeight: maxImageDimension.toDouble(),
      imageQuality: imageQuality,
    );

    if (file == null) return null;

    final bytes = await file.readAsBytes();
    return PickedImage(
      bytes: bytes,
      filename: _sanitizeFilename(file.name),
      path: file.path,
    );
  }

  /// Seleccionar múltiples imágenes (hasta [limit]).
  Future<List<PickedImage>> pickMultiImage({int limit = 6}) async {
    final files = await _picker.pickMultiImage(
      maxWidth: maxImageDimension.toDouble(),
      maxHeight: maxImageDimension.toDouble(),
      imageQuality: imageQuality,
      limit: limit,
    );

    final result = <PickedImage>[];
    for (final file in files) {
      final bytes = await file.readAsBytes();
      result.add(PickedImage(
        bytes: bytes,
        filename: _sanitizeFilename(file.name),
        path: file.path,
      ));
    }
    return result;
  }

  /// Sanitizar filename (quitar path, limitar caracteres).
  String _sanitizeFilename(String name) {
    final base = name.contains('/')
        ? name.substring(name.lastIndexOf('/') + 1)
        : name.contains('\\')
            ? name.substring(name.lastIndexOf('\\') + 1)
            : name;
    final trimmed = base.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    return trimmed.isEmpty ? 'image.jpg' : trimmed;
  }

  /// Indica si la plataforma soporta cámara (iOS/Android sí, web no).
  bool get supportsCamera =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
}
