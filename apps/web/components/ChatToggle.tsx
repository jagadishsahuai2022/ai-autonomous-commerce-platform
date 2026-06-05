/**
 * ChatToggle Component
 * Button to open/close chat window, typically placed in header
 */

import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { ChatWindow } from './ChatWindow';
import { useChatStore } from '@/store/chatStore';

interface ChatToggleProps {
  userId?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'floating' | 'inline';
}

export const ChatToggle: React.FC<ChatToggleProps> = ({
  userId = 1, // Default userId, should be from auth context in production
  position = 'bottom-right',
  variant = 'floating',
}) => {
  const { isOpen, toggleWindow, setOpen, unreadCount, clearUnread } = useChatStore();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const handleOpen = () => {
    setOpen(true);
    clearUnread();
  };

  const handleClose = () => {
    setOpen(false);
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  if (variant === 'inline') {
    return (
      <button
        onClick={handleOpen}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Open chat"
        aria-label="Open chat"
      >
        <MessageCircle className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {Math.min(unreadCount, 9)}
          </span>
        )}
      </button>
    );
  }

  // Floating variant
  return (
    <>
      {/* Chat Window Modal */}
      {isOpen && (
        <div className={`fixed ${positionClasses[position]} w-96 h-96 z-40`}>
          <ChatWindow
            userId={userId}
            onClose={handleClose}
            title="Shopping Assistant"
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className={`fixed ${positionClasses[position]} w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-30 flex items-center justify-center group ${
          isOpen ? '-scale-100' : 'scale-100'
        }`}
        title={isOpen ? 'Close chat' : 'Open chat'}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                {Math.min(unreadCount, 9)}
              </span>
            )}
          </div>
        )}
      </button>
    </>
  );
};

export default ChatToggle;
