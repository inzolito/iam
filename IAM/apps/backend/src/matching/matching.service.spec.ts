import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('MatchingService', () => {
  let service: MatchingService;

  function buildMock(opts: {
    user?: any;
    userError?: boolean;
    candidates?: any[];
    swipedIds?: string[];
    blockedIds?: string[];
    blockCheck?: any;
    mutualSwipe?: any;
    insertError?: boolean;
  } = {}) {
    const user = opts.user ?? {
      id: 'user-1',
      is_teen: false,
      location: { coordinates: [-70.65, -33.45] }, // Santiago
    };

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'users') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: opts.userError ? null : user,
                    error: opts.userError ? { message: 'not found' } : null,
                  }),
                }),
                neq: () => ({
                  eq: () => ({
                    eq: () => ({
                      range: async () => ({
                        data: opts.candidates ?? [],
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
                eq: (col: string, val: string) => {
                  if (col === 'swiper_id' && val !== 'user-1') {
                    // mutual swipe check
                    return {
                      eq: () => ({
                        eq: () => ({
                          maybeSingle: async () => ({
                            data: opts.mutualSwipe ?? null,
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }
                  return Promise.resolve({
                    data: (opts.swipedIds ?? []).map((id) => ({ swiped_id: id })),
                    error: null,
                  });
                },
              }),
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: opts.insertError ? null : { id: 'swipe-1' },
                    error: opts.insertError ? { message: 'fail' } : null,
                  }),
                }),
              }),
            };
          }
          if (table === 'blocks') {
            return {
              select: () => ({
                or: () =>
                  Promise.resolve({
                    data: opts.blockCheck ? [opts.blockCheck] : [],
                    error: null,
                  }),
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
              insert: () => Promise.resolve({ error: opts.insertError ? { message: 'fail' } : null }),
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
  }

  async function createService(opts: Parameters<typeof buildMock>[0] = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: SupabaseService, useValue: buildMock(opts) },
      ],
    }).compile();

    return module.get<MatchingService>(MatchingService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('swipe like returns matched false when no mutual', async () => {
      service = await createService();
      const result = await service.swipe('user-1', 'user-2', 'like');
      expect(result.matched).toBe(false);
    });

    it('swipe like returns matched true when mutual like exists', async () => {
      service = await createService({
        mutualSwipe: { id: 'swipe-mutual' },
      });
      const result = await service.swipe('user-1', 'user-2', 'like');
      expect(result.matched).toBe(true);
      expect(result.match).toBeDefined();
    });

    it('swipe pass returns matched false', async () => {
      service = await createService();
      const result = await service.swipe('user-1', 'user-2', 'pass');
      expect(result.matched).toBe(false);
    });

    it('blockUser does not throw', async () => {
      service = await createService();
      await expect(service.blockUser('user-1', 'user-2')).resolves.not.toThrow();
    });

    it('reportUser does not throw', async () => {
      service = await createService();
      await expect(
        service.reportUser('user-1', 'user-2', 'SPAM', 'description'),
      ).resolves.not.toThrow();
    });

    it('calculateSpinScore between users with shared tags', async () => {
      service = await createService();
      // This calls getUserSpinTags internally (mocked to return [])
      const score = await service.calculateSpinScore('user-1', 'user-2');
      expect(score).toBe(0); // both empty
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('swipe self throws SWIPE_SELF', async () => {
      service = await createService();
      await expect(
        service.swipe('user-1', 'user-1', 'like'),
      ).rejects.toThrow('SWIPE_SELF');
    });

    it('invalid swipe direction throws', async () => {
      service = await createService();
      await expect(
        service.swipe('user-1', 'user-2', 'superlike' as any),
      ).rejects.toThrow('INVALID_DIRECTION');
    });

    it('blockUser self throws BLOCK_SELF', async () => {
      service = await createService();
      await expect(
        service.blockUser('user-1', 'user-1'),
      ).rejects.toThrow('BLOCK_SELF');
    });

    it('reportUser self throws REPORT_SELF', async () => {
      service = await createService();
      await expect(
        service.reportUser('user-1', 'user-1', 'reason'),
      ).rejects.toThrow('REPORT_SELF');
    });

    it('getFeed without location throws', async () => {
      service = await createService({
        user: { id: 'user-1', is_teen: false, location: null },
      });
      await expect(
        service.getFeed('user-1'),
      ).rejects.toThrow('LOCATION_REQUIRED');
    });

    it('getFeed with nonexistent user throws', async () => {
      service = await createService({ userError: true });
      await expect(
        service.getFeed('nonexistent'),
      ).rejects.toThrow('USER_NOT_FOUND');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('Haversine: Santiago to Valparaíso ~100km', () => {
      service = new MatchingService(null as any);
      // Santiago: -33.45, -70.65  Valparaíso: -33.04, -71.63
      const dist = (service as any).calculateDistance(-33.45, -70.65, -33.04, -71.63);
      expect(dist).toBeGreaterThan(80000); // > 80km
      expect(dist).toBeLessThan(130000); // < 130km
    });

    it('Haversine: same point = 0', () => {
      service = new MatchingService(null as any);
      const dist = (service as any).calculateDistance(-33.45, -70.65, -33.45, -70.65);
      expect(dist).toBe(0);
    });

    it('SpIn score: no tags = 0', () => {
      service = new MatchingService(null as any);
      expect((service as any).calculateSpinScoreSync([], [])).toBe(0);
    });

    it('SpIn score: identical tags = 100', () => {
      service = new MatchingService(null as any);
      expect(
        (service as any).calculateSpinScoreSync(['a', 'b', 'c'], ['a', 'b', 'c']),
      ).toBe(100);
    });

    it('SpIn score: 2 common out of 4 unique = 50', () => {
      service = new MatchingService(null as any);
      // User1: [a, b], User2: [a, c] → common=1, unique=3 → 33.33
      // For 50%: User1: [a, b], User2: [a, b, c, d] → common=2, unique=4
      expect(
        (service as any).calculateSpinScoreSync(['a', 'b'], ['a', 'b', 'c', 'd']),
      ).toBe(50);
    });

    it('SpIn score: no overlap = 0', () => {
      service = new MatchingService(null as any);
      expect(
        (service as any).calculateSpinScoreSync(['a', 'b'], ['c', 'd']),
      ).toBe(0);
    });

    it('parseLocation handles GeoJSON', () => {
      service = new MatchingService(null as any);
      const loc = (service as any).parseLocation({ coordinates: [-70.65, -33.45] });
      expect(loc).toEqual({ lng: -70.65, lat: -33.45 });
    });

    it('parseLocation handles WKT string', () => {
      service = new MatchingService(null as any);
      const loc = (service as any).parseLocation('POINT(-70.65 -33.45)');
      expect(loc).toEqual({ lng: -70.65, lat: -33.45 });
    });

    it('parseLocation returns null for invalid', () => {
      service = new MatchingService(null as any);
      expect((service as any).parseLocation(null)).toBeNull();
      expect((service as any).parseLocation('garbage')).toBeNull();
    });

    it('50 concurrent swipe calls do not throw', async () => {
      service = await createService();
      const calls = Array.from({ length: 50 }, (_, i) =>
        service.swipe('user-1', `user-${i + 10}`, 'like'),
      );
      await expect(Promise.all(calls)).resolves.not.toThrow();
    });
  });
});
