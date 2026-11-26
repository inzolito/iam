import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FileStorageService } from '../photos/file-storage.service';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [SupabaseModule],
  controllers: [StoriesController],
  providers: [StoriesService, FileStorageService],
})
export class StoriesModule {}

