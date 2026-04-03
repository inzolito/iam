import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EsenciasModule } from '../esencias/esencias.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [SupabaseModule, EsenciasModule],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
