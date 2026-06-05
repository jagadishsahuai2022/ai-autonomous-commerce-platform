/**
 * Real-time Notification Toast System
 * Displays notifications with auto-dismiss and actions
 */

'use client';

import React, { useEffect } from 'react';
import useRealtimeStore from '@/lib/store/realtime.store';
import { useRouter } from 'next/navigation';

interface ToastProps {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    type: 'navigate' | 'dismiss';
    target?: string;
  };
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  action,
  onDismiss,
}) => {
  const router = useRouter();
  const store = useRealtimeStore();

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const bgColors = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
  };

  const textColors = {
    info: 'text-blue-700',
    success: 'text-green-700',
    warning: 'text-yellow-700',
    error: 'text-red-700',
  };

  const iconEmojis = {
    info: '🔵',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  const handleAction = () => {
    if (!action) return;

    if (action.type === 'navigate' && action.target) {
      router.push(action.target);
    }

    onDismiss(id);
  };

  return (
    <div
      className={`flex items-start p-4 border rounded-lg mb-3 ${bgColors[type]} animate-in fade-in slide-in-from-right`}
    >
      <span className="text-xl mr-3">{iconEmojis[type]}</span>

      <div className="flex-1">
        <h3 className={`font-semibold ${textColors[type]}`}>{title}</h3>
        <p className={`text-sm ${textColors[type]} opacity-80`}>{message}</p>
      </div>

      <div className="ml-3 flex items-center gap-2">
        {action && action.type === 'navigate' && (
          <button
            onClick={handleAction}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              type === 'success'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            View
          </button>
        )}

        <button
          onClick={() => onDismiss(id)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

/**
 * Notification Container - displays all notifications
 */
export const NotificationContainer: React.FC = () => {
  const { notifications, dismissNotification, markNotificationAsRead } =
    useRealtimeStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {notifications.slice(0, 5).map((notification) => (
        <Toast
          key={notification.id}
          id={notification.id}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          action={notification.action}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};

/**
 * Unread Notifications Badge
 */
export const NotificationBadge: React.FC = () => {
  const { unreadCount } = useRealtimeStore();

  if (unreadCount === 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
};

export default NotificationContainer;
