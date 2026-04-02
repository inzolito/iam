import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EsenciasService } from './esencias.service';

@Controller('esencias')
export class EsenciasController {
  constructor(private readonly esenciasService: EsenciasService) {}

  /**
   * GET /esencias/balance
   * Get user's current Esencias balance and stats
   */
  @UseGuards(JwtAuthGuard)
  @Get('balance')
  async getBalance(@Request() req: any) {
    return this.esenciasService.getBalance(req.user.id);
  }

  /**
   * GET /esencias/transactions
   * Get user's transaction history (paginated)
   * Query params: limit (1-100, default 50), offset (default 0)
   */
  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactionHistory(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 50;
    const offsetNum = offset ? parseInt(offset) : 0;

    return this.esenciasService.getTransactionHistory(req.user.id, limitNum, offsetNum);
  }

  /**
   * GET /esencias/received
   * Get Esencias received from other users (transfers only)
   * Query param: limit (default 20)
   */
  @UseGuards(JwtAuthGuard)
  @Get('received')
  async getReceivedTransfers(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 20;

    return this.esenciasService.getReceivedTransfers(req.user.id, limitNum);
  }

  /**
   * POST /esencias/transfer
   * Send Esencias to another user
   */
  @UseGuards(JwtAuthGuard)
  @Post('transfer')
  async transferEsencias(
    @Request() req: any,
    @Body() body: { toUserId: string; amount: number; message?: string },
  ) {
    const { toUserId, amount, message } = body;

    return this.esenciasService.transferEsencias(
      req.user.id,
      toUserId,
      amount,
      message,
    );
  }
}
