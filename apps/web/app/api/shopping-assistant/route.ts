import { NextRequest, NextResponse } from 'next/server';

// Server-side only — use Docker-internal URL. NEXT_PUBLIC_API_URL is a
// relative path (/api/v1) in Docker and cannot be used for server-side fetch.
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';
const SHOPPING_SERVICE_URL = process.env.SHOPPING_SERVICE_URL || 'http://localhost:3004';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, criteria, userId } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required' }, { status: 400 });
    }

    // Try shopping service first, fallback to main API
    try {
      const response = await fetch(`${SHOPPING_SERVICE_URL}/rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products, criteria, userId }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (shopError) {
      console.warn('Shopping service unavailable, trying main API:', shopError);
    }

    // Fallback: Use main API
    const response = await fetch(`${API_URL}/shopping/rank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
      },
      body: JSON.stringify({ products, criteria, userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to rank products' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Shopping assistant API error:', error);

    // Fallback: Return products as-is sorted by relevance
    return NextResponse.json(
      {
        success: false,
        warning: 'Using default ranking',
        products: [],
      },
      { status: 500 }
    );
  }
}
