import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EsenciasService } from './esencias.service';

interface UnlockRule {
  id: string;
  diagnosis: string;
  featureKey: string;
  featureName: string;
  description: string;
  requiredEsencias: number;
  category: string;
  uiSettings: Record<string, any>;
}

interface UserUnlock {
  id: string;
  unlockId: string;
  featureKey: string;
  featureName: string;
  unlockedAt: string;
  isActive: boolean;
}

@Injectable()
export class UnlocksService {
  private readonly logger = new Logger(UnlocksService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly esenciasService: EsenciasService,
  ) {}

  /**
   * Get all unlock rules, optionally filtered by diagnosis
   */
  async getUnlockRules(diagnosis?: string): Promise<UnlockRule[]> {
    const client = this.supabaseService.getClient();

    let query = client.from('unlock_rules').select('*');

    if (diagnosis) {
      query = query.eq('diagnosis', diagnosis);
    }

    const { data, error } = await query.order('required_esencias');

    if (error) {
      this.logger.error(`Error fetching unlock rules: ${error.message}`);
      throw new BadRequestException('FETCH_FAILED');
    }

    return (data || []).map((rule: any) => ({
      id: rule.id,
      diagnosis: rule.diagnosis,
      featureKey: rule.feature_key,
      featureName: rule.feature_name,
      description: rule.description,
      requiredEsencias: rule.required_esencias,
      category: rule.category,
      uiSettings: rule.ui_settings,
    }));
  }

  /**
   * Get all unlocks grouped by diagnosis
   */
  async getAllUnlocksGroupedByDiagnosis(): Promise<Map<string, UnlockRule[]>> {
    const rules = await this.getUnlockRules();

    const grouped = new Map<string, UnlockRule[]>();

    for (const rule of rules) {
      if (!grouped.has(rule.diagnosis)) {
        grouped.set(rule.diagnosis, []);
      }
      grouped.get(rule.diagnosis)!.push(rule);
    }

    return grouped;
  }

