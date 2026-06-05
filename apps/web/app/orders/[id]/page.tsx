'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, ArrowLeft, Package2, MapPin, CreditCard, Truck,
  Sparkles, CheckCircle, Clock, XCircle, Printer, BoxIcon,
  ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: number;
  productName: string;
  productId?: string;
  productSlug?: string;
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
  shippingAddress?: Record<string, string> | null;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_AMBIENT: Record<string, string> = {
  delivered: 'from-green-500/20 via-emerald-500/10 to-transparent',
  shipped: 'from-blue-500/20 via-indigo-500/10 to-transparent',
  processing: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  confirmed: 'from-blue-400/20 via-cyan-500/10 to-transparent',
  pending: 'from-yellow-400/20 via-orange-500/10 to-transparent',
  cancelled: 'from-red-500/20 via-rose-500/10 to-transparent',
  failed: 'from-red-500/20 via-rose-500/10 to-transparent',
};

const STATUS_GLOW: Record<string, string> = {
  delivered: 'shadow-green-500/20',
  shipped: 'shadow-blue-500/20',
  processing: 'shadow-amber-500/20',
  confirmed: 'shadow-blue-400/20',
  pending: 'shadow-yellow-400/20',
  cancelled: 'shadow-red-500/20',
  failed: 'shadow-red-500/20',
};

