import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RewardsService } from '../esencias/rewards.service';

/**
 * Tests exhaustivos para updateStreak.
 * Esta lógica determina las rachas de los usuarios,
 * que a su vez desbloquean Esencias y recompensas en venues.
 */
describe('UsersService — updateStreak', () => {
  // Captures the data passed to .update()
  let capturedUpdateData: Record<string, unknown> | null;
  let updateCalled: boolean;

  function daysAgo(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().split('T')[0];
  }

  function today(): string {
    return new Date().toISOString().split('T')[0];
  }

  async function buildService(streakData: Record<string, unknown> | null): Promise<UsersService> {
    capturedUpdateData = null;
    updateCalled = false;

    const mockSupabase = {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'user_streaks') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: streakData,
                    error: null,
                  }),
                }),
              }),
              update: (data: Record<string, unknown>) => {
                capturedUpdateData = data;
                updateCalled = true;
                return {
                  eq: () => Promise.resolve({ error: null }),
                };
              },
            };
          }
          // Default for other tables
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
          };
        },
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

    return module.get<UsersService>(UsersService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('first login ever (last_login_date = null) → streak = 1', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 0,
        longest_streak: 0,
        last_login_date: null,
      });

      await service.updateStreak('user-1');

      expect(updateCalled).toBe(true);
      expect(capturedUpdateData).toEqual({
        current_streak: 1,
        longest_streak: 1,
        last_login_date: today(),
      });
    });

    it('login day after yesterday → streak increments from 5 to 6', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 5,
        longest_streak: 10,
        last_login_date: daysAgo(1),
      });

      await service.updateStreak('user-1');

      expect(updateCalled).toBe(true);
      expect(capturedUpdateData!.current_streak).toBe(6);
      expect(capturedUpdateData!.longest_streak).toBe(10); // 10 is still highest
      expect(capturedUpdateData!.last_login_date).toBe(today());
    });

    it('login day after yesterday, streak exceeds longest → updates longest', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 10,
        longest_streak: 10,
        last_login_date: daysAgo(1),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(11);
      expect(capturedUpdateData!.longest_streak).toBe(11); // new record
    });

    it('login same day → should NOT update (no-op)', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 5,
        longest_streak: 10,
        last_login_date: today(),
      });

      await service.updateStreak('user-1');

      expect(updateCalled).toBe(false);
      expect(capturedUpdateData).toBeNull();
    });

    it('login within 48h grace period (2 days ago) → only updates last_login_date', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 5,
        longest_streak: 10,
        last_login_date: daysAgo(2),
      });

      await service.updateStreak('user-1');

      expect(updateCalled).toBe(true);
      // Only last_login_date should be in the update — no current_streak
      expect(capturedUpdateData).toEqual({
        last_login_date: today(),
      });
    });
  });

  // ============================================================
  // ERROR FORZADO — Streak Breaking
  // ============================================================

  describe('Error Forzado — Streak Breaking', () => {
    it('login after 3 days → streak resets to 1, longest preserved', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 50,
        longest_streak: 100,
        last_login_date: daysAgo(3),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(1);
      expect(capturedUpdateData!.longest_streak).toBe(100);
    });

    it('login after 30 days → streak resets to 1', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 200,
        longest_streak: 200,
        last_login_date: daysAgo(30),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(1);
      expect(capturedUpdateData!.longest_streak).toBe(200);
    });

    it('login after 365 days → streak resets, longest preserved', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 365,
        longest_streak: 365,
        last_login_date: daysAgo(365),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(1);
      expect(capturedUpdateData!.longest_streak).toBe(365);
    });

    it('no streak record found → silently does nothing', async () => {
      const service = await buildService(null);

      await expect(service.updateStreak('nonexistent')).resolves.not.toThrow();
      expect(updateCalled).toBe(false);
    });

    it('database error on select → silently does nothing', async () => {
      const mockSupabase = {
        getClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { message: 'Connection timeout' },
                }),
              }),
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

      const service = module.get<UsersService>(UsersService);
      await expect(service.updateStreak('user-1')).resolves.not.toThrow();
    });
  });

  // ============================================================
  // PEOR CASO — Edge Cases
  // ============================================================

  describe('Peor Caso', () => {
    it('streak at exactly 100 → increments to 101 (Hito Esencia boundary)', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 100,
        longest_streak: 100,
        last_login_date: daysAgo(1),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(101);
      expect(capturedUpdateData!.longest_streak).toBe(101);
    });

    it('streak at exactly 365 → increments to 366 (Legado Esencia boundary)', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 365,
        longest_streak: 365,
        last_login_date: daysAgo(1),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(366);
    });

    it('current_streak = 0 with yesterday login → goes to 1', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 0,
        longest_streak: 5,
        last_login_date: daysAgo(1),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(1);
    });

    it('should handle 100 concurrent updateStreak calls', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 5,
        longest_streak: 10,
        last_login_date: daysAgo(1),
      });

      const requests = Array.from({ length: 100 }, () =>
        service.updateStreak('user-1'),
      );

      await expect(Promise.all(requests)).resolves.not.toThrow();
    });

    it('grace period boundary: exactly 2 days → maintains streak', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 20,
        longest_streak: 20,
        last_login_date: daysAgo(2),
      });

      await service.updateStreak('user-1');

      // Should only update last_login_date, streak maintained
      expect(capturedUpdateData).toEqual({
        last_login_date: today(),
      });
    });

    it('just beyond grace: exactly 3 days → streak broken', async () => {
      const service = await buildService({
        user_id: 'user-1',
        current_streak: 20,
        longest_streak: 20,
        last_login_date: daysAgo(3),
      });

      await service.updateStreak('user-1');

      expect(capturedUpdateData!.current_streak).toBe(1); // reset
    });
  });
});
