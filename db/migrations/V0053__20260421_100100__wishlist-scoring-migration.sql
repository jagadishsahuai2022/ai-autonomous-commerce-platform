-- ============================================================================
-- R53 Migration: Wishlist Collections, Product Flags, Scoring Dimensions
-- ============================================================================

BEGIN;

-- ── 1. Wishlist Collection table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WishlistCollection" (
  id          SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", name)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_collection_user ON "WishlistCollection"("userId");

-- ── 2. Add collectionId to WishlistItem ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='WishlistItem' AND column_name='collectionId') THEN
    ALTER TABLE "WishlistItem" ADD COLUMN "collectionId" INTEGER REFERENCES "WishlistCollection"(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wishlist_item_collection ON "WishlistItem"("collectionId");

-- ── 3. Create default "DC Favorite" collection for all existing users ────────
INSERT INTO "WishlistCollection" ("userId", name, "isDefault")
SELECT id, 'DC Favorite', true FROM "User"
ON CONFLICT ("userId", name) DO NOTHING;

-- ── 4. Link orphan WishlistItem rows to their user's default collection ──────
UPDATE "WishlistItem" wi 
SET "collectionId" = wc.id
FROM "WishlistCollection" wc
WHERE wi."userId" = wc."userId" 
  AND wc."isDefault" = true 
  AND wi."collectionId" IS NULL;

-- ── 5. Product flags ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Product' AND column_name='eligibleForReplacement') THEN
    ALTER TABLE "Product" ADD COLUMN "eligibleForReplacement" BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Product' AND column_name='eligibleForReturn') THEN
    ALTER TABLE "Product" ADD COLUMN "eligibleForReturn" BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Product' AND column_name='eligibleForVirtualTryOn') THEN
    ALTER TABLE "Product" ADD COLUMN "eligibleForVirtualTryOn" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 6. Set eligibleForVirtualTryOn = true for eligible categories ────────────
UPDATE "Product" SET "eligibleForVirtualTryOn" = true
WHERE lower(category) IN (
  'fashion', 'clothing', 'apparel', 'clothes', 'shirts', 'dresses', 'tops', 'pants',
  'shoes', 'footwear', 'sneakers', 'boots', 'sandals',
  'accessories', 'bags', 'sunglasses', 'scarves', 'hats',
  'watches', 'wristwatches',
  'jewellery', 'jewelry', 'rings', 'necklaces', 'bracelets', 'earrings',
  'belts', 'belt'
);

-- ── 7. Scoring Dimension / Weight management table ───────────────────────────
CREATE TABLE IF NOT EXISTS "ScoringDimension" (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  weightage   FLOAT NOT NULL DEFAULT 0.10,
  description TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. Seed default scoring dimensions ───────────────────────────────────────
INSERT INTO "ScoringDimension" (key, label, weightage, description, "sortOrder") VALUES
  ('budget_fit',               'Budget Fit',               0.10, 'How well the product price fits the user budget',            1),
  ('spec_match',               'Spec Match',               0.10, 'Feature specification match against user requirements',      2),
  ('warranty_coverage',        'Warranty Coverage',         0.10, 'Product warranty and protection plan coverage',              3),
  ('manufacturer_profile',     'Manufacturer Profile',      0.10, 'Manufacturer brand tier, R&D strength, and reputation',      4),
  ('brand_trust',              'Brand Trust',               0.10, 'Brand alignment with user preferences and trust level',      5),
  ('delivery_performance',     'Delivery Performance',      0.10, 'Delivery speed and on-time performance history',             6),
  ('verified_ratings',         'Verified Ratings',          0.10, 'OTP-verified review ratings and review volume',              7),
  ('eligible_for_return',      'Eligible For Return',       0.10, 'Product return eligibility flag',                            8),
  ('eligible_for_replacement', 'Eligible For Replacement',  0.20, 'Product replacement eligibility flag',                       9)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  weightage = EXCLUDED.weightage,
  description = EXCLUDED.description,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

COMMIT;
