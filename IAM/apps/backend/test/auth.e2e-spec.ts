import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('POST /v1/auth/refresh should return new accessToken with valid refresh', async () => {
      // Generate a valid refresh token
      const refreshToken = jwtService.sign(
        { sub: '123e4567-e89b-12d3-a456-426614174000', email: 'test@test.com' },
        { expiresIn: '7d' },
      );

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.split('.')).toHaveLength(3); // JWT format
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('POST /v1/auth/google with invalid token should return 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/google')
        .send({ idToken: 'completely-invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('AUTH_INVALID_TOKEN');
    });

    it('POST /v1/auth/apple with invalid token should return 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/apple')
        .send({ idToken: 'completely-invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('AUTH_INVALID_TOKEN');
    });

    it('POST /v1/auth/refresh with expired token should return 401', async () => {
      // Generate an already-expired token
      const expiredToken = jwtService.sign(
        { sub: 'some-id', email: 'test@test.com' },
        { expiresIn: '0s' },
      );

      // Wait a tiny bit to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body.message).toBe('AUTH_REFRESH_EXPIRED');
    });

    it('POST /v1/auth/refresh with manipulated token should return 401', async () => {
      const manipulatedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIn0.INVALID_SIGNATURE';

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: manipulatedToken })
        .expect(401);
    });

    it('POST /v1/auth/google with empty body should return error', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/google')
        .send({})
        .expect(401);
    });

    it('POST /v1/auth/google with missing idToken should return 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/google')
        .send({ wrongField: 'value' })
        .expect(401);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 50 concurrent invalid login attempts without crashing', async () => {
      const requests = Array.from({ length: 50 }, () =>
        request(app.getHttpServer())
          .post('/v1/auth/google')
          .send({ idToken: 'invalid-token' }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });

    it('should handle 50 concurrent refresh requests', async () => {
      const validToken = jwtService.sign(
        { sub: 'test-id', email: 'test@test.com' },
        { expiresIn: '7d' },
      );

      const requests = Array.from({ length: 50 }, () =>
        request(app.getHttpServer())
          .post('/v1/auth/refresh')
          .send({ refreshToken: validToken }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('accessToken');
      });
    });
  });
});
