-- ============================================================================
-- R59 Migration: Scoring Engine Revamp + Self-Learning + Optimization
-- ============================================================================
-- This migration:
--   1. Enhances ScoringDimension table with group, scorerKey, min/max weights
--   2. Creates ScoringDimensionAudit for full change tracking
--   3. Creates RankingAuditLog for per-search audit (optional)
--   4. Creates RankingEventLog for learning data capture
--   5. Creates DimensionEffectiveness for learning signal aggregation
--   6. Creates ContextualWeightProfile for per-category learning
--   7. Creates ScorerCalibration for scorer parameter tuning
--   8. Creates OptimizationJob for one-click optimize workflow
--   9. Inserts the 22-dimension universe
-- ============================================================================

BEGIN;

-- ─── 1. Enhance ScoringDimension table ──────────────────────────────────────

-- Add new columns (safe: uses IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'group') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'quality';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'scorerKey') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "scorerKey" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'maxRawScore') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "maxRawScore" FLOAT NOT NULL DEFAULT 1.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'isNegative') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "isNegative" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'minWeightage') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "minWeightage" FLOAT NOT NULL DEFAULT 0.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'maxWeightage') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "maxWeightage" FLOAT NOT NULL DEFAULT 0.25;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScoringDimension' AND column_name = 'version') THEN
    ALTER TABLE "ScoringDimension" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- ─── 2. ScoringDimensionAudit — full JSONB snapshot on every change ─────────

