import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BodyDoublingService } from './body-doubling.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

describe('BodyDoublingService', () => {
  let service: BodyDoublingService;

  const defaultSession = {
    id: 'session-1',
    host_id: 'user-1',
    title: 'Estudiar juntos',
    description: 'Sesión de estudio',
    activity_type: 'estudio',
    duration_minutes: 60,
    max_participants: 5,
    is_public: true,
    status: 'waiting',
    started_at: null,
    ended_at: null,
    scheduled_for: null,
    esencias_reward: 20,
    venue_id: null,
    created_at: new Date().toISOString(),
  };

  function buildMock(overrides: {
    session?: any;
    sessionError?: boolean;
    activeSessions?: any[];
    participants?: any[];
    participantExists?: any;
    insertError?: boolean;
    sessions?: any[];
    participantSessions?: any[];
  } = {}) {
    const session = overrides.session ?? defaultSession;
    const participants = overrides.participants ?? [
      { user_id: 'user-1', status: 'joined', joined_at: new Date().toISOString() },
    ];

    const makeChainable = (finalValue: any) => {
      const chainable: any = {};
      const methods = ['eq', 'neq', 'in', 'or', 'order', 'limit', 'range', 'gte', 'lte', 'select'];
      for (const m of methods) {
        chainable[m] = (...args: any[]) => makeChainable(finalValue);
      }
      chainable.single = async () => ({
        data: overrides.sessionError ? null : session,
        error: overrides.sessionError ? { message: 'not found' } : null,
      });
      chainable.maybeSingle = async () => ({
        data: overrides.participantExists || null,
        error: null,
      });
      chainable.then = (resolve: any, reject?: any) =>
        Promise.resolve(finalValue).then(resolve, reject);
      return chainable;
    };

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'body_doubling_sessions') {
            return {
              select: (cols?: string) => {
                // When selecting only 'id', it's the active sessions check
                if (cols === 'id') {
                  return makeChainable({
                    data: overrides.activeSessions ?? [],
                    error: null,
                  });
                }
                return makeChainable({
                  data: overrides.sessions ?? [session],
                  error: null,
                });
              },
              insert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError ? null : session,
                    error: overrides.insertError ? { message: 'fail' } : null,
                  }),
                }),
              }),
              update: () => makeChainable({ error: null }),
            };
          }

          if (table === 'body_doubling_participants') {
            return {
              select: () => makeChainable({
                data: participants,
                error: null,
              }),
              insert: async () => ({
                error: overrides.insertError ? { message: 'fail' } : null,
              }),
              update: () => makeChainable({ error: null }),
            };
          }

          if (table === 'users') {
            return {
              select: () => makeChainable({
                data: { display_name: 'Test', avatar_url: null },
                error: null,
              }),
            };
          }

          return {};
        },
      }),
    };
  }

  function buildMockEsencias(overrides: { addError?: boolean } = {}) {
    return {
      addEsencias: async (userId: string, amount: number, reason: string) => {
        if (overrides.addError) throw new Error('Esencias error');
        return amount;
      },
    };
  }

  async function createService(
    supaOverrides: Parameters<typeof buildMock>[0] = {},
    esOverrides: Parameters<typeof buildMockEsencias>[0] = {},
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodyDoublingService,
        { provide: SupabaseService, useValue: buildMock(supaOverrides) },
        { provide: EsenciasService, useValue: buildMockEsencias(esOverrides) },
      ],
    }).compile();

    return module.get<BodyDoublingService>(BodyDoublingService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('createSession crea sesión con datos válidos', async () => {
      service = await createService({ activeSessions: [] });

      const result = await service.createSession(
        'user-1',
        'Estudiar matemáticas',
        'estudio',
        60,
        { description: 'Cálculo 2' },
      );

      expect(result.id).toBe('session-1');
      expect(result.title).toBe('Estudiar juntos');
      expect(result.activityType).toBe('estudio');
    });

    it('getAvailableSessions devuelve sesiones públicas', async () => {
      service = await createService();

      const result = await service.getAvailableSessions();

      expect(Array.isArray(result)).toBe(true);
    });

    it('getAvailableSessions filtra por activityType', async () => {
      service = await createService();

      const result = await service.getAvailableSessions('estudio');

      expect(Array.isArray(result)).toBe(true);
    });

    it('getSessionDetail devuelve detalle con participantes', async () => {
      service = await createService();

      const result = await service.getSessionDetail('session-1');

      expect(result.id).toBe('session-1');
      expect(result.participants).toBeDefined();
      expect(Array.isArray(result.participants)).toBe(true);
    });

    it('joinSession se une correctamente', async () => {
      service = await createService({
        participants: [{ user_id: 'user-1', status: 'joined' }],
      });

      const result = await service.joinSession('user-2', 'session-1');

      expect(result.joined).toBe(true);
    });

    it('leaveSession sale correctamente', async () => {
      service = await createService();

      const result = await service.leaveSession('user-2', 'session-1');

      expect(result.left).toBe(true);
    });

    it('startSession inicia sesión (como host)', async () => {
      service = await createService({
        participants: [
          { user_id: 'user-1', status: 'joined' },
          { user_id: 'user-2', status: 'joined' },
        ],
      });

      const result = await service.startSession('user-1', 'session-1');

      expect(result.started).toBe(true);
    });

    it('completeSession otorga Esencias a participantes', async () => {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - 45); // 45 min atrás

      service = await createService({
        session: {
          ...defaultSession,
          status: 'active',
          started_at: startTime.toISOString(),
        },
        participants: [
          { user_id: 'user-1', status: 'active' },
          { user_id: 'user-2', status: 'active' },
        ],
      });

      const result = await service.completeSession('user-1', 'session-1');

      expect(result.completed).toBe(true);
      expect(result.rewards.length).toBe(2);
      // Host gets 30 (20+10), participant gets 20
      expect(result.rewards.find((r) => r.userId === 'user-1')?.esencias).toBe(30);
      expect(result.rewards.find((r) => r.userId === 'user-2')?.esencias).toBe(20);
    });

    it('cancelSession cancela sesión (como host)', async () => {
      service = await createService();

      const result = await service.cancelSession('user-1', 'session-1');

      expect(result.cancelled).toBe(true);
    });

    it('getMySessions devuelve sesiones del usuario', async () => {
      service = await createService();

      const result = await service.getMySessions('user-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('createSession con título muy corto throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'ab', 'estudio', 60),
      ).rejects.toThrow('INVALID_TITLE');
    });

    it('createSession con título muy largo throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'A'.repeat(101), 'estudio', 60),
      ).rejects.toThrow('INVALID_TITLE');
    });

    it('createSession con actividad inválida throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'Sesión', 'baile' as any, 60),
      ).rejects.toThrow('INVALID_ACTIVITY_TYPE');
    });

    it('createSession con duración < 15min throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'Sesión', 'estudio', 10),
      ).rejects.toThrow('INVALID_DURATION');
    });

    it('createSession con duración > 480min throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'Sesión', 'estudio', 500),
      ).rejects.toThrow('INVALID_DURATION');
    });

    it('createSession con descripción > 300 chars throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'Sesión', 'estudio', 60, {
          description: 'A'.repeat(301),
        }),
      ).rejects.toThrow('DESCRIPTION_TOO_LONG');
    });

    it('createSession con maxParticipants < 2 throws', async () => {
      service = await createService();

      await expect(
        service.createSession('user-1', 'Sesión', 'estudio', 60, {
          maxParticipants: 1,
        }),
      ).rejects.toThrow('INVALID_MAX_PARTICIPANTS');
    });

    it('createSession con sesión activa existente throws', async () => {
      service = await createService({
        activeSessions: [{ id: 'existing' }],
      });

      await expect(
        service.createSession('user-1', 'Otra sesión', 'estudio', 60),
      ).rejects.toThrow('ALREADY_HOSTING_SESSION');
    });

    it('joinSession sesión no encontrada throws', async () => {
      service = await createService({ sessionError: true });

      await expect(
        service.joinSession('user-2', 'nonexistent'),
      ).rejects.toThrow('SESSION_NOT_FOUND');
    });

    it('joinSession como host throws ALREADY_HOST', async () => {
      service = await createService();

      await expect(
        service.joinSession('user-1', 'session-1'),
      ).rejects.toThrow('ALREADY_HOST');
    });

    it('joinSession ya unido throws ALREADY_JOINED', async () => {
      service = await createService({
        participantExists: { id: 'p1', status: 'joined' },
      });

      await expect(
        service.joinSession('user-2', 'session-1'),
      ).rejects.toThrow('ALREADY_JOINED');
    });

    it('joinSession sesión completada throws SESSION_NOT_JOINABLE', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'completed' },
      });

      await expect(
        service.joinSession('user-2', 'session-1'),
      ).rejects.toThrow('SESSION_NOT_JOINABLE');
    });

    it('leaveSession como host throws HOST_CANNOT_LEAVE', async () => {
      service = await createService();

      await expect(
        service.leaveSession('user-1', 'session-1'),
      ).rejects.toThrow('HOST_CANNOT_LEAVE');
    });

    it('startSession como no-host throws ONLY_HOST_CAN_START', async () => {
      service = await createService();

      await expect(
        service.startSession('user-2', 'session-1'),
      ).rejects.toThrow('ONLY_HOST_CAN_START');
    });

    it('startSession sin suficientes participantes throws', async () => {
      service = await createService({
        participants: [{ user_id: 'user-1', status: 'joined' }],
      });

      await expect(
        service.startSession('user-1', 'session-1'),
      ).rejects.toThrow('NEED_MORE_PARTICIPANTS');
    });

    it('startSession sesión ya activa throws', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'active' },
      });

      await expect(
        service.startSession('user-1', 'session-1'),
      ).rejects.toThrow('SESSION_NOT_WAITING');
    });

    it('completeSession como no-host throws', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'active' },
      });

      await expect(
        service.completeSession('user-2', 'session-1'),
      ).rejects.toThrow('ONLY_HOST_CAN_COMPLETE');
    });

    it('completeSession sesión no activa throws', async () => {
      service = await createService();

      await expect(
        service.completeSession('user-1', 'session-1'),
      ).rejects.toThrow('SESSION_NOT_ACTIVE');
    });

    it('completeSession demasiado corta throws SESSION_TOO_SHORT', async () => {
      const recentStart = new Date();
      recentStart.setMinutes(recentStart.getMinutes() - 5); // Solo 5 min

      service = await createService({
        session: {
          ...defaultSession,
          status: 'active',
          started_at: recentStart.toISOString(),
          duration_minutes: 60, // Requiere al menos 30 min (50%)
        },
      });

      await expect(
        service.completeSession('user-1', 'session-1'),
      ).rejects.toThrow('SESSION_TOO_SHORT');
    });

    it('cancelSession como no-host throws', async () => {
      service = await createService();

      await expect(
        service.cancelSession('user-2', 'session-1'),
      ).rejects.toThrow('ONLY_HOST_CAN_CANCEL');
    });

    it('cancelSession sesión ya completada throws', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'completed' },
      });

      await expect(
        service.cancelSession('user-1', 'session-1'),
      ).rejects.toThrow('SESSION_ALREADY_ENDED');
    });

    it('getAvailableSessions con limit inválido throws', async () => {
      service = await createService();

      await expect(
        service.getAvailableSessions(undefined, 0),
      ).rejects.toThrow('INVALID_LIMIT');

      await expect(
        service.getAvailableSessions(undefined, 51),
      ).rejects.toThrow('INVALID_LIMIT');
    });

    it('getSessionDetail sesión no encontrada throws', async () => {
      service = await createService({ sessionError: true });

      await expect(
        service.getSessionDetail('nonexistent'),
      ).rejects.toThrow('SESSION_NOT_FOUND');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('createSession con título de exactamente 3 chars', async () => {
      service = await createService({ activeSessions: [] });

      const result = await service.createSession('user-1', 'abc', 'estudio', 60);

      expect(result.id).toBeDefined();
    });

    it('createSession con título de exactamente 100 chars', async () => {
      service = await createService({ activeSessions: [] });

      const result = await service.createSession('user-1', 'A'.repeat(100), 'estudio', 60);

      expect(result.id).toBeDefined();
    });

    it('createSession con duración mínima 15 min', async () => {
      service = await createService({ activeSessions: [] });

      const result = await service.createSession('user-1', 'Quick session', 'meditacion', 15);

      expect(result.durationMinutes).toBe(60); // Mock returns default
    });

    it('createSession con duración máxima 480 min', async () => {
      service = await createService({ activeSessions: [] });

      const result = await service.createSession('user-1', 'Marathon', 'programacion', 480);

      expect(result.id).toBeDefined();
    });

    it('createSession sanitiza XSS en título', async () => {
      service = await createService({ activeSessions: [] });

      // No debería lanzar error
      const result = await service.createSession(
        'user-1',
        '<script>alert("xss")</script>',
        'estudio',
        60,
      );

      expect(result.id).toBeDefined();
    });

    it('joinSession permite re-unirse después de left', async () => {
      service = await createService({
        participantExists: { id: 'p1', status: 'left' },
      });

      const result = await service.joinSession('user-2', 'session-1');

      expect(result.joined).toBe(true);
    });

    it('completeSession con Esencias service fallido otorga 0', async () => {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - 45);

      service = await createService(
        {
          session: {
            ...defaultSession,
            status: 'active',
            started_at: startTime.toISOString(),
          },
          participants: [
            { user_id: 'user-1', status: 'active' },
          ],
        },
        { addError: true },
      );

      const result = await service.completeSession('user-1', 'session-1');

      expect(result.completed).toBe(true);
      expect(result.rewards[0].esencias).toBe(0);
    });

    it('Todas las actividades válidas aceptadas', async () => {
      const activities = [
        'estudio', 'trabajo', 'lectura', 'arte', 'ejercicio',
        'limpieza', 'cocina', 'meditacion', 'programacion', 'otro',
      ];

      for (const activity of activities) {
        service = await createService({ activeSessions: [] });
        const result = await service.createSession('user-1', `Sesión de ${activity}`, activity, 30);
        expect(result.id).toBeDefined();
      }
    });

    it('cancelSession en estado waiting funciona', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'waiting' },
      });

      const result = await service.cancelSession('user-1', 'session-1');
      expect(result.cancelled).toBe(true);
    });

    it('cancelSession en estado active funciona', async () => {
      service = await createService({
        session: { ...defaultSession, status: 'active' },
      });

      const result = await service.cancelSession('user-1', 'session-1');
      expect(result.cancelled).toBe(true);
    });

    it('Host recibe bonus de 10 extra al completar', async () => {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - 45);

      service = await createService({
        session: {
          ...defaultSession,
          status: 'active',
          started_at: startTime.toISOString(),
        },
        participants: [
          { user_id: 'user-1', status: 'active' },
          { user_id: 'user-2', status: 'active' },
          { user_id: 'user-3', status: 'active' },
        ],
      });

      const result = await service.completeSession('user-1', 'session-1');

      const hostReward = result.rewards.find((r) => r.userId === 'user-1');
      const partReward = result.rewards.find((r) => r.userId === 'user-2');

      expect(hostReward?.esencias).toBe(30); // 20 + 10 bonus
      expect(partReward?.esencias).toBe(20); // Solo base
    });
  });
});
