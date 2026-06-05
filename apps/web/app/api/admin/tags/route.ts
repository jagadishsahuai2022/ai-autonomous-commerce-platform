import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── GET: List all tags with product counts ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const tagType = searchParams.get('tagType');

    const conditions: string[] = [];
    const params: (string | boolean)[] = [];
    let paramIdx = 1;

    if (!includeInactive) {
      conditions.push(`t.status = 'ACTIVE'`);
    }

    if (tagType) {
      conditions.push(`t."tagType" = $${paramIdx}`);
      params.push(tagType);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tags = await dbQuery(
      `SELECT t.*,
        COALESCE(p_agg.total, 0)::text AS "productCount",
        COALESCE(p_agg.approved_cnt, 0)::text AS "approvedCount"
       FROM "ProductTag" t
       LEFT JOIN (
         SELECT "tagId",
                COUNT(DISTINCT "productId") AS total,
                COUNT(DISTINCT "productId") FILTER (WHERE approved = TRUE) AS approved_cnt
         FROM "ProductTagMap"
         GROUP BY "tagId"
       ) p_agg ON p_agg."tagId" = t.id
       ${whereClause}
       ORDER BY t."tagType" ASC, t."sortOrder" ASC, t.name ASC`,
      params
    );

    return NextResponse.json({
      success: true,
      tags: tags.map((t: any) => ({
        ...t,
        productCount: parseInt(t.productCount || '0', 10),
        approvedCount: parseInt(t.approvedCount || '0', 10),
      })),
    });
  } catch (error) {
    console.error('[admin/tags] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// ── POST: Create a new tag ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, tagType, sortOrder } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'name must be ≤ 100 characters' }, { status: 400 });
    }

    const validTypes = ['FEATURE', 'TECHNOLOGY', 'PRICE_RANGE', 'USE_CASE', 'BRAND_TIER', 'QUALITY'];
    const type = validTypes.includes(tagType) ? tagType : 'FEATURE';

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existing = await dbQuery(
      `SELECT id FROM "ProductTag" WHERE slug = $1 OR name = $2`,
      [slug, name.trim()]
    ) as any[];
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
    }

    const rows = await dbQuery(
      `INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder", "createdBy", "modifiedBy")
       VALUES ($1, $2, $3, $4, $5, 'admin', 'admin')
       RETURNING *`,
      [name.trim(), slug, description || null, type, sortOrder || 0]
    ) as any[];

    return NextResponse.json({ success: true, tag: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[admin/tags] POST error:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}

// ── PUT: Update a tag ────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, tagType, status, sortOrder } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'id (number) is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (name && typeof name === 'string') {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updates.push(`name = $${paramIdx}`, `slug = $${paramIdx + 1}`);
      params.push(name.trim(), slug);
      paramIdx += 2;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx}`);
      params.push(description || null);
      paramIdx++;
    }
    if (tagType) {
      updates.push(`"tagType" = $${paramIdx}`);
      params.push(tagType);
      paramIdx++;
    }
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      updates.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (typeof sortOrder === 'number') {
      updates.push(`"sortOrder" = $${paramIdx}`);
      params.push(sortOrder);
      paramIdx++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`"modifiedBy" = 'admin'`, `"updatedAt" = NOW()`);
    params.push(id);

    const rows = await dbQuery(
      `UPDATE "ProductTag" SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tag: rows[0] });
  } catch (error) {
    console.error('[admin/tags] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}

// ── DELETE: Soft-delete tag (set INACTIVE) ───────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const rows = await dbQuery(
      `UPDATE "ProductTag"
       SET status = 'INACTIVE', "modifiedBy" = 'admin', "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tag: rows[0] });
  } catch (error) {
    console.error('[admin/tags] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
