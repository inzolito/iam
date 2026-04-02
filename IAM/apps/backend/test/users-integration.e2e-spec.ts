import { config } from 'dotenv';
config(); // Ensure .env is loaded before NestJS modules

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { SupabaseService } from '../src/supabase/supabase.service';

/**
 * Integration tests against the real Supabase database.
 * These verify that the business logic works end-to-end with real data.
 * Skipped if SUPABASE_URL is not configured.
 */
const shouldRun = !!process.env.SUPABASE_URL;

(shouldRun ? describe : describe.skip)('Users Integration (e2e)', () => {
  let usersService: UsersService;
  let supabaseService: SupabaseService;
  let createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // createNestApplication + init triggers onModuleInit lifecycle hooks
    const app = moduleFixture.createNestApplication();
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
  });

  afterAll(async () => {
    // Clean up test users from DB
    try {
      const client = supabaseService.getClient();
      for (const id of createdUserIds) {
        await client.from('user_streaks').delete().eq('user_id', id);
        await client.from('user_preferences').delete().eq('user_id', id);
        await client.from('users').delete().eq('id', id);
      }
    } catch {
      // Cleanup is best-effort
    }
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path — findOrCreate', () => {
    it('should create a new user in the real DB', async () => {
      const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const user = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId: `google-${uniqueId}`,
        displayName: 'Test User Integration',
      });

      createdUserIds.push(user.id);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(`${uniqueId}@test-iam.com`);
      expect(user.auth_provider).toBe('google');
      expect(user.display_name).toBe('Test User Integration');
      expect(user.is_active).toBe(true);
      expect(user.onboarding_completed).toBe(false);
      expect(user.energy_level).toBe(2);
      expect(user.notif_level).toBe(2);
    });

    it('should return the SAME user on second login (no duplicate)', async () => {
      const uniqueId = `test-dup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const authId = `google-dup-${uniqueId}`;

      // First login
      const user1 = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId,
        displayName: 'Dup Test',
      });
      createdUserIds.push(user1.id);

      // Second login with SAME auth_id
      const user2 = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId,
        displayName: 'Dup Test',
      });

      // Must be the exact same user
      expect(user2.id).toBe(user1.id);
      expect(user2.email).toBe(user1.email);
    });

    it('should create user_streaks record for new user', async () => {
      const uniqueId = `test-streak-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const user = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId: `google-streak-${uniqueId}`,
        displayName: 'Streak Test',
      });
      createdUserIds.push(user.id);

      // Verify streak record exists
      const client = supabaseService.getClient();
      const { data: streak } = await client
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      expect(streak).toBeDefined();
      expect(streak.current_streak).toBe(0);
      expect(streak.longest_streak).toBe(0);
    });

    it('should create user_preferences record for new user', async () => {
      const uniqueId = `test-prefs-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const user = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId: `google-prefs-${uniqueId}`,
        displayName: 'Prefs Test',
      });
      createdUserIds.push(user.id);

      const client = supabaseService.getClient();
      const { data: prefs } = await client
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      expect(prefs).toBeDefined();
      expect(prefs.understands_sarcasm).toBe(true); // default
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('should throw on duplicate email with different auth_id', async () => {
      const uniqueId = `test-dupemail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const email = `${uniqueId}@test-iam.com`;

      // First user with this email
      const user1 = await usersService.findOrCreate({
        email,
        authProvider: 'google',
        authId: `google-A-${uniqueId}`,
        displayName: 'User A',
      });
      createdUserIds.push(user1.id);

      // Second user with SAME email but DIFFERENT auth_id → should fail
      await expect(
        usersService.findOrCreate({
          email,
          authProvider: 'apple',
          authId: `apple-B-${uniqueId}`,
          displayName: 'User B',
        }),
      ).rejects.toThrow(); // duplicate key on email
    });

    it('findById should return null for nonexistent UUID', async () => {
      const result = await usersService.findById(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeNull();
    });

    it('findByEmail should return null for nonexistent email', async () => {
      const result = await usersService.findByEmail(
        'absolutely-does-not-exist@nowhere.com',
      );
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('should handle 20 concurrent findOrCreate with SAME auth_id (no duplicates)', async () => {
      const uniqueId = `test-race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const authId = `google-race-${uniqueId}`;

      const requests = Array.from({ length: 20 }, () =>
        usersService
          .findOrCreate({
            email: `${uniqueId}@test-iam.com`,
            authProvider: 'google',
            authId,
            displayName: 'Race Test',
          })
          .catch(() => null), // some may fail on duplicate, that's ok
      );

      const results = await Promise.all(requests);
      const successes = results.filter((r) => r !== null);

      // At least one should succeed
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // All successful results should have the same user ID
      const ids = new Set(successes.map((r) => r!.id));
      expect(ids.size).toBe(1);

      createdUserIds.push(successes[0]!.id);
    });

    it('should handle 50 concurrent findById calls', async () => {
      const uniqueId = `test-conc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const user = await usersService.findOrCreate({
        email: `${uniqueId}@test-iam.com`,
        authProvider: 'google',
        authId: `google-conc-${uniqueId}`,
        displayName: 'Concurrent Test',
      });
      createdUserIds.push(user.id);

      const requests = Array.from({ length: 50 }, () =>
        usersService.findById(user.id),
      );

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result?.id).toBe(user.id);
      });
    });
  });
});
