import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupabaseService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  SUPABASE_URL: 'https://test.supabase.co',
                  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<SupabaseService>(SupabaseService);
      service.onModuleInit();
    });

    it('should initialize the Supabase client', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });

    it('should expose getClient() after init', () => {
      expect(() => service.getClient()).not.toThrow();
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('should throw when SUPABASE_URL is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupabaseService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                if (key === 'SUPABASE_URL') {
                  throw new Error('Config variable SUPABASE_URL not found');
                }
                return 'test-value';
              }),
            },
          },
        ],
      }).compile();

      service = module.get<SupabaseService>(SupabaseService);

      expect(() => service.onModuleInit()).toThrow(
        'Config variable SUPABASE_URL not found',
      );
    });

    it('should throw when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupabaseService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
                  throw new Error(
                    'Config variable SUPABASE_SERVICE_ROLE_KEY not found',
                  );
                }
                return 'https://test.supabase.co';
              }),
            },
          },
        ],
      }).compile();

      service = module.get<SupabaseService>(SupabaseService);

      expect(() => service.onModuleInit()).toThrow(
        'Config variable SUPABASE_SERVICE_ROLE_KEY not found',
      );
    });

    it('isHealthy should return false when query fails', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupabaseService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  SUPABASE_URL: 'https://invalid.supabase.co',
                  SUPABASE_SERVICE_ROLE_KEY: 'invalid-key',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<SupabaseService>(SupabaseService);
      service.onModuleInit();

      // Con credenciales inválidas, isHealthy debería retornar false
      const result = await service.isHealthy();
      expect(result).toBe(false);
    });
  });
});
