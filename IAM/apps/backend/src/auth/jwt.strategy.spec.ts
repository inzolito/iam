import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const activeUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'active@example.com',
    auth_provider: 'google',
    auth_id: 'google-sub-123',
    username: 'activeuser',
    display_name: 'Active User',
    birth_date: '2000-01-15',
    is_teen: false,
    avatar_url: null,
    msn_status: null,
    energy_level: 2,
    notif_level: 2,
    is_active: true,
    onboarding_completed: true,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  };

  const inactiveUser = {
    ...activeUser,
    id: '223e4567-e89b-12d3-a456-426614174001',
    email: 'inactive@example.com',
    is_active: false,
  };

  const teenUser = {
    ...activeUser,
    id: '323e4567-e89b-12d3-a456-426614174002',
    email: 'teen@example.com',
    birth_date: '2009-06-15',
    is_teen: true,
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('should return user data when token payload has valid active user', async () => {
      usersService.findById!.mockResolvedValue(activeUser);

      const result = await strategy.validate({
        sub: activeUser.id,
        email: activeUser.email,
      });

      expect(result).toEqual({
        id: activeUser.id,
        email: activeUser.email,
        isTeen: false,
      });
    });

    it('should correctly identify teen users', async () => {
      usersService.findById!.mockResolvedValue(teenUser);

      const result = await strategy.validate({
        sub: teenUser.id,
        email: teenUser.email,
      });

      expect(result.isTeen).toBe(true);
    });

    it('should call findById with the sub from JWT payload', async () => {
      usersService.findById!.mockResolvedValue(activeUser);

      await strategy.validate({ sub: activeUser.id, email: activeUser.email });

      expect(usersService.findById).toHaveBeenCalledWith(activeUser.id);
      expect(usersService.findById).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('should throw UnauthorizedException when user does not exist in DB', async () => {
      usersService.findById!.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'nonexistent-id', email: 'ghost@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw AUTH_USER_INACTIVE when user does not exist', async () => {
      usersService.findById!.mockResolvedValue(null);

      try {
        await strategy.validate({ sub: 'nonexistent-id', email: 'ghost@example.com' });
        fail('Should have thrown');
      } catch (err) {
        expect((err as UnauthorizedException).message).toBe('AUTH_USER_INACTIVE');
      }
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      usersService.findById!.mockResolvedValue(inactiveUser);

      await expect(
        strategy.validate({ sub: inactiveUser.id, email: inactiveUser.email }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw AUTH_USER_INACTIVE when user is deactivated', async () => {
      usersService.findById!.mockResolvedValue(inactiveUser);

      try {
        await strategy.validate({ sub: inactiveUser.id, email: inactiveUser.email });
        fail('Should have thrown');
      } catch (err) {
        expect((err as UnauthorizedException).message).toBe('AUTH_USER_INACTIVE');
      }
    });

    it('should throw when DB call fails and returns null', async () => {
      // Simula un error de DB donde findById retorna null
      usersService.findById!.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'some-id', email: 'test@test.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 200 concurrent validate calls without errors', async () => {
      usersService.findById!.mockResolvedValue(activeUser);

      const requests = Array.from({ length: 200 }, () =>
        strategy.validate({ sub: activeUser.id, email: activeUser.email }),
      );

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect(result.id).toBe(activeUser.id);
      });
    });

    it('should handle mixed valid/invalid users in concurrent calls', async () => {
      let callCount = 0;
      usersService.findById!.mockImplementation(async () => {
        callCount++;
        // Alternate between active and null (nonexistent)
        return callCount % 2 === 0 ? activeUser : null;
      });

      const requests = Array.from({ length: 100 }, () =>
        strategy
          .validate({ sub: 'any-id', email: 'any@test.com' })
          .then(() => 'success')
          .catch(() => 'failed'),
      );

      const results = await Promise.all(requests);

      const successes = results.filter((r) => r === 'success').length;
      const failures = results.filter((r) => r === 'failed').length;

      expect(successes).toBe(50);
      expect(failures).toBe(50);
    });
  });
});
