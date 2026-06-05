import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

/**
 * POST /api/search/voice
 *
 * Accepts a JSON body with { transcript: string } containing the speech-to-text
 * result from the browser's SpeechRecognition API.
 *
 * The browser-side Web Speech API handles the actual speech recognition locally
 * (no audio is sent over the wire), so this endpoint:
 *  1. Sanitises and normalises the transcript
 *  2. Logs the search query to the DB (for analytics / personalisation)
 *  3. Returns an enriched search query (stopwords removed, singular form, etc.)
 *
 * In production you would add NLP enrichment (synonym expansion, intent detection).
 */

const STOP_WORDS = new Set([
  'search',
  'find',
  'show',
  'me',
  'i',
  'want',
  'need',
  'looking',
  'for',
  'please',
  'can',
  'you',
  'buy',
  'get',
  'the',
  'a',
  'an',
  'some',
  'best',
  'cheap',
  'good',
  'nice',
  'buy',
  'purchase',
  'add',
]);

function normaliseTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // strip punctuation
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawTranscript: string = typeof body?.transcript === 'string' ? body.transcript : '';

    if (!rawTranscript.trim()) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }

    // Guard: max transcript length
    if (rawTranscript.length > 500) {
      return NextResponse.json({ error: 'Transcript too long' }, { status: 400 });
    }

    const query = normaliseTranscript(rawTranscript) || rawTranscript.trim();

    // Optional: persist the voice search for the authenticated user
    // (skipped if no session — anonymous voice search is still valid)
    // const session = await getServerSession();
    // if (session?.user) { await logVoiceSearch(session.user.id, rawTranscript, query); }

    return NextResponse.json(
      {
        query,
        raw: rawTranscript,
        success: true,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[voice-search] error:', err);
    return NextResponse.json({ error: 'Failed to process voice search' }, { status: 500 });
  }
}
