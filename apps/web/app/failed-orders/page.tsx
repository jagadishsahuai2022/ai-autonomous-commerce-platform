'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, XCircle, Clock, CreditCard, WifiOff, Package, RefreshCw,
  Loader2, ChevronDown, CheckCircle, IndianRupee, ShieldAlert, ArrowLeft,
  PieChart, TrendingDown, Wallet, ArrowRight, RotateCcw, AlertOctagon,
  BarChart3, FileText, Ban, X,
} from 'lucide-react';
import Link from 'next/link';

// --- Types ---

interface FailedOrder {
  id: number;
  failureType: string;
  failureReason: string;
  failureDetails: Record<string, any> | null;
  items: Array<{ name: string; quantity: number; price?: number }> | null;
  totalAmount: number | null;
  retryable: boolean;
  resolvedAt: string | null;
  refundStatus: 'none' | 'initiated' | 'processing' | 'completed';
  refundAmount: number | null;
  paymentDeducted: boolean;
  createdAt: string;
}

// --- Config ---

const FAILURE_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  product_unavailable: { icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Product Unavailable' },
  payment_failed: { icon: CreditCard, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Payment Failed' },
  insufficient_balance: { icon: IndianRupee, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Insufficient Balance' },
  network_error: { icon: WifiOff, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Network Error' },
  card_inactive: { icon: ShieldAlert, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Card Inactive' },
  budget_exceeded: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Budget Exceeded' },
  address_missing: { icon: AlertTriangle, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Address Missing' },
  stock_changed: { icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Stock Changed' },
  price_changed: { icon: IndianRupee, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Price Changed' },
  timeout: { icon: Clock, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-700', label: 'Timeout' },
  unknown: { icon: XCircle, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-700', label: 'Unknown Error' },
};

const REFUND_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  none: { label: 'No Refund', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
  initiated: { label: 'Refund Initiated', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  processing: { label: 'Refund Processing', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: 'Refund Complete', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30' },
};

// --- Utilities ---

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function mapFailureCode(code: string): string {
  const map: Record<string, string> = {
    NO_MATCHING_PRODUCT: 'product_unavailable',
    ORDER_BUDGET_EXCEEDED: 'budget_exceeded',
    MONTHLY_BUDGET_EXCEEDED: 'budget_exceeded',
    PAYMENT_FAILURE: 'payment_failed',
    NETWORK_ERROR: 'network_error',
    PAYMENT_PARTNER_DOWN: 'payment_failed',
  };
  return map[code] || 'unknown';
}

// --- Infographic Card ---

function InfoCard({ icon: Icon, label, value, color, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; sub?: string }) {
  const bg = color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30' : color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700';
  const ic = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-500';
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${ic}`} /></div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// --- Main Page ---

export default function FailedOrdersPage() {
  const [failures, setFailures] = useState<FailedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'refund_pending' | 'resolved'>('all');

  useEffect(() => {
    const loadFailures = async () => {
      let localFailures: FailedOrder[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
        localFailures = stored.map((f: any, idx: number) => {
          const isPaymentDeducted = f.failureCode === 'PAYMENT_FAILURE' || f.failureCode === 'NETWORK_ERROR' || f.failureCode === 'PAYMENT_PARTNER_DOWN';
          return {
            id: idx + 10000,
            failureType: mapFailureCode(f.failureCode),
            failureReason: f.failureReason || f.error || 'Unknown failure',
            failureDetails: { items: f.items, failureCode: f.failureCode },
            items: (f.items || []).map((it: any) => ({
              name: it.productName || it.name,
              quantity: it.quantity || 1,
              price: it.budget ? parseInt(it.budget) : undefined,
            })),
            totalAmount: null,
            retryable: f.failureCode !== 'NO_MATCHING_PRODUCT',
            resolvedAt: null,
            refundStatus: isPaymentDeducted ? 'initiated' : 'none' as any,
            refundAmount: isPaymentDeducted && f.items?.[0]?.budget ? parseInt(f.items[0].budget) : null,
            paymentDeducted: isPaymentDeducted,
            createdAt: f.timestamp || new Date().toISOString(),
          };
        });
      } catch { }

      const token = localStorage.getItem('authToken');
      let apiFailures: FailedOrder[] = [];
      if (token) {
        try {
          const res = await fetch('/api/checkout-failures', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            apiFailures = (data.failures || []).map((f: any) => ({
              ...f,
              refundStatus: f.refundStatus || 'none',
              refundAmount: f.refundAmount || null,
              paymentDeducted: f.paymentDeducted || false,
            }));
          }
        } catch { }
      }

      const combined = [...apiFailures, ...localFailures].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFailures(combined);
      setLoading(false);
    };
    loadFailures();
  }, []);

  // --- Derived data ---

  const totalLostAmount = useMemo(() => failures.reduce((s, f) => s + (f.totalAmount || 0), 0), [failures]);
  const refundPending = useMemo(() => failures.filter(f => f.paymentDeducted && f.refundStatus !== 'completed'), [failures]);
  const totalRefundAmount = useMemo(() => failures.filter(f => f.refundStatus === 'completed').reduce((s, f) => s + (f.refundAmount || 0), 0), [failures]);

  const failureTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    failures.forEach(f => { counts[f.failureType] = (counts[f.failureType] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [failures]);

  const filteredFailures = useMemo(() => {
    if (filter === 'refund_pending') return failures.filter(f => f.paymentDeducted && f.refundStatus !== 'completed');
    if (filter === 'resolved') return failures.filter(f => f.resolvedAt);
    return failures;
  }, [failures, filter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50/30 dark:from-slate-900 dark:to-red-950/20">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50/30 dark:from-slate-900 dark:to-red-950/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl text-white shadow-lg shadow-red-500/20">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Failed Orders</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Track failed checkouts, refund status & retry orders</p>
            </div>
          </div>
        </motion.div>

        {/* Infographic Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <InfoCard icon={AlertTriangle} label="Total Failures" value={String(failures.length)} color="red" sub={`${refundPending.length} refund pending`} />
          <InfoCard icon={IndianRupee} label="Amount at Risk" value={totalLostAmount > 0 ? formatCurrency(totalLostAmount) : 'None'} color="amber" sub="From failed transactions" />
          <InfoCard icon={RotateCcw} label="Refunded" value={totalRefundAmount > 0 ? formatCurrency(totalRefundAmount) : 'None'} color="green" sub="Successfully refunded" />
          <InfoCard icon={Clock} label="Avg. Refund Time" value="24-48 hrs" color="blue" sub="For deducted payments" />
        </div>

        {/* Failure Type Breakdown */}
        {failureTypeBreakdown.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" /> Failure Breakdown
            </h3>
            <div className="space-y-2">
              {failureTypeBreakdown.map(([type, count]) => {
                const config = FAILURE_TYPE_CONFIG[type] || FAILURE_TYPE_CONFIG.unknown;
                const Icon = config.icon;
                const pct = Math.round((count / failures.length) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${config.bgColor}`}><Icon className={`w-3.5 h-3.5 ${config.color}`} /></div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-32 truncate">{config.label}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white w-8 text-right">{count}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Refund Notice */}
        {refundPending.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
            <Wallet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                {refundPending.length} refund{refundPending.length > 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Amounts deducted for failed orders will be automatically refunded to your wallet within 48 hours.
                You will receive email, WhatsApp, and SMS notifications once processed.
              </p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
          {([
            { id: 'all' as const, label: `All (${failures.length})` },
            { id: 'refund_pending' as const, label: `Refund Pending (${refundPending.length})` },
            { id: 'resolved' as const, label: `Resolved (${failures.filter(f => f.resolvedAt).length})` },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === id ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Failure List */}
        {filteredFailures.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              {filter === 'all' ? 'No Failed Orders' : filter === 'refund_pending' ? 'No Pending Refunds' : 'No Resolved Orders'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {filter === 'all' ? 'All your orders have been processed successfully.' : 'Great news! Nothing to show here.'}
            </p>
            <Link href="/shopping-list" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-block">
              Go to Shopping List
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredFailures.map((failure, idx) => {
              const config = FAILURE_TYPE_CONFIG[failure.failureType] || FAILURE_TYPE_CONFIG.unknown;
              const Icon = config.icon;
              const isExpanded = expandedId === failure.id;
              const refundInfo = REFUND_STATUS_LABELS[failure.refundStatus] || REFUND_STATUS_LABELS.none;

              return (
                <motion.div key={failure.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden transition-colors ${failure.resolvedAt ? 'border-green-200 dark:border-green-800' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                  <button onClick={() => setExpandedId(isExpanded ? null : failure.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{config.label}</span>
                        {failure.resolvedAt && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-2.5 h-2.5" /> Resolved
                          </span>
                        )}
                        {failure.paymentDeducted && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${refundInfo.bg} ${refundInfo.color}`}>
                            <RotateCcw className="w-2.5 h-2.5" /> {refundInfo.label}
                          </span>
                        )}
                        {!failure.resolvedAt && failure.retryable && !failure.paymentDeducted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <RefreshCw className="w-2.5 h-2.5" /> Retryable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{failure.failureReason}</p>
                    </div>
                    <div className="text-right mr-2">
                      {failure.totalAmount && (
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(failure.totalAmount)}</p>
                      )}
                      <p className="text-xs text-slate-400">{formatDate(failure.createdAt)}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                          {/* Failure reason */}
                          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Failure Details</p>
                            <p className="text-xs text-red-700 dark:text-red-300">{failure.failureReason}</p>
                          </div>

                          {/* Refund tracking */}
                          {failure.paymentDeducted && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Refund Status</p>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${refundInfo.bg} ${refundInfo.color}`}>{refundInfo.label}</span>
                                {failure.refundAmount && <span className="text-xs text-blue-700 dark:text-blue-300">Amount: {formatCurrency(failure.refundAmount)}</span>}
                              </div>
                              {failure.refundStatus !== 'completed' && (
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5">
                                  Refund will be credited to your wallet within 48 hours. You will be notified via email, WhatsApp, and SMS.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Items */}
                          {failure.items && failure.items.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Items Affected</p>
                              <div className="space-y-1">
                                {failure.items.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                                    <span>{item.name} x{item.quantity}</span>
                                    {item.price && <span className="font-medium">{formatCurrency(item.price)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            {failure.retryable && !failure.resolvedAt && (
                              <Link href="/shopping-list" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3" /> Retry from Shopping List
                              </Link>
                            )}
                            <Link href="/wallet" className="px-4 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                              <Wallet className="w-3 h-3" /> View Wallet
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
