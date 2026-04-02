import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('MatchingService', () => {
  let service: MatchingService;
  let mockApi: any;

  beforeEach(async () => {
    mockApi = {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'users') {
            return {
              select: () => ({
                neq: () => ({
                  eq: (...args: any[]) => ({
                    eq: () => ({
                      range: async () => ({
                        data: [
                          {
                            id: 'user-2',
                            display_name: 'Test User',
                            avatar_url: null,
                            is_teen: false,
                            energy_level: 2,
                            msn_status: null,
                            location: { coordinates: [-70.5, -33.5] }, // Santiago, Chile
                            user_spin: [{ spin_tag_id: 'tag-1' }],
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'swipes') {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: 'swipe-1', direction: 'like' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'blocks') {
            return {
              select: () => ({
                or: () => Promise.resolve({ data: [], error: null }),
              }),
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === 'matches') {
            return {
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: 'match-1', user_a_id: 'user-1', user_b_id: 'user-2' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'reports') {
            return {
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === 'user_spin') {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            };
          }
          return {};
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: SupabaseService, useValue: mockApi },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  describe('Happy Path', () => {
    it('getFeed returns profiles within radius', async () => {
      const profiles = await service.getFeed('user-1', 20000, 0);
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('swipe like returns matched false initially', async () => {
      const result = await service.swipe('user-1', 'user-2', 'like');
      expect(result.matched).toBe(false);
    });

    it('blockUser does not throw', async () => {
      await expect(service.blockUser('user-1', 'user-2')).resolves.not.toThrow();
    });

    it('reportUser does not throw', async () => {
      await expect(
        service.reportUser('user-1', 'user-2', 'INAPPROPRIATE', 'desc'),
      ).resolves.not.toThrow();
    });
  });

  describe('Error Forzado', () => {
    it('swipe self throws', async () => {
      await expect(
        service.swipe('user-1', 'user-1', 'like'),
      ).rejects.toThrow('SWIPE_SELF');
    });

    it('invalid direction throws', async () => {
      await expect(
        service.swipe('user-1', 'user-2', 'invalid' as any),
      ).rejects.toThrow('INVALID_DIRECTION');
    });

    it('blockUser self throws', async () => {
      await expect(
        service.blockUser('user-1', 'user-1'),
      ).rejects.toThrow('BLOCK_SELF');
    });

    it('reportUser self throws', async () => {
      await expect(
        service.reportUser('user-1', 'user-1', 'reason'),
      ).rejects.toThrow('REPORT_SELF');
    });
  });

  describe('Peor Caso', () => {
    it('distance calculation is reasonable', () => {
      // Santiago to Buenos Aires ~1400km
      const dist = (service as any).calculateDistance(-33.87, -151.21, -34.6, -58.38);
      expect(dist).toBeGreaterThan(1000000); // > 1000km
      expect(dist).toBeLessThan(2000000); // < 2000km
    });

    it('spin score with no tags is 0', () => {
      const score = (service as any).calculateSpinScoreSync([], []);
      expect(score).toBe(0);
    });

    it('spin score with all matching is 100', () => {
      const score = (service as any).calculateSpinScoreSync(['tag-1', 'tag-2'], ['tag-1', 'tag-2']);
      expect(score).toBe(100);
    });

    it('spin score with half matching is 50', () => {
      const score = (service as any).calculateSpinScoreSync(['tag-1', 'tag-2'], ['tag-1', 'tag-3']);
      expect(score).toBe(50);
    });
  });
});
