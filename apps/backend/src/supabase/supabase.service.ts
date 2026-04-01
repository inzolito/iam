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
}
