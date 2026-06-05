'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, Send, Loader2, CheckCircle, AlertCircle, X, Zap,
  ListChecks, Clock, IndianRupee, Package, ArrowRight, ShoppingCart, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { notifyOrderSuccess, notifyOrderFailed } from '@/lib/notifications';

const PAYMENT_METHODS = [
  { value: '', label: 'Use Profile Default' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'emi', label: 'EMI' },
];

interface AiShoppingList {
  id: number; rawText: string; parsedItems: Array<{ name: string; quantity: number; raw: string }> | null;
  deliveryDays: number | null; paymentMethod: string | null; totalBudget: number | null;
  status: string; results: any; orderId: number | null; errorMessage: string | null; createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AiPlusPage() {
  const [rawText, setRawText] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null); // tracks auto-checkout result
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<AiShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiPlus, setIsAiPlus] = useState<boolean | null>(null);
  const [autoCheckoutLimit, setAutoCheckoutLimit] = useState(10000);
  const [hasShoppingActivity, setHasShoppingActivity] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : '';

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (userEmail) h['x-user-email'] = userEmail.toLowerCase();
    return h;
  };

  // Check prior shopping activity on mount (gate validation chip visibility)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('shoppingListResults') || '[]');
      if (Array.isArray(saved) && saved.length > 0) setHasShoppingActivity(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { setLoading(false); setIsAiPlus(false); return; }
      // Check subscription
      try {
        const profileRes = await fetch('/api/user/profile', { headers: authHeaders() });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setIsAiPlus(profile.subscriptionPlan === 'AI_PLUS');
          setAutoCheckoutLimit(profile.autoPurchaseThreshold || 10000);
        } else {
          setIsAiPlus(false);
        }
      } catch { setIsAiPlus(false); }

      // Load existing lists
      try {
        const res = await fetch('/api/ai-shopping-list', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setLists(data.lists || []);
        }
      } catch { }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!rawText.trim()) { setError('Please enter your shopping list'); return; }
    setSubmitting(true);
    setError(null);
    setLastOrderId(null);
    try {
      const res = await fetch('/api/ai-shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          rawText: rawText.trim(),
          deliveryDays: deliveryDays ? parseInt(deliveryDays) : undefined,
          paymentMethod: 'wallet',
          totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
          // AI+ always attempts auto-checkout — that is its primary purpose.
          // Root cause fix: without this flag, auto-checkout was silently skipped
          // because demo users don't have autoPurchaseEnabled=true in the DB.
          autoCheckout: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSuccessMsg(data.message || 'Shopping list submitted to AI!');
      // Track auto-checkout outcome for the success banner action link
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        setLastOrderId(data.autoCheckout.orderId);
      } else {
        setLastOrderId(null);
      }
      setRawText('');
      setDeliveryDays('');
      setPaymentMethod('');
      setTotalBudget('');
      if (data.list) setLists(prev => [{ ...data.list, parsedItems: data.list.parsedItems }, ...prev]);

      // Save results to localStorage for Smart Delegate page
      if (data.results) {
        try {
          const sessionEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
          const sessionName = sessionEmail ? sessionEmail.split('@')[0] : 'You';
          let existing: any[] = [];
          try { existing = JSON.parse(localStorage.getItem('shoppingListResults') || '[]'); } catch { existing = []; }
          existing.unshift({
            id: data.list?.id ? `ai-plus-${data.list.id}` : `ai-plus-${Date.now()}`,
            submittedAt: new Date().toISOString(),
            results: data.results,
            summary: data.summary || { totalItems: data.list?.parsedItems?.length || 0, totalMatches: 0, estimatedSavings: '' },
            whatsappSent: false,
            emailSent: false,
            fromCache: false,
            userEmail: sessionEmail,
            userName: sessionName,
          });
          localStorage.setItem('shoppingListResults', JSON.stringify(existing.slice(0, 20)));

          // Persist to DB for RBAC-aware cross-user analytics (AI+ page)
          const aiQueryText = rawText.trim().slice(0, 200) || (data.list?.parsedItems?.map((i: any) => i.name).join(', ') || 'AI+ shopping list');
          const aiNormalizedProducts = (data.results || []).flatMap((r: any) =>
            (r.matches || []).map((m: any, idx: number) => ({
              rank: idx + 1,
              product: {
                id: m.id || `aiplus-${Date.now()}-${idx}`,
                name: m.name || m.productName || 'Unknown Product',
                brand: m.brand || 'Unknown',
                price: typeof m.price === 'number' ? m.price : 0,
                original_price: m.original_price || m.price || 0,
                rating: typeof m.rating === 'number' ? m.rating : 0,
                review_count: typeof m.review_count === 'number' ? m.review_count : 0,
                delivery_time: m.delivery_time || '3-5 days',
                key_features: Array.isArray(m.key_features) ? m.key_features : [],
                category: m.category || r.productName || 'General',
                image_url: m.image_url || null,
                discount_percent: m.discount_percent || 0,
              },
              score: typeof m.score === 'number' ? m.score : (typeof m.aiScore === 'number' ? m.aiScore / 100 : 0.5),
              confidence: typeof m.confidence === 'number' ? m.confidence : 0.8,
              explanation: m.explanation || { budget_fit_score: { score: 0.5, reason: 'AI+ auto processed' } },
            }))
          );
          import('@/lib/search-session').then(({ saveSearchSession }) => {
            saveSearchSession({
              userExternalId: localStorage.getItem('dc-user-id') || 'anonymous',
              userEmail: sessionEmail || undefined,
              queryText: aiQueryText,
              sessionSource: 'ai-plus',
              productsJson: aiNormalizedProducts,
              metricsJson: data.summary ?? {},
            });
          }).catch(() => {/* silent */ });
        } catch { /* ignore */ }
      }

      // If auto-checkout succeeded, also save to orders localStorage
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        try {
          const orderItems = (data.results || []).map((r: any) => {
            const best = r.matches?.[0];
            return {
              id: Math.floor(Math.random() * 100000),
              name: best?.name || r.productName,
              productName: best?.name || r.productName,
              price: best?.price || 0,
              quantity: r.quantity || 1,
            };
          });
          const orderTotal = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
          const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
          existingOrders.unshift({
            id: data.autoCheckout.orderId,
            orderNumber: data.autoCheckout.orderId,
            total: orderTotal,
            status: 'confirmed',
            aiAssisted: true,
            paymentMethod: paymentMethod || 'auto',
            createdAt: new Date().toISOString(),
            items: orderItems,
          });
          localStorage.setItem('orders', JSON.stringify(existingOrders.slice(0, 50)));
          // Send order success notifications (email, WhatsApp, SMS)
          notifyOrderSuccess(data.autoCheckout.orderId, orderTotal, orderItems.map((i: any) => i.name));
        } catch { /* ignore */ }
      }

      // If auto-checkout failed, record in failed checkouts
      if (data.autoCheckout && !data.autoCheckout.success) {
        try {
          const failedCheckouts = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
          failedCheckouts.unshift({
            id: `fail-aiplus-${Date.now()}`,
            timestamp: new Date().toISOString(),
            items: data.list?.parsedItems || [],
            failureCode: data.autoCheckout.failureCode || 'UNKNOWN',
            failureReason: data.autoCheckout.error || 'Auto-checkout failed',
            error: data.autoCheckout.error,
          });
          localStorage.setItem('failedCheckouts', JSON.stringify(failedCheckouts.slice(0, 50)));
          // Send order failure notifications (email, WhatsApp, SMS)
          notifyOrderFailed(`fail-aiplus-${Date.now()}`, data.autoCheckout.failureCode || 'UNKNOWN', data.autoCheckout.error || 'Auto-checkout failed');
        } catch { /* ignore */ }
      }

      setTimeout(() => { setSuccessMsg(null); setLastOrderId(null); }, 8000);
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!token || isAiPlus === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950">
        <div className="text-center max-w-md">
          <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl inline-block mb-4 shadow-lg shadow-indigo-500/20">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">AI+ Exclusive Feature</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Upgrade to AI Plus to unlock the intelligent shopping list. Simply type what you need and let AI handle everything.
          </p>
          <Link href="/profile" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all inline-block">
            Upgrade to AI Plus
          </Link>
          <div className="mt-3">
            {hasShoppingActivity && (
              <Link href="/shopping-assistant/metrics/validation?from=ai-plus" data-testid="validation-chip-ai-plus-locked" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors border border-violet-200 dark:border-violet-800">
                <ShieldCheck className="w-3 h-3" /> Validation
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    processing: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    completed: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    failed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-purple-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                AI+ Shopping <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full font-semibold">PREMIUM</span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Type everything you need. AI handles the rest.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/smart-delegate" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3 h-3" /> Smart Delegate
            </Link>
            {(hasShoppingActivity || lists.length > 0) && (
              <Link href="/shopping-assistant/metrics/validation?from=ai-plus" data-testid="validation-chip-ai-plus" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors border border-violet-200 dark:border-violet-800">
                <ShieldCheck className="w-3 h-3" /> Validation
              </Link>
            )}
          </div>
        </motion.div>

        {/* Banners */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{successMsg}</p>
                <div className="flex gap-3 mt-1">
                  {/* Use lastOrderId state (not string-match) to reliably choose the CTA */}
                  {lastOrderId ? (
                    <Link href="/orders" className="text-xs underline text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100">View Orders →</Link>
                  ) : (
                    <Link href="/smart-delegate" className="text-xs underline text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100">View in Smart Delegate →</Link>
                  )}
                </div>
              </div>
              <button onClick={() => { setSuccessMsg(null); setLastOrderId(null); }}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Input Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-indigo-600/5 overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What do you need?</h2>
            </div>
            <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={6}
              placeholder={`Type your entire shopping list here. Examples:\n\n2x Samsung Galaxy Watch 6\n1 Wireless Noise Cancelling Headphones under 5000\n3 packs of Organic Green Tea\nApple MacBook Air M3 in Silver\nReplacement filter for Aquaguard RO`}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 transition-colors placeholder:text-slate-400" />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
              <Brain className="w-3 h-3" /> AI will parse items, quantities, preferences & search across all vendors
            </p>
          </div>

          {/* Optional Inputs */}
          <div className="px-6 pb-6 grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Delivery (days)
              </label>
              <input type="number" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)}
                placeholder="Profile default" min={1} max={30}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" /> Payment Method
                <span className="text-[10px] text-indigo-600 whitespace-nowrap">(Wallet only for AI auto-checkout)</span>
              </label>
              <select value="wallet" disabled
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none opacity-60 cursor-not-allowed">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Total Budget
              </label>
              <input type="number" value={totalBudget} onChange={e => setTotalBudget(e.target.value)}
                placeholder={`Max ₹${autoCheckoutLimit.toLocaleString('en-IN')}`}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          {/* Submit */}
          <div className="px-6 pb-6">
            <button onClick={handleSubmit} disabled={submitting || !rawText.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-indigo-400 disabled:to-purple-400 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 transition-all">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {submitting ? 'AI is processing...' : 'Submit to AI Agent'}
            </button>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" /> How AI+ Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Type Everything', desc: 'Enter all items in natural language', icon: ListChecks },
              { step: '2', title: 'AI Parses', desc: 'AI understands items, quantities & preferences', icon: Brain },
              { step: '3', title: 'Smart Search', desc: 'Searches across vendors for best deals', icon: ShoppingCart },
              { step: '4', title: 'Auto Checkout', desc: 'Places order within your budget', icon: Zap },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-2">
                  <s.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{s.title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Previous Lists */}
        {lists.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Previous AI Shopping Lists
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {lists.map(list => (
                <div key={list.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 dark:text-white font-medium truncate">{list.rawText.slice(0, 80)}{list.rawText.length > 80 ? '...' : ''}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDate(list.createdAt)} · {list.parsedItems?.length || 0} items parsed
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[list.status] || statusColor.pending}`}>
                        {list.status}
                      </span>
                      {list.orderId && (
                        <Link href={`/orders`} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          Order <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {list.errorMessage && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {list.errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
