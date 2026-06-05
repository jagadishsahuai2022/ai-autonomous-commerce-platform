/**
 * POST /api/notifications/send
 *
 * Dispatches notifications to requested channels (email, whatsapp, sms).
 * In production, integrate with:
 *  - Email: SendGrid, AWS SES, or Resend
 *  - WhatsApp: Twilio WhatsApp Business API or Meta Cloud API
 *  - SMS: Twilio, AWS SNS, or MSG91
 *
 * Currently logs notifications and records them in localStorage-compatible
 * response for the frontend to display.
 */

import { NextRequest, NextResponse } from 'next/server';

interface NotificationRequest {
  title: string;
  message: string;
  type: string;
  channels: string[];
  metadata?: Record<string, unknown>;
}

// In production, these would call actual APIs
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ sent: boolean; error?: string }> {
  // TODO: Integrate with SendGrid/SES
  console.log(`[NOTIFICATION:EMAIL] To: ${to} | Subject: ${subject} | Body: ${body.slice(0, 200)}`);
  return { sent: true };
}

async function sendWhatsApp(
  phone: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  // TODO: Integrate with Twilio WhatsApp Business API
  console.log(`[NOTIFICATION:WHATSAPP] To: ${phone} | Message: ${message.slice(0, 200)}`);
  return { sent: true };
}

async function sendSMS(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  // TODO: Integrate with Twilio/SNS/MSG91
  console.log(`[NOTIFICATION:SMS] To: ${phone} | Message: ${message.slice(0, 160)}`);
  return { sent: true };
}

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();

    if (!body.title || !body.message || !body.channels?.length) {
      return NextResponse.json(
        { error: 'title, message, and channels are required' },
        { status: 400 }
      );
    }

    const validChannels = ['email', 'whatsapp', 'sms'];
    const channels = body.channels.filter((ch) => validChannels.includes(ch));

    // Extract user info from auth token if available
    const authHeader = request.headers.get('Authorization');
    const userEmail = 'demo@example.com'; // In production: decode JWT → user email
    const userPhone = '+91-9999999999'; // In production: fetch from user profile

    const channelResults: Record<string, { sent: boolean; error?: string }> = {};

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            channelResults.email = await sendEmail(userEmail, body.title, body.message);
            break;
          case 'whatsapp':
            channelResults.whatsapp = await sendWhatsApp(
              userPhone,
              `*${body.title}*\n${body.message}`
            );
            break;
          case 'sms':
            channelResults.sms = await sendSMS(
              userPhone,
              `${body.title}: ${body.message}`.slice(0, 160)
            );
            break;
        }
      } catch (err: any) {
        channelResults[channel] = { sent: false, error: err.message };
      }
    }

    const allSent = Object.values(channelResults).every((r) => r.sent);

    return NextResponse.json({
      success: allSent,
      channelResults,
      notification: {
        id: `notif-${Date.now()}`,
        title: body.title,
        message: body.message,
        type: body.type,
        channels,
        timestamp: new Date().toISOString(),
        metadata: body.metadata,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
