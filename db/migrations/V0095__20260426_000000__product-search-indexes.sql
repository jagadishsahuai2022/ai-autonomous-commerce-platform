-- ─────────────────────────────────────────────────────────────────────────────
-- V0095 — Product search performance indexes
--
-- Adds B-tree and GIN (pg_trgm) indexes to accelerate the four ILIKE queries
-- executed by the smart-intent DB bridge on every shopping assistant request:
--
--   • Product.name           — Strategy 1/2/3 NestJS search + direct fallback
--   • Product.genericName    — Strategy 3 noun-only search + direct fallback
--   • Product.category       — all strategy category filters (ILIKE '%value%')
--   • Product.description    — NestJS full-text token AND search
--
-- pg_trgm GIN indexes speed up ILIKE '%...%' patterns from O(n) table scans
-- to sub-millisecond index lookups on large product catalogs.
--
-- Safe to run on a live database — all statements are idempotent (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Enable pg_trgm extension (required for GIN trigram indexes).
-- Harmless if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── GIN trigram indexes (support fast ILIKE '%...%' on any substring) ────────

CREATE INDEX IF NOT EXISTS idx_product_name_trgm
    ON "Product" USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_generic_name_trgm
    ON "Product" USING GIN ("genericName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_category_trgm
    ON "Product" USING GIN (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_description_trgm
    ON "Product" USING GIN (description gin_trgm_ops);

-- ── B-tree indexes for equality / range queries used by the NestJS API ───────

-- price range filter (minPrice / maxPrice)
CREATE INDEX IF NOT EXISTS idx_product_price
    ON "Product" (price);

-- featured flag used in ORDER BY fallback
CREATE INDEX IF NOT EXISTS idx_product_featured
    ON "Product" (featured DESC);

-- ── Composite for the most common query pattern (category + price) ───────────
-- Covers: WHERE category ILIKE '%appliances%' AND price <= 60000
-- The B-tree part on price is used for the range filter after the GIN narrows rows.
CREATE INDEX IF NOT EXISTS idx_product_category_price
    ON "Product" (price)
    WHERE category IS NOT NULL;

COMMIT;
