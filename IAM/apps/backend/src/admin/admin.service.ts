import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

const VALID_ROLES = ['super_admin', 'admin', 'moderator'];
const VALID_ACTION_TYPES = [
  'user_ban', 'user_unban', 'user_warn', 'user_suspend',
  'content_remove', 'report_resolve', 'report_dismiss',
  'esencias_grant', 'esencias_deduct', 'system_announcement',
];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const VALID_QUEUE_STATUSES = ['pending', 'in_review', 'resolved', 'dismissed'];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly esenciasService: EsenciasService,
  ) {}

  // ============================================================
  // Verificación de permisos
  // ============================================================

  /**
   * Verificar que el usuario es admin
   */
  async verifyAdmin(userId: string): Promise<{ role: string }> {
    const client = this.supabaseService.getClient();

    const { data: admin, error } = await client
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      throw new ForbiddenException('NOT_ADMIN');
    }

    return { role: admin.role };
  }

  /**
   * Verificar que es super_admin
   */
  async verifySuperAdmin(userId: string): Promise<void> {
    const { role } = await this.verifyAdmin(userId);
    if (role !== 'super_admin') {
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
    }
  }

  // ============================================================
  // Estadísticas del dashboard
  // ============================================================

  /**
   * Obtener estadísticas generales de la plataforma
   */
  async getDashboardStats(adminId: string) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    // Contar usuarios
    const { data: users } = await client
      .from('users')
      .select('id', { count: 'exact' });

    // Contar matches activos
    const { data: matches } = await client
      .from('matches')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    // Contar reportes pendientes
    const { data: reports } = await client
      .from('reports')
      .select('id', { count: 'exact' })
      .eq('status', 'pending');

    // Contar sesiones body doubling activas
    const { data: sessions } = await client
      .from('body_doubling_sessions')
      .select('id', { count: 'exact' })
      .in('status', ['waiting', 'active']);

    return {
      totalUsers: users?.length ?? 0,
      activeMatches: matches?.length ?? 0,
      pendingReports: reports?.length ?? 0,
      activeSessions: sessions?.length ?? 0,
    };
  }

  /**
   * Obtener estadísticas de usuarios por diagnóstico
   */
  async getUsersByDiagnosis(adminId: string) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    const { data: users, error } = await client
      .from('users')
      .select('diagnosis');

    if (error || !users) {
      return {};
    }

    const counts: Record<string, number> = {};
    for (const u of users) {
      const diag = (u as any).diagnosis || 'unknown';
      counts[diag] = (counts[diag] || 0) + 1;
    }

    return counts;
  }

  // ============================================================
  // Gestión de usuarios
  // ============================================================

  /**
   * Buscar usuarios
   */
  async searchUsers(
    adminId: string,
    query: string,
    limit: number = 20,
  ) {
    await this.verifyAdmin(adminId);

    if (!query || query.trim().length < 2) {
      throw new BadRequestException('SEARCH_QUERY_TOO_SHORT');
    }

    const client = this.supabaseService.getClient();

    const { data: users, error } = await client
      .from('users')
      .select('id, display_name, email, diagnosis, is_banned, created_at')
      .ilike('display_name', `%${query}%`)
      .limit(limit);

    if (error) {
      this.logger.error(`Error searching users: ${error.message}`);
      return [];
    }

    return (users || []).map((u: any) => ({
      id: u.id,
      displayName: u.display_name,
      email: u.email,
      diagnosis: u.diagnosis,
      isBanned: u.is_banned,
      createdAt: u.created_at,
    }));
  }

  /**
   * Obtener detalle completo de un usuario (admin view)
   */
  async getUserDetail(adminId: string, targetUserId: string) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (error || !user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    // Obtener estadísticas del usuario
    const { data: matches } = await client
      .from('matches')
      .select('id')
      .or(`user_a_id.eq.${targetUserId},user_b_id.eq.${targetUserId}`);

    const { data: reports } = await client
      .from('reports')
      .select('id')
      .eq('reported_user_id', targetUserId);

    return {
      ...user,
      matchCount: matches?.length ?? 0,
      reportCount: reports?.length ?? 0,
    };
  }

  /**
   * Banear usuario
   */
  async banUser(adminId: string, targetUserId: string, reason: string) {
    await this.verifyAdmin(adminId);

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('REASON_REQUIRED');
    }

    if (adminId === targetUserId) {
      throw new BadRequestException('CANNOT_BAN_SELF');
    }

    const client = this.supabaseService.getClient();

    // Verificar que el usuario existe
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, is_banned')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    if (user.is_banned) {
      throw new BadRequestException('USER_ALREADY_BANNED');
    }

    // Banear
    const { error } = await client
      .from('users')
      .update({ is_banned: true })
      .eq('id', targetUserId);

    if (error) {
      throw new BadRequestException('BAN_FAILED');
    }

    // Registrar acción
    await this.logAction(adminId, targetUserId, 'user_ban', reason);

    return { userId: targetUserId, banned: true };
  }

  /**
   * Desbanear usuario
   */
  async unbanUser(adminId: string, targetUserId: string, reason: string) {
    await this.verifyAdmin(adminId);

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('REASON_REQUIRED');
    }

    const client = this.supabaseService.getClient();

    const { data: user, error: userError } = await client
      .from('users')
      .select('id, is_banned')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    if (!user.is_banned) {
      throw new BadRequestException('USER_NOT_BANNED');
    }

    const { error } = await client
      .from('users')
      .update({ is_banned: false })
      .eq('id', targetUserId);

    if (error) {
      throw new BadRequestException('UNBAN_FAILED');
    }

    await this.logAction(adminId, targetUserId, 'user_unban', reason);

    return { userId: targetUserId, banned: false };
  }

  /**
   * Advertir usuario
   */
  async warnUser(adminId: string, targetUserId: string, reason: string) {
    await this.verifyAdmin(adminId);

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('REASON_REQUIRED');
    }

    const client = this.supabaseService.getClient();

    const { data: user, error } = await client
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .single();

    if (error || !user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    await this.logAction(adminId, targetUserId, 'user_warn', reason);

    return { userId: targetUserId, warned: true };
  }

  // ============================================================
  // Gestión de Esencias (admin)
  // ============================================================

  /**
   * Otorgar Esencias a un usuario (admin grant)
   */
  async grantEsencias(
    adminId: string,
    targetUserId: string,
    amount: number,
    reason: string,
  ) {
    await this.verifyAdmin(adminId);

    if (amount <= 0 || amount > 10000) {
      throw new BadRequestException('INVALID_AMOUNT');
    }

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('REASON_REQUIRED');
    }

    const newBalance = await this.esenciasService.addEsencias(
      targetUserId,
      amount,
      `admin_grant: ${reason}`,
    );

    await this.logAction(adminId, targetUserId, 'esencias_grant', reason, {
      amount,
      newBalance,
    });

    return { userId: targetUserId, amount, newBalance };
  }

  // ============================================================
  // Cola de moderación
  // ============================================================

  /**
   * Obtener cola de moderación
   */
  async getModerationQueue(
    adminId: string,
    options: { status?: string; priority?: string; limit?: number } = {},
  ) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    let query = client
      .from('moderation_queue')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(options.limit ?? 50);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }

    const { data: items, error } = await query;

    if (error) {
      this.logger.error(`Error fetching moderation queue: ${error.message}`);
      return [];
    }

    return (items || []).map((item: any) => ({
      id: item.id,
      reportId: item.report_id,
      assignedTo: item.assigned_to,
      priority: item.priority,
      status: item.status,
      resolutionNotes: item.resolution_notes,
      createdAt: item.created_at,
    }));
  }

  /**
   * Asignarse un item de la cola
   */
  async assignQueueItem(adminId: string, queueItemId: string) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    const { data: item, error: fetchError } = await client
      .from('moderation_queue')
      .select('id, status')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !item) {
      throw new NotFoundException('QUEUE_ITEM_NOT_FOUND');
    }

    if (item.status !== 'pending') {
      throw new BadRequestException('ITEM_NOT_PENDING');
    }

    const { error } = await client
      .from('moderation_queue')
      .update({
        assigned_to: adminId,
        status: 'in_review',
      })
      .eq('id', queueItemId);

    if (error) {
      throw new BadRequestException('ASSIGN_FAILED');
    }

    return { id: queueItemId, status: 'in_review', assignedTo: adminId };
  }

  /**
   * Resolver un item de la cola
   */
  async resolveQueueItem(
    adminId: string,
    queueItemId: string,
    resolution: 'resolved' | 'dismissed',
    notes: string,
  ) {
    await this.verifyAdmin(adminId);

    if (!['resolved', 'dismissed'].includes(resolution)) {
      throw new BadRequestException('INVALID_RESOLUTION');
    }

    if (!notes || notes.trim().length < 5) {
      throw new BadRequestException('NOTES_REQUIRED');
    }

    const client = this.supabaseService.getClient();

    const { data: item, error: fetchError } = await client
      .from('moderation_queue')
      .select('id, status, assigned_to')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !item) {
      throw new NotFoundException('QUEUE_ITEM_NOT_FOUND');
    }

    if (item.status === 'resolved' || item.status === 'dismissed') {
      throw new BadRequestException('ITEM_ALREADY_RESOLVED');
    }

    const { error } = await client
      .from('moderation_queue')
      .update({
        status: resolution,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);

    if (error) {
      throw new BadRequestException('RESOLVE_FAILED');
    }

    const actionType = resolution === 'resolved' ? 'report_resolve' : 'report_dismiss';
    await this.logAction(adminId, null, actionType, notes, { queueItemId });

    return { id: queueItemId, status: resolution, resolvedBy: adminId };
  }

  // ============================================================
  // Gestión de roles
  // ============================================================

  /**
   * Otorgar rol de admin
   */
  async grantRole(
    adminId: string,
    targetUserId: string,
    role: string,
  ) {
    await this.verifySuperAdmin(adminId);

    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException('INVALID_ROLE');
    }

    if (adminId === targetUserId) {
      throw new BadRequestException('CANNOT_MODIFY_OWN_ROLE');
    }

    const client = this.supabaseService.getClient();

    // Verificar que el usuario existe
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const { error } = await client
      .from('admin_roles')
      .upsert({
        user_id: targetUserId,
        role,
        granted_by: adminId,
        is_active: true,
      }, { onConflict: 'user_id' });

    if (error) {
      throw new BadRequestException('GRANT_ROLE_FAILED');
    }

    return { userId: targetUserId, role, grantedBy: adminId };
  }

  /**
   * Revocar rol de admin
   */
  async revokeRole(adminId: string, targetUserId: string) {
    await this.verifySuperAdmin(adminId);

    if (adminId === targetUserId) {
      throw new BadRequestException('CANNOT_MODIFY_OWN_ROLE');
    }

    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('admin_roles')
      .update({ is_active: false })
      .eq('user_id', targetUserId);

    if (error) {
      throw new BadRequestException('REVOKE_ROLE_FAILED');
    }

    return { userId: targetUserId, roleRevoked: true };
  }

  /**
   * Listar admins activos
   */
  async listAdmins(adminId: string) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    const { data: admins, error } = await client
      .from('admin_roles')
      .select('user_id, role, granted_at, is_active')
      .eq('is_active', true);

    if (error) {
      return [];
    }

    return (admins || []).map((a: any) => ({
      userId: a.user_id,
      role: a.role,
      grantedAt: a.granted_at,
    }));
  }

  // ============================================================
  // Log de acciones
  // ============================================================

  /**
   * Obtener historial de acciones de moderación
   */
  async getActionLog(
    adminId: string,
    options: { actionType?: string; targetUserId?: string; limit?: number } = {},
  ) {
    await this.verifyAdmin(adminId);
    const client = this.supabaseService.getClient();

    let query = client
      .from('moderation_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 50);

    if (options.actionType) {
      query = query.eq('action_type', options.actionType);
    }

    if (options.targetUserId) {
      query = query.eq('target_user_id', options.targetUserId);
    }

    const { data: actions, error } = await query;

    if (error) {
      return [];
    }

    return (actions || []).map((a: any) => ({
      id: a.id,
      adminId: a.admin_id,
      targetUserId: a.target_user_id,
      actionType: a.action_type,
      reason: a.reason,
      details: a.details,
      createdAt: a.created_at,
    }));
  }

  // ============================================================
  // Helper privado
  // ============================================================

  private async logAction(
    adminId: string,
    targetUserId: string | null,
    actionType: string,
    reason: string,
    details: Record<string, any> = {},
  ) {
    try {
      const client = this.supabaseService.getClient();
      await client.from('moderation_actions').insert({
        admin_id: adminId,
        target_user_id: targetUserId,
        action_type: actionType,
        reason,
        details,
      });
    } catch (err) {
      this.logger.error(`Error logging moderation action: ${(err as Error).message}`);
    }
  }
}
