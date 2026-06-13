import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { SupabaseModule } from '../supabase';

@Module({
  imports: [SupabaseModule],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
