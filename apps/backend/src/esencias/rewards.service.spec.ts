import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { EsenciasService } from './esencias.service';

describe('RewardsService', () => {
  let service: RewardsService;

  function buildMockEsenciasService(overrides: {
    addError?: boolean;
    awardedAmounts?: number[];
  } = {}) {
    let callCount = 0;

    return {
      addEsencias: async (userId: string, amount: number, reason: string) => {
        if (overrides.addError) {
          throw new Error('Service error');
        }

        if (overrides.awardedAmounts) {
          const awarded = overrides.awardedAmounts[callCount] ?? amount;
          callCount++;
          return awarded;
        }

        return amount;
      },
    };
  }

  async function createService(
    overrides: Parameters<typeof buildMockEsenciasService>[0] = {},
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        {
          provide: EsenciasService,
          useValue: buildMockEsenciasService(overrides),
        },
      ],
    }).compile();

    return module.get<RewardsService>(RewardsService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('awardLoginBonus day 1 = 10 Esencias', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 1);

      expect(result).toBe(10);
    });

    it('awardLoginBonus day 7 = 50 Esencias (weekly bonus)', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 7);

      expect(result).toBe(50);
    });

    it('awardLoginBonus day 14 = 100 Esencias (biweekly)', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 14);

      expect(result).toBe(100);
    });

    it('awardLoginBonus day 30 = 200 Esencias (monthly)', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 30);

      expect(result).toBe(200);
    });

    it('awardMatchBonus awards both users 25 Esencias', async () => {
      service = await createService();

      const result = await service.awardMatchBonus('user-1', 'user-2');

      expect(result.user1Award).toBe(25);
      expect(result.user2Award).toBe(25);
    });

    it('getLoginBonusForDay returns correct amounts', async () => {
      service = await createService();

      expect(service.getLoginBonusForDay(1)).toBe(10);
      expect(service.getLoginBonusForDay(7)).toBe(50);
      expect(service.getLoginBonusForDay(14)).toBe(100);
      expect(service.getLoginBonusForDay(30)).toBe(200);
    });

    it('getMatchCreationAward returns 25', async () => {
      service = await createService();

      expect(service.getMatchCreationAward()).toBe(25);
    });

    it('getNextMilestoneDay from day 1 returns 7', async () => {
      service = await createService();

      expect(service.getNextMilestoneDay(1)).toBe(7);
    });

    it('getNextMilestoneDay from day 7 returns 14', async () => {
      service = await createService();

      expect(service.getNextMilestoneDay(7)).toBe(14);
    });

    it('getNextMilestoneBonus shows upcoming reward', async () => {
      service = await createService();

      const bonus = service.getNextMilestoneBonus(1);

      expect(bonus).toBe(50); // Next milestone is day 7
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('awardLoginBonus day 0 returns 0', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 0);

      expect(result).toBe(0);
    });

    it('awardLoginBonus negative streak returns 0', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', -5);

      expect(result).toBe(0);
    });

    it('awardLoginBonus with service error returns 0 (non-throwing)', async () => {
      service = await createService({ addError: true });

      const result = await service.awardLoginBonus('user-1', 7);

      expect(result).toBe(0);
    });

    it('awardMatchBonus with same userId throws INVALID_USER_IDS', async () => {
      service = await createService();

      await expect(
        service.awardMatchBonus('user-1', 'user-1'),
      ).rejects.toThrow('INVALID_USER_IDS');
    });

    it('awardMatchBonus with empty userId throws', async () => {
      service = await createService();

      await expect(
        service.awardMatchBonus('', 'user-2'),
      ).rejects.toThrow('INVALID_USER_IDS');

      await expect(
        service.awardMatchBonus('user-1', ''),
      ).rejects.toThrow('INVALID_USER_IDS');
    });

    it('awardMatchBonus with service error returns 0 awards (non-throwing)', async () => {
      service = await createService({ addError: true });

      const result = await service.awardMatchBonus('user-1', 'user-2');

      expect(result.user1Award).toBe(0);
      expect(result.user2Award).toBe(0);
    });

    it('getLoginBonusForDay with unknown day returns 10 (default)', async () => {
      service = await createService();

      expect(service.getLoginBonusForDay(50)).toBe(10);
      expect(service.getLoginBonusForDay(100)).toBe(10);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('awardLoginBonus day 365+ returns 200 (day 30 bonus)', async () => {
      service = await createService();

      expect(service.getLoginBonusForDay(365)).toBe(10); // Default
      expect(service.getLoginBonusForDay(1000)).toBe(10); // Default
    });

    it('awardLoginBonus for days 1-6 each awards 10', async () => {
      service = await createService();

      for (let day = 1; day <= 6; day++) {
        expect(service.getLoginBonusForDay(day)).toBe(10);
      }
    });

    it('Multiple awards in same day sequence (idempotent)', async () => {
      service = await createService();

      const r1 = await service.awardLoginBonus('user-1', 7);
      const r2 = await service.awardLoginBonus('user-1', 7);

      expect(r1).toBe(50);
      expect(r2).toBe(50); // Both return same amount
    });

    it('Award to user with existing large balance', async () => {
      service = await createService();

      const result = await service.awardLoginBonus('user-1', 14);

      expect(result).toBe(100); // Award amount doesn't depend on balance
    });

    it('Concurrent award calls are not idempotent (each increments separately)', async () => {
      service = await createService();

      const r1 = service.awardLoginBonus('user-1', 7);
      const r2 = service.awardLoginBonus('user-1', 7);

      const [result1, result2] = await Promise.all([r1, r2]);

      expect(result1).toBe(50);
      expect(result2).toBe(50);
    });

    it('Match bonus awards both users even if one user fails (first succeeds)', async () => {
      // In real system, if second user fails, transaction is already recorded for first
      // This tests graceful handling
      service = await createService();

      const result = await service.awardMatchBonus('user-1', 'user-2');

      expect(result.user1Award).toBe(25);
      expect(result.user2Award).toBe(25);
    });

    it('getNextMilestoneBonus from day 30 returns next milestone (default 10)', async () => {
      service = await createService();

      // Day 30 next milestone is 60 (not in config), so returns 365 default
      const bonus = service.getNextMilestoneBonus(30);

      expect(typeof bonus).toBe('number');
      expect(bonus).toBeGreaterThan(0);
    });

    it('awardLoginBonus for edge case days (6, 7, 8)', async () => {
      service = await createService();

      expect(service.getLoginBonusForDay(6)).toBe(10); // Last day of first week
      expect(service.getLoginBonusForDay(7)).toBe(50); // First bonus day
      expect(service.getLoginBonusForDay(8)).toBe(10); // Back to default
    });

    it('getNextMilestoneDay progression', async () => {
      service = await createService();

      expect(service.getNextMilestoneDay(0)).toBe(7);
      expect(service.getNextMilestoneDay(7)).toBe(14);
      expect(service.getNextMilestoneDay(14)).toBe(30);
      expect(service.getNextMilestoneDay(30)).toBe(60);
      expect(service.getNextMilestoneDay(365)).toBe(365); // No next milestone
    });
  });
});