CREATE TABLE IF NOT EXISTS "ScoringDimensionAudit" (
  id              BIGSERIAL PRIMARY KEY,
  "snapshotId"    UUID NOT NULL DEFAULT gen_random_uuid(),
  "changedBy"     INTEGER,
  "changeSource"  TEXT NOT NULL DEFAULT 'admin',
  "changeReason"  TEXT,
  "snapshot"      JSONB NOT NULL,
  "previousSnapshot" JSONB,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_audit_created ON "ScoringDimensionAudit"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_dim_audit_source ON "ScoringDimensionAudit"("changeSource");

-- ─── 3. RankingAuditLog — per-search audit (optional, ENV-controlled) ───────

CREATE TABLE IF NOT EXISTS "RankingAuditLog" (
  id              BIGSERIAL PRIMARY KEY,
  "sessionId"     TEXT,
  "userId"        INTEGER,
  "query"         TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "dimensionSnapshotId" UUID,
  "topProducts"   JSONB,
  "totalResults"  INTEGER,
  "processingMs"  INTEGER,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_audit_session ON "RankingAuditLog"("sessionId");
CREATE INDEX IF NOT EXISTS idx_ranking_audit_created ON "RankingAuditLog"("createdAt" DESC);

-- ─── 4. RankingEventLog — learning data capture ─────────────────────────────

CREATE TABLE IF NOT EXISTS "RankingEventLog" (
  id                  BIGSERIAL PRIMARY KEY,
  "sessionId"         TEXT NOT NULL,
  "userId"            INTEGER,
  "query"             TEXT NOT NULL,
  "rankedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "engineVersion"     TEXT NOT NULL,
  "dimensionSnapshotId" UUID,
  "totalResults"      INTEGER NOT NULL DEFAULT 0,
  "products"          JSONB NOT NULL DEFAULT '[]',
  "parsedIntent"      JSONB,
  "clickedProductIds" INTEGER[] DEFAULT '{}',
  "clickPositions"    INTEGER[] DEFAULT '{}',
  "cartedProductIds"  INTEGER[] DEFAULT '{}',
  "purchasedProductIds" INTEGER[] DEFAULT '{}',
  "ignoredCount"      INTEGER DEFAULT 0,
  "sessionDurationMs" INTEGER,
  "bounced"           BOOLEAN DEFAULT false,
  "rewardScore"       FLOAT,
  "outcomeType"       TEXT,
  "deviceType"        TEXT,
  "responseTimeMs"    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ranking_event_session ON "RankingEventLog"("sessionId");
CREATE INDEX IF NOT EXISTS idx_ranking_event_user ON "RankingEventLog"("userId");
CREATE INDEX IF NOT EXISTS idx_ranking_event_date ON "RankingEventLog"("rankedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_event_outcome ON "RankingEventLog"("outcomeType");
CREATE INDEX IF NOT EXISTS idx_ranking_event_reward ON "RankingEventLog"("rewardScore" DESC NULLS LAST);

-- ─── 5. DimensionEffectiveness — per-dimension learning stats ───────────────

CREATE TABLE IF NOT EXISTS "DimensionEffectiveness" (
  id                      SERIAL PRIMARY KEY,
  "dimensionKey"          TEXT NOT NULL,
  "periodStart"           DATE NOT NULL,
  "periodEnd"             DATE NOT NULL,
  "totalRankings"         INTEGER NOT NULL DEFAULT 0,
  "clickCorrelation"      FLOAT,
  "cartCorrelation"       FLOAT,
  "purchaseCorrelation"   FLOAT,
  "avgScoreClicked"       FLOAT,
  "avgScoreIgnored"       FLOAT,
  "predictivePower"       FLOAT,
  "currentWeight"         FLOAT,
  "suggestedWeight"       FLOAT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dim_effectiveness_period UNIQUE ("dimensionKey", "periodStart")
);

CREATE INDEX IF NOT EXISTS idx_dim_effectiveness_key ON "DimensionEffectiveness"("dimensionKey");
CREATE INDEX IF NOT EXISTS idx_dim_effectiveness_period ON "DimensionEffectiveness"("periodStart" DESC);

-- ─── 6. ContextualWeightProfile — per-category/budget learned weights ───────

CREATE TABLE IF NOT EXISTS "ContextualWeightProfile" (
  id              SERIAL PRIMARY KEY,
  "contextKey"    TEXT NOT NULL UNIQUE,
  "category"      TEXT,
  "budgetTier"    TEXT,
  "weights"       JSONB NOT NULL DEFAULT '{}',
  "confidence"    FLOAT NOT NULL DEFAULT 0.0,
  "sampleCount"   INTEGER NOT NULL DEFAULT 0,
  "avgReward"     FLOAT,
  "lastUpdated"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. ScorerCalibration — scorer parameter tuning ─────────────────────────

CREATE TABLE IF NOT EXISTS "ScorerCalibration" (
  id                  SERIAL PRIMARY KEY,
  "scorerKey"         TEXT NOT NULL UNIQUE,
  "calibrationParams" JSONB,
  "lastCalibrated"    TIMESTAMPTZ,
  "sampleCount"       INTEGER DEFAULT 0,
  "notes"             TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. OptimizationJob — one-click optimize workflow ───────────────────────

CREATE TABLE IF NOT EXISTS "OptimizationJob" (
  id                  BIGSERIAL PRIMARY KEY,
  "jobId"             UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "triggeredBy"       INTEGER NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "progressPercent"   INTEGER NOT NULL DEFAULT 0,
  "currentPhase"      TEXT,
  "phasesCompleted"   INTEGER NOT NULL DEFAULT 0,
  "totalPhases"       INTEGER NOT NULL DEFAULT 6,
  "dataWindowDays"    INTEGER NOT NULL DEFAULT 30,
  "eventCount"        INTEGER,
  "minEventsRequired" INTEGER NOT NULL DEFAULT 500,
  "startedAt"         TIMESTAMPTZ,
  "estimatedEndAt"    TIMESTAMPTZ,
  "completedAt"       TIMESTAMPTZ,
  "durationMs"        INTEGER,
  "currentWeights"    JSONB,
  "optimizedWeights"  JSONB,
  "weightChanges"     JSONB,
  "performanceMetrics" JSONB,
  "errorMessage"      TEXT,
  "errorDetails"      JSONB,
  "applied"           BOOLEAN NOT NULL DEFAULT false,
  "appliedAt"         TIMESTAMPTZ,
  "discarded"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_job_status ON "OptimizationJob"("status");
CREATE INDEX IF NOT EXISTS idx_optimization_job_latest ON "OptimizationJob"("createdAt" DESC);

-- ─── 9. Seed 22-Dimension Universe ──────────────────────────────────────────
-- Uses ON CONFLICT to be idempotent (safe to re-run)

-- Intent group
INSERT INTO "ScoringDimension" (key, label, weightage, description, "isActive", "sortOrder", "group", "scorerKey", "maxRawScore", "isNegative", "minWeightage", "maxWeightage")
VALUES
  ('category_match', 'Category Match', 0.08, 'Category alignment with query', true, 1, 'intent', 'categoryMatch', 1.0, false, 0.02, 0.25),
  ('brand_match', 'Brand Match', 0.04, 'Brand alignment with query', true, 2, 'intent', 'brandMatch', 1.0, false, 0.0, 0.20),
  ('use_case_match', 'Use Case Match', 0.03, 'Use-case subcategory alignment', true, 3, 'intent', 'useCaseMatch', 1.0, false, 0.0, 0.15),
  ('feature_match', 'Feature Match', 0.05, 'Explicit feature keyword hits', true, 4, 'intent', 'featureMatch', 1.0, false, 0.01, 0.20)
ON CONFLICT (key) DO UPDATE SET
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "maxRawScore" = EXCLUDED."maxRawScore",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "maxWeightage" = EXCLUDED."maxWeightage",
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Quality group
INSERT INTO "ScoringDimension" (key, label, weightage, description, "isActive", "sortOrder", "group", "scorerKey", "maxRawScore", "isNegative", "minWeightage", "maxWeightage")
VALUES
  ('budget_fit', 'Budget Fit', 0.08, 'How well the product price fits user budget', true, 5, 'quality', 'budgetFit', 1.0, false, 0.02, 0.25),
  ('spec_match', 'Spec Match', 0.06, 'Feature specification richness', true, 6, 'quality', 'specMatch', 1.0, false, 0.01, 0.20),
  ('warranty_coverage', 'Warranty Coverage', 0.05, 'Warranty term from product text', true, 7, 'quality', 'warrantyCoverage', 1.0, false, 0.0, 0.15),
  ('manufacturer_profile', 'Manufacturer Profile', 0.04, 'Brand tier, R&D, reputation', true, 8, 'quality', 'manufacturerProfile', 1.0, false, 0.0, 0.15),
  ('brand_trust', 'Brand Trust', 0.04, 'Brand trust + user preference overlap', true, 9, 'quality', 'brandTrust', 1.0, false, 0.0, 0.15),
  ('delivery_performance', 'Delivery Performance', 0.05, 'Delivery speed & on-time history', true, 10, 'quality', 'deliveryPerformance', 1.0, false, 0.0, 0.15),
  ('verified_ratings', 'Verified Ratings', 0.06, 'OTP-verified rating + review volume', true, 11, 'quality', 'verifiedRatings', 1.0, false, 0.01, 0.20),
  ('eligible_for_return', 'Eligible For Return', 0.04, 'Return eligibility flag', true, 12, 'quality', 'returnEligibility', 1.0, false, 0.0, 0.15),
  ('eligible_for_replacement', 'Eligible For Replacement', 0.04, 'Replacement eligibility flag', true, 13, 'quality', 'replacementEligibility', 1.0, false, 0.0, 0.15)
ON CONFLICT (key) DO UPDATE SET
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "maxRawScore" = EXCLUDED."maxRawScore",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "maxWeightage" = EXCLUDED."maxWeightage",
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Engagement group
INSERT INTO "ScoringDimension" (key, label, weightage, description, "isActive", "sortOrder", "group", "scorerKey", "maxRawScore", "isNegative", "minWeightage", "maxWeightage")
VALUES
  ('popularity', 'Popularity', 0.04, 'Review count log-scale', true, 14, 'engagement', 'popularity', 1.0, false, 0.0, 0.15),
  ('learning_boost', 'Learning Boost', 0.03, 'CTR/cart/purchase reinforcement', true, 15, 'engagement', 'learningBoost', 1.0, false, 0.0, 0.15),
  ('trending_score', 'Trending Score', 0.02, 'Product trending velocity', true, 16, 'engagement', 'trendingScore', 1.0, false, 0.0, 0.10)
ON CONFLICT (key) DO UPDATE SET
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "maxRawScore" = EXCLUDED."maxRawScore",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "maxWeightage" = EXCLUDED."maxWeightage",
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Personal group
INSERT INTO "ScoringDimension" (key, label, weightage, description, "isActive", "sortOrder", "group", "scorerKey", "maxRawScore", "isNegative", "minWeightage", "maxWeightage")
VALUES
  ('preferred_brand_boost', 'Preferred Brand Boost', 0.03, 'User preferred brand match', true, 17, 'personal', 'preferredBrandBoost', 1.0, false, 0.0, 0.15),
  ('recent_click_boost', 'Recent Click Boost', 0.02, 'Session recency from click history', true, 18, 'personal', 'recentClickBoost', 1.0, false, 0.0, 0.10),
  ('price_range_fit', 'Price Range Fit', 0.02, 'Alignment with user price preferences', true, 19, 'personal', 'priceRangeFit', 1.0, false, 0.0, 0.10),
  ('session_affinity', 'Session Affinity', 0.02, 'Session browsing pattern alignment', true, 20, 'personal', 'sessionAffinity', 1.0, false, 0.0, 0.10)
ON CONFLICT (key) DO UPDATE SET
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "maxRawScore" = EXCLUDED."maxRawScore",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "maxWeightage" = EXCLUDED."maxWeightage",
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Business group
INSERT INTO "ScoringDimension" (key, label, weightage, description, "isActive", "sortOrder", "group", "scorerKey", "maxRawScore", "isNegative", "minWeightage", "maxWeightage")
VALUES
  ('conversion_potential', 'Conversion Potential', 0.05, 'Historical conversion rate + margin + inventory', true, 21, 'business', 'conversionPotential', 1.0, false, 0.01, 0.20),
  ('budget_penalty', 'Budget Penalty', 0.05, 'Penalty for over-budget products', true, 22, 'business', 'budgetPenalty', 1.0, true, 0.05, 0.25)
ON CONFLICT (key) DO UPDATE SET
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "maxRawScore" = EXCLUDED."maxRawScore",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "maxWeightage" = EXCLUDED."maxWeightage",
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- ─── 10. Seed initial audit snapshot ────────────────────────────────────────

INSERT INTO "ScoringDimensionAudit" ("changeSource", "changeReason", "snapshot")
SELECT
  'migration',
  'R59: Initial 22-dimension universe seeded',
  jsonb_agg(jsonb_build_object(
    'key', key,
    'label', label,
    'weightage', weightage,
    'group', "group",
    'isActive', "isActive"
  ) ORDER BY "sortOrder")
FROM "ScoringDimension"
WHERE "isActive" = true;

COMMIT;
