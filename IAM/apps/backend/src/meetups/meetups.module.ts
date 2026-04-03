import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EsenciasModule } from '../esencias/esencias.module';
import { MeetupsService } from './meetups.service';
import { MeetupsController } from './meetups.controller';

@Module({
  imports: [SupabaseModule, EsenciasModule],
  providers: [MeetupsService],
  controllers: [MeetupsController],
  exports: [MeetupsService],
})
export class MeetupsModule {}
