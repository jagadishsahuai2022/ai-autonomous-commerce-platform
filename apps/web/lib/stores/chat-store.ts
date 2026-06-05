/**
 * Zustand Chat Store — Session-persistent AI Shopping Assistant state
 *
 * Stores chat messages, sidebar state, and approval state in sessionStorage
 * so navigation away and back preserves the full conversation.
 * Cleared only when user clicks "Clear" or closes the browser tab.
 */

import { create } from 'zustand';

export interface ChatStoreMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: string;
  products?: any[];
  questions?: any[];
  metadata?: Record<string, any>;
}

export interface TimelineStepState {
  id: string;
  label: string;
  description?: string;
  status: 'complete' | 'active' | 'pending' | 'idle' | 'error';
  timestamp?: string; // ISO string for serialization
  duration?: number;
  detail?: string;
}

export interface ApprovalState {
  id: string;
  productName: string;
  amount: number;
  riskLevel: string;
  riskScore: number;
  aiConfidence: number;
  reasons: string[];
  expiresAt: string; // ISO string
}

interface ChatState {
  messages: ChatStoreMessage[];
  timeline: TimelineStepState[];
  approval: ApprovalState | null;
  showApproval: boolean;
  activeTab: 'decision' | 'timeline' | 'approval';
  liveProducts: any[];
  pendingApprovalProduct: any | null;
  lastQuery: string;
  /** Maps question id → display label of the user's selected answer */
  answeredQuestions: Record<string, string>;

  // Actions
  addMessage: (msg: ChatStoreMessage) => void;
  setMessages: (msgs: ChatStoreMessage[]) => void;
  setTimeline: (steps: TimelineStepState[]) => void;
  setApproval: (approval: ApprovalState | null) => void;
  setShowApproval: (show: boolean) => void;
  setActiveTab: (tab: 'decision' | 'timeline' | 'approval') => void;
  setLiveProducts: (products: any[]) => void;
  setPendingApprovalProduct: (product: any | null) => void;
  setLastQuery: (query: string) => void;
  addAnsweredQuestion: (id: string, label?: string) => void;
  clearAll: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'dc-chat-store';

function saveToSession(state: Partial<ChatState>) {
  if (typeof window === 'undefined') return;
  try {
    const serializable = {
      messages: state.messages,
      timeline: state.timeline,
      approval: state.approval,
      showApproval: state.showApproval,
      activeTab: state.activeTab,
      liveProducts: state.liveProducts,
      pendingApprovalProduct: state.pendingApprovalProduct,
      lastQuery: state.lastQuery,
      answeredQuestions: state.answeredQuestions,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    /* quota exceeded — ignore */
  }
}

function loadFromSession(): Partial<ChatState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const INITIAL_TIMELINE: TimelineStepState[] = [
  {
    id: 'waiting',
    label: 'Waiting for query',
    description: 'Start a conversation to activate the AI pipeline',
    status: 'active',
  },
];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  timeline: INITIAL_TIMELINE,
  approval: null,
  showApproval: false,
  activeTab: 'timeline',
  liveProducts: [],
  pendingApprovalProduct: null,
  lastQuery: '',
  answeredQuestions: {},

  addMessage: (msg) => {
    const updated = [...get().messages, msg];
    set({ messages: updated });
    saveToSession({ ...get(), messages: updated });
  },

  setMessages: (messages) => {
    set({ messages });
    saveToSession({ ...get(), messages });
  },

  setTimeline: (timeline) => {
    set({ timeline });
    saveToSession({ ...get(), timeline });
  },

  setApproval: (approval) => {
    set({ approval });
    saveToSession({ ...get(), approval });
  },

  setShowApproval: (showApproval) => {
    set({ showApproval });
    saveToSession({ ...get(), showApproval });
  },

  setActiveTab: (activeTab) => {
    set({ activeTab });
    saveToSession({ ...get(), activeTab });
  },

  setLiveProducts: (liveProducts) => {
    set({ liveProducts });
    saveToSession({ ...get(), liveProducts });
  },

  setPendingApprovalProduct: (pendingApprovalProduct) => {
    set({ pendingApprovalProduct });
    saveToSession({ ...get(), pendingApprovalProduct });
  },

  setLastQuery: (lastQuery) => {
    set({ lastQuery });
    saveToSession({ ...get(), lastQuery });
  },

  addAnsweredQuestion: (id, label = '') => {
    // If already stored, don't overwrite with empty label
    if (get().answeredQuestions[id] !== undefined) return;
    const updated = { ...get().answeredQuestions, [id]: label };
    set({ answeredQuestions: updated });
    saveToSession({ ...get(), answeredQuestions: updated });
  },

  clearAll: () => {
    set({
      messages: [],
      timeline: INITIAL_TIMELINE,
      approval: null,
      showApproval: false,
      activeTab: 'timeline',
      liveProducts: [],
      pendingApprovalProduct: null,
      lastQuery: '',
      answeredQuestions: {},
    });
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  },

  hydrate: () => {
    const saved = loadFromSession();
    if (saved) {
      set({
        messages: saved.messages || [],
        timeline: saved.timeline || INITIAL_TIMELINE,
        approval: saved.approval || null,
        showApproval: saved.showApproval || false,
        activeTab: saved.activeTab || 'timeline',
        liveProducts: saved.liveProducts || [],
        pendingApprovalProduct: saved.pendingApprovalProduct || null,
        lastQuery: saved.lastQuery || '',
        // Migrate legacy answeredQuestionIds array → new Record format
        answeredQuestions:
          (saved as any).answeredQuestions ||
          Object.fromEntries(
            ((saved as any).answeredQuestionIds || []).map((id: string) => [id, ''])
          ),
      });
    }
  },
}));
