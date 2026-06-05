'use client';

import React, { use, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, Package, Truck, CheckCircle, Loader2 } from 'lucide-react';
import { Timeline, TimelineStep } from '@/components/timeline/Timeline';
import { Card, Badge } from '@/components/ui/base';

// Phase 1 & 2: Import real order hooks with WebSocket support
import { useOrder, useOrderTimeline, orderQueryKeys } from '@/hooks/useOrder';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';

// Next.js 15/16: params is a Promise for page-level client components.
// Use React.use() to unwrap synchronously inside the render body.
interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderPage({ params }: OrderPageProps) {
  const { id: orderId } = use(params);
  const queryClient = useQueryClient();

  // Phase 1: Get real order data from hook
  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: orderTimeline } = useOrderTimeline(orderId);

  // Phase 2: Wire WebSocket for REAL-TIME order status updates
  useWebSocketEvent('order:status_changed', (data) => {
    if (data.orderId === orderId) {
      // Automatically refetch order data when status changes
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    }
  });

  // Also listen for shipment updates
  useWebSocketEvent('shipment:updated', (data) => {
    if (data.orderId === orderId) {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.timeline(orderId) });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-lg border border-red-200">
          <p className="text-red-700 font-medium">Failed to load order</p>
          <p className="text-sm text-red-600 mt-2">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-purple-50">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-4xl mx-auto flex items-center space-x-4">
          <Link
            href="/copilot"
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <div className="border-l border-gray-200 pl-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Order {order.orderNumber}
                </h1>
                <p className="text-xs text-gray-500">Real-time Tracking</p>
              </div>
              <Badge variant={order.status === 'DELIVERED' ? 'success' : 'default'}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Product Items */}
                <div className="md:col-span-2 space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 pb-4 border-b">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">
                        📦
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        <p className="text-sm text-blue-600 font-semibold">₹{item.totalPrice?.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Summary */}
                <div className="flex flex-col justify-center border-l border-gray-200 pl-6">
                  <p className="text-xs text-gray-600 mb-2">Order Total</p>
                  <p className="text-3xl font-bold text-gray-900 mb-4">
                    ₹{order.total?.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    <span className="font-semibold">Estimated Delivery:</span>
                  </p>
                  <p className="font-semibold text-gray-900">
                    {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Live Tracking (Phase 2: Real-time WebSocket Updates) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">📍 Live Tracking</h2>
            <Card className="p-8">
              {orderTimeline ? (
                <Timeline
                  steps={orderTimeline.steps.map((step: any, idx: number) => ({
                    id: `step-${idx}`,
                    label: step.status.charAt(0).toUpperCase() + step.status.slice(1).toLowerCase(),
                    description: step.description,
                    status: 'completed' as const,
                    timestamp: new Date(step.timestamp),
                  }))}
                  currentStep={orderTimeline.currentStep}
                />
              ) : (
                <p className="text-gray-600">Loading tracking information...</p>
              )}

              {/* Tracking Details */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Order ID</p>
                    <p className="font-mono font-semibold text-gray-900">
                      {order.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Status</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {order.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Order Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Last Updated</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
