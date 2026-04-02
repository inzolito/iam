import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SpinService } from '../spin/spin.service';

const VALID_DIAGNOSES = ['TEA', 'TDAH', 'AACC', 'DISLEXIA', 'AUTOIDENTIFIED', 'OTHER'];
const MIN_AGE = 16;
const MSN_STATUS_MAX_LENGTH = 160;

// Theme configuration per diagnosis
const THEME_CONFIG: Record<string, Record<string, unknown>> = {
  TEA: {
    key: 'zen',
    primary: '#6B9080',
    secondary: '#A4C3B2',
    background: '#F6FFF8',
    particleEffect: 'gentle_wave',
    fontScale: 1.0,
    reducedMotion: true,
  },
  TDAH: {
    key: 'dashboard',
    primary: '#FF6B35',
    secondary: '#FFA62B',
    background: '#FFF8F0',
    particleEffect: 'spark_burst',
    fontScale: 1.0,
    reducedMotion: false,
  },
  AACC: {
    key: 'profundidad',
    primary: '#1B4965',
    secondary: '#5FA8D3',
    background: '#F0F4F8',
    particleEffect: 'fractal_grow',
    fontScale: 1.0,
    reducedMotion: false,
  },
  DISLEXIA: {
    key: 'claridad',
    primary: '#7B2D8E',
    secondary: '#B07DC5',
    background: '#FDF6FF',
    particleEffect: 'soft_pulse',
    fontScale: 1.15,
    reducedMotion: true,
  },
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly spinService: SpinService,
  ) {}

  async getProfile(userId: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return data;
  }

  async updateProfile(
    userId: string,
    updates: {
      username?: string;
      displayName?: string;
      birthDate?: string;
      msnStatus?: string;
      energyLevel?: number;
      notifLevel?: number;
    },
  ) {
    const client = this.supabaseService.getClient();
    const updateData: Record<string, unknown> = {};

    if (updates.username !== undefined) {
      const username = updates.username.trim().toLowerCase();
      if (username.length < 3 || username.length > 30) {
        throw new BadRequestException('USERNAME_INVALID: username debe tener entre 3 y 30 caracteres');
      }
      if (!/^[a-z0-9._-]+$/.test(username)) {
        throw new BadRequestException('USERNAME_INVALID: solo letras, números, punto, guión y guión bajo');
      }
      // Check uniqueness
      const { data: existing } = await client
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        throw new BadRequestException('USERNAME_TAKEN: este username ya está en uso');
      }
      updateData.username = username;
    }

    if (updates.displayName !== undefined) {
      const name = updates.displayName.trim();
      if (name.length < 1 || name.length > 50) {
        throw new BadRequestException('DISPLAY_NAME_INVALID: nombre debe tener entre 1 y 50 caracteres');
      }
      updateData.display_name = name;
    }

    if (updates.birthDate !== undefined) {
      const birthDate = new Date(updates.birthDate);
      if (isNaN(birthDate.getTime())) {
        throw new BadRequestException('BIRTH_DATE_INVALID: formato debe ser YYYY-MM-DD');
      }
      const age = this.calculateAge(birthDate);
      if (age < MIN_AGE) {
        throw new BadRequestException(`AGE_TOO_YOUNG: debes tener al menos ${MIN_AGE} años`);
      }
      updateData.birth_date = updates.birthDate;
      updateData.is_teen = age < 18;
    }

    if (updates.msnStatus !== undefined) {
      if (updates.msnStatus.length > MSN_STATUS_MAX_LENGTH) {
        throw new BadRequestException(
          `MSN_STATUS_TOO_LONG: máximo ${MSN_STATUS_MAX_LENGTH} caracteres`,
        );
      }
      updateData.msn_status = updates.msnStatus;
    }

    if (updates.energyLevel !== undefined) {
      if (![1, 2, 3].includes(updates.energyLevel)) {
        throw new BadRequestException('ENERGY_LEVEL_INVALID: debe ser 1, 2 o 3');
      }
      updateData.energy_level = updates.energyLevel;
    }

    if (updates.notifLevel !== undefined) {
      if (![1, 2, 3].includes(updates.notifLevel)) {
        throw new BadRequestException('NOTIF_LEVEL_INVALID: debe ser 1, 2 o 3');
      }
      updateData.notif_level = updates.notifLevel;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('EMPTY_UPDATE: debes enviar al menos un campo');
    }

    const { data, error } = await client
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error updating profile: ${error.message}`);
      throw new BadRequestException(`Error actualizando perfil: ${error.message}`);
    }

    return data;
  }

  async setDiagnoses(userId: string, diagnoses: string[], primary: string) {
    // Validate diagnosis values
    for (const d of diagnoses) {
      if (!VALID_DIAGNOSES.includes(d)) {
        throw new BadRequestException(`DIAGNOSIS_INVALID: '${d}' no es un diagnóstico válido`);
      }
    }
    if (!diagnoses.includes(primary)) {
      throw new BadRequestException('PRIMARY_NOT_IN_LIST: el diagnóstico principal debe estar en la lista');
    }

    const client = this.supabaseService.getClient();

    // Delete existing diagnoses
    const { error: deleteError } = await client
      .from('user_diagnoses')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      this.logger.error(`Error deleting diagnoses: ${deleteError.message}`);
      throw new BadRequestException('Error guardando diagnósticos');
    }

    // Insert new diagnoses
    const rows = diagnoses.map((d) => ({
      user_id: userId,
      diagnosis: d,
      is_primary: d === primary,
    }));

    const { data, error: insertError } = await client
      .from('user_diagnoses')
      .insert(rows)
      .select();

    if (insertError) {
      this.logger.error(`Error inserting diagnoses: ${insertError.message}`);
      throw new BadRequestException('Error guardando diagnósticos');
    }

    // Build theme config based on primary + secondary diagnoses
    const theme = this.buildThemeConfig(diagnoses, primary);

    return { diagnoses: data, theme };
  }

  async getDiagnoses(userId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_diagnoses')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Error fetching diagnoses: ${error.message}`);
      return [];
    }

    const diagnoses = data ?? [];
    const primary = diagnoses.find((d: any) => d.is_primary)?.diagnosis;
    const diagnosisList = diagnoses.map((d: any) => d.diagnosis);
    const theme = primary ? this.buildThemeConfig(diagnosisList, primary) : null;

    return { diagnoses, theme };
  }

  async setSpin(userId: string, tagIds: string[]) {
    const tags = await this.spinService.setUserSpin(userId, tagIds);
    return { spin: tags };
  }

  async getSpin(userId: string) {
    const tags = await this.spinService.getUserSpin(userId);
    return { spin: tags };
  }

  async createCustomTag(displayName: string, categoryId: string) {
    return this.spinService.createCustomTag(displayName, categoryId);
  }

  async completeOnboarding(userId: string) {
    const client = this.supabaseService.getClient();

    // Verify user has diagnoses and at least 1 SpIn
    const { data: diagnoses } = await client
      .from('user_diagnoses')
      .select('id')
      .eq('user_id', userId);

    if (!diagnoses || diagnoses.length === 0) {
      throw new BadRequestException('ONBOARDING_INCOMPLETE: debes seleccionar al menos un diagnóstico');
    }

    const { data: spin } = await client
      .from('user_spin')
      .select('spin_tag_id')
      .eq('user_id', userId);

    if (!spin || spin.length === 0) {
      throw new BadRequestException('ONBOARDING_INCOMPLETE: debes seleccionar al menos un SpIn');
    }

    const { data, error } = await client
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error completing onboarding: ${error.message}`);
      throw new BadRequestException('Error completando onboarding');
    }

    return data;
  }

  /**
   * Construye la configuración de tema basándose en diagnósticos.
   * Si hay múltiples, fusiona el primario con los secundarios.
   */
  private buildThemeConfig(diagnoses: string[], primary: string) {
    const primaryTheme = THEME_CONFIG[primary] ?? THEME_CONFIG['TEA'];

    if (diagnoses.length === 1) {
      return primaryTheme;
    }

    // Fusion: primary theme is base, secondary diagnoses add accents
    const secondaryDiagnoses = diagnoses.filter((d) => d !== primary);
    const accents = secondaryDiagnoses
      .map((d) => THEME_CONFIG[d])
      .filter(Boolean);

    return {
      ...primaryTheme,
      fusion: true,
      secondaryAccents: accents.map((a) => ({
        key: a.key,
        accent: a.secondary,
      })),
    };
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}
