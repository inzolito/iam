import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EsenciasService } from './esencias.service';

/**
 * RewardsService handles awarding Esencias to users for various activities.
 * Integration points:
 * - UsersService.updateStreak() → awardLoginBonus()
 * - MatchingService.swipe() → awardMatchBonus() when match is created
 */
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  // Login bonus escalation: day → esencias amount
  // Days 1-6: 10 each, Day 7: 50 (weekly), Day 14: 100, Day 30: 200, etc.
  private readonly LOGIN_BONUSES: Record<number, number> = {
    1: 10,
    2: 10,
    3: 10,
    4: 10,
    5: 10,
    6: 10,
    7: 50, // Weekly bonus
    14: 100, // Biweekly bonus
    30: 200, // Monthly bonus
  };

  private readonly DEFAULT_LOGIN_BONUS = 10; // Fallback for days > 30

  private readonly MATCH_CREATION_AWARD = 25; // Per user, awarded immediately

  constructor(private readonly esenciasService: EsenciasService) {}

  /**
   * Award Esencias for login streak milestones
   * Called from UsersService.updateStreak() AFTER streak is incremented
   *
   * @param userId User ID
   * @param streakDays Current streak day (1, 2, 3, ..., 7, ...)
   * @returns Amount of Esencias awarded
   */
  async awardLoginBonus(userId: string, streakDays: number): Promise<number> {
    if (streakDays <= 0) {
      return 0; // No award for streak reset
    }

    // Determine bonus based on streak day
    const bonus = this.LOGIN_BONUSES[streakDays] ?? this.DEFAULT_LOGIN_BONUS;

    try {
      await this.esenciasService.addEsencias(
        userId,
        bonus,
        `login_bonus_day_${streakDays}`,
      );

      this.logger.log(
        `Awarded ${bonus} Esencias to ${userId} for day ${streakDays} streak`,
      );

      return bonus;
    } catch (error) {
      this.logger.error(
        `Error awarding login bonus to ${userId}: ${error}`,
      );
      // Don't throw - allow login to proceed even if reward fails
      return 0;
    }
  }

  /**
   * Award Esencias to both users when a match is created
   * Called from MatchingService.swipe() when mutual like creates a match
   *
   * @param userId1 First user (the one who swiped)
   * @param userId2 Second user (the one who was swiped on)
   * @returns Amounts awarded to each user
   */
  async awardMatchBonus(
    userId1: string,
    userId2: string,
  ): Promise<{ user1Award: number; user2Award: number }> {
    if (!userId1 || !userId2 || userId1 === userId2) {
      throw new BadRequestException('INVALID_USER_IDS');
    }

    try {
      const award1 = await this.esenciasService.addEsencias(
        userId1,
        this.MATCH_CREATION_AWARD,
        'match_creation',
      );

      const award2 = await this.esenciasService.addEsencias(
        userId2,
        this.MATCH_CREATION_AWARD,
        'match_creation',
      );

      this.logger.log(
        `Awarded match creation bonus: ${userId1}=${award1}, ${userId2}=${award2}`,
      );

      return {
        user1Award: this.MATCH_CREATION_AWARD,
        user2Award: this.MATCH_CREATION_AWARD,
      };
    } catch (error) {
      this.logger.error(
        `Error awarding match bonus to ${userId1} and ${userId2}: ${error}`,
      );
      // Don't throw - allow match creation to proceed even if reward fails
      return {
        user1Award: 0,
        user2Award: 0,
      };
    }
  }

  /**
   * Get the bonus amount for a specific streak day
   * Useful for showing users what they'll earn
   */
  getLoginBonusForDay(streakDay: number): number {
    if (streakDay <= 0) return 0;
    return this.LOGIN_BONUSES[streakDay] ?? this.DEFAULT_LOGIN_BONUS;
  }

  /**
   * Get the match creation award amount
   */
  getMatchCreationAward(): number {
    return this.MATCH_CREATION_AWARD;
  }

  /**
   * Get next milestone day (for UI hints)
   * Returns the next special bonus day (7, 14, 30, etc.)
   */
  getNextMilestoneDay(currentDay: number): number {
    const milestones = [7, 14, 30, 60, 90, 365];
    return milestones.find((m) => m > currentDay) ?? 365;
  }

  /**
   * Get next milestone bonus amount
   */
  getNextMilestoneBonus(currentDay: number): number {
    const nextDay = this.getNextMilestoneDay(currentDay);
    return this.LOGIN_BONUSES[nextDay] ?? this.DEFAULT_LOGIN_BONUS;
  }
}
