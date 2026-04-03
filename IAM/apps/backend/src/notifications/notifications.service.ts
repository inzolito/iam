import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type NotificationType =
  | 'match_new'
  | 'message_new'
  | 'meetup_initiated'
  | 'meetup_confirmed'
  | 'meetup_expired'
  | 'body_doubling_invite'
  | 'body_doubling_start'
  | 'esencias_received'
  | 'esencias_earned'
  | 'unlock_available'
  | 'streak_milestone'
  | 'system';

const VALID_TYPES: NotificationType[] = [
  'match_new', 'message_new', 'meetup_initiated', 'meetup_confirmed',
  'meetup_expired', 'body_doubling_invite', 'body_doubling_start',
  'esencias_received', 'esencias_earned', 'unlock_available',
  'streak_milestone', 'system',
];

const VALID_PLATFORMS = ['ios', 'android', 'web'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // ============================================================
  // Crear notificaciones
  // ============================================================

  /**
   * Crear y enviar notificación a un usuario
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any> = {},
  ) {
    if (!VALID_TYPES.includes(type)) {
      throw new BadRequestException('INVALID_NOTIFICATION_TYPE');
    }

    if (!title || title.trim().length === 0) {
      throw new BadRequestException('TITLE_REQUIRED');
    }

    if (!body || body.trim().length === 0) {
      throw new BadRequestException('BODY_REQUIRED');
    }

    if (title.length > 100) {
      throw new BadRequestException('TITLE_TOO_LONG');
    }

    if (body.length > 500) {
      throw new BadRequestException('BODY_TOO_LONG');
    }

    const client = this.supabaseService.getClient();

    // Verificar preferencias del usuario
    const shouldSend = await this.checkPreferences(userId, type);

    // Sanitizar
    const sanitizedTitle = title.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sanitizedBody = body.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Crear notificación in-app
    const { data: notification, error } = await client
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title: sanitizedTitle,
        body: sanitizedBody,
        data,
        is_read: false,
        push_sent: false,
      })
      .select()
      .single();

    if (error || !notification) {
      this.logger.error(`Error creating notification: ${error?.message}`);
      throw new BadRequestException('NOTIFICATION_CREATE_FAILED');
    }

    // Intentar enviar push (non-blocking)
    if (shouldSend) {
      try {
        await this.sendPush(userId, sanitizedTitle, sanitizedBody, data, notification.id);
      } catch (err) {
        this.logger.error(`Error sending push: ${(err as Error).message}`);
        // No lanzar - la notificación in-app ya se creó
      }
    }

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      isRead: notification.is_read,
      pushSent: notification.push_sent,
      createdAt: notification.created_at,
    };
  }

  /**
   * Crear notificación para múltiples usuarios (batch)
   */
  async createBatchNotifications(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any> = {},
  ) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    if (userIds.length > 100) {
      throw new BadRequestException('TOO_MANY_RECIPIENTS');
    }

    const results = [];
    for (const userId of userIds) {
      try {
        const notif = await this.createNotification(userId, type, title, body, data);
        results.push(notif);
      } catch (err) {
        this.logger.error(`Error creating notification for ${userId}: ${(err as Error).message}`);
      }
    }

    return results;
  }

  // ============================================================
  // Leer notificaciones
  // ============================================================

  /**
   * Obtener notificaciones del usuario
   */
  async getNotifications(
    userId: string,
    options: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number } = {},
  ) {
    const client = this.supabaseService.getClient();
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    let query = client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options.type) {
      query = query.eq('type', options.type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      this.logger.error(`Error fetching notifications: ${error.message}`);
      return [];
    }

    return (notifications || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      isRead: n.is_read,
      readAt: n.read_at,
      createdAt: n.created_at,
    }));
  }

  /**
   * Obtener conteo de notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      this.logger.error(`Error counting unread: ${error.message}`);
      return 0;
    }

    return data?.length ?? 0;
  }

  // ============================================================
  // Marcar como leída
  // ============================================================

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(userId: string, notificationId: string) {
    const client = this.supabaseService.getClient();

    const { data: notification, error: fetchError } = await client
      .from('notifications')
      .select('id, user_id, is_read')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new NotFoundException('NOTIFICATION_NOT_FOUND');
    }

    if (notification.user_id !== userId) {
      throw new BadRequestException('NOT_YOUR_NOTIFICATION');
    }

    if (notification.is_read) {
      return { id: notificationId, isRead: true, readAt: new Date().toISOString() };
    }

    const { error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      throw new BadRequestException('MARK_READ_FAILED');
    }

    return { id: notificationId, isRead: true, readAt: new Date().toISOString() };
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string) {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      this.logger.error(`Error marking all as read: ${error.message}`);
      throw new BadRequestException('MARK_ALL_READ_FAILED');
    }

    return { success: true };
  }

  // ============================================================
  // Dispositivos
  // ============================================================

  /**
   * Registrar token de dispositivo
   */
  async registerDevice(userId: string, deviceToken: string, platform: string) {
    if (!deviceToken || deviceToken.trim().length === 0) {
      throw new BadRequestException('DEVICE_TOKEN_REQUIRED');
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      throw new BadRequestException('INVALID_PLATFORM');
    }

    const client = this.supabaseService.getClient();

    // Upsert para evitar duplicados
    const { data: device, error } = await client
      .from('user_devices')
      .upsert(
        {
          user_id: userId,
          device_token: deviceToken.trim(),
          platform,
          is_active: true,
        },
        { onConflict: 'user_id,device_token' },
      )
      .select()
      .single();

    if (error || !device) {
      this.logger.error(`Error registering device: ${error?.message}`);
      throw new BadRequestException('DEVICE_REGISTER_FAILED');
    }

    return {
      id: device.id,
      platform: device.platform,
      isActive: device.is_active,
    };
  }

  /**
   * Desactivar token de dispositivo
   */
  async unregisterDevice(userId: string, deviceToken: string) {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('user_devices')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('device_token', deviceToken);

    if (error) {
      throw new BadRequestException('DEVICE_UNREGISTER_FAILED');
    }

    return { success: true };
  }

  /**
   * Obtener dispositivos activos del usuario
   */
  async getUserDevices(userId: string) {
    const client = this.supabaseService.getClient();

    const { data: devices, error } = await client
      .from('user_devices')
      .select('id, platform, is_active, created_at')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      return [];
    }

    return (devices || []).map((d: any) => ({
      id: d.id,
      platform: d.platform,
      isActive: d.is_active,
      createdAt: d.created_at,
    }));
  }

  // ============================================================
  // Preferencias
  // ============================================================

  /**
   * Obtener preferencias de notificaciones
   */
  async getPreferences(userId: string) {
    const client = this.supabaseService.getClient();

    const { data: prefs, error } = await client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !prefs) {
      // Retornar defaults si no existen
      return {
        pushMatchNew: true,
        pushMessageNew: true,
        pushMeetup: true,
        pushBodyDoubling: true,
        pushEsencias: true,
        pushStreak: true,
        pushSystem: true,
        inAppEnabled: true,
        dndEnabled: false,
        dndStartHour: 22,
        dndEndHour: 8,
        soundEnabled: true,
        vibrationEnabled: true,
      };
    }

    return {
      pushMatchNew: prefs.push_match_new,
      pushMessageNew: prefs.push_message_new,
      pushMeetup: prefs.push_meetup,
      pushBodyDoubling: prefs.push_body_doubling,
      pushEsencias: prefs.push_esencias,
      pushStreak: prefs.push_streak,
      pushSystem: prefs.push_system,
      inAppEnabled: prefs.in_app_enabled,
      dndEnabled: prefs.dnd_enabled,
      dndStartHour: prefs.dnd_start_hour,
      dndEndHour: prefs.dnd_end_hour,
      soundEnabled: prefs.sound_enabled,
      vibrationEnabled: prefs.vibration_enabled,
    };
  }

  /**
   * Actualizar preferencias de notificaciones
   */
  async updatePreferences(
    userId: string,
    updates: Partial<{
      pushMatchNew: boolean;
      pushMessageNew: boolean;
      pushMeetup: boolean;
      pushBodyDoubling: boolean;
      pushEsencias: boolean;
      pushStreak: boolean;
      pushSystem: boolean;
      inAppEnabled: boolean;
      dndEnabled: boolean;
      dndStartHour: number;
      dndEndHour: number;
      soundEnabled: boolean;
      vibrationEnabled: boolean;
    }>,
  ) {
    if (updates.dndStartHour !== undefined && (updates.dndStartHour < 0 || updates.dndStartHour > 23)) {
      throw new BadRequestException('INVALID_DND_HOUR');
    }
    if (updates.dndEndHour !== undefined && (updates.dndEndHour < 0 || updates.dndEndHour > 23)) {
      throw new BadRequestException('INVALID_DND_HOUR');
    }

    const client = this.supabaseService.getClient();

    // Mapear camelCase a snake_case
    const dbUpdates: any = {};
    if (updates.pushMatchNew !== undefined) dbUpdates.push_match_new = updates.pushMatchNew;
    if (updates.pushMessageNew !== undefined) dbUpdates.push_message_new = updates.pushMessageNew;
    if (updates.pushMeetup !== undefined) dbUpdates.push_meetup = updates.pushMeetup;
    if (updates.pushBodyDoubling !== undefined) dbUpdates.push_body_doubling = updates.pushBodyDoubling;
    if (updates.pushEsencias !== undefined) dbUpdates.push_esencias = updates.pushEsencias;
    if (updates.pushStreak !== undefined) dbUpdates.push_streak = updates.pushStreak;
    if (updates.pushSystem !== undefined) dbUpdates.push_system = updates.pushSystem;
    if (updates.inAppEnabled !== undefined) dbUpdates.in_app_enabled = updates.inAppEnabled;
    if (updates.dndEnabled !== undefined) dbUpdates.dnd_enabled = updates.dndEnabled;
    if (updates.dndStartHour !== undefined) dbUpdates.dnd_start_hour = updates.dndStartHour;
    if (updates.dndEndHour !== undefined) dbUpdates.dnd_end_hour = updates.dndEndHour;
    if (updates.soundEnabled !== undefined) dbUpdates.sound_enabled = updates.soundEnabled;
    if (updates.vibrationEnabled !== undefined) dbUpdates.vibration_enabled = updates.vibrationEnabled;

    if (Object.keys(dbUpdates).length === 0) {
      return this.getPreferences(userId);
    }

    const { error } = await client
      .from('notification_preferences')
      .upsert(
        { user_id: userId, ...dbUpdates },
        { onConflict: 'user_id' },
      );

    if (error) {
      this.logger.error(`Error updating preferences: ${error.message}`);
      throw new BadRequestException('PREFERENCES_UPDATE_FAILED');
    }

    return this.getPreferences(userId);
  }

  // ============================================================
  // Helpers internos
  // ============================================================

  /**
   * Verificar si se debe enviar push según preferencias
   */
  private async checkPreferences(userId: string, type: NotificationType): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    if (!prefs.inAppEnabled) return false;

    // Verificar DND
    if (prefs.dndEnabled) {
      const now = new Date();
      const hour = now.getHours();
      if (prefs.dndStartHour > prefs.dndEndHour) {
        // Overnight DND (e.g., 22-8)
        if (hour >= prefs.dndStartHour || hour < prefs.dndEndHour) return false;
      } else {
        // Same day DND (e.g., 14-16)
        if (hour >= prefs.dndStartHour && hour < prefs.dndEndHour) return false;
      }
    }

    // Verificar tipo
    switch (type) {
      case 'match_new': return prefs.pushMatchNew;
      case 'message_new': return prefs.pushMessageNew;
      case 'meetup_initiated':
      case 'meetup_confirmed':
      case 'meetup_expired': return prefs.pushMeetup;
      case 'body_doubling_invite':
      case 'body_doubling_start': return prefs.pushBodyDoubling;
      case 'esencias_received':
      case 'esencias_earned':
      case 'unlock_available': return prefs.pushEsencias;
      case 'streak_milestone': return prefs.pushStreak;
      case 'system': return prefs.pushSystem;
      default: return true;
    }
  }

  /**
   * Enviar push notification (placeholder - integrar con FCM/APNs)
   */
  private async sendPush(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any>,
    notificationId: string,
  ) {
    const client = this.supabaseService.getClient();

    // Obtener dispositivos activos
    const { data: devices } = await client
      .from('user_devices')
      .select('device_token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!devices || devices.length === 0) {
      return; // No hay dispositivos registrados
    }

    // TODO: Integrar con Firebase Cloud Messaging / APNs
    // Por ahora solo marcamos como enviado
    this.logger.log(`Push notification queued for ${devices.length} devices of user ${userId}`);

    // Marcar como enviado
    await client
      .from('notifications')
      .update({ push_sent: true, push_sent_at: new Date().toISOString() })
      .eq('id', notificationId);
  }
}
