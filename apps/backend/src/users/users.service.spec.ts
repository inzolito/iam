import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RewardsService } from '../esencias/rewards.service';

describe('UsersService', () => {
  let service: UsersService;

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

  // Helper to create mock Supabase client
  function createMockSupabase(overrides: Record<string, unknown> = {}) {
    const defaultChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    };

    return {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({ ...defaultChain, ...overrides }),
      }),
    };
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('findOrCreate should create new user when not found', async () => {
      const insertChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      };

      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue(insertChain),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);

      const result = await service.findOrCreate({
        email: 'test@example.com',
        authProvider: 'google',
        authId: 'google-sub-123',
        displayName: 'Test User',
      });

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });

    it('findOrCreate should return existing user when found', async () => {
      const existingChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
      };

      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue(existingChain),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);

      const result = await service.findOrCreate({
        email: 'test@example.com',
        authProvider: 'google',
        authId: 'google-sub-123',
        displayName: 'Test User',
      });

      expect(result.id).toBe(mockUser.id);
    });

    it('findById should return user when found', async () => {
      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      const result = await service.findById(mockUser.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockUser.id);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('findById should return null when user does not exist', async () => {
      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('findById should return null when database errors', async () => {
      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection lost' },
            }),
          }),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      const result = await service.findById('some-id');

      expect(result).toBeNull();
    });

    it('findOrCreate should throw when database insert fails', async () => {
      const failInsertChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key violation' },
        }),
      };

      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue(failInsertChain),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);

      await expect(
        service.findOrCreate({
          email: 'test@example.com',
          authProvider: 'google',
          authId: 'google-sub-123',
          displayName: 'Test User',
        }),
      ).rejects.toThrow('duplicate key violation');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 100 concurrent findById calls', async () => {
      const mockSupabase = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      };

      const mockRewardsService = {
        awardLoginBonus: jest.fn().mockResolvedValue(10),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: RewardsService, useValue: mockRewardsService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);

      const requests = Array.from({ length: 100 }, () =>
        service.findById(mockUser.id),
      );

      const results = await Promise.all(requests);
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result?.id).toBe(mockUser.id);
      });
    });
  });
});
