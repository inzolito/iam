import { Module } from '@nestjs/common';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { FileStorageService } from './file-storage.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [PhotosService, FileStorageService],
  controllers: [PhotosController],
  exports: [PhotosService],
})
export class PhotosModule {}
