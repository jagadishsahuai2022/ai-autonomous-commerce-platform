import { NextRequest, NextResponse } from 'next/server';

// Server-side only — use Docker-internal URL. NEXT_PUBLIC_API_URL is a
// relative path (/api/v1) in Docker and cannot be used for server-side fetch.
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Call streaming endpoint on NestJS backend
    const backendResponse = await fetch(`${API_URL}/shopping/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
      },
      body: JSON.stringify({ message, userId, conversationId }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json();
      return NextResponse.json(
        { error: error.message || 'Failed to stream chat' },
        { status: backendResponse.status }
      );
    }

    // If backend returns streaming response, forward it
    if (backendResponse.headers.get('content-type')?.includes('text/event-stream')) {
      return new NextResponse(backendResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Otherwise return as JSON
    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat stream API error:', error);

    // Return a simple error message
    return NextResponse.json(
      { error: 'Failed to stream chat response. Please try again.' },
      { status: 500 }
    );
  }
}
