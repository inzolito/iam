import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    auth_provider: 'google',
    auth_id: 'google-sub-123',
    username: null,
    display_name: 'Test User',
    birth_date: null,
    is_teen: false,
    avatar_url: null,
    msn_status: null,
    energy_level: 2,
    notif_level: 2,
    is_active: true,
    onboarding_completed: false,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    usersService = {
      findOrCreate: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn().mockResolvedValue(mockUser),
      updateStreak: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({
              sub: mockUser.id,
              email: mockUser.email,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-google-client-id'),
            getOrThrow: jest.fn().mockReturnValue('mock-jwt-secret'),
          },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('refreshToken should return a new accessToken with valid refresh token', async () => {
      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'mock-jwt-secret',
      });
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('loginWithGoogle should throw UnauthorizedException with invalid token', async () => {
      // Google's verifyIdToken will fail with an invalid token
      await expect(authService.loginWithGoogle('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('loginWithGoogle should throw with error code AUTH_INVALID_TOKEN', async () => {
      try {
        await authService.loginWithGoogle('invalid-token');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toBe('AUTH_INVALID_TOKEN');
      }
    });

    it('loginWithApple should throw UnauthorizedException with invalid token', async () => {
      await expect(authService.loginWithApple('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('loginWithApple should throw with error code AUTH_INVALID_TOKEN', async () => {
      try {
        await authService.loginWithApple('invalid-token');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toBe('AUTH_INVALID_TOKEN');
      }
    });

    it('refreshToken should throw with expired/invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(authService.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refreshToken should return AUTH_REFRESH_EXPIRED error code', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      try {
        await authService.refreshToken('expired-token');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toBe('AUTH_REFRESH_EXPIRED');
      }
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 100 simultaneous refresh token requests', async () => {
      const requests = Array.from({ length: 100 }, () =>
        authService.refreshToken('valid-refresh-token'),
      );

      const results = await Promise.all(requests);
      results.forEach((result) => {
        expect(result).toHaveProperty('accessToken');
      });
    });

    it('loginWithGoogle should not leak error details to client', async () => {
      try {
        await authService.loginWithGoogle('malicious-crafted-token');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        // Should NOT contain internal error details
        const response = (err as UnauthorizedException).getResponse();
        expect(JSON.stringify(response)).not.toContain('stack');
      }
    });
  });
});
