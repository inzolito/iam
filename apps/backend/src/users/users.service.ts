import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateUserInput {
  email: string;
  authProvider: 'google' | 'apple';
  authId: string;
  displayName: string | null;
}

interface UserRecord {
  id: string;
  email: string;
  auth_provider: string;
  auth_id: string;
  username: string | null;
  display_name: string | null;
  birth_date: string | null;
  is_teen: boolean;
  avatar_url: string | null;
  msn_status: string | null;
  energy_level: number;
  notif_level: number;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Busca un usuario por auth_id. Si no existe, lo crea.
   * Esto evita duplicados al hacer login múltiples veces.
   */
  async findOrCreate(input: CreateUserInput): Promise<UserRecord> {
    const client = this.supabaseService.getClient();

    // Intentar encontrar usuario existente
    const { data: existing, error: findError } = await client
      .from('users')
      .select('*')
      .eq('auth_id', input.authId)
      .maybeSingle();

    if (findError) {
      this.logger.error(`Error finding user: ${findError.message}`);
      throw new Error(findError.message);
    }

    if (existing) {
      return existing as UserRecord;
    }

    // Crear nuevo usuario
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({
        email: input.email,
        auth_provider: input.authProvider,
        auth_id: input.authId,
        display_name: input.displayName,
      })
      .select('*')
      .single();

    if (createError) {
      this.logger.error(`Error creating user: ${createError.message}`);
      throw new Error(createError.message);
    }

    // Create user_streaks record
    await client.from('user_streaks').insert({ user_id: newUser.id });

    // Create empty user_preferences record
    await client.from('user_preferences').insert({ user_id: newUser.id });

    this.logger.log(`New user created: ${newUser.id} (${input.authProvider})`);

    return newUser as UserRecord;
  }

  /**
   * Busca un usuario por su UUID.
   */
  async findById(id: string): Promise<UserRecord | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error finding user by id: ${error.message}`);
      return null;
    }

    return data as UserRecord | null;
  }

  /**
   * Busca un usuario por email.
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error finding user by email: ${error.message}`);
      return null;
    }

    return data as UserRecord | null;
  }

  /**
   * Actualiza la racha del usuario al hacer login.
   * Si la última sesión fue ayer → incrementa racha.
   * Si fue hace más de 48 horas → resetea racha.
   * Si fue hoy → no hace nada.
   */
  async updateStreak(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: streak, error } = await client
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !streak) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (!streak.last_login_date) {
      // First login ever
      await client
        .from('user_streaks')
        .update({
          current_streak: 1,
          longest_streak: 1,
          last_login_date: todayStr,
        })
        .eq('user_id', userId);
      return;
    }

    if (todayStr === streak.last_login_date) {
      // Already logged in today
      return;
    }

    // Calculate diff in UTC days
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const parts = streak.last_login_date.split('-').map(Number);
    const lastMs = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const diffDays = Math.round((todayMs - lastMs) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day — increment streak
      const newStreak = streak.current_streak + 1;
      await client
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, streak.longest_streak),
          last_login_date: todayStr,
        })
        .eq('user_id', userId);
    } else if (diffDays <= 2) {
      // Within 48h grace period — maintain streak but don't increment
      await client
        .from('user_streaks')
        .update({
          last_login_date: todayStr,
        })
        .eq('user_id', userId);
    } else {
      // Streak broken — reset
      await client
        .from('user_streaks')
        .update({
          current_streak: 1,
          longest_streak: streak.longest_streak,
          last_login_date: todayStr,
        })
        .eq('user_id', userId);
    }
  }
}
