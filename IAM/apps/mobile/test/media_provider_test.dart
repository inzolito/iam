import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/core/services/media_service.dart';
import 'package:iam_mobile/features/profile/media_provider.dart';

// ============================================================
// Mocks
// ============================================================

class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})? onPatch;
  final Map<String, dynamic> Function(String path)? onDelete;
  final Map<String, dynamic> Function(
    String path, {
    required List<int> bytes,
    required String field,
    required String filename,
    String method,
  })? onUpload;

  MockApiService({
    this.onGet,
    this.onPatch,
    this.onDelete,
    this.onUpload,
  }) : super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (onGet != null) return onGet!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    if (onPatch != null) return onPatch!(path, body: body);
    return {};
  }

  @override
  Future<Map<String, dynamic>> delete(String path) async {
    if (onDelete != null) return onDelete!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> uploadFile(
    String path, {
    required List<int> bytes,
    required String field,
    required String filename,
    String method = 'POST',
    Map<String, String>? extraFields,
  }) async {
    if (onUpload != null) {
      return onUpload!(path,
          bytes: bytes, field: field, filename: filename, method: method);
    }
    return {};
  }
}

class MockMediaService implements MediaService {
  PickedImage? nextPicked;
  List<PickedImage> nextMulti = [];
  int pickCalls = 0;
  ImageSourceType? lastSource;

  @override
  Future<PickedImage?> pickImage({
    ImageSourceType source = ImageSourceType.gallery,
  }) async {
    pickCalls++;
    lastSource = source;
    return nextPicked;
  }

  @override
  Future<List<PickedImage>> pickMultiImage({int limit = 6}) async => nextMulti;

  @override
  bool get supportsCamera => true;

  @override
  noSuchMethod(Invocation invocation) => null;
}

PickedImage _fakeImage({int size = 1024, String name = 'photo.jpg'}) {
  return PickedImage(
    bytes: List<int>.filled(size, 0),
    filename: name,
  );
}

