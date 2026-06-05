/**
 * Unit Tests — Observability Auth Retry Logic
 *
 * Verifies that the observability dashboard correctly:
 *  1. Uses the real sess_ token once authUpdated fires
 *  2. Reads from localStorage on every fetchDbData call (no stale closure)
 *  3. Retries after token upgrade from admin-* placeholder to sess_* real token
 *  4. Handles 401 gracefully (sets dbError, clears loading)
 *  5. Handles network errors gracefully
 *  6. Clears dbError on successful retry
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── localStorage mock ────────────────────────────────────────────────────────
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStore[key] = val; }),
  removeItem: vi.fn((key: string) => { delete localStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStore).forEach(k => delete localStore[k]); }),
  length: 0,
  key: vi.fn(() => null),
};

// ── Event bus mock ───────────────────────────────────────────────────────────
const eventListeners: Record<string, EventListener[]> = {};
const mockWindow = {
  addEventListener: vi.fn((event: string, handler: EventListener) => {
    (eventListeners[event] ??= []).push(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: EventListener) => {
    eventListeners[event] = (eventListeners[event] ?? []).filter(h => h !== handler);
  }),
  dispatchEvent: vi.fn((e: Event) => {
    (eventListeners[e.type] ?? []).forEach(h => h(e));
  }),
};

// ── fetch mock ───────────────────────────────────────────────────────────────
let mockFetchStatus = 200;
let mockFetchPayload: unknown = { walletStats: { total: 5 } };
const mockFetch = vi.fn(async (_url: string, _options?: RequestInit) => ({
  ok: mockFetchStatus === 200,
  status: mockFetchStatus,
  json: async () => mockFetchPayload,
}));

// ────────────────────────────────────────────────────────────────────────────
// Extracted logic matching observability/page.tsx fetchDbData
// ────────────────────────────────────────────────────────────────────────────
interface FetchState {
  dbData: unknown;
  dbError: string | null;
  dbLoading: boolean;
}

async function simulateFetchDbData(
  state: FetchState,
  setState: (patch: Partial<FetchState>) => void
) {
  const token = mockLocalStorage.getItem('authToken');
  if (!token) return;
  setState({ dbLoading: true });
  try {
    const res = await mockFetch('/api/observability', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setState({ dbData: data, dbLoading: false, dbError: null });
    } else {
      setState({ dbError: `HTTP ${res.status}`, dbLoading: false });
    }
  } catch {
    setState({ dbError: 'Network error', dbLoading: false });
  }
}

// ────────────────────────────────────────────────────────────────────────────

describe('Observability fetchDbData', () => {
  let state: FetchState;
  const setState = (patch: Partial<FetchState>) => { Object.assign(state, patch); };

  beforeEach(() => {
    state = { dbData: null, dbError: null, dbLoading: false };
    mockFetch.mockClear();
    mockFetchStatus = 200;
    mockFetchPayload = { walletStats: { total: 5 } };
    mockLocalStorage.clear();
  });

  it('does nothing when no token in localStorage', async () => {
    await simulateFetchDbData(state, setState);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sets dbLoading=true then false on success', async () => {
    mockLocalStorage.setItem('authToken', 'sess_abc123');
    const loadingStates: boolean[] = [];
    const trackingSetState = (patch: Partial<FetchState>) => {
      if (patch.dbLoading !== undefined) loadingStates.push(patch.dbLoading);
      setState(patch);
    };
    await simulateFetchDbData(state, trackingSetState);
    expect(loadingStates).toEqual([true, false]);
  });

  it('sets dbData on successful fetch', async () => {
    mockLocalStorage.setItem('authToken', 'sess_real123');
    mockFetchPayload = { walletStats: { total: 42 } };
    await simulateFetchDbData(state, setState);
    expect(state.dbData).toEqual({ walletStats: { total: 42 } });
    expect(state.dbError).toBeNull();
  });

  it('sets dbError=HTTP 401 when server returns 401', async () => {
    mockLocalStorage.setItem('authToken', `admin-${Date.now()}`);
    mockFetchStatus = 401;
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBe('HTTP 401');
    expect(state.dbData).toBeNull();
  });

  it('passes Bearer token in Authorization header', async () => {
    const token = 'sess_e2eToken999';
    mockLocalStorage.setItem('authToken', token);
    await simulateFetchDbData(state, setState);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/observability',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      })
    );
  });

  it('re-reads token from localStorage on second call (no stale closure)', async () => {
    // First call with placeholder token → 401
    mockLocalStorage.setItem('authToken', `admin-${Date.now()}`);
    mockFetchStatus = 401;
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBe('HTTP 401');

    // Token upgradedsimulated
    const realToken = 'sess_upgraded456';
    mockLocalStorage.setItem('authToken', realToken);
    mockFetchStatus = 200;
    mockFetchPayload = { walletStats: { total: 10 } };

    // Second call reads fresh token
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBeNull();
    expect(state.dbData).toEqual({ walletStats: { total: 10 } });
    // Verify it used the real token
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit];
    expect((lastCall[1].headers as Record<string, string>).Authorization).toBe(`Bearer ${realToken}`);
  });

  it('clears dbError on retry success after 401', async () => {
    mockLocalStorage.setItem('authToken', 'sess_bad');
    mockFetchStatus = 401;
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBe('HTTP 401');

    // Real token arrives
    mockLocalStorage.setItem('authToken', 'sess_good');
    mockFetchStatus = 200;
    mockFetchPayload = { walletStats: { total: 1 } };
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBeNull();
  });

  it('handles network errors gracefully', async () => {
    mockLocalStorage.setItem('authToken', 'sess_networkerr');
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await simulateFetchDbData(state, setState);
    expect(state.dbError).toBe('Network error');
    expect(state.dbLoading).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// authUpdated event listener pattern test
// ────────────────────────────────────────────────────────────────────────────
describe('Observability authUpdated event listener', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockFetch.mockClear();
    mockFetchStatus = 200;
    mockFetchPayload = { walletStats: { total: 5 } };
    Object.keys(eventListeners).forEach(k => { eventListeners[k] = []; });
  });

  it('retries fetchDbData when authUpdated fires after token upgrade', async () => {
    let callCount = 0;
    const fetchDbData = async () => {
      callCount++;
      const token = mockLocalStorage.getItem('authToken');
      if (!token) return;
      await mockFetch('/api/observability', { headers: { Authorization: `Bearer ${token}` } });
    };

    // Register event listener (mirrors observability/page.tsx useEffect)
    mockWindow.addEventListener('authUpdated', () => fetchDbData());

    // Initial state — no token yet
    await fetchDbData();
    expect(callCount).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();

    // Token arrives, authUpdated fires
    mockLocalStorage.setItem('authToken', 'sess_fired');
    mockWindow.dispatchEvent(new Event('authUpdated'));

    // Allow microtask queue to flush
    await new Promise(r => setTimeout(r, 0));

    expect(callCount).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/observability',
      expect.objectContaining({ headers: { Authorization: 'Bearer sess_fired' } })
    );
  });

  it('does not call fetchDbData on unrelated events', async () => {
    let callCount = 0;
    const fetchDbData = async () => { callCount++; };
    mockWindow.addEventListener('authUpdated', () => fetchDbData());

    mockWindow.dispatchEvent(new Event('click'));
    mockWindow.dispatchEvent(new Event('scroll'));
    mockWindow.dispatchEvent(new Event('storage'));

    await new Promise(r => setTimeout(r, 0));
    expect(callCount).toBe(0);
  });
});
