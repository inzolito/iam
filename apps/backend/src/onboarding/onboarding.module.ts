import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SpinModule } from '../spin';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [SpinModule, FeatureFlagsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
