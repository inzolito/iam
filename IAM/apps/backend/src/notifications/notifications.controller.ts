import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Listar notificaciones del usuario
   */
  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('unread') unread?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(req.user.id, {
      unreadOnly: unread === 'true',
      type,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * GET /notifications/unread-count
   * Obtener conteo de no leídas
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  /**
   * POST /notifications/:id/read
   * Marcar como leída
   */
  @Post(':id/read')
  async markAsRead(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  /**
   * POST /notifications/read-all
   * Marcar todas como leídas
   */
  @Post('read-all')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  /**
   * POST /notifications/devices
   * Registrar dispositivo para push
   */
  @Post('devices')
  async registerDevice(
    @Request() req: any,
    @Body() body: { deviceToken: string; platform: string },
  ) {
    return this.notificationsService.registerDevice(
      req.user.id,
      body.deviceToken,
      body.platform,
    );
  }

  /**
   * Delete /notifications/devices
   * Desactivar dispositivo
   */
  @Delete('devices')
  async unregisterDevice(
    @Request() req: any,
    @Body() body: { deviceToken: string },
  ) {
    return this.notificationsService.unregisterDevice(req.user.id, body.deviceToken);
  }

  /**
   * GET /notifications/devices
   * Listar dispositivos activos
   */
  @Get('devices')
  async getDevices(@Request() req: any) {
    return this.notificationsService.getUserDevices(req.user.id);
  }

  /**
   * GET /notifications/preferences
   * Obtener preferencias
   */
  @Get('preferences')
  async getPreferences(@Request() req: any) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  /**
   * Patch /notifications/preferences
   * Actualizar preferencias
   */
  @Patch('preferences')
  async updatePreferences(
    @Request() req: any,
    @Body() body: any,
  ) {
    return this.notificationsService.updatePreferences(req.user.id, body);
  }
}
