import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

const SESSION_COMPLETION_REWARD = 20;
const HOST_BONUS = 10; // Extra para quien crea la sesión
const MIN_COMPLETION_PERCENT = 0.5; // 50% del tiempo para recibir reward

interface SessionSummary {
  id: string;
  hostId: string;
  hostName: string | null;
  title: string;
  activityType: string;
  durationMinutes: number;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  isPublic: boolean;
  scheduledFor: string | null;
  createdAt: string;
}

interface SessionDetail extends SessionSummary {
  description: string | null;
  participants: ParticipantInfo[];
  esenciasReward: number;
  venueId: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

interface ParticipantInfo {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  joinedAt: string;
}

@Injectable()
export class BodyDoublingService {
  private readonly logger = new Logger(BodyDoublingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly esenciasService: EsenciasService,
  ) {}

  // ============================================================
  // CREAR SESIÓN
  // ============================================================

  async createSession(
    hostId: string,
    title: string,
    activityType: string,
    durationMinutes: number,
    options: {
      description?: string;
      maxParticipants?: number;
      isPublic?: boolean;
      scheduledFor?: string;
      venueId?: string;
    } = {},
  ): Promise<SessionDetail> {
    // Validaciones
    if (!title || title.trim().length < 3 || title.trim().length > 100) {
      throw new BadRequestException('INVALID_TITLE');
    }

    const validActivities = [
      'estudio', 'trabajo', 'lectura', 'arte', 'ejercicio',
      'limpieza', 'cocina', 'meditacion', 'programacion', 'otro',
    ];
    if (!validActivities.includes(activityType)) {
      throw new BadRequestException('INVALID_ACTIVITY_TYPE');
    }

    if (durationMinutes < 15 || durationMinutes > 480) {
      throw new BadRequestException('INVALID_DURATION');
    }

    if (options.description && options.description.length > 300) {
      throw new BadRequestException('DESCRIPTION_TOO_LONG');
    }

    const maxPart = options.maxParticipants ?? 5;
    if (maxPart < 2 || maxPart > 20) {
      throw new BadRequestException('INVALID_MAX_PARTICIPANTS');
    }

    // Verificar que el host no tenga otra sesión activa
    const client = this.supabaseService.getClient();

    const { data: activeSessions } = await client
      .from('body_doubling_sessions')
      .select('id')
      .eq('host_id', hostId)
      .in('status', ['waiting', 'active']);

    if (activeSessions && activeSessions.length > 0) {
      throw new BadRequestException('ALREADY_HOSTING_SESSION');
    }

    // Sanitizar
    const sanitizedTitle = title.trim()
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sanitizedDesc = options.description
      ? options.description.trim()
          .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : null;

    // Crear sesión
    const { data: session, error } = await client
      .from('body_doubling_sessions')
      .insert({
        host_id: hostId,
        title: sanitizedTitle,
        description: sanitizedDesc,
        activity_type: activityType,
        duration_minutes: durationMinutes,
        max_participants: maxPart,
        is_public: options.isPublic ?? true,
        scheduled_for: options.scheduledFor || null,
        venue_id: options.venueId || null,
        esencias_reward: SESSION_COMPLETION_REWARD,
        status: 'waiting',
      })
      .select()
      .single();

    if (error || !session) {
      this.logger.error(`Error creating session: ${error?.message}`);
      throw new BadRequestException('SESSION_CREATE_FAILED');
    }

    // Host se une automáticamente
    await client.from('body_doubling_participants').insert({
      session_id: session.id,
      user_id: hostId,
      status: 'joined',
    });

    return this.formatSessionDetail(session, [
      { user_id: hostId, display_name: null, avatar_url: null, status: 'joined', joined_at: new Date().toISOString() },
    ]);
  }

  // ============================================================
  // LISTAR SESIONES
  // ============================================================

