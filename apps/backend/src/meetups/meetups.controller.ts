import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MeetupsService } from './meetups.service';

@Controller('meetups')
@UseGuards(JwtAuthGuard)
export class MeetupsController {
  constructor(private readonly meetupsService: MeetupsService) {}

  /**
   * POST /meetups/initiate
   * Iniciar confirmación de meetup (primer usuario confirma)
   */
  @Post('initiate')
  async initiateMeetup(
    @Request() req: any,
    @Body() body: { matchId: string; lat?: number; lng?: number },
  ) {
    return this.meetupsService.initiateMeetup(
      req.user.id,
      body.matchId,
      { lat: body.lat, lng: body.lng },
    );
  }

  /**
   * POST /meetups/:id/confirm
   * Confirmar meetup (segundo usuario confirma → completa)
   */
  @Post(':id/confirm')
  async confirmMeetup(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { lat?: number; lng?: number },
  ) {
    return this.meetupsService.confirmMeetup(
      req.user.id,
      id,
      { lat: body.lat, lng: body.lng },
    );
  }

  /**
   * GET /meetups
   * Listar mis meetups con filtro opcional por estado
   */
  @Get()
  async getMyMeetups(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.meetupsService.getMyMeetups(
      req.user.id,
      status,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * GET /meetups/pending
   * Meetups pendientes que necesitan mi confirmación
   */
  @Get('pending')
  async getPendingMeetups(@Request() req: any) {
    return this.meetupsService.getPendingMeetups(req.user.id);
  }

  /**
   * GET /meetups/stats
   * Estadísticas de meetups del usuario
   */
  @Get('stats')
  async getMeetupStats(@Request() req: any) {
    return this.meetupsService.getMeetupStats(req.user.id);
  }

  /**
   * GET /meetups/:id
   * Detalle de un meetup
   */
  @Get(':id')
  async getMeetupDetail(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.meetupsService.getMeetupDetail(req.user.id, id);
  }

  /**
   * POST /meetups/:id/dispute
   * Disputar un meetup (reportar falsa confirmación)
   */
  @Post(':id/dispute')
  async disputeMeetup(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.meetupsService.disputeMeetup(req.user.id, id);
  }
}
