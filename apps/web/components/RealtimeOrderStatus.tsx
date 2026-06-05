/**
 * Real-time Order Status Component
 * Shows live order tracking with status updates via WebSocket
 */

'use client';

import React, { useMemo } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface OrderStep {
  status: 'pending' | 'confirmed' | 'shipped' | 'completed';
  label: string;
  description: string;
  icon: string;
}

const ORDER_STEPS: OrderStep[] = [
  {
    status: 'pending',
    label: 'Pending',
    description: 'Processing your order',
    icon: '📦',
  },
  {
    status: 'confirmed',
    label: 'Confirmed',
    description: 'Order confirmed',
    icon: '✅',
  },
  {
    status: 'shipped',
    label: 'Shipped',
    description: 'On its way to you',
    icon: '🚚',
  },
  {
    status: 'completed',
    label: 'Delivered',
    description: 'Order delivered',
    icon: '🎉',
  },
];

interface OrderStatusTimelineProps {
  orderId: number;
  currentStatus: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  orderId,
  currentStatus,
  createdAt,
  updatedAt,
}) => {
  const { isConnected } = useWebSocket();

  const currentStepIndex = useMemo(() => {
    return ORDER_STEPS.findIndex((step) => step.status === currentStatus);
  }, [currentStatus]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (currentStatus === 'cancelled') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-center text-red-700 font-semibold">
          ❌ Order Cancelled
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">Order #{orderId}</h3>
        {isConnected ? (
          <span className="inline-flex items-center gap-2 text-green-700 text-sm font-medium">
            <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            Live Updates
          </span>
        ) : (
          <span className="text-gray-500 text-sm">Updates paused</span>
        )}
      </div>

      <div className="relative">
        {/* Progress bar */}
        <div className="absolute top-5 left-0 h-1 bg-gray-200" style={{ width: '100%' }} />
        <div
          className="absolute top-5 left-0 h-1 bg-blue-600 transition-all duration-500"
          style={{
            width: `${((currentStepIndex + 1) / ORDER_STEPS.length) * 100}%`,
          }}
        />

        {/* Timeline steps */}
        <div className="relative flex justify-between mb-8">
          {ORDER_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isActive = index === currentStepIndex;

            return (
              <div key={step.status} className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-blue-600 text-white scale-110'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isActive && isConnected ? (
                    <span className="animate-pulse">{step.icon}</span>
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Label */}
                <p
                  className={`mt-3 text-sm font-semibold text-center w-20 ${
                    isCompleted ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>

                {/* Description */}
                <p className="mt-1 text-xs text-gray-500 text-center w-24">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Status info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Current Status:</strong> {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Created: {formatDate(createdAt)}
            {updatedAt && <> • Updated: {formatDate(updatedAt)}</>}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Order List with Real-time Status
 */
export const RealtimeOrderList: React.FC = () => {
  const { orders, isConnected } = useWebSocket();

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your Orders</h2>
        {isConnected && (
          <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
            🔴 LIVE UPDATES
          </span>
        )}
      </div>

      {orders.map((order) => (
        <OrderStatusTimeline
          key={order.id}
          orderId={order.id}
          currentStatus={order.status}
          createdAt={order.createdAt}
          updatedAt={order.updatedAt}
        />
      ))}
    </div>
  );
};

export default RealtimeOrderList;
