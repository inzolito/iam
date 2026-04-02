import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SpinService } from '../spin/spin.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockData: Record<string, any>;
  let updateCapture: Record<string, unknown> | null;
  let insertCapture: any[] | null;
  let deleteCapture: { table: string; userId: string } | null;

  function buildMockSupabase(overrides: Record<string, any> = {}) {
    mockData = { ...overrides };
    updateCapture = null;
    insertCapture = null;
    deleteCapture = null;

    return {
      getClient: () => ({
        from: (table: string) => ({
          select: (cols?: string) => ({
            eq: (col: string, val: string) => ({
              single: async () => ({
                data: mockData[table] ?? null,
                error: mockData[`${table}_error`] ?? null,
              }),
              neq: () => ({
                maybeSingle: async () => ({
                  data: mockData[`${table}_conflict`] ?? null,
                  error: null,
                }),
              }),
              maybeSingle: async () => ({
                data: mockData[table] ?? null,
                error: null,
              }),
            }),
          }),
          update: (data: Record<string, unknown>) => {
            updateCapture = data;
            return {
              eq: (col: string, val: string) => ({
                select: () => ({
                  single: async () => ({
                    data: { ...mockData[table], ...data },
                    error: null,
                  }),
                }),
              }),
            };
          },
          delete: () => {
            return {
              eq: (col: string, val: string) => {
                deleteCapture = { table, userId: val };
                return Promise.resolve({ error: null });
              },
            };
          },
          insert: (rows: any[]) => {
            insertCapture = rows;
            return {
              select: () =>
                Promise.resolve({
                  data: rows,
                  error: null,
                }),
            };
          },
        }),
      }),
    };
  }

  let mockSpinService: any;

  async function createService(supabaseOverrides: Record<string, any> = {}) {
    mockSpinService = {
      setUserSpin: jest.fn().mockResolvedValue([]),
      getUserSpin: jest.fn().mockResolvedValue([]),
      createCustomTag: jest.fn().mockResolvedValue({ id: 'tag-1', slug: 'test', display_name: 'Test', category_id: 'cat-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: SupabaseService, useValue: buildMockSupabase(supabaseOverrides) },
        { provide: SpinService, useValue: mockSpinService },
      ],
    }).compile();

    return module.get<OnboardingService>(OnboardingService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('updateProfile — should update username and display_name', async () => {
      service = await createService({
        users: { id: 'u1', username: 'old', display_name: 'Old', is_active: true },
      });

      const result = await service.updateProfile('u1', {
        username: 'newuser',
        displayName: 'New Name',
      });

      expect(updateCapture).toMatchObject({
        username: 'newuser',
        display_name: 'New Name',
      });
      expect(result.username).toBe('newuser');
    });

    it('updateProfile — should calculate is_teen for 17-year-old', async () => {
      service = await createService({
        users: { id: 'u1', is_active: true },
      });

      // 17 years old
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 17);
      const dateStr = birthDate.toISOString().split('T')[0];

      await service.updateProfile('u1', { birthDate: dateStr });

      expect(updateCapture!.is_teen).toBe(true);
    });

    it('updateProfile — should set is_teen=false for 18-year-old', async () => {
      service = await createService({
        users: { id: 'u1', is_active: true },
      });

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 18);
      birthDate.setMonth(birthDate.getMonth() - 1); // ensure past birthday
      const dateStr = birthDate.toISOString().split('T')[0];

      await service.updateProfile('u1', { birthDate: dateStr });

      expect(updateCapture!.is_teen).toBe(false);
    });

    it('setDiagnoses — should save TEA diagnosis and return zen theme', async () => {
      service = await createService({
        user_diagnoses: null,
      });

      const result = await service.setDiagnoses('u1', ['TEA'], 'TEA');

      expect(insertCapture).toHaveLength(1);
      expect(insertCapture![0]).toMatchObject({
        user_id: 'u1',
        diagnosis: 'TEA',
        is_primary: true,
      });
      expect(result.theme).toMatchObject({ key: 'zen' });
    });

    it('setDiagnoses — TEA + AACC → fusion theme with primary zen', async () => {
      service = await createService({});

      const result = await service.setDiagnoses('u1', ['TEA', 'AACC'], 'TEA');

      expect(insertCapture).toHaveLength(2);
      expect(result.theme.key).toBe('zen');
      expect(result.theme.fusion).toBe(true);
      expect(result.theme.secondaryAccents).toHaveLength(1);
      expect(result.theme.secondaryAccents[0].key).toBe('profundidad');
    });

    it('setDiagnoses — AUTOIDENTIFIED is valid', async () => {
      service = await createService({});

      const result = await service.setDiagnoses('u1', ['AUTOIDENTIFIED'], 'AUTOIDENTIFIED');

      expect(insertCapture![0].diagnosis).toBe('AUTOIDENTIFIED');
    });

    it('setSpin — delegates to SpinService', async () => {
      service = await createService({});
      mockSpinService.setUserSpin.mockResolvedValue([
        { id: 't1', slug: 'anime', display_name: 'Anime' },
      ]);

      const result = await service.setSpin('u1', ['t1']);

      expect(mockSpinService.setUserSpin).toHaveBeenCalledWith('u1', ['t1']);
      expect(result.spin).toHaveLength(1);
    });

    it('completeOnboarding — marks onboarding as complete', async () => {
      service = await createService({
        users: { id: 'u1', onboarding_completed: false },
        user_diagnoses: [{ id: 'd1' }],
        user_spin: [{ spin_tag_id: 't1' }],
      });

      // Override the from method to handle different tables
      const mockSupabase = {
        getClient: () => ({
          from: (table: string) => {
            if (table === 'user_diagnoses') {
              return {
                select: () => ({
                  eq: () => Promise.resolve({ data: [{ id: 'd1' }], error: null }),
                }),
              };
            }
            if (table === 'user_spin') {
              return {
                select: () => ({
                  eq: () => Promise.resolve({ data: [{ spin_tag_id: 't1' }], error: null }),
                }),
              };
            }
            if (table === 'users') {
              return {
                update: (data: any) => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { id: 'u1', onboarding_completed: true },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }
            return { select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
          },
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          OnboardingService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: SpinService, useValue: mockSpinService },
        ],
      }).compile();

      const svc = module.get<OnboardingService>(OnboardingService);
      const result = await svc.completeOnboarding('u1');

      expect(result.onboarding_completed).toBe(true);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('updateProfile — empty update throws', async () => {
      service = await createService({});

      await expect(service.updateProfile('u1', {})).rejects.toThrow(BadRequestException);
      await expect(service.updateProfile('u1', {})).rejects.toThrow('EMPTY_UPDATE');
    });

    it('updateProfile — username too short throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { username: 'ab' }),
      ).rejects.toThrow('USERNAME_INVALID');
    });

    it('updateProfile — username with special chars throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { username: 'user@name!' }),
      ).rejects.toThrow('USERNAME_INVALID');
    });

    it('updateProfile — username already taken throws', async () => {
      service = await createService({
        users: { id: 'u1' },
        users_conflict: { id: 'u2' }, // simulates another user with same username
      });

      await expect(
        service.updateProfile('u1', { username: 'takenuser' }),
      ).rejects.toThrow('USERNAME_TAKEN');
    });

    it('updateProfile — age under 16 throws', async () => {
      service = await createService({});

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 15);

      await expect(
        service.updateProfile('u1', { birthDate: birthDate.toISOString().split('T')[0] }),
      ).rejects.toThrow('AGE_TOO_YOUNG');
    });

    it('updateProfile — invalid birth date throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { birthDate: 'not-a-date' }),
      ).rejects.toThrow('BIRTH_DATE_INVALID');
    });

    it('updateProfile — msn_status too long throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { msnStatus: 'A'.repeat(161) }),
      ).rejects.toThrow('MSN_STATUS_TOO_LONG');
    });

    it('updateProfile — invalid energy level throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { energyLevel: 5 }),
      ).rejects.toThrow('ENERGY_LEVEL_INVALID');
    });

    it('setDiagnoses — invalid diagnosis value throws', async () => {
      service = await createService({});

      await expect(
        service.setDiagnoses('u1', ['INVALID_DIAG'], 'INVALID_DIAG'),
      ).rejects.toThrow('DIAGNOSIS_INVALID');
    });

    it('setDiagnoses — second invalid diagnosis in list throws', async () => {
      service = await createService({});

      await expect(
        service.setDiagnoses('u1', ['TEA', 'FAKE'], 'TEA'),
      ).rejects.toThrow('DIAGNOSIS_INVALID');
    });

    it('setDiagnoses — primary not in list throws', async () => {
      service = await createService({});

      await expect(
        service.setDiagnoses('u1', ['TEA'], 'AACC'),
      ).rejects.toThrow('PRIMARY_NOT_IN_LIST');
    });

    it('completeOnboarding — no diagnoses throws', async () => {
      const mockSupabase = {
        getClient: () => ({
          from: (table: string) => ({
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          OnboardingService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: SpinService, useValue: { setUserSpin: jest.fn(), getUserSpin: jest.fn() } },
        ],
      }).compile();

      const svc = module.get<OnboardingService>(OnboardingService);
      await expect(svc.completeOnboarding('u1')).rejects.toThrow('ONBOARDING_INCOMPLETE');
    });

    it('completeOnboarding — no SpIn throws', async () => {
      let callCount = 0;
      const mockSupabase = {
        getClient: () => ({
          from: (table: string) => ({
            select: () => ({
              eq: () => {
                callCount++;
                // First call = diagnoses (has data), second = spin (empty)
                return Promise.resolve({
                  data: callCount === 1 ? [{ id: 'd1' }] : [],
                  error: null,
                });
              },
            }),
          }),
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          OnboardingService,
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: SpinService, useValue: { setUserSpin: jest.fn(), getUserSpin: jest.fn() } },
        ],
      }).compile();

      const svc = module.get<OnboardingService>(OnboardingService);
      await expect(svc.completeOnboarding('u1')).rejects.toThrow('ONBOARDING_INCOMPLETE');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('updateProfile — SQL injection in username is sanitized/rejected', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { username: "'; DROP TABLE users; --" }),
      ).rejects.toThrow('USERNAME_INVALID');
    });

    it('updateProfile — XSS in display name is trimmed safely', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      const result = await service.updateProfile('u1', {
        displayName: '<script>alert("xss")</script>',
      });

      // Should save the trimmed string (it's just text, escaped by Supabase)
      expect(updateCapture!.display_name).toBe('<script>alert("xss")</script>');
    });

    it('setDiagnoses — all valid diagnoses at once', async () => {
      service = await createService({});

      const result = await service.setDiagnoses(
        'u1',
        ['TEA', 'TDAH', 'AACC', 'DISLEXIA'],
        'TEA',
      );

      expect(insertCapture).toHaveLength(4);
      expect(result.theme.fusion).toBe(true);
      expect(result.theme.secondaryAccents).toHaveLength(3);
    });

    it('should handle 50 concurrent updateProfile calls', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      const calls = Array.from({ length: 50 }, (_, i) =>
        service.updateProfile('u1', { displayName: `Name ${i}` }),
      );

      await expect(Promise.all(calls)).resolves.not.toThrow();
    });

    it('updateProfile — boundary: username exactly 3 chars', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      const result = await service.updateProfile('u1', { username: 'abc' });
      expect(updateCapture!.username).toBe('abc');
    });

    it('updateProfile — boundary: username exactly 30 chars', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      const result = await service.updateProfile('u1', {
        username: 'a'.repeat(30),
      });
      expect(updateCapture!.username).toBe('a'.repeat(30));
    });

    it('updateProfile — boundary: username 31 chars throws', async () => {
      service = await createService({});

      await expect(
        service.updateProfile('u1', { username: 'a'.repeat(31) }),
      ).rejects.toThrow('USERNAME_INVALID');
    });

    it('updateProfile — boundary: msn_status exactly 160 chars', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      await service.updateProfile('u1', { msnStatus: 'A'.repeat(160) });
      expect(updateCapture!.msn_status).toBe('A'.repeat(160));
    });

    it('updateProfile — exactly age 16 is accepted', async () => {
      service = await createService({
        users: { id: 'u1' },
      });

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 16);
      // Ensure they already had their birthday this year
      birthDate.setMonth(birthDate.getMonth() - 1);

      await service.updateProfile('u1', {
        birthDate: birthDate.toISOString().split('T')[0],
      });

      expect(updateCapture!.is_teen).toBe(true);
      expect(updateCapture!.birth_date).toBeDefined();
    });
  });
});
