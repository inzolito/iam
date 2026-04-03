import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MeetupsService } from './meetups.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

describe('MeetupsService', () => {
  let service: MeetupsService;

  const defaultMatch = {
    id: 'match-1',
    user_a_id: 'user-a',
    user_b_id: 'user-b',
    status: 'active',
  };

  const defaultMeetup = {
    id: 'meetup-1',
    match_id: 'match-1',
    user_a_id: 'user-a',
    user_b_id: 'user-b',
    user_a_confirmed: true,
    user_b_confirmed: false,
    user_a_confirmed_at: new Date().toISOString(),
    user_b_confirmed_at: null,
    user_a_location: 'POINT(-70.6483 -33.4489)',
    user_b_location: null,
    status: 'pending',
    esencias_awarded: 0,
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  function buildMock(overrides: {
    match?: any;
    matchError?: boolean;
    meetup?: any;
    meetupError?: boolean;
    existingMeetups?: any[];
    meetups?: any[];
    insertError?: boolean;
    updateError?: boolean;
    otherUser?: any;
  } = {}) {
    const match = overrides.match ?? defaultMatch;
    const meetup = overrides.meetup ?? defaultMeetup;

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
          if (table === 'matches') {
            return {
              select: () => makeChainable({
                data: overrides.matchError ? null : match,
                error: overrides.matchError ? { message: 'not found' } : null,
              }),
            };
          }

          if (table === 'meetup_confirmations') {
            return {
              select: (cols?: string) => {
                // For 'status, esencias_awarded' → stats query
                if (cols === 'status, esencias_awarded') {
                  return makeChainable({
                    data: overrides.meetups ?? [],
                    error: null,
                  });
                }
                // For 'id, status, created_at' → existing meetups check
                if (cols === 'id, status, created_at') {
                  return makeChainable({
                    data: overrides.existingMeetups ?? [],
                    error: null,
                  });
                }
                // Default → meetup detail or list
                return makeChainable({
                  data: overrides.meetupError ? null : (overrides.meetups ?? meetup),
                  error: overrides.meetupError ? { message: 'not found' } : null,
                });
              },
              insert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError ? null : meetup,
                    error: overrides.insertError ? { message: 'insert failed' } : null,
                  }),
                }),
              }),
              update: () => makeChainable({
                error: overrides.updateError ? { message: 'update failed' } : null,
              }),
            };
          }

          if (table === 'meetup_history') {
            return {
              insert: async () => ({ error: null }),
            };
          }

          if (table === 'users') {
            return {
              select: () => makeChainable({
                data: overrides.otherUser ?? { id: 'user-b', display_name: 'Test User', avatar_url: null },
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
        MeetupsService,
        { provide: SupabaseService, useValue: buildMock(supaOverrides) },
        { provide: EsenciasService, useValue: buildMockEsencias(esOverrides) },
      ],
    }).compile();

    return module.get<MeetupsService>(MeetupsService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('initiateMeetup crea meetup pendiente (user_a inicia)', async () => {
      service = await createService({ existingMeetups: [] });

      const result = await service.initiateMeetup('user-a', 'match-1', {
        lat: -33.4489,
        lng: -70.6483,
      });

      expect(result.id).toBe('meetup-1');
      expect(result.status).toBe('pending');
      expect(result.initiatedBy).toBe('user-a');
      expect(result.matchId).toBe('match-1');
    });

    it('initiateMeetup crea meetup pendiente (user_b inicia)', async () => {
      service = await createService({ existingMeetups: [] });

      const result = await service.initiateMeetup('user-b', 'match-1', {
        lat: -33.4489,
        lng: -70.6483,
      });

      expect(result.id).toBe('meetup-1');
      expect(result.initiatedBy).toBe('user-b');
    });

    it('initiateMeetup sin ubicación funciona', async () => {
      service = await createService({ existingMeetups: [] });

      const result = await service.initiateMeetup('user-a', 'match-1');

      expect(result.id).toBe('meetup-1');
      expect(result.status).toBe('pending');
    });

    it('confirmMeetup completa meetup y otorga Esencias', async () => {
      service = await createService();

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: -33.4489,
        lng: -70.6483,
      });

      expect(result.status).toBe('confirmed');
      expect(result.userAConfirmed).toBe(true);
      expect(result.userBConfirmed).toBe(true);
      expect(result.esenciasAwarded.userA).toBe(30);
      expect(result.esenciasAwarded.userB).toBe(30);
    });

    it('confirmMeetup verifica proximidad cuando ambos envían ubicación', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: 'POINT(-70.6483 -33.4489)',
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: -33.4490, // Muy cerca (~11m)
        lng: -70.6484,
      });

      expect(result.proximityVerified).toBe(true);
    });

    it('getMyMeetups retorna meetups del usuario', async () => {
      const meetupList = [
        { ...defaultMeetup, status: 'confirmed' },
        { ...defaultMeetup, id: 'meetup-2', status: 'pending' },
      ];
      service = await createService({ meetups: meetupList });

      const result = await service.getMyMeetups('user-a');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('meetup-1');
    });

    it('getMeetupDetail retorna detalle con info del otro usuario', async () => {
      service = await createService();

      const result = await service.getMeetupDetail('user-a', 'meetup-1');

      expect(result.id).toBe('meetup-1');
      expect(result.otherUser.display_name).toBe('Test User');
      expect(result.myConfirmation).toBe(true);
      expect(result.otherConfirmation).toBe(false);
    });

    it('getPendingMeetups filtra los que necesitan mi confirmación', async () => {
      const pendingMeetups = [
        { ...defaultMeetup }, // user_a ya confirmó, user_b no
      ];
      service = await createService({ meetups: pendingMeetups });

      const result = await service.getPendingMeetups('user-b');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('meetup-1');
    });

    it('getPendingMeetups excluye los que ya confirmé', async () => {
      const pendingMeetups = [
        { ...defaultMeetup }, // user_a ya confirmó
      ];
      service = await createService({ meetups: pendingMeetups });

      const result = await service.getPendingMeetups('user-a');

      expect(result.length).toBe(0);
    });

    it('disputeMeetup marca meetup como disputado', async () => {
      service = await createService();

      const result = await service.disputeMeetup('user-b', 'meetup-1');

      expect(result.status).toBe('disputed');
    });

    it('getMeetupStats retorna estadísticas correctas', async () => {
      const stats = [
        { status: 'confirmed', esencias_awarded: 30 },
        { status: 'confirmed', esencias_awarded: 30 },
        { status: 'pending', esencias_awarded: 0 },
        { status: 'expired', esencias_awarded: 0 },
      ];
      service = await createService({ meetups: stats });

      const result = await service.getMeetupStats('user-a');

      expect(result.total).toBe(4);
      expect(result.confirmed).toBe(2);
      expect(result.pending).toBe(1);
      expect(result.expired).toBe(1);
      expect(result.totalEsencias).toBe(60);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('initiateMeetup con match inexistente throws', async () => {
      service = await createService({ matchError: true });

      await expect(
        service.initiateMeetup('user-a', 'bad-match'),
      ).rejects.toThrow('MATCH_NOT_FOUND');
    });

    it('initiateMeetup con match inactivo throws', async () => {
      service = await createService({
        match: { ...defaultMatch, status: 'blocked' },
        existingMeetups: [],
      });

      await expect(
        service.initiateMeetup('user-a', 'match-1'),
      ).rejects.toThrow('MATCH_NOT_ACTIVE');
    });

    it('initiateMeetup por usuario no parte del match throws', async () => {
      service = await createService({ existingMeetups: [] });

      await expect(
        service.initiateMeetup('user-c', 'match-1'),
      ).rejects.toThrow('NOT_PART_OF_MATCH');
    });

    it('initiateMeetup con meetup pendiente existente throws', async () => {
      service = await createService({
        existingMeetups: [{ id: 'old', status: 'pending', created_at: new Date().toISOString() }],
      });

      await expect(
        service.initiateMeetup('user-a', 'match-1'),
      ).rejects.toThrow('MEETUP_ALREADY_PENDING');
    });

    it('initiateMeetup dentro de cooldown throws', async () => {
      service = await createService({
        existingMeetups: [{
          id: 'old',
          status: 'confirmed',
          created_at: new Date().toISOString(), // Hace 0 horas < 24 horas
        }],
      });

      await expect(
        service.initiateMeetup('user-a', 'match-1'),
      ).rejects.toThrow('MEETUP_COOLDOWN');
    });

    it('initiateMeetup con error de insert throws', async () => {
      service = await createService({
        existingMeetups: [],
        insertError: true,
      });

      await expect(
        service.initiateMeetup('user-a', 'match-1'),
      ).rejects.toThrow('MEETUP_CREATE_FAILED');
    });

    it('confirmMeetup con meetup inexistente throws', async () => {
      service = await createService({ meetupError: true });

      await expect(
        service.confirmMeetup('user-b', 'bad-meetup'),
      ).rejects.toThrow('MEETUP_NOT_FOUND');
    });

    it('confirmMeetup por usuario no parte del meetup throws', async () => {
      service = await createService();

      await expect(
        service.confirmMeetup('user-c', 'meetup-1'),
      ).rejects.toThrow('NOT_PART_OF_MEETUP');
    });

    it('confirmMeetup cuando ya confirmé throws', async () => {
      service = await createService();

      await expect(
        service.confirmMeetup('user-a', 'meetup-1'), // user_a ya confirmó
      ).rejects.toThrow('ALREADY_CONFIRMED');
    });

    it('confirmMeetup con meetup ya confirmado throws', async () => {
      service = await createService({
        meetup: { ...defaultMeetup, status: 'confirmed' },
      });

      await expect(
        service.confirmMeetup('user-b', 'meetup-1'),
      ).rejects.toThrow('MEETUP_NOT_PENDING');
    });

    it('confirmMeetup con meetup expirado throws y actualiza status', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          expires_at: new Date(Date.now() - 1000).toISOString(), // Ya expiró
        },
      });

      await expect(
        service.confirmMeetup('user-b', 'meetup-1'),
      ).rejects.toThrow('MEETUP_EXPIRED');
    });

    it('confirmMeetup con error de update throws', async () => {
      service = await createService({ updateError: true });

      await expect(
        service.confirmMeetup('user-b', 'meetup-1'),
      ).rejects.toThrow('MEETUP_CONFIRM_FAILED');
    });

    it('confirmMeetup con error de Esencias no lanza (graceful)', async () => {
      service = await createService({}, { addError: true });

      const result = await service.confirmMeetup('user-b', 'meetup-1');

      // El meetup se confirmó aunque las Esencias fallaron
      expect(result.status).toBe('confirmed');
      expect(result.esenciasAwarded.userA).toBe(0);
      expect(result.esenciasAwarded.userB).toBe(0);
    });

    it('getMeetupDetail por usuario no parte del meetup throws', async () => {
      service = await createService();

      await expect(
        service.getMeetupDetail('user-c', 'meetup-1'),
      ).rejects.toThrow('NOT_PART_OF_MEETUP');
    });

    it('getMeetupDetail con meetup inexistente throws', async () => {
      service = await createService({ meetupError: true });

      await expect(
        service.getMeetupDetail('user-a', 'bad-meetup'),
      ).rejects.toThrow('MEETUP_NOT_FOUND');
    });

    it('disputeMeetup con meetup inexistente throws', async () => {
      service = await createService({ meetupError: true });

      await expect(
        service.disputeMeetup('user-a', 'bad-meetup'),
      ).rejects.toThrow('MEETUP_NOT_FOUND');
    });

    it('disputeMeetup por usuario no parte del meetup throws', async () => {
      service = await createService();

      await expect(
        service.disputeMeetup('user-c', 'meetup-1'),
      ).rejects.toThrow('NOT_PART_OF_MEETUP');
    });

    it('disputeMeetup con meetup ya confirmado throws', async () => {
      service = await createService({
        meetup: { ...defaultMeetup, status: 'confirmed' },
      });

      await expect(
        service.disputeMeetup('user-a', 'meetup-1'),
      ).rejects.toThrow('ONLY_PENDING_CAN_BE_DISPUTED');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('confirmMeetup sin proximidad (ubicaciones lejanas)', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: 'POINT(-70.6483 -33.4489)', // Santiago
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: 40.4168, // Madrid - ~10,000km de distancia
        lng: -3.7038,
      });

      expect(result.proximityVerified).toBe(false);
      expect(result.status).toBe('confirmed'); // Aún se confirma, proximidad es informativa
    });

    it('confirmMeetup sin ubicación de ninguno (proximityVerified = false)', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: null,
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1');

      expect(result.proximityVerified).toBe(false);
    });

    it('initiateMeetup después de cooldown expirado funciona', async () => {
      service = await createService({
        existingMeetups: [{
          id: 'old',
          status: 'confirmed',
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 horas atrás
        }],
      });

      const result = await service.initiateMeetup('user-a', 'match-1');

      expect(result.id).toBe('meetup-1');
      expect(result.status).toBe('pending');
    });

    it('getMeetupStats con 0 meetups retorna todo en 0', async () => {
      service = await createService({ meetups: [] });

      const result = await service.getMeetupStats('user-a');

      expect(result.total).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.totalEsencias).toBe(0);
    });

    it('getMeetupStats con datos mixtos calcula correctamente', async () => {
      const stats = [
        { status: 'confirmed', esencias_awarded: 30 },
        { status: 'confirmed', esencias_awarded: 30 },
        { status: 'confirmed', esencias_awarded: 30 },
        { status: 'pending', esencias_awarded: 0 },
        { status: 'expired', esencias_awarded: 0 },
        { status: 'expired', esencias_awarded: 0 },
        { status: 'disputed', esencias_awarded: 0 },
      ];
      service = await createService({ meetups: stats });

      const result = await service.getMeetupStats('user-a');

      expect(result.total).toBe(7);
      expect(result.confirmed).toBe(3);
      expect(result.pending).toBe(1);
      expect(result.expired).toBe(2);
      expect(result.disputed).toBe(1);
      expect(result.totalEsencias).toBe(90);
    });

    it('getMyMeetups con lista vacía retorna array vacío', async () => {
      service = await createService({ meetups: [] });

      const result = await service.getMyMeetups('user-a');

      expect(result).toEqual([]);
    });

    it('getPendingMeetups con error retorna array vacío (graceful)', async () => {
      // The mock returns meetups: [] which simulates no pending meetups
      service = await createService({ meetups: [] });

      const result = await service.getPendingMeetups('user-a');

      expect(result).toEqual([]);
    });

    it('confirmMeetup con proximidad exacta en el borde (500m)', async () => {
      // 500m aprox = ~0.0045 grados latitud
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: 'POINT(-70.6483 -33.4489)',
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: -33.4489 + 0.0044, // ~489m - justo dentro del radio
        lng: -70.6483,
      });

      expect(result.proximityVerified).toBe(true);
    });

    it('confirmMeetup justo fuera del radio de proximidad (501m+)', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: 'POINT(-70.6483 -33.4489)',
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: -33.4489 + 0.0046, // ~512m - fuera del radio
        lng: -70.6483,
      });

      expect(result.proximityVerified).toBe(false);
    });

    it('parseLocation maneja formato coordinates (GeoJSON)', async () => {
      service = await createService({
        meetup: {
          ...defaultMeetup,
          user_a_location: { coordinates: [-70.6483, -33.4489] },
        },
      });

      const result = await service.confirmMeetup('user-b', 'meetup-1', {
        lat: -33.4490,
        lng: -70.6484,
      });

      expect(result.proximityVerified).toBe(true);
    });

    it('getMeetupDetail muestra perspectiva correcta para user_b', async () => {
      service = await createService();

      const result = await service.getMeetupDetail('user-b', 'meetup-1');

      expect(result.myConfirmation).toBe(false); // user_b no ha confirmado
      expect(result.otherConfirmation).toBe(true); // user_a sí confirmó
    });
  });
});
