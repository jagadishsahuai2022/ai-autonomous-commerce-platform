'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingBag, ArrowRight, Calendar, Sparkles, Package, Search, Filter, ChevronLeft, ChevronRight, TrendingUp, Clock, CheckCircle2, Truck, XCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }>; glow: string }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', icon: Clock, glow: 'shadow-amber-400/20' },
  confirmed: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', icon: CheckCircle2, glow: 'shadow-blue-400/20' },
  processing: { color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', icon: RotateCcw, glow: 'shadow-cyan-400/20' },
  shipped: { color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/30', icon: Truck, glow: 'shadow-indigo-400/20' },
  delivered: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', icon: CheckCircle2, glow: 'shadow-emerald-400/20' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', icon: XCircle, glow: 'shadow-red-400/20' },
  failed: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', icon: XCircle, glow: 'shadow-red-400/20' },
};

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  total: number;
  status: string;
  aiAssisted: boolean;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 10;

  useEffect(() => {
    const t = localStorage.getItem('authToken');
    setToken(t);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) { setIsLoading(false); return; }

    setIsLoading(true);
    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load orders');
        return res.json();
      })
      .then((data) => {
        const dbOrders: Order[] = Array.isArray(data.orders) ? data.orders : [];
        const localRaw = JSON.parse(localStorage.getItem('orders') || '[]');
        const localOrders: Order[] = Array.isArray(localRaw)
          ? localRaw.map((o: any) => ({
            id: o.id,
            orderNumber: o.id || `ORD-${Date.now()}`,
            total: o.total || 0,
            status: o.status === 'confirmed' ? 'processing' : (o.status || 'processing'),
            aiAssisted: o.aiAssisted === true,
            paymentMethod: o.paymentMethod || 'upi',
            createdAt: o.createdAt || new Date().toISOString(),
            items: Array.isArray(o.items) ? o.items.map((i: any) => ({
              id: i.id || 0,
              productName: i.name || i.productName || 'Product',
              quantity: i.quantity || i.qty || 1,
              price: i.price || 0,
            })) : [],
          }))
          : [];

        const dbIds = new Set(dbOrders.map((o) => String(o.orderNumber)));
        const localOnly = localOrders.filter((o) => !dbIds.has(String(o.orderNumber)));
        const merged = [...dbOrders, ...localOnly];

        setOrders(merged);
        setTotal(merged.length);
      })
      .catch((e) => {
        setError(e.message);
        const localRaw = JSON.parse(localStorage.getItem('orders') || '[]');
        if (Array.isArray(localRaw) && localRaw.length > 0) {
          setOrders(localRaw.map((o: any) => ({
            id: o.id,
            orderNumber: o.id || `ORD-${Date.now()}`,
            total: o.total || 0,
            status: o.status === 'confirmed' ? 'processing' : (o.status || 'processing'),
            aiAssisted: o.aiAssisted === true,
            paymentMethod: o.paymentMethod || 'upi',
            createdAt: o.createdAt || new Date().toISOString(),
            items: Array.isArray(o.items) ? o.items.map((i: any) => ({
              id: i.id || 0,
              productName: i.name || i.productName || 'Product',
              quantity: i.quantity || i.qty || 1,
              price: i.price || 0,
            })) : [],
          })));
          setError(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [mounted, token, currentPage]);

  if (!mounted) return null;

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
            <Package className="w-10 h-10 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Sign in to view your orders</h1>
          <p className="text-gray-400 mb-8">You need to be logged in to see your order history.</p>
          <Link href="/signin">
            <Button className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 px-8 py-3 text-lg rounded-xl">
              Sign In
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = Math.ceil(filteredOrders.length / limit);

  // Stats
  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const activeCount = orders.filter(o => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length;

  const statuses = ['all', ...new Set(orders.map(o => o.status))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-100/50 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
              Your Orders
            </h1>
          </div>
          <p className="text-slate-500 ml-[52px]">Track and manage all your orders in one place</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Orders', value: orders.length, icon: ShoppingBag, gradient: 'from-violet-50 to-violet-100', iconColor: 'text-violet-600' },
            { label: 'Active', value: activeCount, icon: Truck, gradient: 'from-cyan-50 to-cyan-100', iconColor: 'text-cyan-600' },
            { label: 'Delivered', value: deliveredCount, icon: CheckCircle2, gradient: 'from-emerald-50 to-emerald-100', iconColor: 'text-emerald-600' },
            { label: 'Total Spent', value: `₹${totalSpent.toLocaleString('en-IN')}`, icon: TrendingUp, gradient: 'from-amber-50 to-amber-100', iconColor: 'text-amber-600' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${stat.gradient} p-4 shadow-sm`}
            >
              <stat.icon className={`w-5 h-5 ${stat.iconColor} mb-2`} />
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Search & Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by order number or product name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${statusFilter === s
                    ? 'bg-violet-100 text-violet-700 border border-violet-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center min-h-[400px]">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-cyan-200 border-b-cyan-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="text-slate-500 mt-4">Loading your orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No matching orders' : 'No Orders Yet'}
            </h2>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Your order history will appear here. Start shopping now!'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link href="/products">
                <Button className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 rounded-xl px-6">
                  Start Shopping
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {paginatedOrders.map((order, index) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/orders/${order.id}`}>
                      <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/50 transition-all duration-300 hover:border-slate-300 hover:shadow-lg ${cfg.glow}`}>
                        {/* Hover glow accent */}
                        <div className={`absolute inset-y-0 left-0 w-1 ${cfg.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />

                        <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Status indicator + Order info */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Status circle */}
                            <div className={`w-11 h-11 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
                              <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                <h3 className="font-semibold text-slate-900 text-lg">{order.orderNumber}</h3>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </span>
                                {order.aiAssisted && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600 border border-violet-200">
                                    <Sparkles className="w-3 h-3" /> AI
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                <span className="text-slate-500 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-slate-500">
                                  {(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-slate-500 capitalize">{order.paymentMethod || '–'}</span>
                              </div>

                              {order.items && order.items.length > 0 && (
                                <p className="text-xs text-slate-400 mt-2 truncate">
                                  {order.items.map(i => i.productName).join('  •  ')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Amount + Arrow */}
                          <div className="flex items-center gap-4 lg:flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-slate-900">
                                ₹{Number(order.total).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-violet-50 group-hover:border-violet-200 transition-all">
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center items-center gap-3 mt-8 pt-6 border-t border-slate-200"
              >
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${page === currentPage
                        ? 'bg-violet-100 text-violet-700 border border-violet-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
