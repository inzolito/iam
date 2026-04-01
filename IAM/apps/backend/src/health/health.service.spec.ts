import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('HealthService', () => {
  let service: HealthService;
  let supabaseService: jest.Mocked<Partial<SupabaseService>>;

  beforeEach(async () => {
    supabaseService = {
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('should return ok when database is healthy', async () => {
      supabaseService.isHealthy!.mockResolvedValue(true);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result.timestamp).toBeDefined();
    });

    it('should return a valid ISO timestamp', async () => {
      supabaseService.isHealthy!.mockResolvedValue(true);

      const result = await service.check();
      const date = new Date(result.timestamp);

      expect(date.toISOString()).toBe(result.timestamp);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('should throw ServiceUnavailableException when DB is down', async () => {
      supabaseService.isHealthy!.mockResolvedValue(false);

      await expect(service.check()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should include error details in the exception response', async () => {
      supabaseService.isHealthy!.mockResolvedValue(false);

      try {
        await service.check();
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const response = (err as ServiceUnavailableException).getResponse();
        expect(response).toHaveProperty('status', 'error');
        expect(response).toHaveProperty('database', 'disconnected');
      }
    });

    it('should propagate unexpected errors from SupabaseService', async () => {
      supabaseService.isHealthy!.mockRejectedValue(
        new Error('Unexpected failure'),
      );

      await expect(service.check()).rejects.toThrow('Unexpected failure');
    });
  });
});
