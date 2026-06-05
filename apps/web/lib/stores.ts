import { create } from 'zustand';
import { ChatMessage, Decision, Order, ApprovalRequest, RankedProduct } from '@/types';

// ============ Chat Store ============
interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  error: null,
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// ============ Decision Store ============
interface DecisionState {
  selectedProduct: RankedProduct | null;
  alternatives: RankedProduct[];
  decision: Decision | null;
  loading: boolean;
  setSelectedProduct: (product: RankedProduct | null) => void;
  setAlternatives: (products: RankedProduct[]) => void;
  setDecision: (decision: Decision | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useDecisionStore = create<DecisionState>((set) => ({
  selectedProduct: null,
  alternatives: [],
  decision: null,
  loading: false,
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  setAlternatives: (products) => set({ alternatives: products }),
  setDecision: (decision) => set({ decision }),
  setLoading: (loading) => set({ loading }),
  reset: () =>
    set({
      selectedProduct: null,
      alternatives: [],
      decision: null,
      loading: false,
    }),
}));

// ============ Realtime Store ============
interface RealtimeState {
  status: string;
  progress: number;
  currentStep: string;
  isConnected: boolean;
  setStatus: (status: string) => void;
  setProgress: (progress: number) => void;
  setCurrentStep: (step: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'idle',
  progress: 0,
  currentStep: 'initializing',
  isConnected: false,
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setConnected: (connected) => set({ isConnected: connected }),
  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      currentStep: 'initializing',
    }),
}));

// ============ Order Store ============
interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  addOrder: (order: Order) => void;
  setCurrentOrder: (order: Order | null) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  setLoading: (loading: boolean) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  addOrder: (order) =>
    set((state) => ({
      orders: [...state.orders, order],
    })),
  setCurrentOrder: (order) => set({ currentOrder: order }),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    })),
  setLoading: (loading) => set({ loading }),
}));

// ============ Approval Store ============
interface ApprovalState {
  approval: ApprovalRequest | null;
  loading: boolean;
  setApproval: (approval: ApprovalRequest | null) => void;
  updateApprovalStatus: (status: 'approved' | 'rejected' | 'modified') => void;
  setLoading: (loading: boolean) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  approval: null,
  loading: false,
  setApproval: (approval) => set({ approval }),
  updateApprovalStatus: (status) =>
    set((state) => ({
      approval: state.approval ? { ...state.approval, status } : null,
    })),
  setLoading: (loading) => set({ loading }),
}));
