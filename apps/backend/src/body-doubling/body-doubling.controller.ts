import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BodyDoublingService } from './body-doubling.service';

@Controller('body-doubling')
@UseGuards(JwtAuthGuard)
export class BodyDoublingController {
  constructor(private readonly bodyDoublingService: BodyDoublingService) {}

  /**
   * POST /body-doubling/sessions
   * Crear nueva sesión
   */
  @Post('sessions')
  async createSession(
    @Request() req: any,
    @Body() body: {
      title: string;
      activityType: string;
      durationMinutes: number;
      description?: string;
      maxParticipants?: number;
      isPublic?: boolean;
      scheduledFor?: string;
      venueId?: string;
    },
  ) {
    return this.bodyDoublingService.createSession(
      req.user.id,
      body.title,
      body.activityType,
      body.durationMinutes,
      {
        description: body.description,
        maxParticipants: body.maxParticipants,
        isPublic: body.isPublic,
        scheduledFor: body.scheduledFor,
        venueId: body.venueId,
      },
    );
  }

  /**
   * GET /body-doubling/sessions
   * Listar sesiones disponibles (públicas, waiting/active)
   */
  @Get('sessions')
  async getAvailableSessions(
    @Query('activity') activityType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bodyDoublingService.getAvailableSessions(
      activityType,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * GET /body-doubling/my-sessions
   * Sesiones del usuario (host o participante)
   */
  @Get('my-sessions')
  async getMySessions(@Request() req: any) {
    return this.bodyDoublingService.getMySessions(req.user.id);
  }

  /**
   * GET /body-doubling/sessions/:id
   * Detalle de una sesión
   */
  @Get('sessions/:id')
  async getSessionDetail(@Param('id') id: string) {
    return this.bodyDoublingService.getSessionDetail(id);
  }

  /**
   * POST /body-doubling/sessions/:id/join
   * Unirse a una sesión
   */
  @Post('sessions/:id/join')
  async joinSession(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bodyDoublingService.joinSession(req.user.id, id);
  }

  /**
   * POST /body-doubling/sessions/:id/leave
   * Salir de una sesión
   */
  @Post('sessions/:id/leave')
  async leaveSession(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bodyDoublingService.leaveSession(req.user.id, id);
  }

  /**
   * POST /body-doubling/sessions/:id/start
   * Iniciar sesión (solo host)
   */
  @Post('sessions/:id/start')
  async startSession(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bodyDoublingService.startSession(req.user.id, id);
  }

  /**
   * POST /body-doubling/sessions/:id/complete
   * Completar sesión (solo host, otorga Esencias)
   */
  @Post('sessions/:id/complete')
  async completeSession(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bodyDoublingService.completeSession(req.user.id, id);
  }

  /**
   * POST /body-doubling/sessions/:id/cancel
   * Cancelar sesión (solo host)
   */
  @Post('sessions/:id/cancel')
  async cancelSession(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bodyDoublingService.cancelSession(req.user.id, id);
  }
}
