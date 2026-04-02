import { Controller, Get, Post, Param, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnlocksService } from './unlocks.service';

@Controller('unlocks')
export class UnlocksController {
  constructor(private readonly unlocksService: UnlocksService) {}

  /**
   * GET /unlocks/rules
   * Get all unlock rules (public)
   */
  @Get('rules')
  async getAllUnlockRules() {
    return this.unlocksService.getUnlockRules();
  }

  /**
   * GET /unlocks/rules/:diagnosis
   * Get unlock rules for specific diagnosis (public)
   */
  @Get('rules/:diagnosis')
  async getUnlockRulesByDiagnosis(@Param('diagnosis') diagnosis: string) {
    return this.unlocksService.getUnlockRules(diagnosis);
  }

  /**
   * GET /unlocks/my-unlocks
   * Get user's unlocked features grouped by diagnosis (auth required)
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-unlocks')
  async getMyUnlocks(@Request() req: any) {
    const grouped = await this.unlocksService.getUserUnlocks(req.user.id);

    // Convert Map to Object for JSON response
    const response: Record<string, any[]> = {};
    for (const [diagnosis, unlocks] of grouped.entries()) {
      response[diagnosis] = unlocks;
    }

    return response;
  }

  /**
   * GET /unlocks/feature-keys
   * Get list of unlocked feature keys (auth required)
   */
  @UseGuards(JwtAuthGuard)
  @Get('feature-keys')
  async getUnlockedFeatureKeys(@Request() req: any) {
    return this.unlocksService.getUnlockedFeatureKeys(req.user.id);
  }

  /**
   * GET /unlocks/:unlockId/status
   * Check if user can unlock a feature (auth required)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':unlockId/status')
  async checkUnlockStatus(
    @Request() req: any,
    @Param('unlockId') unlockId: string,
  ) {
    return this.unlocksService.canUnlock(req.user.id, unlockId);
  }

  /**
   * POST /unlocks/:unlockId/unlock
   * Unlock a feature (deducts balance)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':unlockId/unlock')
  async unlockFeature(
    @Request() req: any,
    @Param('unlockId') unlockId: string,
  ) {
    return this.unlocksService.unlock(req.user.id, unlockId);
  }

  /**
   * POST /unlocks/admin/revert/:userId/:unlockId
   * Admin function: Revert an unlock and refund Esencias
   * Should be gated by admin role in real implementation
   */
  @Post('admin/revert/:userId/:unlockId')
  async revertUnlock(
    @Param('userId') userId: string,
    @Param('unlockId') unlockId: string,
  ) {
    // In production, add @UseGuards(AdminGuard)
    await this.unlocksService.revertUnlock(userId, unlockId);
    return { success: true };
  }
}
