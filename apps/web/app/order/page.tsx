'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Download,
  Share2,
} from 'lucide-react';
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function OrderPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('tracking');
  const order: any = null;
  const product: any = null;

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Order Found</h1>
          <p className="text-slate-500">Order details will appear here once you make a purchase.</p>
        </div>
      </div>
    );
  }

  const trackingSteps = [
    { label: 'Order Placed', status: 'completed', date: '2026-01-15', time: '10:30 AM' },
    { label: 'Confirmed', status: 'completed', date: '2026-01-15', time: '10:45 AM' },
    { label: 'Packed', status: 'completed', date: '2026-01-16', time: '02:15 PM' },
    { label: 'Shipped', status: 'in_progress', date: '2026-01-16', time: '08:30 PM' },
    { label: 'In Transit', status: 'pending', date: '2026-01-17', time: 'Soon' },
    { label: 'Delivered', status: 'pending', date: '2026-01-17', time: 'EOD' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Order Tracking</h1>
            <p className="text-sm text-slate-600 mt-1">Order ID: {order.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <Download className="w-5 h-5 text-slate-600" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <Share2 className="w-5 h-5 text-slate-600" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-6 py-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Order Summary & Tracking */}
          <motion.div variants={itemVariants} className="lg:col-span-2 space-y-8">
            {/* Order Summary Card */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg"
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Order Summary</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-4 py-2 rounded-full font-semibold text-sm ${order.status === 'confirmed'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : order.status === 'shipped'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                  {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                </span>
              </div>

              {/* Product Info */}
              <div className="flex gap-6 mb-8 pb-8 border-b border-slate-200">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-12 h-12 text-slate-400" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-bold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-lg font-bold text-slate-900">
                      ₹{product.price.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-600">
                      Qty: {order.quantity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-600 font-medium">SUBTOTAL</p>
                  <p className="text-xl font-bold text-slate-900 mt-2">
                    ₹{(product.price * order.quantity).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 font-medium">DELIVERY</p>
                  <p className="text-xl font-bold text-green-600 mt-2">FREE</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">TOTAL</p>
                  <p className="text-xl font-bold text-slate-900 mt-2">
                    ₹{order.totalPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Tracking Timeline */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg"
              whileHover={{ y: -4 }}
            >
              <h2 className="text-xl font-bold text-slate-900 mb-8">Delivery Status</h2>

              <div className="space-y-6">
                {trackingSteps.map((step, idx) => {
                  const isCompleted = step.status === 'completed';
                  const isInProgress = step.status === 'in_progress';

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 + 0.3 }}
                      className="flex gap-6"
                    >
                      {/* Timeline Indicator */}
                      <div className="flex flex-col items-center">
                        <motion.div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isCompleted
                            ? 'bg-green-500'
                            : isInProgress
                              ? 'bg-indigo-600'
                              : 'bg-slate-300'
                            }`}
                          animate={
                            isInProgress ? { scale: [1, 1.1, 1] } : { scale: 1 }
                          }
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : isInProgress ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
                              <Truck className="w-5 h-5" />
                            </motion.div>
                          ) : (
                            <span className="text-xs">{idx + 1}</span>
                          )}
                        </motion.div>
                        {idx < trackingSteps.length - 1 && (
                          <div
                            className={`w-1 flex-1 mt-2 ${isCompleted ? 'bg-green-500' : 'bg-slate-200'
                              }`}
                            style={{ minHeight: '60px' }}
                          />
                        )}
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">{step.label}</h3>
                          <span className="text-xs text-slate-600">
                            {step.date}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{step.time}</p>
                        {isInProgress && (
                          <p className="text-xs text-indigo-600 font-medium mt-2">
                            Currently processing...
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Estimated Delivery */}
            <motion.div
              className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-200"
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-green-700 font-medium">ESTIMATED DELIVERY</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Expected delivery within next 24 hours
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Order Details */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Delivery Address */}
            <motion.div
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-lg transition-shadow"
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Delivery Address</h3>
              </div>
              <div className="text-sm text-slate-700 space-y-2">
                <p className="font-medium">{order.deliveryAddress}</p>
                <p className="text-slate-600">New Delhi, Delhi 110001</p>
                <p className="text-slate-600">India</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full mt-4 py-2 px-4 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Change Address
              </motion.button>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              className="bg-white rounded-2xl p-6 shadow-lg"
              whileHover={{ y: -4 }}
            >
              <h3 className="font-semibold text-slate-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-700">+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-700">user@example.com</span>
                </div>
              </div>
            </motion.div>

            {/* Payment Method */}
            <motion.div
              className="bg-white rounded-2xl p-6 shadow-lg"
              whileHover={{ y: -4 }}
            >
              <h3 className="font-semibold text-slate-900 mb-4">Payment Method</h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-900 capitalize">
                  {order.paymentMethod || 'Card'}
                </p>
                <p className="text-xs text-slate-600 mt-2">Transaction verified</p>
                <div className="flex items-center mt-3 text-green-600">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span className="text-xs font-medium">Successful</span>
                </div>
              </div>
            </motion.div>

            {/* Support */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Contact Support
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
