import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface BalanceInfo {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

interface TransactionRecord {
  id: string;
  fromUserId: string | null;
  toUserId: string;
  amount: number;
  reason: string;
  message?: string;
  type: 'grant' | 'transfer' | 'deduction';
  createdAt: string;
}

@Injectable()
export class EsenciasService {
  private readonly logger = new Logger(EsenciasService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get user's current Esencias balance and stats
   */
  async getBalance(userId: string): Promise<BalanceInfo> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_balance')
      .select('esencias_balance, total_earned, total_spent')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      this.logger.error(`Error fetching balance for ${userId}: ${error?.message}`);
      throw new NotFoundException('USER_BALANCE_NOT_FOUND');
    }

    return {
      balance: data.esencias_balance,
      totalEarned: data.total_earned,
      totalSpent: data.total_spent,
    };
  }

  /**
   * Check if user has minimum required balance
   */
  async hasBalance(userId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getBalance(userId);
      return balance.balance >= requiredAmount;
    } catch {
      return false;
    }
  }

  /**
   * Add Esencias to user (system grant or reward)
   * Returns new balance
   */
  async addEsencias(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<number> {
    if (amount <= 0) {
      throw new BadRequestException('AMOUNT_MUST_BE_POSITIVE');
    }

    const client = this.supabaseService.getClient();

    // Verify user exists
    const { data: user } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    // Add transaction record
    const { error: txError } = await client
      .from('esencias_transactions')
      .insert({
        from_user_id: null, // System grant
        to_user_id: userId,
        amount,
        reason,
        type: 'grant',
      });

    if (txError) {
      this.logger.error(
        `Error recording transaction for ${userId}: ${txError.message}`,
      );
      throw new BadRequestException('TRANSACTION_FAILED');
    }

    // Update balance
    const { data: updated, error: updateError } = await client
      .from('user_balance')
      .update({
        esencias_balance: `esencias_balance + ${amount}`,
        total_earned: `total_earned + ${amount}`,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('esencias_balance')
      .single();

    if (updateError || !updated) {
      this.logger.error(
        `Error updating balance for ${userId}: ${updateError?.message}`,
      );
      throw new BadRequestException('BALANCE_UPDATE_FAILED');
    }

    return updated.esencias_balance;
  }

  /**
   * Transfer Esencias from one user to another
   * Returns new sender balance and transaction record
   */
  async transferEsencias(
    fromUserId: string,
    toUserId: string,
    amount: number,
    message?: string,
  ): Promise<{ newBalance: number; transaction: any }> {
    if (amount <= 0) {
      throw new BadRequestException('AMOUNT_MUST_BE_POSITIVE');
    }

    if (fromUserId === toUserId) {
      throw new BadRequestException('CANNOT_TRANSFER_TO_SELF');
    }

    const client = this.supabaseService.getClient();

    // Verify both users exist
    const { data: fromUser } = await client
      .from('users')
      .select('id')
      .eq('id', fromUserId)
      .single();

    if (!fromUser) {
      throw new NotFoundException('FROM_USER_NOT_FOUND');
    }

    const { data: toUser } = await client
      .from('users')
      .select('id')
      .eq('id', toUserId)
      .single();

    if (!toUser) {
      throw new NotFoundException('TO_USER_NOT_FOUND');
    }

    // Check sender has sufficient balance
    const senderBalance = await this.getBalance(fromUserId);
    if (senderBalance.balance < amount) {
      throw new BadRequestException('INSUFFICIENT_BALANCE');
    }

    // Record transaction
    const { data: transaction, error: txError } = await client
      .from('esencias_transactions')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        reason: 'user_transfer',
        message,
        type: 'transfer',
      })
      .select()
      .single();

    if (txError || !transaction) {
      this.logger.error(`Error recording transfer: ${txError?.message}`);
      throw new BadRequestException('TRANSFER_FAILED');
    }

    // Deduct from sender
    const { error: deductError } = await client
      .from('user_balance')
      .update({
        esencias_balance: `esencias_balance - ${amount}`,
        total_spent: `total_spent + ${amount}`,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', fromUserId);

    if (deductError) {
      this.logger.error(`Error deducting balance: ${deductError.message}`);
      throw new BadRequestException('TRANSFER_DEDUCTION_FAILED');
    }

    // Add to receiver
    const { error: addError } = await client
      .from('user_balance')
      .update({
        esencias_balance: `esencias_balance + ${amount}`,
        total_earned: `total_earned + ${amount}`,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', toUserId);

    if (addError) {
      this.logger.error(`Error adding balance: ${addError.message}`);
      throw new BadRequestException('TRANSFER_ADDITION_FAILED');
    }

    const updatedBalance = senderBalance.balance - amount;

    return {
      newBalance: updatedBalance,
      transaction: {
        id: transaction.id,
        fromUserId: transaction.from_user_id,
        toUserId: transaction.to_user_id,
        amount: transaction.amount,
        message: transaction.message,
        createdAt: transaction.created_at,
      },
    };
  }

  /**
   * Get transaction history for a user
   * Pagination: limit 50, offset-based
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ transactions: TransactionRecord[]; total: number }> {
    if (limit <= 0 || limit > 100) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    if (offset < 0) {
      throw new BadRequestException('INVALID_OFFSET');
    }

    const client = this.supabaseService.getClient();

    // Get count (as recipient)
    const { count } = await client
      .from('esencias_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId);

    // Fetch transactions
    const { data, error } = await client
      .from('esencias_transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(
        `Error fetching transactions: ${error.message}`,
      );
      throw new BadRequestException('FETCH_FAILED');
    }

    const transactions = (data || []).map((tx: any) => ({
      id: tx.id,
      fromUserId: tx.from_user_id,
      toUserId: tx.to_user_id,
      amount: tx.amount,
      reason: tx.reason,
      message: tx.message,
      type: tx.type,
      createdAt: tx.created_at,
    }));

    return {
      transactions,
      total: count || 0,
    };
  }

  /**
   * Get transfers received from other users (not system grants)
   */
  async getReceivedTransfers(
    userId: string,
    limit: number = 20,
  ): Promise<TransactionRecord[]> {
    if (limit <= 0 || limit > 100) {
      throw new BadRequestException('INVALID_LIMIT');
    }

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('esencias_transactions')
      .select('*')
      .eq('to_user_id', userId)
      .eq('type', 'transfer')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(
        `Error fetching transfers: ${error.message}`,
      );
      throw new BadRequestException('FETCH_FAILED');
    }

    return (data || []).map((tx: any) => ({
      id: tx.id,
      fromUserId: tx.from_user_id,
      toUserId: tx.to_user_id,
      amount: tx.amount,
      reason: tx.reason,
      message: tx.message,
      type: tx.type,
      createdAt: tx.created_at,
    }));
  }

  /**
   * Internal: Deduct Esencias (for unlock feature)
   * Used by UnlockService
   */
  async deductEsencias(userId: string, amount: number, reason: string): Promise<number> {
    if (amount <= 0) {
      throw new BadRequestException('AMOUNT_MUST_BE_POSITIVE');
    }

    const client = this.supabaseService.getClient();

    // Check balance
    const balance = await this.getBalance(userId);
    if (balance.balance < amount) {
      throw new BadRequestException('INSUFFICIENT_BALANCE');
    }

    // Record transaction
    const { error: txError } = await client
      .from('esencias_transactions')
      .insert({
        from_user_id: null,
        to_user_id: userId,
        amount: -amount, // Negative for deduction
        reason,
        type: 'deduction',
      });

    if (txError) {
      this.logger.error(`Error recording deduction: ${txError.message}`);
      throw new BadRequestException('DEDUCTION_FAILED');
    }

    // Update balance
    const { data: updated, error: updateError } = await client
      .from('user_balance')
      .update({
        esencias_balance: `esencias_balance - ${amount}`,
        total_spent: `total_spent + ${amount}`,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('esencias_balance')
      .single();

    if (updateError || !updated) {
      this.logger.error(
        `Error updating balance: ${updateError?.message}`,
      );
      throw new BadRequestException('BALANCE_UPDATE_FAILED');
    }

    return updated.esencias_balance;
  }
}
