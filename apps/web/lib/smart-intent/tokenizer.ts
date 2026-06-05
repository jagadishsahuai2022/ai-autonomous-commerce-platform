/**
 * Smart Intent Engine v2 — Tokenizer
 *
 * Normalizes input, removes stopwords, extracts meaningful tokens.
 */

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'it',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'but',
  'not',
  'with',
  'from',
  'by',
  'as',
  'if',
  'so',
  'am',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'they',
  'this',
  'that',
  'these',
  'those',
  'can',
  'could',
  'will',
  'would',
  'should',
  'may',
  'might',
  'must',
  'very',
  'really',
  'just',
  'also',
  'too',
  'some',
  'any',
  'each',
  'want',
  'need',
  'looking',
  'find',
  'get',
  'buy',
  'show',
  'give',
  'please',
  'thanks',
  'help',
  'tell',
  'suggest',
  'recommend',
  'something',
  'thing',
  'one',
  'ones',
  'like',
  'me',
  'ok',
  'okay',
]);

// Common contractions & misspellings
const NORMALIZATION_MAP: Record<string, string> = {
  dont: "don't",
  cant: "can't",
  wont: "won't",
  im: "i'm",
  ive: "i've",
  earphone: 'earphones',
  headphone: 'headphones',
  earbud: 'earbuds',
  lappy: 'laptop',
  mob: 'mobile',
  fone: 'phone',
  tv: 'television',
  ac: 'air conditioner',
  fridge: 'refrigerator',
  washer: 'washing machine',
};

/**
 * Tokenize and normalize a raw user query.
 * Returns lowercase, de-duped, stopword-free tokens + the original normalized string.
 */
export function tokenize(raw: string): { tokens: string[]; normalized: string } {
  // Lowercase and clean
  let text = raw.toLowerCase().trim();

  // Expand known abbreviations/misspellings
  for (const [from, to] of Object.entries(NORMALIZATION_MAP)) {
    // Only replace whole words (word boundary)
    const re = new RegExp(`\\b${escapeRegex(from)}\\b`, 'g');
    text = text.replace(re, to);
  }

  // Normalise price-like patterns: "under 50k" → "under 50000"
  text = text.replace(/(\d+\.?\d*)\s*k\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  text = text.replace(/(\d+\.?\d*)\s*l(?:akh)?\b/gi, (_, n) =>
    String(Math.round(parseFloat(n) * 100000))
  );

  // Normalise "₹" and "rs" prefixes
  text = text.replace(/[₹$]\s*/g, '');
  text = text.replace(/\brs\.?\s*/g, '');
  text = text.replace(/\brunpees?\s*/g, '');

  // Strip commas inside numbers: "50,000" → "50000", "1,50,000" → "150000"
  text = text.replace(/(\d),(?=\d)/g, '$1');

  // Replace hyphens between numbers with ranges: "20000-40000"
  // Keep them — the entity extractor handles them.

  const normalized = text;

  // Tokenize: split on whitespace and punctuation (keep numbers+letters together)
  const rawTokens = text
    .split(/[\s,;!?.]+/)
    .map((t) => t.replace(/^['"(]+|['")\]]+$/g, ''))
    .filter(Boolean);

  // Remove stopwords and deduplicate
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
  }

  return { tokens, normalized };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
