import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================================
  // Dashboard
  // ============================================================

  @Get('stats')
  async getDashboardStats(@Request() req: any) {
    return this.adminService.getDashboardStats(req.user.id);
  }

  @Get('stats/diagnoses')
  async getUsersByDiagnosis(@Request() req: any) {
    return this.adminService.getUsersByDiagnosis(req.user.id);
  }

  // ============================================================
  // Usuarios
  // ============================================================

  @Get('users/search')
  async searchUsers(
    @Request() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.searchUsers(req.user.id, query, limit ? parseInt(limit) : 20);
  }

  @Get('users/:id')
  async getUserDetail(@Request() req: any, @Param('id') id: string) {
    return this.adminService.getUserDetail(req.user.id, id);
  }

  @Post('users/:id/ban')
  async banUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.banUser(req.user.id, id, body.reason);
  }

  @Post('users/:id/unban')
  async unbanUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.unbanUser(req.user.id, id, body.reason);
  }

  @Post('users/:id/warn')
  async warnUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.warnUser(req.user.id, id, body.reason);
  }

  // ============================================================
  // Esencias
  // ============================================================

  @Post('users/:id/esencias')
  async grantEsencias(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.adminService.grantEsencias(req.user.id, id, body.amount, body.reason);
  }

  // ============================================================
  // Cola de moderación
  // ============================================================

  @Get('moderation/queue')
  async getModerationQueue(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getModerationQueue(req.user.id, {
      status,
      priority,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Post('moderation/queue/:id/assign')
  async assignQueueItem(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.adminService.assignQueueItem(req.user.id, id);
  }

  @Post('moderation/queue/:id/resolve')
  async resolveQueueItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { resolution: 'resolved' | 'dismissed'; notes: string },
  ) {
    return this.adminService.resolveQueueItem(req.user.id, id, body.resolution, body.notes);
  }

  // ============================================================
  // Roles
  // ============================================================

  @Get('roles')
  async listAdmins(@Request() req: any) {
    return this.adminService.listAdmins(req.user.id);
  }

  @Post('roles/grant')
  async grantRole(
    @Request() req: any,
    @Body() body: { userId: string; role: string },
  ) {
    return this.adminService.grantRole(req.user.id, body.userId, body.role);
  }

  @Post('roles/revoke')
  async revokeRole(
    @Request() req: any,
    @Body() body: { userId: string },
  ) {
    return this.adminService.revokeRole(req.user.id, body.userId);
  }

  // ============================================================
  // Log de acciones
  // ============================================================

  @Get('actions')
  async getActionLog(
    @Request() req: any,
    @Query('type') actionType?: string,
    @Query('userId') targetUserId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getActionLog(req.user.id, {
      actionType,
      targetUserId,
      limit: limit ? parseInt(limit) : 50,
    });
  }
}
