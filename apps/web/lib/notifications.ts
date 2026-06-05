/**
 * Notification Service
 *
 * Sends notifications via multiple channels:
 *  - In-app toast (immediate)
 *  - Email (via API stub — integrate with SendGrid/SES in production)
 *  - WhatsApp (via API stub — integrate with Twilio/WhatsApp Business API)
 *  - SMS (via API stub — integrate with Twilio/SNS in production)
 *
 * All external channel calls are fire-and-forget with error logging.
 * The API route records the notification attempt and returns immediately.
 */

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

export interface NotificationPayload {
  userId?: string;
  title: string;
  message: string;
  type:
    | 'order_success'
    | 'order_failed'
    | 'refund_initiated'
    | 'refund_completed'
    | 'spending_limit_changed'
    | 'wallet_funded'
    | 'wallet_debited'
    | 'security_alert'
    | 'general';
  channels: NotificationChannel[];
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channelResults: Record<NotificationChannel, { sent: boolean; error?: string }>;
}

/**
 * Send notification to the API which dispatches to all requested channels.
 * Fire-and-forget by default; use `await` if you need confirmation.
 */
export async function sendNotification(
  payload: NotificationPayload,
  token?: string | null
): Promise<NotificationResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        channelResults: Object.fromEntries(
          payload.channels.map((ch) => [ch, { sent: false, error: err.error || 'API error' }])
        ) as any,
      };
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      channelResults: Object.fromEntries(
        payload.channels.map((ch) => [ch, { sent: false, error: err.message }])
      ) as any,
    };
  }
}

/** Convenience: notify on order placement (success) */
export function notifyOrderSuccess(orderId: string, total: number, token?: string | null) {
  return sendNotification(
    {
      title: 'Order Placed Successfully',
      message: `Your order ${orderId} for ₹${total.toLocaleString('en-IN')} has been placed successfully.`,
      type: 'order_success',
      channels: ['email', 'whatsapp', 'sms'],
      metadata: { orderId, total },
    },
    token
  );
}

/** Convenience: notify on order failure */
export function notifyOrderFailed(
  orderId: string,
  reason: string,
  amount: number,
  token?: string | null
) {
  return sendNotification(
    {
      title: 'Order Failed',
      message: `Order ${orderId} failed: ${reason}. ${amount > 0 ? `₹${amount.toLocaleString('en-IN')} will be refunded within 48 hours.` : ''}`,
      type: 'order_failed',
      channels: ['email', 'whatsapp', 'sms'],
      metadata: { orderId, reason, amount },
    },
    token
  );
}

/** Convenience: notify on spending limit changes */
export function notifySpendingLimitChanged(
  changes: { field: string; oldValue: string; newValue: string }[],
  token?: string | null
) {
  const changeList = changes
    .map((c) => `${c.field}: ${c.oldValue || 'not set'} → ${c.newValue || 'not set'}`)
    .join(', ');
  return sendNotification(
    {
      title: 'Spending Limits Updated',
      message: `Your wallet spending limits have been updated: ${changeList}. If you did not make this change, please secure your account immediately.`,
      type: 'spending_limit_changed',
      channels: ['email', 'whatsapp', 'sms'],
      metadata: { changes },
    },
    token
  );
}

/** Convenience: notify on refund initiation */
export function notifyRefundInitiated(orderId: string, amount: number, token?: string | null) {
  return sendNotification(
    {
      title: 'Refund Initiated',
      message: `A refund of ₹${amount.toLocaleString('en-IN')} has been initiated for order ${orderId}. It will be credited to your wallet within 48 hours.`,
      type: 'refund_initiated',
      channels: ['email', 'whatsapp', 'sms'],
      metadata: { orderId, amount },
    },
    token
  );
}

/** Convenience: notify on refund completion */
export function notifyRefundCompleted(orderId: string, amount: number, token?: string | null) {
  return sendNotification(
    {
      title: 'Refund Completed',
      message: `₹${amount.toLocaleString('en-IN')} has been refunded to your wallet for order ${orderId}.`,
      type: 'refund_completed',
      channels: ['email', 'whatsapp'],
      metadata: { orderId, amount },
    },
    token
  );
}
