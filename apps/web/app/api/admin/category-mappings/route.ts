import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── GET: Get all category mappings for a product ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const pid = parseInt(productId, 10);
    if (isNaN(pid)) {
      return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
    }

    const [catMappings, subCatMappings] = await Promise.all([
      dbQuery(
        `SELECT pcm."categoryId", pcm."isPrimary", pcm.approved, pc.name, pc.slug, pc.status
         FROM "ProductCategoryMap" pcm
         JOIN "ProductCategory" pc ON pc.id = pcm."categoryId"
         WHERE pcm."productId" = $1
         ORDER BY pcm."isPrimary" DESC, pc.name ASC`,
        [pid]
      ),
      dbQuery(
        `SELECT pscm."subCategoryId", pscm."isPrimary", pscm.approved, psc.name, psc.slug, psc.status, psc."categoryId",
                pc.name AS "categoryName"
         FROM "ProductSubCategoryMap" pscm
         JOIN "ProductSubCategory" psc ON psc.id = pscm."subCategoryId"
         JOIN "ProductCategory" pc ON pc.id = psc."categoryId"
         WHERE pscm."productId" = $1
         ORDER BY pscm."isPrimary" DESC, psc.name ASC`,
        [pid]
      ),
    ]);

    return NextResponse.json({
      success: true,
      productId: pid,
      categories: catMappings,
      subCategories: subCatMappings,
    });
  } catch (error) {
    console.error('[admin/category-mappings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
  }
}

// ── POST: Add product ↔ category mapping ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, categoryId, subCategoryId, isPrimary, approved } = body;

    if (!productId || typeof productId !== 'number') {
      return NextResponse.json({ error: 'productId (number) is required' }, { status: 400 });
    }

    const primary = isPrimary === true;
    const isApproved = approved !== false; // default to true

    if (categoryId && typeof categoryId === 'number') {
      // If marking as primary, unset any existing primary for this product
      if (primary) {
        await dbQuery(
          `UPDATE "ProductCategoryMap" SET "isPrimary" = FALSE WHERE "productId" = $1`,
          [productId]
        );
        // Also update Product.categoryId for backward compat
        await dbQuery(
          `UPDATE "Product" SET "categoryId" = $1 WHERE id = $2`,
          [categoryId, productId]
        );
      }

      await dbQuery(
        `INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("productId", "categoryId") DO UPDATE SET "isPrimary" = $3, approved = $4`,
        [productId, categoryId, primary, isApproved]
      );
    }

    if (subCategoryId && typeof subCategoryId === 'number') {
      if (primary) {
        await dbQuery(
          `UPDATE "ProductSubCategoryMap" SET "isPrimary" = FALSE WHERE "productId" = $1`,
          [productId]
        );
        await dbQuery(
          `UPDATE "Product" SET "subCategoryId" = $1 WHERE id = $2`,
          [subCategoryId, productId]
        );
      }

      await dbQuery(
        `INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", "isPrimary", approved)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("productId", "subCategoryId") DO UPDATE SET "isPrimary" = $3, approved = $4`,
        [productId, subCategoryId, primary, isApproved]
      );
    }

    return NextResponse.json({ success: true, message: 'Mapping added' }, { status: 201 });
  } catch (error) {
    console.error('[admin/category-mappings] POST error:', error);
    return NextResponse.json({ error: 'Failed to add mapping' }, { status: 500 });
  }
}

// ── DELETE: Remove product ↔ category mapping ────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get('productId') || '', 10);
    const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!, 10) : null;
    const subCategoryId = searchParams.get('subCategoryId') ? parseInt(searchParams.get('subCategoryId')!, 10) : null;

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    if (categoryId && !isNaN(categoryId)) {
      // Don't allow removing the last/primary category — product must have at least one
      const countRes = await dbQuery(
        `SELECT COUNT(*)::int AS cnt FROM "ProductCategoryMap" WHERE "productId" = $1`,
        [productId]
      ) as any[];
      if (countRes[0]?.cnt <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last category mapping' }, { status: 400 });
      }

      await dbQuery(
        `DELETE FROM "ProductCategoryMap" WHERE "productId" = $1 AND "categoryId" = $2`,
        [productId, categoryId]
      );
    }

    if (subCategoryId && !isNaN(subCategoryId)) {
      const countRes = await dbQuery(
        `SELECT COUNT(*)::int AS cnt FROM "ProductSubCategoryMap" WHERE "productId" = $1`,
        [productId]
      ) as any[];
      if (countRes[0]?.cnt <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last subcategory mapping' }, { status: 400 });
      }

      await dbQuery(
        `DELETE FROM "ProductSubCategoryMap" WHERE "productId" = $1 AND "subCategoryId" = $2`,
        [productId, subCategoryId]
      );
    }

    return NextResponse.json({ success: true, message: 'Mapping removed' });
  } catch (error) {
    console.error('[admin/category-mappings] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove mapping' }, { status: 500 });
  }
}
