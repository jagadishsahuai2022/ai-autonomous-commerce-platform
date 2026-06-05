'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, DollarSign, Package } from 'lucide-react';
import Image from 'next/image';
import { GradientButton } from '@/components/shared/GradientButton';
import { cn } from '@/lib/utils/cn';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    image?: string;
    price: number;
    description?: string;
  };
  approval: {
    estimatedDelivery: string;
    totalPrice: number;
    savings?: number;
  };
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function ApprovalModal({
  isOpen,
  onClose,
  product,
  approval,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="neon-box rounded-3xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-primary-600 to-accent-500 px-6 py-8 text-white">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </motion.button>

                <h2 className="text-2xl font-bold">Confirm Order</h2>
                <p className="text-white/80 text-sm mt-1">Review your purchase details</p>
              </div>

              {/* Product Summary */}
              <div className="p-6 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  {product.image && (
                    product.image.startsWith('http') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} loading="lazy" className="rounded w-20 h-20 object-cover" />
                    ) : (
                      <Image src={product.image} alt={product.name} width={80} height={80} className="rounded w-20 h-20 object-cover" />
                    )
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{product.name}</h3>
                    {product.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>}
                    <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-2">₹{product.price?.toLocaleString('en-IN')}</p>
                  </div>
                </motion.div>

                {/* Order Details */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-3 divide-y divide-gray-200 dark:divide-gray-700"
                >
                  <div className="flex items-center gap-3 pt-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-500/10 rounded-lg text-primary-600 dark:text-primary-400">
                      <DollarSign size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total Price</p>
                      <p className="font-bold text-gray-900 dark:text-white">₹{approval.totalPrice?.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <div className="p-2 bg-green-100 dark:bg-green-500/10 rounded-lg text-green-600 dark:text-green-400">
                      <Package size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Estimated Delivery</p>
                      <p className="font-bold text-gray-900 dark:text-white">{approval.estimatedDelivery}</p>
                    </div>
                  </div>

                  {approval.savings && (
                    <div className="flex items-center gap-3 pt-3">
                      <div className="p-2 bg-amber-100 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                        <Truck size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 dark:text-gray-400">AI Savings</p>
                        <p className="font-bold text-amber-600 dark:text-amber-400">${approval.savings} saved</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-2 gap-3 pt-6 border-t border-gray-200 dark:border-gray-700"
                >
                  <GradientButton
                    onClick={onReject}
                    disabled={isLoading}
                    variant="secondary"
                    className="w-full"
                  >
                    Reject
                  </GradientButton>
                  <GradientButton
                    onClick={onApprove}
                    loading={isLoading}
                    disabled={isLoading}
                    neon
                    className="w-full"
                  >
                    Approve
                  </GradientButton>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
