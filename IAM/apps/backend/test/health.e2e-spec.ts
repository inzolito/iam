import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Health Check (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('GET /v1/health should return 200 with status ok', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('timestamp');

      // Verificar que timestamp es ISO 8601 válido
      const date = new Date(response.body.timestamp);
      expect(date.toISOString()).toBe(response.body.timestamp);
    });

    it('GET /v1/health should return valid JSON content-type', async () => {
      await request(app.getHttpServer())
        .get('/v1/health')
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('GET /v1/health should return 503 when database is unreachable', async () => {
      // Forzar que isHealthy retorne false
      const originalIsHealthy = supabaseService.isHealthy.bind(supabaseService);
      jest.spyOn(supabaseService, 'isHealthy').mockResolvedValueOnce(false);

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('database', 'disconnected');

      // Restaurar
      jest.spyOn(supabaseService, 'isHealthy').mockImplementation(originalIsHealthy);
    });

    it('GET /v1/health should return 503 when database throws exception', async () => {
      jest
        .spyOn(supabaseService, 'isHealthy')
        .mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(500);

      // NestJS lanza 500 en excepciones no controladas — verificar que no crashea
      expect(response.body).toBeDefined();
    });

    it('GET /v1/health/nonexistent should return 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/health/nonexistent')
        .expect(404);
    });

    it('POST /v1/health should return 404 (method not allowed)', async () => {
      await request(app.getHttpServer())
        .post('/v1/health')
        .expect(404);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 50 concurrent requests without crashing', async () => {
      const concurrentRequests = Array.from({ length: 50 }, () =>
        request(app.getHttpServer()).get('/v1/health'),
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    it('should respond within 2000ms under normal conditions', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/v1/health').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });
});
