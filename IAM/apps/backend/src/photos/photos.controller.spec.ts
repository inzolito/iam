import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import {
  PhotosService,
  InvalidFileError,
  NotFoundError,
} from './photos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('PhotosController', () => {
  let controller: PhotosController;
  let mockPhotosService: jest.Mocked<Partial<PhotosService>>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPhotoId = '123e4567-e89b-12d3-a456-426614174001';
  const mockRequest = { user: { id: mockUserId } };

  const createMockFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 2 * 1024 * 1024,
    destination: '/tmp',
    filename: 'test.jpg',
    path: '/tmp/test.jpg',
    buffer: Buffer.from('fake image data'),
    ...overrides,
  });

  beforeEach(async () => {
    mockPhotosService = {
      uploadAvatar: jest.fn(),
      deleteAvatar: jest.fn(),
      uploadGalleryPhoto: jest.fn(),
      reorderGalleryPhotos: jest.fn(),
      deleteGalleryPhoto: jest.fn(),
      getUserPhotos: jest.fn(),
      deleteUserPhotos: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [{ provide: PhotosService, useValue: mockPhotosService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PhotosController>(PhotosController);
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('POST /photos/avatar returns avatar_url', async () => {
      const avatarUrl = 'https://xxx.supabase.co/storage/v1/object/public/avatars/123/avatar.jpg';
      mockPhotosService.uploadAvatar = jest.fn().mockResolvedValueOnce({ avatar_url: avatarUrl });

      const file = createMockFile();
      const result = await controller.uploadAvatar(file, mockRequest);

      expect(result).toEqual({ avatar_url: avatarUrl });
      expect(mockPhotosService.uploadAvatar).toHaveBeenCalledWith(mockUserId, file);
    });

    it('DELETE /photos/avatar returns 204 No Content', async () => {
      mockPhotosService.deleteAvatar = jest.fn().mockResolvedValueOnce(undefined);

      await controller.deleteAvatar(mockRequest);

      expect(mockPhotosService.deleteAvatar).toHaveBeenCalledWith(mockUserId);
    });

    it('GET /photos/my-photos returns { avatar_url, gallery }', async () => {
      const userPhotos = {
        avatar_url: 'https://xxx.supabase.co/storage/v1/object/public/avatars/123/avatar.jpg',
        gallery: [
          {
            id: mockPhotoId,
            public_url: 'https://xxx.supabase.co/storage/v1/object/public/gallery/123/photo-0.jpg',
            position: 0,
          },
        ],
      };
      mockPhotosService.getUserPhotos = jest.fn().mockResolvedValueOnce(userPhotos);

      const result = await controller.getMyPhotos(mockRequest);

      expect(result).toEqual(userPhotos);
      expect(mockPhotosService.getUserPhotos).toHaveBeenCalledWith(mockUserId);
    });

    it('POST /photos/gallery returns { id, public_url, position }', async () => {
      const photoResponse = {
        id: mockPhotoId,
        public_url: 'https://xxx.supabase.co/storage/v1/object/public/gallery/123/photo-0.jpg',
        position: 0,
      };
      mockPhotosService.uploadGalleryPhoto = jest.fn().mockResolvedValueOnce(photoResponse);

      const file = createMockFile();
      const result = await controller.uploadGalleryPhoto(file, '0', mockRequest);

      expect(result).toEqual(photoResponse);
      expect(mockPhotosService.uploadGalleryPhoto).toHaveBeenCalledWith(mockUserId, file, 0);
    });

    it('PATCH /photos/gallery/reorder returns success', async () => {
      mockPhotosService.reorderGalleryPhotos = jest.fn().mockResolvedValueOnce(undefined);

      const positions = [{ id: mockPhotoId, position: 1 }];
      const result = await controller.reorderGalleryPhotos(positions, mockRequest);

      expect(result).toEqual({ success: true });
      expect(mockPhotosService.reorderGalleryPhotos).toHaveBeenCalledWith(mockUserId, positions);
    });

    it('DELETE /photos/gallery/:id returns 204 No Content', async () => {
      mockPhotosService.deleteGalleryPhoto = jest.fn().mockResolvedValueOnce(undefined);

      await controller.deleteGalleryPhoto(mockPhotoId, mockRequest);

      expect(mockPhotosService.deleteGalleryPhoto).toHaveBeenCalledWith(mockUserId, mockPhotoId);
    });

    it('DELETE /photos/:userId returns success and deleted_count', async () => {
      mockPhotosService.getUserPhotos = jest.fn().mockResolvedValueOnce({
        avatar_url: 'https://xxx.supabase.co/storage/v1/object/public/avatars/123/avatar.jpg',
        gallery: [{ id: '1', public_url: 'url1', position: 0 }, { id: '2', public_url: 'url2', position: 1 }],
      });
      mockPhotosService.deleteUserPhotos = jest.fn().mockResolvedValueOnce(undefined);

      const result = await controller.deleteUserPhotos('target-user-id', mockRequest);

      expect(result).toEqual({ success: true, deleted_count: 3 }); // 2 gallery + 1 avatar
    });

    it('POST /photos/gallery at position 4 succeeds', async () => {
      const photoResponse = {
        id: mockPhotoId,
        public_url: 'https://xxx.supabase.co/storage/v1/object/public/gallery/123/photo-4.jpg',
        position: 4,
      };
      mockPhotosService.uploadGalleryPhoto = jest.fn().mockResolvedValueOnce(photoResponse);

      const file = createMockFile();
      const result = await controller.uploadGalleryPhoto(file, '4', mockRequest);

      expect(result.position).toBe(4);
    });

    it('GET /photos/my-photos returns empty gallery when user has no photos', async () => {
      mockPhotosService.getUserPhotos = jest.fn().mockResolvedValueOnce({
        avatar_url: null,
        gallery: [],
      });

      const result = await controller.getMyPhotos(mockRequest);

      expect(result.avatar_url).toBeNull();
      expect(result.gallery).toEqual([]);
    });

    it('PATCH /photos/gallery/reorder with empty array succeeds', async () => {
      mockPhotosService.reorderGalleryPhotos = jest.fn().mockResolvedValueOnce(undefined);

      const result = await controller.reorderGalleryPhotos([], mockRequest);

      expect(result).toEqual({ success: true });
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('POST /photos/avatar with no file throws BadRequestException', async () => {
      await expect(controller.uploadAvatar(null as any, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('POST /photos/avatar with InvalidFileError throws BadRequestException', async () => {
      mockPhotosService.uploadAvatar = jest
        .fn()
        .mockRejectedValueOnce(new InvalidFileError('Invalid file type: image/gif'));

      const file = createMockFile({ mimetype: 'image/gif' });
      await expect(controller.uploadAvatar(file, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('POST /photos/gallery with no position throws BadRequestException', async () => {
      const file = createMockFile();
      await expect(controller.uploadGalleryPhoto(file, '', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('POST /photos/gallery with invalid position string throws BadRequestException', async () => {
      const file = createMockFile();
      await expect(
        controller.uploadGalleryPhoto(file, 'invalid', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('POST /photos/gallery with no file throws BadRequestException', async () => {
      await expect(
        controller.uploadGalleryPhoto(null as any, '0', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('POST /photos/gallery with InvalidFileError throws BadRequestException', async () => {
      mockPhotosService.uploadGalleryPhoto = jest
        .fn()
        .mockRejectedValueOnce(new InvalidFileError('Maximum of 5 gallery photos'));

      const file = createMockFile();
      await expect(controller.uploadGalleryPhoto(file, '5', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DELETE /photos/gallery/:id with NotFoundError throws BadRequestException', async () => {
      mockPhotosService.deleteGalleryPhoto = jest
        .fn()
        .mockRejectedValueOnce(new NotFoundError('Photo not found'));

      await expect(controller.deleteGalleryPhoto('invalid-id', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('PATCH /photos/gallery/reorder with non-array throws BadRequestException', async () => {
      await expect(
        controller.reorderGalleryPhotos('not-an-array' as any, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('POST /photos/avatar propagates non-InvalidFileError errors', async () => {
      mockPhotosService.uploadAvatar = jest
        .fn()
        .mockRejectedValueOnce(new Error('Database connection lost'));

      const file = createMockFile();
      await expect(controller.uploadAvatar(file, mockRequest)).rejects.toThrow(
        'Database connection lost',
      );
    });

    it('rapid consecutive uploads do not cross-contaminate state', async () => {
      let callCount = 0;
      mockPhotosService.uploadGalleryPhoto = jest.fn().mockImplementation(
        (_userId, _file, position) => {
          callCount++;
          return Promise.resolve({
            id: `photo-${position}`,
            public_url: `url-${position}`,
            position,
          });
        },
      );

      const file = createMockFile();
      const results = await Promise.all([
        controller.uploadGalleryPhoto(file, '0', mockRequest),
        controller.uploadGalleryPhoto(file, '1', mockRequest),
        controller.uploadGalleryPhoto(file, '2', mockRequest),
      ]);

      expect(results[0].position).toBe(0);
      expect(results[1].position).toBe(1);
      expect(results[2].position).toBe(2);
      expect(callCount).toBe(3);
    });

    it('DELETE /photos/:userId with zero photos returns deleted_count 0', async () => {
      mockPhotosService.getUserPhotos = jest.fn().mockResolvedValueOnce({
        avatar_url: null,
        gallery: [],
      });
      mockPhotosService.deleteUserPhotos = jest.fn().mockResolvedValueOnce(undefined);

      const result = await controller.deleteUserPhotos('target-user-id', mockRequest);

      expect(result).toEqual({ success: true, deleted_count: 0 });
    });

    it('POST /photos/gallery with position 0 parsed correctly', async () => {
      const photoResponse = {
        id: mockPhotoId,
        public_url: 'url',
        position: 0,
      };
      mockPhotosService.uploadGalleryPhoto = jest.fn().mockResolvedValueOnce(photoResponse);

      const file = createMockFile();
      await controller.uploadGalleryPhoto(file, '0', mockRequest);

      expect(mockPhotosService.uploadGalleryPhoto).toHaveBeenCalledWith(mockUserId, file, 0);
    });

    it('DELETE /photos/avatar when no avatar does not fail', async () => {
      mockPhotosService.deleteAvatar = jest.fn().mockResolvedValueOnce(undefined);

      await controller.deleteAvatar(mockRequest);

      expect(mockPhotosService.deleteAvatar).toHaveBeenCalled();
    });

    it('GET /photos/my-photos propagates NotFoundError', async () => {
      mockPhotosService.getUserPhotos = jest
        .fn()
        .mockRejectedValueOnce(new NotFoundError('User not found'));

      await expect(controller.getMyPhotos(mockRequest)).rejects.toThrow(NotFoundError);
    });

    it('PATCH /photos/gallery/reorder with InvalidFileError throws BadRequestException', async () => {
      mockPhotosService.reorderGalleryPhotos = jest
        .fn()
        .mockRejectedValueOnce(new InvalidFileError('Invalid position'));

      await expect(
        controller.reorderGalleryPhotos([{ id: 'x', position: 10 }], mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
