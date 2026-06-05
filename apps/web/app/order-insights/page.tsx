'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, ArrowLeft, Brain, Sparkles, BarChart3, Clock,
  ShoppingBag, CreditCard, RefreshCw, Zap, Sun, Moon,
  TrendingUp, Target, User,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number | string;
  orderNumber: string;
  total: number;
  status: string;
  aiAssisted: boolean;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function safeRender(fn: () => React.ReactNode, fallback?: React.ReactNode): React.ReactNode {
  try {
    return fn();
  } catch {
    return fallback ?? null;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function OrderInsightsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Please sign in to view insights');
      setIsLoading(false);
      return;
    }

    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => {
        const fetched: Order[] = (Array.isArray(data.orders) ? data.orders : []).map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id,
          total: Number(o.total) || 0,
          status: o.status || 'processing',
          aiAssisted: Boolean(o.aiAssisted),
          paymentMethod: o.paymentMethod || 'upi',
          createdAt: o.createdAt || new Date().toISOString(),
          items: Array.isArray(o.items)
            ? o.items.map((i: any) => ({
                productName: i.productName || i.name || 'Product',
                quantity: i.quantity || 1,
                price: Number(i.price) || 0,
              }))
            : [],
        }));
        if (fetched.length === 0) {
          loadLocal();
        } else {
          setOrders(fetched);
        }
      })
      .catch(() => loadLocal())
      .finally(() => setIsLoading(false));

    function loadLocal() {
      try {
        const local = JSON.parse(localStorage.getItem('orders') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          setOrders(
            local.map((o: any) => ({
              id: o.id,
              orderNumber: o.id,
              total: Number(o.total) || 0,
              status: o.status || 'processing',
              aiAssisted: Boolean(o.aiAssisted),
              paymentMethod: o.paymentMethod || 'upi',
              createdAt: o.createdAt || o.date || new Date().toISOString(),
              items: Array.isArray(o.items)
                ? o.items.map((i: any) => ({
                    productName: i.name || i.productName || 'Product',
                    quantity: i.quantity || i.qty || 1,
                    price: Number(i.price) || 0,
                  }))
                : [],
            }))
          );
        }
      } catch {}
    }
  }, []);

  // ── Derived analytics ──
  const analytics = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'cancelled');
    const totalSpent = active.reduce((s, o) => s + o.total, 0);
    const avgOrderValue = active.length > 0 ? totalSpent / active.length : 0;

    // AOV over time (by order index)
    const aovPoints: number[] = [];
    let runningTotal = 0;
    active.forEach((o, idx) => {
      runningTotal += o.total;
      aovPoints.push(runningTotal / (idx + 1));
    });

    // Status distribution
    const statusDist: Record<string, number> = {};
    orders.forEach((o) => {
      statusDist[o.status] = (statusDist[o.status] || 0) + 1;
    });

    // Payment breakdown
    const paymentDist: Record<string, number> = {};
    active.forEach((o) => {
      const method = o.paymentMethod || 'other';
      paymentDist[method] = (paymentDist[method] || 0) + 1;
    });

    // Peak hours
    const hourCounts: number[] = Array(24).fill(0);
    active.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      hourCounts[h]++;
    });
    const maxHourCount = Math.max(...hourCounts, 1);

    // Frequency (orders per timeline dot)
    const orderDates = active.map((o) => new Date(o.createdAt).getTime()).sort((a, b) => a - b);

    // Frequently bought items
    const itemFreqs: Record<string, { count: number; totalSpent: number }> = {};
    active.forEach((o) => {
      o.items.forEach((i) => {
        const key = i.productName;
        if (!itemFreqs[key]) itemFreqs[key] = { count: 0, totalSpent: 0 };
        itemFreqs[key].count += i.quantity;
        itemFreqs[key].totalSpent += i.price * i.quantity;
      });
    });
    const topItems = Object.entries(itemFreqs)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4);

    // Shopping personality
    let personality = 'Smart Shopper';
    let personalityDesc = 'You make well-researched purchasing decisions.';
    const aiRatio = active.filter((o) => o.aiAssisted).length / Math.max(active.length, 1);
    if (aiRatio > 0.7) {
      personality = 'AI Power User';
      personalityDesc = 'You leverage AI for most purchases — maximum savings!';
    } else if (avgOrderValue > 10000) {
      personality = 'Premium Buyer';
      personalityDesc = 'You prefer quality over quantity — investing in the best.';
    } else if (active.length > 10) {
      personality = 'Frequent Shopper';
      personalityDesc = 'You shop regularly and love discovering new products.';
    } else if (aiRatio > 0.3) {
      personality = 'Strategic Buyer';
      personalityDesc = 'You balance personal picks with AI recommendations.';
    }

    return {
      active,
      totalSpent,
      avgOrderValue,
      aovPoints,
      statusDist,
      paymentDist,
      hourCounts,
      maxHourCount,
      orderDates,
      topItems,
      personality,
      personalityDesc,
    };
  }, [orders]);

  // ── Status colors for donut ──
  const STATUS_DONUT_COLORS: Record<string, string> = {
    processing: '#f59e0b',
    confirmed: '#3b82f6',
    shipped: '#6366f1',
    delivered: '#22c55e',
    cancelled: '#ef4444',
    failed: '#ef4444',
    pending: '#eab308',
  };

  // ── Loading ──
  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );

  // ── Error ──
  if (error)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <Link href="/account">
            <Button>Back to Account</Button>
          </Link>
        </div>
      </div>
    );

  // ── Empty ──
  if (orders.length === 0)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <Brain className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No insights yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Place orders to unlock your analytics dashboard</p>
          <Link href="/products">
            <Button>Start Shopping</Button>
          </Link>
        </div>
      </div>
    );

  const {
    active,
    totalSpent,
    avgOrderValue,
    aovPoints,
    statusDist,
    paymentDist,
    hourCounts,
    maxHourCount,
    orderDates,
    topItems,
    personality,
    personalityDesc,
  } = analytics;

  // Donut chart segments
  const statusEntries = Object.entries(statusDist);
  const totalOrders = orders.length;
  let cumulativePercent = 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none bg-gradient-to-b from-blue-500/30 via-violet-500/20 to-transparent" />

      <div className="relative max-w-6xl mx-auto py-8 px-4 sm:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            href="/account"
            className="text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 flex items-center mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Account
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            Order Intelligence Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered insights from {orders.length} orders
          </p>
        </motion.div>

        {/* ── Shopping Personality Card ── */}
        {safeRender(() => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
              <div className="relative flex items-center gap-5 flex-wrap">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Your Shopping Personality</p>
                  <h2 className="text-2xl font-bold mt-0.5">You&apos;re a {personality}!</h2>
                  <p className="text-white/80 text-sm mt-1">{personalityDesc}</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                    <p className="text-xl font-bold">{active.length}</p>
                    <p className="text-xs text-white/70">Orders</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                    <p className="text-xl font-bold">{formatCurrency(avgOrderValue)}</p>
                    <p className="text-xs text-white/70">Avg. Order</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ── AOV Sparkline ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Average Order Value Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aovPoints.length > 1 ? (
                    <svg viewBox="0 0 400 100" className="w-full h-24" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="aovGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(139,92,246)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="rgb(139,92,246)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const maxAov = Math.max(...aovPoints, 1);
                        const pts = aovPoints.map(
                          (v, idx) =>
                            (10 + (idx / Math.max(aovPoints.length - 1, 1)) * 380) +
                            ',' +
                            (90 - (v / maxAov) * 80)
                        );
                        return (
                          <>
                            <path
                              d={
                                'M ' + pts.join(' L ') +
                                ' L ' + (10 + ((aovPoints.length - 1) / Math.max(aovPoints.length - 1, 1)) * 380) +
                                ',90 L 10,90 Z'
                              }
                              fill="url(#aovGrad)"
                            />
                            <polyline
                              points={pts.join(' ')}
                              fill="none"
                              stroke="rgb(139,92,246)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {aovPoints.map((v, idx) => (
                              <circle
                                key={idx}
                                cx={10 + (idx / Math.max(aovPoints.length - 1, 1)) * 380}
                                cy={90 - (v / maxAov) * 80}
                                r="3"
                                fill="rgb(139,92,246)"
                                stroke="white"
                                strokeWidth="1.5"
                              />
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">Need more orders for trend</p>
                  )}
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Current AOV: <span className="font-bold text-violet-700 dark:text-violet-400">{formatCurrency(avgOrderValue)}</span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* ── Status Distribution Donut ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    {/* CSS Donut */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {(() => {
                          let offset = 0;
                          return statusEntries.map(([status, count]) => {
                            const pct = (count / totalOrders) * 100;
                            const dashArray = pct + ' ' + (100 - pct);
                            const el = (
                              <circle
                                key={status}
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke={STATUS_DONUT_COLORS[status] || '#9ca3af'}
                                strokeWidth="4"
                                strokeDasharray={dashArray}
                                strokeDashoffset={-offset}
                                className="transition-all duration-700"
                              />
                            );
                            offset += pct;
                            return el;
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{totalOrders}</p>
                          <p className="text-[10px] text-gray-400">orders</p>
                        </div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 space-y-1.5">
                      {statusEntries.map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_DONUT_COLORS[status] || '#9ca3af' }}
                          />
                          <span className="capitalize text-gray-700 dark:text-gray-300 flex-1">{status}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ── Order Frequency Timeline ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Clock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Order Frequency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orderDates.length > 0 ? (
                    <div className="relative">
                      <svg viewBox="0 0 400 60" className="w-full h-16">
                        {/* Timeline line */}
                        <line x1="10" y1="30" x2="390" y2="30" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="1" />
                        {/* Dots */}
                        {(() => {
                          const minTs = Math.min(...orderDates);
                          const maxTs = Math.max(...orderDates);
                          const range = maxTs - minTs || 1;
                          return orderDates.map((ts, idx) => {
                            const x = 10 + ((ts - minTs) / range) * 380;
                            return (
                              <motion.circle
                                key={idx}
                                cx={x}
                                cy="30"
                                r="5"
                                fill="rgb(139,92,246)"
                                stroke="white"
                                strokeWidth="2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3 + idx * 0.05 }}
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-2">
                        <span>{new Date(Math.min(...orderDates)).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>
                        <span>{new Date(Math.max(...orderDates)).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-4 text-sm">No data</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* ── Payment Method Breakdown ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <CreditCard className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Payment Methods
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(paymentDist)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, count], idx) => {
                      const pct = Math.round((count / active.length) * 100);
                      const colors = [
                        'from-violet-500 to-purple-500',
                        'from-blue-500 to-cyan-500',
                        'from-green-500 to-emerald-500',
                        'from-orange-500 to-amber-500',
                      ];
                      return (
                        <div key={method}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-gray-700 dark:text-gray-300">{method}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: pct + '%' }}
                              transition={{ duration: 0.8, delay: 0.4 + idx * 0.1 }}
                              className={'h-full rounded-full bg-gradient-to-r ' + colors[idx % colors.length]}
                            />
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Peak Shopping Hours Heatmap ── */}
        {safeRender(() => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Sun className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  Peak Shopping Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {hourCounts.map((count, hour) => {
                    const heightPct = (count / maxHourCount) * 100;
                    const isHighlight = count === maxHourCount && count > 0;
                    return (
                      <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: Math.max(heightPct, 2) + '%' }}
                          transition={{ duration: 0.5, delay: hour * 0.02 }}
                          className={
                            'w-full rounded-t-sm min-h-[2px] ' +
                            (isHighlight
                              ? 'bg-gradient-to-t from-violet-600 to-violet-400'
                              : count > 0
                              ? 'bg-gradient-to-t from-violet-300 to-violet-200 dark:from-violet-700 dark:to-violet-600'
                              : 'bg-gray-100 dark:bg-gray-800')
                          }
                          title={hour + ':00 — ' + count + ' orders'}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1 mt-1">
                  {hourCounts.map((_, hour) => (
                    <div key={hour} className="flex-1 text-center">
                      {hour % 6 === 0 && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">
                          {hour === 0 ? '12a' : hour === 6 ? '6a' : hour === 12 ? '12p' : '6p'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* ── Reorder Probability Cards ── */}
        {safeRender(() => {
          if (topItems.length === 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                Reorder Probability
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {topItems.map(([name, data], idx) => {
                  const prob = Math.min(95, 40 + data.count * 12);
                  const gradients = [
                    'from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800/50',
                    'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800/50',
                    'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800/50',
                    'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800/50',
                  ];
                  return (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + idx * 0.08 }}
                    >
                      <Card className={'bg-gradient-to-br border shadow-md hover:shadow-lg transition-shadow ' + gradients[idx % gradients.length]}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                            <Badge variant="secondary" className="text-[10px]">AI Prediction</Badge>
                          </div>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 mb-1">{name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Ordered {data.count}x · {formatCurrency(data.totalSpent)} spent
                          </p>
                          {/* Probability bar */}
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: prob + '%' }}
                              transition={{ duration: 1, delay: 0.6 + idx * 0.1 }}
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-green-500"
                            />
                          </div>
                          <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mt-1">{prob}% likely to reorder</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
