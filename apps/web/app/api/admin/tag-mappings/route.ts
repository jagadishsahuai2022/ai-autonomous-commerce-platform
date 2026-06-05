import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── GET: Get all tag mappings for a product ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const tagId = searchParams.get('tagId');

    if (productId) {
      const pid = parseInt(productId, 10);
      if (isNaN(pid)) {
        return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
      }

      const mappings = await dbQuery(
        `SELECT ptm."tagId", ptm.approved, ptm."approvedBy", ptm."approvedAt",
                pt.name, pt.slug, pt."tagType", pt.status
         FROM "ProductTagMap" ptm
         JOIN "ProductTag" pt ON pt.id = ptm."tagId"
         WHERE ptm."productId" = $1
         ORDER BY pt."tagType" ASC, pt.name ASC`,
        [pid]
      );

      return NextResponse.json({ success: true, productId: pid, tags: mappings });
    }

    if (tagId) {
      const tid = parseInt(tagId, 10);
      if (isNaN(tid)) {
        return NextResponse.json({ error: 'Invalid tagId' }, { status: 400 });
      }

      const mappings = await dbQuery(
        `SELECT ptm."productId", ptm.approved, ptm."approvedBy", ptm."approvedAt",
                p.name AS "productName", p.price, p.category
         FROM "ProductTagMap" ptm
         JOIN "Product" p ON p.id = ptm."productId"
         WHERE ptm."tagId" = $1
         ORDER BY p.name ASC
         LIMIT 100`,
        [tid]
      );

      return NextResponse.json({ success: true, tagId: tid, products: mappings });
    }

    return NextResponse.json({ error: 'productId or tagId query param is required' }, { status: 400 });
  } catch (error) {
    console.error('[admin/tag-mappings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tag mappings' }, { status: 500 });
  }
}

// ── POST: Add product ↔ tag mapping ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, tagId, approved } = body;

    if (!productId || typeof productId !== 'number') {
      return NextResponse.json({ error: 'productId (number) is required' }, { status: 400 });
    }
    if (!tagId || typeof tagId !== 'number') {
      return NextResponse.json({ error: 'tagId (number) is required' }, { status: 400 });
    }

    const isApproved = approved === true;

    await dbQuery(
      `INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("productId", "tagId") DO UPDATE SET approved = $3, "approvedBy" = $4, "approvedAt" = $5`,
      [productId, tagId, isApproved, isApproved ? 'admin' : null, isApproved ? new Date().toISOString() : null]
    );

    return NextResponse.json({ success: true, message: 'Tag mapping added' }, { status: 201 });
  } catch (error) {
    console.error('[admin/tag-mappings] POST error:', error);
    return NextResponse.json({ error: 'Failed to add tag mapping' }, { status: 500 });
  }
}

// ── PUT: Toggle approved status on a tag mapping ─────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, tagId, approved } = body;

    if (!productId || !tagId) {
      return NextResponse.json({ error: 'productId and tagId are required' }, { status: 400 });
    }

    const isApproved = approved === true;

    const rows = await dbQuery(
      `UPDATE "ProductTagMap"
       SET approved = $3, "approvedBy" = $4, "approvedAt" = $5
       WHERE "productId" = $1 AND "tagId" = $2
       RETURNING *`,
      [productId, tagId, isApproved, isApproved ? 'admin' : null, isApproved ? new Date().toISOString() : null]
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tag mapping not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, mapping: rows[0] });
  } catch (error) {
    console.error('[admin/tag-mappings] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update tag mapping' }, { status: 500 });
  }
}

// ── DELETE: Remove product ↔ tag mapping ─────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get('productId') || '', 10);
    const tagId = parseInt(searchParams.get('tagId') || '', 10);

    if (isNaN(productId) || isNaN(tagId)) {
      return NextResponse.json({ error: 'productId and tagId query params required' }, { status: 400 });
    }

    await dbQuery(
      `DELETE FROM "ProductTagMap" WHERE "productId" = $1 AND "tagId" = $2`,
      [productId, tagId]
    );

    return NextResponse.json({ success: true, message: 'Tag mapping removed' });
  } catch (error) {
    console.error('[admin/tag-mappings] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove tag mapping' }, { status: 500 });
  }
}
