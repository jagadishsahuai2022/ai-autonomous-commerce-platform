-- =============================================================================
-- DelegateCart — Complete Baseline Database Migration
-- =============================================================================
-- Purpose : Create ALL tables on a brand-new (empty) PostgreSQL database.
--           Safe to run via psql directly on any PostgreSQL 14+ instance.
--
-- Target  : Hostinger Cloud PostgreSQL (or any other clean PostgreSQL database)
--
-- Usage (manual psql):
--   psql "postgresql://user:password@host:port/dbname?sslmode=require" -f full-baseline-migration.sql
--
-- Usage (pipeline):
--   Prefer the GitHub Actions workflow  .github/workflows/db-migrate-cloud.yml
--   Action: cloud-schema-sync  (uses prisma db push — idempotent, no psql needed)
--
-- NOTE: This script covers the FULL current schema in one shot.
--       After running this, no further migration files are needed —
--       the app is ready to use immediately.
--
-- Tables created (37 total):
--   User, Product, ScoringDimension, WishlistCollection, WishlistItem,
--   ProductBusinessMetrics, Cart, CartItem, Order, OrderItem, FeatureFlag,
--   ChatMessage, ActivityLog, BuyRequest, Wallet, WalletTransaction,
--   WalletAuthorization, WalletSpendingLimit, WalletAuditLog, Seller,
--   SellerProduct, ListingTemplate, PriceHistory, DemandMetrics,
--   SellerAiAnalytics, UserPreferences, BuyingPattern, UserMemory,
--   MemoryInsight, UserMemoryInteraction, RankingPersonalization,
--   AutoDecisionLog, ApprovalRequest, AIDecisionLog, PreferenceQuiz,
--   RefreshToken, ValidationSession
--
-- Generated: 2026-04-19  (prisma migrate diff --from-empty)
-- =============================================================================
-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'BASIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "eligibleForReplacement" BOOLEAN NOT NULL DEFAULT true,
    "eligibleForReturn" BOOLEAN NOT NULL DEFAULT true,
    "eligibleForVirtualTryOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringDimension" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistCollection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "collectionId" INTEGER,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "url" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBusinessMetrics" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "marginPercentage" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "inventoryCount" INTEGER NOT NULL DEFAULT 100,
    "salesVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "returnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBusinessMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" SERIAL NOT NULL,
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "extractedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "budgetMin" DOUBLE PRECISION NOT NULL,
    "budgetMax" DOUBLE PRECISION NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "preferredBrands" JSONB,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "notifyChannels" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "matchedProducts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAdded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPerOrder" DOUBLE PRECISION,
    "dailyLimit" DOUBLE PRECISION,
    "dailySpentToday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAiAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "aiSpendingLimit" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "orderId" INTEGER,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "reason" TEXT,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAuthorization" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "aiRequestId" TEXT,
    "proposedProducts" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executionTxnId" INTEGER,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSpendingLimit" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "limitType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletSpendingLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAuditLog" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "performer" TEXT,
    "performerId" INTEGER,
    "changesBefore" JSONB,
    "changesAfter" JSONB,
    "reason" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeDescription" TEXT,
    "storeImageUrl" TEXT,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "autoGenListings" BOOLEAN NOT NULL DEFAULT false,
    "usePricingSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "useDemandPrediction" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "vendorTier" TEXT NOT NULL DEFAULT 'standard',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerProduct" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnail" TEXT,
    "listingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoGeneratedText" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demandScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceRecommendation" DOUBLE PRECISION,
    "listingTemplate" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingTemplate" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "descriptionTemplate" TEXT NOT NULL,
    "bulletPoints" TEXT[],
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-3.5',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "focusKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "aiSuggestionScore" DOUBLE PRECISION,
    "competitorAvgPrice" DOUBLE PRECISION,
    "demandAtOldPrice" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandMetrics" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "actualDemand" DOUBLE PRECISION NOT NULL,
    "predictedDemand" DOUBLE PRECISION NOT NULL,
    "seasonalFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "trendDirection" TEXT NOT NULL DEFAULT 'stable',
    "topProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lowDemandProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "forecastPeriod" TEXT NOT NULL DEFAULT 'next_7_days',
    "previousActualDemand" DOUBLE PRECISION,
    "previousPrediction" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAiAnalytics" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "generatedListingsCount" INTEGER NOT NULL DEFAULT 0,
    "suggestionsAccepted" INTEGER NOT NULL DEFAULT 0,
    "revenueLift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecastAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricingAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerAiAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "preferredCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryWeights" JSONB,
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "pricePreference" TEXT,
    "discountSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "preferredBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidedBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandWeights" JSONB,
    "minQualityRating" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "featurePreferences" JSONB,
    "preferredShipping" TEXT,
    "maxDeliveryDays" INTEGER,
    "seasonalPreferences" JSONB,
    "autoDecisionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoAddToCart" BOOLEAN NOT NULL DEFAULT false,
    "autoPurchaseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPurchaseThreshold" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingPattern" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "avgPurchasesPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seasonalBuyingPeak" TEXT,
    "seasonalBuyingLow" TEXT,
    "dayOfWeekPreference" INTEGER,
    "timeOfDayPreference" TEXT,
    "topCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryPurchaseFreq" JSONB,
    "categoryVariety" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualSpendPerPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceRangePreference" TEXT,
    "purchaseGap" INTEGER NOT NULL DEFAULT 0,
    "averageOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCategoryBrowseTime" INTEGER,
    "avgProductsViewedPerSession" INTEGER,
    "clickThroughRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cartAbandonmentRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spendingTrend" TEXT NOT NULL DEFAULT 'stable',
    "categoryTrendScore" JSONB,
    "repeatBrandPurchaseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgBrandsPerCategory" INTEGER,
    "preferredDevice" TEXT,
    "preferredPlatform" TEXT,
    "nextLikelyPurchaseCategory" TEXT,
    "daysUntilNextPurchase" INTEGER,
    "lastAnalyzed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyingPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currentPreferences" JSONB NOT NULL,
    "currentPatterns" JSONB NOT NULL,
    "preferencesHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "behaviorHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "lastRecommendations" JSONB,
    "recommendationHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "recommendationAcceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastSearchQueries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchQueryHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "viewedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wishlistItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoDecisionHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "autoDecisionSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cachedInsights" JSONB,
    "memoryAge" INTEGER NOT NULL DEFAULT 0,
    "updateCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "rankingBoosts" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryInsight" (
    "id" SERIAL NOT NULL,
    "userPreferencesId" INTEGER NOT NULL,
    "userMemoryId" INTEGER NOT NULL,
    "topInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "likelyhoodToConvert" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "purchaseProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "churnRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoDecisionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "emergingInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fadingInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topProductRecommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bundleOpportunities" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "personalizationLevel" TEXT NOT NULL DEFAULT 'medium',
    "privacyPreferences" TEXT,
    "predictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPredictionDate" TIMESTAMP(3),
    "conversionLift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgOrderValueLift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementIncrease" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMemoryInteraction" (
    "id" SERIAL NOT NULL,
    "userMemoryId" INTEGER NOT NULL,
    "interactionType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "targetCategoryId" TEXT,
    "userFeedback" TEXT,
    "wasSuccessful" BOOLEAN NOT NULL,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMemoryInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingPersonalization" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryWeights" JSONB NOT NULL,
    "brandWeights" JSONB,
    "priceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "qualityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "brandWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "deliveryWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "newProductBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seasonalWeights" JSONB,
    "trendingBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "viewHistoryWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "purchaseHistoryWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "wishlistWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "appliedToResults" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingPersonalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoDecisionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "decisionType" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "resultingAction" TEXT,
    "successful" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "recommendations" JSONB NOT NULL,
    "aiReasoning" JSONB NOT NULL,
    "alternatives" JSONB NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "responseReason" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIDecisionLog" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "traceId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceQuiz" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "answers" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userExternalId" TEXT NOT NULL,
    "userEmail" TEXT,
    "queryText" TEXT NOT NULL,
    "sessionSource" TEXT NOT NULL DEFAULT 'smart-shopping-assistant',
    "productsJson" JSONB NOT NULL,
    "timelineJson" JSONB,
    "feedbackJson" JSONB NOT NULL DEFAULT '[]',
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_featured_idx" ON "Product"("featured");

-- CreateIndex
CREATE INDEX "Product_featured_createdAt_idx" ON "Product"("featured", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringDimension_key_key" ON "ScoringDimension"("key");

-- CreateIndex
CREATE INDEX "WishlistCollection_userId_idx" ON "WishlistCollection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistCollection_userId_name_key" ON "WishlistCollection"("userId", "name");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_collectionId_idx" ON "WishlistItem"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productName_key" ON "WishlistItem"("userId", "productName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBusinessMetrics_productId_key" ON "ProductBusinessMetrics"("productId");

-- CreateIndex
CREATE INDEX "ProductBusinessMetrics_productId_idx" ON "ProductBusinessMetrics"("productId");

-- CreateIndex
CREATE INDEX "ProductBusinessMetrics_inventoryCount_idx" ON "ProductBusinessMetrics"("inventoryCount");

-- CreateIndex
CREATE INDEX "ProductBusinessMetrics_conversionRate_idx" ON "ProductBusinessMetrics"("conversionRate");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "FeatureFlag"("name");

-- CreateIndex
CREATE INDEX "FeatureFlag_name_idx" ON "FeatureFlag"("name");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "BuyRequest_userId_status_createdAt_idx" ON "BuyRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BuyRequest_status_createdAt_idx" ON "BuyRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_isAiAuthorized_idx" ON "Wallet"("isAiAuthorized");

-- CreateIndex
CREATE INDEX "Wallet_isLocked_idx" ON "Wallet"("isLocked");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_status_createdAt_idx" ON "WalletTransaction"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "WalletAuthorization_walletId_status_idx" ON "WalletAuthorization"("walletId", "status");

-- CreateIndex
CREATE INDEX "WalletAuthorization_status_expiresAt_idx" ON "WalletAuthorization"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletSpendingLimit_walletId_limitType_idx" ON "WalletSpendingLimit"("walletId", "limitType");

-- CreateIndex
CREATE INDEX "WalletSpendingLimit_isActive_limitType_idx" ON "WalletSpendingLimit"("isActive", "limitType");

-- CreateIndex
CREATE INDEX "WalletAuditLog_walletId_createdAt_idx" ON "WalletAuditLog"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletAuditLog_action_createdAt_idx" ON "WalletAuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");

-- CreateIndex
CREATE INDEX "Seller_userId_idx" ON "Seller"("userId");

-- CreateIndex
CREATE INDEX "Seller_storeName_idx" ON "Seller"("storeName");

-- CreateIndex
CREATE INDEX "Seller_vendorTier_idx" ON "Seller"("vendorTier");

-- CreateIndex
CREATE INDEX "SellerProduct_sellerId_status_idx" ON "SellerProduct"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerProduct_category_subCategory_idx" ON "SellerProduct"("category", "subCategory");

-- CreateIndex
CREATE INDEX "SellerProduct_demandScore_idx" ON "SellerProduct"("demandScore");

-- CreateIndex
CREATE INDEX "SellerProduct_conversionRate_idx" ON "SellerProduct"("conversionRate");

-- CreateIndex
CREATE INDEX "ListingTemplate_sellerId_category_idx" ON "ListingTemplate"("sellerId", "category");

-- CreateIndex
CREATE INDEX "ListingTemplate_isActive_idx" ON "ListingTemplate"("isActive");

-- CreateIndex
CREATE INDEX "PriceHistory_sellerId_createdAt_idx" ON "PriceHistory"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_createdAt_idx" ON "PriceHistory"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "DemandMetrics_sellerId_scope_createdAt_idx" ON "DemandMetrics"("sellerId", "scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DemandMetrics_sellerId_scope_scopeId_key" ON "DemandMetrics"("sellerId", "scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerAiAnalytics_sellerId_key" ON "SellerAiAnalytics"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyingPattern_userId_key" ON "BuyingPattern"("userId");

-- CreateIndex
CREATE INDEX "BuyingPattern_userId_idx" ON "BuyingPattern"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMemory_userId_key" ON "UserMemory"("userId");

-- CreateIndex
CREATE INDEX "UserMemory_userId_idx" ON "UserMemory"("userId");

-- CreateIndex
CREATE INDEX "UserMemory_lastAccessed_idx" ON "UserMemory"("lastAccessed");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryInsight_userPreferencesId_key" ON "MemoryInsight"("userPreferencesId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryInsight_userMemoryId_key" ON "MemoryInsight"("userMemoryId");

-- CreateIndex
CREATE INDEX "MemoryInsight_userPreferencesId_idx" ON "MemoryInsight"("userPreferencesId");

-- CreateIndex
CREATE INDEX "MemoryInsight_expiresAt_idx" ON "MemoryInsight"("expiresAt");

-- CreateIndex
CREATE INDEX "UserMemoryInteraction_userMemoryId_timestamp_idx" ON "UserMemoryInteraction"("userMemoryId", "timestamp");

-- CreateIndex
CREATE INDEX "UserMemoryInteraction_interactionType_wasSuccessful_idx" ON "UserMemoryInteraction"("interactionType", "wasSuccessful");

-- CreateIndex
CREATE UNIQUE INDEX "RankingPersonalization_userId_key" ON "RankingPersonalization"("userId");

-- CreateIndex
CREATE INDEX "RankingPersonalization_userId_idx" ON "RankingPersonalization"("userId");

-- CreateIndex
CREATE INDEX "RankingPersonalization_lastCalculated_idx" ON "RankingPersonalization"("lastCalculated");

-- CreateIndex
CREATE INDEX "AutoDecisionLog_userId_createdAt_idx" ON "AutoDecisionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_userId_status_idx" ON "ApprovalRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_expiresAt_idx" ON "ApprovalRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_correlationId_idx" ON "ApprovalRequest"("correlationId");

-- CreateIndex
CREATE INDEX "AIDecisionLog_userId_timestamp_idx" ON "AIDecisionLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AIDecisionLog_correlationId_idx" ON "AIDecisionLog"("correlationId");

-- CreateIndex
CREATE INDEX "AIDecisionLog_traceId_idx" ON "AIDecisionLog"("traceId");

-- CreateIndex
CREATE INDEX "AIDecisionLog_decisionType_idx" ON "AIDecisionLog"("decisionType");

-- CreateIndex
CREATE INDEX "PreferenceQuiz_userId_idx" ON "PreferenceQuiz"("userId");

-- CreateIndex
CREATE INDEX "PreferenceQuiz_status_idx" ON "PreferenceQuiz"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_hashedToken_key" ON "RefreshToken"("hashedToken");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_hashedToken_idx" ON "RefreshToken"("hashedToken");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_isRevoked_idx" ON "RefreshToken"("expiresAt", "isRevoked");

-- CreateIndex
CREATE INDEX "ValidationSession_userId_createdAt_idx" ON "ValidationSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationSession_userExternalId_createdAt_idx" ON "ValidationSession"("userExternalId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationSession_sessionSource_createdAt_idx" ON "ValidationSession"("sessionSource", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationSession_createdAt_idx" ON "ValidationSession"("createdAt");

-- AddForeignKey
ALTER TABLE "WishlistCollection" ADD CONSTRAINT "WishlistCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "WishlistCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBusinessMetrics" ADD CONSTRAINT "ProductBusinessMetrics_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyRequest" ADD CONSTRAINT "BuyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAuthorization" ADD CONSTRAINT "WalletAuthorization_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSpendingLimit" ADD CONSTRAINT "WalletSpendingLimit_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAuditLog" ADD CONSTRAINT "WalletAuditLog_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerProduct" ADD CONSTRAINT "SellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingTemplate" ADD CONSTRAINT "ListingTemplate_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandMetrics" ADD CONSTRAINT "DemandMetrics_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAiAnalytics" ADD CONSTRAINT "SellerAiAnalytics_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingPattern" ADD CONSTRAINT "BuyingPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserPreferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryInsight" ADD CONSTRAINT "MemoryInsight_userPreferencesId_fkey" FOREIGN KEY ("userPreferencesId") REFERENCES "UserPreferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryInsight" ADD CONSTRAINT "MemoryInsight_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES "UserMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemoryInteraction" ADD CONSTRAINT "UserMemoryInteraction_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES "UserMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPersonalization" ADD CONSTRAINT "RankingPersonalization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoDecisionLog" ADD CONSTRAINT "AutoDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIDecisionLog" ADD CONSTRAINT "AIDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceQuiz" ADD CONSTRAINT "PreferenceQuiz_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationSession" ADD CONSTRAINT "ValidationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


