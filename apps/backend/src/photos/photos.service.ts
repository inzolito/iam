import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FileStorageService } from './file-storage.service';

export interface UserPhotos {
  avatar_url: string | null;
  gallery: Array<{
    id: string;
    public_url: string;
    position: number;
  }>;
}

export class InvalidFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_GALLERY_TOTAL = 10 * 1024 * 1024; // 10MB
  private readonly MAX_USER_TOTAL = 25 * 1024 * 1024; // 25MB
  private readonly MAX_GALLERY_PHOTOS = 5;
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Sube un avatar para el usuario.
   * Reemplaza el avatar anterior si existe.
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    this.validateFile(file);

    const client = this.supabaseService.getClient();
    const storagePath = `avatars/${userId}/avatar-${Date.now()}`;

    try {
      const publicUrl = await this.fileStorage.uploadFile(
        'avatars',
        storagePath,
        file.buffer,
        file.mimetype,
      );

      // Actualizar avatar_url en tabla users
      const { error } = await client
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (error) {
        // Intentar eliminar el archivo que subimos si falla la actualización
        try {
          await this.fileStorage.deleteFile('avatars', storagePath);
        } catch (delErr) {
          this.logger.warn(`Failed to cleanup uploaded avatar: ${String(delErr)}`);
        }
        throw new Error(`Failed to update avatar: ${error.message}`);
      }

      this.logger.log(`Avatar uploaded for user ${userId}`);
      return { avatar_url: publicUrl };
    } catch (err) {
      if (err instanceof InvalidFileError || err instanceof Error) {
        throw err;
      }
      throw new StorageError(`Failed to upload avatar: ${String(err)}`);
    }
  }

  /**
   * Elimina el avatar del usuario.
   */
  async deleteAvatar(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Obtener avatar_url actual
    const { data: user, error: selectError } = await client
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (selectError) {
      throw new NotFoundError(`User not found: ${selectError.message}`);
    }

    if (!user?.avatar_url) {
      // No hay avatar para eliminar, es un no-op
      return;
    }

    try {
      // Extraer path del storage de la URL pública
      const storagePath = this.extractStoragePath(user.avatar_url);
      await this.fileStorage.deleteFile('avatars', storagePath);

      // Actualizar avatar_url a null
      const { error: updateError } = await client
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to clear avatar: ${updateError.message}`);
      }

      this.logger.log(`Avatar deleted for user ${userId}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Failed to clear')) {
        throw err;
      }
      throw new StorageError(`Failed to delete avatar: ${String(err)}`);
    }
  }

  /**
   * Sube una foto de galería en una posición específica.
   * Reemplaza la foto anterior en esa posición si existe.
   */
  async uploadGalleryPhoto(
    userId: string,
    file: Express.Multer.File,
    position: number,
  ): Promise<{
    id: string;
    public_url: string;
    position: number;
  }> {
    this.validateFile(file);
    this.validatePosition(position);

    if (position < 0 || position > 4) {
      throw new InvalidFileError('Position must be between 0 and 4');
    }

    const client = this.supabaseService.getClient();

    // Verificar cuántas fotos tiene el usuario
    const { data: existingPhotos, error: countError } = await client
      .from('user_photos')
      .select('id, position, file_size, public_url')
      .eq('user_id', userId);

    if (countError) {
      throw new Error(`Failed to check existing photos: ${countError.message}`);
    }

    // Calcular tamaño total actual
    const currentTotalSize = (existingPhotos || []).reduce(
      (sum, photo) => sum + (photo.file_size || 0),
      0,
    );
    const newTotalSize = currentTotalSize + file.size;

    // Validar límites
    if (newTotalSize > this.MAX_GALLERY_TOTAL) {
      throw new InvalidFileError(
        `Gallery total size would exceed 10MB limit (current: ${Math.round(currentTotalSize / 1024 / 1024)}MB, attempting to add: ${Math.round(file.size / 1024 / 1024)}MB)`,
      );
    }

    // Si no hay foto en esa posición, validar que no excedamos 5 fotos
    const photoAtPosition = existingPhotos?.find((p) => p.position === position);
    if (!photoAtPosition && existingPhotos && existingPhotos.length >= this.MAX_GALLERY_PHOTOS) {
      throw new InvalidFileError(
        `Maximum of ${this.MAX_GALLERY_PHOTOS} gallery photos allowed per user`,
      );
    }

    const storagePath = `gallery/${userId}/photo-${position}-${Date.now()}`;

    try {
      const publicUrl = await this.supabaseService.uploadFile(
        'gallery',
        storagePath,
        file.buffer,
        file.mimetype,
      );

      // Si hay foto anterior en esa posición, eliminarla del storage
      if (photoAtPosition) {
        try {
          const oldPath = this.extractStoragePath(photoAtPosition.public_url);
          await this.fileStorage.deleteFile('gallery', oldPath);
        } catch (delErr) {
          this.logger.warn(
            `Failed to cleanup old gallery photo at position ${position}: ${String(delErr)}`,
          );
        }
      }

      // Upsert en base de datos
      const { data: photo, error: upsertError } = await client
        .from('user_photos')
        .upsert(
          {
            user_id: userId,
            position,
            storage_path: storagePath,
            public_url: publicUrl,
            file_size: file.size,
            mime_type: file.mimetype,
          },
          { onConflict: 'user_id,position' },
        )
        .select()
        .single();

      if (upsertError) {
        // Intentar eliminar el archivo subido
        try {
          await this.fileStorage.deleteFile('gallery', storagePath);
        } catch (delErr) {
          this.logger.warn(`Failed to cleanup uploaded gallery photo: ${String(delErr)}`);
        }
        throw new Error(`Failed to save gallery photo: ${upsertError.message}`);
      }

      this.logger.log(`Gallery photo uploaded for user ${userId} at position ${position}`);
      return {
        id: photo.id,
        public_url: photo.public_url,
        position: photo.position,
      };
    } catch (err) {
      if (err instanceof InvalidFileError || err instanceof Error) {
        throw err;
      }
      throw new StorageError(`Failed to upload gallery photo: ${String(err)}`);
    }
  }

  /**
   * Reordena las fotos de galería del usuario.
   */
  async reorderGalleryPhotos(
    userId: string,
    positions: Array<{ id: string; position: number }>,
  ): Promise<void> {
    if (!positions || positions.length === 0) {
      return;
    }

    const client = this.supabaseService.getClient();

    // Validar posiciones
    for (const item of positions) {
      this.validatePosition(item.position);
    }

    try {
      // Actualizar cada foto con su nueva posición
      for (const item of positions) {
        const { error } = await client
          .from('user_photos')
          .update({ position: item.position })
          .eq('id', item.id)
          .eq('user_id', userId);

        if (error) {
          throw new Error(`Failed to update position for photo ${item.id}: ${error.message}`);
        }
      }

      this.logger.log(`Reordered ${positions.length} gallery photos for user ${userId}`);
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(`Failed to reorder gallery photos: ${String(err)}`);
    }
  }

  /**
   * Elimina una foto de galería.
   */
  async deleteGalleryPhoto(userId: string, photoId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Obtener la foto
    const { data: photo, error: selectError } = await client
      .from('user_photos')
      .select('*')
      .eq('id', photoId)
      .eq('user_id', userId)
      .single();

    if (selectError || !photo) {
      throw new NotFoundError(
        `Photo not found or does not belong to user: ${selectError?.message || 'Unknown'}`,
      );
    }

    try {
      const storagePath = this.extractStoragePath(photo.public_url);
      await this.fileStorage.deleteFile('gallery', storagePath);

      // Eliminar de la BD
      const { error: deleteError } = await client
        .from('user_photos')
        .delete()
        .eq('id', photoId);

      if (deleteError) {
        throw new Error(`Failed to delete photo record: ${deleteError.message}`);
      }

      this.logger.log(`Gallery photo deleted: ${photoId}`);
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new StorageError(`Failed to delete gallery photo: ${String(err)}`);
    }
  }

  /**
   * Obtiene todas las fotos del usuario (avatar + galería).
   */
  async getUserPhotos(userId: string): Promise<UserPhotos> {
    const client = this.supabaseService.getClient();

    // Obtener avatar_url
    const { data: user, error: userError } = await client
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (userError) {
      throw new NotFoundError(`User not found: ${userError.message}`);
    }

    // Obtener galería ordenada por posición
    const { data: gallery, error: galleryError } = await client
      .from('user_photos')
      .select('id, public_url, position')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (galleryError) {
      throw new Error(`Failed to fetch gallery photos: ${galleryError.message}`);
    }

    return {
      avatar_url: user?.avatar_url || null,
      gallery: (gallery || []).map((photo) => ({
        id: photo.id,
        public_url: photo.public_url,
        position: photo.position,
      })),
    };
  }

  /**
   * Elimina todas las fotos de un usuario (admin only).
   */
  async deleteUserPhotos(userId: string, adminId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // TODO: Verificar que adminId es admin (requiere is_admin())
    // Por ahora, permitir cualquiera

    // Obtener todos las fotos del usuario
    const { data: photos, error: selectError } = await client
      .from('user_photos')
      .select('*')
      .eq('user_id', userId);

    if (selectError) {
      throw new Error(`Failed to fetch user photos: ${selectError.message}`);
    }

    // Eliminar del storage
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        try {
          const storagePath = this.extractStoragePath(photo.public_url);
          await this.fileStorage.deleteFile('gallery', storagePath);
        } catch (err) {
          this.logger.warn(`Failed to delete photo from storage: ${String(err)}`);
        }
      }
    }

    // Obtener y eliminar avatar si existe
    const { data: user, error: userError } = await client
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (!userError && user?.avatar_url) {
      try {
        const avatarPath = this.extractStoragePath(user.avatar_url);
        await this.fileStorage.deleteFile('avatars', avatarPath);
      } catch (err) {
        this.logger.warn(`Failed to delete avatar from storage: ${String(err)}`);
      }
    }

    // Eliminar de la BD
    const { error: deleteError } = await client.from('user_photos').delete().eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete photo records: ${deleteError.message}`);
    }

    // Limpiar avatar_url
    await client.from('users').update({ avatar_url: null }).eq('id', userId);

    this.logger.log(`All photos deleted for user ${userId}`);
  }

  /**
   * Elimina una foto específica (admin only).
   */
  async deletePhotoById(photoId: string, adminId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Obtener la foto
    const { data: photo, error: selectError } = await client
      .from('user_photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (selectError || !photo) {
      throw new NotFoundError(
        `Photo not found: ${selectError?.message || 'Unknown error'}`,
      );
    }

    try {
      const storagePath = this.extractStoragePath(photo.public_url);
      await this.fileStorage.deleteFile('gallery', storagePath);

      // Eliminar de la BD
      const { error: deleteError } = await client
        .from('user_photos')
        .delete()
        .eq('id', photoId);

      if (deleteError) {
        throw new Error(`Failed to delete photo record: ${deleteError.message}`);
      }

      this.logger.log(`Photo deleted by admin: ${photoId}`);
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new StorageError(`Failed to delete photo: ${String(err)}`);
    }
  }

  /**
   * Valida un archivo subido.
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new InvalidFileError('No file provided');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new InvalidFileError(
        `Invalid file type: ${file.mimetype}. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new InvalidFileError(
        `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum allowed: 5MB`,
      );
    }
  }

  /**
   * Valida una posición en la galería.
   */
  private validatePosition(position: number): void {
    if (!Number.isInteger(position) || position < 0 || position >= this.MAX_GALLERY_PHOTOS) {
      throw new InvalidFileError(
        `Invalid position: ${position}. Must be between 0 and ${this.MAX_GALLERY_PHOTOS - 1}`,
      );
    }
  }

  /**
   * Extrae la ruta de almacenamiento de una URL pública de Supabase Storage.
   * E.g., https://xxx.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg → avatars/user-123/avatar.jpg
   */
  private extractStoragePath(publicUrl: string): string {
    // La URL tiene formato: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const match = publicUrl.match(/\/public\/(.+)$/);
    if (!match) {
      throw new Error(`Failed to parse storage path from URL: ${publicUrl}`);
    }
    return match[1];
  }
}
