import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SpinService } from './spin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('spin')
@UseGuards(JwtAuthGuard)
export class SpinController {
  constructor(private readonly spinService: SpinService) {}

  @Get('categories')
  async getCategories(@Query('lang') lang?: string) {
    return this.spinService.getCategories(lang ?? 'es');
  }

  @Get('tags')
  async searchTags(
    @Query('search') search?: string,
    @Query('category') categoryId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!search || search.trim().length === 0) {
      return [];
    }
    return this.spinService.searchTags(
      search.trim(),
      categoryId,
      limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10,
    );
  }
}
