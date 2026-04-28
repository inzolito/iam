import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Abstracción para almacenamiento de archivos.
 * En dev: usa el filesystem local
 * En prod: usa Supabase Storage
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly supabaseService: SupabaseService) {
    if (this.isDev) {
      this.logger.log(
        `📁 File Storage en DEV: usando carpeta local ${this.uploadsDir}`,
      );
    } else {
      this.logger.log(`☁️ File Storage en PROD: usando Supabase Storage`);
    }
  }

  /**
   * Sube un archivo y retorna su URL pública.
   * @param bucket - nombre del bucket (avatars, gallery)
   * @param storagePath - ruta dentro del bucket (ej: avatars/user123/avatar.jpg)
   * @param buffer - contenido del archivo
   * @param mimeType - tipo MIME
   * @returns URL pública del archivo
   */
  async uploadFile(
    bucket: string,
    storagePath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (this.isDev) {
      return this.uploadLocal(bucket, storagePath, buffer);
    } else {
      return this.supabaseService.uploadFile(
        bucket,
        storagePath,
        buffer,
        mimeType,
      );
    }
  }

  /**
   * Elimina un archivo.
   * @param bucket - nombre del bucket
   * @param storagePath - ruta dentro del bucket
   */
  async deleteFile(bucket: string, storagePath: string): Promise<void> {
    if (this.isDev) {
      return this.deleteLocal(bucket, storagePath);
    } else {
      return this.supabaseService.deleteFile(bucket, storagePath);
    }
  }

  /**
   * Obtiene la URL pública de un archivo.
   * @param bucket - nombre del bucket
   * @param storagePath - ruta dentro del bucket
   */
  getPublicUrl(bucket: string, storagePath: string): string {
    if (this.isDev) {
      // En dev, servimos desde /uploads/bucket/storagePath
      return `/uploads/${bucket}/${storagePath}`;
    } else {
      return this.supabaseService.getPublicUrl(bucket, storagePath);
    }
  }

  // ── Métodos locales ──

  private async uploadLocal(
    bucket: string,
    storagePath: string,
    buffer: Buffer,
  ): Promise<string> {
    try {
      const fullPath = path.join(this.uploadsDir, bucket, storagePath);
      const dir = path.dirname(fullPath);

      // Crear directorio si no existe
      await fs.mkdir(dir, { recursive: true });

      // Guardar archivo
      await fs.writeFile(fullPath, buffer);

      this.logger.debug(`✅ Archivo guardado: ${fullPath}`);

      // Retornar URL relativa
      return this.getPublicUrl(bucket, storagePath);
    } catch (error) {
      this.logger.error(`❌ Error guardando archivo localmente: ${error}`);
      throw new Error(`Local upload failed: ${error.message}`);
    }
  }

  private async deleteLocal(bucket: string, storagePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadsDir, bucket, storagePath);
      await fs.unlink(fullPath);
      this.logger.debug(`✅ Archivo eliminado: ${fullPath}`);
    } catch (error) {
      // No fallar si el archivo no existe
      if (error.code !== 'ENOENT') {
        this.logger.error(`❌ Error eliminando archivo localmente: ${error}`);
        throw error;
      }
    }
  }
}