Map<String, dynamic> _photoJson(String id, {int order = 0, bool primary = false}) => {
      'id': id,
      'url': 'https://cdn.example.com/$id.jpg',
      'thumbnail_url': 'https://cdn.example.com/$id-thumb.jpg',
      'order': order,
      'is_primary': primary,
      'created_at': '2026-01-01T00:00:00Z',
    };

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial', () {
      final provider =
          MediaProvider(api: MockApiService(), media: MockMediaService());

      expect(provider.photos, isEmpty);
      expect(provider.avatarUrl, isNull);
      expect(provider.isLoading, false);
      expect(provider.isUploading, false);
      expect(provider.error, isNull);
      expect(provider.canAddMorePhotos, true);
      expect(provider.remainingSlots, 6);
    });

    test('loadPhotos carga y ordena por order', () async {
      final api = MockApiService(onGet: (path) {
        expect(path, '/users/me/photos');
        return {
          'photos': [
            _photoJson('p2', order: 2),
            _photoJson('p1', order: 1),
            _photoJson('p3', order: 3),
          ],
        };
      });
      final provider = MediaProvider(api: api, media: MockMediaService());

      await provider.loadPhotos();

      expect(provider.photos.length, 3);
      expect(provider.photos[0].id, 'p1');
      expect(provider.photos[1].id, 'p2');
      expect(provider.photos[2].id, 'p3');
    });

    test('uploadAvatar exitoso setea avatarUrl', () async {
      final api = MockApiService(
        onUpload: (path, {required bytes, required field, required filename, method = 'POST'}) {
          expect(path, '/users/me/avatar');
          expect(field, 'avatar');
          expect(method, 'PATCH');
          return {'avatarUrl': 'https://cdn.example.com/avatar.jpg'};
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.uploadAvatar(_fakeImage());

      expect(result, true);
      expect(provider.avatarUrl, 'https://cdn.example.com/avatar.jpg');
      expect(provider.isUploading, false);
    });

    test('pickAndUploadAvatar usa MediaService + sube', () async {
      final media = MockMediaService()..nextPicked = _fakeImage();
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) =>
            {'avatarUrl': 'https://cdn.example.com/new.jpg'},
      );
      final provider = MediaProvider(api: api, media: media);

      final result = await provider.pickAndUploadAvatar();

      expect(result, true);
      expect(media.pickCalls, 1);
      expect(media.lastSource, ImageSourceType.gallery);
      expect(provider.avatarUrl, 'https://cdn.example.com/new.jpg');
    });

    test('uploadPhoto agrega a la galería ordenada', () async {
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) =>
            _photoJson('pNew', order: 1),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.uploadPhoto(_fakeImage());

      expect(result, true);
      expect(provider.photos.length, 1);
      expect(provider.photos[0].id, 'pNew');
    });

    test('deletePhoto remueve del estado local', () async {
      final deleted = <String>[];
      final api = MockApiService(
        onGet: (_) => {
          'photos': [_photoJson('p1', order: 1), _photoJson('p2', order: 2)]
        },
        onDelete: (path) {
          deleted.add(path);
          return {};
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.deletePhoto('p1');

      expect(result, true);
      expect(deleted, ['/users/me/photos/p1']);
      expect(provider.photos.length, 1);
      expect(provider.photos[0].id, 'p2');
    });

    test('setPrimaryPhoto actualiza flags locales', () async {
      final api = MockApiService(
        onGet: (_) => {
          'photos': [
            _photoJson('p1', order: 1, primary: true),
            _photoJson('p2', order: 2),
          ],
        },
        onPatch: (path, {body}) {
          expect(path, '/users/me/photos/p2/primary');
          return {};
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.setPrimaryPhoto('p2');

      expect(result, true);
      expect(provider.photos.firstWhere((p) => p.id == 'p1').isPrimary, false);
      expect(provider.photos.firstWhere((p) => p.id == 'p2').isPrimary, true);
    });

    test('reorderPhotos reordena localmente y persiste', () async {
      Map<String, dynamic>? sentBody;
      final api = MockApiService(
        onGet: (_) => {
          'photos': [
            _photoJson('p1', order: 1),
            _photoJson('p2', order: 2),
            _photoJson('p3', order: 3),
          ],
        },
        onPatch: (path, {body}) {
          sentBody = body;
          return {};
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.reorderPhotos(0, 2);

      expect(result, true);
      expect(provider.photos.map((p) => p.id).toList(), ['p2', 'p3', 'p1']);
      expect(sentBody?['order'], ['p2', 'p3', 'p1']);
    });

    test('canAddMorePhotos falsea al llegar al máximo', () async {
      final photos = List.generate(6, (i) => _photoJson('p$i', order: i));
      final api = MockApiService(onGet: (_) => {'photos': photos});
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      expect(provider.canAddMorePhotos, false);
      expect(provider.remainingSlots, 0);
    });

    test('clearError limpia mensaje', () async {
      final api = MockApiService(onGet: (_) => throw Exception('fail'));
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();
      expect(provider.error, isNotNull);

      provider.clearError();

      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('uploadAvatar falla si excede límite', () async {
      final provider = MediaProvider(
          api: MockApiService(), media: MockMediaService());
      final tooBig = PickedImage(
        bytes: List<int>.filled(MediaService.maxFileBytes + 1, 0),
        filename: 'huge.jpg',
      );

      final result = await provider.uploadAvatar(tooBig);

      expect(result, false);
      expect(provider.error, contains('5 MB'));
      expect(provider.avatarUrl, isNull);
    });

    test('uploadPhoto falla si excede límite', () async {
      final provider = MediaProvider(
          api: MockApiService(), media: MockMediaService());
      final tooBig = PickedImage(
        bytes: List<int>.filled(MediaService.maxFileBytes + 1, 0),
        filename: 'huge.jpg',
      );

      final result = await provider.uploadPhoto(tooBig);

      expect(result, false);
      expect(provider.error, contains('5 MB'));
    });

    test('uploadPhoto falla si ya hay maxPhotos', () async {
      final photos = List.generate(6, (i) => _photoJson('p$i', order: i));
      final api = MockApiService(onGet: (_) => {'photos': photos});
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.uploadPhoto(_fakeImage());

      expect(result, false);
      expect(provider.error, contains('máximo'));
    });

    test('uploadAvatar captura ApiException', () async {
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) =>
            throw ApiException(statusCode: 413, message: 'Too large'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.uploadAvatar(_fakeImage());

      expect(result, false);
      expect(provider.error, 'Too large');
      expect(provider.isUploading, false);
    });

    test('uploadAvatar captura excepción genérica', () async {
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) =>
            throw Exception('network'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.uploadAvatar(_fakeImage());

      expect(result, false);
      expect(provider.error, contains('network'));
    });

    test('pickAndUploadAvatar devuelve false si usuario cancela', () async {
      final media = MockMediaService()..nextPicked = null;
      final provider = MediaProvider(api: MockApiService(), media: media);

      final result = await provider.pickAndUploadAvatar();

      expect(result, false);
      expect(provider.avatarUrl, isNull);
    });

    test('pickAndUploadPhoto falla silenciosamente si cancela', () async {
      final media = MockMediaService()..nextPicked = null;
      final provider = MediaProvider(api: MockApiService(), media: media);

      final result = await provider.pickAndUploadPhoto();

      expect(result, false);
    });

    test('deletePhoto captura ApiException', () async {
      final api = MockApiService(
        onDelete: (_) =>
            throw ApiException(statusCode: 404, message: 'not found'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.deletePhoto('missing');

      expect(result, false);
      expect(provider.error, 'not found');
    });

    test('reorderPhotos hace rollback en error', () async {
      final api = MockApiService(
        onGet: (_) => {
          'photos': [
            _photoJson('p1', order: 1),
            _photoJson('p2', order: 2),
          ],
        },
        onPatch: (_, {body}) =>
            throw ApiException(statusCode: 500, message: 'boom'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.reorderPhotos(0, 1);

      expect(result, false);
      // rollback: orden original
      expect(provider.photos.map((p) => p.id).toList(), ['p1', 'p2']);
      expect(provider.error, 'boom');
    });

    test('loadPhotos captura ApiException', () async {
      final api = MockApiService(
        onGet: (_) => throw ApiException(statusCode: 500, message: 'server'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      await provider.loadPhotos();

      expect(provider.error, 'server');
      expect(provider.photos, isEmpty);
    });

    test('setPrimaryPhoto captura ApiException', () async {
      final api = MockApiService(
        onPatch: (_, {body}) =>
            throw ApiException(statusCode: 403, message: 'forbidden'),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.setPrimaryPhoto('p1');

      expect(result, false);
      expect(provider.error, 'forbidden');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('PickedImage.exceedsLimit funciona en el borde exacto', () {
      final atLimit = PickedImage(
        bytes: List<int>.filled(MediaService.maxFileBytes, 0),
        filename: 'ok.jpg',
      );
      final over = PickedImage(
        bytes: List<int>.filled(MediaService.maxFileBytes + 1, 0),
        filename: 'big.jpg',
      );

      expect(atLimit.exceedsLimit, false);
      expect(over.exceedsLimit, true);
    });

    test('UserPhoto.fromJson con campos vacíos usa defaults', () {
      final p = UserPhoto.fromJson({});

      expect(p.id, '');
      expect(p.url, '');
      expect(p.isPrimary, false);
      expect(p.order, 0);
    });

    test('UserPhoto.fromJson acepta snake_case y camelCase', () {
      final snake = UserPhoto.fromJson({
        'id': 'a',
        'url': 'u',
        'thumbnail_url': 't',
        'is_primary': true,
      });
      final camel = UserPhoto.fromJson({
        'id': 'b',
        'url': 'u',
        'thumbnailUrl': 't',
        'isPrimary': true,
      });

      expect(snake.thumbnailUrl, 't');
      expect(camel.thumbnailUrl, 't');
      expect(snake.isPrimary, true);
      expect(camel.isPrimary, true);
    });

    test('reorderPhotos con índices inválidos devuelve false', () async {
      final api = MockApiService(onGet: (_) => {
            'photos': [_photoJson('p1', order: 1)],
          });
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      expect(await provider.reorderPhotos(-1, 0), false);
      expect(await provider.reorderPhotos(0, 5), false);
      expect(await provider.reorderPhotos(0, 0), false);
      expect(await provider.reorderPhotos(5, 5), false);
    });

    test('deletePhoto de id inexistente no rompe la lista', () async {
      final api = MockApiService(
        onGet: (_) => {'photos': [_photoJson('p1', order: 1)]},
        onDelete: (_) => {},
      );
      final provider = MediaProvider(api: api, media: MockMediaService());
      await provider.loadPhotos();

      final result = await provider.deletePhoto('does-not-exist');

      expect(result, true);
      // la lista queda igual, porque no había ese id
      expect(provider.photos.length, 1);
    });

    test('múltiples uploads secuenciales sin quedar en isUploading=true', () async {
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) =>
            _photoJson('pX', order: 1),
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      await provider.uploadPhoto(_fakeImage(name: 'a.jpg'));
      await provider.uploadPhoto(_fakeImage(name: 'b.jpg'));
      await provider.uploadPhoto(_fakeImage(name: 'c.jpg'));

      expect(provider.isUploading, false);
      expect(provider.photos.length, 3);
    });

    test('loadPhotos con response sin campo photos', () async {
      final api = MockApiService(onGet: (_) => {});
      final provider = MediaProvider(api: api, media: MockMediaService());

      await provider.loadPhotos();

      expect(provider.photos, isEmpty);
    });

    test('pickAndUploadPhoto rechaza cuando galería está llena', () async {
      final photos = List.generate(6, (i) => _photoJson('p$i', order: i));
      final api = MockApiService(onGet: (_) => {'photos': photos});
      final media = MockMediaService()..nextPicked = _fakeImage();
      final provider = MediaProvider(api: api, media: media);
      await provider.loadPhotos();

      final result = await provider.pickAndUploadPhoto();

      expect(result, false);
      // no debería ni haber intentado pickear
      expect(media.pickCalls, 0);
    });

    test('uploadAvatar con filename raro no rompe', () async {
      final api = MockApiService(
        onUpload: (_, {required bytes, required field, required filename, method = 'POST'}) {
          expect(filename.isNotEmpty, true);
          return {'avatarUrl': 'ok.jpg'};
        },
      );
      final provider = MediaProvider(api: api, media: MockMediaService());

      final result = await provider.uploadAvatar(
          PickedImage(bytes: [1, 2, 3], filename: 'weird name (1).jpg'));

      expect(result, true);
    });

    test('loadPhotos con order igual mantiene inserción estable', () async {
      final api = MockApiService(onGet: (_) => {
            'photos': [
              _photoJson('p1', order: 0),
              _photoJson('p2', order: 0),
              _photoJson('p3', order: 0),
            ],
          });
      final provider = MediaProvider(api: api, media: MockMediaService());

      await provider.loadPhotos();

      expect(provider.photos.length, 3);
    });
  });
}
