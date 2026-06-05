-- ============================================================
-- DelegateCart Autonomous System Migration
-- Creates tables for: ProductLearning, QueryLearning,
--                     RankingWeights, TestFailureLog
-- ============================================================

-- ProductLearning: reinforcement scores per product
CREATE TABLE IF NOT EXISTS "ProductLearning" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "cartAdds" INTEGER NOT NULL DEFAULT 0,
  "purchases" INTEGER NOT NULL DEFAULT 0,
  "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reinforcementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastDecay" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductLearning_productId_key" UNIQUE ("productId"),
  CONSTRAINT "ProductLearning_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProductLearning_reinforcementScore_idx"
  ON "ProductLearning"("reinforcementScore" DESC);
CREATE INDEX IF NOT EXISTS "ProductLearning_trendingScore_idx"
  ON "ProductLearning"("trendingScore" DESC);

-- QueryLearning: track which queries succeed/fail
CREATE TABLE IF NOT EXISTS "QueryLearning" (
  "id" SERIAL PRIMARY KEY,
  "queryHash" VARCHAR(64) NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "category" VARCHAR(100),
  "searchCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "avgResultCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QueryLearning_queryHash_key" UNIQUE ("queryHash")
);
CREATE INDEX IF NOT EXISTS "QueryLearning_category_idx"
  ON "QueryLearning"("category");
CREATE INDEX IF NOT EXISTS "QueryLearning_successCount_idx"
  ON "QueryLearning"("successCount" DESC);

-- RankingWeights: auto-tuned weights for scoring
CREATE TABLE IF NOT EXISTS "RankingWeights" (
  "id" SERIAL PRIMARY KEY,
  "version" INTEGER NOT NULL DEFAULT 1,
  "keywordWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "featureWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "priceFitWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "ratingWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "popularityWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "personalizationWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "sessionBoostWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
  "trendingWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "businessWeight" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "avgCtr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgConversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "RankingWeights"
  ("version","keywordWeight","featureWeight","priceFitWeight","ratingWeight",
   "popularityWeight","personalizationWeight","sessionBoostWeight",
   "trendingWeight","businessWeight","isActive")
VALUES (1,20,15,15,10,10,20,25,20,30,true)
ON CONFLICT DO NOTHING;

-- TestFailureLog: auto-fix system
CREATE TABLE IF NOT EXISTS "TestFailureLog" (
  "id" SERIAL PRIMARY KEY,
  "query" TEXT NOT NULL,
  "failureType" VARCHAR(50) NOT NULL,
  "expectedCategory" VARCHAR(100),
  "actualCategory" VARCHAR(100),
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "autoFixed" BOOLEAN NOT NULL DEFAULT false,
  "fixApplied" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TestFailureLog_failureType_idx"
  ON "TestFailureLog"("failureType");
CREATE INDEX IF NOT EXISTS "TestFailureLog_autoFixed_idx"
  ON "TestFailureLog"("autoFixed");

-- Seed ProductBusinessMetrics for all existing products (deterministic)
INSERT INTO "ProductBusinessMetrics" (
  "productId","marginPercentage","inventoryCount",
  "salesVelocity","conversionRate","returnRate"
)
SELECT
  p.id,
  -- margin: based on category patterns
  CASE
    WHEN p.category IN ('fashion','footwear','accessories') THEN 35 + (p.id % 20)
    WHEN p.category IN ('electronics','smartphones','laptops') THEN 12 + (p.id % 15)
    WHEN p.category IN ('groceries') THEN 8 + (p.id % 8)
    ELSE 20 + (p.id % 15)
  END AS "marginPercentage",
  -- inventory: varied
  50 + (p.id * 7 % 450) AS "inventoryCount",
  -- salesVelocity: 0-100
  ROUND((CAST(p.id * 13 % 1000 AS NUMERIC) / 10), 1) AS "salesVelocity",
  -- conversionRate: 0-15%
  ROUND(CAST(p.id * 3 % 150 AS NUMERIC) / 1000, 3) AS "conversionRate",
  -- returnRate: 0-10%
  ROUND(CAST(p.id * 7 % 100 AS NUMERIC) / 1000, 3) AS "returnRate"
FROM "Product" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductBusinessMetrics" pbm WHERE pbm."productId" = p.id
);

-- Seed ProductLearning for all products (baseline)
INSERT INTO "ProductLearning" (
  "productId","impressions","clicks","cartAdds","purchases",
  "ctr","conversionRate","reinforcementScore","trendingScore"
)
SELECT
  p.id,
  p.id * 17 % 500 + 10  AS "impressions",
  p.id * 7  % 50         AS "clicks",
  p.id * 3  % 20         AS "cartAdds",
  p.id * 2  % 10         AS "purchases",
  CASE WHEN (p.id * 17 % 500 + 10) > 0
    THEN ROUND(CAST(p.id * 7 % 50 AS NUMERIC) / (p.id * 17 % 500 + 10), 4)
    ELSE 0 END            AS "ctr",
  CASE WHEN (p.id * 7 % 50) > 0
    THEN ROUND(CAST(p.id * 2 % 10 AS NUMERIC) / (p.id * 7 % 50), 4)
    ELSE 0 END            AS "conversionRate",
  -- reinforcementScore = CTR*10 + cartAdds*2 + purchases*5
  ROUND(
    CAST(p.id * 7 % 50 AS NUMERIC)
      / GREATEST(p.id * 17 % 500 + 10, 1) * 10
    + (p.id * 3 % 20) * 2
    + (p.id * 2 % 10) * 5
  , 2)                    AS "reinforcementScore",
  -- trendingScore: recent activity proxy
  ROUND(CAST(p.id * 11 % 100 AS NUMERIC) / 10, 2) AS "trendingScore"
FROM "Product" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductLearning" pl WHERE pl."productId" = p.id
);

-- Verify
SELECT 'ProductLearning' AS tbl, COUNT(*) FROM "ProductLearning"
UNION ALL SELECT 'QueryLearning', COUNT(*) FROM "QueryLearning"
UNION ALL SELECT 'RankingWeights', COUNT(*) FROM "RankingWeights"
UNION ALL SELECT 'TestFailureLog', COUNT(*) FROM "TestFailureLog"
UNION ALL SELECT 'ProductBusinessMetrics', COUNT(*) FROM "ProductBusinessMetrics"
UNION ALL SELECT 'Product', COUNT(*) FROM "Product";
