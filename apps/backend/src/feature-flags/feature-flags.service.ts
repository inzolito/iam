import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export const FEATURE_FLAGS = {
  TEEN_MODE: 'teen_mode_enabled',
} as const;

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  // Cache simple en memoria — se invalida cada 5 minutos
  private readonly cache = new Map<string, { value: boolean; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly supabaseService: SupabaseService) {}

  async isEnabled(flagKey: string): Promise<boolean> {
    const cached = this.cache.get(flagKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('feature_flags')
        .select('is_enabled')
        .eq('key', flagKey)
        .single();

      if (error || !data) {
        this.logger.warn(`Feature flag "${flagKey}" not found — defaulting to false`);
        return false;
      }

      const value = Boolean(data.is_enabled);
      this.cache.set(flagKey, {
        value,
        expiresAt: Date.now() + FeatureFlagsService.CACHE_TTL_MS,
      });
      return value;
    } catch (err) {
      this.logger.error(`Error reading feature flag "${flagKey}": ${(err as Error).message}`);
      return false;
    }
  }

  // Invalidar caché explícitamente (usado en tests y admin)
  invalidateCache(flagKey?: string): void {
    if (flagKey) {
      this.cache.delete(flagKey);
    } else {
      this.cache.clear();
    }
  }
}