  /**
   * Get user's unlocked features grouped by diagnosis
   * Returns diagnosis → unlocks mapping
   */
  async getUserUnlocks(
    userId: string,
  ): Promise<Map<string, UserUnlock[]>> {
    const client = this.supabaseService.getClient();

    // Get user's diagnoses
    const { data: userDiagnoses, error: diagError } = await client
      .from('user_diagnoses')
      .select('diagnosis')
      .eq('user_id', userId);

    if (diagError) {
      this.logger.error(
        `Error fetching user diagnoses: ${diagError.message}`,
      );
      throw new BadRequestException('FETCH_FAILED');
    }

    const diagnoses = (userDiagnoses || []).map((d: any) => d.diagnosis);

    // Get user's unlocks
    const { data: unlocks, error: unlockError } = await client
      .from('user_unlocks')
      .select(
        `
        id,
        unlocked_at,
        is_active,
        unlock_rules (
          id,
          feature_key,
          feature_name,
          diagnosis,
          required_esencias
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_active', true);

    if (unlockError) {
      this.logger.error(
        `Error fetching unlocks: ${unlockError.message}`,
      );
      throw new BadRequestException('FETCH_FAILED');
    }

    const grouped = new Map<string, UserUnlock[]>();

    for (const diagnosis of diagnoses) {
      const diagUnlocks = (unlocks || [])
        .filter((u: any) => u.unlock_rules?.diagnosis === diagnosis)
        .map((u: any) => ({
          id: u.id,
          unlockId: u.unlock_rules?.id,
          featureKey: u.unlock_rules?.feature_key,
          featureName: u.unlock_rules?.feature_name,
          unlockedAt: u.unlocked_at,
          isActive: u.is_active,
        }));

      grouped.set(diagnosis, diagUnlocks);
    }

    return grouped;
  }

  /**
   * Check if user can unlock a feature (has sufficient balance)
   */
  async canUnlock(
    userId: string,
    unlockId: string,
  ): Promise<{ canUnlock: boolean; reason?: string; cost: number }> {
    const client = this.supabaseService.getClient();

    // Get unlock rule
    const { data: unlock, error: unlockError } = await client
      .from('unlock_rules')
      .select('*')
      .eq('id', unlockId)
      .single();

    if (unlockError || !unlock) {
      throw new NotFoundException('UNLOCK_NOT_FOUND');
    }

    // Check if already unlocked (idempotent)
    const { data: existing } = await client
      .from('user_unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('unlock_id', unlockId)
      .eq('is_active', true)
      .single();

    if (existing) {
      return {
        canUnlock: false,
        reason: 'ALREADY_UNLOCKED',
        cost: unlock.required_esencias,
      };
    }

    // Get user's diagnoses
    const { data: userDiagnoses } = await client
      .from('user_diagnoses')
      .select('diagnosis')
      .eq('user_id', userId);

    const diagnoses = (userDiagnoses || []).map((d: any) => d.diagnosis);

    // Check if unlock applies to user's diagnosis
    if (!diagnoses.includes(unlock.diagnosis)) {
      return {
        canUnlock: false,
        reason: 'DIAGNOSIS_MISMATCH',
        cost: unlock.required_esencias,
      };
    }

    // Check balance
    const hasBalance = await this.esenciasService.hasBalance(
      userId,
      unlock.required_esencias,
    );

    if (!hasBalance) {
      return {
        canUnlock: false,
        reason: 'INSUFFICIENT_BALANCE',
        cost: unlock.required_esencias,
      };
    }

    return {
      canUnlock: true,
      cost: unlock.required_esencias,
    };
  }

  /**
   * Unlock a feature for user
   * Deducts Esencias and creates unlock entry
   */
  async unlock(
    userId: string,
    unlockId: string,
  ): Promise<{ success: boolean; newBalance: number }> {
    const client = this.supabaseService.getClient();

    // Verify unlock exists
    const { data: unlock, error: unlockError } = await client
      .from('unlock_rules')
      .select('*')
      .eq('id', unlockId)
      .single();

    if (unlockError || !unlock) {
      throw new NotFoundException('UNLOCK_NOT_FOUND');
    }

    // Check if already unlocked
    const { data: existing } = await client
      .from('user_unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('unlock_id', unlockId)
      .eq('is_active', true)
      .single();

    if (existing) {
      throw new BadRequestException('ALREADY_UNLOCKED');
    }

    // Check diagnosis match
    const { data: userDiagnoses } = await client
      .from('user_diagnoses')
      .select('diagnosis')
      .eq('user_id', userId);

    const diagnoses = (userDiagnoses || []).map((d: any) => d.diagnosis);

    if (!diagnoses.includes(unlock.diagnosis)) {
      throw new BadRequestException('DIAGNOSIS_MISMATCH');
    }

    // Deduct Esencias
    let newBalance: number;
    try {
      newBalance = await this.esenciasService.deductEsencias(
        userId,
        unlock.required_esencias,
        `unlock_${unlock.feature_key}`,
      );
    } catch (error: any) {
      if (error.message === 'INSUFFICIENT_BALANCE') {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }
      throw error;
    }

    // Create unlock entry
    const { error: insertError } = await client
      .from('user_unlocks')
      .insert({
        user_id: userId,
        unlock_id: unlockId,
        unlocked_at: new Date().toISOString(),
        is_active: true,
      });

    if (insertError) {
      this.logger.error(`Error creating unlock: ${insertError.message}`);
      throw new BadRequestException('UNLOCK_CREATION_FAILED');
    }

    this.logger.log(
      `User ${userId} unlocked feature ${unlock.feature_key} (cost: ${unlock.required_esencias})`,
    );

    return {
      success: true,
      newBalance,
    };
  }

  /**
   * Check if user has a specific feature unlocked (by feature_key)
   */
  async isFeatureUnlocked(
    userId: string,
    featureKey: string,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('unlock_rules.feature_key', null); // Join with unlock_rules

    if (error) {
      this.logger.error(
        `Error checking unlock: ${error.message}`,
      );
      return false;
    }

    // Since we can't easily join, query unlock_rules separately
    const { data: unlocks } = await client
      .from('user_unlocks')
      .select('unlock_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!unlocks || unlocks.length === 0) {
      return false;
    }

    const unlockIds = unlocks.map((u: any) => u.unlock_id);

    const { data: rules } = await client
      .from('unlock_rules')
      .select('id')
      .eq('feature_key', featureKey)
      .in('id', unlockIds)
      .single();

    return !!rules;
  }

  /**
   * Get list of unlocked feature keys for a user
   */
  async getUnlockedFeatureKeys(userId: string): Promise<string[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_unlocks')
      .select('unlock_rules(feature_key)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      this.logger.error(`Error fetching unlocks: ${error.message}`);
      return [];
    }

    return (data || [])
      .map((u: any) => u.unlock_rules?.feature_key)
      .filter(Boolean);
  }

  /**
   * Admin: Revert an unlock (restore Esencias to user)
   * Note: This is an admin function, should be gated by role
   */
  async revertUnlock(userId: string, unlockId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Get unlock details to know how much to refund
    const { data: unlock } = await client
      .from('unlock_rules')
      .select('required_esencias, feature_key')
      .eq('id', unlockId)
      .single();

    if (!unlock) {
      throw new NotFoundException('UNLOCK_NOT_FOUND');
    }

    // Mark as inactive (soft delete)
    const { error: updateError } = await client
      .from('user_unlocks')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('unlock_id', unlockId);

    if (updateError) {
      this.logger.error(`Error reverting unlock: ${updateError.message}`);
      throw new BadRequestException('REVERT_FAILED');
    }

    // Refund Esencias (note: creates negative transaction in ledger)
    try {
      await this.esenciasService.addEsencias(
        userId,
        unlock.required_esencias,
        `refund_unlock_${unlock.feature_key}`,
      );
    } catch (error) {
      this.logger.error(`Error refunding Esencias: ${error}`);
      // Continue anyway - unlock is already reverted
    }
  }
}
