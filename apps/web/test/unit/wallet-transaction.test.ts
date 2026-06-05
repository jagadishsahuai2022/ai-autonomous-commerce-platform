/**
 * Unit Tests — Wallet & Transaction Logic
 * Covers: balance arithmetic, transaction history, refund eligibility,
 *         top-up validation, deduction guard, currency formatting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
type TxType = 'credit' | 'debit' | 'refund' | 'top_up';
type TxStatus = 'completed' | 'pending' | 'failed' | 'reversed';

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  description: string;
  createdAt: Date;
  orderId?: string;
}

interface Wallet {
  balance: number;
  currency: 'INR';
  transactions: Transaction[];
}

// ── Wallet logic (mirrors apps/web wallet/page.tsx helpers) ──────────────────

function deductFromWallet(wallet: Wallet, amount: number, description: string, orderId?: string): { success: boolean; wallet?: Wallet; error?: string } {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };
  if (wallet.balance < amount) return { success: false, error: `Insufficient balance: ₹${wallet.balance} available` };

  const tx: Transaction = {
    id: `tx-${Date.now()}`,
    type: 'debit',
    amount,
    status: 'completed',
    description,
    createdAt: new Date(),
    orderId,
  };

  return {
    success: true,
    wallet: {
      ...wallet,
      balance: wallet.balance - amount,
      transactions: [tx, ...wallet.transactions],
    },
  };
}

function creditWallet(wallet: Wallet, amount: number, description: string, type: TxType = 'credit'): Wallet {
  const tx: Transaction = {
    id: `tx-${Date.now()}`,
    type,
    amount,
    status: 'completed',
    description,
    createdAt: new Date(),
  };
  return {
    ...wallet,
    balance: wallet.balance + amount,
    transactions: [tx, ...wallet.transactions],
  };
}

function isRefundEligible(tx: Transaction, refundWindowHours = 48): boolean {
  if (tx.type !== 'debit') return false;
  if (tx.status !== 'completed') return false;
  const ageHours = (Date.now() - tx.createdAt.getTime()) / 3_600_000;
  return ageHours <= refundWindowHours;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function getTransactionSummary(wallet: Wallet): { totalCredit: number; totalDebit: number; totalRefund: number; netFlow: number } {
  const completed = wallet.transactions.filter(t => t.status === 'completed');
  const totalCredit = completed.filter(t => t.type === 'credit' || t.type === 'top_up').reduce((s, t) => s + t.amount, 0);
  const totalDebit = completed.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const totalRefund = completed.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0);
  return { totalCredit, totalDebit, totalRefund, netFlow: totalCredit + totalRefund - totalDebit };
}

function validateTopUp(amount: string): { valid: boolean; error?: string } {
  const val = parseFloat(amount);
  if (!amount || isNaN(val)) return { valid: false, error: 'Enter a valid amount' };
  if (val < 100) return { valid: false, error: 'Minimum top-up is ₹100' };
  if (val > 100_000) return { valid: false, error: 'Maximum top-up is ₹1,00,000' };
  if (val % 1 !== 0) return { valid: false, error: 'Amount must be a whole number' };
  return { valid: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyWallet(balance = 5000): Wallet {
  return { balance, currency: 'INR', transactions: [] };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'debit',
    amount: 500,
    status: 'completed',
    description: 'Order #DC-001',
    createdAt: new Date(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// DEDUCT
// ════════════════════════════════════════════════════════════════════════════
describe('deductFromWallet', () => {
  it('deducts amount from balance', () => {
    const wallet = emptyWallet(2000);
    const result = deductFromWallet(wallet, 500, 'Test deduction');
    expect(result.success).toBe(true);
    expect(result.wallet!.balance).toBe(1500);
  });

  it('adds debit transaction to history', () => {
    const wallet = emptyWallet(2000);
    const result = deductFromWallet(wallet, 500, 'Test');
    expect(result.wallet!.transactions[0].type).toBe('debit');
    expect(result.wallet!.transactions[0].amount).toBe(500);
  });

  it('fails when balance insufficient', () => {
    const result = deductFromWallet(emptyWallet(100), 500, 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient/i);
  });

  it('fails for zero amount', () => {
    const result = deductFromWallet(emptyWallet(1000), 0, 'Test');
    expect(result.success).toBe(false);
  });

  it('fails for negative amount', () => {
    const result = deductFromWallet(emptyWallet(1000), -100, 'Test');
    expect(result.success).toBe(false);
  });

  it('allows exact-balance deduction', () => {
    const result = deductFromWallet(emptyWallet(1000), 1000, 'Test');
    expect(result.success).toBe(true);
    expect(result.wallet!.balance).toBe(0);
  });

  it('stores orderId in transaction', () => {
    const result = deductFromWallet(emptyWallet(1000), 500, 'Order', 'DC-2025-001');
    expect(result.wallet!.transactions[0].orderId).toBe('DC-2025-001');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CREDIT
// ════════════════════════════════════════════════════════════════════════════
describe('creditWallet', () => {
  it('adds amount to balance', () => {
    const wallet = emptyWallet(1000);
    const result = creditWallet(wallet, 500, 'Cashback');
    expect(result.balance).toBe(1500);
  });

  it('adds credit transaction to history', () => {
    const result = creditWallet(emptyWallet(0), 1000, 'Top-up', 'top_up');
    expect(result.transactions[0].type).toBe('top_up');
    expect(result.transactions[0].amount).toBe(1000);
  });

  it('prepends to transaction list (most recent first)', () => {
    let wallet = emptyWallet(1000);
    wallet = creditWallet(wallet, 100, 'First');
    wallet = creditWallet(wallet, 200, 'Second');
    expect(wallet.transactions[0].description).toBe('Second');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REFUND ELIGIBILITY
// ════════════════════════════════════════════════════════════════════════════
describe('isRefundEligible', () => {
  it('recent completed debit is eligible', () => {
    const tx = makeTx({ createdAt: new Date(Date.now() - 3_600_000) }); // 1h ago
    expect(isRefundEligible(tx)).toBe(true);
  });

  it('old debit (>48h) is not eligible', () => {
    const tx = makeTx({ createdAt: new Date(Date.now() - 50 * 3_600_000) });
    expect(isRefundEligible(tx)).toBe(false);
  });

  it('credit transaction is not refundable', () => {
    expect(isRefundEligible(makeTx({ type: 'credit' }))).toBe(false);
  });

  it('pending transaction is not refundable', () => {
    expect(isRefundEligible(makeTx({ status: 'pending' }))).toBe(false);
  });

  it('failed transaction is not refundable', () => {
    expect(isRefundEligible(makeTx({ status: 'failed' }))).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TRANSACTION SUMMARY
// ════════════════════════════════════════════════════════════════════════════
describe('getTransactionSummary', () => {
  it('sums credits and debits correctly', () => {
    let wallet = emptyWallet(0);
    wallet = creditWallet(wallet, 2000, 'Top-up', 'top_up');
    const deductResult = deductFromWallet(wallet, 500, 'Purchase');
    wallet = deductResult.wallet!;

    const summary = getTransactionSummary(wallet);
    expect(summary.totalCredit).toBe(2000);
    expect(summary.totalDebit).toBe(500);
    expect(summary.netFlow).toBe(1500);
  });

  it('empty wallet returns zeros', () => {
    const s = getTransactionSummary(emptyWallet(0));
    expect(s.totalCredit).toBe(0);
    expect(s.totalDebit).toBe(0);
    expect(s.netFlow).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TOP-UP VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('validateTopUp', () => {
  it('accepts valid amounts', () => {
    expect(validateTopUp('1000').valid).toBe(true);
    expect(validateTopUp('100').valid).toBe(true);
    expect(validateTopUp('100000').valid).toBe(true);
  });

  it('rejects below minimum', () => {
    const r = validateTopUp('50');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/minimum/i);
  });

  it('rejects above maximum', () => {
    const r = validateTopUp('200000');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/maximum/i);
  });

  it('rejects non-numeric', () => {
    expect(validateTopUp('abc').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateTopUp('').valid).toBe(false);
  });

  it('rejects decimal amounts', () => {
    expect(validateTopUp('500.50').valid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CURRENCY FORMAT
// ════════════════════════════════════════════════════════════════════════════
describe('formatINR', () => {
  it('formats thousands with ₹ symbol', () => {
    const formatted = formatINR(1000);
    expect(formatted).toContain('₹');
    expect(formatted).toContain('1');
  });

  it('formats zero', () => {
    const formatted = formatINR(0);
    expect(formatted).toContain('₹');
  });

  it('formats large amounts', () => {
    const formatted = formatINR(100000);
    expect(formatted).toContain('₹');
  });
});