const TRACKING_STATUSES = [
  { status: 'processing', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: Package2 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function safeRender(fn: () => React.ReactNode, fallback?: React.ReactNode): React.ReactNode {
  try {
    return fn();
  } catch {
    return fallback ?? null;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────

// Cache of product name → { imageUrl, productSlug } resolved from the products API
const resolvedCache = new Map<string, { imageUrl: string; productSlug: string }>();

// Category-based Unsplash fallback images (used when API search returns no result)
const CATEGORY_FALLBACKS: Record<string, string> = {
  phone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
  mobile: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
  iphone: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&q=80',
  samsung: 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
  computer: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80',
  tablet: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80',
  headphone: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
  earphone: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&q=80',
  watch: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
  tv: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&q=80',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80',
  shoe: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  shirt: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&q=80',
  book: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80',
  default: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
};

function getFallbackImage(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_FALLBACKS)) {
    if (lower.includes(key)) return url;
  }
  return CATEGORY_FALLBACKS.default;
}

function getNumericProductRef(value?: string | number | null): string {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : '';
}

async function resolveProductByName(name: string): Promise<{ imageUrl: string; productSlug: string } | null> {
  if (resolvedCache.has(name)) return resolvedCache.get(name)!;
  try {
    const res = await fetch(`/api/products?search=${encodeURIComponent(name)}&limit=5`);
    if (!res.ok) {
      // Use category-based fallback image
      const fallback = { imageUrl: getFallbackImage(name), productSlug: '' };
      resolvedCache.set(name, fallback);
      return fallback;
    }
    const data = await res.json();
    const products = data.products ?? (Array.isArray(data) ? data : []);
    const p = products[0];
    if (!p) {
      const fallback = { imageUrl: getFallbackImage(name), productSlug: '' };
      resolvedCache.set(name, fallback);
      return fallback;
    }
    const resolved = {
      imageUrl: p.image || p.imageUrl || getFallbackImage(name),
      productSlug: String(p.id || p.slug || ''),
    };
    resolvedCache.set(name, resolved);
    return resolved;
  } catch {
    const fallback = { imageUrl: getFallbackImage(name), productSlug: '' };
    resolvedCache.set(name, fallback);
    return fallback;
  }
}

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  // resolvedItems: map from item.id → { imageUrl, productSlug }
  const [resolvedItems, setResolvedItems] = useState<Record<string | number, { imageUrl: string; productSlug: string }>>({});
  const receiptRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('authToken');
    setToken(t);
    if (!t) {
      setIsLoading(false);
      return;
    }
    fetch(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => setOrder(d.order))
      .catch(() => {
        try {
          const lo = JSON.parse(localStorage.getItem('orders') || '[]');
          const f = lo.find((o: any) => String(o.id) === String(orderId));
          if (f) {
            setOrder({
              id: f.id,
              orderNumber: f.id,
              total: f.total || 0,
              status:
                f.status === 'confirmed'
                  ? 'processing'
                  : f.status || 'processing',
              aiAssisted: f.aiAssisted === true,
              paymentMethod: f.paymentMethod || 'upi',
              shippingAddress: f.address || null,
              notes: f.notes || null,
              createdAt: f.createdAt || new Date().toISOString(),
              items: Array.isArray(f.items)
                ? f.items.map((i: any, x: number) => ({
                  id: x,
                  productName: i.name || i.productName || 'Product',
                  quantity: i.quantity || i.qty || 1,
                  price: i.price || 0,
                }))
                : [],
            });
          } else {
            setError('Order not found');
          }
        } catch {
          setError('Order not found');
        }
      })
      .finally(() => setIsLoading(false));
  }, [orderId]);

  // Resolve missing product images/slugs from the products API
  useEffect(() => {
    if (!order?.items?.length) return;
    order.items.forEach(async (item) => {
      const key = item.id ?? item.productName;
      // Resolve legacy items only for image enrichment. Navigation must use
      // the stored numeric DB reference, never a name-based search result.
      if (!item.imageUrl) {
        const resolved = await resolveProductByName(item.productName);
        if (resolved) {
          setResolvedItems((prev) => ({
            ...prev,
            [key]: resolved,
          }));
        }
      }
    });
  }, [order]);

  const handlePrint = () => {
    setShowReceipt(true);
    setTimeout(() => {
      if (receiptRef.current) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(
            '<html><head><title>Receipt</title><style>body{font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px 4px;text-align:left;border-bottom:1px solid #eee}th{font-weight:600}.total{font-size:1.2em;font-weight:700}.header{text-align:center;margin-bottom:24px}.footer{text-align:center;margin-top:24px;color:#888;font-size:0.85em}</style></head><body>' +
            receiptRef.current.innerHTML +
            '</body></html>'
          );
          printWindow.document.close();
          printWindow.print();
        }
      }
    }, 100);
  };

  const scrollItems = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // ── Auth guard ──
  if (!token && !isLoading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Please sign in to view order details
          </h1>
          <Link href="/signin">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );

  // ── Loading state ──
  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading order details...</p>
        </motion.div>
      </div>
    );

  // ── Error state ──
  if (error || !order)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Order not found
          </h1>
          <Link href="/orders">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>
    );

  const idx = TRACKING_STATUSES.findIndex((s) => s.status === order.status);
  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const addr = order.shippingAddress as Record<string, string> | null;

  // Parse real AI savings from notes JSON (stored during auto-checkout).
  // Never use a fake percentage calculation.
  let aiSavings = 0;
  if (order.aiAssisted && order.notes) {
    try {
      const parsed = JSON.parse(order.notes);
      if (typeof parsed.aiSavings === 'number' && parsed.aiSavings > 0) {
        aiSavings = parsed.aiSavings;
      }
    } catch {
      /* notes may be plain text from older orders — no savings to show */
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 relative overflow-hidden overflow-x-hidden">
      {/* Status ambient background glow */}
      <div
        className={
          'absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl opacity-50 pointer-events-none bg-gradient-to-b ' +
          (STATUS_AMBIENT[order.status] || STATUS_AMBIENT['processing'])
        }
      />

      <div className="relative max-w-5xl mx-auto py-8 px-4 sm:px-6 overflow-hidden">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/orders"
            className="text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 flex items-center mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Orders
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Order {order.orderNumber}
                </h1>
                {order.aiAssisted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full flex items-center gap-1.5 font-semibold border border-violet-200 dark:border-violet-800"
                  >
                    <Sparkles className="w-3 h-3" /> AI-Assisted
                  </motion.span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Placed on{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <Badge
              className={
                (STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800') +
                ' px-4 py-1.5 text-sm font-semibold'
              }
            >
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </div>
        </motion.div>

        {/* ── Package Journey Timeline ── */}
        {safeRender(() => {
          if (order.status === 'cancelled' || order.status === 'failed')
            return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <Card
                className={
                  'bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-xl ' +
                  (STATUS_GLOW[order.status] || '')
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Truck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Package Journey
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative flex items-center justify-between px-4">
                    {/* Connecting line */}
                    <div className="absolute top-5 left-8 right-8 h-0.5 bg-gray-200 dark:bg-gray-700" />
                    <motion.div
                      className="absolute top-5 left-8 h-0.5 bg-gradient-to-r from-violet-500 to-green-500"
                      initial={{ width: 0 }}
                      animate={{
                        width:
                          idx >= 0
                            ? `${Math.min((idx / (TRACKING_STATUSES.length - 1)) * 100, 100)}%`
                            : '0%',
                      }}
                      transition={{ duration: 1.2, ease: 'easeInOut' }}
                      style={{ maxWidth: 'calc(100% - 64px)' }}
                    />

                    {TRACKING_STATUSES.map((step, i) => {
                      const isCompleted = i <= idx;
                      const isCurrent = i === idx;
                      const StepIcon = step.icon;
                      return (
                        <div
                          key={step.status}
                          className="relative z-10 flex flex-col items-center"
                        >
                          <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.15 }}
                            className={
                              'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ' +
                              (isCompleted
                                ? 'bg-gradient-to-br from-violet-500 to-green-500 border-transparent text-white shadow-lg'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500')
                            }
                          >
                            <StepIcon className="w-4 h-4" />
                          </motion.div>
                          {isCurrent && (
                            <motion.div
                              className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-violet-400/30"
                              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                          <p
                            className={
                              'text-xs text-center mt-2 font-medium ' +
                              (isCompleted
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-gray-400 dark:text-gray-500')
                            }
                          >
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* ── AI Savings Card ── */}
        {safeRender(() => {
          if (!order.aiAssisted || aiSavings <= 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-10 w-20 h-20 bg-white/5 rounded-full translate-y-1/2" />
                <div className="relative flex items-center gap-4 flex-wrap">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-bold text-lg">AI Saved You {formatCurrency(aiSavings)}</h3>
                    <p className="text-white/80 text-sm mt-0.5">
                      Your AI assistant found the best deals and negotiated prices on this order
                    </p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-bold">{formatCurrency(aiSavings)}</p>
                    <p className="text-xs text-white/70">Total Savings</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* ── Order Items - Horizontal Card Strip ── */}
        {safeRender(() => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BoxIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                Order Items ({(order.items || []).length})
              </h2>
              {(order.items || []).length > 2 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => scrollItems('left')}
                    className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => scrollItems('right')}
                    className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
            >
              {(order.items || []).map((item, i) => {
                const resolved = resolvedItems[item.id ?? item.productName];
                const displayImage = item.imageUrl || resolved?.imageUrl || '';
                const directId =
                  getNumericProductRef(item.productId) || getNumericProductRef(item.productSlug);
                const href = directId
                  ? `/products/${directId}`
                  : `/products?search=${encodeURIComponent(item.productName)}`;
                return (
                  <motion.div
                    key={item.id || i}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="snap-start flex-shrink-0 w-64"
                  >
                    <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/50 dark:border-gray-800/50 hover:shadow-lg transition-all h-full">
                      <CardContent className="p-4">
                        <Link href={href} className="block group">
                          <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                            {displayImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={displayImage}
                                alt={item.productName}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Package2 className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                            )}
                          </div>
                          <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400 group-hover:underline line-clamp-2 mb-2">
                            {item.productName}
                          </h3>
                        </Link>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Qty: {item.quantity}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {formatCurrency(Number(item.price))} each
                            </p>
                          </div>
                          <p className="text-lg font-bold text-violet-700 dark:text-violet-400">
                            {formatCurrency(Number(item.price) * item.quantity)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* ── Details Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            {safeRender(() => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/50 dark:border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <MapPin className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {addr ? (
                      <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                        {addr.name && (
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {addr.name}
                          </p>
                        )}
                        {addr.line1 && <p>{addr.line1}</p>}
                        {(addr.city || addr.state || addr.pincode) && (
                          <p>
                            {[addr.city, addr.state, addr.pincode]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                        {addr.phone && (
                          <p className="text-gray-500 dark:text-gray-400">
                            Phone: {addr.phone}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">
                        Address information not available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Payment Details */}
            {safeRender(() => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/50 dark:border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <CreditCard className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Payment Method
                        </span>
                        <span className="font-semibold capitalize text-gray-900 dark:text-white">
                          {order.paymentMethod}
                        </span>
                      </div>
                      {order.notes && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">
                            Notes
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {order.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {safeRender(() => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/50 dark:border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Order Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Subtotal
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                    {order.aiAssisted && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI Savings
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          -{formatCurrency(aiSavings)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between font-bold text-lg">
                      <span className="text-gray-900 dark:text-white">
                        Total
                      </span>
                      <span className="text-violet-700 dark:text-violet-400">
                        {formatCurrency(Number(order.total))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {safeRender(() => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/50 dark:border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="text-base text-gray-900 dark:text-white">
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">Order Number</p>
                      <p className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">Order Date</p>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">AI Assisted</p>
                      <p className="text-gray-900 dark:text-white">
                        {order.aiAssisted ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Print Receipt Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={handlePrint}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </Button>
            </motion.div>
          </div>
        </div>

        {/* ── Hidden Print Receipt ── */}
        <div className="hidden">
          <div ref={receiptRef}>
            <div className="header">
              <h1>DelegateCart</h1>
              <p>Order Receipt</p>
              <hr />
            </div>
            <p>
              <strong>Order:</strong> {order.orderNumber}
            </p>
            <p>
              <strong>Date:</strong>{' '}
              {new Date(order.createdAt).toLocaleDateString('en-IN')}
            </p>
            <p>
              <strong>Status:</strong> {order.status}
            </p>
            {addr && (
              <p>
                <strong>Ship to:</strong>{' '}
                {[addr.name, addr.line1, addr.city, addr.state, addr.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            <br />
            <table className="table-fixed w-full overflow-hidden">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(Number(item.price))}</td>
                    <td>{formatCurrency(Number(item.price) * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <br />
            <p className="total">
              <strong>Total: {formatCurrency(Number(order.total))}</strong>
            </p>
            <p>
              <strong>Payment:</strong> {order.paymentMethod}
            </p>
            {order.aiAssisted && (
              <p>
                <strong>AI Savings:</strong> {formatCurrency(aiSavings)}
              </p>
            )}
            <div className="footer">
              <p>Thank you for shopping with DelegateCart!</p>
              <p>AI-Powered Shopping Experience</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}