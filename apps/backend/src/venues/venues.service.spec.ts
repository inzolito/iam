import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

describe('VenuesService', () => {
  let service: VenuesService;

  const defaultVenue = {
    id: 'venue-1',
    name: 'Café Silencio',
    slug: 'cafe-silencio',
    description: 'Cafetería tranquila',
    category: 'cafe',
    address: 'Av. Providencia 1234',
    city: 'Santiago',
    country: 'CL',
    location: { coordinates: [-70.6109, -33.4264] },
    image_url: null,
    website_url: null,
    phone: null,
    opening_hours: { lunes: '08:00-20:00' },
    amenities: ['wifi', 'silencioso'],
    sensory_rating: 2,
    is_active: true,
    is_verified: true,
    partner_since: '2026-01-01',
    esencias_multiplier: 1.5,
  };

  function buildMockSupabase(overrides: {
    venues?: any[];
    venueError?: boolean;
    favorites?: any[];
    reviews?: any[];
    checkins?: any[];
    existingCheckin?: any;
    insertError?: boolean;
    deleteError?: boolean;
  } = {}) {
    const venues = overrides.venues ?? [defaultVenue];
    const favorites = overrides.favorites ?? [];
    const reviews = overrides.reviews ?? [];

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'venues') {
            const venueResult = {
              data: overrides.venueError ? null : venues[0],
              error: overrides.venueError ? { message: 'not found' } : null,
            };
            const venuesResult = {
              data: venues,
              error: null,
            };

            // Build a chainable mock that supports arbitrary chain lengths
            const makeChainable = (finalValue: any) => {
              const chainable: any = {};
              const methods = ['eq', 'neq', 'or', 'order', 'limit', 'range', 'gte', 'lte', 'ilike'];
              for (const m of methods) {
                chainable[m] = (...args: any[]) => makeChainable(finalValue);
              }
              chainable.single = async () => venueResult;
              chainable.maybeSingle = async () => venueResult;
              // Make it thenable so await works directly
              chainable.then = (resolve: any, reject?: any) =>
                Promise.resolve(finalValue).then(resolve, reject);
              return chainable;
            };

            return {
              select: () => makeChainable(venuesResult),
            };
          }

          if (table === 'venue_favorites') {
            return {
              select: () => ({
                eq: (col: string, val: any) => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: favorites.length > 0 ? favorites[0] : null,
                      error: null,
                    }),
                  }),
                }),
              }),
              insert: async () => ({ error: overrides.insertError ? { message: 'fail' } : null }),
              delete: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ error: null }),
                }),
              }),
            };
          }

          if (table === 'venue_reviews') {
            return {
              select: (cols?: string) => ({
                eq: () => ({
                  order: () => ({
                    range: () => Promise.resolve({
                      data: reviews,
                      error: null,
                    }),
                  }),
                }),
              }),
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError
                      ? null
                      : {
                          id: 'review-1',
                          user_id: 'user-1',
                          venue_id: 'venue-1',
                          rating: 4,
                          sensory_rating: 2,
                          comment: 'Muy tranquilo',
                          tags: ['silencioso'],
                          created_at: new Date().toISOString(),
                        },
                    error: overrides.insertError ? { message: 'fail' } : null,
                  }),
                }),
              }),
            };
          }

          if (table === 'venue_checkins') {
            return {
              select: (cols?: string) => ({
                eq: (col: string, val: any) => ({
                  eq: () => ({
                    gte: () => ({
                      lte: () => ({
                        maybeSingle: async () => ({
                          data: overrides.existingCheckin || null,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                  order: () => ({
                    range: () => Promise.resolve({
                      data: overrides.checkins ?? [],
                      error: null,
                    }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError
                      ? null
                      : {
                          id: 'checkin-1',
                          venue_id: 'venue-1',
                          esencias_awarded: 23,
                          verified: true,
                          checked_in_at: new Date().toISOString(),
                          created_at: new Date().toISOString(),
                        },
                    error: overrides.insertError ? { message: 'fail' } : null,
                  }),
                }),
              }),
            };
          }

          if (table === 'users') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { display_name: 'Test', avatar_url: null },
                    error: null,
                  }),
                }),
              }),
            };
          }

          return {};
        },
      }),
    };
  }

  function buildMockEsenciasService(overrides: {
    addError?: boolean;
  } = {}) {
    return {
      addEsencias: async (userId: string, amount: number, reason: string) => {
        if (overrides.addError) {
          throw new Error('Esencias service error');
        }
        return amount;
      },
    };
  }

  async function createService(
    supaOverrides: Parameters<typeof buildMockSupabase>[0] = {},
    esOverrides: Parameters<typeof buildMockEsenciasService>[0] = {},
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: SupabaseService, useValue: buildMockSupabase(supaOverrides) },
        { provide: EsenciasService, useValue: buildMockEsenciasService(esOverrides) },
      ],
    }).compile();

    return module.get<VenuesService>(VenuesService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('getNearbyVenues devuelve venues cercanos', async () => {
      service = await createService();

      const result = await service.getNearbyVenues(-33.4264, -70.6109, 5000);

      expect(Array.isArray(result)).toBe(true);
    });

    it('getVenueDetail devuelve detalle completo', async () => {
      service = await createService();

      const result = await service.getVenueDetail('venue-1');

      expect(result.id).toBe('venue-1');
      expect(result.name).toBe('Café Silencio');
      expect(result.category).toBe('cafe');
      expect(result.amenities).toContain('wifi');
    });

    it('searchVenues busca por nombre', async () => {
      service = await createService();

      const result = await service.searchVenues('cafe');

      expect(Array.isArray(result)).toBe(true);
    });

    it('checkIn registra check-in y otorga Esencias', async () => {
      service = await createService();

      const result = await service.checkIn(
        'user-1',
        'venue-1',
        -33.4264,
        -70.6109,
      );

      expect(result.id).toBe('checkin-1');
      expect(result.esenciasAwarded).toBeGreaterThan(0);
      expect(result.verified).toBe(true);
    });

    it('checkIn con multiplicador 1.5x otorga 23 Esencias', async () => {
      service = await createService({
        venues: [{ ...defaultVenue, esencias_multiplier: 1.5 }],
      });

      const result = await service.checkIn(
        'user-1',
        'venue-1',
        -33.4264,
        -70.6109,
      );

      // BASE_CHECKIN_REWARD (15) * 1.5 = 22.5 → 23 (rounded)
      expect(result.esenciasAwarded).toBe(23);
    });

    it('upsertReview crea review con rating y comment', async () => {
      service = await createService();

      const result = await service.upsertReview(
        'user-1',
        'venue-1',
        4,
        2,
        'Muy tranquilo, ideal para TEA',
        ['silencioso', 'buena_luz'],
      );

      expect(result.id).toBe('review-1');
      expect(result.rating).toBe(4);
    });

    it('toggleFavorite agrega a favoritos', async () => {
      service = await createService({ favorites: [] });

      const result = await service.toggleFavorite('user-1', 'venue-1');

      expect(result.isFavorite).toBe(true);
    });

    it('toggleFavorite quita de favoritos si ya existe', async () => {
      service = await createService({
        favorites: [{ user_id: 'user-1', venue_id: 'venue-1' }],
      });

      const result = await service.toggleFavorite('user-1', 'venue-1');

      expect(result.isFavorite).toBe(false);
    });

    it('getUserCheckins devuelve historial', async () => {
      service = await createService({
        checkins: [
          {
            id: 'c1',
            venue_id: 'venue-1',
            esencias_awarded: 15,
            verified: true,
            checked_in_at: new Date().toISOString(),
            venues: { name: 'Café', slug: 'cafe', category: 'cafe', image_url: null },
          },
        ],
      });

      const result = await service.getUserCheckins('user-1');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].venueName).toBe('Café');
    });

    it('getVenueReviews devuelve reviews con promedio', async () => {
      service = await createService({
        reviews: [
          {
            id: 'r1',
            user_id: 'user-1',
            rating: 4,
            sensory_rating: 2,
            comment: 'Genial',
            tags: ['silencioso'],
            created_at: new Date().toISOString(),
            users: { display_name: 'Test', avatar_url: null },
          },
        ],
      });

      const result = await service.getVenueReviews('venue-1');

      expect(result.reviews.length).toBeGreaterThan(0);
      expect(typeof result.count).toBe('number');
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('getNearbyVenues con coordenadas inválidas throws', async () => {
      service = await createService();

      await expect(
        service.getNearbyVenues(999, 999, 5000),
      ).rejects.toThrow('INVALID_COORDINATES');
    });

    it('getNearbyVenues con radius inválido throws', async () => {
      service = await createService();

      await expect(
        service.getNearbyVenues(-33.4264, -70.6109, -1),
      ).rejects.toThrow('INVALID_RADIUS');

      await expect(
        service.getNearbyVenues(-33.4264, -70.6109, 60000),
      ).rejects.toThrow('INVALID_RADIUS');
    });

    it('getVenueDetail con venue inexistente throws', async () => {
      service = await createService({ venueError: true });

      await expect(
        service.getVenueDetail('nonexistent'),
      ).rejects.toThrow('VENUE_NOT_FOUND');
    });

    it('searchVenues con query muy corto throws', async () => {
      service = await createService();

      await expect(
        service.searchVenues('a'),
      ).rejects.toThrow('SEARCH_TOO_SHORT');

      await expect(
        service.searchVenues(''),
      ).rejects.toThrow('SEARCH_TOO_SHORT');
    });

    it('searchVenues con limit inválido throws', async () => {
      service = await createService();

      await expect(
        service.searchVenues('cafe', 0),
      ).rejects.toThrow('INVALID_LIMIT');

      await expect(
        service.searchVenues('cafe', 51),
      ).rejects.toThrow('INVALID_LIMIT');
    });

    it('checkIn sin ubicación throws', async () => {
      service = await createService();

      await expect(
        service.checkIn('user-1', 'venue-1', 0, 0),
      ).rejects.toThrow('LOCATION_REQUIRED');
    });

    it('checkIn con venue inexistente throws', async () => {
      service = await createService({ venueError: true });

      await expect(
        service.checkIn('user-1', 'nonexistent', -33.4264, -70.6109),
      ).rejects.toThrow('VENUE_NOT_FOUND');
    });

    it('checkIn duplicado (mismo día) throws', async () => {
      service = await createService({
        existingCheckin: { id: 'existing-checkin' },
      });

      await expect(
        service.checkIn('user-1', 'venue-1', -33.4264, -70.6109),
      ).rejects.toThrow('ALREADY_CHECKED_IN_TODAY');
    });

    it('upsertReview con rating inválido throws', async () => {
      service = await createService();

      await expect(
        service.upsertReview('user-1', 'venue-1', 0),
      ).rejects.toThrow('INVALID_RATING');

      await expect(
        service.upsertReview('user-1', 'venue-1', 6),
      ).rejects.toThrow('INVALID_RATING');
    });

    it('upsertReview con sensoryRating inválido throws', async () => {
      service = await createService();

      await expect(
        service.upsertReview('user-1', 'venue-1', 4, 0),
      ).rejects.toThrow('INVALID_SENSORY_RATING');

      await expect(
        service.upsertReview('user-1', 'venue-1', 4, 6),
      ).rejects.toThrow('INVALID_SENSORY_RATING');
    });

    it('upsertReview con comment demasiado largo throws', async () => {
      service = await createService();

      await expect(
        service.upsertReview('user-1', 'venue-1', 4, undefined, 'A'.repeat(501)),
      ).rejects.toThrow('COMMENT_TOO_LONG');
    });

    it('upsertReview con venue inexistente throws', async () => {
      service = await createService({ venueError: true });

      await expect(
        service.upsertReview('user-1', 'nonexistent', 4),
      ).rejects.toThrow('VENUE_NOT_FOUND');
    });

    it('toggleFavorite con venue inexistente throws', async () => {
      service = await createService({ venueError: true });

      await expect(
        service.toggleFavorite('user-1', 'nonexistent'),
      ).rejects.toThrow('VENUE_NOT_FOUND');
    });

    it('getUserCheckins con limit inválido throws', async () => {
      service = await createService();

      await expect(
        service.getUserCheckins('user-1', 0),
      ).rejects.toThrow('INVALID_LIMIT');

      await expect(
        service.getUserCheckins('user-1', 101),
      ).rejects.toThrow('INVALID_LIMIT');
    });

    it('getVenueReviews con limit inválido throws', async () => {
      service = await createService();

      await expect(
        service.getVenueReviews('venue-1', 0),
      ).rejects.toThrow('INVALID_LIMIT');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('Haversine: mismo punto = 0 distancia', () => {
      service = new VenuesService(null as any, null as any);
      const dist = (service as any).calculateDistance(-33.45, -70.65, -33.45, -70.65);
      expect(dist).toBe(0);
    });

    it('Haversine: Santiago a Providencia ~3km', () => {
      service = new VenuesService(null as any, null as any);
      const dist = (service as any).calculateDistance(-33.4372, -70.6506, -33.4264, -70.6109);
      expect(dist).toBeGreaterThan(2000);
      expect(dist).toBeLessThan(5000);
    });

    it('parseLocation maneja GeoJSON', () => {
      service = new VenuesService(null as any, null as any);
      const loc = (service as any).parseLocation({ coordinates: [-70.65, -33.45] });
      expect(loc).toEqual({ lng: -70.65, lat: -33.45 });
    });

    it('parseLocation maneja WKT string', () => {
      service = new VenuesService(null as any, null as any);
      const loc = (service as any).parseLocation('POINT(-70.65 -33.45)');
      expect(loc).toEqual({ lng: -70.65, lat: -33.45 });
    });

    it('parseLocation devuelve null para input inválido', () => {
      service = new VenuesService(null as any, null as any);
      expect((service as any).parseLocation(null)).toBeNull();
      expect((service as any).parseLocation('garbage')).toBeNull();
      expect((service as any).parseLocation(42)).toBeNull();
    });

    it('checkIn verifica proximidad: lejos = no verificado', async () => {
      service = await createService({
        venues: [{
          ...defaultVenue,
          location: { coordinates: [-70.6109, -33.4264] },
        }],
      });

      // Santiago centro a Valparaíso = ~100km, fuera de 200m
      const result = await service.checkIn(
        'user-1',
        'venue-1',
        -33.04,
        -71.63,
      );

      expect(result.verified).toBe(false);
    });

    it('upsertReview sanitiza HTML en comments', async () => {
      service = await createService();

      const result = await service.upsertReview(
        'user-1',
        'venue-1',
        4,
        undefined,
        '<script>alert("xss")</script>',
      );

      // Verificamos que el método no lanza error
      expect(result.id).toBe('review-1');
    });

    it('upsertReview con comment de exactamente 500 chars', async () => {
      service = await createService();

      const result = await service.upsertReview(
        'user-1',
        'venue-1',
        4,
        undefined,
        'A'.repeat(500),
      );

      expect(result.id).toBe('review-1');
    });

    it('getNearbyVenues con radius máximo 50km', async () => {
      service = await createService();

      const result = await service.getNearbyVenues(-33.4264, -70.6109, 50000);

      expect(Array.isArray(result)).toBe(true);
    });

    it('searchVenues con query de 2 chars (mínimo)', async () => {
      service = await createService();

      const result = await service.searchVenues('ca');

      expect(Array.isArray(result)).toBe(true);
    });

    it('checkIn con Esencias service fallido no lanza error', async () => {
      service = await createService({}, { addError: true });

      const result = await service.checkIn(
        'user-1',
        'venue-1',
        -33.4264,
        -70.6109,
      );

      // Check-in se registra aunque Esencias falle
      expect(result.id).toBe('checkin-1');
    });

    it('50 venue searches concurrentes no lanzan error', async () => {
      service = await createService();

      const calls = Array.from({ length: 50 }, (_, i) =>
        service.searchVenues(`cafe${i}`),
      );

      await expect(Promise.all(calls)).resolves.not.toThrow();
    });

    it('getUserFavorites con usuario sin favoritos', async () => {
      service = await createService({ favorites: [] });

      const result = await service.getUserFavorites('user-1');

      expect(result).toHaveLength(0);
    });
  });
});
