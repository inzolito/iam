import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const MESSAGE_MAX_LENGTH = 10000;
const MESSAGES_PAGE_SIZE = 50;

interface MessageRecord {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface MatchRecord {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Verify that a user is a participant in a match and the match is active.
   */
  async verifyMatchParticipant(
    matchId: string,
    userId: string,
  ): Promise<MatchRecord> {
    const client = this.supabaseService.getClient();

    const { data: match, error } = await client
      .from('matches')
      .select('id, user_a_id, user_b_id, status')
      .eq('id', matchId)
      .single();

    if (error || !match) {
      throw new NotFoundException('MATCH_NOT_FOUND');
    }

    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      throw new ForbiddenException('NOT_MATCH_PARTICIPANT');
    }

    if (match.status !== 'active') {
      throw new ForbiddenException('MATCH_NOT_ACTIVE');
    }

    return match;
  }

  /**
   * Send a message in a match.
   */
  async sendMessage(
    matchId: string,
    senderId: string,
    content: string,
  ): Promise<MessageRecord> {
    // Validate content
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('MESSAGE_EMPTY');
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        `MESSAGE_TOO_LONG: máximo ${MESSAGE_MAX_LENGTH} caracteres`,
      );
    }

    // Sanitize: strip HTML tags (basic XSS prevention)
    const sanitized = this.sanitizeContent(trimmed);

    // Verify participant
    await this.verifyMatchParticipant(matchId, senderId);

    const client = this.supabaseService.getClient();

    const { data: message, error } = await client
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        content: sanitized,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw new BadRequestException('MESSAGE_SEND_FAILED');
    }

    return message;
  }

  /**
   * Get message history for a match, paginated (newest first).
   */
  async getMessages(
    matchId: string,
    userId: string,
    page = 0,
  ): Promise<{ messages: MessageRecord[]; hasMore: boolean }> {
    // Verify participant
    await this.verifyMatchParticipant(matchId, userId);

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .range(
        page * MESSAGES_PAGE_SIZE,
        (page + 1) * MESSAGES_PAGE_SIZE,
      );

    if (error) {
      this.logger.error(`Error fetching messages: ${error.message}`);
      return { messages: [], hasMore: false };
    }

    const messages = data ?? [];
    const hasMore = messages.length > MESSAGES_PAGE_SIZE;

    return {
      messages: messages.slice(0, MESSAGES_PAGE_SIZE).reverse(), // chronological
      hasMore,
    };
  }

  /**
   * Mark messages as read (all unread messages from the other user).
   */
  async markAsRead(matchId: string, userId: string): Promise<number> {
    await this.verifyMatchParticipant(matchId, userId);

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .neq('sender_id', userId) // only mark OTHER user's messages
      .is('read_at', null)
      .select('id');

    if (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      return 0;
    }

    return data?.length ?? 0;
  }

  /**
   * Get all matches for a user with last message preview.
   */
  async getMatches(
    userId: string,
  ): Promise<
    Array<{
      match: MatchRecord;
      otherUser: { id: string; display_name: string; avatar_url: string | null };
      lastMessage: MessageRecord | null;
      unreadCount: number;
    }>
  > {
    const client = this.supabaseService.getClient();

    // Get all active matches for user
    const { data: matches, error: matchError } = await client
      .from('matches')
      .select('id, user_a_id, user_b_id, status, created_at')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (matchError || !matches) {
      this.logger.error(`Error fetching matches: ${matchError?.message}`);
      return [];
    }

    // For each match, get other user info + last message + unread count
    const results = await Promise.all(
      matches.map(async (match: any) => {
        const otherUserId =
          match.user_a_id === userId ? match.user_b_id : match.user_a_id;

        // Get other user
        const { data: otherUser } = await client
          .from('users')
          .select('id, display_name, avatar_url')
          .eq('id', otherUserId)
          .single();

        // Get last message
        const { data: lastMessages } = await client
          .from('messages')
          .select('*')
          .eq('match_id', match.id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Get unread count
        const { count } = await client
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .neq('sender_id', userId)
          .is('read_at', null);

        return {
          match,
          otherUser: otherUser ?? {
            id: otherUserId,
            display_name: 'Usuario',
            avatar_url: null,
          },
          lastMessage: lastMessages?.[0] ?? null,
          unreadCount: count ?? 0,
        };
      }),
    );

    return results;
  }

  /**
   * Basic HTML sanitization to prevent XSS.
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
