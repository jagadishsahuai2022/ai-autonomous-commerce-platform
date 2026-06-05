/**
 * Wallet Transaction Service
 *
 * Enterprise-grade transaction orchestration with:
 * - Idempotency keys to prevent duplicate processing
 * - Automatic refund on order failure
 * - Full audit trail for every state transition
 * - Replay mechanism for stuck workflows
 * - Observability events for dashboard
 */

export type TransactionState =
  | 'initiated'
  | 'debit_pending'
  | 'debited'
  | 'order_placed'
  | 'order_failed'
  | 'refund_pending'
  | 'refund_processing'
  | 'refunded'
  | 'completed'
  | 'stuck'
  | 'failed';

export interface WalletTransaction {
  id: string;
  idempotencyKey: string;
  userId: string;
  orderId?: string;
  amount: number;
  state: TransactionState;
  stateHistory: { state: TransactionState; timestamp: string; reason?: string }[];
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  failureReason?: string;
  refundAmount?: number;
  refundedAt?: string;
}

export interface AuditEntry {
  id: string;
  transactionId: string;
  userId: string;
  action: string;
  previousState?: TransactionState;
  newState: TransactionState;
  amount: number;
  timestamp: string;
  source: string;
  metadata?: Record<string, unknown>;
  suspicious: boolean;
  reason?: string;
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

const TRANSACTIONS_KEY = 'wallet_transactions';
const AUDIT_LOG_KEY = 'wallet_audit_log';
const IDEMPOTENCY_CACHE_KEY = 'wallet_idempotency_cache';

// ── Idempotency ───────────────────────────────────────────────────────────────

function generateIdempotencyKey(userId: string, orderId: string, amount: number): string {
  return `txn_${userId}_${orderId}_${amount}_${Math.floor(Date.now() / 60000)}`;
}

function getIdempotencyCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(IDEMPOTENCY_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setIdempotencyCache(key: string, transactionId: string): void {
  const cache = getIdempotencyCache();
  cache[key] = transactionId;
  // Prune entries older than 1 hour
  const keys = Object.keys(cache);
  if (keys.length > 1000) {
    const first500 = keys.slice(0, 500);
    first500.forEach((k) => delete cache[k]);
  }
  localStorage.setItem(IDEMPOTENCY_CACHE_KEY, JSON.stringify(cache));
}

function checkIdempotency(key: string): string | null {
  return getIdempotencyCache()[key] || null;
}

// ── Transaction Storage ───────────────────────────────────────────────────────

function getTransactions(): WalletTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTransactions(txns: WalletTransaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns.slice(0, 500)));
}

function findTransaction(id: string): WalletTransaction | undefined {
  return getTransactions().find((t) => t.id === id);
}

function updateTransaction(
  id: string,
  updates: Partial<WalletTransaction>
): WalletTransaction | null {
  const txns = getTransactions();
  const idx = txns.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  txns[idx] = { ...txns[idx], ...updates, updatedAt: new Date().toISOString() };
  saveTransactions(txns);
  return txns[idx];
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function getAuditLog(): AuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const log = getAuditLog();
  const auditEntry: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  log.unshift(auditEntry);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log.slice(0, 2000)));
  return auditEntry;
}

// ── State Machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  initiated: ['debit_pending', 'failed'],
  debit_pending: ['debited', 'failed', 'stuck'],
  debited: ['order_placed', 'order_failed', 'stuck'],
  order_placed: ['completed'],
  order_failed: ['refund_pending', 'stuck'],
  refund_pending: ['refund_processing', 'stuck'],
  refund_processing: ['refunded', 'stuck'],
  refunded: ['completed'],
  completed: [],
  stuck: ['debit_pending', 'refund_pending', 'refund_processing', 'failed'],
  failed: [],
};

