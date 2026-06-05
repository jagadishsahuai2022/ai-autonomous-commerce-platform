'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, XCircle, Clock, CreditCard, Wifi, WifiOff, Package, RefreshCw,
  Loader2, ChevronDown, CheckCircle, IndianRupee, ShieldAlert, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface CheckoutFailure {
  id: number;
  failureType: string;
  failureReason: string;
  failureDetails: Record<string, any> | null;
  items: Array<{ name: string; quantity: number; price?: number }> | null;
  totalAmount: number | null;
  retryable: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

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

export default function CheckoutFailuresPage() {
  const [failures, setFailures] = useState<CheckoutFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const loadFailures = async () => {
      // Load from localStorage (auto-checkout failures)
      let localFailures: CheckoutFailure[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
        localFailures = stored.map((f: any, idx: number) => ({
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
          createdAt: f.timestamp || new Date().toISOString(),
        }));
      } catch { /* ignore */ }

      // Also try to load from API
      const token = localStorage.getItem('authToken');
      let apiFailures: CheckoutFailure[] = [];
      if (token) {
        try {
          const res = await fetch('/api/checkout-failures', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            apiFailures = data.failures || [];
          }
        } catch { }
      }

      // Merge: API failures first, then local-only failures
      const combined = [...apiFailures, ...localFailures].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFailures(combined);
      setLoading(false);
    };
    loadFailures();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50/30 dark:from-slate-900 dark:to-red-950/20 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/shopping-list" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Shopping List
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl text-white shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Failed Checkouts</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Track and resolve auto-checkout failures</p>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{failures.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Failures</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-bold text-amber-600">{failures.filter(f => f.retryable && !f.resolvedAt).length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Retryable</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-bold text-red-600">{failures.filter(f => !f.retryable && !f.resolvedAt).length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Needs Action</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-bold text-green-600">{failures.filter(f => f.resolvedAt).length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Resolved</p>
          </div>
        </div>

        {/* Failure List */}
        {failures.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No Failed Checkouts</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">All your auto-checkout orders have been processed successfully.</p>
            <Link href="/shopping-list" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-block">
              Go to Shopping List
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {failures.map((failure, idx) => {
              const config = FAILURE_TYPE_CONFIG[failure.failureType] || FAILURE_TYPE_CONFIG.unknown;
              const Icon = config.icon;
              const isExpanded = expandedId === failure.id;
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
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{config.label}</span>
                        {failure.resolvedAt && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-2.5 h-2.5" /> Resolved
                          </span>
                        )}
                        {!failure.resolvedAt && failure.retryable && (
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
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(failure.createdAt)}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
                            <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Failure Details</p>
                            <p className="text-xs text-red-700 dark:text-red-300">{failure.failureReason}</p>
                          </div>
                          {failure.items && failure.items.length > 0 && (
                            <div className="mb-3">
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
                          {failure.failureDetails && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <p className="font-medium mb-1">Technical Details</p>
                              <pre className="bg-slate-100 dark:bg-slate-700 rounded-lg p-2 overflow-x-auto text-[10px] font-mono">
                                {JSON.stringify(failure.failureDetails, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {failure.retryable && !failure.resolvedAt && (
                              <Link href="/shopping-list" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3" /> Retry from Shopping List
                              </Link>
                            )}
                            <Link href="/orders" className="px-4 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                              View Orders
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
