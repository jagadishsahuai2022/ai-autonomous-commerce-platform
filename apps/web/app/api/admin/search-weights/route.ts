import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// ── Admin Search Weights API ─────────────────────────────────────────────────
// GET  /api/admin/search-weights  → returns all 11 weight configs + pass threshold
// PUT  /api/admin/search-weights  → update weights + pass threshold (admin-only)

export interface WeightParam {
  parameterName: string;
  displayName: string;
  defaultWeight: number;
  currentWeight: number;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export async function GET() {
  try {
    const [weights, thresholdRows] = await Promise.all([
      dbQuery<WeightParam>(
        `SELECT "parameterName", "displayName", "defaultWeight"::float AS "defaultWeight",
                "currentWeight"::float AS "currentWeight", "description", "sortOrder", "isActive"
         FROM "SearchWeightConfig"
         ORDER BY "sortOrder" ASC`
      ),
      dbQuery<{ threshold: string }>(
        `SELECT "threshold"::float AS threshold FROM "SearchPassThreshold" LIMIT 1`
      ),
    ]).catch(() => [[], []]);

    const threshold = thresholdRows.length > 0 ? Number(thresholdRows[0].threshold) : 80;

    // If no rows (table not migrated yet), return defaults
    if (weights.length === 0) {
      return NextResponse.json({ weights: getDefaultWeights(), threshold });
    }

    const totalWeight = weights.map((w: WeightParam) => w.currentWeight).reduce((s, n) => s + n, 0);

    return NextResponse.json({ weights, threshold, totalWeight: Math.round(totalWeight * 10) / 10 });
  } catch (err) {
    console.error('[search-weights GET] Error:', err);
    return NextResponse.json({ weights: getDefaultWeights(), threshold: 80 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { weights, threshold } = body as {
      weights: Array<{ parameterName: string; currentWeight: number }>;
      threshold: number;
    };

    if (!Array.isArray(weights) || weights.length === 0) {
      return NextResponse.json({ error: 'weights array required' }, { status: 400 });
    }

    // Validate: total must be within rounding tolerance of 100
    const total = weights.reduce((s, w) => s + Number(w.currentWeight), 0);
    if (Math.abs(total - 100) > 0.5) {
      return NextResponse.json(
        { error: `Weights must sum to 100 (currently ${total.toFixed(2)})` },
        { status: 400 }
      );
    }

    // Validate threshold
    const thresh = Number(threshold);
    if (isNaN(thresh) || thresh < 0 || thresh > 100) {
      return NextResponse.json({ error: 'threshold must be 0-100' }, { status: 400 });
    }

    // Update each weight
    for (const w of weights) {
      const wt = Math.max(0, Math.min(100, Number(w.currentWeight)));
      if (isNaN(wt)) continue;
      await dbQuery(
        `UPDATE "SearchWeightConfig"
         SET "currentWeight" = $1, "updatedAt" = NOW()
         WHERE "parameterName" = $2`,
        [wt, String(w.parameterName)]
      );
    }

    // Update or insert threshold
    await dbQuery(
      `INSERT INTO "SearchPassThreshold" ("threshold") VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET "threshold" = $1, "updatedAt" = NOW()
       WHERE "SearchPassThreshold".id = (SELECT MIN(id) FROM "SearchPassThreshold")`,
      [thresh]
    ).catch(() =>
      dbQuery(`UPDATE "SearchPassThreshold" SET "threshold" = $1, "updatedAt" = NOW()`, [thresh])
    );

    return NextResponse.json({ success: true, message: 'Search weights updated successfully' });
  } catch (err) {
    console.error('[search-weights PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to update weights' }, { status: 500 });
  }
}

// Default weights for 11 Smart Intent Engine parameters (used as fallback when table doesn't exist yet)
// Sum = 40+10+10+5+5+5+5+5+5+5+5 = 100
function getDefaultWeights(): WeightParam[] {
  return [
    { parameterName: 'productName',   displayName: 'Product Name Match', defaultWeight: 40, currentWeight: 40, description: 'All search words must appear in order in product name or generic name (case-insensitive).', sortOrder: 1, isActive: true },
    { parameterName: 'brand',         displayName: 'Brand Match',         defaultWeight: 10, currentWeight: 10, description: 'All brand words must appear in order in product name (case-insensitive). Strict sequential match.', sortOrder: 2, isActive: true },
    { parameterName: 'quantity',      displayName: 'Stock Availability',  defaultWeight: 10, currentWeight: 10, description: 'Whether the product has sufficient inventory for the requested quantity.', sortOrder: 3, isActive: true },
    { parameterName: 'tags',          displayName: 'Tag Match',           defaultWeight:  5, currentWeight:  5, description: 'At least one tag must match; score = fraction of matching tags / total requested tags.', sortOrder: 4, isActive: true },
    { parameterName: 'attributes',    displayName: 'Attribute Match',     defaultWeight:  5, currentWeight:  5, description: 'Fraction of user-specified attributes found in the product (all should match for full score).', sortOrder: 5, isActive: true },
    { parameterName: 'deliveryDays',  displayName: 'Delivery Speed',      defaultWeight:  5, currentWeight:  5, description: 'User requested delivery window must be greater than or equal to estimated product delivery time.', sortOrder: 6, isActive: true },
    { parameterName: 'paymentMethod', displayName: 'Payment Method',      defaultWeight:  5, currentWeight:  5, description: 'Whether the requested payment type (UPI/Card/COD/Wallet/EMI) is supported by the product.', sortOrder: 7, isActive: true },
    { parameterName: 'budget',        displayName: 'Budget Fit',          defaultWeight:  5, currentWeight:  5, description: 'Product price must be strictly less than the user specified budget. No buffer allowed.', sortOrder: 8, isActive: true },
    { parameterName: 'emiOnly',       displayName: 'EMI Availability',    defaultWeight:  5, currentWeight:  5, description: 'Product must strictly support EMI (available for products priced above ₹5,000).', sortOrder: 9, isActive: true },
    { parameterName: 'category',      displayName: 'Category Match',      defaultWeight:  5, currentWeight:  5, description: 'Product must belong to the user-selected category (strict match via ProductCategoryMap).', sortOrder: 10, isActive: true },
    { parameterName: 'subCategory',   displayName: 'Sub-Category Match',  defaultWeight:  5, currentWeight:  5, description: 'Product must belong to the user-selected sub-category (strict match via ProductSubCategoryMap).', sortOrder: 11, isActive: true },
  ];
}
