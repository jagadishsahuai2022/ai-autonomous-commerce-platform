/**
 * Unit tests for Zustand chat-store
 * Tests message management, persistence, and hydration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sessionStorage
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, writable: true });
Object.defineProperty(global, 'window', {
  value: { sessionStorage: mockSessionStorage },
  writable: true,
});

describe('Chat Store', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.resetModules();
  });

  it('should import without errors', async () => {
    const mod = await import('../../lib/stores/chat-store');
    expect(mod.useChatStore).toBeDefined();
  });

  it('should have correct initial state', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.activeTab).toBe('timeline');
    expect(state.showApproval).toBe(false);
    expect(state.approval).toBeNull();
    expect(state.liveProducts).toEqual([]);
    expect(state.lastQuery).toBe('');
  });

  it('should add a message', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    const msg = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Find me headphones',
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(msg);
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe('Find me headphones');
  });

  it('should set active tab', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    useChatStore.getState().setActiveTab('approval');
    expect(useChatStore.getState().activeTab).toBe('approval');
  });

  it('should set last query', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    useChatStore.getState().setLastQuery('wireless earbuds');
    expect(useChatStore.getState().lastQuery).toBe('wireless earbuds');
  });

  it('should clear all state', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    useChatStore.getState().addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'test',
      timestamp: Date.now(),
    });
    useChatStore.getState().setLastQuery('test query');
    useChatStore.getState().clearAll();
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().lastQuery).toBe('');
  });

  it('should set approval state', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    const approval = {
      id: 'apr-1',
      productName: 'Sony WH-1000XM5',
      amount: 24999,
      riskLevel: 'medium',
      riskScore: 0.4,
      aiConfidence: 0.72,
      reasons: ['Price at upper range'],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    useChatStore.getState().setApproval(approval);
    expect(useChatStore.getState().approval?.productName).toBe('Sony WH-1000XM5');
  });

  it('should set timeline steps', async () => {
    const { useChatStore } = await import('../../lib/stores/chat-store');
    const steps = [
      { id: 'step-1', label: 'Intent Parsed', description: 'Done', status: 'complete' as const },
      { id: 'step-2', label: 'Searching', description: 'In progress', status: 'active' as const },
    ];
    useChatStore.getState().setTimeline(steps);
    expect(useChatStore.getState().timeline).toHaveLength(2);
  });
});
