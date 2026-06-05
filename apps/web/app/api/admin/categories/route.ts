import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  sortOrder: number;
  createdBy: string | null;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  subCategoryCount: string;
  productCount: string;
}

// ── GET: List all categories with subcategory + product counts ────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const withSubCategories = searchParams.get('withSubCategories') === 'true';

    const statusFilter = includeInactive ? '' : `WHERE pc.status = 'ACTIVE'`;

    const categories = await dbQuery<CategoryRow>(
      `SELECT pc.*,
        COALESCE(sc_agg.cnt, 0)::text AS "subCategoryCount",
        COALESCE(p_agg.cnt, 0)::text AS "productCount"
       FROM "ProductCategory" pc
       LEFT JOIN (
         SELECT "categoryId", COUNT(*) AS cnt FROM "ProductSubCategory" GROUP BY "categoryId"
       ) sc_agg ON sc_agg."categoryId" = pc.id
       LEFT JOIN (
         SELECT "categoryId", COUNT(DISTINCT "productId") AS cnt FROM "ProductCategoryMap" WHERE approved = TRUE GROUP BY "categoryId"
       ) p_agg ON p_agg."categoryId" = pc.id
       ${statusFilter}
       ORDER BY pc."sortOrder" ASC, pc.name ASC`
    );

    let result: any[] = categories.map(c => ({
      ...c,
      subCategoryCount: parseInt(c.subCategoryCount || '0', 10),
      productCount: parseInt(c.productCount || '0', 10),
    }));

    if (withSubCategories) {
      const subCategories = await dbQuery(
        `SELECT psc.*,
          COALESCE(p_agg.cnt, 0)::text AS "productCount"
         FROM "ProductSubCategory" psc
         LEFT JOIN (
           SELECT "subCategoryId", COUNT(DISTINCT "productId") AS cnt FROM "ProductSubCategoryMap" WHERE approved = TRUE GROUP BY "subCategoryId"
         ) p_agg ON p_agg."subCategoryId" = psc.id
         ${includeInactive ? '' : `WHERE psc.status = 'ACTIVE'`}
         ORDER BY psc."sortOrder" ASC, psc.name ASC`
      ) as any[];

      const subMap = new Map<number, any[]>();
      for (const sc of subCategories) {
        const list = subMap.get(sc.categoryId) || [];
        list.push({ ...sc, productCount: parseInt(sc.productCount || '0', 10) });
        subMap.set(sc.categoryId, list);
      }

      result = result.map(c => ({
        ...c,
        subCategories: subMap.get(c.id) || [],
      }));
    }

    return NextResponse.json({
      success: true,
      categories: result,
      total: result.length,
      dataSource: 'database',
    });
  } catch (error) {
    console.error('[admin/categories] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// ── POST: Create a new category ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, imageUrl, status, sortOrder } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Category name must be 100 characters or less' }, { status: 400 });
    }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const validStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const order = typeof sortOrder === 'number' ? sortOrder : 0;
    const desc = typeof description === 'string' ? description.trim() : null;
    const imgUrl = typeof imageUrl === 'string' ? imageUrl.trim() : null;

    // Check duplicate
    const existing = await dbQuery(
      `SELECT id FROM "ProductCategory" WHERE LOWER(name) = LOWER($1) OR slug = $2 LIMIT 1`,
      [trimmedName, slug]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    const rows = await dbQuery(
      `INSERT INTO "ProductCategory" (name, slug, description, "imageUrl", status, "sortOrder", "createdBy", "modifiedBy")
       VALUES ($1, $2, $3, $4, $5, $6, 'admin', 'admin')
       RETURNING *`,
      [trimmedName, slug, desc, imgUrl, validStatus, order]
    );

    return NextResponse.json({ success: true, category: (rows as any[])[0] }, { status: 201 });
  } catch (error) {
    console.error('[admin/categories] POST error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// ── PUT: Update a category ───────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, imageUrl, status, sortOrder } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
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
      `UPDATE "ProductCategory" SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: (rows as any[])[0] });
  } catch (error) {
    console.error('[admin/categories] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// ── DELETE: Delete a category (soft-delete via status change) ─────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Valid category ID is required' }, { status: 400 });
    }

    // Soft delete: set status to INACTIVE (preserves data integrity)
    const rows = await dbQuery(
      `UPDATE "ProductCategory" SET status = 'INACTIVE', "modifiedBy" = 'admin', "updatedAt" = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: (rows as any[])[0] });
  } catch (error) {
    console.error('[admin/categories] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
