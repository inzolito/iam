import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EsenciasModule } from '../esencias/esencias.module';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';

@Module({
  imports: [SupabaseModule, EsenciasModule],
  providers: [VenuesService],
  controllers: [VenuesController],
  exports: [VenuesService],
})
export class VenuesModule {}
