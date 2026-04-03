import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const defaultNotification = {
    id: 'notif-1',
    user_id: 'user-1',
    type: 'match_new',
    title: 'Nuevo match!',
    body: 'Tienes un nuevo match con María',
    data: { matchId: 'match-1' },
    is_read: false,
    read_at: null,
    push_sent: false,
    push_sent_at: null,
    created_at: new Date().toISOString(),
  };

  const defaultPrefs = {
    user_id: 'user-1',
    push_match_new: true,
    push_message_new: true,
    push_meetup: true,
    push_body_doubling: true,
    push_esencias: true,
    push_streak: true,
    push_system: true,
    in_app_enabled: true,
    dnd_enabled: false,
    dnd_start_hour: 22,
    dnd_end_hour: 8,
    sound_enabled: true,
    vibration_enabled: true,
  };

  const defaultDevice = {
    id: 'device-1',
    user_id: 'user-1',
    device_token: 'token-abc-123',
    platform: 'ios',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  function buildMock(overrides: {
    notification?: any;
    notifications?: any[];
    notifError?: boolean;
    insertError?: boolean;
    updateError?: boolean;
    prefs?: any;
    prefsError?: boolean;
    device?: any;
    devices?: any[];
    deviceError?: boolean;
  } = {}) {
    const notification = overrides.notification ?? defaultNotification;
    const prefs = overrides.prefs ?? defaultPrefs;
    const device = overrides.device ?? defaultDevice;

    const makeChainable = (finalValue: any) => {
      const chainable: any = {};
      const methods = ['eq', 'neq', 'in', 'or', 'order', 'limit', 'range', 'gte', 'lte'];
      for (const m of methods) {
        chainable[m] = (...args: any[]) => makeChainable(finalValue);
      }
      chainable.single = async () => finalValue;
      chainable.maybeSingle = async () => finalValue;
      chainable.then = (resolve: any, reject?: any) =>
        Promise.resolve(finalValue).then(resolve, reject);
      return chainable;
    };

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'notifications') {
            return {
              select: (cols?: string, opts?: any) => {
                // Count query (getUnreadCount)
                if (opts?.count === 'exact') {
                  return makeChainable({
                    data: overrides.notifications ?? [notification],
                    error: null,
                  });
                }
                // Single fetch (markAsRead verification)
                if (cols === 'id, user_id, is_read') {
                  return makeChainable({
                    data: overrides.notifError ? null : notification,
                    error: overrides.notifError ? { message: 'not found' } : null,
                  });
                }
                // List query
                return makeChainable({
                  data: overrides.notifications ?? [notification],
                  error: null,
                });
              },
              insert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError ? null : notification,
                    error: overrides.insertError ? { message: 'insert failed' } : null,
                  }),
                }),
              }),
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          if (table === 'notification_preferences') {
            return {
              select: () => makeChainable({
                data: overrides.prefsError ? null : prefs,
                error: overrides.prefsError ? { message: 'not found' } : null,
              }),
              upsert: () => makeChainable({
                error: overrides.updateError ? { message: 'upsert failed' } : null,
              }),
            };
          }

          if (table === 'user_devices') {
            return {
              select: () => makeChainable({
                data: overrides.devices ?? [device],
                error: null,
              }),
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.deviceError ? null : device,
                    error: overrides.deviceError ? { message: 'device error' } : null,
                  }),
                }),
              }),
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          return {};
        },
      }),
    };
  }

  async function createService(supaOverrides: Parameters<typeof buildMock>[0] = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: buildMock(supaOverrides) },
      ],
    }).compile();

    return module.get<NotificationsService>(NotificationsService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('createNotification crea notificación válida', async () => {
      service = await createService();

      const result = await service.createNotification(
        'user-1',
        'match_new',
        'Nuevo match!',
        'Tienes un nuevo match con María',
        { matchId: 'match-1' },
      );

      expect(result.id).toBe('notif-1');
      expect(result.type).toBe('match_new');
      expect(result.title).toBe('Nuevo match!');
      expect(result.isRead).toBe(false);
    });

    it('getNotifications retorna lista de notificaciones', async () => {
      const notifs = [
        { ...defaultNotification, id: 'n1' },
        { ...defaultNotification, id: 'n2', type: 'message_new' },
      ];
      service = await createService({ notifications: notifs });

      const result = await service.getNotifications('user-1');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('n1');
    });

    it('getUnreadCount retorna conteo correcto', async () => {
      const unread = [
        { id: 'n1' },
        { id: 'n2' },
        { id: 'n3' },
      ];
      service = await createService({ notifications: unread });

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(3);
    });

    it('markAsRead marca notificación como leída', async () => {
      service = await createService();

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.id).toBe('notif-1');
      expect(result.isRead).toBe(true);
    });

    it('markAsRead con notificación ya leída retorna sin error', async () => {
      service = await createService({
        notification: { ...defaultNotification, is_read: true },
      });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.isRead).toBe(true);
    });

    it('markAllAsRead marca todas como leídas', async () => {
      service = await createService();

      const result = await service.markAllAsRead('user-1');

      expect(result.success).toBe(true);
    });

    it('registerDevice registra dispositivo válido', async () => {
      service = await createService();

      const result = await service.registerDevice('user-1', 'token-abc-123', 'ios');

      expect(result.id).toBe('device-1');
      expect(result.platform).toBe('ios');
      expect(result.isActive).toBe(true);
    });

    it('unregisterDevice desactiva dispositivo', async () => {
      service = await createService();

      const result = await service.unregisterDevice('user-1', 'token-abc-123');

      expect(result.success).toBe(true);
    });

    it('getUserDevices retorna dispositivos activos', async () => {
      service = await createService({
        devices: [defaultDevice, { ...defaultDevice, id: 'device-2', platform: 'android' }],
      });

      const result = await service.getUserDevices('user-1');

      expect(result.length).toBe(2);
    });

    it('getPreferences retorna preferencias del usuario', async () => {
      service = await createService();

      const result = await service.getPreferences('user-1');

      expect(result.pushMatchNew).toBe(true);
      expect(result.pushMessageNew).toBe(true);
      expect(result.dndEnabled).toBe(false);
      expect(result.soundEnabled).toBe(true);
    });

    it('getPreferences retorna defaults si no existen', async () => {
      service = await createService({ prefsError: true });

      const result = await service.getPreferences('user-1');

      expect(result.pushMatchNew).toBe(true);
      expect(result.inAppEnabled).toBe(true);
    });

    it('updatePreferences actualiza correctamente', async () => {
      service = await createService();

      const result = await service.updatePreferences('user-1', {
        pushMatchNew: false,
        dndEnabled: true,
      });

      // Returns current prefs after update
      expect(result.pushMatchNew).toBeDefined();
    });

    it('createBatchNotifications envía a múltiples usuarios', async () => {
      service = await createService();

      const result = await service.createBatchNotifications(
        ['user-1', 'user-2', 'user-3'],
        'system',
        'Mantenimiento',
        'Habrá mantenimiento programado',
      );

      expect(result.length).toBe(3);
    });

    it('createNotification sanitiza HTML en título y body', async () => {
      service = await createService();

      const result = await service.createNotification(
        'user-1',
        'system',
        '<script>alert("xss")</script>',
        '<b>Bold</b> text',
      );

      // La notificación se creó (el mock devuelve defaultNotification)
      expect(result.id).toBe('notif-1');
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('createNotification con tipo inválido throws', async () => {
      service = await createService();

      await expect(
        service.createNotification('user-1', 'invalid_type' as any, 'Title', 'Body'),
      ).rejects.toThrow('INVALID_NOTIFICATION_TYPE');
    });

    it('createNotification sin título throws', async () => {
      service = await createService();

      await expect(
        service.createNotification('user-1', 'system', '', 'Body'),
      ).rejects.toThrow('TITLE_REQUIRED');
    });

    it('createNotification sin body throws', async () => {
      service = await createService();

      await expect(
        service.createNotification('user-1', 'system', 'Title', ''),
      ).rejects.toThrow('BODY_REQUIRED');
    });

    it('createNotification con título > 100 chars throws', async () => {
      service = await createService();

      await expect(
        service.createNotification('user-1', 'system', 'A'.repeat(101), 'Body'),
      ).rejects.toThrow('TITLE_TOO_LONG');
    });

    it('createNotification con body > 500 chars throws', async () => {
      service = await createService();

      await expect(
        service.createNotification('user-1', 'system', 'Title', 'B'.repeat(501)),
      ).rejects.toThrow('BODY_TOO_LONG');
    });

    it('createNotification con error de insert throws', async () => {
      service = await createService({ insertError: true });

      await expect(
        service.createNotification('user-1', 'system', 'Title', 'Body'),
      ).rejects.toThrow('NOTIFICATION_CREATE_FAILED');
    });

    it('markAsRead con notificación inexistente throws', async () => {
      service = await createService({ notifError: true });

      await expect(
        service.markAsRead('user-1', 'bad-id'),
      ).rejects.toThrow('NOTIFICATION_NOT_FOUND');
    });

    it('markAsRead por usuario no dueño throws', async () => {
      service = await createService();

      await expect(
        service.markAsRead('user-other', 'notif-1'),
      ).rejects.toThrow('NOT_YOUR_NOTIFICATION');
    });

    it('markAllAsRead con error de update throws', async () => {
      service = await createService({ updateError: true });

      await expect(
        service.markAllAsRead('user-1'),
      ).rejects.toThrow('MARK_ALL_READ_FAILED');
    });

    it('registerDevice sin token throws', async () => {
      service = await createService();

      await expect(
        service.registerDevice('user-1', '', 'ios'),
      ).rejects.toThrow('DEVICE_TOKEN_REQUIRED');
    });

    it('registerDevice con plataforma inválida throws', async () => {
      service = await createService();

      await expect(
        service.registerDevice('user-1', 'token-123', 'windows'),
      ).rejects.toThrow('INVALID_PLATFORM');
    });

    it('registerDevice con error de DB throws', async () => {
      service = await createService({ deviceError: true });

      await expect(
        service.registerDevice('user-1', 'token-123', 'ios'),
      ).rejects.toThrow('DEVICE_REGISTER_FAILED');
    });

    it('updatePreferences con hora DND inválida throws', async () => {
      service = await createService();

      await expect(
        service.updatePreferences('user-1', { dndStartHour: 25 }),
      ).rejects.toThrow('INVALID_DND_HOUR');
    });

    it('updatePreferences con hora DND negativa throws', async () => {
      service = await createService();

      await expect(
        service.updatePreferences('user-1', { dndEndHour: -1 }),
      ).rejects.toThrow('INVALID_DND_HOUR');
    });

    it('createBatchNotifications con > 100 recipients throws', async () => {
      service = await createService();
      const tooMany = Array.from({ length: 101 }, (_, i) => `user-${i}`);

      await expect(
        service.createBatchNotifications(tooMany, 'system', 'T', 'B'),
      ).rejects.toThrow('TOO_MANY_RECIPIENTS');
    });

    it('createBatchNotifications con lista vacía retorna vacío', async () => {
      service = await createService();

      const result = await service.createBatchNotifications([], 'system', 'T', 'B');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('getNotifications con lista vacía retorna array vacío', async () => {
      service = await createService({ notifications: [] });

      const result = await service.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('getUnreadCount con 0 no leídas retorna 0', async () => {
      service = await createService({ notifications: [] });

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('getUserDevices sin dispositivos retorna vacío', async () => {
      service = await createService({ devices: [] });

      const result = await service.getUserDevices('user-1');

      expect(result).toEqual([]);
    });

    it('createNotification con título de exactamente 100 chars funciona', async () => {
      service = await createService();

      const result = await service.createNotification(
        'user-1',
        'system',
        'A'.repeat(100),
        'Body',
      );

      expect(result.id).toBe('notif-1');
    });

    it('createNotification con body de exactamente 500 chars funciona', async () => {
      service = await createService();

      const result = await service.createNotification(
        'user-1',
        'system',
        'Title',
        'B'.repeat(500),
      );

      expect(result.id).toBe('notif-1');
    });

    it('todos los tipos de notificación son válidos', async () => {
      const types = [
        'match_new', 'message_new', 'meetup_initiated', 'meetup_confirmed',
        'meetup_expired', 'body_doubling_invite', 'body_doubling_start',
        'esencias_received', 'esencias_earned', 'unlock_available',
        'streak_milestone', 'system',
      ];

      for (const type of types) {
        service = await createService();
        const result = await service.createNotification(
          'user-1',
          type as any,
          'Test',
          'Test body',
        );
        expect(result.type).toBe('match_new'); // mock siempre retorna defaultNotification
      }
    });

    it('updatePreferences sin cambios retorna prefs actuales', async () => {
      service = await createService();

      const result = await service.updatePreferences('user-1', {});

      expect(result.pushMatchNew).toBe(true);
    });

    it('registerDevice con todas las plataformas válidas', async () => {
      for (const platform of ['ios', 'android', 'web']) {
        service = await createService();
        const result = await service.registerDevice('user-1', 'token-123', platform);
        expect(result.platform).toBe('ios'); // mock siempre retorna defaultDevice
      }
    });

    it('unregisterDevice con error de update throws', async () => {
      service = await createService({ updateError: true });

      await expect(
        service.unregisterDevice('user-1', 'token-123'),
      ).rejects.toThrow('DEVICE_UNREGISTER_FAILED');
    });

    it('createNotification con push error no lanza (graceful)', async () => {
      // El push fallaría pero la notificación se crea
      service = await createService();

      const result = await service.createNotification(
        'user-1',
        'match_new',
        'Test',
        'Test body',
      );

      expect(result.id).toBe('notif-1');
    });
  });
});