  async getAvailableSessions(
    activityType?: string,
    limit: number = 20,
  ): Promise<SessionSummary[]> {
    if (limit <= 0 || limit > 50) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    const client = this.supabaseService.getClient();

    let query = client
      .from('body_doubling_sessions')
      .select('*, users!body_doubling_sessions_host_id_fkey(display_name)')
      .eq('is_public', true)
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error fetching sessions: ${error.message}`);
      return [];
    }

    // Obtener conteo de participantes por sesión
    return (data || []).map((s: any) => ({
      id: s.id,
      hostId: s.host_id,
      hostName: s.users?.display_name || null,
      title: s.title,
      activityType: s.activity_type,
      durationMinutes: s.duration_minutes,
      maxParticipants: s.max_participants,
      currentParticipants: 0, // Se calcula si se necesita
      status: s.status,
      isPublic: s.is_public,
      scheduledFor: s.scheduled_for,
      createdAt: s.created_at,
    }));
  }

  /**
   * Obtener sesiones del usuario (como host o participante)
   */
  async getMySessions(userId: string): Promise<SessionSummary[]> {
    const client = this.supabaseService.getClient();

    // Sesiones donde es host
    const { data: hosted } = await client
      .from('body_doubling_sessions')
      .select('*')
      .eq('host_id', userId)
      .in('status', ['waiting', 'active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Sesiones donde participa
    const { data: participating } = await client
      .from('body_doubling_participants')
      .select('session_id')
      .eq('user_id', userId)
      .in('status', ['joined', 'active']);

    const participatingIds = (participating || []).map((p: any) => p.session_id);

    let joinedSessions: any[] = [];
    if (participatingIds.length > 0) {
      const { data } = await client
        .from('body_doubling_sessions')
        .select('*')
        .in('id', participatingIds)
        .neq('host_id', userId);

      joinedSessions = data || [];
    }

    const allSessions = [...(hosted || []), ...joinedSessions];

    return allSessions.map((s: any) => ({
      id: s.id,
      hostId: s.host_id,
      hostName: null,
      title: s.title,
      activityType: s.activity_type,
      durationMinutes: s.duration_minutes,
      maxParticipants: s.max_participants,
      currentParticipants: 0,
      status: s.status,
      isPublic: s.is_public,
      scheduledFor: s.scheduled_for,
      createdAt: s.created_at,
    }));
  }

  // ============================================================
  // DETALLE DE SESIÓN
  // ============================================================

  async getSessionDetail(sessionId: string): Promise<SessionDetail> {
    const client = this.supabaseService.getClient();

    const { data: session, error } = await client
      .from('body_doubling_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    // Obtener participantes
    const { data: participants } = await client
      .from('body_doubling_participants')
      .select('user_id, status, joined_at, users(display_name, avatar_url)')
      .eq('session_id', sessionId);

    return this.formatSessionDetail(session, participants || []);
  }

  // ============================================================
  // UNIRSE A SESIÓN
  // ============================================================

  async joinSession(userId: string, sessionId: string): Promise<{ joined: boolean }> {
    const client = this.supabaseService.getClient();

    // Obtener sesión
    const { data: session, error } = await client
      .from('body_doubling_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    if (session.status !== 'waiting' && session.status !== 'active') {
      throw new BadRequestException('SESSION_NOT_JOINABLE');
    }

    if (session.host_id === userId) {
      throw new BadRequestException('ALREADY_HOST');
    }

    // Verificar si ya está unido
    const { data: existing } = await client
      .from('body_doubling_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.status !== 'left') {
      throw new BadRequestException('ALREADY_JOINED');
    }

    // Verificar capacidad
    const { data: participants } = await client
      .from('body_doubling_participants')
      .select('id')
      .eq('session_id', sessionId)
      .in('status', ['joined', 'active']);

    if ((participants?.length || 0) >= session.max_participants) {
      throw new BadRequestException('SESSION_FULL');
    }

    // Unirse (o re-unirse si se fue)
    if (existing) {
      await client
        .from('body_doubling_participants')
        .update({ status: 'joined', joined_at: new Date().toISOString(), left_at: null })
        .eq('id', existing.id);
    } else {
      const { error: joinError } = await client
        .from('body_doubling_participants')
        .insert({
          session_id: sessionId,
          user_id: userId,
          status: 'joined',
        });

      if (joinError) {
        this.logger.error(`Error joining session: ${joinError.message}`);
        throw new BadRequestException('JOIN_FAILED');
      }
    }

    return { joined: true };
  }

  // ============================================================
  // SALIR DE SESIÓN
  // ============================================================

  async leaveSession(userId: string, sessionId: string): Promise<{ left: boolean }> {
    const client = this.supabaseService.getClient();

    const { data: session } = await client
      .from('body_doubling_sessions')
      .select('host_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    if (session.host_id === userId) {
      throw new BadRequestException('HOST_CANNOT_LEAVE');
    }

    const { error } = await client
      .from('body_doubling_participants')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Error leaving session: ${error.message}`);
      throw new BadRequestException('LEAVE_FAILED');
    }

