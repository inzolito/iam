import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Verifica la conexión a la base de datos ejecutando una query simple.
   * Retorna true si la conexión es exitosa, false si falla.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.client.from('feature_flags').select('key').limit(1);

      if (error) {
        this.logger.error(`Health check failed: ${error.message}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(`Health check exception: ${String(err)}`);
      return false;
    }
  }

  /**
   * Sube un archivo a Supabase Storage y retorna su URL pública.
   * @param bucket - Nombre del bucket ('avatars' o 'gallery')
   * @param path - Ruta del archivo (e.g., 'user-123/avatar.jpg')
   * @param buffer - Contenido del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns URL pública del archivo
   */
  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      const { data, error } = await this.client.storage.from(bucket).upload(path, buffer, {
        contentType: mimeType,
        upsert: false, // Fallar si ya existe
      });

      if (error) {
        this.logger.error(`Upload failed for ${bucket}/${path}: ${error.message}`);
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Generar URL pública
      const { data: urlData } = this.client.storage.from(bucket).getPublicUrl(data.path);
      this.logger.log(`File uploaded successfully: ${bucket}/${path}`);
      return urlData.publicUrl;
    } catch (err) {
      this.logger.error(`Upload exception for ${bucket}/${path}: ${String(err)}`);
      throw err;
    }
  }

  /**
   * Elimina un archivo de Supabase Storage.
   * @param bucket - Nombre del bucket
   * @param path - Ruta del archivo
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      const { error } = await this.client.storage.from(bucket).remove([path]);

      if (error) {
        this.logger.error(`Delete failed for ${bucket}/${path}: ${error.message}`);
        throw new Error(`Storage delete failed: ${error.message}`);
      }

      this.logger.log(`File deleted successfully: ${bucket}/${path}`);
    } catch (err) {
      this.logger.error(`Delete exception for ${bucket}/${path}: ${String(err)}`);
      throw err;
    }
  }

  /**
   * Genera una URL pública para un archivo en Storage.
   * @param bucket - Nombre del bucket
   * @param path - Ruta del archivo
   * @returns URL pública
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
