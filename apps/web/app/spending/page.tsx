'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, ArrowLeft, Sparkles, Flame, TrendingUp, TrendingDown,
  Calendar, Wallet, Target, Zap, IndianRupee,
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
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getWeekday(dateStr: string): number {
  return new Date(dateStr).getDay();
}

function safeRender(fn: () => React.ReactNode, fallback?: React.ReactNode): React.ReactNode {
  try {
    return fn();
  } catch {
    return fallback ?? null;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SpendingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Please sign in to view spending analytics');
      setIsLoading(false);
      return;
    }

    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        const fetched: Order[] = (Array.isArray(data.orders) ? data.orders : []).map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id,
          total: Number(o.total) || 0,
          status: o.status || 'processing',
          aiAssisted: Boolean(o.aiAssisted),
          notes: typeof o.notes === 'string' ? o.notes : undefined,
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
                  notes: typeof o.notes === 'string' ? o.notes : undefined,
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
              return;
            }
          } catch { }
        }
        setOrders(fetched);
      })
      .catch(() => {
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
                notes: typeof o.notes === 'string' ? o.notes : undefined,
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
          } else {
            setError('Unable to load orders');
          }
        } catch {
          setError('Unable to load orders');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Derived data ──
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalSpent = activeOrders.reduce((s, o) => s + o.total, 0);
  const aiOrders = activeOrders.filter((o) => o.aiAssisted);
  // Calculate real AI savings from notes JSON stored during auto-checkout.
  // For legacy orders (plain text notes), we report 0 — never fake a percentage.
  const aiSavings = aiOrders.reduce((s, o) => {
    if (!o.notes) return s;
    try {
      const parsed = JSON.parse(o.notes);
      return s + (typeof parsed.aiSavings === 'number' ? parsed.aiSavings : 0);
    } catch { return s; }
  }, 0);

  // Daily spend map
  const dailySpend: Record<string, number> = {};
  activeOrders.forEach((o) => {
    const key = getDayKey(o.createdAt);
    dailySpend[key] = (dailySpend[key] || 0) + o.total;
  });

  // Monthly trend
  const monthlySpend: Record<string, number> = {};
  activeOrders.forEach((o) => {
    const key = getMonthKey(o.createdAt);
    monthlySpend[key] = (monthlySpend[key] || 0) + o.total;
  });
  const monthKeys = Object.keys(monthlySpend).sort();
  const monthValues = monthKeys.map((k) => monthlySpend[k]);
  const maxMonthly = Math.max(...monthValues, 1);

  // Category breakdown
  const categorySpend: Record<string, number> = {};
  activeOrders.forEach((o) => {
    o.items.forEach((item) => {
      const cat = item.productName.split(' ').slice(0, 2).join(' ');
      categorySpend[cat] = (categorySpend[cat] || 0) + item.price * item.quantity;
    });
  });
  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCatSpend = Math.max(...topCategories.map((c) => c[1]), 1);

  // Spending velocity
  const sortedDates = Object.keys(dailySpend).sort();
  const daySpan =
    sortedDates.length > 1
      ? Math.max(
        1,
        Math.ceil(
          (new Date(sortedDates[sortedDates.length - 1]).getTime() -
            new Date(sortedDates[0]).getTime()) /
          86400000
        )
      )
      : 1;
  const dailyAvg = totalSpent / daySpan;

  // Budget streak (simplified: days since last order > daily avg)
  const budgetTarget = dailyAvg;
  let streak = 0;
  const allDays = Object.keys(dailySpend).sort().reverse();
  for (const day of allDays) {
    if (dailySpend[day] <= budgetTarget * 1.5) {
      streak++;
    } else {
      break;
    }
  }

  // Heatmap data: last 12 weeks
  const heatmapWeeks: { date: string; spend: number }[][] = [];
  const today = new Date();
  for (let w = 11; w >= 0; w--) {
    const week: { date: string; spend: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - w * 7 - (6 - d));
      const key = date.toISOString().slice(0, 10);
      week.push({ date: key, spend: dailySpend[key] || 0 });
    }
    heatmapWeeks.push(week);
  }
  const maxDailySpend = Math.max(...Object.values(dailySpend), 1);

  function heatColor(spend: number): string {
    if (spend === 0) return 'bg-gray-100 dark:bg-gray-800';
    const ratio = spend / maxDailySpend;
    if (ratio < 0.25) return 'bg-green-200 dark:bg-green-900/60';
    if (ratio < 0.5) return 'bg-green-400 dark:bg-green-700/70';
    if (ratio < 0.75) return 'bg-violet-400 dark:bg-violet-700/70';
    return 'bg-violet-600 dark:bg-violet-500';
  }

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
          <Wallet className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No spending data</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Place your first order to see analytics</p>
          <Link href="/products">
            <Button>Start Shopping</Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Ambient bg */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-3xl opacity-30 pointer-events-none bg-gradient-to-b from-violet-500/30 via-purple-500/20 to-transparent" />

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
            <Wallet className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            Spending Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Deep insights into your shopping patterns
          </p>
        </motion.div>

        {/* ── Top Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              label: 'Total Spent',
              value: formatCurrency(totalSpent),
              icon: IndianRupee,
              gradient: 'from-violet-500 to-purple-600',
            },
            {
              label: 'Daily Average',
              value: formatCurrency(dailyAvg),
              icon: TrendingUp,
              gradient: 'from-blue-500 to-cyan-600',
            },
            {
              label: 'AI Savings',
              value: formatCurrency(aiSavings),
              icon: Sparkles,
              gradient: 'from-green-500 to-emerald-600',
            },
            {
              label: 'Budget Streak',
              value: streak + ' days',
              icon: Flame,
              gradient: 'from-orange-500 to-red-500',
            },
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.06 }}
              >
                <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-4">
                    <div className={'w-10 h-10 rounded-xl bg-gradient-to-br ' + card.gradient + ' flex items-center justify-center mb-3 shadow-sm'}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Spending Velocity ── */}
        {safeRender(() => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-center gap-4 flex-wrap">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Zap className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-white/70 text-sm">Spending Velocity</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(dailyAvg)} per day
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Across {activeOrders.length} orders over {daySpan} days
                  </p>
                </div>
                {streak > 0 && (
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-5 h-5 text-orange-300" />
                      <span className="text-xl font-bold">{streak}</span>
                    </div>
                    <p className="text-xs text-white/70">day streak under budget</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ── Spending Heat Map ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Spending Heat Map
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last 12 weeks</p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1">
                    <div className="flex flex-col gap-1 text-[10px] text-gray-400 dark:text-gray-500 pr-1 pt-0">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                        <div key={d + idx} className="h-3.5 flex items-center">{d}</div>
                      ))}
                    </div>
                    {heatmapWeeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-1">
                        {week.map((day) => (
                          <div
                            key={day.date}
                            title={day.date + ': ' + formatCurrency(day.spend)}
                            className={'w-3.5 h-3.5 rounded-sm cursor-default transition-colors ' + heatColor(day.spend)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>Less</span>
                    <div className="flex gap-0.5">
                      {['bg-gray-100 dark:bg-gray-800', 'bg-green-200 dark:bg-green-900/60', 'bg-green-400 dark:bg-green-700/70', 'bg-violet-400 dark:bg-violet-700/70', 'bg-violet-600 dark:bg-violet-500'].map((c) => (
                        <div key={c} className={'w-3 h-3 rounded-sm ' + c} />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* ── Category Breakdown ── */}
          {safeRender(() => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topCategories.map(([cat, spend], idx) => {
                    const pct = Math.round((spend / maxCatSpend) * 100);
                    const colors = [
                      'from-violet-500 to-purple-500',
                      'from-blue-500 to-cyan-500',
                      'from-green-500 to-emerald-500',
                      'from-orange-500 to-amber-500',
                      'from-pink-500 to-rose-500',
                      'from-indigo-500 to-blue-500',
                    ];
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{cat}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(spend)}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: pct + '%' }}
                            transition={{ duration: 0.8, delay: 0.4 + idx * 0.08 }}
                            className={'h-full rounded-full bg-gradient-to-r ' + colors[idx % colors.length]}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {topCategories.length === 0 && (
                    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No category data</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Monthly Trend (SVG line chart) ── */}
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
                  <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  Monthly Spending Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthKeys.length > 0 ? (
                  <div className="relative">
                    <svg viewBox="0 0 600 200" className="w-full h-48" preserveAspectRatio="none">
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                        <line
                          key={ratio}
                          x1="40"
                          y1={180 - ratio * 160}
                          x2="580"
                          y2={180 - ratio * 160}
                          stroke="currentColor"
                          className="text-gray-200 dark:text-gray-800"
                          strokeWidth="0.5"
                        />
                      ))}

                      {/* Gradient fill */}
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Fill area */}
                      {monthKeys.length > 1 && (
                        <path
                          d={
                            'M ' +
                            monthKeys
                              .map(
                                (_, idx) =>
                                  (40 + (idx / Math.max(monthKeys.length - 1, 1)) * 540) +
                                  ' ' +
                                  (180 - (monthValues[idx] / maxMonthly) * 160)
                              )
                              .join(' L ') +
                            ' L ' +
                            (40 + ((monthKeys.length - 1) / Math.max(monthKeys.length - 1, 1)) * 540) +
                            ' 180 L 40 180 Z'
                          }
                          fill="url(#spendGrad)"
                        />
                      )}

                      {/* Line */}
                      {monthKeys.length > 1 && (
                        <polyline
                          points={monthKeys
                            .map(
                              (_, idx) =>
                                (40 + (idx / Math.max(monthKeys.length - 1, 1)) * 540) +
                                ',' +
                                (180 - (monthValues[idx] / maxMonthly) * 160)
                            )
                            .join(' ')}
                          fill="none"
                          stroke="rgb(139, 92, 246)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Dots */}
                      {monthKeys.map((_, idx) => (
                        <circle
                          key={idx}
                          cx={40 + (idx / Math.max(monthKeys.length - 1, 1)) * 540}
                          cy={180 - (monthValues[idx] / maxMonthly) * 160}
                          r="4"
                          fill="rgb(139, 92, 246)"
                          stroke="white"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                    <div className="flex justify-between mt-1 px-8">
                      {monthKeys.map((k) => (
                        <span key={k} className="text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(k + '-01').toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 dark:text-gray-500 py-8">Not enough data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* ── AI Savings Breakdown ── */}
        {safeRender(() => {
          if (aiOrders.length === 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <Sparkles className="w-5 h-5" />
                    AI Savings Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(aiSavings)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total AI Savings</p>
                    </div>
                    <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{aiOrders.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI-Assisted Orders</p>
                    </div>
                    <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(aiSavings / Math.max(aiOrders.length, 1))}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg. Savings / Order</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