    return { left: true };
  }

  // ============================================================
  // INICIAR SESIÓN (solo host)
  // ============================================================

  async startSession(userId: string, sessionId: string): Promise<{ started: boolean }> {
    const client = this.supabaseService.getClient();

    const { data: session } = await client
      .from('body_doubling_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    if (session.host_id !== userId) {
      throw new ForbiddenException('ONLY_HOST_CAN_START');
    }

    if (session.status !== 'waiting') {
      throw new BadRequestException('SESSION_NOT_WAITING');
    }

    // Verificar que hay al menos 2 participantes
    const { data: participants } = await client
      .from('body_doubling_participants')
      .select('id')
      .eq('session_id', sessionId)
      .in('status', ['joined', 'active']);

    if ((participants?.length || 0) < 2) {
      throw new BadRequestException('NEED_MORE_PARTICIPANTS');
    }

    // Iniciar
    const now = new Date().toISOString();
    await client
      .from('body_doubling_sessions')
      .update({ status: 'active', started_at: now })
      .eq('id', sessionId);

    // Marcar participantes como activos
    await client
      .from('body_doubling_participants')
      .update({ status: 'active' })
      .eq('session_id', sessionId)
      .eq('status', 'joined');

    return { started: true };
  }

  // ============================================================
  // COMPLETAR SESIÓN (solo host)
  // ============================================================

  async completeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ completed: boolean; rewards: { userId: string; esencias: number }[] }> {
    const client = this.supabaseService.getClient();

    const { data: session } = await client
      .from('body_doubling_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    if (session.host_id !== userId) {
      throw new ForbiddenException('ONLY_HOST_CAN_COMPLETE');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('SESSION_NOT_ACTIVE');
    }

    const now = new Date();
    const endedAt = now.toISOString();

    // Verificar que pasó al menos 50% de la duración
    if (session.started_at) {
      const startTime = new Date(session.started_at).getTime();
      const elapsed = (now.getTime() - startTime) / 60000; // minutos
      const minRequired = session.duration_minutes * MIN_COMPLETION_PERCENT;

      if (elapsed < minRequired) {
        throw new BadRequestException('SESSION_TOO_SHORT');
      }
    }

    // Marcar sesión como completada
    await client
      .from('body_doubling_sessions')
      .update({ status: 'completed', ended_at: endedAt })
      .eq('id', sessionId);

    // Obtener participantes activos
    const { data: activeParticipants } = await client
      .from('body_doubling_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('status', 'active');

    // Otorgar Esencias a todos los participantes activos
    const rewards: { userId: string; esencias: number }[] = [];

    for (const participant of (activeParticipants || [])) {
      const isHost = participant.user_id === session.host_id;
      const reward = SESSION_COMPLETION_REWARD + (isHost ? HOST_BONUS : 0);

      try {
        await this.esenciasService.addEsencias(
          participant.user_id,
          reward,
          `body_doubling_${isHost ? 'host' : 'participant'}`,
        );

        await client
          .from('body_doubling_participants')
          .update({
            status: 'completed',
            completed_at: endedAt,
            esencias_awarded: reward,
          })
          .eq('session_id', sessionId)
          .eq('user_id', participant.user_id);

        rewards.push({ userId: participant.user_id, esencias: reward });
      } catch (error) {
        this.logger.error(`Error awarding Esencias to ${participant.user_id}: ${error}`);
        rewards.push({ userId: participant.user_id, esencias: 0 });
      }
    }

    return { completed: true, rewards };
  }

  // ============================================================
  // CANCELAR SESIÓN (solo host)
  // ============================================================

  async cancelSession(userId: string, sessionId: string): Promise<{ cancelled: boolean }> {
    const client = this.supabaseService.getClient();

    const { data: session } = await client
      .from('body_doubling_sessions')
      .select('host_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    if (session.host_id !== userId) {
      throw new ForbiddenException('ONLY_HOST_CAN_CANCEL');
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException('SESSION_ALREADY_ENDED');
    }

    await client
      .from('body_doubling_sessions')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    return { cancelled: true };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private formatSessionDetail(session: any, participants: any[]): SessionDetail {
    return {
      id: session.id,
      hostId: session.host_id,
      hostName: null,
      title: session.title,
      description: session.description,
      activityType: session.activity_type,
      durationMinutes: session.duration_minutes,
      maxParticipants: session.max_participants,
      currentParticipants: participants.filter(
        (p: any) => p.status === 'joined' || p.status === 'active',
      ).length,
      status: session.status,
      isPublic: session.is_public,
      scheduledFor: session.scheduled_for,
      esenciasReward: session.esencias_reward || SESSION_COMPLETION_REWARD,
      venueId: session.venue_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      createdAt: session.created_at,
      participants: participants.map((p: any) => ({
        userId: p.user_id,
        displayName: p.users?.display_name || p.display_name || null,
        avatarUrl: p.users?.avatar_url || p.avatar_url || null,
        status: p.status,
        joinedAt: p.joined_at,
      })),
    };
  }
}
