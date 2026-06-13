import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService, FEATURE_FLAGS } from './feature-flags.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  function buildMockSupabase(flagData: { is_enabled: boolean } | null, error: any = null) {
    return {
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: flagData, error }),
            }),
          }),
        }),
      }),
    };
  }

  async function createService(supabase: any) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    return module.get<FeatureFlagsService>(FeatureFlagsService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('isEnabled retorna true cuando el flag está activado', async () => {
      service = await createService(buildMockSupabase({ is_enabled: true }));
      const result = await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      expect(result).toBe(true);
    });

    it('isEnabled retorna false cuando el flag está desactivado', async () => {
      service = await createService(buildMockSupabase({ is_enabled: false }));
      const result = await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      expect(result).toBe(false);
    });

    it('isEnabled cachea el resultado — segunda llamada no consulta DB', async () => {
      let dbCallCount = 0;
      const supabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => {
                  dbCallCount++;
                  return { data: { is_enabled: true }, error: null };
                },
              }),
            }),
          }),
        }),
      };
      service = await createService(supabase);

      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);

      expect(dbCallCount).toBe(1);
    });

    it('invalidateCache fuerza nueva consulta a DB', async () => {
      let dbCallCount = 0;
      const supabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => {
                  dbCallCount++;
                  return { data: { is_enabled: true }, error: null };
                },
              }),
            }),
          }),
        }),
      };
      service = await createService(supabase);

      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      service.invalidateCache(FEATURE_FLAGS.TEEN_MODE);
      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);

      expect(dbCallCount).toBe(2);
    });

    it('invalidateCache sin argumento limpia todo el caché', async () => {
      let dbCallCount = 0;
      const supabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => {
                  dbCallCount++;
                  return { data: { is_enabled: true }, error: null };
                },
              }),
            }),
          }),
        }),
      };
      service = await createService(supabase);

      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      service.invalidateCache();
      await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);

      expect(dbCallCount).toBe(2);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('retorna false cuando el flag no existe en DB', async () => {
      service = await createService(buildMockSupabase(null, { message: 'not found' }));
      const result = await service.isEnabled('flag_inexistente');
      expect(result).toBe(false);
    });

    it('retorna false cuando hay error de DB (no lanza excepción)', async () => {
      const supabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => { throw new Error('DB connection failed'); },
              }),
            }),
          }),
        }),
      };
      service = await createService(supabase);
      const result = await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      expect(result).toBe(false);
    });

    it('FEATURE_FLAGS.TEEN_MODE exporta la clave correcta', () => {
      expect(FEATURE_FLAGS.TEEN_MODE).toBe('teen_mode_enabled');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('múltiples flags independientes se cachean por separado', async () => {
      const flags: Record<string, boolean> = {
        teen_mode_enabled: true,
        otro_flag: false,
      };
      const supabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: (_col: string, key: string) => ({
                single: async () => ({ data: { is_enabled: flags[key] ?? false }, error: null }),
              }),
            }),
          }),
        }),
      };
      service = await createService(supabase);

      const teen = await service.isEnabled('teen_mode_enabled');
      const otro = await service.isEnabled('otro_flag');

      expect(teen).toBe(true);
      expect(otro).toBe(false);
    });

    it('valor is_enabled=0 (falsy) se interpreta como false', async () => {
      service = await createService(buildMockSupabase({ is_enabled: false }));
      const result = await service.isEnabled(FEATURE_FLAGS.TEEN_MODE);
      expect(result).toBe(false);
    });
  });
});
