'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  RefreshCcw,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  IndianRupee,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldCheck,
  Info,
  FileText,
  Star,
  X,
  Plus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ReturnItem {
  id: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  reason: string;
}

interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  status: 'initiated' | 'pickup_scheduled' | 'picked_up' | 'quality_check' | 'refund_initiated' | 'refunded' | 'rejected';
  reason: string;
  items: ReturnItem[];
  totalRefund: number;
  initiatedAt: string;
  pickupDate?: string;
  refundDate?: string;
  refundMethod: string;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  label: string;
  date: string;
  done: boolean;
  active?: boolean;
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface ReturnableOrder {
  id: string;
  orderNumber: string;
  deliveredAt: string;
  items: Array<{ id: string; productName: string; price: number; quantity: number }>;
  daysLeft: number;
}

const RETURN_REASONS = [
  'Product not as described',
  'Defective / Not working',
  'Wrong item delivered',
  'Damaged packaging / product',
  'Changed my mind',
  'Better price available elsewhere',
  'Item no longer needed',
  'Other',
];

const STATUS_STEPS: Record<ReturnRequest['status'], number> = {
  initiated: 0,
  pickup_scheduled: 1,
  picked_up: 2,
  quality_check: 3,
  refund_initiated: 4,
  refunded: 5,
  rejected: -1,
};

