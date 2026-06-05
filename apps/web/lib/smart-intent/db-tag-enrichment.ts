/**
 * Smart Intent Engine — Background DB Tag Enrichment
 *
 * After a successful Q&A loop yields products, we silently capture the user's
 * selected `use_case` and `features` as candidate `ProductTag` entries linked
 * to the matched products via `ProductTagMap` (with `approved = false`).
 *
 * Why:
 *   • Each user query surfaces additional structured signals about what makes
 *     a product useful (e.g. "Programming / Dev", "Family / Daily Use",
 *     "5-Star Energy Rating").
 *   • Inserting these as un-approved tags grows the searchable taxonomy
 *     organically.  An admin can later approve them in bulk; meanwhile the
 *     search continues to work without any blocking dependency.
 *
 * Design constraints:
 *   • Fire-and-forget — never blocks the user response.
 *   • Idempotent — re-uses existing `ProductTag` rows, deduplicates mappings.
 *   • Rate-limited per (tag, product) pair via a small in-memory dedup cache.
 *   • Insert volume capped per call to bound DB load.
 *   • Safe by default — uses `approved = false` so freshly inserted tags do
 *     not affect search ranking until reviewed.
 */

import { query } from '@/lib/db';

// ── Config ────────────────────────────────────────────────────────────────

/** Maximum number of (product, tag) mappings inserted per call. */
const MAX_MAPPINGS_PER_CALL = 30;

/** How long to skip the same (tag, product) insert to avoid hammering the DB. */
const DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hour

/** In-memory dedup cache. Resets on container restart — that's fine. */
const _recentInserts = new Map<string, number>();

/** Slugify a label into a stable tag slug. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Map intent label → ProductTag.tagType (matches schema enum-style values). */
function inferTagType(kind: 'use_case' | 'feature' | 'brand'): string {
  switch (kind) {
    case 'use_case':
      return 'USE_CASE';
    case 'feature':
      return 'FEATURE';
    case 'brand':
      return 'BRAND_TIER';
  }
}

/** Public payload for triggering enrichment. */
export interface TagEnrichmentInput {
  /** IDs of REAL DB products that the user was just shown. */
  productIds: Array<string | number>;
  /** Optional selected use case (e.g. "Programming / Dev"). */
  useCase?: string | null;
  /** Optional selected features (e.g. ["5-Star Energy Rating"]). */
  features?: string[];
  /** Optional preferred brand. */
  brand?: string | null;
}

/**
 * Fire-and-forget DB tag enrichment.  Always returns immediately; the actual
 * work happens on the next event-loop tick and any error is swallowed.
 */
export function triggerTagEnrichment(input: TagEnrichmentInput): void {
  // Defer to the next tick so the calling request can return without waiting.
  setTimeout(() => {
    void runTagEnrichment(input).catch((err: unknown) => {
      // Never let background failures escape — log and move on.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[TagEnrichment] background insert failed:', msg);
    });
  }, 0);
}

/** Internal worker — exported only for testing. */
export async function runTagEnrichment(input: TagEnrichmentInput): Promise<{
  inserted: number;
  skipped: number;
}> {
  const numericIds: number[] = [];
  for (const id of input.productIds) {
    const n = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (Number.isFinite(n) && n > 0) numericIds.push(n);
  }
  if (numericIds.length === 0) return { inserted: 0, skipped: 0 };

  type Candidate = { kind: 'use_case' | 'feature' | 'brand'; label: string };
  const candidates: Candidate[] = [];
  if (input.useCase && input.useCase.trim()) {
    candidates.push({ kind: 'use_case', label: input.useCase.trim() });
  }
  for (const f of input.features ?? []) {
    if (typeof f === 'string' && f.trim() && f.trim() !== 'none') {
      candidates.push({ kind: 'feature', label: f.trim() });
    }
  }
  if (input.brand && input.brand.trim()) {
    candidates.push({ kind: 'brand', label: input.brand.trim() });
  }
  if (candidates.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  let mappingsEmitted = 0;

  for (const cand of candidates) {
    if (mappingsEmitted >= MAX_MAPPINGS_PER_CALL) break;

    const slug = slugify(cand.label);
    if (!slug) {
      skipped++;
      continue;
    }

    // 1) Upsert the tag row (idempotent via slug uniqueness).
    let tagId: number | null = null;
    try {
      const existing = await query<{ id: number }>(
        `SELECT id FROM "ProductTag" WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      if (existing.length > 0) {
        tagId = existing[0].id;
      } else {
        const created = await query<{ id: number }>(
          `INSERT INTO "ProductTag" (name, slug, "tagType", status, "sortOrder", "createdBy", "modifiedBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'ACTIVE', 100, 'smart-intent', 'smart-intent', NOW(), NOW())
           ON CONFLICT (slug) DO UPDATE SET "updatedAt" = NOW()
           RETURNING id`,
          [cand.label, slug, inferTagType(cand.kind)]
        );
        tagId = created.length > 0 ? created[0].id : null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[TagEnrichment] tag upsert failed for', slug, msg);
      skipped++;
      continue;
    }

    if (!tagId) {
      skipped++;
      continue;
    }

    // 2) Insert (productId, tagId) mappings, skipping any we recently emitted.
    const productsToInsert: number[] = [];
    const now = Date.now();
    for (const pid of numericIds) {
      if (mappingsEmitted + productsToInsert.length >= MAX_MAPPINGS_PER_CALL) break;
      const cacheKey = `${tagId}:${pid}`;
      const seen = _recentInserts.get(cacheKey);
      if (seen && now - seen < DEDUP_TTL_MS) {
        skipped++;
        continue;
      }
      productsToInsert.push(pid);
      _recentInserts.set(cacheKey, now);
    }

    if (productsToInsert.length === 0) continue;

    try {
      // Build a single multi-row INSERT for efficiency.  ON CONFLICT prevents
      // duplicate (productId, tagId) errors if a mapping was already approved.
      // $1 is tagId; $2..$N are the product ids.
      const valueRows = productsToInsert
        .map((_, i) => `($${i + 2}, $1, false, NULL, NULL, NOW())`)
        .join(', ');
      const args: unknown[] = [tagId, ...productsToInsert];
      await query(
        `INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt", "createdAt")
         VALUES ${valueRows}
         ON CONFLICT ("productId", "tagId") DO NOTHING`,
        args
      );
      inserted += productsToInsert.length;
      mappingsEmitted += productsToInsert.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[TagEnrichment] mapping insert failed for tag', tagId, msg);
      skipped += productsToInsert.length;
    }
  }

  // Trim the dedup cache opportunistically — keep only fresh entries.
  if (_recentInserts.size > 5000) {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [k, t] of _recentInserts) {
      if (t < cutoff) _recentInserts.delete(k);
    }
  }

  return { inserted, skipped };
}

/** Test-only: clear the dedup cache. */
export function _resetTagEnrichmentCache(): void {
  _recentInserts.clear();
}
