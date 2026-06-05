'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  MessageSquare,
  Search,
  TrendingUp,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
} from 'lucide-react';
import { TimelineStep } from '@/lib/types/commerce';

const getStepIcon = (step: TimelineStep) => {
  const iconClass = 'w-5 h-5';

  switch (step.label.toLowerCase()) {
    case 'intent received':
      return <MessageSquare className={iconClass} />;
    case 'product search':
      return <Search className={iconClass} />;
    case 'ai ranking':
      return <TrendingUp className={iconClass} />;
    case 'decision ready':
      return <CheckCircle className={iconClass} />;
    case 'placing order':
      return <CreditCard className={iconClass} />;
    case 'order confirmed':
      return <Package className={iconClass} />;
    case 'delivery':
      return <Truck className={iconClass} />;
    default:
      return <Circle className={iconClass} />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in_progress':
      return 'bg-indigo-600';
    case 'pending':
      return 'bg-slate-300';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-slate-300';
  }
};

export default function TimelineComponent() {
  const steps: TimelineStep[] = [];

  if (steps.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Timeline Data</h1>
          <p className="text-slate-500">Order execution timeline will appear here once a purchase is in progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4"
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">Purchase Execution</h1>
          <p className="text-sm text-slate-600 mt-1">Real-time order processing</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-4xl mx-auto px-6 py-12"
      >
        {/* Timeline */}
        <div className="space-y-6">
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in_progress';
            const isPending = step.status === 'pending';
            const isError = step.status === 'error';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                {/* Timeline Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`absolute left-12 top-20 w-1 h-20 ${isCompleted ? 'bg-green-500' : 'bg-slate-200'
                      }`}
                  />
                )}

                {/* Timeline Item */}
                <div className="flex gap-6">
                  {/* Icon Container */}
                  <motion.div
                    className={`relative flex-shrink-0 w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${isCompleted
                        ? 'bg-green-500'
                        : isInProgress
                          ? 'bg-indigo-600'
                          : isPending
                            ? 'bg-slate-300'
                            : isError
                              ? 'bg-red-500'
                              : 'bg-slate-300'
                      }`}
                    animate={
                      isInProgress ? { scale: [1, 1.05, 1] } : { scale: 1 }
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    {isCompleted && <CheckCircle2 className="w-10 h-10" />}
                    {isInProgress && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {getStepIcon(step)}
                      </motion.div>
                    )}
                    {isPending && <Circle className="w-10 h-10" />}
                    {isError && <AlertCircle className="w-10 h-10" />}

                    {/* Step Number */}
                    <span className="absolute -bottom-2 -right-2 w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                      {idx + 1}
                    </span>
                  </motion.div>

                  {/* Content */}
                  <motion.div
                    className="flex-1 pt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.1 + 0.2 }}
                  >
                    <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {step.label}
                          </h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {step.description}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(
                            step.status
                          )}`}
                        >
                          {step.status === 'in_progress'
                            ? 'Processing'
                            : step.status === 'pending'
                              ? 'Pending'
                              : step.status === 'error'
                                ? 'Error'
                                : 'Completed'}
                        </span>
                      </div>

                      {/* Details Section */}
                      {step.details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          transition={{ delay: idx * 0.1 + 0.3 }}
                          className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <p className="text-sm text-slate-700 font-medium mb-2">
                            Details:
                          </p>
                          <p className="text-sm text-slate-600">{step.details}</p>
                        </motion.div>
                      )}

                      {/* Timing Info */}
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {step.timestamp
                              ? new Date(step.timestamp).toLocaleTimeString()
                              : 'Waiting...'}
                          </span>
                        </div>
                        {step.duration && (
                          <span className="font-medium text-indigo-600">
                            {step.duration}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Final Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (steps.length + 1) * 0.1 }}
          className="mt-12 bg-gradient-to-r from-green-50 to-indigo-50 rounded-2xl p-8 border-2 border-green-200"
        >
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                🎉 Process Complete!
              </h3>
              <p className="text-slate-700 mb-4">
                Your order has been successfully placed and will be delivered as per the estimated timeline. You can track your order status in real-time.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                View Order Details
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
