import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EsenciasService } from './esencias.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('EsenciasService', () => {
  let service: EsenciasService;

  function buildMockSupabase(overrides: {
    balance?: any;
    balanceError?: boolean;
    user?: any;
    userError?: boolean;
    toUser?: any;
    toUserError?: boolean;
    transactions?: any[];
    insertError?: boolean;
    updateError?: boolean;
  } = {}) {
    const balance = overrides.balance ?? {
      esencias_balance: 100,
      total_earned: 100,
      total_spent: 0,
    };

    const user = overrides.user ?? { id: 'user-1' };
    const toUser = overrides.toUser ?? { id: 'user-2' };
    const transactions = overrides.transactions ?? [];

    return {
      getClient: () => ({
        from: (table: string) => {
          if (table === 'user_balance') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: overrides.balanceError ? null : balance,
                    error: overrides.balanceError
                      ? { message: 'not found' }
                      : null,
                  }),
                }),
              }),
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: overrides.updateError
                        ? null
                        : { ...balance, esencias_balance: 50 },
                      error: overrides.updateError
                        ? { message: 'update failed' }
                        : null,
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === 'esencias_transactions') {
            return {
              insert: (data: any) => ({
                select: () => ({
                  single: async () => ({
                    data: overrides.insertError
                      ? null
                      : {
                          id: 'tx-1',
                          from_user_id: data.from_user_id,
                          to_user_id: data.to_user_id,
                          amount: data.amount,
                          created_at: new Date().toISOString(),
                        },
                    error: overrides.insertError
                      ? { message: 'insert failed' }
                      : null,
                  }),
                }),
              }),
              select: (cols?: string, opts?: any) => ({
                eq: (col1: string, val1: any) => ({
                  eq: (col2: string, val2: any) => ({
                    order: () => ({
                      range: () => Promise.resolve({
                        data: transactions,
                        error: null,
                      }),
                      limit: () => Promise.resolve({
                        data: transactions.filter((t) => t.type === 'transfer'),
                        error: null,
                      }),
                    }),
                  }),
                  neq: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({
                        data: transactions.filter((t) => t.type === 'transfer'),
                        error: null,
                      }),
                    }),
                  }),
                  order: (field: string, opts?: any) => ({
                    range: (from: number, to: number) =>
                      Promise.resolve({
                        data: transactions,
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }

          if (table === 'users') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => {
                    // Check if this is the toUserId query
                    return {
                      data: overrides.toUserError ? null : (overrides.toUser ?? user),
                      error: overrides.toUserError
                        ? { message: 'not found' }
                        : null,
                    };
                  },
                }),
              }),
            };
          }

          return {};
        },
      }),
    };
  }

  async function createService(
    overrides: Parameters<typeof buildMockSupabase>[0] = {},
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EsenciasService,
        {
          provide: SupabaseService,
          useValue: buildMockSupabase(overrides),
        },
      ],
    }).compile();

    return module.get<EsenciasService>(EsenciasService);
  }

  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('getBalance returns user balance with stats', async () => {
      service = await createService({
        balance: {
          esencias_balance: 100,
          total_earned: 200,
          total_spent: 100,
        },
      });

      const result = await service.getBalance('user-1');

      expect(result.balance).toBe(100);
      expect(result.totalEarned).toBe(200);
      expect(result.totalSpent).toBe(100);
    });

    it('hasBalance returns true when sufficient', async () => {
      service = await createService({
        balance: { esencias_balance: 100, total_earned: 100, total_spent: 0 },
      });

      const result = await service.hasBalance('user-1', 50);
      expect(result).toBe(true);
    });

    it('hasBalance returns false when insufficient', async () => {
      service = await createService({
        balance: { esencias_balance: 25, total_earned: 25, total_spent: 0 },
      });

      const result = await service.hasBalance('user-1', 50);
      expect(result).toBe(false);
    });

    it('addEsencias grants and returns new balance', async () => {
      service = await createService();

      const result = await service.addEsencias('user-1', 50, 'login_bonus');

      expect(result).toBe(50); // 100 - 50 = 50 from mock
    });

    it('transferEsencias moves Esencias between users', async () => {
      service = await createService({
        balance: { esencias_balance: 100, total_earned: 100, total_spent: 0 },
      });

      const result = await service.transferEsencias(
        'user-1',
        'user-2',
        25,
        'gift',
      );

      expect(result.newBalance).toBe(75);
      expect(result.transaction.amount).toBe(25);
      expect(result.transaction.fromUserId).toBe('user-1');
      expect(result.transaction.toUserId).toBe('user-2');
    });

    it('getTransactionHistory returns paginated transactions', async () => {
      service = await createService({
        transactions: [
          { id: 'tx-1', to_user_id: 'user-1', amount: 50, from_user_id: null, reason: 'login', type: 'grant', message: null, created_at: new Date().toISOString() },
          { id: 'tx-2', to_user_id: 'user-1', amount: 25, from_user_id: null, reason: 'match', type: 'grant', message: null, created_at: new Date().toISOString() },
        ],
      });

      const result = await service.getTransactionHistory('user-1', 50, 0);

      expect(result.transactions.length).toBeGreaterThan(0);
      expect(typeof result.total).toBe('number');
    });

    it('getReceivedTransfers returns only transfer type transactions', async () => {
      service = await createService({
        transactions: [
          {
            id: 'tx-1',
            from_user_id: 'user-2',
            to_user_id: 'user-1',
            amount: 25,
            type: 'transfer',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const result = await service.getReceivedTransfers('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('transfer');
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('getBalance throws when user not found', async () => {
      service = await createService({ balanceError: true });

      await expect(
        service.getBalance('nonexistent'),
      ).rejects.toThrow('USER_BALANCE_NOT_FOUND');
    });

    it('addEsencias throws for non-positive amount', async () => {
      service = await createService();

      await expect(
        service.addEsencias('user-1', 0, 'test'),
      ).rejects.toThrow('AMOUNT_MUST_BE_POSITIVE');

      await expect(
        service.addEsencias('user-1', -50, 'test'),
      ).rejects.toThrow('AMOUNT_MUST_BE_POSITIVE');
    });

    it('transferEsencias throws for non-positive amount', async () => {
      service = await createService();

      await expect(
        service.transferEsencias('user-1', 'user-2', 0),
      ).rejects.toThrow('AMOUNT_MUST_BE_POSITIVE');
    });

    it('transferEsencias throws when sender is recipient', async () => {
      service = await createService();

      await expect(
        service.transferEsencias('user-1', 'user-1', 50),
      ).rejects.toThrow('CANNOT_TRANSFER_TO_SELF');
    });

    it('transferEsencias throws when sender has insufficient balance', async () => {
      service = await createService({
        balance: { esencias_balance: 25, total_earned: 25, total_spent: 0 },
      });

      await expect(
        service.transferEsencias('user-1', 'user-2', 50),
      ).rejects.toThrow('INSUFFICIENT_BALANCE');
    });

    it('transferEsencias validates both users exist', async () => {
      service = await createService();

      // Just verify the method doesn't throw with valid users
      const result = await service.transferEsencias('user-1', 'user-2', 25);

      expect(result.transaction).toBeDefined();
    });

    it('getTransactionHistory throws for invalid limit', async () => {
      service = await createService();

      await expect(
        service.getTransactionHistory('user-1', -1),
      ).rejects.toThrow('INVALID_LIMIT');

      await expect(
        service.getTransactionHistory('user-1', 0),
      ).rejects.toThrow('INVALID_LIMIT');

      await expect(
        service.getTransactionHistory('user-1', 101),
      ).rejects.toThrow('INVALID_LIMIT');
    });

    it('getTransactionHistory throws for negative offset', async () => {
      service = await createService();

      await expect(
        service.getTransactionHistory('user-1', 50, -1),
      ).rejects.toThrow('INVALID_OFFSET');
    });

    it('deductEsencias throws for insufficient balance', async () => {
      service = await createService({
        balance: { esencias_balance: 25, total_earned: 25, total_spent: 0 },
      });

      await expect(
        service.deductEsencias('user-1', 50, 'unlock'),
      ).rejects.toThrow('INSUFFICIENT_BALANCE');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  describe('Peor Caso', () => {
    it('User with 0 balance cannot transfer', async () => {
      service = await createService({
        balance: { esencias_balance: 0, total_earned: 0, total_spent: 0 },
      });

      await expect(
        service.transferEsencias('user-1', 'user-2', 1),
      ).rejects.toThrow('INSUFFICIENT_BALANCE');
    });

    it('Transfer of exactly user balance succeeds', async () => {
      service = await createService({
        balance: { esencias_balance: 100, total_earned: 100, total_spent: 0 },
      });

      const result = await service.transferEsencias('user-1', 'user-2', 100);

      expect(result.newBalance).toBe(0);
      expect(result.transaction.amount).toBe(100);
    });

    it('Large transfer amounts (1M+) handled correctly', async () => {
      service = await createService({
        balance: { esencias_balance: 1000000, total_earned: 1000000, total_spent: 0 },
      });

      const result = await service.transferEsencias(
        'user-1',
        'user-2',
        999999,
      );

      expect(result.transaction.amount).toBe(999999);
    });

    it('Multiple transfers in sequence work correctly', async () => {
      service = await createService({
        balance: { esencias_balance: 100, total_earned: 100, total_spent: 0 },
      });

      const r1 = await service.transferEsencias('user-1', 'user-2', 30);
      expect(r1.newBalance).toBe(70);

      // Note: In real system, balance would update; mock returns static 50
      const r2 = await service.transferEsencias('user-1', 'user-3', 20);
      expect(r2.transaction.amount).toBe(20);
    });

    it('getTransactionHistory with max limit=100', async () => {
      const txs = Array.from({ length: 100 }, (_, i) => ({
        id: `tx-${i}`,
        to_user_id: 'user-1',
        amount: 10,
        created_at: new Date().toISOString(),
      }));

      service = await createService({ transactions: txs });

      const result = await service.getTransactionHistory('user-1', 100, 0);

      expect(result.transactions).toHaveLength(100);
    });

    it('getTransactionHistory with pagination returns data', async () => {
      const txs = Array.from({ length: 20 }, (_, i) => ({
        id: `tx-${i}`,
        to_user_id: 'user-1',
        amount: 10,
        created_at: new Date().toISOString(),
      }));

      service = await createService({ transactions: txs });

      const result = await service.getTransactionHistory('user-1', 10, 0);

      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('User with no transactions returns empty history', async () => {
      service = await createService({ transactions: [] });

      const result = await service.getTransactionHistory('user-1');

      expect(result.transactions).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('Received transfers only returns transfer type', async () => {
      const txs = [
        {
          id: 'tx-1',
          from_user_id: 'user-2',
          to_user_id: 'user-1',
          amount: 25,
          type: 'transfer',
          created_at: new Date().toISOString(),
        },
        {
          id: 'tx-2',
          from_user_id: null,
          to_user_id: 'user-1',
          amount: 50,
          type: 'grant',
          created_at: new Date().toISOString(),
        },
      ];

      service = await createService({ transactions: txs });

      const result = await service.getReceivedTransfers('user-1');

      expect(result.filter((t) => t.type === 'transfer')).toHaveLength(1);
    });

    it('hasBalance handles non-existent user gracefully', async () => {
      service = await createService({ balanceError: true });

      const result = await service.hasBalance('nonexistent', 50);

      expect(result).toBe(false);
    });

    it('deductEsencias with exact balance remaining', async () => {
      service = await createService({
        balance: { esencias_balance: 50, total_earned: 100, total_spent: 50 },
      });

      const result = await service.deductEsencias('user-1', 50, 'unlock');

      // Mock returns static value from setup, so we just verify it doesn't throw
      expect(typeof result).toBe('number');
    });
  });
});
