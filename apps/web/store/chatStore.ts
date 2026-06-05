/**
 * Chat Store - Zustand
 * Global state management for chat functionality
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  products?: any[];
  intent?: string;
  entities?: {
    keywords?: string[];
    category?: string;
    min_price?: number;
    max_price?: number;
  };
}

export type { ChatMessage };

interface ChatStore {
  // State
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  suggestions: string[];
  isOpen: boolean;
  unreadCount: number;
  userId: number | null;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuggestions: (suggestions: string[]) => void;
  toggleWindow: () => void;
  setOpen: (open: boolean) => void;
  setUserId: (userId: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;

  // Async Actions
  fetchChatHistory: (userId: number) => Promise<void>;
  sendMessage: (userId: number, message: string) => Promise<void>;
  clearHistory: (userId: number) => Promise<void>;
  getSuggestions: (userId: number) => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        messages: [],
        loading: false,
        error: null,
        suggestions: [
          'Show me wireless headphones',
          'Find products under $100',
          'Browse the electronics category',
          'What products do you recommend?',
          'Compare products',
        ],
        isOpen: false,
        unreadCount: 0,
        userId: null,

        // Basic Actions
        setMessages: (messages) => set({ messages }),
        addMessage: (message) => {
          set((state) => ({
            messages: [...state.messages, message],
            unreadCount: message.role === 'assistant' ? state.unreadCount + 1 : state.unreadCount,
          }));
        },
        clearMessages: () => set({ messages: [], unreadCount: 0 }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        setSuggestions: (suggestions) => set({ suggestions }),
        toggleWindow: () => set((state) => ({ isOpen: !state.isOpen })),
        setOpen: (open) => set({ isOpen: open }),
        setUserId: (userId) => set({ userId }),
        incrementUnread: () =>
          set((state) => ({
            unreadCount: state.unreadCount + 1,
          })),
        clearUnread: () => set({ unreadCount: 0 }),

        // Fetch chat history
        fetchChatHistory: async (userId: number) => {
          try {
            set({ loading: true, error: null });
            const response = await fetch(`${API_URL}/ai/chat/history/${userId}?limit=50`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error('Failed to fetch chat history');
            }

            const data = await response.json();
            set({ messages: data.data || [], loading: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch history';
            set({ error: errorMessage, loading: false });
          }
        },

        // Send message
        sendMessage: async (userId: number, message: string) => {
          try {
            set({ loading: true, error: null });

            // Add user message immediately
            const userMessage: ChatMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: message,
              createdAt: new Date().toISOString(),
            };
            get().addMessage(userMessage);

            // Send to API
            const response = await fetch(`${API_URL}/ai/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId,
                message,
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to send message');
            }

            const data = await response.json();

            // Add assistant message
            const assistantMessage: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: data.message,
              createdAt: new Date().toISOString(),
              products: data.products,
              intent: data.intent,
              entities: data.entities,
            };
            get().addMessage(assistantMessage);

            set({ loading: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            set({ error: errorMessage, loading: false });
          }
        },

        // Clear history
        clearHistory: async (userId: number) => {
          try {
            set({ loading: true, error: null });
            const response = await fetch(`${API_URL}/ai/chat/history/${userId}`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              throw new Error('Failed to clear history');
            }

            get().clearMessages();
            set({ loading: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to clear history';
            set({ error: errorMessage, loading: false });
          }
        },

        // Get suggestions
        getSuggestions: async (userId: number) => {
          try {
            const response = await fetch(`${API_URL}/ai/chat/suggestions/${userId}`, {
              method: 'GET',
            });

            if (!response.ok) {
              return; // Keep default suggestions
            }

            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
              set({ suggestions: data.data });
            }
          } catch (error) {
            // Keep default suggestions on error
            console.error('Failed to fetch suggestions:', error);
          }
        },
      }),
      {
        name: 'chat-store',
        partialize: (state) => ({
          userId: state.userId,
          // Don't persist messages to keep fresh data on reload
        }),
      }
    )
  )
);

export default useChatStore;
