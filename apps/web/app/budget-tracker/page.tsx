'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet, TrendingUp, TrendingDown, BarChart3, AlertCircle,
  CheckCircle, ShoppingCart, Calendar, ArrowRight, Sparkles,
  Target, PieChart, DollarSign, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  items: any[];
  total: number;
  status: string;
  createdAt?: string;
  date?: string;
  aiAssisted?: boolean;
}

interface BudgetCategory {
  name: string;
  spent: number;
  budget: number;
  color: string;
  icon: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem('orders');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getMonthlySpend(orders: Order[], monthsBack = 0): number {
  const now = new Date();
  const targetMonth = now.getMonth() - monthsBack;
  const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  return orders
    .filter((o) => {
      const dateStr = o.createdAt || o.date || '';
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === normalizedMonth && d.getFullYear() === targetYear && o.status !== 'cancelled';
    })
    .reduce((sum, o) => sum + (o.total || 0), 0);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BudgetTrackerPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState(50000);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('50000');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    if (!token || !email) { router.push('/signin'); return; }

    const savedBudget = localStorage.getItem('monthlyBudget');
    if (savedBudget) {
      setMonthlyBudget(parseInt(savedBudget));
      setBudgetInput(savedBudget);
    }

    setOrders(loadOrders());
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const thisMonthSpend = getMonthlySpend(orders, 0);
  const lastMonthSpend = getMonthlySpend(orders, 1);
  const totalSpend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const aiAssistedSpend = orders.filter(o => o.aiAssisted && o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const budgetUsedPct = Math.min(100, (thisMonthSpend / monthlyBudget) * 100);
  const isOverBudget = thisMonthSpend > monthlyBudget;
  const monthChange = lastMonthSpend > 0
    ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend * 100).toFixed(1)
    : null;

  const CATEGORIES: BudgetCategory[] = [
    { name: 'Electronics', spent: Math.round(totalSpend * 0.52), budget: 40000, color: 'bg-blue-500', icon: '📱' },
    { name: 'Appliances', spent: Math.round(totalSpend * 0.28), budget: 25000, color: 'bg-purple-500', icon: '🏠' },
    { name: 'Audio', spent: Math.round(totalSpend * 0.12), budget: 10000, color: 'bg-green-500', icon: '🎧' },
    { name: 'Others', spent: Math.round(totalSpend * 0.08), budget: 5000, color: 'bg-orange-500', icon: '🛍️' },
  ];

  const ALERTS = [
    ...(isOverBudget ? [{ type: 'error' as const, msg: `You've exceeded your monthly budget by ₹${(thisMonthSpend - monthlyBudget).toLocaleString('en-IN')}` }] : []),
    ...(budgetUsedPct > 80 && !isOverBudget ? [{ type: 'warning' as const, msg: `You've used ${budgetUsedPct.toFixed(0)}% of your monthly budget` }] : []),
    ...(monthChange && parseFloat(monthChange) > 20 ? [{ type: 'info' as const, msg: `Spending up ${monthChange}% vs last month` }] : []),
    ...(orders.length === 0 ? [{ type: 'info' as const, msg: 'No orders yet — start shopping to track your budget' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-950 dark:to-emerald-950/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">AI Budget Tracker</h1>
                <p className="text-white/80 text-sm mt-0.5">Smart spending insights &amp; budget alerts</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'This Month', value: `₹${thisMonthSpend.toLocaleString('en-IN')}` },
                { label: 'Total Spent', value: `₹${totalSpend.toLocaleString('en-IN')}` },
                { label: 'Orders', value: orders.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Alerts */}
        {ALERTS.length > 0 && (
          <div className="space-y-2">
            {ALERTS.map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium ${
                alert.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                alert.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {alert.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> :
                 alert.type === 'warning' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> :
                 <Sparkles className="w-4 h-4 flex-shrink-0" />}
                {alert.msg}
              </div>
            ))}
          </div>
        )}

        {/* Monthly Budget Meter */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Budget</h2>
            </div>
            {!editingBudget ? (
              <button
                onClick={() => setEditingBudget(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Edit Budget
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">₹</span>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => {
                    const val = parseInt(budgetInput) || 50000;
                    setMonthlyBudget(val);
                    localStorage.setItem('monthlyBudget', String(val));
                    setEditingBudget(false);
                  }}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Spent: <strong className={isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}>₹{thisMonthSpend.toLocaleString('en-IN')}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Budget: <strong>₹{monthlyBudget.toLocaleString('en-IN')}</strong>
              </span>
            </div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetUsedPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : budgetUsedPct > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
              />
            </div>
            <p className={`text-xs ${isOverBudget ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
              {isOverBudget
                ? `Over budget by ₹${(thisMonthSpend - monthlyBudget).toLocaleString('en-IN')}`
                : `₹${(monthlyBudget - thisMonthSpend).toLocaleString('en-IN')} remaining (${(100 - budgetUsedPct).toFixed(0)}%)`}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            {[
              { label: 'This Month', value: `₹${thisMonthSpend.toLocaleString('en-IN')}`, icon: <Calendar className="w-4 h-4 text-blue-500" />, change: monthChange ? `${parseFloat(monthChange) > 0 ? '+' : ''}${monthChange}%` : null },
              { label: 'Last Month', value: `₹${lastMonthSpend.toLocaleString('en-IN')}`, icon: <Calendar className="w-4 h-4 text-purple-500" />, change: null },
              { label: 'AI-Assisted', value: `₹${aiAssistedSpend.toLocaleString('en-IN')}`, icon: <Sparkles className="w-4 h-4 text-violet-500" />, change: null },
              { label: 'Avg/Order', value: orders.length > 0 ? `₹${Math.round(totalSpend / orders.length).toLocaleString('en-IN')}` : '—', icon: <BarChart3 className="w-4 h-4 text-green-500" />, change: null },
            ].map(({ label, value, icon, change }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-gray-500 dark:text-gray-400">{label}</span></div>
                <p className="text-base font-bold text-gray-900 dark:text-white">{value}</p>
                {change && (
                  <p className={`text-xs mt-0.5 ${parseFloat(change) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {change} vs last month
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Spending by Category */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Spending by Category</h2>
          </div>
          {totalSpend === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
              <p>No spending data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {CATEGORIES.map((cat) => {
                const pct = Math.min(100, (cat.spent / (totalSpend || 1)) * 100);
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span>{cat.icon}</span>{cat.name}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₹{cat.spent.toLocaleString('en-IN')}
                        <span className="text-xs text-gray-400 ml-1">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={`h-full rounded-full ${cat.color}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Orders */}
        {orders.length > 0 && (
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Orders</h2>
              </div>
              <Link href="/orders" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {orders.slice(0, 5).map((order) => {
                const dateStr = order.createdAt || order.date || '';
                return (
                  <div key={order.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{order.id}</p>
                        {dateStr && <p className="text-xs text-gray-400">{new Date(dateStr).toLocaleDateString('en-IN')}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {order.aiAssisted && <Sparkles className="w-3.5 h-3.5 text-violet-500" />}
                      <span className="font-bold text-gray-900 dark:text-white">₹{(order.total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* AI Savings Insights */}
        <section className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-bold">AI Savings Insights</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Price Comparisons Done', value: '24', icon: '🔍' },
              { label: 'Best Deals Found', value: '8', icon: '🎯' },
              { label: 'Estimated Savings', value: '₹4,200', icon: '💰' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                <span className="text-2xl">{icon}</span>
                <p className="text-xl font-bold mt-1">{value}</p>
                <p className="text-xs text-white/80 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
