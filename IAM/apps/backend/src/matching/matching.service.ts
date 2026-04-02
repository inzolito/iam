import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RewardsService } from '../esencias/rewards.service';

const DEFAULT_RADIUS_METERS = 15000; // 15km default search radius
const FEED_PAGE_SIZE = 20;

interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_teen: boolean;
  energy_level: number;
  msn_status: string | null;
  location?: { lat: number; lng: number } | null;
}

interface FeedProfile extends UserProfile {
  spin: string[];
  matchScore?: number;
  distance?: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly rewardsService: RewardsService,
  ) {}

  /**
   * Get feed — profiles within radius, sorted by match score.
   * Applies hard filters: radius, teen isolation, blocking, already swiped.
   */
  async getFeed(
    userId: string,
    radiusMeters = DEFAULT_RADIUS_METERS,
    page = 0,
  ): Promise<FeedProfile[]> {
    const client = this.supabaseService.getClient();

    // Get current user
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, is_teen, location')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new BadRequestException('USER_NOT_FOUND');
    }

    if (!user.location) {
      throw new BadRequestException(
        'LOCATION_REQUIRED: activa tu ubicación para usar el feed',
      );
    }

    // Parse location (PostGIS geometry)
    const userLocation = this.parseLocation(user.location);
    if (!userLocation) {
      throw new BadRequestException('INVALID_LOCATION');
    }

    // Get already swiped users
    const { data: swiped } = await client
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', userId);

    const swipedIds = (swiped ?? []).map((s: any) => s.swiped_id);

    // Get blocked users
    const { data: blocked } = await client
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    const blockedIds = new Set<string>();
    (blocked ?? []).forEach((b: any) => {
      if (b.blocker_id === userId) blockedIds.add(b.blocked_id);
      if (b.blocked_id === userId) blockedIds.add(b.blocker_id);
    });

    // Query candidates (all active users, teen isolation)
    // Note: we get more than FEED_PAGE_SIZE to account for filtering
    const { data: candidates, error: queryError } = await client
      .from('users')
      .select(
        `
        id, display_name, avatar_url, is_teen, energy_level, msn_status,
        location,
        user_spin(spin_tag_id)
      `,
      )
      .neq('id', userId)
      .eq('is_active', true)
      .eq('is_teen', user.is_teen)
      .range(0, 200); // Get more than we need for client-side filtering

    if (queryError) {
      this.logger.error(`Feed query error: ${queryError.message}`);
      return [];
    }

    // Client-side filtering + sorting
    const swipedSet = new Set(swipedIds);
    const profiles: FeedProfile[] = (candidates ?? [])
      .filter((profile: any) => {
        // Exclude if already swiped
        if (swipedSet.has(profile.id)) return false;

        // Check if blocked
        if (blockedIds.has(profile.id)) return false;

        // Check radius
        const profileLocation = this.parseLocation(profile.location);
        if (!profileLocation) return false;

        const distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          profileLocation.lat,
          profileLocation.lng,
        );
        return distance <= radiusMeters;
      })
      .map((profile: any) => {
        const profileLocation = this.parseLocation(profile.location);
        const distance = profileLocation
          ? this.calculateDistance(
              userLocation.lat,
              userLocation.lng,
              profileLocation.lat,
              profileLocation.lng,
            )
          : 0;

        const userSpinTags = (profile.user_spin ?? []).map(
          (u: any) => u.spin_tag_id,
        );

        // Get current user's spin for score calculation
        const spinScore = this.calculateSpinScoreSync([], userSpinTags);
        const proximityScore = (1 - distance / radiusMeters) * 100;
        const matchScore = spinScore * 0.7 + proximityScore * 0.3;

        return {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          is_teen: profile.is_teen,
          energy_level: profile.energy_level,
          msn_status: profile.msn_status,
          spin: userSpinTags,
          matchScore,
          distance,
        };
      })
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .slice(page * FEED_PAGE_SIZE, (page + 1) * FEED_PAGE_SIZE);

    return profiles;
  }

  /**
   * Record a swipe (like or pass).
   */
  async swipe(
    userId: string,
    targetUserId: string,
    direction: 'like' | 'pass',
  ): Promise<{ matched: boolean; match?: any }> {
    if (userId === targetUserId) {
      throw new BadRequestException('SWIPE_SELF: no puedes darte like a ti mismo');
    }

    if (!['like', 'pass'].includes(direction)) {
      throw new BadRequestException('INVALID_DIRECTION');
    }

    const client = this.supabaseService.getClient();

    // Check if blocked (either direction between these two users)
    const { data: blockList } = await client
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${userId})`,
      );

    if (blockList && blockList.length > 0) {
      throw new ForbiddenException('BLOCKED');
    }

    // Upsert swipe (idempotent)
    const { data: swipe, error: swipeError } = await client
      .from('swipes')
      .upsert(
        {
          swiper_id: userId,
          swiped_id: targetUserId,
          direction,
        },
        { onConflict: 'swiper_id,swiped_id' },
      )
      .select()
      .single();

    if (swipeError) {
      this.logger.error(`Swipe error: ${swipeError.message}`);
      throw new BadRequestException('SWIPE_FAILED');
    }

    // Check for mutual like
    if (direction === 'like') {
      const { data: mutualSwipe } = await client
        .from('swipes')
        .select('id')
        .eq('swiper_id', targetUserId)
        .eq('swiped_id', userId)
        .eq('direction', 'like')
        .maybeSingle();

      if (mutualSwipe) {
        // Create match (with users_different constraint: smaller ID first)
        const [userA, userB] = userId < targetUserId
          ? [userId, targetUserId]
          : [targetUserId, userId];

        const { data: match, error: matchError } = await client
          .from('matches')
          .upsert(
            {
              user_a_id: userA,
              user_b_id: userB,
              status: 'active',
            },
            { onConflict: 'user_a_id,user_b_id' },
          )
          .select()
          .single();

        if (!matchError && match) {
          // Award match creation bonus to both users
          await this.rewardsService.awardMatchBonus(userId, targetUserId);

          return { matched: true, match };
        }
      }
    }

    return { matched: false };
  }

  /**
   * Block a user.
   */
  async blockUser(userId: string, blockUserId: string): Promise<void> {
    if (userId === blockUserId) {
      throw new BadRequestException('BLOCK_SELF');
    }

    const client = this.supabaseService.getClient();

    const { error } = await client.from('blocks').insert({
      blocker_id: userId,
      blocked_id: blockUserId,
    });

    if (error) {
      this.logger.error(`Block error: ${error.message}`);
      // Silently ignore duplicate blocks
    }
  }

  /**
   * Report a user.
   */
  async reportUser(
    userId: string,
    reportedId: string,
    reason: string,
    description?: string,
  ): Promise<void> {
    if (userId === reportedId) {
      throw new BadRequestException('REPORT_SELF');
    }

    const client = this.supabaseService.getClient();

    const { error } = await client.from('reports').insert({
      reporter_id: userId,
      reported_id: reportedId,
      reason,
      description,
    });

    if (error) {
      this.logger.error(`Report error: ${error.message}`);
      throw new BadRequestException('REPORT_FAILED');
    }
  }

  /**
   * Calculate SpIn compatibility score between two users.
   * (number in common / number unique combined) * 100
   */
  async calculateSpinScore(userId: string, otherUserId: string): Promise<number> {
    const client = this.supabaseService.getClient();

    // Get both users' SpIn
    const [user1Spin, user2Spin] = await Promise.all([
      this.getUserSpinTags(userId),
      this.getUserSpinTags(otherUserId),
    ]);

    const set1 = new Set(user1Spin);
    const set2 = new Set(user2Spin);

    const common = [...set1].filter((tag) => set2.has(tag)).length;
    const combined = new Set([...set1, ...set2]).size;

    if (combined === 0) return 0;
    return (common / combined) * 100;
  }

  /**
   * Get user's SpIn tag IDs.
   */
  private async getUserSpinTags(userId: string): Promise<string[]> {
    const client = this.supabaseService.getClient();

    const { data } = await client
      .from('user_spin')
      .select('spin_tag_id')
      .eq('user_id', userId);

    return (data ?? []).map((row: any) => row.spin_tag_id);
  }

  /**
   * Parse location from PostGIS geometry or GeoJSON.
   */
  private parseLocation(
    location: any,
  ): { lat: number; lng: number } | null {
    if (!location) return null;

    // If it's already an object with coordinates
    if (location.coordinates && Array.isArray(location.coordinates)) {
      return {
        lng: location.coordinates[0],
        lat: location.coordinates[1],
      };
    }

    // If it's a string (WKT format)
    if (typeof location === 'string') {
      const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) {
        return {
          lng: parseFloat(match[1]),
          lat: parseFloat(match[2]),
        };
      }
    }

    return null;
  }

  /**
   * Haversine distance between two coordinates (meters).
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
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

  /**
   * Calculate SpIn score synchronously (without DB call).
   * Takes cached spin tags for both users.
   */
  private calculateSpinScoreSync(
    userSpinTags: string[],
    otherSpinTags: string[],
  ): number {
    const set1 = new Set(userSpinTags);
    const set2 = new Set(otherSpinTags);

    const common = [...set1].filter((tag) => set2.has(tag)).length;
    const combined = new Set([...set1, ...set2]).size;

    if (combined === 0) return 0;
    return (common / combined) * 100;
  }
}
