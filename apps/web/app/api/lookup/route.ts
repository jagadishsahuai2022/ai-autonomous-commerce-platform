import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── Lookup API — lightweight autocomplete for Categories, SubCategories, Tags ─
// GET /api/lookup?type=categories|subcategories|tags&q=search&categoryId=1&limit=20
// - type: required — which entity to search
// - q: optional search text (min 2 chars, ILIKE match)
// - categoryId: optional — filters subcategories by parent category
// - tagType: optional — filters tags by type (FEATURE, TECHNOLOGY, etc.)
// - limit: optional — max results (default 20, max 50)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const q = (searchParams.get('q') || '').trim();
    const categoryId = searchParams.get('categoryId');
    const tagType = searchParams.get('tagType');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 50);

    if (!type || !['categories', 'subcategories', 'tags', 'productNames', 'brands'].includes(type)) {
      return NextResponse.json(
        { error: 'type parameter required: categories | subcategories | tags | productNames | brands' },
        { status: 400 }
      );
    }

    // q must be at least 2 chars when provided (performance: avoid full-table scans)
    if (q && q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    let items: unknown[] = [];

    if (type === 'categories') {
      const args: string[] = [];
      let where = `WHERE pc.status = 'ACTIVE'`;
      if (q) {
        args.push(`%${q}%`);
        where += ` AND (LOWER(pc.name) LIKE LOWER($${args.length}) OR LOWER(COALESCE(pc.description,'')) LIKE LOWER($${args.length}))`;
      }
      items = await dbQuery(
        `SELECT pc.id, pc.name, pc.slug, pc.description,
                COUNT(DISTINCT pcm."productId") FILTER (WHERE pcm.approved = TRUE) AS "productCount"
         FROM "ProductCategory" pc
         LEFT JOIN "ProductCategoryMap" pcm ON pcm."categoryId" = pc.id
         ${where}
         GROUP BY pc.id, pc.name, pc.slug, pc.description
         ORDER BY pc."sortOrder" ASC, pc.name ASC
         LIMIT $${args.length + 1}`,
        [...args, limit]
      );
    } else if (type === 'subcategories') {
      const args: unknown[] = [];
      let where = `WHERE psc.status = 'ACTIVE'`;
      if (categoryId) {
        const catId = parseInt(categoryId);
        if (!isNaN(catId)) {
          args.push(catId);
          where += ` AND psc."categoryId" = $${args.length}`;
        }
      }
      if (q) {
        args.push(`%${q}%`);
        where += ` AND (LOWER(psc.name) LIKE LOWER($${args.length}) OR LOWER(COALESCE(psc.description,'')) LIKE LOWER($${args.length}))`;
      }
      items = await dbQuery(
        `SELECT psc.id, psc.name, psc.slug, psc.description, psc."categoryId",
                pc.name AS "categoryName",
                COUNT(DISTINCT pscm."productId") FILTER (WHERE pscm.approved = TRUE) AS "productCount"
         FROM "ProductSubCategory" psc
         JOIN "ProductCategory" pc ON pc.id = psc."categoryId"
         LEFT JOIN "ProductSubCategoryMap" pscm ON pscm."subCategoryId" = psc.id
         ${where}
         GROUP BY psc.id, psc.name, psc.slug, psc.description, psc."categoryId", pc.name
         ORDER BY psc."sortOrder" ASC, psc.name ASC
         LIMIT $${args.length + 1}`,
        [...args, limit]
      );
    } else if (type === 'tags') {
      const args: string[] = [];
      let where = `WHERE pt.status = 'ACTIVE'`;
      if (tagType) {
        args.push(tagType);
        where += ` AND pt."tagType" = $${args.length}`;
      }
      if (q) {
        args.push(`%${q}%`);
        where += ` AND (LOWER(pt.name) LIKE LOWER($${args.length}) OR LOWER(COALESCE(pt.description,'')) LIKE LOWER($${args.length}))`;
      }
      items = await dbQuery(
        `SELECT pt.id, pt.name, pt.slug, pt.description, pt."tagType",
                COUNT(DISTINCT ptm."productId") FILTER (WHERE ptm.approved = TRUE) AS "productCount"
         FROM "ProductTag" pt
         LEFT JOIN "ProductTagMap" ptm ON ptm."tagId" = pt.id
         ${where}
         GROUP BY pt.id, pt.name, pt.slug, pt.description, pt."tagType"
         ORDER BY pt."sortOrder" ASC, pt.name ASC
         LIMIT $${args.length + 1}`,
        [...args, limit]
      );
    } else if (type === 'productNames') {
      // Return distinct generic/product names for autocomplete
      const args: (string | number)[] = [];
      let nameWhere = '';
      if (q) {
        args.push(`%${q}%`);
        nameWhere = `WHERE (LOWER(p.name) LIKE LOWER($1) OR LOWER(COALESCE(p."genericName",'')) LIKE LOWER($1))`;
      }
      args.push(limit);
      items = await dbQuery(
        `SELECT COALESCE(p."genericName", p.name) AS name,
                LOWER(COALESCE(p."genericName", p.name)) AS slug,
                COUNT(p.id) AS "productCount"
         FROM "Product" p
         ${nameWhere}
         GROUP BY LOWER(COALESCE(p."genericName", p.name)), COALESCE(p."genericName", p.name)
         ORDER BY LOWER(COALESCE(p."genericName", p.name)) ASC
         LIMIT $${args.length}`,
        args
      ).then(rows => (rows as any[]).map((r, i) => ({
        id: i + 1,
        name: r.name,
        slug: r.slug,
        description: null,
        tagType: null,
        productCount: parseInt(String(r.productCount ?? '1')),
      })));
    } else if (type === 'brands') {
      // Return distinct brand names (first word of product name) for autocomplete
      const args: (string | number)[] = [];
      let brandWhere = '';
      if (q) {
        args.push(`%${q}%`);
        brandWhere = `WHERE LOWER(SPLIT_PART(p.name, ' ', 1)) LIKE LOWER($1)`;
      }
      args.push(limit);
      items = await dbQuery(
        `SELECT SPLIT_PART(p.name, ' ', 1) AS name,
                LOWER(SPLIT_PART(p.name, ' ', 1)) AS slug,
                COUNT(p.id) AS "productCount"
         FROM "Product" p
         ${brandWhere}
         GROUP BY LOWER(SPLIT_PART(p.name, ' ', 1)), SPLIT_PART(p.name, ' ', 1)
         ORDER BY name ASC
         LIMIT $${args.length}`,
        args
      ).then(rows => (rows as any[]).map((r, i) => ({
        id: i + 1,
        name: r.name,
        slug: r.slug,
        description: null,
        tagType: null,
        productCount: parseInt(String(r.productCount ?? '1')),
      })));
    }

    return NextResponse.json({
      items: Array.isArray(items) ? (items as any[]).map(row => ({
        ...row,
        productCount: parseInt(String(row.productCount ?? '0')),
      })) : [],
      type,
      query: q || null,
    });
  } catch (err: unknown) {
    console.error('[lookup] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
