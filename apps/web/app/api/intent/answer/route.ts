import { NextRequest, NextResponse } from 'next/server';

// Server-side only — use Docker-internal URL. NEXT_PUBLIC_API_URL is a
// relative path (/api/v1) in Docker and cannot be used for server-side fetch.
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, previousAnswers } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Forward to NestJS backend for question answering
    const response = await fetch(`${API_URL}/shopping/intent/answer-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
      },
      body: JSON.stringify({ question, context, previousAnswers }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to answer question' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Answer question API error:', error);
    return NextResponse.json(
      { error: 'Failed to answer question. Please try again.' },
      { status: 500 }
    );
  }
}
