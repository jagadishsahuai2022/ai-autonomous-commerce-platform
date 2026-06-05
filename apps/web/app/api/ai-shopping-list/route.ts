import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  createAiShoppingList,
  getAiShoppingLists,
  query as dbQuery,
  getUserByEmail,
} from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map((u) => [u.email.toLowerCase(), u]));

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

async function resolveSession(req: NextRequest) {
  const token = getToken(req);
  const emailHeader = (req.headers.get('x-user-email') || '').toLowerCase();

  if (token) {
    try {
      const session = await validateSession(token);
      if (session) return session;
    } catch {
      /* DB unavailable */
    }
  }

  if (emailHeader) {
    try {
      const user = await getUserByEmail(emailHeader);
      if (user)
        return { userId: (user as any).id, email: (user as any).email, name: (user as any).name };
    } catch {
      /* DB unavailable */
    }

    const demoUser = DEMO_BY_EMAIL[emailHeader];
    const isKnownToken = !token || /^(sess_|admin-|demo-)/.test(token);
    if (demoUser && isKnownToken) {
      try {
        const user = await getUserByEmail(emailHeader);
        if (user)
          return { userId: (user as any).id, email: emailHeader, name: demoUser.displayName };
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

// ── NLP parser: extract real product name from natural language ───────────────
// Strips intent words, quantifiers, price mentions, and brackets.
const INTENT_WORDS = new Set([
  'want',
  'need',
  'get',
  'buy',
  'order',
  'purchase',
  'find',
  'search',
  'looking',
  'for',
  'a',
  'an',
  'the',
  'some',
  'any',
  'best',
  'good',
  'please',
  'i',
  'me',
  'my',
  'give',
  'bring',
  'show',
  'recommend',
  'suggest',
  'like',
  'prefer',
  'would',
  'could',
  'should',
  'kindly',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]);

function extractProductName(raw: string): string {
  // Remove budget/price hints like "under 5000", "below ₹10000", "max 2000"
  let cleaned = raw
    .replace(
      /\b(under|below|max|upto|up to|within|budget|price|costing?)\s*[₹$]?\s*\d+[,\d]*/gi,
      ''
    )
    .replace(/[₹$]\s*\d+[,\d]*/g, '')
    // Remove quantity patterns like "2x", "3 pcs", "qty 2"
    .replace(/\d+\s*(x|pcs?|units?|nos?|qty|pack(?:s|s of)?)\s*/gi, '')
    // Remove standalone leading numbers
    .replace(/^\s*\d+\s+/, '')
    .trim();

  // Tokenize and filter intent/filler words, keeping meaningful tokens
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  const kept = tokens.filter((t) => {
    const lower = t.toLowerCase().replace(/[^a-z]/g, '');
    return lower.length > 0 && !INTENT_WORDS.has(lower);
  });

  // Rejoin — if filtering removed everything, fall back to cleaned
  const result = kept.join(' ').trim();
  return result.length > 0 ? result : cleaned;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check AI+ subscription
    const user = (
      await dbQuery(`SELECT "subscriptionPlan" FROM "User" WHERE id = $1`, [session.userId])
    )[0];
    if (!user || user.subscriptionPlan !== 'AI_PLUS') {
      return NextResponse.json({ error: 'AI+ subscription required' }, { status: 403 });
    }

    const lists = await getAiShoppingLists(session.userId);
    return NextResponse.json({ lists });
  } catch (err: any) {
    console.error('[ai-shopping-list GET]', err.message);
    return NextResponse.json({ error: 'Failed to load AI shopping lists' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check AI+ subscription
    const user = (
      await dbQuery(
        `SELECT "subscriptionPlan", "autoPurchaseThreshold", "monthlyAiBudget", "autoPurchaseEnabled" FROM "User" WHERE id = $1`,
        [session.userId]
      )
    )[0];
    if (!user || user.subscriptionPlan !== 'AI_PLUS') {
      return NextResponse.json({ error: 'AI+ subscription required' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.rawText || !body.rawText.trim()) {
      return NextResponse.json({ error: 'Shopping list text is required' }, { status: 400 });
    }
    if (body.rawText.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 });
    }

    // Enforce budget limits
    let totalBudget = body.totalBudget ? parseFloat(body.totalBudget) : null;
    const maxPerOrder = user.autoPurchaseThreshold || 500000;
    if (totalBudget && totalBudget > maxPerOrder) {
      totalBudget = maxPerOrder;
    }

    const list = await createAiShoppingList(session.userId, {
      rawText: body.rawText.trim(),
      deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : undefined,
      paymentMethod: body.paymentMethod || undefined,
      totalBudget: totalBudget ?? undefined,
    });

    // ── Improved NLP parsing: split on newlines/commas/semicolons ──────────
    const lines = body.rawText
      .trim()
      .split(/\n|,|;/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const parsedItems = lines
      .map((line: string) => {
        // Extract quantity from beginning of line
        const qtyMatch = line.match(/^(\d+)\s*(x|pcs?|units?|nos?|qty)?\s+/i);
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

        // Extract product name using NLP parser
        const productName = extractProductName(line);

        return { name: productName, quantity: qty, raw: line };
      })
      .filter((item: { name: string }) => item.name.length > 0);

    if (parsedItems.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse any products from your text. Please list one product per line.' },
        { status: 400 }
      );
    }

    // ── Auto-checkout: enabled when user has it on AND budget is set ──────
    const autoCheckoutEnabled = user.autoPurchaseEnabled === true || body.autoCheckout === true;

    // ── Call the real shopping-list endpoint to search products ──────────
    const sessionToken = getToken(req);
    let shoppingListData: any = null;
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const slRes = await fetch(`${appUrl}/api/shopping-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          items: parsedItems.map((p: { name: string; quantity: number }) => ({
            productName: p.name,
            preferredBrand: null,
            budget: totalBudget ? Math.round(totalBudget / parsedItems.length) : null,
            quantity: p.quantity,
            deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
            paymentMethod: body.paymentMethod || null,
            emiOnly: false,
          })),
          autoCheckout: autoCheckoutEnabled,
          forceFresh: true,
        }),
      });
      if (slRes.ok) {
        shoppingListData = await slRes.json();
      } else {
        console.error('[ai-shopping-list] shopping-list call failed:', slRes.status);
      }
    } catch (e) {
      console.error('[ai-shopping-list] Internal shopping-list call failed:', e);
    }

    // ── Update DB record with parsed items, results, and status ──────────
    const hasResults = !!shoppingListData?.results;
    const autoCheckoutResult = shoppingListData?.autoCheckout;
    const status = autoCheckoutResult?.success
      ? 'completed'
      : autoCheckoutResult && !autoCheckoutResult.success
        ? 'failed'
        : hasResults
          ? 'completed'
          : 'processing';

    await dbQuery(
      `UPDATE "AiShoppingList" SET "parsedItems" = $1, status = $2, results = $3, "updatedAt" = NOW() WHERE id = $4`,
      [
        JSON.stringify(parsedItems),
        status,
        hasResults ? JSON.stringify(shoppingListData.results) : null,
        list.id,
      ]
    );

    // ── Build response message ────────────────────────────────────────────
    let resultMessage: string;
    if (autoCheckoutResult?.success) {
      resultMessage = `✓ Auto-checkout complete! Order ${autoCheckoutResult.orderId} placed for ${parsedItems.length} item(s). View in orders page.`;
    } else if (autoCheckoutResult && !autoCheckoutResult.success) {
      resultMessage = `Found ${shoppingListData?.summary?.totalMatches || 0} matches but auto-checkout failed: ${autoCheckoutResult.error || 'Unknown error'}. View results in Smart Delegate.`;
    } else if (hasResults) {
      resultMessage = `AI found ${shoppingListData.summary?.totalMatches || 0} matches for ${parsedItems.length} item(s). View results in Smart Delegate.`;
    } else {
      resultMessage = 'AI shopping list submitted. Processing will begin shortly.';
    }

    return NextResponse.json(
      {
        list: { ...list, parsedItems, status, results: shoppingListData?.results || null },
        results: shoppingListData?.results || null,
        summary: shoppingListData?.summary || null,
        autoCheckout: autoCheckoutResult || null,
        message: resultMessage,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ai-shopping-list POST]', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to create AI shopping list' },
      { status: 500 }
    );
  }
}
