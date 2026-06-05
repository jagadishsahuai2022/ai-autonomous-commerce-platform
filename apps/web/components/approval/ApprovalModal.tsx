'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertTriangle,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject?: () => void;
  onModify?: () => void;
  product?: any;
  approval?: any;
  riskLevel?: 'low' | 'medium' | 'high';
  showAutoApproval?: boolean;
}

export function ApprovalModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  onModify,
  product = null,
  approval,
  riskLevel = 'low',
  showAutoApproval = true,
}: ApprovalModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [enableAutoApproval, setEnableAutoApproval] = useState(false);
  const [walletBalance] = useState(500000);

  const riskColors = {
    low: 'bg-green-50 border-green-200 text-green-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    high: 'bg-red-50 border-red-200 text-red-700',
  };

  const riskIcons = {
    low: <CheckCircle2 className="w-5 h-5" />,
    medium: <AlertTriangle className="w-5 h-5" />,
    high: <AlertTriangle className="w-5 h-5" />,
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onApprove();
    setIsApproving(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl"
          >
            {/* Close Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-slate-600" />
            </motion.button>

            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-2xl font-bold text-slate-900">
                  Confirm Your Purchase
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  Please review the details before completing your order
                </p>
              </motion.div>

              {/* Product Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-50 rounded-lg p-4 border border-slate-200"
              >
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-slate-900">
                        ₹{product.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-green-600">
                        {product.delivery_days}d delivery
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Risk Assessment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Risk Assessment
                </h3>
                <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${riskColors[riskLevel]}`}>
                  {riskIcons[riskLevel]}
                  <div className="flex-1">
                    <p className="font-medium">
                      {riskLevel === 'low'
                        ? 'Low Risk Purchase'
                        : riskLevel === 'medium'
                          ? 'Medium Risk Assessment'
                          : 'High Risk Alert'}
                    </p>
                    <p className="text-sm opacity-90 mt-1">
                      {riskLevel === 'low'
                        ? 'This purchase passes all AI safety checks'
                        : riskLevel === 'medium'
                          ? 'Review recommended but within normal range'
                          : 'Manual review recommended due to high value'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Wallet Check */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-indigo-700 font-medium">WALLET BALANCE</p>
                    <p className="text-lg font-bold text-indigo-900">
                      ₹{walletBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-green-600">✓ Sufficient</span>
              </motion.div>

              {/* Auto-Approval Toggle */}
              {showAutoApproval && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-900">
                        Enable Auto-Approval
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        For similar low-risk purchases up to ₹50,000
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setEnableAutoApproval(!enableAutoApproval)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${enableAutoApproval ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                  >
                    <motion.div
                      animate={{
                        x: enableAutoApproval ? 24 : 4,
                      }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                    />
                  </motion.button>
                </motion.div>
              )}

              {/* Order Summary Line Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-2 py-4 border-y border-slate-200"
              >
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Product Price</span>
                  <span className="font-medium text-slate-900">
                    ₹{product.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delivery Charge</span>
                  <span className="font-medium text-green-600">FREE</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Taxes & Fees</span>
                  <span className="font-medium text-slate-900">Included</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="font-semibold text-slate-900">Total Amount</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    ₹{product.price.toLocaleString()}
                  </span>
                </div>
              </motion.div>

              {/* Privacy Notice */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Your payment is secured with end-to-end encryption. We never store your
                  card details.
                </p>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex gap-3 pt-4"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border-2 border-slate-300 rounded-lg font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isApproving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Clock className="w-5 h-5" />
                      </motion.div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Approve & Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Export a demo/standalone page
export default function ApprovalModalPage() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
      >
        Open Approval Modal
      </button>

      <ApprovalModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onApprove={() => {
          setIsOpen(false);
          alert('Order approved!');
        }}
      />
    </div>
  );
}
