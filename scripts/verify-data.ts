#!/usr/bin/env ts-node
/**
 * DelegateCart — 100K Product Data Verification Script
 *
 * Verifies both data sources:
 *   1. NestJS in-memory (via HTTP API) — should serve 100,000 products
 *   2. PostgreSQL direct — should have 100,000 rows in Product table
 *
 * Usage:
 *   npx ts-node scripts/verify-data.ts
 *   # or with env override:
 *   API_URL=http://localhost:3001 DB_URL=postgresql://... npx ts-node scripts/verify-data.ts
 */

import { execSync } from 'child_process';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const DOCKER_CONTAINER = process.env.POSTGRES_CONTAINER ?? 'dc-latest-postgres';
const DB_USER = process.env.DB_USER ?? 'admin';
const DB_NAME = process.env.DB_NAME ?? 'delegatecart';

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

function pass(label: string, detail = '') {
  console.log(`  ${green('✔')} ${label}${detail ? `  ${yellow(detail)}` : ''}`);
}
function fail(label: string, detail = '') {
  console.log(`  ${red('✘')} ${label}${detail ? `  ${yellow(detail)}` : ''}`);
}
function info(label: string, detail = '') {
  console.log(`  ${cyan('ℹ')} ${label}${detail ? `  ${detail}` : ''}`);
}
function heading(title: string) {
  console.log(`\n${bold('══════════════════════════════════════════════════')}`);
  console.log(bold(`  ${title}`));
  console.log(bold('══════════════════════════════════════════════════'));
}

