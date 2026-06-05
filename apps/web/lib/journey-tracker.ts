'use client';

/**
 * Journey Tracker — client-side event tracking
 *
 * Records user journey events (clicks → wishlist → cart → checkout → payment → order)
 * and sends them to /api/events/journey for persistence.
 *
 * Usage:
 *   trackJourneyEvent('product_clicked', { productId, productName, productCategory, productPrice })
 *   trackJourneyEvent('cart_added', { productId, productName, productCategory, productPrice })
 *   trackJourneyEvent('checkout_started', { metadata: { cartTotal, itemCount } })
 */

export type JourneyEventType =
  | 'product_clicked'
  | 'wishlist_added'
  | 'wishlist_removed'
  | 'cart_added'
  | 'cart_removed'
  | 'checkout_started'
  | 'payment_started'
  | 'payment_success'
  | 'payment_failed'
  | 'order_placed'
  | 'order_failed';

export interface JourneyEventPayload {
  productId?: string;
  productName?: string;
  productCategory?: string;
  productPrice?: number;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

// ── Persistent session/journey IDs stored in localStorage ────────────────────
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  let id = localStorage.getItem('dc_session_id');
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('dc_session_id', id);
  }
  return id;
}

function getOrCreateJourneyId(eventType: JourneyEventType): string {
  if (typeof window === 'undefined') return '';
  const purchaseStarts: JourneyEventType[] = ['cart_added', 'checkout_started'];
  const purchaseEnds: JourneyEventType[] = ['order_placed', 'order_failed', 'payment_failed'];

  let jid = localStorage.getItem('dc_journey_id');

  if (!jid && purchaseStarts.includes(eventType)) {
    jid = `jrny-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('dc_journey_id', jid);
  }

  if (jid && purchaseEnds.includes(eventType)) {
    // End of journey — clear for next purchase flow
    setTimeout(() => localStorage.removeItem('dc_journey_id'), 2000);
  }

  return jid || '';
}

/**
 * Fire-and-forget journey event tracking.
 * Errors are swallowed so tracking never breaks the UI.
 */
export function trackJourneyEvent(
  eventType: JourneyEventType,
  payload: JourneyEventPayload = {}
): void {
  if (typeof window === 'undefined') return;

  const sessionId = getSessionId();
  const journeyId = getOrCreateJourneyId(eventType);

  // Don't await — pure fire-and-forget
  fetch('/api/events/journey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      journeyId: journeyId || undefined,
      eventType,
      ...payload,
    }),
    // Short timeout so it doesn't block the UI
    signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
  }).catch(() => {
    // Silently discard tracking errors
  });
}
