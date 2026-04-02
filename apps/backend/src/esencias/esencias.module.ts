import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EsenciasService } from './esencias.service';
import { UnlocksService } from './unlocks.service';
import { RewardsService } from './rewards.service';
import { EsenciasController } from './esencias.controller';
import { UnlocksController } from './unlocks.controller';

@Module({
  imports: [SupabaseModule],
  providers: [EsenciasService, UnlocksService, RewardsService],
  controllers: [EsenciasController, UnlocksController],
  exports: [EsenciasService, UnlocksService, RewardsService], // Export for use in other modules
})
export class EsenciasModule {}
