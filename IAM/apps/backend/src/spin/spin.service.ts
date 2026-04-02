import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const SPIN_MAX_TOTAL = 20;
const SPIN_MAX_PER_CATEGORY = 5;

interface SpinTag {
  id: string;
  slug: string;
  display_name: string;
  category_id: string;
  usage_count: number;
  is_curated: boolean;
}

interface SpinCategory {
  id: string;
  slug: string;
  icon: string;
  name?: string; // from translation
}

@Injectable()
export class SpinService {
  private readonly logger = new Logger(SpinService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Busca tags por texto (autocomplete con pg_trgm).
   * Retorna curated primero, luego custom con usage_count >= 3.
   */
  async searchTags(
    search: string,
    categoryId?: string,
    limit = 10,
  ): Promise<SpinTag[]> {
    const client = this.supabaseService.getClient();

    let query = client
      .from('spin_tags')
      .select('id, slug, display_name, category_id, usage_count, is_curated')
      .or(`slug.ilike.%${this.sanitizeSearch(search)}%,display_name.ilike.%${this.sanitizeSearch(search)}%`)
      .order('is_curated', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error searching tags: ${error.message}`);
      return [];
    }

    return data ?? [];
  }

  /**
   * Retorna todas las categorías con traducciones.
   */
  async getCategories(lang = 'es'): Promise<SpinCategory[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('spin_categories')
      .select(`
        id, slug, icon,
        spin_category_translations!inner(name)
      `)
      .eq('spin_category_translations.lang', lang);

    if (error) {
      this.logger.error(`Error fetching categories: ${error.message}`);
      return [];
    }

    return (data ?? []).map((cat: any) => ({
      id: cat.id,
      slug: cat.slug,
      icon: cat.icon,
      name: cat.spin_category_translations?.[0]?.name ?? cat.slug,
    }));
  }

  /**
   * Guarda los SpIn de un usuario. Valida límites.
   * tagIds = array de UUIDs de spin_tags
   */
  async setUserSpin(userId: string, tagIds: string[]): Promise<SpinTag[]> {
    if (tagIds.length > SPIN_MAX_TOTAL) {
      throw new BadRequestException(
        `SPIN_LIMIT_EXCEEDED: máximo ${SPIN_MAX_TOTAL} SpIn permitidos`,
      );
    }

    if (tagIds.length === 0) {
      throw new BadRequestException('SPIN_EMPTY: debes seleccionar al menos 1 SpIn');
    }

    // Validate tags exist and check per-category limits
    const client = this.supabaseService.getClient();

    const { data: tags, error: tagError } = await client
      .from('spin_tags')
      .select('id, slug, display_name, category_id, usage_count, is_curated')
      .in('id', tagIds);

    if (tagError) {
      this.logger.error(`Error fetching tags: ${tagError.message}`);
      throw new BadRequestException('Error validando SpIn tags');
    }

    if (!tags || tags.length !== tagIds.length) {
      throw new BadRequestException('SPIN_INVALID_TAGS: algunos tags no existen');
    }

    // Check per-category limit
    const categoryCounts = new Map<string, number>();
    for (const tag of tags) {
      const count = (categoryCounts.get(tag.category_id) ?? 0) + 1;
      if (count > SPIN_MAX_PER_CATEGORY) {
        throw new BadRequestException(
          `SPIN_CATEGORY_LIMIT_EXCEEDED: máximo ${SPIN_MAX_PER_CATEGORY} SpIn por categoría`,
        );
      }
      categoryCounts.set(tag.category_id, count);
    }

    // Delete existing and insert new (atomic via transaction-like approach)
    const { error: deleteError } = await client
      .from('user_spin')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      this.logger.error(`Error deleting user spin: ${deleteError.message}`);
      throw new BadRequestException('Error guardando SpIn');
    }

    const rows = tagIds.map((tagId) => ({
      user_id: userId,
      spin_tag_id: tagId,
    }));

    const { error: insertError } = await client
      .from('user_spin')
      .insert(rows);

    if (insertError) {
      this.logger.error(`Error inserting user spin: ${insertError.message}`);
      throw new BadRequestException('Error guardando SpIn');
    }

    // Increment usage_count for selected tags (best-effort)
    for (const tagId of tagIds) {
      try {
        await client
          .from('spin_tags')
          .update({ usage_count: (tags.find((t) => t.id === tagId)?.usage_count ?? 0) + 1 })
          .eq('id', tagId);
      } catch {
        // Non-critical
      }
    }

    return tags;
  }

  /**
   * Obtiene los SpIn actuales de un usuario.
   */
  async getUserSpin(userId: string): Promise<SpinTag[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_spin')
      .select(`
        spin_tags (id, slug, display_name, category_id, usage_count, is_curated)
      `)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Error fetching user spin: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row: any) => row.spin_tags).filter(Boolean);
  }

  /**
   * Crea un tag custom (normalizado). Si ya existe slug similar, retorna el existente.
   */
  async createCustomTag(
    displayName: string,
    categoryId: string,
  ): Promise<SpinTag> {
    const slug = this.normalizeSlug(displayName);

    if (slug.length < 2 || slug.length > 100) {
      throw new BadRequestException('SPIN_TAG_INVALID: nombre debe tener entre 2 y 100 caracteres');
    }

    const client = this.supabaseService.getClient();

    // Check if similar slug already exists
    const { data: existing } = await client
      .from('spin_tags')
      .select('id, slug, display_name, category_id, usage_count, is_curated')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data: created, error } = await client
      .from('spin_tags')
      .insert({
        slug,
        display_name: displayName.trim(),
        category_id: categoryId,
        is_curated: false,
        usage_count: 0,
      })
      .select('id, slug, display_name, category_id, usage_count, is_curated')
      .single();

    if (error) {
      this.logger.error(`Error creating custom tag: ${error.message}`);
      throw new BadRequestException('Error creando tag personalizado');
    }

    return created;
  }

  private normalizeSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // only alphanum, spaces, hyphens
      .replace(/\s+/g, '-') // spaces to hyphens
      .replace(/-+/g, '-') // collapse hyphens
      .replace(/^-|-$/g, ''); // trim hyphens
  }

  private sanitizeSearch(input: string): string {
    // Remove special Supabase/SQL characters
    return input.replace(/[%_\\'"]/g, '');
  }
}
