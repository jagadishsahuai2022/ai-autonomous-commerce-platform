'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Clock, Check, X, Edit3, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ApprovalRequest {
  id: string;
  productName: string;
  amount: number;
  riskLevel: RiskLevel;
  riskScore: number; // 0–100
  aiConfidence: number; // 0–100
  reasons: string[];
  expiresAt: Date;
  autoApproveAt?: Date; // optional: auto-approve timer
}

interface ApprovalSystemUIProps {
  request: ApprovalRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason?: string) => void;
  onModify?: (id: string) => void;
  /** Called when product name is clicked — opens product detail modal */
  onProductClick?: () => void;
  /** Called when the approval timer expires without action */
  onExpire?: (id: string) => void;
  className?: string;
}

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  low: {
    label: 'Low Risk',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    icon: <ShieldCheck className="w-4 h-4 text-green-500" />,
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  },
  high: {
    label: 'High Risk',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: <ShieldAlert className="w-4 h-4 text-red-500" />,
  },
};

function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: Date;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 60;
  const isExpired = remaining === 0;

  if (isExpired) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
        <Clock className="w-3.5 h-3.5" />
        <span>Expired</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-400 dark:text-gray-500')}>
      <Clock className="w-3.5 h-3.5" />
      <span className="tabular-nums font-medium">
        {mins}:{secs.toString().padStart(2, '0')} left
      </span>
    </div>
  );
}

export function ApprovalSystemUI({
  request,
  onApprove,
  onReject,
  onModify,
  onProductClick,
  onExpire,
  className,
}: ApprovalSystemUIProps) {
  const [status, setStatus] = useState<ApprovalStatus>('pending');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const risk = RISK_CONFIG[request.riskLevel];

  const handleApprove = () => {
    setStatus('approved');
    onApprove?.(request.id);
  };

  const handleReject = () => {
    setStatus('rejected');
    onReject?.(request.id, rejectReason);
    setShowRejectDialog(false);
  };

  const handleExpire = () => {
    if (status === 'pending') {
      setStatus('expired');
      onExpire?.(request.id);
    }
  };

  if (status === 'approved') {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-5 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-green-700 dark:text-green-300">Purchase Approved</p>
          <p className="text-xs text-green-600 dark:text-green-400">Proceeding with {request.productName}</p>
        </div>
      </motion.div>
    );
  }

  if (status === 'rejected') {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <X className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-red-700 dark:text-red-300">Purchase Rejected</p>
          <p className="text-xs text-red-600 dark:text-red-400">
            {rejectReason || 'Request declined'}
          </p>
        </div>
      </motion.div>
    );
  }

  if (status === 'expired') {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-700 dark:text-gray-300">Approval Expired</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The approval window has passed. Ask AI for a fresh recommendation.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden',
        risk.border,
        className
      )}
    >
      {/* Risk header */}
      <div className={cn('px-5 py-3 flex items-center justify-between', risk.bg)}>
        <div className="flex items-center gap-2">
          {risk.icon}
          <span className={cn('text-sm font-semibold', risk.color)}>{risk.label}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', risk.bg, risk.color, risk.border, 'border')}>
            {request.riskScore}/100
          </span>
        </div>
        <CountdownTimer expiresAt={request.expiresAt} onExpire={handleExpire} />
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Product + amount */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
              {onProductClick ? (
                <button
                  type="button"
                  className="text-left hover:text-violet-600 dark:hover:text-violet-400 hover:underline transition-colors"
                  onClick={onProductClick}
                  title="View product details"
                >
                  {request.productName}
                </button>
              ) : (
                <Link href={`/products?q=${encodeURIComponent(request.productName)}`} className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline transition-colors">
                  {request.productName}
                </Link>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Requires your approval</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-gray-100">
              <span className="text-gray-400 text-sm">₹</span>
              {request.amount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-400">AI confidence: {request.aiConfidence}%</p>
          </div>
        </div>

        {/* Reasons for approval needed */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Why approval needed:</p>
          <ul className="space-y-1">
            {request.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowRejectDialog(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold transition-all"
          >
            <X className="w-3.5 h-3.5" /> Reject
          </button>
          <button
            onClick={() => onModify?.(request.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" /> Modify
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-semibold transition-all shadow-sm shadow-green-200 dark:shadow-green-900/30"
          >
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
        </div>
      </div>

      {/* Reject dialog */}
      <AnimatePresence>
        {showRejectDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl flex flex-col p-5"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Reject purchase?</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional: add a reason..."
              className="flex-1 resize-none border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
