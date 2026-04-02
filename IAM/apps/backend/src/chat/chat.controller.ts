import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { id: string; email: string; isTeen: boolean };
}

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * GET /matches — List all matches with last message preview.
   */
  @Get()
  async getMatches(@Req() req: AuthRequest) {
    return this.chatService.getMatches(req.user.id);
  }

  /**
   * GET /matches/:id/messages — Get message history (paginated).
   */
  @Get(':id/messages')
  async getMessages(
    @Req() req: AuthRequest,
    @Param('id') matchId: string,
    @Query('page') page?: string,
  ) {
    const pageNum = page ? Math.max(0, parseInt(page, 10)) : 0;
    return this.chatService.getMessages(matchId, req.user.id, pageNum);
  }

  /**
   * POST /matches/:id/messages — Send a message.
   */
  @Post(':id/messages')
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('id') matchId: string,
    @Body('content') content: string,
  ) {
    if (!content) {
      throw new BadRequestException('CONTENT_REQUIRED');
    }
    return this.chatService.sendMessage(matchId, req.user.id, content);
  }

  /**
   * PATCH /matches/:id/read — Mark messages as read.
   */
  @Patch(':id/read')
  async markAsRead(
    @Req() req: AuthRequest,
    @Param('id') matchId: string,
  ) {
    const count = await this.chatService.markAsRead(matchId, req.user.id);
    return { markedRead: count };
  }
}
