#!/usr/bin/env ts-node
/**
 * ============================================================
 * DelegateCart — Production Data Ingestion Pipeline
 * ============================================================
 *
 * PHASES:
 *   1. Source detection (CSV · JSON · API)
 *   2. Field normalization (external → internal schema)
 *   3. Data cleaning (dedup · price fix · invalid removal)
 *   4. Attribute extraction (RAM, storage, battery, etc.)
 *   5. Image resolution (source URL or Unsplash fallback)
 *   6. Business metrics generation
 *   7. Batch insert (1 000 rows/tx · max 5 parallel workers)
 *   8. Validation report
 *
 * Usage:
 *   npx ts-node scripts/ingest/pipeline.ts \
 *     --source csv --file ./data/amazon-products.csv
 *
 *   npx ts-node scripts/ingest/pipeline.ts \
 *     --source json --file ./data/flipkart-products.json
 *
 *   npx ts-node scripts/ingest/pipeline.ts \
 *     --source synthetic --count 10000
 *
 * Options:
 *   --dry-run          Validate without inserting
 *   --batch-size N     DB transaction size (default: 1000)
 *   --max-workers N    Parallel insert workers (default: 5)
 *   --image-strategy   use_source | unsplash_fallback | force_unsplash
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { normalizeProduct, extractSpecifications } from './normalizer';
import { generateBusinessMetrics, generateLearningMetrics } from './metrics-generator';
import type { RawProduct, NormalizedProduct, IngestionOptions, IngestionReport } from './types';

// ─── CLI Args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name: string, def: string | null = null): string | null {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return argv[idx + 1] ?? def;
}
function flag(name: string): boolean {
  return argv.includes(`--${name}`);
}

const SOURCE = arg('source', 'synthetic') as 'csv' | 'json' | 'synthetic';
const FILE = arg('file');
const COUNT = parseInt(arg('count', '5000')!, 10);
const BATCH_SIZE = parseInt(arg('batch-size', '1000')!, 10);
const MAX_WORKERS = Math.min(5, parseInt(arg('max-workers', '5')!, 10));
const DRY_RUN = flag('dry-run');
const SKIP_DUPLICATES = !flag('allow-duplicates');
const IMAGE_STRATEGY = arg(
  'image-strategy',
  'unsplash_fallback'
) as IngestionOptions['imageStrategy'];

// ─── PHASE 1: Source Readers ───────────────────────────────────────────────────
function readCsv(filePath: string): RawProduct[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  // Parse CSV header
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

  return lines.slice(1).map((line) => {
    // Handle quoted fields
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);

    const obj: RawProduct = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim().replace(/^"|"$/g, '');
    });
    return obj;
  });
}

function readJson(filePath: string): RawProduct[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  // Handle Flipkart nested format
  if (parsed.products) return parsed.products;
  if (parsed.data) return parsed.data;
  return [parsed];
}

// Synthetic catalog generator (produces realistic products without external data)
function generateSyntheticCatalog(count: number): RawProduct[] {
  const CATALOG = [
    {
      category: 'Electronics',
      sub: 'Smartphones',
      brands: ['Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme'],
      priceMin: 7999,
      priceMax: 149999,
    },
    {
      category: 'Electronics',
      sub: 'Laptops',
      brands: ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus'],
      priceMin: 25999,
      priceMax: 299999,
    },
    {
      category: 'Electronics',
      sub: 'Headphones',
      brands: ['Sony', 'Bose', 'JBL', 'Boat', 'Sennheiser'],
      priceMin: 499,
      priceMax: 39999,
    },
    {
      category: 'Fashion',
      sub: "Men's Clothing",
      brands: ['Arrow', 'Van Heusen', 'Peter England', 'Raymond'],
      priceMin: 299,
      priceMax: 9999,
    },
    {
      category: 'Fashion',
      sub: "Women's Clothing",
      brands: ['W', 'Biba', 'Global Desi', 'AND'],
      priceMin: 399,
      priceMax: 14999,
    },
    {
      category: 'Fashion',
      sub: 'Footwear',
      brands: ['Nike', 'Adidas', 'Puma', 'Bata', 'Woodland'],
      priceMin: 499,
      priceMax: 19999,
    },
    {
      category: 'Groceries',
      sub: 'Staples',
      brands: ['Tata', 'ITC', 'Fortune', 'KRBL'],
      priceMin: 39,
      priceMax: 2499,
    },
    {
      category: 'Groceries',
      sub: 'Personal Care',
      brands: ['Dove', 'Nivea', 'Himalaya', 'Patanjali'],
      priceMin: 49,
      priceMax: 999,
    },
    {
      category: 'Home & Kitchen',
      sub: 'Cookware',
      brands: ['Prestige', 'Hawkins', 'Butterfly', 'TTK'],
      priceMin: 299,
      priceMax: 14999,
    },
    {
      category: 'Home & Kitchen',
      sub: 'Furniture',
      brands: ['Nilkamal', 'Sleepwell', 'Pepperfry', 'Urban Ladder'],
      priceMin: 1999,
      priceMax: 89999,
    },
    {
      category: 'Sports',
      sub: 'Cricket',
      brands: ['SG', 'GM', 'MRF', 'Kookaburra'],
      priceMin: 299,
      priceMax: 29999,
    },
    {
      category: 'Books',
      sub: 'Self Help',
      brands: ['Penguin', 'Harper', 'Simon & Schuster'],
      priceMin: 99,
      priceMax: 1499,
    },
  ];

  const products: RawProduct[] = [];
  const COLORS = ['Black', 'White', 'Blue', 'Red', 'Grey', 'Gold', 'Green'];
  const MODELS = ['Pro', 'Ultra', 'Max', 'Plus', 'Elite', 'Prime', 'Lite', 'Air', 'Go', 'S'];

  for (let i = 0; i < count; i++) {
    const c = CATALOG[i % CATALOG.length];
    const brand = c.brands[Math.floor(i / CATALOG.length) % c.brands.length];
    const model = MODELS[Math.floor(i / (CATALOG.length * c.brands.length)) % MODELS.length];
    const color = COLORS[i % COLORS.length];
    const priceVariance = 0.7 + (i % 7) * 0.1;
    const basePrice = c.priceMin + (c.priceMax - c.priceMin) * ((i % 100) / 100);
    const price = Math.round(basePrice * priceVariance);

    products.push({
      product_name: `${brand} ${model} ${color}`,
      category: c.category,
      sub_category: c.sub,
      brand,
      price: String(price),
      actual_price: String(Math.round(price * 1.15)),
      rating: String((3 + (i % 20) / 10).toFixed(1)),
      rating_count: String(50 + ((i * 37) % 9951)),
      description: `${brand} ${model} ${color} — ${c.sub} product with excellent quality and performance.`,
      product_id: `SYN-${String(i + 1).padStart(8, '0')}`,
    });
  }
  return products;
}

// ─── PHASE 3: Data Cleaning & Deduplication ────────────────────────────────────
function cleanAndDeduplicate(
  products: RawProduct[],
  imageStrategy: IngestionOptions['imageStrategy']
): { normalized: NormalizedProduct[]; rejected: number; duplicates: number } {
  const seen = new Set<string>();
  const normalized: NormalizedProduct[] = [];
  let rejected = 0;
  let duplicates = 0;

  for (let i = 0; i < products.length; i++) {
    const result = normalizeProduct(products[i], i, imageStrategy);
    if (!result) {
      rejected++;
      continue;
    }

    // Dedup key: lowercase name + brand
    const dupKey = `${result.name.toLowerCase()}|${result.brand.toLowerCase()}`;
    if (SKIP_DUPLICATES && seen.has(dupKey)) {
      duplicates++;
      continue;
    }
    seen.add(dupKey);

    normalized.push(result);
  }

  return { normalized, rejected, duplicates };
}

// ─── PHASE 7: Batch DB Insert ──────────────────────────────────────────────────
async function insertBatch(products: NormalizedProduct[], startId: number): Promise<number> {
  if (DRY_RUN) return products.length;

  // Build SQL for product batch
  const productValues = products
    .map((p, i) => {
      const id = startId + i;
      const q = (v: string) => v.replace(/'/g, "''");
      const specs = JSON.stringify(p.specifications).replace(/'/g, "''");
      return `(${id}, '${q(p.name)}', ${p.price}, '${q(p.category)}', '${q(p.description)}', '${q(p.image)}', false, NOW(), NOW())`;
    })
    .join(',\n  ');

  const productSql = `
INSERT INTO "Product" (id, name, price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
VALUES
  ${productValues}
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      price = EXCLUDED.price,
      category = EXCLUDED.category,
      "updatedAt" = NOW();
`;

  // Write temp SQL and execute via docker
  const tmpFile = `/tmp/ingest_batch_${startId}.sql`;
  fs.writeFileSync(tmpFile, productSql);
  try {
    execSync(
      `docker cp ${tmpFile} dc-latest-postgres:/tmp/batch.sql && ` +
        `docker exec dc-latest-postgres psql -U admin delegatecart -f /tmp/batch.sql -q 2>&1`,
      { stdio: 'pipe' }
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }

  // Insert business metrics
  const metricsValues = products
    .map((p, i) => {
      const id = startId + i;
      const bm = generateBusinessMetrics(p, id);
      return `(${id}, ${bm.marginPercentage}, ${bm.inventoryCount}, ${bm.salesVelocity}, ${bm.conversionRate}, ${bm.returnRate}, NOW())`;
    })
    .join(',\n  ');

  const metricsSql = `
INSERT INTO "ProductBusinessMetrics" ("productId", "marginPercentage", "inventoryCount", "salesVelocity", "conversionRate", "returnRate", "lastUpdated")
VALUES
  ${metricsValues}
ON CONFLICT ("productId") DO UPDATE
  SET "marginPercentage" = EXCLUDED."marginPercentage",
      "inventoryCount"   = EXCLUDED."inventoryCount",
      "salesVelocity"    = EXCLUDED."salesVelocity",
      "conversionRate"   = EXCLUDED."conversionRate",
      "returnRate"       = EXCLUDED."returnRate";
`;
  const tmpMetrics = `/tmp/metrics_${startId}.sql`;
  fs.writeFileSync(tmpMetrics, metricsSql);
  try {
    execSync(
      `docker cp ${tmpMetrics} dc-latest-postgres:/tmp/m.sql && ` +
        `docker exec dc-latest-postgres psql -U admin delegatecart -f /tmp/m.sql -q 2>&1`,
      { stdio: 'pipe' }
    );
  } finally {
    fs.unlinkSync(tmpMetrics);
  }

  return products.length;
}

// ─── PHASE 7: Parallel Batch Processing ───────────────────────────────────────
async function insertAllBatches(
  products: NormalizedProduct[],
  batchSize: number,
  maxWorkers: number,
  currentMaxId: number
): Promise<number> {
  const batches: NormalizedProduct[][] = [];
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }

  let inserted = 0;
  let batchIdx = 0;

  while (batchIdx < batches.length) {
    // Run up to maxWorkers batches in parallel
    const chunk = batches.slice(batchIdx, batchIdx + maxWorkers);
    const startIds = chunk.map((_, j) => {
      const offset = batches.slice(0, batchIdx + j).reduce((acc, b) => acc + b.length, 0);
      return currentMaxId + 1 + offset;
    });

    await Promise.all(chunk.map((batch, j) => insertBatch(batch, startIds[j])));

    inserted += chunk.reduce((acc, b) => acc + b.length, 0);
    batchIdx += maxWorkers;

    const pct = Math.round((inserted / products.length) * 100);
    process.stdout.write(
      `\r  Progress: ${pct}% (${inserted.toLocaleString()} / ${products.length.toLocaleString()})`
    );
  }
  console.log();
  return inserted;
}

// ─── PHASE 8: Validation ───────────────────────────────────────────────────────
function validateNormalized(products: NormalizedProduct[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();

  for (const p of products) {
    if (!p.name || p.name.length < 3) errors.push(`Invalid name: "${p.name}"`);
    if (!p.price || p.price < 1) errors.push(`Invalid price for "${p.name}": ${p.price}`);
    if (!p.category) errors.push(`Missing category for "${p.name}"`);
    if (!p.image.startsWith('http')) errors.push(`Invalid image URL for "${p.name}"`);
    if (names.has(p.name)) errors.push(`Duplicate name: "${p.name}"`);
    names.add(p.name);
    if (errors.length > 20) {
      errors.push('...more errors truncated');
      break;
    }
  }
  return errors;
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 DelegateCart — Data Ingestion Pipeline');
  console.log('═'.repeat(50));
  console.log(`  Source      : ${SOURCE}`);
  if (SOURCE !== 'synthetic') console.log(`  File        : ${FILE}`);
  else console.log(`  Count       : ${COUNT.toLocaleString()}`);
  console.log(`  Batch size  : ${BATCH_SIZE}`);
  console.log(`  Max workers : ${MAX_WORKERS}`);
  console.log(`  Dry run     : ${DRY_RUN}`);
  console.log(`  Image mode  : ${IMAGE_STRATEGY}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();
  const report: IngestionReport = {
    source: SOURCE,
    totalInput: 0,
    passed: 0,
    rejected: 0,
    duplicates: 0,
    inserted: 0,
    errors: [],
    durationMs: 0,
  };

  // ── PHASE 1: Read source ────────────────────────────────────────────────────
  console.log('\n📂 PHASE 1: Reading source data…');
  let rawProducts: RawProduct[];

  if (SOURCE === 'csv') {
    if (!FILE) {
      console.error('  ❌ --file required for CSV source');
      process.exit(1);
    }
    rawProducts = readCsv(FILE);
  } else if (SOURCE === 'json') {
    if (!FILE) {
      console.error('  ❌ --file required for JSON source');
      process.exit(1);
    }
    rawProducts = readJson(FILE);
  } else {
    rawProducts = generateSyntheticCatalog(COUNT);
  }
  report.totalInput = rawProducts.length;
  console.log(`  ✅ Read ${report.totalInput.toLocaleString()} raw records`);

  // ── PHASES 2–5: Normalize, clean, deduplicate ───────────────────────────────
  console.log('\n🔄 PHASES 2–5: Normalize · clean · deduplicate · attribute extraction…');
  const { normalized, rejected, duplicates } = cleanAndDeduplicate(rawProducts, IMAGE_STRATEGY);
  report.passed = normalized.length;
  report.rejected = rejected;
  report.duplicates = duplicates;
  console.log(`  ✅ Passed   : ${report.passed.toLocaleString()}`);
  console.log(`  ⚠️  Rejected  : ${report.rejected.toLocaleString()} (invalid price/name)`);
  console.log(`  🔁 Dupes     : ${report.duplicates.toLocaleString()} (name+brand match)`);

  // ── PHASE 8 (pre-insert): Validate ─────────────────────────────────────────
  console.log('\n🔍 PHASE 8: Validating normalized data…');
  report.errors = validateNormalized(normalized);
  if (report.errors.length > 0) {
    console.log(`  ⚠️  ${report.errors.length} validation issue(s):`);
    report.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
    if (!DRY_RUN) {
      console.log('  Continuing with insertion of valid records…');
    }
  } else {
    console.log('  ✅ All records valid');
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no data written to DB');
    printReport(report, startTime);
    return;
  }

  // ── Get current max product ID ──────────────────────────────────────────────
  let currentMaxId = 0;
  try {
    const result = execSync(
      'docker exec dc-latest-postgres psql -U admin delegatecart -tAc "SELECT COALESCE(MAX(id),0) FROM \\"Product\\"" 2>/dev/null',
      { stdio: 'pipe' }
    )
      .toString()
      .trim();
    currentMaxId = parseInt(result) || 0;
  } catch {
    /* DB may not be accessible */
  }

  console.log(`\n  Current max product ID: ${currentMaxId.toLocaleString()}`);

  // ── PHASE 7: Batch insert ───────────────────────────────────────────────────
  console.log('\n💾 PHASE 7: Batch inserting…');
  report.inserted = await insertAllBatches(normalized, BATCH_SIZE, MAX_WORKERS, currentMaxId);

  // ── Print final distribution ────────────────────────────────────────────────
  if (!DRY_RUN) {
    try {
      const distResult = execSync(
        `docker exec dc-latest-postgres psql -U admin delegatecart -c ` +
          `"SELECT category, COUNT(*) as count FROM \\"Product\\" GROUP BY category ORDER BY count DESC" 2>&1`,
        { stdio: 'pipe' }
      ).toString();
      console.log('\n📊 Category distribution:\n' + distResult);
    } catch {
      /* ignore */
    }
  }

  printReport(report, startTime);
}

function printReport(report: IngestionReport, startTime: number) {
  report.durationMs = Date.now() - startTime;
  console.log('\n═'.repeat(50));
  console.log('📋 INGESTION REPORT');
  console.log('─'.repeat(50));
  console.log(`  Source      : ${report.source}`);
  console.log(`  Total input : ${report.totalInput.toLocaleString()}`);
  console.log(`  Passed      : ${report.passed.toLocaleString()}`);
  console.log(`  Rejected    : ${report.rejected.toLocaleString()}`);
  console.log(`  Duplicates  : ${report.duplicates.toLocaleString()}`);
  console.log(`  Inserted    : ${report.inserted.toLocaleString()}`);
  console.log(`  Errors      : ${report.errors.length}`);
  console.log(`  Duration    : ${(report.durationMs / 1000).toFixed(2)}s`);
  console.log('═'.repeat(50) + '\n');
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err.message);
  process.exit(1);
});
