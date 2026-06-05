/**
 * saveSearchSession — persists a completed search/ranking session to the DB
 * via POST /api/search-metrics.
 *
 * Silent: never throws — failures are logged only.
 * This runs client-side, so API_URL is always relative (same origin).
 */
export interface SearchSessionPayload {
  userExternalId: string;
  userEmail?: string;
  queryText: string;
  sessionSource: 'shopping-assistant' | 'shopping-list' | 'ai-plus' | 'chat-assistant';
  productsJson?: unknown[];
  timelineJson?: unknown[];
  feedbackJson?: unknown[];
  metricsJson?: Record<string, unknown>;
}

export async function saveSearchSession(payload: SearchSessionPayload): Promise<void> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return; // unauthenticated — skip persist

    await fetch('/api/search-metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent — localStorage flows still work as fallback
  }
}

/**
 * fetchSearchSessions — retrieves sessions from /api/search-metrics
 * Returns own sessions for basic/aiplus, all sessions for admin/analytics.
 */
export async function fetchSearchSessions(params?: {
  limit?: number;
  offset?: number;
  source?: string;
}): Promise<{
  sessions: any[];
  isElevated: boolean;
  role: string;
}> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (!token) return { sessions: [], isElevated: false, role: 'customer' };

  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.source) qs.set('source', params.source);

  const res = await fetch(`/api/search-metrics?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { sessions: [], isElevated: false, role: 'customer' };
  const data = await res.json();
  return {
    sessions: data.sessions ?? [],
    isElevated: data.isElevated ?? false,
    role: data.role ?? 'customer',
  };
}
