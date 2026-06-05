/**
 * useChat Hook
 * Custom hook for easy access to chat functionality
 */

import { useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';

interface UseChatOptions {
  autoLoadHistory?: boolean;
  autoLoadSuggestions?: boolean;
}

export const useChat = (userId: number, options: UseChatOptions = {}) => {
  const { autoLoadHistory = true, autoLoadSuggestions = true } = options;

  // Get store actions
  const store = useChatStore();

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      store.setUserId(userId);

      if (autoLoadHistory) {
        store.fetchChatHistory(userId);
      }

      if (autoLoadSuggestions) {
        store.getSuggestions(userId);
      }
    }
  }, [userId, autoLoadHistory, autoLoadSuggestions, store]);

  // Memoized send message
  const sendMessage = useCallback(
    (message: string) => {
      if (userId) {
        return store.sendMessage(userId, message);
      }
      return Promise.reject(new Error('User ID not set'));
    },
    [userId, store]
  );

  // Memoized clear history
  const clearHistory = useCallback(() => {
    if (userId) {
      return store.clearHistory(userId);
    }
    return Promise.reject(new Error('User ID not set'));
  }, [userId, store]);

  return {
    // State
    messages: store.messages,
    loading: store.loading,
    error: store.error,
    suggestions: store.suggestions,
    isOpen: store.isOpen,
    unreadCount: store.unreadCount,

    // Actions
    sendMessage,
    clearHistory,
    toggleWindow: store.toggleWindow,
    setOpen: store.setOpen,
    clearUnread: store.clearUnread,
  };
};

export default useChat;
