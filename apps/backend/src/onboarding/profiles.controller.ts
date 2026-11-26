import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

/// Perfiles públicos de otros usuarios (para ver desde chat/match).
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get(':id')
  async getPublicProfile(@Req() req: any, @Param('id') id: string) {
    return this.onboardingService.getPublicProfile(id, req.user?.id);
  }
}
