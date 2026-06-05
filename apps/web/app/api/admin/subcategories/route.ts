import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

interface SubCategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number;
  status: string;
  sortOrder: number;
  createdBy: string | null;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: string;
  categoryName: string;
}

// ── GET: List subcategories (optionally filtered by categoryId) ──────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (categoryId) {
      const catId = parseInt(categoryId, 10);
      if (isNaN(catId)) {
        return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
      }
      conditions.push(`psc."categoryId" = $${paramIdx}`);
      params.push(catId);
      paramIdx++;
    }

    if (!includeInactive) {
      conditions.push(`psc.status = 'ACTIVE'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const subCategories = await dbQuery<SubCategoryRow>(
      `SELECT psc.*,
        pc.name AS "categoryName",
        COALESCE(p_agg.cnt, 0)::text AS "productCount"
       FROM "ProductSubCategory" psc
       JOIN "ProductCategory" pc ON pc.id = psc."categoryId"
       LEFT JOIN (
         SELECT "subCategoryId", COUNT(DISTINCT "productId") AS cnt FROM "ProductSubCategoryMap" WHERE approved = TRUE GROUP BY "subCategoryId"
       ) p_agg ON p_agg."subCategoryId" = psc.id
       ${whereClause}
       ORDER BY psc."sortOrder" ASC, psc.name ASC`,
      params
    );

    const result = subCategories.map(sc => ({
      ...sc,
      productCount: parseInt(sc.productCount || '0', 10),
    }));

    return NextResponse.json({
      success: true,
      subCategories: result,
      total: result.length,
      dataSource: 'database',
    });
  } catch (error) {
    console.error('[admin/subcategories] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch subcategories' }, { status: 500 });
  }
}

// ── POST: Create a new subcategory ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, categoryId, description, imageUrl, status, sortOrder } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Subcategory name is required' }, { status: 400 });
    }

    if (!categoryId || typeof categoryId !== 'number') {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Subcategory name must be 100 characters or less' }, { status: 400 });
    }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const validStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const order = typeof sortOrder === 'number' ? sortOrder : 0;
    const desc = typeof description === 'string' ? description.trim() : null;
    const imgUrl = typeof imageUrl === 'string' ? imageUrl.trim() : null;

    // Verify parent category exists
    const parentCat = await dbQuery(`SELECT id FROM "ProductCategory" WHERE id = $1`, [categoryId]);
    if ((parentCat as any[]).length === 0) {
      return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });
    }

    // Check duplicate (name+categoryId or slug)
    const existing = await dbQuery(
      `SELECT id FROM "ProductSubCategory" WHERE slug = $1 OR (LOWER(name) = LOWER($2) AND "categoryId" = $3) LIMIT 1`,
      [slug, trimmedName, categoryId]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: 'A subcategory with this name already exists in this category' }, { status: 409 });
    }

    const rows = await dbQuery(
      `INSERT INTO "ProductSubCategory" (name, slug, description, "imageUrl", "categoryId", status, "sortOrder", "createdBy", "modifiedBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', 'admin')
       RETURNING *`,
      [trimmedName, slug, desc, imgUrl, categoryId, validStatus, order]
    );

    return NextResponse.json({ success: true, subCategory: (rows as any[])[0] }, { status: 201 });
  } catch (error) {
    console.error('[admin/subcategories] POST error:', error);
    return NextResponse.json({ error: 'Failed to create subcategory' }, { status: 500 });
  }
}

// ── PUT: Update a subcategory ────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, categoryId, description, imageUrl, status, sortOrder } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'Subcategory ID is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name && typeof name === 'string') {
      const trimmedName = name.trim();
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updates.push(`name = $${paramIdx}`, `slug = $${paramIdx + 1}`);
      values.push(trimmedName, slug);
      paramIdx += 2;
    }

    if (typeof categoryId === 'number') {
      updates.push(`"categoryId" = $${paramIdx}`);
      values.push(categoryId);
      paramIdx++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIdx}`);
      values.push(typeof description === 'string' ? description.trim() : null);
      paramIdx++;
    }

    if (imageUrl !== undefined) {
      updates.push(`"imageUrl" = $${paramIdx}`);
      values.push(typeof imageUrl === 'string' ? imageUrl.trim() : null);
      paramIdx++;
    }

    if (status === 'ACTIVE' || status === 'INACTIVE') {
      updates.push(`status = $${paramIdx}`);
      values.push(status);
      paramIdx++;
    }

    if (typeof sortOrder === 'number') {
      updates.push(`"sortOrder" = $${paramIdx}`);
      values.push(sortOrder);
      paramIdx++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`"modifiedBy" = 'admin'`, `"updatedAt" = NOW()`);
    values.push(id);

    const rows = await dbQuery(
      `UPDATE "ProductSubCategory" SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Subcategory not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subCategory: (rows as any[])[0] });
  } catch (error) {
    console.error('[admin/subcategories] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update subcategory' }, { status: 500 });
  }
}

// ── DELETE: Soft-delete a subcategory ────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Valid subcategory ID is required' }, { status: 400 });
    }

    const rows = await dbQuery(
      `UPDATE "ProductSubCategory" SET status = 'INACTIVE', "modifiedBy" = 'admin', "updatedAt" = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Subcategory not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subCategory: (rows as any[])[0] });
  } catch (error) {
    console.error('[admin/subcategories] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete subcategory' }, { status: 500 });
  }
}