function canTransition(from: TransactionState, to: TransactionState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function transitionState(
  txn: WalletTransaction,
  newState: TransactionState,
  reason?: string
): WalletTransaction {
  if (!canTransition(txn.state, newState)) {
    throw new Error(`Invalid transition: ${txn.state} → ${newState}`);
  }
  const updated = updateTransaction(txn.id, {
    state: newState,
    stateHistory: [
      ...txn.stateHistory,
      { state: newState, timestamp: new Date().toISOString(), reason },
    ],
    failureReason: newState === 'failed' || newState === 'stuck' ? reason : txn.failureReason,
  });

  addAuditEntry({
    transactionId: txn.id,
    userId: txn.userId,
    action: `state_transition`,
    previousState: txn.state,
    newState,
    amount: txn.amount,
    source: 'wallet-transaction-service',
    suspicious: newState === 'stuck',
    reason,
  });

  return updated!;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initiate a wallet payment for an order.
 * Returns an existing transaction if idempotency key matches.
 */
export function initiateWalletPayment(
  userId: string,
  orderId: string,
  amount: number,
  metadata?: Record<string, unknown>
): WalletTransaction {
  const idempotencyKey = generateIdempotencyKey(userId, orderId, amount);
  const existing = checkIdempotency(idempotencyKey);
  if (existing) {
    const txn = findTransaction(existing);
    if (txn) return txn; // Idempotent — return existing
  }

  const txn: WalletTransaction = {
    id: `wtxn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey,
    userId,
    orderId,
    amount,
    state: 'initiated',
    stateHistory: [{ state: 'initiated', timestamp: new Date().toISOString() }],
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
  };

  const txns = getTransactions();
  txns.unshift(txn);
  saveTransactions(txns);
  setIdempotencyCache(idempotencyKey, txn.id);

  addAuditEntry({
    transactionId: txn.id,
    userId,
    action: 'payment_initiated',
    newState: 'initiated',
    amount,
    source: 'wallet-transaction-service',
    suspicious: false,
    metadata: { orderId, ...metadata },
  });

  return txn;
}

/**
 * Process wallet debit via API.
 * Automatically transitions through states.
 */
export async function processWalletDebit(
  transactionId: string,
  token: string
): Promise<WalletTransaction> {
  let txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');

  // Move to debit_pending
  if (txn.state === 'initiated' || txn.state === 'stuck') {
    txn = transitionState(txn, 'debit_pending', 'Calling wallet API');
  }

  try {
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: 'debit',
        amount: txn.amount,
        description: `Order payment: ${txn.orderId}`,
        orderId: txn.orderId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      txn = transitionState(txn, 'failed', err.error || 'Debit API failed');
      throw new Error(err.error || 'Debit failed');
    }

    txn = transitionState(txn, 'debited', 'Wallet debited successfully');
    return txn;
  } catch (err: any) {
    if (txn.state === 'debit_pending') {
      txn = transitionState(txn, 'stuck', `Debit failed: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Mark order as placed successfully after wallet debit
 */
export function markOrderPlaced(transactionId: string): WalletTransaction {
  const txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');
  return transitionState(txn, 'order_placed', 'Order created successfully');
}

/**
 * Mark order failed & trigger automatic refund
 */
export function markOrderFailed(transactionId: string, reason: string): WalletTransaction {
  let txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');

  txn = transitionState(txn, 'order_failed', reason);
  // Immediately initiate refund
  txn = transitionState(txn, 'refund_pending', 'Auto-refund initiated on order failure');
  updateTransaction(txn.id, { refundAmount: txn.amount });
  return txn;
}

/**
 * Process refund back to wallet via API
 */
export async function processRefund(
  transactionId: string,
  token: string
): Promise<WalletTransaction> {
  let txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');

  if (txn.state === 'refund_pending' || txn.state === 'stuck') {
    txn = transitionState(
      txn.state === 'stuck'
        ? ({
            ...txn,
            state: 'refund_pending' as TransactionState,
            stateHistory: [
              ...txn.stateHistory,
              {
                state: 'refund_pending' as TransactionState,
                timestamp: new Date().toISOString(),
                reason: 'Replay from stuck',
              },
            ],
          } as any)
        : txn,
      'refund_processing',
      'Processing refund'
    );
  }

  try {
    const refundAmount = txn.refundAmount || txn.amount;
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: 'add_funds',
        amount: refundAmount,
        description: `Refund for order ${txn.orderId}: ${txn.failureReason || 'Order failed'}`,
      }),
    });

    if (!res.ok) {
      txn = transitionState(txn, 'stuck', 'Refund API failed');
      throw new Error('Refund failed');
    }

    txn = transitionState(txn, 'refunded', 'Amount refunded to wallet');
    updateTransaction(txn.id, { refundedAt: new Date().toISOString() });
    txn = transitionState(txn, 'completed', 'Transaction completed with refund');
    return txn;
  } catch (err: any) {
    if (txn.state !== 'stuck') {
      txn = transitionState(txn, 'stuck', `Refund failed: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Mark a completed (successful) order
 */
export function markCompleted(transactionId: string): WalletTransaction {
  const txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');
  return transitionState(txn, 'completed', 'Order completed successfully');
}

/**
 * Replay a stuck transaction — attempts to resume from where it got stuck
 */
export async function replayStuckTransaction(
  transactionId: string,
  token: string
): Promise<WalletTransaction> {
  let txn = findTransaction(transactionId);
  if (!txn) throw new Error('Transaction not found');
  if (txn.state !== 'stuck') throw new Error('Transaction is not stuck');

  txn = updateTransaction(txn.id, { retryCount: txn.retryCount + 1 })!;

  if (txn.retryCount > txn.maxRetries) {
    txn = transitionState(txn, 'failed', `Max retries (${txn.maxRetries}) exceeded`);
    return txn;
  }

  // Determine replay action based on state history
  const lastNonStuckState = [...txn.stateHistory].reverse().find((s) => s.state !== 'stuck')?.state;

  addAuditEntry({
    transactionId: txn.id,
    userId: txn.userId,
    action: 'replay_attempt',
    newState: txn.state,
    amount: txn.amount,
    source: 'wallet-transaction-service',
    suspicious: true,
    reason: `Replay #${txn.retryCount} from stuck state (last: ${lastNonStuckState})`,
  });

  if (lastNonStuckState === 'debit_pending' || lastNonStuckState === 'initiated') {
    return processWalletDebit(transactionId, token);
  }

  if (
    lastNonStuckState === 'order_failed' ||
    lastNonStuckState === 'refund_pending' ||
    lastNonStuckState === 'refund_processing'
  ) {
    return processRefund(transactionId, token);
  }

  throw new Error(`Cannot replay from state: ${lastNonStuckState}`);
}

// ── Query Functions ───────────────────────────────────────────────────────────

export function getStuckTransactions(): WalletTransaction[] {
  return getTransactions().filter((t) => t.state === 'stuck');
}

export function getRecentTransactions(limit = 50): WalletTransaction[] {
  return getTransactions().slice(0, limit);
}

export function getTransactionsByUser(userId: string): WalletTransaction[] {
  return getTransactions().filter((t) => t.userId === userId);
}

export function getTransactionById(id: string): WalletTransaction | undefined {
  return findTransaction(id);
}

export function getAuditLogEntries(limit = 100): AuditEntry[] {
  return getAuditLog().slice(0, limit);
}

export function getSuspiciousEntries(): AuditEntry[] {
  return getAuditLog().filter((e) => e.suspicious);
}

export function getTransactionStats() {
  const txns = getTransactions();
  const total = txns.length;
  const completed = txns.filter((t) => t.state === 'completed').length;
  const stuck = txns.filter((t) => t.state === 'stuck').length;
  const failed = txns.filter((t) => t.state === 'failed').length;
  const pendingRefunds = txns.filter(
    (t) => t.state === 'refund_pending' || t.state === 'refund_processing'
  ).length;
  const totalRefunded = txns
    .filter((t) => t.refundedAt)
    .reduce((s, t) => s + (t.refundAmount || 0), 0);
  const totalDebited = txns
    .filter((t) => ['debited', 'order_placed', 'completed'].includes(t.state))
    .reduce((s, t) => s + t.amount, 0);

  return { total, completed, stuck, failed, pendingRefunds, totalRefunded, totalDebited };
}

// ── Seed Demo Data (if empty) ─────────────────────────────────────────────────

const SEED_KEY = 'wallet_demo_seeded';

export function captureUserActivity(page: string, action: string = 'page_view', userId: string = 'current-user'): void {
  if (typeof window === 'undefined') return;
  addAuditEntry({
    transactionId: `nav_${Date.now()}`,
    userId,
    action: `USER_ACTIVITY_${action.toUpperCase()}`,
    newState: 'completed' as TransactionState,
    amount: 0,
    source: page,
    suspicious: false,
    reason: `User visited ${page}`,
  });
}

export function seedDemoDataIfEmpty(): void {
  if (typeof window === 'undefined') return;
  let txns = getTransactions();
  // Re-seed if all transactions are older than 24h (stale data)
  if (localStorage.getItem(SEED_KEY) && txns.length > 0) {
    const newest = txns.reduce((max, t) => t.updatedAt > max ? t.updatedAt : max, txns[0].updatedAt);
    const ageHours = (Date.now() - new Date(newest).getTime()) / 3600_000;
    if (ageHours > 24) {
      localStorage.removeItem(SEED_KEY);
      localStorage.removeItem(TRANSACTIONS_KEY);
      localStorage.removeItem(AUDIT_LOG_KEY);
      localStorage.removeItem(IDEMPOTENCY_CACHE_KEY);
      txns = []; // Reset so we fall through to re-seed
    } else {
      return;
    }
  }
  if (localStorage.getItem(SEED_KEY)) return;
  if (txns.length > 0) { localStorage.setItem(SEED_KEY, '1'); return; }

  const now = Date.now();
  const h = (hours: number) => new Date(now - hours * 3600_000).toISOString();

  const demoTxns: WalletTransaction[] = [
    { id: 'txn_001', idempotencyKey: 'ik_001', userId: 'user_1', orderId: 'DC-2024-001', amount: 27900, state: 'completed', stateHistory: [{ state: 'initiated', timestamp: h(72) }, { state: 'debit_pending', timestamp: h(71.9) }, { state: 'debited', timestamp: h(71.8) }, { state: 'order_placed', timestamp: h(71.5) }, { state: 'completed', timestamp: h(48) }], retryCount: 0, maxRetries: 3, createdAt: h(72), updatedAt: h(48) },
    { id: 'txn_002', idempotencyKey: 'ik_002', userId: 'user_1', orderId: 'DC-2024-002', amount: 10999, state: 'order_placed', stateHistory: [{ state: 'initiated', timestamp: h(24) }, { state: 'debit_pending', timestamp: h(23.9) }, { state: 'debited', timestamp: h(23.8) }, { state: 'order_placed', timestamp: h(23.5) }], retryCount: 0, maxRetries: 3, createdAt: h(24), updatedAt: h(23.5) },
    { id: 'txn_003', idempotencyKey: 'ik_003', userId: 'user_2', orderId: 'DC-2024-003', amount: 45999, state: 'stuck', stateHistory: [{ state: 'initiated', timestamp: h(6) }, { state: 'debit_pending', timestamp: h(5.9) }, { state: 'debited', timestamp: h(5.8) }, { state: 'stuck', timestamp: h(4), reason: 'Order service timeout after 3 retries' }], retryCount: 3, maxRetries: 3, createdAt: h(6), updatedAt: h(4), failureReason: 'Order service timeout after 3 retries' },
    { id: 'txn_004', idempotencyKey: 'ik_004', userId: 'user_3', orderId: 'DC-2024-004', amount: 3499, state: 'refunded', stateHistory: [{ state: 'initiated', timestamp: h(48) }, { state: 'debited', timestamp: h(47.8) }, { state: 'order_failed', timestamp: h(47), reason: 'Item out of stock' }, { state: 'refund_pending', timestamp: h(46) }, { state: 'refund_processing', timestamp: h(45) }, { state: 'refunded', timestamp: h(44) }], retryCount: 0, maxRetries: 3, createdAt: h(48), updatedAt: h(44), refundAmount: 3499, refundedAt: h(44), failureReason: 'Item out of stock' },
    { id: 'txn_005', idempotencyKey: 'ik_005', userId: 'user_1', orderId: 'DC-2024-005', amount: 15999, state: 'failed', stateHistory: [{ state: 'initiated', timestamp: h(2) }, { state: 'debit_pending', timestamp: h(1.9) }, { state: 'failed', timestamp: h(1.5), reason: 'Insufficient wallet balance' }], retryCount: 0, maxRetries: 3, createdAt: h(2), updatedAt: h(1.5), failureReason: 'Insufficient wallet balance' },
    { id: 'txn_006', idempotencyKey: 'ik_006', userId: 'user_4', orderId: 'DC-2024-006', amount: 89999, state: 'debited', stateHistory: [{ state: 'initiated', timestamp: h(1) }, { state: 'debit_pending', timestamp: h(0.9) }, { state: 'debited', timestamp: h(0.8) }], retryCount: 0, maxRetries: 3, createdAt: h(1), updatedAt: h(0.8) },
    { id: 'txn_007', idempotencyKey: 'ik_007', userId: 'user_2', orderId: 'DC-2024-007', amount: 7599, state: 'refund_pending', stateHistory: [{ state: 'initiated', timestamp: h(12) }, { state: 'debited', timestamp: h(11.8) }, { state: 'order_failed', timestamp: h(10), reason: 'Payment gateway rejected' }, { state: 'refund_pending', timestamp: h(9) }], retryCount: 1, maxRetries: 3, createdAt: h(12), updatedAt: h(9), failureReason: 'Payment gateway rejected' },
    { id: 'txn_008', idempotencyKey: 'ik_008', userId: 'user_5', orderId: 'DC-2024-008', amount: 1299, state: 'completed', stateHistory: [{ state: 'initiated', timestamp: h(96) }, { state: 'debited', timestamp: h(95.8) }, { state: 'order_placed', timestamp: h(95) }, { state: 'completed', timestamp: h(72) }], retryCount: 0, maxRetries: 3, createdAt: h(96), updatedAt: h(72) },
    { id: 'txn_009', idempotencyKey: 'ik_009', userId: 'user_1', orderId: 'DC-2024-009', amount: 34500, state: 'stuck', stateHistory: [{ state: 'initiated', timestamp: h(3) }, { state: 'debit_pending', timestamp: h(2.9) }, { state: 'debited', timestamp: h(2.8) }, { state: 'stuck', timestamp: h(1.5), reason: 'Inventory lock expired — manual review needed' }], retryCount: 2, maxRetries: 3, createdAt: h(3), updatedAt: h(1.5), failureReason: 'Inventory lock expired — manual review needed' },
    { id: 'txn_010', idempotencyKey: 'ik_010', userId: 'user_3', orderId: 'DC-2024-010', amount: 5999, state: 'completed', stateHistory: [{ state: 'initiated', timestamp: h(120) }, { state: 'debited', timestamp: h(119.8) }, { state: 'order_placed', timestamp: h(119) }, { state: 'completed', timestamp: h(96) }], retryCount: 0, maxRetries: 3, createdAt: h(120), updatedAt: h(96) },
  ];

  const demoAudit: AuditEntry[] = demoTxns.flatMap(txn =>
    txn.stateHistory.map((sh, i) => ({
      id: `audit_${txn.id}_${i}`,
      transactionId: txn.id,
      userId: txn.userId,
      action: i === 0 ? 'TRANSACTION_CREATED' : `STATE_CHANGE_${sh.state.toUpperCase()}`,
      previousState: i > 0 ? txn.stateHistory[i - 1].state : undefined,
      newState: sh.state,
      amount: txn.amount,
      timestamp: sh.timestamp,
      source: 'wallet-service',
      suspicious: sh.state === 'stuck' || (sh.state === 'failed' && txn.retryCount >= 2),
      reason: sh.reason,
    }))
  );

  saveTransactions(demoTxns);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(demoAudit));
  localStorage.setItem(SEED_KEY, '1');
}
