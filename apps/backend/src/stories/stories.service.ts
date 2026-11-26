import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FileStorageService } from '../photos/file-storage.service';

export interface StoryItem {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
}

export interface UserStoryGroup {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_own: boolean;
  stories: StoryItem[];
}

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async getActiveStories(currentUserId: string): Promise<UserStoryGroup[]> {
    const client = this.supabaseService.getClient();
    const nowIso = new Date().toISOString();

    // Solo mostrar historias propias y de usuarios con match activo
    const { data: matches, error: matchError } = await client
      .from('matches')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
      .eq('status', 'active');

    if (matchError) {
      this.logger.error(`Error fetching matches for stories: ${matchError.message}`);
      return [];
    }

    const allowedUserIds = new Set<string>([currentUserId]);
    for (const m of matches ?? []) {
      const otherId =
        m.user_a_id === currentUserId ? m.user_b_id : m.user_a_id;
      if (otherId) {
        allowedUserIds.add(otherId as string);
      }
    }

    const { data, error } = await client
      .from('stories')
      .select(
        'id, user_id, image_url, caption, created_at, expires_at, users(display_name, avatar_url)',
      )
      .in('user_id', Array.from(allowedUserIds))
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(150);

    if (error) {
      this.logger.error(`Error fetching stories: ${error.message}`);
      return [];
    }

    const groupsMap = new Map<string, UserStoryGroup>();
    for (const row of data ?? []) {
      const uid = row.user_id as string;
      const userObj = (row as any).users;
      if (!groupsMap.has(uid)) {
        groupsMap.set(uid, {
          user_id: uid,
          display_name: userObj?.display_name ?? 'Usuario',
          avatar_url: userObj?.avatar_url ?? null,
          is_own: uid === currentUserId,
          stories: [],
        });
      }
      groupsMap.get(uid)!.stories.push({
        id: row.id as string,
        image_url: row.image_url as string,
        caption: (row.caption as string | null) ?? null,
        created_at: row.created_at as string,
        expires_at: row.expires_at as string,
      });
    }

    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => (a.is_own === b.is_own ? 0 : a.is_own ? -1 : 1));
    return groups;
  }

  async createStory(
    userId: string,
    file: Express.Multer.File,
    caption?: string,
  ): Promise<StoryItem> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('No file provided');
    }
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds 5MB limit');
    }
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported image format');
    }

    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const storagePath = `stories/${userId}/story-${Date.now()}.${ext}`;
    const publicUrl = await this.fileStorage.uploadFile(
      'stories',
      storagePath,
      file.buffer,
      file.mimetype,
    );

    const trimmedCaption = caption?.trim().slice(0, 140) || null;
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('stories')
      .insert({
        user_id: userId,
        image_url: publicUrl,
        caption: trimmedCaption,
      })
      .select('id, image_url, caption, created_at, expires_at')
      .single();

    if (error || !data) {
      throw new BadRequestException(`Failed to save story: ${error?.message}`);
    }

    return data as StoryItem;
  }

  async deleteStory(userId: string, storyId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    await client
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('user_id', userId);
  }
}

