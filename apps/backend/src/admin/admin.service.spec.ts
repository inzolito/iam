import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

describe('AdminService', () => {
  let service: AdminService;

  const defaultAdmin = {
    user_id: 'admin-1',
    role: 'admin',
    is_active: true,
    granted_at: new Date().toISOString(),
  };

  const defaultUser = {
    id: 'user-1',
    display_name: 'Test User',
    email: 'test@example.com',
    diagnosis: 'TDAH',
    is_banned: false,
    created_at: new Date().toISOString(),
  };

  const defaultQueueItem = {
    id: 'queue-1',
    report_id: 'report-1',
    assigned_to: null,
    priority: 'normal',
    status: 'pending',
    resolution_notes: null,
    created_at: new Date().toISOString(),
  };

  function buildMock(overrides: {
    admin?: any;
    adminError?: boolean;
    user?: any;
    userError?: boolean;
    users?: any[];
    queueItem?: any;
    queueItems?: any[];
    queueError?: boolean;
    admins?: any[];
    actions?: any[];
    matches?: any[];
    reports?: any[];
    insertError?: boolean;
    updateError?: boolean;
    upsertError?: boolean;
    countUsers?: number;
    countMatches?: number;
    countReports?: number;
    countSessions?: number;
  } = {}) {
    const admin = overrides.admin ?? defaultAdmin;
    const user = overrides.user ?? defaultUser;
    const queueItem = overrides.queueItem ?? defaultQueueItem;

    const makeChainable = (finalValue: any) => {
      const chainable: any = {};
      const methods = ['eq', 'neq', 'in', 'or', 'order', 'limit', 'range', 'gte', 'lte', 'ilike'];
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
          if (table === 'admin_roles') {
            return {
              select: (cols?: string) => {
                // verifyAdmin uses .single() → needs single object
                if (cols === 'role, is_active') {
                  return makeChainable({
                    data: overrides.adminError ? null : admin,
                    error: overrides.adminError ? { message: 'not found' } : null,
                  });
                }
                // listAdmins → needs array
                return makeChainable({
                  data: overrides.admins ?? [admin],
                  error: null,
                });
              },
              upsert: () => makeChainable({
                error: overrides.upsertError ? { message: 'upsert failed' } : null,
              }),
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          if (table === 'users') {
            return {
              select: (cols?: string, opts?: any) => {
                // Count query
                if (opts?.count === 'exact') {
                  const arr = Array(overrides.countUsers ?? 10).fill({ id: 'u' });
                  return makeChainable({ data: arr, error: null });
                }
                // Diagnosis aggregation (getUsersByDiagnosis)
                if (cols === 'diagnosis') {
                  return makeChainable({
                    data: [{ diagnosis: 'TDAH' }, { diagnosis: 'TEA' }, { diagnosis: 'TDAH' }],
                    error: null,
                  });
                }
                // Search with ilike
                if (cols === 'id, display_name, email, diagnosis, is_banned, created_at') {
                  return makeChainable({
                    data: overrides.users ?? [user],
                    error: null,
                  });
                }
                // User detail or existence check
                return makeChainable({
                  data: overrides.userError ? null : user,
                  error: overrides.userError ? { message: 'not found' } : null,
                });
              },
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          if (table === 'matches') {
            return {
              select: (cols?: string, opts?: any) => makeChainable({
                data: overrides.matches ?? Array(overrides.countMatches ?? 5).fill({ id: 'm' }),
                error: null,
              }),
            };
          }

          if (table === 'reports') {
            return {
              select: (cols?: string, opts?: any) => makeChainable({
                data: overrides.reports ?? Array(overrides.countReports ?? 3).fill({ id: 'r' }),
                error: null,
              }),
            };
          }

          if (table === 'body_doubling_sessions') {
            return {
              select: (cols?: string, opts?: any) => makeChainable({
                data: Array(overrides.countSessions ?? 2).fill({ id: 's' }),
                error: null,
              }),
            };
          }

          if (table === 'moderation_queue') {
            return {
              select: (cols?: string) => {
                if (cols === 'id, status') {
                  return makeChainable({
                    data: overrides.queueError ? null : queueItem,
                    error: overrides.queueError ? { message: 'not found' } : null,
                  });
                }
                if (cols === 'id, status, assigned_to') {
                  return makeChainable({
                    data: overrides.queueError ? null : queueItem,
                    error: overrides.queueError ? { message: 'not found' } : null,
                  });
                }
                return makeChainable({
                  data: overrides.queueItems ?? [queueItem],
                  error: null,
                });
              },
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          if (table === 'moderation_actions') {
            return {
              select: () => makeChainable({
                data: overrides.actions ?? [],
                error: null,
              }),
              insert: async () => ({ error: null }),
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
        return 100 + amount;
      },
    };
  }

  async function createService(
    supaOverrides: Parameters<typeof buildMock>[0] = {},
    esOverrides: Parameters<typeof buildMockEsencias>[0] = {},
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: SupabaseService, useValue: buildMock(supaOverrides) },
        { provide: EsenciasService, useValue: buildMockEsencias(esOverrides) },
      ],
    }).compile();

    return module.get<AdminService>(AdminService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('verifyAdmin retorna rol para admin válido', async () => {
      service = await createService();

      const result = await service.verifyAdmin('admin-1');

      expect(result.role).toBe('admin');
    });

    it('getDashboardStats retorna estadísticas', async () => {
      service = await createService({
        countUsers: 100,
        countMatches: 50,
        countReports: 10,
        countSessions: 5,
      });

      const result = await service.getDashboardStats('admin-1');

      expect(result.totalUsers).toBe(100);
      expect(result.activeMatches).toBe(50);
      expect(result.pendingReports).toBe(10);
      expect(result.activeSessions).toBe(5);
    });

    it('getUsersByDiagnosis retorna conteo por diagnóstico', async () => {
      service = await createService();

      const result = await service.getUsersByDiagnosis('admin-1');

      expect(result).toBeDefined();
    });

    it('searchUsers retorna usuarios encontrados', async () => {
      service = await createService({
        users: [defaultUser, { ...defaultUser, id: 'user-2', display_name: 'Test 2' }],
      });

      const result = await service.searchUsers('admin-1', 'Test');

      expect(result.length).toBe(2);
      expect(result[0].displayName).toBe('Test User');
    });

    it('getUserDetail retorna detalle completo del usuario', async () => {
      service = await createService();

      const result = await service.getUserDetail('admin-1', 'user-1');

      expect(result.id).toBe('user-1');
      expect(result.matchCount).toBe(5);
      expect(result.reportCount).toBe(3);
    });

    it('banUser banea usuario correctamente', async () => {
      service = await createService();

      const result = await service.banUser('admin-1', 'user-1', 'Comportamiento inapropiado');

      expect(result.userId).toBe('user-1');
      expect(result.banned).toBe(true);
    });

    it('unbanUser desbanea usuario correctamente', async () => {
      service = await createService({
        user: { ...defaultUser, is_banned: true },
      });

      const result = await service.unbanUser('admin-1', 'user-1', 'Apelación aceptada');

      expect(result.userId).toBe('user-1');
      expect(result.banned).toBe(false);
    });

    it('warnUser envía advertencia', async () => {
      service = await createService();

      const result = await service.warnUser('admin-1', 'user-1', 'Primera advertencia por spam');

      expect(result.userId).toBe('user-1');
      expect(result.warned).toBe(true);
    });

    it('grantEsencias otorga Esencias al usuario', async () => {
      service = await createService();

      const result = await service.grantEsencias('admin-1', 'user-1', 100, 'Compensación por error');

      expect(result.userId).toBe('user-1');
      expect(result.amount).toBe(100);
      expect(result.newBalance).toBe(200);
    });

    it('getModerationQueue retorna cola', async () => {
      service = await createService({
        queueItems: [defaultQueueItem, { ...defaultQueueItem, id: 'queue-2', priority: 'high' }],
      });

      const result = await service.getModerationQueue('admin-1');

      expect(result.length).toBe(2);
    });

    it('assignQueueItem asigna item al admin', async () => {
      service = await createService();

      const result = await service.assignQueueItem('admin-1', 'queue-1');

      expect(result.status).toBe('in_review');
      expect(result.assignedTo).toBe('admin-1');
    });

    it('resolveQueueItem resuelve item', async () => {
      service = await createService({
        queueItem: { ...defaultQueueItem, status: 'in_review', assigned_to: 'admin-1' },
      });

      const result = await service.resolveQueueItem('admin-1', 'queue-1', 'resolved', 'Usuario baneado por spam');

      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe('admin-1');
    });

    it('resolveQueueItem puede dismiss', async () => {
      service = await createService({
        queueItem: { ...defaultQueueItem, status: 'in_review' },
      });

      const result = await service.resolveQueueItem('admin-1', 'queue-1', 'dismissed', 'Reporte falso verificado');

      expect(result.status).toBe('dismissed');
    });

    it('grantRole otorga rol de admin', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
      });

      const result = await service.grantRole('admin-1', 'user-1', 'moderator');

      expect(result.userId).toBe('user-1');
      expect(result.role).toBe('moderator');
    });

    it('revokeRole revoca rol de admin', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
      });

      const result = await service.revokeRole('admin-1', 'user-2');

      expect(result.roleRevoked).toBe(true);
    });

    it('listAdmins retorna lista de admins activos', async () => {
      service = await createService({
        admins: [
          defaultAdmin,
          { ...defaultAdmin, user_id: 'admin-2', role: 'moderator' },
        ],
      });

      const result = await service.listAdmins('admin-1');

      expect(result.length).toBe(2);
    });

    it('getActionLog retorna historial de acciones', async () => {
      service = await createService({
        actions: [
          { id: 'a1', admin_id: 'admin-1', target_user_id: 'user-1', action_type: 'user_ban', reason: 'Spam', details: {}, created_at: new Date().toISOString() },
        ],
      });

      const result = await service.getActionLog('admin-1');

      expect(result.length).toBe(1);
      expect(result[0].actionType).toBe('user_ban');
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('verifyAdmin con usuario no admin throws', async () => {
      service = await createService({ adminError: true });

      await expect(
        service.verifyAdmin('user-random'),
      ).rejects.toThrow('NOT_ADMIN');
    });

    it('verifySuperAdmin con admin normal throws', async () => {
      service = await createService({
        admin: { ...defaultAdmin, role: 'admin' },
      });

      await expect(
        service.grantRole('admin-1', 'user-1', 'moderator'),
      ).rejects.toThrow('SUPER_ADMIN_REQUIRED');
    });

    it('searchUsers con query < 2 chars throws', async () => {
      service = await createService();

      await expect(
        service.searchUsers('admin-1', 'A'),
      ).rejects.toThrow('SEARCH_QUERY_TOO_SHORT');
    });

    it('searchUsers con query vacío throws', async () => {
      service = await createService();

      await expect(
        service.searchUsers('admin-1', ''),
      ).rejects.toThrow('SEARCH_QUERY_TOO_SHORT');
    });

    it('getUserDetail con usuario inexistente throws', async () => {
      service = await createService({ userError: true });

      await expect(
        service.getUserDetail('admin-1', 'bad-id'),
      ).rejects.toThrow('USER_NOT_FOUND');
    });

    it('banUser sin razón throws', async () => {
      service = await createService();

      await expect(
        service.banUser('admin-1', 'user-1', 'abc'),
      ).rejects.toThrow('REASON_REQUIRED');
    });

    it('banUser a sí mismo throws', async () => {
      service = await createService();

      await expect(
        service.banUser('admin-1', 'admin-1', 'Me baneo a mí mismo'),
      ).rejects.toThrow('CANNOT_BAN_SELF');
    });

    it('banUser a usuario ya baneado throws', async () => {
      service = await createService({
        user: { ...defaultUser, is_banned: true },
      });

      await expect(
        service.banUser('admin-1', 'user-1', 'Doble baneo intento'),
      ).rejects.toThrow('USER_ALREADY_BANNED');
    });

    it('banUser con usuario inexistente throws', async () => {
      service = await createService({ userError: true });

      await expect(
        service.banUser('admin-1', 'bad-user', 'Razón válida para baneo'),
      ).rejects.toThrow('USER_NOT_FOUND');
    });

    it('unbanUser a usuario no baneado throws', async () => {
      service = await createService();

      await expect(
        service.unbanUser('admin-1', 'user-1', 'Intento desbanear no baneado'),
      ).rejects.toThrow('USER_NOT_BANNED');
    });

    it('grantEsencias con amount <= 0 throws', async () => {
      service = await createService();

      await expect(
        service.grantEsencias('admin-1', 'user-1', 0, 'Razón suficientemente larga'),
      ).rejects.toThrow('INVALID_AMOUNT');
    });

    it('grantEsencias con amount > 10000 throws', async () => {
      service = await createService();

      await expect(
        service.grantEsencias('admin-1', 'user-1', 10001, 'Razón suficientemente larga'),
      ).rejects.toThrow('INVALID_AMOUNT');
    });

    it('assignQueueItem con item inexistente throws', async () => {
      service = await createService({ queueError: true });

      await expect(
        service.assignQueueItem('admin-1', 'bad-id'),
      ).rejects.toThrow('QUEUE_ITEM_NOT_FOUND');
    });

    it('assignQueueItem con item no pending throws', async () => {
      service = await createService({
        queueItem: { ...defaultQueueItem, status: 'in_review' },
      });

      await expect(
        service.assignQueueItem('admin-1', 'queue-1'),
      ).rejects.toThrow('ITEM_NOT_PENDING');
    });

    it('resolveQueueItem con resolución inválida throws', async () => {
      service = await createService();

      await expect(
        service.resolveQueueItem('admin-1', 'queue-1', 'invalid' as any, 'Notas suficientes'),
      ).rejects.toThrow('INVALID_RESOLUTION');
    });

    it('resolveQueueItem sin notas throws', async () => {
      service = await createService();

      await expect(
        service.resolveQueueItem('admin-1', 'queue-1', 'resolved', 'abc'),
      ).rejects.toThrow('NOTES_REQUIRED');
    });

    it('resolveQueueItem con item ya resuelto throws', async () => {
      service = await createService({
        queueItem: { ...defaultQueueItem, status: 'resolved' },
      });

      await expect(
        service.resolveQueueItem('admin-1', 'queue-1', 'resolved', 'Notas suficientes aquí'),
      ).rejects.toThrow('ITEM_ALREADY_RESOLVED');
    });

    it('grantRole con rol inválido throws', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
      });

      await expect(
        service.grantRole('admin-1', 'user-1', 'ceo'),
      ).rejects.toThrow('INVALID_ROLE');
    });

    it('grantRole a sí mismo throws', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
      });

      await expect(
        service.grantRole('admin-1', 'admin-1', 'moderator'),
      ).rejects.toThrow('CANNOT_MODIFY_OWN_ROLE');
    });

    it('grantRole a usuario inexistente throws', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
        userError: true,
      });

      await expect(
        service.grantRole('admin-1', 'bad-user', 'moderator'),
      ).rejects.toThrow('USER_NOT_FOUND');
    });

    it('revokeRole a sí mismo throws', async () => {
      service = await createService({
        admin: { ...defaultAdmin, user_id: 'admin-1', role: 'super_admin' },
      });

      await expect(
        service.revokeRole('admin-1', 'admin-1'),
      ).rejects.toThrow('CANNOT_MODIFY_OWN_ROLE');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('getDashboardStats con 0 datos retorna todo en 0', async () => {
      service = await createService({
        countUsers: 0,
        countMatches: 0,
        countReports: 0,
        countSessions: 0,
      });

      const result = await service.getDashboardStats('admin-1');

      expect(result.totalUsers).toBe(0);
      expect(result.activeMatches).toBe(0);
    });

    it('searchUsers sin resultados retorna array vacío', async () => {
      service = await createService({ users: [] });

      const result = await service.searchUsers('admin-1', 'zzzzz');

      expect(result).toEqual([]);
    });

    it('getModerationQueue vacía retorna array vacío', async () => {
      service = await createService({ queueItems: [] });

      const result = await service.getModerationQueue('admin-1');

      expect(result).toEqual([]);
    });

    it('getActionLog vacío retorna array vacío', async () => {
      service = await createService({ actions: [] });

      const result = await service.getActionLog('admin-1');

      expect(result).toEqual([]);
    });

    it('listAdmins sin admins retorna array vacío', async () => {
      service = await createService({ admins: [] });

      const result = await service.listAdmins('admin-1');

      expect(result).toEqual([]);
    });

    it('grantEsencias con amount exacto 10000 funciona', async () => {
      service = await createService();

      const result = await service.grantEsencias('admin-1', 'user-1', 10000, 'Premio especial al ganador');

      expect(result.amount).toBe(10000);
    });

    it('grantEsencias con amount exacto 1 funciona', async () => {
      service = await createService();

      const result = await service.grantEsencias('admin-1', 'user-1', 1, 'Micro-recompensa de prueba');

      expect(result.amount).toBe(1);
    });

    it('banUser con razón de exactamente 5 chars funciona', async () => {
      service = await createService();

      const result = await service.banUser('admin-1', 'user-1', 'spamm');

      expect(result.banned).toBe(true);
    });

    it('searchUsers con query de exactamente 2 chars funciona', async () => {
      service = await createService();

      const result = await service.searchUsers('admin-1', 'Te');

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
