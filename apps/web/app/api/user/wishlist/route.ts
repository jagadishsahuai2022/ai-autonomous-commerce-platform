import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query, queryOne, getUserByEmail } from '@/lib/db';
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

async function ensureDefaultCollection(userId: number) {
  const existing = await queryOne(
    `SELECT id FROM "WishlistCollection" WHERE "userId" = $1 AND "isDefault" = true`,
    [userId]
  );
  if (existing) return existing.id;
  const row = await queryOne(
    `INSERT INTO "WishlistCollection" ("userId", name, "isDefault") VALUES ($1, 'DC Favorite', true) ON CONFLICT ("userId", name) DO UPDATE SET "isDefault" = true RETURNING id`,
    [userId]
  );
  return row?.id;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // GET ?action=check&productId=xxx — quick check if product is wishlisted
    if (action === 'check') {
      const productId = searchParams.get('productId');
      if (!productId) return NextResponse.json({ wishlisted: false });
      const row = await queryOne(
        `SELECT wi.id, wc.name as "collectionName", wc.id as "collectionId" FROM "WishlistItem" wi JOIN "WishlistCollection" wc ON wi."collectionId" = wc.id WHERE wi."userId" = $1 AND wi."productId" = $2 LIMIT 1`,
        [session.userId, productId]
      );
      return NextResponse.json({
        wishlisted: !!row,
        collectionName: row?.collectionName || null,
        collectionId: row?.collectionId || null,
      });
    }

    // GET ?action=collections — return all collections with items
    await ensureDefaultCollection(session.userId);
    const collections = await query(
      `SELECT id, name, "isDefault", "createdAt" FROM "WishlistCollection" WHERE "userId" = $1 ORDER BY "isDefault" DESC, "createdAt" ASC`,
      [session.userId]
    );
    const items = await query(
      `SELECT wi.id, wi."productId", wi."productName", wi.price, wi."imageUrl", wi.url, wi."addedAt", wi."collectionId" FROM "WishlistItem" wi WHERE wi."userId" = $1 ORDER BY wi."addedAt" DESC`,
      [session.userId]
    );
    return NextResponse.json({ collections, items });
  } catch (err: any) {
    console.error('[wishlist GET]', err.message);
    return NextResponse.json(
      { collections: [], items: [], error: 'Failed to load wishlist' },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // POST { action: 'create_collection', name } — create new collection
    if (action === 'create_collection') {
      const name = (body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Collection name required' }, { status: 400 });
      const row = await queryOne(
        `INSERT INTO "WishlistCollection" ("userId", name) VALUES ($1, $2) ON CONFLICT ("userId", name) DO UPDATE SET "updatedAt" = NOW() RETURNING *`,
        [session.userId, name]
      );
      return NextResponse.json({ collection: row }, { status: 201 });
    }

    // POST { action: 'rename_collection', collectionId, name }
    if (action === 'rename_collection') {
      const { collectionId, name } = body;
      if (!collectionId || !name?.trim())
        return NextResponse.json({ error: 'collectionId and name required' }, { status: 400 });
      await query(
        `UPDATE "WishlistCollection" SET name = $1, "updatedAt" = NOW() WHERE id = $2 AND "userId" = $3 AND "isDefault" = false`,
        [name.trim(), collectionId, session.userId]
      );
      return NextResponse.json({ success: true });
    }

    // POST { action: 'delete_collection', collectionId }
    if (action === 'delete_collection') {
      const { collectionId } = body;
      if (!collectionId)
        return NextResponse.json({ error: 'collectionId required' }, { status: 400 });
      await query(
        `DELETE FROM "WishlistCollection" WHERE id = $1 AND "userId" = $2 AND "isDefault" = false`,
        [collectionId, session.userId]
      );
      return NextResponse.json({ success: true });
    }

    // POST { action: 'move_item', itemId, targetCollectionId }
    if (action === 'move_item') {
      const { itemId, targetCollectionId } = body;
      if (!itemId || !targetCollectionId)
        return NextResponse.json(
          { error: 'itemId and targetCollectionId required' },
          { status: 400 }
        );
      await query(`UPDATE "WishlistItem" SET "collectionId" = $1 WHERE id = $2 AND "userId" = $3`, [
        targetCollectionId,
        itemId,
        session.userId,
      ]);
      return NextResponse.json({ success: true });
    }

    // POST { productId, productName, price, imageUrl, url, collectionId? } — add item
    const { productId, productName, price, imageUrl, url, collectionId } = body;
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

    let targetCollectionId = collectionId;
    if (!targetCollectionId) {
      targetCollectionId = await ensureDefaultCollection(session.userId);
    }

    const item = await queryOne(
      `INSERT INTO "WishlistItem" ("userId", "collectionId", "productId", "productName", price, "imageUrl", url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("userId", "productName") DO UPDATE SET price = EXCLUDED.price, "imageUrl" = EXCLUDED."imageUrl", "collectionId" = EXCLUDED."collectionId"
       RETURNING *`,
      [
        session.userId,
        targetCollectionId,
        productId,
        productName || `Product ${productId}`,
        price ?? null,
        imageUrl ?? null,
        url ?? null,
      ]
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    console.error('[wishlist POST]', err.message);
    return NextResponse.json({ error: 'Failed to save wishlist item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const itemId = searchParams.get('itemId');

    if (itemId) {
      await query('DELETE FROM "WishlistItem" WHERE id = $1 AND "userId" = $2', [
        itemId,
        session.userId,
      ]);
    } else if (productId) {
      await query('DELETE FROM "WishlistItem" WHERE "userId" = $1 AND "productId" = $2', [
        session.userId,
        productId,
      ]);
    } else {
      return NextResponse.json({ error: 'productId or itemId required' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[wishlist DELETE]', err.message);
    return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 });
  }
}
