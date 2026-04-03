import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EsenciasModule } from '../esencias/esencias.module';
import { BodyDoublingService } from './body-doubling.service';
import { BodyDoublingController } from './body-doubling.controller';

@Module({
  imports: [SupabaseModule, EsenciasModule],
  providers: [BodyDoublingService],
  controllers: [BodyDoublingController],
  exports: [BodyDoublingService],
})
export class BodyDoublingModule {}
