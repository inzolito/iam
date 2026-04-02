import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from '../esencias/esencias.service';

const CHECKIN_RADIUS_METERS = 200; // Máximo 200m del venue para check-in
const BASE_CHECKIN_REWARD = 15; // Esencias base por check-in
const MAX_REVIEW_LENGTH = 500;

interface VenueSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  address: string;
  city: string;
  sensoryRating: number | null;
  averageRating: number | null;
  reviewCount: number;
  distance?: number;
  imageUrl: string | null;
  amenities: string[];
  esenciasMultiplier: number;
  isFavorite?: boolean;
}

interface VenueDetail extends VenueSummary {
  description: string | null;
  country: string;
  websiteUrl: string | null;
  phone: string | null;
  openingHours: Record<string, string>;
  isVerified: boolean;
  partnerSince: string | null;
}

interface CheckinResult {
  id: string;
  venueId: string;
  esenciasAwarded: number;
  verified: boolean;
  checkedInAt: string;
}

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly esenciasService: EsenciasService,
  ) {}

  // ============================================================
  // VENUES CRUD
  // ============================================================

  /**
   * Buscar venues cercanos por ubicación del usuario
   */
  async getNearbyVenues(
    lat: number,
    lng: number,
    radiusMeters: number = 5000,
    category?: string,
    userId?: string,
  ): Promise<VenueSummary[]> {
    if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('INVALID_COORDINATES');
    }

    if (radiusMeters <= 0 || radiusMeters > 50000) {
      throw new BadRequestException('INVALID_RADIUS');
    }

    const client = this.supabaseService.getClient();

    let query = client
      .from('venues')
      .select('*')
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: venues, error } = await query;

    if (error) {
      this.logger.error(`Error fetching venues: ${error.message}`);
      throw new BadRequestException('FETCH_FAILED');
    }

    // Filtrar por distancia (client-side con Haversine)
    const filtered = (venues || [])
      .map((venue: any) => {
        const venueLoc = this.parseLocation(venue.location);
        const distance = venueLoc
          ? this.calculateDistance(lat, lng, venueLoc.lat, venueLoc.lng)
          : Infinity;

        return { ...venue, distance };
      })
      .filter((v: any) => v.distance <= radiusMeters)
      .sort((a: any, b: any) => a.distance - b.distance);

    // Si hay userId, verificar cuáles son favoritos
    let favoriteIds = new Set<string>();
    if (userId) {
      const { data: favorites } = await client
        .from('venue_favorites')
        .select('venue_id')
        .eq('user_id', userId);

      favoriteIds = new Set((favorites || []).map((f: any) => f.venue_id));
    }

    return filtered.map((v: any) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      category: v.category,
      address: v.address,
      city: v.city,
      sensoryRating: v.sensory_rating,
      averageRating: null, // Se calcula aparte si se necesita
      reviewCount: 0,
      distance: Math.round(v.distance),
      imageUrl: v.image_url,
      amenities: v.amenities || [],
      esenciasMultiplier: v.esencias_multiplier,
      isFavorite: favoriteIds.has(v.id),
    }));
  }

  /**
   * Obtener detalle de un venue
   */
  async getVenueDetail(venueId: string, userId?: string): Promise<VenueDetail> {
    const client = this.supabaseService.getClient();

    const { data: venue, error } = await client
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .eq('is_active', true)
      .single();

    if (error || !venue) {
      throw new NotFoundException('VENUE_NOT_FOUND');
    }

    // Obtener reviews stats
    const { data: reviews } = await client
      .from('venue_reviews')
      .select('rating')
      .eq('venue_id', venueId);

    const reviewCount = (reviews || []).length;
    const averageRating = reviewCount > 0
      ? (reviews || []).reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
      : null;

    // Verificar si es favorito
    let isFavorite = false;
    if (userId) {
      const { data: fav } = await client
        .from('venue_favorites')
        .select('venue_id')
        .eq('user_id', userId)
        .eq('venue_id', venueId)
        .maybeSingle();

      isFavorite = !!fav;
    }

    return {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      description: venue.description,
      category: venue.category,
      address: venue.address,
      city: venue.city,
      country: venue.country,
      sensoryRating: venue.sensory_rating,
      averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
      reviewCount,
      imageUrl: venue.image_url,
      amenities: venue.amenities || [],
      esenciasMultiplier: venue.esencias_multiplier,
      websiteUrl: venue.website_url,
      phone: venue.phone,
      openingHours: venue.opening_hours || {},
      isVerified: venue.is_verified,
      partnerSince: venue.partner_since,
      isFavorite,
    };
  }

  /**
   * Buscar venues por nombre o slug
   */
  async searchVenues(query: string, limit: number = 10): Promise<VenueSummary[]> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('SEARCH_TOO_SHORT');
    }

    if (limit <= 0 || limit > 50) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    const client = this.supabaseService.getClient();

    const sanitized = query.trim().toLowerCase();

    const { data: venues, error } = await client
      .from('venues')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${sanitized}%,slug.ilike.%${sanitized}%,city.ilike.%${sanitized}%`)
      .limit(limit);

    if (error) {
      this.logger.error(`Error searching venues: ${error.message}`);
      throw new BadRequestException('SEARCH_FAILED');
    }

    return (venues || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      category: v.category,
      address: v.address,
      city: v.city,
      sensoryRating: v.sensory_rating,
      averageRating: null,
      reviewCount: 0,
      imageUrl: v.image_url,
      amenities: v.amenities || [],
      esenciasMultiplier: v.esencias_multiplier,
    }));
  }

  // ============================================================
  // CHECK-IN SYSTEM
  // ============================================================

  /**
   * Hacer check-in en un venue.
   * Verifica proximidad (200m) y otorga Esencias.
   * Máximo 1 check-in por venue por día.
   */
  async checkIn(
    userId: string,
    venueId: string,
    userLat: number,
    userLng: number,
  ): Promise<CheckinResult> {
    if (!userLat || !userLng) {
      throw new BadRequestException('LOCATION_REQUIRED');
    }

    const client = this.supabaseService.getClient();

    // Verificar venue existe y está activo
    const { data: venue, error: venueError } = await client
      .from('venues')
      .select('id, name, location, esencias_multiplier, is_active')
      .eq('id', venueId)
      .single();

    if (venueError || !venue) {
      throw new NotFoundException('VENUE_NOT_FOUND');
    }

    if (!venue.is_active) {
      throw new BadRequestException('VENUE_INACTIVE');
    }

    // Verificar proximidad
    const venueLoc = this.parseLocation(venue.location);
    let verified = false;

    if (venueLoc) {
      const distance = this.calculateDistance(
        userLat,
        userLng,
        venueLoc.lat,
        venueLoc.lng,
      );

      verified = distance <= CHECKIN_RADIUS_METERS;
    }

    // Verificar check-in diario (prevenir duplicados)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingCheckin } = await client
      .from('venue_checkins')
      .select('id')
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .gte('checked_in_at', `${today}T00:00:00`)
      .lte('checked_in_at', `${today}T23:59:59`)
      .maybeSingle();

    if (existingCheckin) {
      throw new BadRequestException('ALREADY_CHECKED_IN_TODAY');
    }

    // Calcular Esencias a otorgar
    const multiplier = venue.esencias_multiplier || 1.0;
    const esenciasAwarded = Math.round(BASE_CHECKIN_REWARD * multiplier);

    // Registrar check-in
    const { data: checkin, error: checkinError } = await client
      .from('venue_checkins')
      .insert({
        user_id: userId,
        venue_id: venueId,
        esencias_awarded: esenciasAwarded,
        verified,
        location: userLat && userLng
          ? `POINT(${userLng} ${userLat})`
          : null,
      })
      .select()
      .single();

    if (checkinError) {
      this.logger.error(`Error creating checkin: ${checkinError.message}`);
      throw new BadRequestException('CHECKIN_FAILED');
    }

    // Otorgar Esencias
    try {
      await this.esenciasService.addEsencias(
        userId,
        esenciasAwarded,
        `venue_checkin_${venue.name.toLowerCase().replace(/\s+/g, '_')}`,
      );
    } catch (error) {
      this.logger.error(`Error awarding checkin Esencias: ${error}`);
      // No lanzar error - el check-in ya se registró
    }

    return {
      id: checkin.id,
      venueId: checkin.venue_id,
      esenciasAwarded,
      verified,
      checkedInAt: checkin.checked_in_at || checkin.created_at,
    };
  }

  /**
   * Historial de check-ins del usuario
   */
  async getUserCheckins(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    if (limit <= 0 || limit > 100) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('venue_checkins')
      .select('*, venues(name, slug, category, image_url)')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Error fetching checkins: ${error.message}`);
      throw new BadRequestException('FETCH_FAILED');
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      venueId: c.venue_id,
      venueName: c.venues?.name,
      venueSlug: c.venues?.slug,
      venueCategory: c.venues?.category,
      venueImage: c.venues?.image_url,
      esenciasAwarded: c.esencias_awarded,
      verified: c.verified,
      checkedInAt: c.checked_in_at,
    }));
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  /**
   * Crear o actualizar review de un venue
   */
  async upsertReview(
    userId: string,
    venueId: string,
    rating: number,
    sensoryRating?: number,
    comment?: string,
    tags?: string[],
  ): Promise<any> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('INVALID_RATING');
    }

    if (sensoryRating !== undefined && (sensoryRating < 1 || sensoryRating > 5)) {
      throw new BadRequestException('INVALID_SENSORY_RATING');
    }

    if (comment && comment.length > MAX_REVIEW_LENGTH) {
      throw new BadRequestException('COMMENT_TOO_LONG');
    }

    const client = this.supabaseService.getClient();

    // Verificar venue existe
    const { data: venue } = await client
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .eq('is_active', true)
      .single();

    if (!venue) {
      throw new NotFoundException('VENUE_NOT_FOUND');
    }

    // Sanitizar comment
    const sanitizedComment = comment
      ? comment
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .trim()
      : null;

    // Upsert review
    const { data: review, error } = await client
      .from('venue_reviews')
      .upsert(
        {
          user_id: userId,
          venue_id: venueId,
          rating,
          sensory_rating: sensoryRating || null,
          comment: sanitizedComment,
          tags: tags || [],
        },
        { onConflict: 'user_id,venue_id' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error(`Error upserting review: ${error.message}`);
      throw new BadRequestException('REVIEW_FAILED');
    }

    return {
      id: review.id,
      userId: review.user_id,
      venueId: review.venue_id,
      rating: review.rating,
      sensoryRating: review.sensory_rating,
      comment: review.comment,
      tags: review.tags,
      createdAt: review.created_at,
    };
  }

  /**
   * Obtener reviews de un venue
   */
  async getVenueReviews(
    venueId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ reviews: any[]; averageRating: number | null; count: number }> {
    if (limit <= 0 || limit > 50) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    const client = this.supabaseService.getClient();

    const { data: reviews, error } = await client
      .from('venue_reviews')
      .select('*, users(display_name, avatar_url)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Error fetching reviews: ${error.message}`);
      throw new BadRequestException('FETCH_FAILED');
    }

    // Calcular promedio
    const { data: allRatings } = await client
      .from('venue_reviews')
      .select('rating')
      .eq('venue_id', venueId);

    const ratings = (allRatings || []).map((r: any) => r.rating);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return {
      reviews: (reviews || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        displayName: r.users?.display_name || 'Anónimo',
        avatarUrl: r.users?.avatar_url,
        rating: r.rating,
        sensoryRating: r.sensory_rating,
        comment: r.comment,
        tags: r.tags,
        createdAt: r.created_at,
      })),
      averageRating: avgRating,
      count: ratings.length,
    };
  }

  // ============================================================
  // FAVORITOS
  // ============================================================

  /**
   * Agregar o quitar venue de favoritos (toggle)
   */
  async toggleFavorite(
    userId: string,
    venueId: string,
  ): Promise<{ isFavorite: boolean }> {
    const client = this.supabaseService.getClient();

    // Verificar venue existe
    const { data: venue } = await client
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .eq('is_active', true)
      .single();

    if (!venue) {
      throw new NotFoundException('VENUE_NOT_FOUND');
    }

    // Verificar si ya es favorito
    const { data: existing } = await client
      .from('venue_favorites')
      .select('user_id')
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .maybeSingle();

    if (existing) {
      // Quitar de favoritos
      await client
        .from('venue_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('venue_id', venueId);

      return { isFavorite: false };
    } else {
      // Agregar a favoritos
      await client
        .from('venue_favorites')
        .insert({ user_id: userId, venue_id: venueId });

      return { isFavorite: true };
    }
  }

  /**
   * Obtener favoritos del usuario
   */
  async getUserFavorites(userId: string): Promise<VenueSummary[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('venue_favorites')
      .select('venues(*)')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Error fetching favorites: ${error.message}`);
      return [];
    }

    return (data || [])
      .filter((f: any) => f.venues)
      .map((f: any) => ({
        id: f.venues.id,
        name: f.venues.name,
        slug: f.venues.slug,
        category: f.venues.category,
        address: f.venues.address,
        city: f.venues.city,
        sensoryRating: f.venues.sensory_rating,
        averageRating: null,
        reviewCount: 0,
        imageUrl: f.venues.image_url,
        amenities: f.venues.amenities || [],
        esenciasMultiplier: f.venues.esencias_multiplier,
        isFavorite: true,
      }));
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Parse PostGIS location
   */
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

  /**
   * Haversine distance in meters
   */
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
