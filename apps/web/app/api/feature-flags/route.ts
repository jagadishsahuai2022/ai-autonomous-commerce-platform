import { NextRequest, NextResponse } from 'next/server';

// Server-side only — use Docker-internal URL. NEXT_PUBLIC_API_URL is a
// relative path (/api/v1) in Docker and cannot be used for server-side fetch.
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

// Default flags returned when the backend is unavailable
const DEFAULT_FLAGS = [
  { name: 'ai-recommendations', enabled: true },
  { name: 'checkout-v2', enabled: false },
  { name: 'loyalty-program', enabled: true },
  { name: 'social-checkout', enabled: false },
  { name: 'ai-chat', enabled: true },
  { name: 'dark-mode', enabled: true },
  { name: 'new-dashboard', enabled: true },
];

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/feature-flags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(DEFAULT_FLAGS, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
      });
    }

    const body = await response.json();
    // Backend wraps response as { success: true, data: [...] }
    const flags = Array.isArray(body) ? body : (body.data ?? body.features ?? DEFAULT_FLAGS);

    return NextResponse.json(flags, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  } catch {
    // Return default flags when backend is completely unreachable
    return NextResponse.json(DEFAULT_FLAGS, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  }
}
