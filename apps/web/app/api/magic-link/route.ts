import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLink } from '@/lib/db';

// Public endpoint — no auth required, used in WhatsApp links
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const result = await validateMagicLink(token);
  if (!result) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

  let payload: Record<string, unknown> = {};
  try {
    payload =
      typeof result.payload === 'string' ? JSON.parse(result.payload) : (result.payload ?? {});
  } catch {}
  return NextResponse.json({
    query: payload.query ?? result.purpose,
    results: payload.results ?? [],
    summary: payload.summary ?? {},
    createdAt: result.createdAt,
    expiresAt: result.expiresAt,
  });
}