const STATUS_LABELS: Record<ReturnRequest['status'], { label: string; color: string; bg: string }> = {
  initiated: { label: 'Return Initiated', color: 'text-blue-700', bg: 'bg-blue-50' },
  pickup_scheduled: { label: 'Pickup Scheduled', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  picked_up: { label: 'Item Picked Up', color: 'text-purple-700', bg: 'bg-purple-50' },
  quality_check: { label: 'Quality Check', color: 'text-amber-700', bg: 'bg-amber-50' },
  refund_initiated: { label: 'Refund Initiated', color: 'text-teal-700', bg: 'bg-teal-50' },
  refunded: { label: 'Refunded', color: 'text-green-700', bg: 'bg-green-50' },
  rejected: { label: 'Return Rejected', color: 'text-red-700', bg: 'bg-red-50' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// ─── Components ──────────────────────────────────────────────────────────────
function ReturnTimeline({ timeline }: { timeline: TimelineEvent[] }) {
  return (
    <div className="mt-4 space-y-0">
      {timeline.map((event, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${event.done ? 'bg-green-500' : event.active ? 'bg-blue-500' : 'bg-gray-200'
              }`}>
              {event.done ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : event.active ? (
                <Clock className="w-4 h-4 text-white animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-gray-400" />
              )}
            </div>
            {idx < timeline.length - 1 && (
              <div className={`w-0.5 flex-1 my-1 ${event.done ? 'bg-green-300' : 'bg-gray-200'}`} style={{ minHeight: 20 }} />
            )}
          </div>
          <div className="pb-4">
            <p className={`text-sm font-medium ${event.done || event.active ? 'text-gray-900' : 'text-gray-400'}`}>{event.label}</p>
            <p className={`text-xs mt-0.5 ${event.done ? 'text-gray-500' : 'text-gray-400'}`}>{event.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReturnCard({ ret }: { ret: ReturnRequest }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_LABELS[ret.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-500">{ret.returnNumber}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">Order: {ret.orderNumber}</span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              {ret.items[0].productName}{ret.items.length > 1 ? <span className="ml-1 text-xs font-normal text-gray-500">&amp; {ret.items.length - 1} more</span> : null}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{ret.reason}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(ret.totalRefund)}
            </span>
          </div>
        </div>

        <button
          data-testid="view-details-btn"
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide details' : 'View details'}
        </button>
      </div>

      {/* Expandable Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 pb-5 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Items + Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Return Items</h4>
                <div className="space-y-3">
                  {ret.items.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} · {formatCurrency(item.price)}</p>
                        <p className="text-xs text-orange-600 mt-0.5">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Refund method</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right max-w-[200px]">{ret.refundMethod}</span>
                  </div>
                  {ret.refundDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Refunded on</span>
                      <span className="text-green-700 font-medium">
                        {new Date(ret.refundDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {ret.pickupDate && !ret.refundDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pickup date</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        {new Date(ret.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Timeline</h4>
                <ReturnTimeline timeline={ret.timeline} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── New Return Form ──────────────────────────────────────────────────────────
function NewReturnForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [step, setStep] = useState<'select_order' | 'select_items' | 'reason' | 'confirm'>('select_order');
  const returnableOrders: ReturnableOrder[] = [];
  const [selectedOrder, setSelectedOrder] = useState<ReturnableOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [globalReason, setGlobalReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toggleItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalRefund = selectedOrder?.items
    .filter(i => selectedItems.includes(i.id))
    .reduce((sum, i) => sum + i.price * i.quantity, 0) ?? 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    onSubmit({ order: selectedOrder, items: selectedItems, reason: globalReason, notes: additionalNotes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Initiate Return</h2>
            <div className="flex gap-1 mt-1">
              {['select_order', 'select_items', 'reason', 'confirm'].map((s, i) => (
                <div key={s} className={`h-1 rounded-full flex-1 transition-colors ${['select_order', 'select_items', 'reason', 'confirm'].indexOf(step) >= i ? 'bg-orange-500' : 'bg-gray-200'
                  }`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Select Order */}
          {step === 'select_order' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Select the order you'd like to return from:</p>
              {returnableOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>No eligible orders for return at this time.</p>
                  <p className="text-xs mt-1">Returns are accepted within 10 days of delivery.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returnableOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedOrder?.id === order.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{order.orderNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.items.length} item(s)</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {order.daysLeft} days left
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {order.items.map(item => (
                          <p key={item.id} className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.productName}</p>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                disabled={!selectedOrder}
                onClick={() => setStep('select_items')}
                className="w-full mt-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Select Items */}
          {step === 'select_items' && selectedOrder && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Select items to return from <strong>{selectedOrder.orderNumber}</strong>:</p>
              <div className="space-y-3">
                {selectedOrder.items.map(item => (
                  <label key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedItems.includes(item.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                    }`}>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="mt-1 accent-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity} · {formatCurrency(item.price)}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedItems.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl flex justify-between items-center">
                  <span className="text-sm text-green-700 dark:text-green-400">Estimated refund</span>
                  <span className="font-bold text-green-800 dark:text-green-300">{formatCurrency(totalRefund)}</span>
                </div>
              )}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('select_order')} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
                  Back
                </button>
                <button
                  disabled={selectedItems.length === 0}
                  onClick={() => setStep('reason')}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reason */}
          {step === 'reason' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Why are you returning this? (helps us improve)</p>
              <div className="grid grid-cols-1 gap-2">
                {RETURN_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setGlobalReason(reason)}
                    className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${globalReason === reason
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-orange-300'
                      }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="Additional notes (optional)..."
                className="w-full mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none dark:bg-gray-800 dark:text-white resize-none"
                rows={3}
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep('select_items')} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
                  Back
                </button>
                <button
                  disabled={!globalReason}
                  onClick={() => setStep('confirm')}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && selectedOrder && (
            <div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-5">
                <h3 className="font-semibold text-orange-800 dark:text-orange-300 mb-3">Return Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedItems.length} item(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reason</span>
                    <span className="font-medium text-gray-900 dark:text-white text-right max-w-[200px]">{globalReason}</span>
                  </div>
                  <div className="border-t border-orange-200 pt-2 flex justify-between">
                    <span className="font-semibold text-gray-700">Estimated Refund</span>
                    <span className="font-bold text-green-700">
                      {formatCurrency(
                        selectedOrder.items
                          .filter(i => selectedItems.includes(i.id))
                          .reduce((s, i) => s + i.price * i.quantity, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex gap-2 text-sm text-blue-700 dark:text-blue-300 mb-5">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>A pickup will be scheduled within 24 hours. Refund will be processed within 5–7 business days after quality check.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('reason')} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : 'Confirm Return'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Success Toast ──────────────────────────────────────────────────────────
function SuccessToast({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-72"
    >
      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-sm">Return Request Submitted!</p>
        <p className="text-xs text-green-100">Pickup will be scheduled within 24 hours.</p>
      </div>
      <button onClick={onClose} className="ml-4 p-1 hover:bg-green-700 rounded-full">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('authToken');
    if (!email || !token) {
      router.push('/signin');
      return;
    }
    setUser({ email });
    setMounted(true);
  }, [router]);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredReturns = returns.filter(r => {
    if (activeTab === 'active') return !['refunded', 'rejected'].includes(r.status);
    if (activeTab === 'completed') return ['refunded', 'rejected'].includes(r.status);
    return true;
  });

  const totalRefunded = returns.filter(r => r.status === 'refunded').reduce((s, r) => s + r.totalRefund, 0);
  const activeCount = returns.filter(r => !['refunded', 'rejected'].includes(r.status)).length;

  const handleNewReturn = (data: any) => {
    const newReturn: ReturnRequest = {
      id: `ret-${Date.now()}`,
      returnNumber: `RTN-2026-${String(Math.floor(Math.random() * 900000 + 100000))}`,
      orderId: data.order.id,
      orderNumber: data.order.orderNumber,
      status: 'initiated',
      reason: data.reason,
      items: data.order.items
        .filter((i: any) => data.items.includes(i.id))
        .map((i: any) => ({
          id: i.id,
          productName: i.productName,
          productImage: '/product-placeholder.svg',
          quantity: i.quantity,
          price: i.price,
          reason: data.reason,
        })),
      totalRefund: data.order.items
        .filter((i: any) => data.items.includes(i.id))
        .reduce((s: number, i: any) => s + i.price * i.quantity, 0),
      initiatedAt: new Date().toISOString(),
      refundMethod: 'Original payment method',
      timeline: [
        { label: 'Return Initiated', date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), done: true, active: true },
        { label: 'Pickup Scheduled', date: 'Within 24 hours', done: false },
        { label: 'Item Picked Up', date: 'Pending', done: false },
        { label: 'Quality Check', date: 'Pending', done: false },
        { label: 'Refund Initiated', date: 'Pending', done: false },
        { label: 'Refunded', date: 'Pending', done: false },
      ],
    };
    setReturns(prev => [newReturn, ...prev]);
    setShowForm(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Returns & Refunds</h1>
              <p className="text-xs text-gray-500">Manage your return requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            New Return
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Returns', value: returns.length, icon: RotateCcw, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active Returns', value: activeCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Total Refunded', value: formatCurrency(totalRefunded), icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Return Policy Banner */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Easy Return Policy</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                10-day return window · Electronics: 7 days · Free pickup · Refund in 5–7 business days
              </p>
            </div>
            <Link href="/account/help" className="ml-auto flex-shrink-0 text-xs text-orange-600 hover:underline font-medium">
              Learn more →
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Returns List */}
        {filteredReturns.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-10 text-center">
            <RotateCcw className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">No {activeTab !== 'all' ? activeTab : ''} returns</h3>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'completed' ? 'No completed returns yet.' : 'Start a return by clicking "New Return" above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReturns.map(ret => (
              <ReturnCard key={ret.id} ret={ret} />
            ))}
          </div>
        )}

        {/* Return Process Info */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            How Returns Work
          </h3>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Initiate Return', desc: 'Select the order and items you want to return and choose a reason.' },
              { step: '2', title: 'Schedule Pickup', desc: 'We\'ll schedule a free pickup from your doorstep within 24 hours.' },
              { step: '3', title: 'Quality Check', desc: 'Our team inspects the item to ensure it meets return criteria.' },
              { step: '4', title: 'Get Refund', desc: 'Refund is credited to your original payment method in 5–7 business days.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-600">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Return Modal */}
      <AnimatePresence>
        {showForm && (
          <NewReturnForm onClose={() => setShowForm(false)} onSubmit={handleNewReturn} />
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && <SuccessToast onClose={() => setShowSuccess(false)} />}
      </AnimatePresence>
    </div>
  );
}
