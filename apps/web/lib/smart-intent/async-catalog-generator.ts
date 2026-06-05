/**
 * Smart Intent Engine — Async Self-Improving Catalog Generator (Phase 3 + 9 + 10)
 *
 * Triggered per-search when a category has fewer than MIN_PRODUCTS_THRESHOLD products.
 * Runs in a background setTimeout (non-blocking). Feature-flagged via ENABLE_SYNTHETIC_DATA.
 *
 * Safety constraints:
 *   - Maximum 1 async generation per session (per-process deduplication)
 *   - Batch inserts only (no individual roundtrips)
 *   - Hard cap: 100 products per generation cycle
 *   - Only generates for known categories
 */

// getSyntheticCatalog removed — product counts come from the real DB.

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_PRODUCTS_THRESHOLD = 200;
const MAX_GENERATE_COUNT = 100;
const MIN_GENERATE_COUNT = 50;

const KNOWN_CATEGORIES = new Set([
  'phone',
  'laptop',
  'headphones',
  'television',
  'appliances',
  'watch',
  'tablet',
  'camera',
  'speaker',
  'stationery',
  'fashion',
  'footwear',
  'watches',
  'furniture',
  'accessories',
]);

// ── Session deduplication ─────────────────────────────────────────────────────
// Tracks which categories have already been enriched in this process lifetime
const _enrichmentHistory = new Map<string, { triggeredAt: number; count: number }>();

// ── Feature flag check ────────────────────────────────────────────────────────

function isSyntheticDataEnabled(): boolean {
  return process.env.ENABLE_SYNTHETIC_DATA === 'true';
}

// ── Catalog count helper ──────────────────────────────────────────────────────

/**
 * Returns 0 for all categories. Product counts are now derived from the real
 * database; the in-memory synthetic catalog is no longer used.
 */
export function getCatalogProductCount(_category: string): number {
  return 0;
}

/**
 * Returns an empty summary. Product counts come from the real database.
 */
export function getCatalogSummary(): Record<string, number> {
  return {};
}

// ── Background job queue ──────────────────────────────────────────────────────

interface EnrichmentJob {
  category: string;
  targetCount: number;
  scheduledAt: number;
}

const _jobQueue: EnrichmentJob[] = [];
let _isProcessing = false;

async function processJobQueue(): Promise<void> {
  if (_isProcessing || _jobQueue.length === 0) return;
  _isProcessing = true;

  const job = _jobQueue.shift();
  if (!job) {
    _isProcessing = false;
    return;
  }

  try {
    await runEnrichmentJob(job);
  } catch (err) {
    // Silently log — async failures must never surface to user
    console.error(`[AsyncCatalog] Job failed for category "${job.category}":`, err);
  } finally {
    _isProcessing = false;
    // Continue processing remaining jobs
    if (_jobQueue.length > 0) {
      setTimeout(() => processJobQueue(), 100);
    }
  }
}

async function runEnrichmentJob(job: EnrichmentJob): Promise<void> {
  const currentCount = getCatalogProductCount(job.category);
  if (currentCount >= MIN_PRODUCTS_THRESHOLD) {
    // Another request already filled this category — skip
    return;
  }

  const generateCount = Math.min(
    MAX_GENERATE_COUNT,
    Math.max(MIN_GENERATE_COUNT, MIN_PRODUCTS_THRESHOLD - currentCount)
  );

  console.info(
    `[AsyncCatalog] Enriching category="${job.category}" currentCount=${currentCount} generating=${generateCount}`
  );

  // Record enrichment
  _enrichmentHistory.set(job.category, {
    triggeredAt: Date.now(),
    count: generateCount,
  });

  // In a real implementation, this would call a DB insertion routine.
  // Here we log the event — catalog is re-generated on next server restart
  // since it's seeded + cached. Future: invalidate cache and re-seed.
  console.info(
    `[AsyncCatalog] Would generate ${generateCount} products for category="${job.category}". ` +
      `Set ENABLE_SYNTHETIC_DATA=true and restart to apply new data.`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Trigger async catalog enrichment for a category (non-blocking).
 *
 * Called after a search completes so it never delays the user's response.
 * Guarded by:
 *  - ENABLE_SYNTHETIC_DATA=true feature flag
 *  - Per-category deduplification (one enrichment per 30 min per category)
 *  - Known-category allowlist
 */
export function triggerAsyncCatalogEnrichment(category: string | null): void {
  if (!isSyntheticDataEnabled()) return;
  if (!category || !KNOWN_CATEGORIES.has(category)) return;

  // Check per-category cooldown (30 minutes)
  const history = _enrichmentHistory.get(category);
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
  if (history && Date.now() - history.triggeredAt < COOLDOWN_MS) return;

  // Quick check: if catalog already has enough products, skip
  const currentCount = getCatalogProductCount(category);
  if (currentCount >= MIN_PRODUCTS_THRESHOLD) return;

  // Enqueue job — non-blocking via setTimeout
  const job: EnrichmentJob = {
    category,
    targetCount: MIN_PRODUCTS_THRESHOLD,
    scheduledAt: Date.now(),
  };

  _jobQueue.push(job);

  // Fire in background — setTimeout with 0 delay defers to next event loop tick
  setTimeout(() => processJobQueue(), 0);
}

/**
 * Get the enrichment history (for debugging / monitoring).
 */
export function getEnrichmentHistory(): Array<{
  category: string;
  triggeredAt: number;
  count: number;
}> {
  return Array.from(_enrichmentHistory.entries()).map(([category, info]) => ({
    category,
    ...info,
  }));
}
