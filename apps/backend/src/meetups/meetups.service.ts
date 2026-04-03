import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

const MEETUP_REWARD = 30; // Esencias por usuario al confirmar encuentro
const CONFIRMATION_WINDOW_HOURS = 48; // Horas para que el segundo usuario confirme
const PROXIMITY_RADIUS_METERS = 500; // Radio para verificación de proximidad (más amplio que venues)
const MIN_HOURS_BETWEEN_MEETUPS = 24; // Mínimo entre meetups del mismo match

@Injectable()
export class MeetupsService {
  private readonly logger = new Logger(MeetupsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly esenciasService: EsenciasService,
  ) {}

  /**
   * Iniciar confirmación de meetup (primer usuario confirma)
   */
  async initiateMeetup(
    userId: string,
    matchId: string,
    options: { lat?: number; lng?: number } = {},
  ) {
    const client = this.supabaseService.getClient();

    // Verificar que el match existe y está activo
    const { data: match, error: matchError } = await client
      .from('matches')
      .select('id, user_a_id, user_b_id, status')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new NotFoundException('MATCH_NOT_FOUND');
    }

    if (match.status !== 'active') {
      throw new BadRequestException('MATCH_NOT_ACTIVE');
    }

    // Verificar que el usuario es parte del match
    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      throw new ForbiddenException('NOT_PART_OF_MATCH');
    }

    // Verificar que no hay un meetup pendiente o reciente
    const { data: existingMeetups } = await client
      .from('meetup_confirmations')
      .select('id, status, created_at')
      .eq('match_id', matchId)
      .in('status', ['pending', 'confirmed']);

    if (existingMeetups && existingMeetups.length > 0) {
      const pending = existingMeetups.find((m: any) => m.status === 'pending');
      if (pending) {
        throw new BadRequestException('MEETUP_ALREADY_PENDING');
      }

      // Verificar cooldown desde último meetup confirmado
      const lastConfirmed = existingMeetups
        .filter((m: any) => m.status === 'confirmed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastConfirmed) {
        const hoursSince = (Date.now() - new Date(lastConfirmed.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < MIN_HOURS_BETWEEN_MEETUPS) {
          throw new BadRequestException('MEETUP_COOLDOWN');
        }
      }
    }

    // Determinar si el usuario es A o B en el match
    const isUserA = match.user_a_id === userId;
    const expiresAt = new Date(Date.now() + CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const locationPoint = options.lat && options.lng
      ? `POINT(${options.lng} ${options.lat})`
      : null;

    const meetupData: any = {
      match_id: matchId,
      user_a_id: match.user_a_id,
      user_b_id: match.user_b_id,
      status: 'pending',
      expires_at: expiresAt,
    };

    if (isUserA) {
      meetupData.user_a_confirmed = true;
      meetupData.user_a_confirmed_at = new Date().toISOString();
      if (locationPoint) meetupData.user_a_location = locationPoint;
    } else {
      meetupData.user_b_confirmed = true;
      meetupData.user_b_confirmed_at = new Date().toISOString();
      if (locationPoint) meetupData.user_b_location = locationPoint;
    }

    const { data: meetup, error } = await client
      .from('meetup_confirmations')
      .insert(meetupData)
      .select()
      .single();

    if (error || !meetup) {
      this.logger.error(`Error creating meetup: ${error?.message}`);
      throw new BadRequestException('MEETUP_CREATE_FAILED');
    }

    // Registrar en historial
    await client.from('meetup_history').insert({
      meetup_id: meetup.id,
      user_id: userId,
      action: 'initiated',
      location: locationPoint,
    });

    return {
      id: meetup.id,
      matchId: meetup.match_id,
      status: meetup.status,
      initiatedBy: userId,
      expiresAt: meetup.expires_at,
      userAConfirmed: meetup.user_a_confirmed,
      userBConfirmed: meetup.user_b_confirmed,
    };
  }

  /**
   * Confirmar meetup (segundo usuario confirma → completa el meetup)
   */
  async confirmMeetup(
    userId: string,
    meetupId: string,
    options: { lat?: number; lng?: number } = {},
  ) {
    const client = this.supabaseService.getClient();

    // Obtener el meetup
    const { data: meetup, error: meetupError } = await client
      .from('meetup_confirmations')
      .select('*')
      .eq('id', meetupId)
      .single();

    if (meetupError || !meetup) {
      throw new NotFoundException('MEETUP_NOT_FOUND');
    }

    if (meetup.status !== 'pending') {
      throw new BadRequestException('MEETUP_NOT_PENDING');
    }

    // Verificar que el usuario es parte del meetup
    if (meetup.user_a_id !== userId && meetup.user_b_id !== userId) {
      throw new ForbiddenException('NOT_PART_OF_MEETUP');
    }

    // Verificar que no es el mismo usuario que ya confirmó
    const isUserA = meetup.user_a_id === userId;
    if (isUserA && meetup.user_a_confirmed) {
      throw new BadRequestException('ALREADY_CONFIRMED');
    }
    if (!isUserA && meetup.user_b_confirmed) {
      throw new BadRequestException('ALREADY_CONFIRMED');
    }

    // Verificar que no ha expirado
    if (new Date(meetup.expires_at) < new Date()) {
      // Marcar como expirado
      await client
        .from('meetup_confirmations')
        .update({ status: 'expired' })
        .eq('id', meetupId);

      throw new BadRequestException('MEETUP_EXPIRED');
    }

    // Verificar proximidad si ambos proporcionaron ubicación
    let proximityVerified = false;
    const locationPoint = options.lat && options.lng
      ? `POINT(${options.lng} ${options.lat})`
      : null;

    if (locationPoint) {
      const otherLocation = isUserA ? meetup.user_b_location : meetup.user_a_location;
      if (otherLocation) {
        const otherCoords = this.parseLocation(otherLocation);
        if (otherCoords) {
          const distance = this.calculateDistance(
            options.lat!,
            options.lng!,
            otherCoords.lat,
            otherCoords.lng,
          );
          proximityVerified = distance <= PROXIMITY_RADIUS_METERS;
        }
      }
    }

    // Actualizar confirmación
    const updateData: any = {
      status: 'confirmed',
      esencias_awarded: MEETUP_REWARD,
    };

    if (isUserA) {
      updateData.user_a_confirmed = true;
      updateData.user_a_confirmed_at = new Date().toISOString();
      if (locationPoint) updateData.user_a_location = locationPoint;
    } else {
      updateData.user_b_confirmed = true;
      updateData.user_b_confirmed_at = new Date().toISOString();
      if (locationPoint) updateData.user_b_location = locationPoint;
    }

    const { error: updateError } = await client
      .from('meetup_confirmations')
      .update(updateData)
      .eq('id', meetupId);

    if (updateError) {
      this.logger.error(`Error confirming meetup: ${updateError.message}`);
      throw new BadRequestException('MEETUP_CONFIRM_FAILED');
    }

    // Registrar en historial
    await client.from('meetup_history').insert({
      meetup_id: meetupId,
      user_id: userId,
      action: 'confirmed',
      location: locationPoint,
    });

    // Otorgar Esencias a ambos usuarios
    let esenciasAwarded = { userA: 0, userB: 0 };
    try {
      const balanceA = await this.esenciasService.addEsencias(
        meetup.user_a_id,
        MEETUP_REWARD,
        'meetup_confirmation',
      );
      const balanceB = await this.esenciasService.addEsencias(
        meetup.user_b_id,
        MEETUP_REWARD,
        'meetup_confirmation',
      );
      esenciasAwarded = { userA: MEETUP_REWARD, userB: MEETUP_REWARD };
    } catch (err) {
      this.logger.error(`Error awarding meetup Esencias: ${(err as Error).message}`);
      // No lanzar - el meetup ya se confirmó
    }

    return {
      id: meetupId,
      matchId: meetup.match_id,
      status: 'confirmed',
      userAConfirmed: true,
      userBConfirmed: true,
      proximityVerified,
      esenciasAwarded,
    };
  }

  /**
   * Obtener meetups del usuario (pendientes y confirmados)
   */
  async getMyMeetups(
    userId: string,
    status?: string,
    limit: number = 20,
  ) {
    const client = this.supabaseService.getClient();

    let query = client
      .from('meetup_confirmations')
      .select('*')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: meetups, error } = await query;

    if (error) {
      this.logger.error(`Error fetching meetups: ${error.message}`);
      throw new BadRequestException('FETCH_MEETUPS_FAILED');
    }

    return (meetups || []).map((m: any) => ({
      id: m.id,
      matchId: m.match_id,
      status: m.status,
      userAId: m.user_a_id,
      userBId: m.user_b_id,
      userAConfirmed: m.user_a_confirmed,
      userBConfirmed: m.user_b_confirmed,
      esenciasAwarded: m.esencias_awarded,
      expiresAt: m.expires_at,
      createdAt: m.created_at,
    }));
  }

  /**
   * Obtener detalle de un meetup
   */
  async getMeetupDetail(userId: string, meetupId: string) {
    const client = this.supabaseService.getClient();

    const { data: meetup, error } = await client
      .from('meetup_confirmations')
      .select('*')
      .eq('id', meetupId)
      .single();

    if (error || !meetup) {
      throw new NotFoundException('MEETUP_NOT_FOUND');
    }

    // Verificar que el usuario es parte del meetup
    if (meetup.user_a_id !== userId && meetup.user_b_id !== userId) {
      throw new ForbiddenException('NOT_PART_OF_MEETUP');
    }

    // Obtener info del otro usuario
    const otherUserId = meetup.user_a_id === userId ? meetup.user_b_id : meetup.user_a_id;
    const { data: otherUser } = await client
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', otherUserId)
      .single();

    return {
      id: meetup.id,
      matchId: meetup.match_id,
      status: meetup.status,
      otherUser: otherUser || { id: otherUserId, display_name: 'Usuario', avatar_url: null },
      myConfirmation: meetup.user_a_id === userId ? meetup.user_a_confirmed : meetup.user_b_confirmed,
      otherConfirmation: meetup.user_a_id === userId ? meetup.user_b_confirmed : meetup.user_a_confirmed,
      esenciasAwarded: meetup.esencias_awarded,
      expiresAt: meetup.expires_at,
      createdAt: meetup.created_at,
    };
  }

  /**
   * Obtener meetups pendientes que necesitan mi confirmación
   */
  async getPendingMeetups(userId: string) {
    const client = this.supabaseService.getClient();

    const { data: meetups, error } = await client
      .from('meetup_confirmations')
      .select('*')
      .eq('status', 'pending')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

    if (error) {
      this.logger.error(`Error fetching pending meetups: ${error.message}`);
      return [];
    }

    // Filtrar solo los que necesitan MI confirmación
    return (meetups || [])
      .filter((m: any) => {
        if (m.user_a_id === userId && !m.user_a_confirmed) return true;
        if (m.user_b_id === userId && !m.user_b_confirmed) return true;
        return false;
      })
      .map((m: any) => ({
        id: m.id,
        matchId: m.match_id,
        status: m.status,
        initiatedBy: m.user_a_confirmed ? m.user_a_id : m.user_b_id,
        expiresAt: m.expires_at,
        createdAt: m.created_at,
      }));
  }

  /**
   * Disputar un meetup (reportar falsa confirmación)
   */
  async disputeMeetup(userId: string, meetupId: string) {
    const client = this.supabaseService.getClient();

    const { data: meetup, error } = await client
      .from('meetup_confirmations')
      .select('*')
      .eq('id', meetupId)
      .single();

    if (error || !meetup) {
      throw new NotFoundException('MEETUP_NOT_FOUND');
    }

    if (meetup.user_a_id !== userId && meetup.user_b_id !== userId) {
      throw new ForbiddenException('NOT_PART_OF_MEETUP');
    }

    if (meetup.status !== 'pending') {
      throw new BadRequestException('ONLY_PENDING_CAN_BE_DISPUTED');
    }

    const { error: updateError } = await client
      .from('meetup_confirmations')
      .update({ status: 'disputed' })
      .eq('id', meetupId);

    if (updateError) {
      throw new BadRequestException('DISPUTE_FAILED');
    }

    // Registrar en historial
    await client.from('meetup_history').insert({
      meetup_id: meetupId,
      user_id: userId,
      action: 'disputed',
    });

    return { id: meetupId, status: 'disputed' };
  }

  /**
   * Obtener estadísticas de meetups del usuario
   */
  async getMeetupStats(userId: string) {
    const client = this.supabaseService.getClient();

    const { data: meetups, error } = await client
      .from('meetup_confirmations')
      .select('status, esencias_awarded')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

    if (error || !meetups) {
      return { total: 0, confirmed: 0, pending: 0, expired: 0, disputed: 0, totalEsencias: 0 };
    }

    const stats = {
      total: meetups.length,
      confirmed: meetups.filter((m: any) => m.status === 'confirmed').length,
      pending: meetups.filter((m: any) => m.status === 'pending').length,
      expired: meetups.filter((m: any) => m.status === 'expired').length,
      disputed: meetups.filter((m: any) => m.status === 'disputed').length,
      totalEsencias: meetups
        .filter((m: any) => m.status === 'confirmed')
        .reduce((sum: number, m: any) => sum + (m.esencias_awarded || 0), 0),
    };

    return stats;
  }

  // ============================================================
  // Helpers de ubicación (misma lógica que VenuesService)
  // ============================================================

  private parseLocation(location: any): { lat: number; lng: number } | null {
    if (!location) return null;

    if (location.coordinates && Array.isArray(location.coordinates)) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }

    if (typeof location === 'string') {
      const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }

    return null;
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
