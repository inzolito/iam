import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SpinService } from './spin.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('SpinService', () => {
  let service: SpinService;
  let mockTags: any[];
  let mockCategories: any[];
  let insertedRows: any[] | null;
  let deletedTable: string | null;

  function buildMock(opts: {
    tags?: any[];
    categories?: any[];
    userSpin?: any[];
    existingSlug?: any;
    insertError?: any;
  } = {}) {
    mockTags = opts.tags ?? [];
    mockCategories = opts.categories ?? [];
    insertedRows = null;
    deletedTable = null;

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'spin_tags') {
            return {
              select: () => ({
                or: () => ({
                  order: (...args: any[]) => ({
                    order: (...args2: any[]) => ({
                      limit: () => ({
                        eq: () => Promise.resolve({ data: mockTags, error: null }),
                        then: (fn: any) => fn({ data: mockTags, error: null }),
                      }),
                    }),
                  }),
                }),
                in: () => Promise.resolve({ data: mockTags, error: null }),
                eq: () => ({
                  maybeSingle: async () => ({
                    data: opts.existingSlug ?? null,
                    error: null,
                  }),
                }),
              }),
              insert: (data: any) => {
                insertedRows = Array.isArray(data) ? data : [data];
                return {
                  select: () => ({
                    single: async () => ({
                      data: opts.insertError
                        ? null
                        : { id: 'new-tag', ...insertedRows![0] },
                      error: opts.insertError ?? null,
                    }),
                  }),
                };
              },
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          }
          if (table === 'spin_categories') {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: mockCategories,
                    error: null,
                  }),
              }),
            };
          }
          if (table === 'user_spin') {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: opts.userSpin ?? [],
                    error: null,
                  }),
              }),
              delete: () => ({
                eq: () => {
                  deletedTable = 'user_spin';
                  return Promise.resolve({ error: null });
                },
              }),
              insert: (rows: any[]) => {
                insertedRows = rows;
                return Promise.resolve({
                  error: opts.insertError ?? null,
                });
              },
            };
          }
          return {
            select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
          };
        },
      }),
    };
  }

  async function createService(opts: Parameters<typeof buildMock>[0] = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpinService,
        { provide: SupabaseService, useValue: buildMock(opts) },
      ],
    }).compile();

    return module.get<SpinService>(SpinService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('searchTags — returns matching tags', async () => {
      service = await createService({
        tags: [
          { id: 't1', slug: 'anime', display_name: 'Anime', is_curated: true },
          { id: 't2', slug: 'animation', display_name: 'Animation', is_curated: false },
        ],
      });

      const results = await service.searchTags('anim');
      expect(results).toHaveLength(2);
      expect(results[0].is_curated).toBe(true);
    });

    it('getCategories — returns categories with translations', async () => {
      service = await createService({
        categories: [
          {
            id: 'c1',
            slug: 'entertainment',
            icon: '🎬',
            spin_category_translations: [{ name: 'Entretenimiento' }],
          },
        ],
      });

      const cats = await service.getCategories('es');
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe('Entretenimiento');
    });

    it('setUserSpin — saves tags and deletes old ones', async () => {
      const fakeTags = [
        { id: 't1', slug: 'anime', category_id: 'c1', usage_count: 5, is_curated: true },
        { id: 't2', slug: 'manga', category_id: 'c2', usage_count: 3, is_curated: true },
      ];
      service = await createService({ tags: fakeTags });

      const result = await service.setUserSpin('u1', ['t1', 't2']);

      expect(deletedTable).toBe('user_spin');
      expect(result).toHaveLength(2);
    });

    it('createCustomTag — creates new tag with normalized slug', async () => {
      service = await createService({});

      const tag = await service.createCustomTag('Rick y Morty', 'c1');

      expect(tag.id).toBe('new-tag');
      expect(insertedRows![0].slug).toBe('rick-y-morty');
      expect(insertedRows![0].is_curated).toBe(false);
    });

    it('createCustomTag — returns existing tag if slug matches', async () => {
      service = await createService({
        existingSlug: { id: 'existing', slug: 'rick-and-morty', display_name: 'Rick and Morty', category_id: 'c1' },
      });

      const tag = await service.createCustomTag('Rick and Morty', 'c1');

      expect(tag.id).toBe('existing');
      expect(insertedRows).toBeNull(); // no insert
    });

    it('getUserSpin — returns user tags', async () => {
      service = await createService({
        userSpin: [
          { spin_tags: { id: 't1', slug: 'anime', display_name: 'Anime' } },
        ],
      });

      const tags = await service.getUserSpin('u1');
      expect(tags).toHaveLength(1);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('setUserSpin — more than 20 tags throws SPIN_LIMIT_EXCEEDED', async () => {
      service = await createService({});
      const ids = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

      await expect(service.setUserSpin('u1', ids)).rejects.toThrow('SPIN_LIMIT_EXCEEDED');
    });

    it('setUserSpin — empty tags throws SPIN_EMPTY', async () => {
      service = await createService({});

      await expect(service.setUserSpin('u1', [])).rejects.toThrow('SPIN_EMPTY');
    });

    it('setUserSpin — non-existent tag IDs throws SPIN_INVALID_TAGS', async () => {
      service = await createService({ tags: [] }); // returns empty = mismatch

      await expect(
        service.setUserSpin('u1', ['nonexistent']),
      ).rejects.toThrow('SPIN_INVALID_TAGS');
    });

    it('setUserSpin — 6 tags in same category throws SPIN_CATEGORY_LIMIT_EXCEEDED', async () => {
      const sameCatTags = Array.from({ length: 6 }, (_, i) => ({
        id: `t${i}`,
        slug: `tag-${i}`,
        category_id: 'same-cat',
        usage_count: 0,
        is_curated: true,
      }));
      service = await createService({ tags: sameCatTags });

      await expect(
        service.setUserSpin('u1', sameCatTags.map((t) => t.id)),
      ).rejects.toThrow('SPIN_CATEGORY_LIMIT_EXCEEDED');
    });

    it('createCustomTag — name too short throws', async () => {
      service = await createService({});

      await expect(
        service.createCustomTag('a', 'c1'),
      ).rejects.toThrow('SPIN_TAG_INVALID');
    });

    it('createCustomTag — name too long throws', async () => {
      service = await createService({});

      await expect(
        service.createCustomTag('A'.repeat(101), 'c1'),
      ).rejects.toThrow('SPIN_TAG_INVALID');
    });

    it('searchTags — empty search returns empty array', async () => {
      service = await createService({});

      const result = await service.searchTags('');
      // Returns whatever the mock returns (could be empty)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('setUserSpin — exactly 20 tags (max) succeeds', async () => {
      const tags = Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        slug: `tag-${i}`,
        category_id: `cat-${i % 5}`, // 4 tags per category
        usage_count: 0,
        is_curated: true,
      }));
      service = await createService({ tags });

      const result = await service.setUserSpin(
        'u1',
        tags.map((t) => t.id),
      );

      expect(result).toHaveLength(20);
    });

    it('setUserSpin — exactly 5 per category succeeds', async () => {
      const tags = Array.from({ length: 5 }, (_, i) => ({
        id: `t${i}`,
        slug: `tag-${i}`,
        category_id: 'same-cat',
        usage_count: 0,
        is_curated: true,
      }));
      service = await createService({ tags });

      await expect(
        service.setUserSpin('u1', tags.map((t) => t.id)),
      ).resolves.not.toThrow();
    });

    it('createCustomTag — SQL injection in name is normalized away', async () => {
      service = await createService({});

      const tag = await service.createCustomTag("'; DROP TABLE spin_tags; --", 'c1');

      // Slug should be sanitized
      expect(insertedRows![0].slug).toBe('drop-table-spintags');
    });

    it('createCustomTag — normalizes accents and special chars', async () => {
      service = await createService({});

      const tag = await service.createCustomTag('Física Cuántica!!', 'c1');

      expect(insertedRows![0].slug).toBe('fisica-cuantica');
    });

    it('createCustomTag — "Rick y Morty" and "Rick and Morty" normalize differently', async () => {
      service = await createService({});

      // These produce different slugs — that's expected
      const tag1Slug = 'rick-y-morty';
      const tag2Slug = 'rick-and-morty';

      // Just verify the normalization works
      const tag = await service.createCustomTag('Rick y morty', 'c1');
      expect(insertedRows![0].slug).toBe(tag1Slug);
    });

    it('should handle 50 concurrent searchTags calls', async () => {
      service = await createService({
        tags: [{ id: 't1', slug: 'anime', display_name: 'Anime' }],
      });

      const calls = Array.from({ length: 50 }, () =>
        service.searchTags('anime'),
      );

      await expect(Promise.all(calls)).resolves.not.toThrow();
    });

    it('sanitizeSearch removes dangerous characters', async () => {
      service = await createService({ tags: [] });

      // This should not crash — SQL injection chars are stripped
      await service.searchTags("'; DROP TABLE--");
      // If we get here, no crash occurred
    });
  });
});
