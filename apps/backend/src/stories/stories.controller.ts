import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoriesService } from './stories.service';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  async getStories(@Request() req: any) {
    const groups = await this.storiesService.getActiveStories(req.user.id);
    return { stories: groups };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createStory(
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string | undefined,
    @Request() req: any,
  ) {
    return this.storiesService.createStory(req.user.id, file, caption);
  }

  @Delete(':id')
  async deleteStory(@Param('id') id: string, @Request() req: any) {
    await this.storiesService.deleteStory(req.user.id, id);
    return { ok: true };
  }
}