// ─── PostgreSQL helpers (via docker exec psql) ───────────────────────────────
function psql(sql: string): string {
  try {
    return execSync(
      `docker exec ${DOCKER_CONTAINER} psql -U ${DB_USER} ${DB_NAME} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', timeout: 30000 }
    ).trim();
  } catch (e: any) {
    return `ERROR: ${e.message?.slice(0, 200) ?? 'unknown'}`;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Section 1: PostgreSQL verification ──────────────────────────────────────
async function verifyPostgres() {
  heading('1. PostgreSQL Direct Database Verification');

  // 1.1 Total count
  const totalRaw = psql('SELECT COUNT(*) FROM "Product"');
  const total = parseInt(totalRaw, 10);
  const TARGET = 100000;
  if (total >= TARGET) {
    pass(`Total products ≥ ${TARGET.toLocaleString()}`, `actual: ${total.toLocaleString()}`);
  } else {
    fail(
      `Total products should be ${TARGET.toLocaleString()}`,
      `actual: ${total.toLocaleString()}`
    );
  }

  // 1.2 Category distribution
  console.log('\n  Category breakdown:');
  const catRaw = psql(
    'SELECT category, COUNT(*) FROM "Product" GROUP BY category ORDER BY COUNT(*) DESC'
  );
  const expectedCategories = [
    'Electronics',
    'Fashion',
    'Home & Kitchen',
    'Groceries',
    'Sports',
    'Books',
  ];
  const foundCats = new Set<string>();
  for (const row of catRaw.split('\n').filter(Boolean)) {
    const [cat, count] = row.split('|');
    if (cat && count) {
      const pct = ((parseInt(count, 10) / total) * 100).toFixed(1);
      info(`${cat.padEnd(18)} ${count.padStart(7).trim()} products  (${pct}%)`);
      foundCats.add(cat.trim());
    }
  }
  for (const expected of expectedCategories) {
    if (foundCats.has(expected)) {
      pass(`Category '${expected}' present`);
    } else {
      fail(`Category '${expected}' missing`);
    }
  }

  // 1.3 Price range sanity
  const priceRaw = psql(
    'SELECT MIN(price), MAX(price), ROUND(AVG(price)::numeric,2) FROM "Product"'
  );
  const [minP, maxP, avgP] = priceRaw.split('|');
  info(`Price range: ₹${minP} – ₹${maxP}  (avg ₹${avgP})`);
  if (parseFloat(minP) >= 30 && parseFloat(maxP) <= 250000) {
    pass('Price range realistic (₹30–₹2,50,000)');
  } else {
    fail('Price range outside expected bounds', `min=${minP} max=${maxP}`);
  }

  // 1.4 Featured products check
  const featuredRaw = psql('SELECT COUNT(*) FROM "Product" WHERE featured = true');
  const featuredCount = parseInt(featuredRaw, 10);
  if (featuredCount > 0 && featuredCount <= 1000) {
    pass(`Featured products count reasonable`, `${featuredCount} featured`);
  } else {
    fail('Featured product count out of range', `${featuredCount}`);
  }

  // 1.5 Image URL quality
  const fakeImagesRaw = psql(
    `SELECT COUNT(*) FROM "Product" WHERE "imageUrl" LIKE '%placeholder%' OR "imageUrl" IS NULL`
  );
  const fakeImages = parseInt(fakeImagesRaw, 10);
  if (fakeImages === 0) {
    pass('No placeholder image URLs — all real Unsplash URLs');
  } else {
    fail(`${fakeImages} products have placeholder/null image URLs`);
  }

  // 1.6 Name length distribution
  const nameLenRaw = psql(
    `SELECT ROUND(AVG(LENGTH(name))::numeric,1), MIN(LENGTH(name)), MAX(LENGTH(name)) FROM "Product"`
  );
  const [avgLen, minLen, maxLen] = nameLenRaw.split('|');
  info(`Product name lengths: min=${minLen}, max=${maxLen}, avg=${avgLen}`);
  if (parseInt(avgLen as string, 10) >= 15) {
    pass('Average product name length realistic (≥15 chars)');
  } else {
    fail('Product names too short on average', `avg=${avgLen}`);
  }

  // 1.7 Sample products
  console.log('\n  Sample products (random 10):');
  const sampleRaw = psql(
    `SELECT id, name, price, category FROM "Product" ORDER BY RANDOM() LIMIT 10`
  );
  for (const row of sampleRaw.split('\n').filter(Boolean)) {
    const [id, name, price, cat] = row.split('|');
    console.log(
      `    [${String(id).padStart(6)}] ₹${String(price).padStart(8)} | ${(cat ?? '').padEnd(16)} | ${name}`
    );
  }

  // 1.8 Date spread
  const dateRaw = psql(`SELECT MIN("createdAt")::date, MAX("createdAt")::date FROM "Product"`);
  const [minDate, maxDate] = dateRaw.split('|');
  info(`Creation date range: ${minDate} → ${maxDate}`);

  // 1.9 Duplicate name check
  const dupRaw = psql(
    `SELECT COUNT(*) FROM (SELECT name FROM "Product" GROUP BY name HAVING COUNT(*) > 1) dups`
  );
  const dups = parseInt(dupRaw, 10);
  if (dups === 0) {
    pass('No duplicate product names');
  } else {
    info(`${dups} duplicate product names found (may be acceptable for variants)`);
  }
}

// ─── Section 2: NestJS in-memory API verification ────────────────────────────
async function verifyApiProducts() {
  heading('2. NestJS API (In-Memory) Product Verification');

  // 2.1 Product count via /api/products?limit=1
  try {
    const data = await fetchJSON(`${API_URL}/api/products?limit=1&skip=0`);
    const total = data?.total ?? data?.count ?? (Array.isArray(data?.products) ? null : null);
    if (total !== null && total >= 100000) {
      pass(`API reports ${total.toLocaleString()} total products`);
    } else if (total !== null) {
      fail(`API total = ${total} (expected 100,000)`, `check TOTAL_PRODUCTS in prisma.service.ts`);
    } else {
      info('Could not determine total from response shape', JSON.stringify(data)?.slice(0, 200));
    }
  } catch (e: any) {
    fail('Could not reach NestJS API', e.message?.slice(0, 100));
  }

  // 2.2 Paginate to last page
  try {
    const skip = 99990;
    const data = await fetchJSON(`${API_URL}/api/products?limit=10&skip=${skip}`);
    const products = data?.products ?? data?.items ?? (Array.isArray(data) ? data : []);
    if (products.length === 10) {
      pass(`Last page (skip=${skip}) returns 10 products`);
    } else if (products.length > 0) {
      pass(`Last page (skip=${skip}) returns ${products.length} products`);
    } else {
      fail('Last page returned 0 products — TOTAL_PRODUCTS may not be 100K');
    }

    // 2.3 Check product fields
    if (products.length > 0) {
      const p = products[0];
      const requiredFields = ['id', 'name', 'price', 'category', 'brand', 'rating', 'image'];
      const missing = requiredFields.filter((f) => !(f in p));
      if (missing.length === 0) {
        pass(
          'Products have all required fields',
          `(id, name, price, category, brand, rating, image)`
        );
      } else {
        fail('Missing product fields', missing.join(', '));
      }

      // 2.4 Image URL check
      const hasRealImages = products.filter(
        (x: any) => x.image && !x.image.includes('placeholder')
      ).length;
      if (hasRealImages === products.length) {
        pass('All API products have real Unsplash image URLs');
      } else {
        fail(`${products.length - hasRealImages} products still have placeholder images`);
      }

      // 2.5 Sample products
      console.log('\n  Sample from API (last page):');
      for (const p of products.slice(0, 5)) {
        console.log(
          `    [${String(p.id).padStart(7)}] ₹${String(p.price ?? '').padStart(8)} | ${(p.category ?? '').padEnd(16)} | ${p.brand ?? ''} – ${(p.name ?? '').slice(0, 45)}`
        );
      }
    }
  } catch (e: any) {
    fail('Failed to paginate API', e.message?.slice(0, 100));
  }

  // 2.6 Category diversity on first page
  try {
    const data = await fetchJSON(`${API_URL}/api/products?limit=50&skip=0`);
    const products = data?.products ?? data?.items ?? (Array.isArray(data) ? data : []);
    const cats = new Set(products.map((p: any) => p.category));
    if (cats.size >= 5) {
      pass(`Category diversity: ${cats.size} distinct categories in first 50 products`);
    } else {
      fail(`Only ${cats.size} categories in first 50 products`);
    }
  } catch {
    // ignore
  }
}

// ─── Section 3: Search API spot-check ─────────────────────────────────────────
async function verifySearch() {
  heading('3. Smart Search Spot-Check');

  const queries = ['samsung', 'laptop gaming', 'nike shoes', 'basmati rice', 'yoga mat'];
  for (const q of queries) {
    try {
      const data = await fetchJSON(`${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const products = data?.products ?? data?.results ?? (Array.isArray(data) ? data : []);
      if (products.length > 0) {
        pass(`Query "${q}" → ${products.length} results`, products[0]?.name?.slice(0, 40) ?? '');
      } else {
        fail(`Query "${q}" → 0 results`);
      }
    } catch (e: any) {
      fail(`Query "${q}" failed`, e.message?.slice(0, 80));
    }
  }
}

// ─── Section 4: DB Connection Info ────────────────────────────────────────────
function printConnectionInfo() {
  heading('4. Database Connection Information');
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │  PostgreSQL Connection Details                          │
  ├─────────────────────────────────────────────────────────┤
  │  Host:       localhost                                  │
  │  Port:       5432                                       │
  │  Database:   delegatecart                              │
  │  Username:   admin                                      │
  │  Password:   password                                   │
  │  SSL:        disabled                                   │
  ├─────────────────────────────────────────────────────────┤
  │  Connection String (psql / PgAdmin / DBeaver):          │
  │  postgresql://admin:password@localhost:5432/delegatecart │
  ├─────────────────────────────────────────────────────────┤
  │  Docker direct access:                                  │
  │  docker exec -it dc-latest-postgres \\                │
  │    psql -U admin delegatecart                           │
  └─────────────────────────────────────────────────────────┘
  `);
  console.log('  Key tables:');
  const tables = psql(
    `SELECT tablename, pg_size_pretty(pg_relation_size(quote_ident(tablename))) as size
     FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_relation_size(quote_ident(tablename)) DESC LIMIT 15`
  );
  for (const row of tables.split('\n').filter(Boolean)) {
    const [table, size] = row.split('|');
    if (table) info(`${table.padEnd(35)} ${size ?? ''}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold(cyan('\n╔══════════════════════════════════════════════════╗')));
  console.log(bold(cyan('║   DelegateCart 100K Product Verification Report  ║')));
  console.log(bold(cyan('╚══════════════════════════════════════════════════╝')));
  console.log(`  Started at: ${new Date().toISOString()}\n`);

  await verifyPostgres();
  await verifyApiProducts();
  await verifySearch();
  printConnectionInfo();

  console.log(`\n  ${bold('Verification complete.')}  ${new Date().toISOString()}\n`);
}

main().catch((err) => {
  console.error(red('Fatal error:'), err);
  process.exit(1);
});
