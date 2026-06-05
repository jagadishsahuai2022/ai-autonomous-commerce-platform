--
-- PostgreSQL database dump
--

\restrict HyDzf1oRbHXxO99hhTvhBRjwVR5PXhbN5TTq9VMcXq0b5qPSabfWXCwsHSPpEAW

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AIDecisionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIDecisionLog" (
    id text NOT NULL,
    "userId" integer NOT NULL,
    "traceId" text NOT NULL,
    "spanId" text NOT NULL,
    "correlationId" text NOT NULL,
    "decisionType" text NOT NULL,
    input jsonb NOT NULL,
    output jsonb NOT NULL,
    confidence integer NOT NULL,
    duration integer NOT NULL,
    status text NOT NULL,
    reasoning jsonb NOT NULL,
    metadata jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ActivityLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActivityLog" (
    id integer NOT NULL,
    "userId" integer,
    action text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ActivityLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ActivityLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ActivityLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ActivityLog_id_seq" OWNED BY public."ActivityLog".id;


--
-- Name: AiPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiPreference" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "priceAlerts" boolean DEFAULT true NOT NULL,
    "aiRecommendations" boolean DEFAULT true NOT NULL,
    "preferredCategories" text[] DEFAULT '{}'::text[] NOT NULL,
    "budgetPreference" character varying(20) DEFAULT 'balanced'::character varying NOT NULL,
    "deliveryPreference" character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: AiPreference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AiPreference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AiPreference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AiPreference_id_seq" OWNED BY public."AiPreference".id;


--
-- Name: AnalyticsEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnalyticsEvent" (
    id integer NOT NULL,
    "eventType" text NOT NULL,
    "userId" integer,
    "productId" text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: AnalyticsEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnalyticsEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnalyticsEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnalyticsEvent_id_seq" OWNED BY public."AnalyticsEvent".id;


--
-- Name: ApprovalRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApprovalRequest" (
    id text NOT NULL,
    "userId" integer NOT NULL,
    "orderId" integer,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "orderAmount" double precision NOT NULL,
    recommendations jsonb NOT NULL,
    "aiReasoning" jsonb NOT NULL,
    alternatives jsonb NOT NULL,
    "riskScore" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    "responseReason" text,
    "correlationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "transactionId" text,
    "userId" integer,
    action text NOT NULL,
    "previousState" text,
    "newState" text,
    amount double precision DEFAULT 0 NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    metadata jsonb,
    suspicious boolean DEFAULT false NOT NULL,
    reason text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: AutoDecisionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutoDecisionLog" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "decisionType" text NOT NULL,
    decision text NOT NULL,
    confidence double precision NOT NULL,
    "resultingAction" text,
    successful boolean,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AutoDecisionLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AutoDecisionLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AutoDecisionLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AutoDecisionLog_id_seq" OWNED BY public."AutoDecisionLog".id;


--
-- Name: BuyRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BuyRequest" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "productName" text NOT NULL,
    description text,
    "budgetMin" double precision NOT NULL,
    "budgetMax" double precision NOT NULL,
    "qualityScore" integer NOT NULL,
    "preferredBrands" jsonb,
    "deliveryDate" timestamp(3) without time zone NOT NULL,
    "autoExecute" boolean DEFAULT false NOT NULL,
    "notifyChannels" jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    "matchedProducts" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BuyRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BuyRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BuyRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BuyRequest_id_seq" OWNED BY public."BuyRequest".id;


--
-- Name: BuyingPattern; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BuyingPattern" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "avgPurchasesPerMonth" double precision DEFAULT 0 NOT NULL,
    "seasonalBuyingPeak" text,
    "seasonalBuyingLow" text,
    "dayOfWeekPreference" integer,
    "timeOfDayPreference" text,
    "topCategories" text[] DEFAULT ARRAY[]::text[],
    "categoryPurchaseFreq" jsonb,
    "categoryVariety" double precision DEFAULT 0 NOT NULL,
    "actualSpendPerPurchase" double precision DEFAULT 0 NOT NULL,
    "avgDiscount" double precision DEFAULT 0 NOT NULL,
    "priceRangePreference" text,
    "purchaseGap" integer DEFAULT 0 NOT NULL,
    "averageOrderValue" double precision DEFAULT 0 NOT NULL,
    "avgCategoryBrowseTime" integer,
    "avgProductsViewedPerSession" integer,
    "clickThroughRate" double precision DEFAULT 0 NOT NULL,
    "cartAbandonmentRate" double precision DEFAULT 0 NOT NULL,
    "spendingTrend" text DEFAULT 'stable'::text NOT NULL,
    "categoryTrendScore" jsonb,
    "repeatBrandPurchaseRate" double precision DEFAULT 0 NOT NULL,
    "avgBrandsPerCategory" integer,
    "preferredDevice" text,
    "preferredPlatform" text,
    "nextLikelyPurchaseCategory" text,
    "daysUntilNextPurchase" integer,
    "lastAnalyzed" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BuyingPattern_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BuyingPattern_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BuyingPattern_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BuyingPattern_id_seq" OWNED BY public."BuyingPattern".id;


--
-- Name: Cart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cart" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CartItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CartItem" (
    id integer NOT NULL,
    "cartId" integer NOT NULL,
    "productId" integer NOT NULL,
    quantity integer NOT NULL
);


--
-- Name: CartItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CartItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CartItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CartItem_id_seq" OWNED BY public."CartItem".id;


--
-- Name: Cart_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Cart_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Cart_id_seq" OWNED BY public."Cart".id;


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    intent text,
    "extractedKeywords" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ChatMessage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ChatMessage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ChatMessage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ChatMessage_id_seq" OWNED BY public."ChatMessage".id;


--
-- Name: DemandMetrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DemandMetrics" (
    id integer NOT NULL,
    "sellerId" integer NOT NULL,
    scope text NOT NULL,
    "scopeId" text,
    "actualDemand" double precision NOT NULL,
    "predictedDemand" double precision NOT NULL,
    "seasonalFactor" double precision DEFAULT 1.0 NOT NULL,
    "trendDirection" text DEFAULT 'stable'::text NOT NULL,
    "topProducts" text[] DEFAULT ARRAY[]::text[],
    "lowDemandProducts" text[] DEFAULT ARRAY[]::text[],
    confidence double precision NOT NULL,
    "forecastPeriod" text DEFAULT 'next_7_days'::text NOT NULL,
    "previousActualDemand" double precision,
    "previousPrediction" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DemandMetrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DemandMetrics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DemandMetrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DemandMetrics_id_seq" OWNED BY public."DemandMetrics".id;


--
-- Name: FeatureFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureFlag" (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    "isEnabled" boolean DEFAULT false NOT NULL,
    "rolloutPercentage" integer DEFAULT 0 NOT NULL,
    "targetUserIds" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FeatureFlag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FeatureFlag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FeatureFlag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FeatureFlag_id_seq" OWNED BY public."FeatureFlag".id;


--
-- Name: ListingTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ListingTemplate" (
    id integer NOT NULL,
    "sellerId" integer NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    "titleTemplate" text NOT NULL,
    "descriptionTemplate" text NOT NULL,
    "bulletPoints" text[],
    "aiModel" text DEFAULT 'gpt-3.5'::text NOT NULL,
    tone text DEFAULT 'professional'::text NOT NULL,
    "focusKeywords" text[] DEFAULT ARRAY[]::text[],
    "timesUsed" integer DEFAULT 0 NOT NULL,
    "successRate" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ListingTemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ListingTemplate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ListingTemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ListingTemplate_id_seq" OWNED BY public."ListingTemplate".id;


--
-- Name: MagicLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MagicLink" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    token text NOT NULL,
    purpose text DEFAULT 'view_results'::text NOT NULL,
    payload jsonb,
    "usedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone DEFAULT (now() + '48:00:00'::interval) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: MagicLink_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MagicLink_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MagicLink_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MagicLink_id_seq" OWNED BY public."MagicLink".id;


--
-- Name: MemoryInsight; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MemoryInsight" (
    id integer NOT NULL,
    "userPreferencesId" integer NOT NULL,
    "userMemoryId" integer NOT NULL,
    "topInsights" text[] DEFAULT ARRAY[]::text[],
    "recommendedCategories" text[] DEFAULT ARRAY[]::text[],
    "recommendedBrands" text[] DEFAULT ARRAY[]::text[],
    "likelyhoodToConvert" double precision DEFAULT 0.5 NOT NULL,
    "purchaseProbability" double precision DEFAULT 0.5 NOT NULL,
    "churnRisk" double precision DEFAULT 0 NOT NULL,
    "autoDecisionConfidence" double precision DEFAULT 0.5 NOT NULL,
    "emergingInterests" text[] DEFAULT ARRAY[]::text[],
    "fadingInterests" text[] DEFAULT ARRAY[]::text[],
    "topProductRecommendations" text[] DEFAULT ARRAY[]::text[],
    "bundleOpportunities" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "personalizationLevel" text DEFAULT 'medium'::text NOT NULL,
    "privacyPreferences" text,
    "predictionAccuracy" double precision DEFAULT 0 NOT NULL,
    "lastPredictionDate" timestamp(3) without time zone,
    "conversionLift" double precision DEFAULT 0 NOT NULL,
    "avgOrderValueLift" double precision DEFAULT 0 NOT NULL,
    "engagementIncrease" double precision DEFAULT 0 NOT NULL,
    "analysisDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MemoryInsight_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MemoryInsight_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MemoryInsight_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MemoryInsight_id_seq" OWNED BY public."MemoryInsight".id;


--
-- Name: ObservabilityMetric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ObservabilityMetric" (
    id integer NOT NULL,
    "metricType" text NOT NULL,
    "metricName" text NOT NULL,
    "metricValue" double precision DEFAULT 0 NOT NULL,
    labels jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ObservabilityMetric_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ObservabilityMetric_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ObservabilityMetric_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ObservabilityMetric_id_seq" OWNED BY public."ObservabilityMetric".id;


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    total double precision NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "aiAssisted" boolean DEFAULT false NOT NULL,
    "orderNumber" text,
    "paymentMethod" text DEFAULT 'cod'::text,
    "shippingAddress" jsonb,
    notes text
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "productId" integer NOT NULL,
    quantity integer NOT NULL,
    price double precision NOT NULL,
    "productName" text,
    "imageUrl" text
);


--
-- Name: OrderItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OrderItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OrderItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OrderItem_id_seq" OWNED BY public."OrderItem".id;


--
-- Name: Order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Order_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Order_id_seq" OWNED BY public."Order".id;


--
-- Name: PreferenceQuiz; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PreferenceQuiz" (
    id text NOT NULL,
    "userId" integer NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PriceHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PriceHistory" (
    id integer NOT NULL,
    "sellerId" integer NOT NULL,
    "productId" integer NOT NULL,
    "oldPrice" double precision NOT NULL,
    "newPrice" double precision NOT NULL,
    reason text,
    "aiSuggestionScore" double precision,
    "competitorAvgPrice" double precision,
    "demandAtOldPrice" double precision,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PriceHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PriceHistory_id_seq" OWNED BY public."PriceHistory".id;


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id integer NOT NULL,
    name text NOT NULL,
    price double precision NOT NULL,
    category text NOT NULL,
    description text,
    "imageUrl" text,
    featured boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProductBusinessMetrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductBusinessMetrics" (
    id integer NOT NULL,
    "productId" integer NOT NULL,
    "marginPercentage" double precision DEFAULT 20 NOT NULL,
    "inventoryCount" integer DEFAULT 100 NOT NULL,
    "salesVelocity" double precision DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0.05 NOT NULL,
    "returnRate" double precision DEFAULT 0 NOT NULL,
    "lastUpdated" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProductBusinessMetrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProductBusinessMetrics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProductBusinessMetrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProductBusinessMetrics_id_seq" OWNED BY public."ProductBusinessMetrics".id;


--
-- Name: ProductLearning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductLearning" (
    id integer NOT NULL,
    "productId" integer NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    "cartAdds" integer DEFAULT 0 NOT NULL,
    purchases integer DEFAULT 0 NOT NULL,
    ctr double precision DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0 NOT NULL,
    "reinforcementScore" double precision DEFAULT 0 NOT NULL,
    "trendingScore" double precision DEFAULT 0 NOT NULL,
    "lastDecay" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProductLearning_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProductLearning_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProductLearning_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProductLearning_id_seq" OWNED BY public."ProductLearning".id;


--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Product_id_seq" OWNED BY public."Product".id;


--
-- Name: QueryLearning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QueryLearning" (
    id integer NOT NULL,
    "queryHash" character varying(64) NOT NULL,
    "normalizedQuery" text NOT NULL,
    category character varying(100),
    "searchCount" integer DEFAULT 0 NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "avgResultCount" double precision DEFAULT 0 NOT NULL,
    "lastSeen" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QueryLearning_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."QueryLearning_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: QueryLearning_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."QueryLearning_id_seq" OWNED BY public."QueryLearning".id;


--
-- Name: RankingPersonalization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RankingPersonalization" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "categoryWeights" jsonb NOT NULL,
    "brandWeights" jsonb,
    "priceWeight" double precision DEFAULT 0.25 NOT NULL,
    "qualityWeight" double precision DEFAULT 0.25 NOT NULL,
    "brandWeight" double precision DEFAULT 0.2 NOT NULL,
    "deliveryWeight" double precision DEFAULT 0.15 NOT NULL,
    "newProductBoost" double precision DEFAULT 0 NOT NULL,
    "seasonalWeights" jsonb,
    "trendingBoost" double precision DEFAULT 0.1 NOT NULL,
    "viewHistoryWeight" double precision DEFAULT 0.1 NOT NULL,
    "purchaseHistoryWeight" double precision DEFAULT 0.15 NOT NULL,
    "wishlistWeight" double precision DEFAULT 0.05 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "lastCalculated" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "confidenceScore" double precision DEFAULT 0.5 NOT NULL,
    "appliedToResults" integer DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0 NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RankingPersonalization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RankingPersonalization_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RankingPersonalization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RankingPersonalization_id_seq" OWNED BY public."RankingPersonalization".id;


--
-- Name: RankingWeights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RankingWeights" (
    id integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "keywordWeight" double precision DEFAULT 20 NOT NULL,
    "featureWeight" double precision DEFAULT 15 NOT NULL,
    "priceFitWeight" double precision DEFAULT 15 NOT NULL,
    "ratingWeight" double precision DEFAULT 10 NOT NULL,
    "popularityWeight" double precision DEFAULT 10 NOT NULL,
    "personalizationWeight" double precision DEFAULT 20 NOT NULL,
    "sessionBoostWeight" double precision DEFAULT 25 NOT NULL,
    "trendingWeight" double precision DEFAULT 20 NOT NULL,
    "businessWeight" double precision DEFAULT 30 NOT NULL,
    "avgCtr" double precision DEFAULT 0 NOT NULL,
    "avgConversion" double precision DEFAULT 0 NOT NULL,
    "avgRevenue" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RankingWeights_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RankingWeights_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RankingWeights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RankingWeights_id_seq" OWNED BY public."RankingWeights".id;


--
-- Name: Seller; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Seller" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "storeName" text NOT NULL,
    "storeDescription" text,
    "storeImageUrl" text,
    "totalSales" double precision DEFAULT 0 NOT NULL,
    "totalSold" integer DEFAULT 0 NOT NULL,
    "averageRating" double precision DEFAULT 0 NOT NULL,
    "ratingCount" integer DEFAULT 0 NOT NULL,
    "autoGenListings" boolean DEFAULT false NOT NULL,
    "usePricingSuggestions" boolean DEFAULT true NOT NULL,
    "useDemandPrediction" boolean DEFAULT true NOT NULL,
    category text,
    "vendorTier" text DEFAULT 'standard'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SellerAiAnalytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SellerAiAnalytics" (
    id integer NOT NULL,
    "sellerId" integer NOT NULL,
    "generatedListingsCount" integer DEFAULT 0 NOT NULL,
    "suggestionsAccepted" integer DEFAULT 0 NOT NULL,
    "revenueLift" double precision DEFAULT 0 NOT NULL,
    "forecastAccuracy" double precision DEFAULT 0 NOT NULL,
    "pricingAccuracy" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SellerAiAnalytics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SellerAiAnalytics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SellerAiAnalytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SellerAiAnalytics_id_seq" OWNED BY public."SellerAiAnalytics".id;


--
-- Name: SellerProduct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SellerProduct" (
    id integer NOT NULL,
    "sellerId" integer NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    "subCategory" text,
    "basePrice" double precision NOT NULL,
    "currentPrice" double precision NOT NULL,
    "costPrice" double precision,
    quantity integer DEFAULT 0 NOT NULL,
    sku text,
    images text[] DEFAULT ARRAY[]::text[],
    thumbnail text,
    "listingScore" double precision DEFAULT 0 NOT NULL,
    "autoGeneratedText" boolean DEFAULT false NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0 NOT NULL,
    "demandScore" double precision DEFAULT 0 NOT NULL,
    "priceRecommendation" double precision,
    "listingTemplate" integer,
    status text DEFAULT 'active'::text NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SellerProduct_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SellerProduct_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SellerProduct_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SellerProduct_id_seq" OWNED BY public."SellerProduct".id;


--
-- Name: Seller_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Seller_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Seller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Seller_id_seq" OWNED BY public."Seller".id;


--
-- Name: ShoppingListSearch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShoppingListSearch" (
    id integer NOT NULL,
    "userId" integer,
    "searchHash" text NOT NULL,
    items jsonb NOT NULL,
    results jsonb NOT NULL,
    summary jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp with time zone DEFAULT (now() + '05:00:00'::interval) NOT NULL
);


--
-- Name: ShoppingListSearch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ShoppingListSearch_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ShoppingListSearch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ShoppingListSearch_id_seq" OWNED BY public."ShoppingListSearch".id;


--
-- Name: SmartIntentEngineResponse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartIntentEngineResponse" (
    id integer NOT NULL,
    "userId" integer,
    "queryBy" text DEFAULT 'anonymous'::text NOT NULL,
    "queryText" text NOT NULL,
    "initialProductSuggestionText" text,
    "intentEngineResponse" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "supervisedResponse" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "aiEnrichedResponse" jsonb,
    "enhancedByAI" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: SmartIntentEngineResponse_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SmartIntentEngineResponse_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SmartIntentEngineResponse_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SmartIntentEngineResponse_id_seq" OWNED BY public."SmartIntentEngineResponse".id;


--
-- Name: TestFailureLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestFailureLog" (
    id integer NOT NULL,
    query text NOT NULL,
    "failureType" character varying(50) NOT NULL,
    "expectedCategory" character varying(100),
    "actualCategory" character varying(100),
    "resultCount" integer DEFAULT 0 NOT NULL,
    "autoFixed" boolean DEFAULT false NOT NULL,
    "fixApplied" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TestFailureLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TestFailureLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TestFailureLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TestFailureLog_id_seq" OWNED BY public."TestFailureLog".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    name text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "passwordHash" text,
    "whatsappNumber" text,
    "notificationEmail" text,
    "avatarUrl" text,
    "displayName" text,
    "aliasName" text,
    "preferredCommunicationEmail" text,
    "defaultBillingAddressId" integer,
    "defaultShippingAddressId" integer,
    "subscriptionPlan" text DEFAULT 'BASIC'::text,
    "preferredModel" text DEFAULT 'gpt-4o-mini'::text,
    "autoPurchaseEnabled" boolean DEFAULT false,
    CONSTRAINT "User_subscriptionPlan_check" CHECK (("subscriptionPlan" = ANY (ARRAY['BASIC'::text, 'AI_PLUS'::text])))
);


--
-- Name: UserAddress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAddress" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    name text NOT NULL,
    phone text,
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    state text NOT NULL,
    pincode text NOT NULL,
    "isDefault" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserAddress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserAddress_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserAddress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserAddress_id_seq" OWNED BY public."UserAddress".id;


--
-- Name: UserBehavior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserBehavior" (
    id integer NOT NULL,
    "userId" integer,
    "productId" text,
    action text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserBehavior_action_check" CHECK ((action = ANY (ARRAY['click'::text, 'add_to_cart'::text, 'remove_from_cart'::text, 'purchase'::text, 'reject'::text, 'search'::text, 'view'::text])))
);


--
-- Name: UserBehavior_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserBehavior_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserBehavior_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserBehavior_id_seq" OWNED BY public."UserBehavior".id;


--
-- Name: UserCart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCart" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: UserCart_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserCart_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserCart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserCart_id_seq" OWNED BY public."UserCart".id;


--
-- Name: UserMemory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMemory" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "currentPreferences" jsonb NOT NULL,
    "currentPatterns" jsonb NOT NULL,
    "preferencesHistory" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "behaviorHistory" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "lastRecommendations" jsonb,
    "recommendationHistory" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "recommendationAcceptanceRate" double precision DEFAULT 0.5 NOT NULL,
    "lastSearchQueries" text[] DEFAULT ARRAY[]::text[],
    "searchQueryHistory" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "viewedProducts" text[] DEFAULT ARRAY[]::text[],
    "wishlistItems" text[] DEFAULT ARRAY[]::text[],
    "reviewedProducts" text[] DEFAULT ARRAY[]::text[],
    "autoDecisionHistory" jsonb[] DEFAULT ARRAY[]::jsonb[],
    "autoDecisionSuccessRate" double precision DEFAULT 0 NOT NULL,
    "cachedInsights" jsonb,
    "memoryAge" integer DEFAULT 0 NOT NULL,
    "updateCount" integer DEFAULT 0 NOT NULL,
    "lastAccessed" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    accuracy double precision DEFAULT 0.75 NOT NULL,
    "rankingBoosts" jsonb,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserMemoryInteraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMemoryInteraction" (
    id integer NOT NULL,
    "userMemoryId" integer NOT NULL,
    "interactionType" text NOT NULL,
    confidence double precision NOT NULL,
    "targetProductId" text NOT NULL,
    "targetCategoryId" text,
    "userFeedback" text,
    "wasSuccessful" boolean NOT NULL,
    "conversionValue" double precision DEFAULT 0 NOT NULL,
    metadata jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserMemoryInteraction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserMemoryInteraction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserMemoryInteraction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserMemoryInteraction_id_seq" OWNED BY public."UserMemoryInteraction".id;


--
-- Name: UserMemory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserMemory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserMemory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserMemory_id_seq" OWNED BY public."UserMemory".id;


--
-- Name: UserPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPreference" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "preferredCategories" jsonb DEFAULT '[]'::jsonb,
    "priceRange" jsonb DEFAULT '{"max": 100000, "min": 0}'::jsonb,
    brands jsonb DEFAULT '[]'::jsonb,
    "interactionHistory" jsonb DEFAULT '[]'::jsonb,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserPreference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserPreference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserPreference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserPreference_id_seq" OWNED BY public."UserPreference".id;


--
-- Name: UserPreferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPreferences" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "preferredCategories" text[] DEFAULT ARRAY[]::text[],
    "avoidedCategories" text[] DEFAULT ARRAY[]::text[],
    "categoryWeights" jsonb,
    "priceMin" double precision,
    "priceMax" double precision,
    "pricePreference" text,
    "discountSensitivity" double precision DEFAULT 0.5 NOT NULL,
    "preferredBrands" text[] DEFAULT ARRAY[]::text[],
    "avoidedBrands" text[] DEFAULT ARRAY[]::text[],
    "brandWeights" jsonb,
    "minQualityRating" double precision DEFAULT 3.0 NOT NULL,
    "featurePreferences" jsonb,
    "preferredShipping" text,
    "maxDeliveryDays" integer,
    "seasonalPreferences" jsonb,
    "autoDecisionsEnabled" boolean DEFAULT false NOT NULL,
    "autoAddToCart" boolean DEFAULT false NOT NULL,
    "autoPurchaseEnabled" boolean DEFAULT false NOT NULL,
    "autoPurchaseThreshold" double precision,
    "lastUpdated" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updateFrequency" text DEFAULT 'weekly'::text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserPreferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserPreferences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserPreferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserPreferences_id_seq" OWNED BY public."UserPreferences".id;


--
-- Name: UserSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserSession" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserSession_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserSession_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserSession_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserSession_id_seq" OWNED BY public."UserSession".id;


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Wallet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    balance double precision DEFAULT 0 NOT NULL,
    "totalAdded" double precision DEFAULT 0 NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL,
    "maxPerOrder" double precision,
    "dailyLimit" double precision,
    "dailySpentToday" double precision DEFAULT 0 NOT NULL,
    "lastResetDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isAiAuthorized" boolean DEFAULT false NOT NULL,
    "aiSpendingLimit" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "isLocked" boolean DEFAULT false NOT NULL,
    "lockReason" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WalletAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletAuditLog" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    action text NOT NULL,
    performer text,
    "performerId" integer,
    "changesBefore" jsonb,
    "changesAfter" jsonb,
    reason text,
    details jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WalletAuditLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletAuditLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletAuditLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletAuditLog_id_seq" OWNED BY public."WalletAuditLog".id;


--
-- Name: WalletAuthorization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletAuthorization" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    amount double precision NOT NULL,
    purpose text NOT NULL,
    "aiRequestId" text,
    "proposedProducts" jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    "approvedBy" integer,
    "approvedAt" timestamp(3) without time zone,
    "executedAt" timestamp(3) without time zone,
    "executionTxnId" integer,
    metadata jsonb,
    "ipAddress" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WalletAuthorization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletAuthorization_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletAuthorization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletAuthorization_id_seq" OWNED BY public."WalletAuthorization".id;


--
-- Name: WalletSpendingLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletSpendingLimit" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "limitType" text NOT NULL,
    amount double precision NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WalletSpendingLimit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletSpendingLimit_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletSpendingLimit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletSpendingLimit_id_seq" OWNED BY public."WalletSpendingLimit".id;


--
-- Name: WalletTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletTransaction" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    description text,
    "orderId" integer,
    "referenceId" text,
    status text DEFAULT 'completed'::text NOT NULL,
    reason text,
    "balanceBefore" double precision NOT NULL,
    "balanceAfter" double precision NOT NULL,
    metadata jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WalletTransactionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletTransactionLog" (
    id text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "userId" integer NOT NULL,
    "orderId" text,
    amount double precision NOT NULL,
    state text DEFAULT 'initiated'::text NOT NULL,
    "stateHistory" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "failureReason" text,
    "refundAmount" double precision,
    "refundedAt" timestamp with time zone,
    metadata jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletTransaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletTransaction_id_seq" OWNED BY public."WalletTransaction".id;


--
-- Name: Wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Wallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Wallet_id_seq" OWNED BY public."Wallet".id;


--
-- Name: WishlistItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WishlistItem" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "productName" text NOT NULL,
    price double precision,
    imageurl text,
    "addedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "productId" text,
    url text
);


--
-- Name: WishlistItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WishlistItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WishlistItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WishlistItem_id_seq" OWNED BY public."WishlistItem".id;


--
-- Name: ActivityLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityLog" ALTER COLUMN id SET DEFAULT nextval('public."ActivityLog_id_seq"'::regclass);


--
-- Name: AiPreference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPreference" ALTER COLUMN id SET DEFAULT nextval('public."AiPreference_id_seq"'::regclass);


--
-- Name: AnalyticsEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalyticsEvent" ALTER COLUMN id SET DEFAULT nextval('public."AnalyticsEvent_id_seq"'::regclass);


--
-- Name: AutoDecisionLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoDecisionLog" ALTER COLUMN id SET DEFAULT nextval('public."AutoDecisionLog_id_seq"'::regclass);


--
-- Name: BuyRequest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyRequest" ALTER COLUMN id SET DEFAULT nextval('public."BuyRequest_id_seq"'::regclass);


--
-- Name: BuyingPattern id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyingPattern" ALTER COLUMN id SET DEFAULT nextval('public."BuyingPattern_id_seq"'::regclass);


--
-- Name: Cart id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart" ALTER COLUMN id SET DEFAULT nextval('public."Cart_id_seq"'::regclass);


--
-- Name: CartItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CartItem" ALTER COLUMN id SET DEFAULT nextval('public."CartItem_id_seq"'::regclass);


--
-- Name: ChatMessage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage" ALTER COLUMN id SET DEFAULT nextval('public."ChatMessage_id_seq"'::regclass);


--
-- Name: DemandMetrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DemandMetrics" ALTER COLUMN id SET DEFAULT nextval('public."DemandMetrics_id_seq"'::regclass);


--
-- Name: FeatureFlag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureFlag" ALTER COLUMN id SET DEFAULT nextval('public."FeatureFlag_id_seq"'::regclass);


--
-- Name: ListingTemplate id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingTemplate" ALTER COLUMN id SET DEFAULT nextval('public."ListingTemplate_id_seq"'::regclass);


--
-- Name: MagicLink id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MagicLink" ALTER COLUMN id SET DEFAULT nextval('public."MagicLink_id_seq"'::regclass);


--
-- Name: MemoryInsight id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemoryInsight" ALTER COLUMN id SET DEFAULT nextval('public."MemoryInsight_id_seq"'::regclass);


--
-- Name: ObservabilityMetric id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ObservabilityMetric" ALTER COLUMN id SET DEFAULT nextval('public."ObservabilityMetric_id_seq"'::regclass);


--
-- Name: Order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order" ALTER COLUMN id SET DEFAULT nextval('public."Order_id_seq"'::regclass);


--
-- Name: OrderItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem" ALTER COLUMN id SET DEFAULT nextval('public."OrderItem_id_seq"'::regclass);


--
-- Name: PriceHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory" ALTER COLUMN id SET DEFAULT nextval('public."PriceHistory_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: ProductBusinessMetrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductBusinessMetrics" ALTER COLUMN id SET DEFAULT nextval('public."ProductBusinessMetrics_id_seq"'::regclass);


--
-- Name: ProductLearning id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductLearning" ALTER COLUMN id SET DEFAULT nextval('public."ProductLearning_id_seq"'::regclass);


--
-- Name: QueryLearning id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QueryLearning" ALTER COLUMN id SET DEFAULT nextval('public."QueryLearning_id_seq"'::regclass);


--
-- Name: RankingPersonalization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RankingPersonalization" ALTER COLUMN id SET DEFAULT nextval('public."RankingPersonalization_id_seq"'::regclass);


--
-- Name: RankingWeights id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RankingWeights" ALTER COLUMN id SET DEFAULT nextval('public."RankingWeights_id_seq"'::regclass);


--
-- Name: Seller id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Seller" ALTER COLUMN id SET DEFAULT nextval('public."Seller_id_seq"'::regclass);


--
-- Name: SellerAiAnalytics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerAiAnalytics" ALTER COLUMN id SET DEFAULT nextval('public."SellerAiAnalytics_id_seq"'::regclass);


--
-- Name: SellerProduct id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerProduct" ALTER COLUMN id SET DEFAULT nextval('public."SellerProduct_id_seq"'::regclass);


--
-- Name: ShoppingListSearch id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShoppingListSearch" ALTER COLUMN id SET DEFAULT nextval('public."ShoppingListSearch_id_seq"'::regclass);


--
-- Name: SmartIntentEngineResponse id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartIntentEngineResponse" ALTER COLUMN id SET DEFAULT nextval('public."SmartIntentEngineResponse_id_seq"'::regclass);


--
-- Name: TestFailureLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestFailureLog" ALTER COLUMN id SET DEFAULT nextval('public."TestFailureLog_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: UserAddress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAddress" ALTER COLUMN id SET DEFAULT nextval('public."UserAddress_id_seq"'::regclass);


--
-- Name: UserBehavior id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserBehavior" ALTER COLUMN id SET DEFAULT nextval('public."UserBehavior_id_seq"'::regclass);


--
-- Name: UserCart id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCart" ALTER COLUMN id SET DEFAULT nextval('public."UserCart_id_seq"'::regclass);


--
-- Name: UserMemory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemory" ALTER COLUMN id SET DEFAULT nextval('public."UserMemory_id_seq"'::regclass);


--
-- Name: UserMemoryInteraction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemoryInteraction" ALTER COLUMN id SET DEFAULT nextval('public."UserMemoryInteraction_id_seq"'::regclass);


--
-- Name: UserPreference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreference" ALTER COLUMN id SET DEFAULT nextval('public."UserPreference_id_seq"'::regclass);


--
-- Name: UserPreferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreferences" ALTER COLUMN id SET DEFAULT nextval('public."UserPreferences_id_seq"'::regclass);


--
-- Name: UserSession id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession" ALTER COLUMN id SET DEFAULT nextval('public."UserSession_id_seq"'::regclass);


--
-- Name: Wallet id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet" ALTER COLUMN id SET DEFAULT nextval('public."Wallet_id_seq"'::regclass);


--
-- Name: WalletAuditLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuditLog" ALTER COLUMN id SET DEFAULT nextval('public."WalletAuditLog_id_seq"'::regclass);


--
-- Name: WalletAuthorization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuthorization" ALTER COLUMN id SET DEFAULT nextval('public."WalletAuthorization_id_seq"'::regclass);


--
-- Name: WalletSpendingLimit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletSpendingLimit" ALTER COLUMN id SET DEFAULT nextval('public."WalletSpendingLimit_id_seq"'::regclass);


--
-- Name: WalletTransaction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction" ALTER COLUMN id SET DEFAULT nextval('public."WalletTransaction_id_seq"'::regclass);


--
-- Name: WishlistItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem" ALTER COLUMN id SET DEFAULT nextval('public."WishlistItem_id_seq"'::regclass);


--
-- Name: AIDecisionLog AIDecisionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIDecisionLog"
    ADD CONSTRAINT "AIDecisionLog_pkey" PRIMARY KEY (id);


--
-- Name: ActivityLog ActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: AiPreference AiPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPreference"
    ADD CONSTRAINT "AiPreference_pkey" PRIMARY KEY (id);


--
-- Name: AiPreference AiPreference_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPreference"
    ADD CONSTRAINT "AiPreference_userId_key" UNIQUE ("userId");


--
-- Name: AnalyticsEvent AnalyticsEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY (id);


--
-- Name: ApprovalRequest ApprovalRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalRequest"
    ADD CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AutoDecisionLog AutoDecisionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoDecisionLog"
    ADD CONSTRAINT "AutoDecisionLog_pkey" PRIMARY KEY (id);


--
-- Name: BuyRequest BuyRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyRequest"
    ADD CONSTRAINT "BuyRequest_pkey" PRIMARY KEY (id);


--
-- Name: BuyingPattern BuyingPattern_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyingPattern"
    ADD CONSTRAINT "BuyingPattern_pkey" PRIMARY KEY (id);


--
-- Name: CartItem CartItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY (id);


--
-- Name: Cart Cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: DemandMetrics DemandMetrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DemandMetrics"
    ADD CONSTRAINT "DemandMetrics_pkey" PRIMARY KEY (id);


--
-- Name: FeatureFlag FeatureFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureFlag"
    ADD CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY (id);


--
-- Name: ListingTemplate ListingTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingTemplate"
    ADD CONSTRAINT "ListingTemplate_pkey" PRIMARY KEY (id);


--
-- Name: MagicLink MagicLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MagicLink"
    ADD CONSTRAINT "MagicLink_pkey" PRIMARY KEY (id);


--
-- Name: MagicLink MagicLink_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MagicLink"
    ADD CONSTRAINT "MagicLink_token_key" UNIQUE (token);


--
-- Name: MemoryInsight MemoryInsight_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemoryInsight"
    ADD CONSTRAINT "MemoryInsight_pkey" PRIMARY KEY (id);


--
-- Name: ObservabilityMetric ObservabilityMetric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ObservabilityMetric"
    ADD CONSTRAINT "ObservabilityMetric_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PreferenceQuiz PreferenceQuiz_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PreferenceQuiz"
    ADD CONSTRAINT "PreferenceQuiz_pkey" PRIMARY KEY (id);


--
-- Name: PriceHistory PriceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_pkey" PRIMARY KEY (id);


--
-- Name: ProductBusinessMetrics ProductBusinessMetrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductBusinessMetrics"
    ADD CONSTRAINT "ProductBusinessMetrics_pkey" PRIMARY KEY (id);


--
-- Name: ProductLearning ProductLearning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductLearning"
    ADD CONSTRAINT "ProductLearning_pkey" PRIMARY KEY (id);


--
-- Name: ProductLearning ProductLearning_productId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductLearning"
    ADD CONSTRAINT "ProductLearning_productId_key" UNIQUE ("productId");


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: QueryLearning QueryLearning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QueryLearning"
    ADD CONSTRAINT "QueryLearning_pkey" PRIMARY KEY (id);


--
-- Name: QueryLearning QueryLearning_queryHash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QueryLearning"
    ADD CONSTRAINT "QueryLearning_queryHash_key" UNIQUE ("queryHash");


--
-- Name: RankingPersonalization RankingPersonalization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RankingPersonalization"
    ADD CONSTRAINT "RankingPersonalization_pkey" PRIMARY KEY (id);


--
-- Name: RankingWeights RankingWeights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RankingWeights"
    ADD CONSTRAINT "RankingWeights_pkey" PRIMARY KEY (id);


--
-- Name: SellerAiAnalytics SellerAiAnalytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerAiAnalytics"
    ADD CONSTRAINT "SellerAiAnalytics_pkey" PRIMARY KEY (id);


--
-- Name: SellerProduct SellerProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerProduct"
    ADD CONSTRAINT "SellerProduct_pkey" PRIMARY KEY (id);


--
-- Name: Seller Seller_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Seller"
    ADD CONSTRAINT "Seller_pkey" PRIMARY KEY (id);


--
-- Name: ShoppingListSearch ShoppingListSearch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShoppingListSearch"
    ADD CONSTRAINT "ShoppingListSearch_pkey" PRIMARY KEY (id);


--
-- Name: SmartIntentEngineResponse SmartIntentEngineResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartIntentEngineResponse"
    ADD CONSTRAINT "SmartIntentEngineResponse_pkey" PRIMARY KEY (id);


--
-- Name: TestFailureLog TestFailureLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestFailureLog"
    ADD CONSTRAINT "TestFailureLog_pkey" PRIMARY KEY (id);


--
-- Name: UserAddress UserAddress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAddress"
    ADD CONSTRAINT "UserAddress_pkey" PRIMARY KEY (id);


--
-- Name: UserBehavior UserBehavior_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserBehavior"
    ADD CONSTRAINT "UserBehavior_pkey" PRIMARY KEY (id);


--
-- Name: UserCart UserCart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCart"
    ADD CONSTRAINT "UserCart_pkey" PRIMARY KEY (id);


--
-- Name: UserCart UserCart_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCart"
    ADD CONSTRAINT "UserCart_userId_key" UNIQUE ("userId");


--
-- Name: UserMemoryInteraction UserMemoryInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemoryInteraction"
    ADD CONSTRAINT "UserMemoryInteraction_pkey" PRIMARY KEY (id);


--
-- Name: UserMemory UserMemory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemory"
    ADD CONSTRAINT "UserMemory_pkey" PRIMARY KEY (id);


--
-- Name: UserPreference UserPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreference"
    ADD CONSTRAINT "UserPreference_pkey" PRIMARY KEY (id);


--
-- Name: UserPreference UserPreference_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreference"
    ADD CONSTRAINT "UserPreference_userId_key" UNIQUE ("userId");


--
-- Name: UserPreferences UserPreferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreferences"
    ADD CONSTRAINT "UserPreferences_pkey" PRIMARY KEY (id);


--
-- Name: UserSession UserSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_pkey" PRIMARY KEY (id);


--
-- Name: UserSession UserSession_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_token_key" UNIQUE (token);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WalletAuditLog WalletAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuditLog"
    ADD CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: WalletAuthorization WalletAuthorization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuthorization"
    ADD CONSTRAINT "WalletAuthorization_pkey" PRIMARY KEY (id);


--
-- Name: WalletSpendingLimit WalletSpendingLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletSpendingLimit"
    ADD CONSTRAINT "WalletSpendingLimit_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransactionLog WalletTransactionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransactionLog"
    ADD CONSTRAINT "WalletTransactionLog_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransaction WalletTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Wallet Wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_pkey" PRIMARY KEY (id);


--
-- Name: WishlistItem WishlistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY (id);


--
-- Name: AIDecisionLog_correlationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIDecisionLog_correlationId_idx" ON public."AIDecisionLog" USING btree ("correlationId");


--
-- Name: AIDecisionLog_decisionType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIDecisionLog_decisionType_idx" ON public."AIDecisionLog" USING btree ("decisionType");


--
-- Name: AIDecisionLog_traceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIDecisionLog_traceId_idx" ON public."AIDecisionLog" USING btree ("traceId");


--
-- Name: AIDecisionLog_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIDecisionLog_userId_timestamp_idx" ON public."AIDecisionLog" USING btree ("userId", "timestamp");


--
-- Name: ActivityLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityLog_action_createdAt_idx" ON public."ActivityLog" USING btree (action, "createdAt");


--
-- Name: ActivityLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityLog_userId_createdAt_idx" ON public."ActivityLog" USING btree ("userId", "createdAt");


--
-- Name: ApprovalRequest_correlationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_correlationId_idx" ON public."ApprovalRequest" USING btree ("correlationId");


--
-- Name: ApprovalRequest_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_status_expiresAt_idx" ON public."ApprovalRequest" USING btree (status, "expiresAt");


--
-- Name: ApprovalRequest_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_userId_status_idx" ON public."ApprovalRequest" USING btree ("userId", status);


--
-- Name: AutoDecisionLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoDecisionLog_userId_createdAt_idx" ON public."AutoDecisionLog" USING btree ("userId", "createdAt");


--
-- Name: BuyRequest_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyRequest_status_createdAt_idx" ON public."BuyRequest" USING btree (status, "createdAt");


--
-- Name: BuyRequest_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyRequest_userId_status_createdAt_idx" ON public."BuyRequest" USING btree ("userId", status, "createdAt");


--
-- Name: BuyingPattern_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyingPattern_userId_idx" ON public."BuyingPattern" USING btree ("userId");


--
-- Name: BuyingPattern_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BuyingPattern_userId_key" ON public."BuyingPattern" USING btree ("userId");


--
-- Name: CartItem_cartId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON public."CartItem" USING btree ("cartId", "productId");


--
-- Name: ChatMessage_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatMessage_userId_createdAt_idx" ON public."ChatMessage" USING btree ("userId", "createdAt");


--
-- Name: DemandMetrics_sellerId_scope_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DemandMetrics_sellerId_scope_createdAt_idx" ON public."DemandMetrics" USING btree ("sellerId", scope, "createdAt");


--
-- Name: DemandMetrics_sellerId_scope_scopeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DemandMetrics_sellerId_scope_scopeId_key" ON public."DemandMetrics" USING btree ("sellerId", scope, "scopeId");


--
-- Name: FeatureFlag_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureFlag_name_idx" ON public."FeatureFlag" USING btree (name);


--
-- Name: FeatureFlag_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeatureFlag_name_key" ON public."FeatureFlag" USING btree (name);


--
-- Name: ListingTemplate_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingTemplate_isActive_idx" ON public."ListingTemplate" USING btree ("isActive");


--
-- Name: ListingTemplate_sellerId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingTemplate_sellerId_category_idx" ON public."ListingTemplate" USING btree ("sellerId", category);


--
-- Name: MemoryInsight_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MemoryInsight_expiresAt_idx" ON public."MemoryInsight" USING btree ("expiresAt");


--
-- Name: MemoryInsight_userMemoryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MemoryInsight_userMemoryId_key" ON public."MemoryInsight" USING btree ("userMemoryId");


--
-- Name: MemoryInsight_userPreferencesId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MemoryInsight_userPreferencesId_idx" ON public."MemoryInsight" USING btree ("userPreferencesId");


--
-- Name: MemoryInsight_userPreferencesId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MemoryInsight_userPreferencesId_key" ON public."MemoryInsight" USING btree ("userPreferencesId");


--
-- Name: PreferenceQuiz_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreferenceQuiz_status_idx" ON public."PreferenceQuiz" USING btree (status);


--
-- Name: PreferenceQuiz_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreferenceQuiz_userId_idx" ON public."PreferenceQuiz" USING btree ("userId");


--
-- Name: PriceHistory_productId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_productId_createdAt_idx" ON public."PriceHistory" USING btree ("productId", "createdAt");


--
-- Name: PriceHistory_sellerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_sellerId_createdAt_idx" ON public."PriceHistory" USING btree ("sellerId", "createdAt");


--
-- Name: ProductBusinessMetrics_conversionRate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductBusinessMetrics_conversionRate_idx" ON public."ProductBusinessMetrics" USING btree ("conversionRate");


--
-- Name: ProductBusinessMetrics_inventoryCount_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductBusinessMetrics_inventoryCount_idx" ON public."ProductBusinessMetrics" USING btree ("inventoryCount");


--
-- Name: ProductBusinessMetrics_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductBusinessMetrics_productId_idx" ON public."ProductBusinessMetrics" USING btree ("productId");


--
-- Name: ProductBusinessMetrics_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductBusinessMetrics_productId_key" ON public."ProductBusinessMetrics" USING btree ("productId");


--
-- Name: ProductLearning_reinforcementScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductLearning_reinforcementScore_idx" ON public."ProductLearning" USING btree ("reinforcementScore" DESC);


--
-- Name: ProductLearning_trendingScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductLearning_trendingScore_idx" ON public."ProductLearning" USING btree ("trendingScore" DESC);


--
-- Name: Product_featured_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_featured_createdAt_idx" ON public."Product" USING btree (featured, "createdAt");


--
-- Name: Product_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_featured_idx" ON public."Product" USING btree (featured);


--
-- Name: QueryLearning_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QueryLearning_category_idx" ON public."QueryLearning" USING btree (category);


--
-- Name: QueryLearning_successCount_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QueryLearning_successCount_idx" ON public."QueryLearning" USING btree ("successCount" DESC);


--
-- Name: RankingPersonalization_lastCalculated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RankingPersonalization_lastCalculated_idx" ON public."RankingPersonalization" USING btree ("lastCalculated");


--
-- Name: RankingPersonalization_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RankingPersonalization_userId_idx" ON public."RankingPersonalization" USING btree ("userId");


--
-- Name: RankingPersonalization_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RankingPersonalization_userId_key" ON public."RankingPersonalization" USING btree ("userId");


--
-- Name: SellerAiAnalytics_sellerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SellerAiAnalytics_sellerId_key" ON public."SellerAiAnalytics" USING btree ("sellerId");


--
-- Name: SellerProduct_category_subCategory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerProduct_category_subCategory_idx" ON public."SellerProduct" USING btree (category, "subCategory");


--
-- Name: SellerProduct_conversionRate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerProduct_conversionRate_idx" ON public."SellerProduct" USING btree ("conversionRate");


--
-- Name: SellerProduct_demandScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerProduct_demandScore_idx" ON public."SellerProduct" USING btree ("demandScore");


--
-- Name: SellerProduct_sellerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerProduct_sellerId_status_idx" ON public."SellerProduct" USING btree ("sellerId", status);


--
-- Name: Seller_storeName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Seller_storeName_idx" ON public."Seller" USING btree ("storeName");


--
-- Name: Seller_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Seller_userId_idx" ON public."Seller" USING btree ("userId");


--
-- Name: Seller_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Seller_userId_key" ON public."Seller" USING btree ("userId");


--
-- Name: Seller_vendorTier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Seller_vendorTier_idx" ON public."Seller" USING btree ("vendorTier");


--
-- Name: TestFailureLog_autoFixed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestFailureLog_autoFixed_idx" ON public."TestFailureLog" USING btree ("autoFixed");


--
-- Name: TestFailureLog_failureType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestFailureLog_failureType_idx" ON public."TestFailureLog" USING btree ("failureType");


--
-- Name: UserMemoryInteraction_interactionType_wasSuccessful_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserMemoryInteraction_interactionType_wasSuccessful_idx" ON public."UserMemoryInteraction" USING btree ("interactionType", "wasSuccessful");


--
-- Name: UserMemoryInteraction_userMemoryId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserMemoryInteraction_userMemoryId_timestamp_idx" ON public."UserMemoryInteraction" USING btree ("userMemoryId", "timestamp");


--
-- Name: UserMemory_lastAccessed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserMemory_lastAccessed_idx" ON public."UserMemory" USING btree ("lastAccessed");


--
-- Name: UserMemory_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserMemory_userId_idx" ON public."UserMemory" USING btree ("userId");


--
-- Name: UserMemory_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserMemory_userId_key" ON public."UserMemory" USING btree ("userId");


--
-- Name: UserPreferences_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserPreferences_userId_idx" ON public."UserPreferences" USING btree ("userId");


--
-- Name: UserPreferences_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserPreferences_userId_key" ON public."UserPreferences" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WalletAuditLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletAuditLog_action_createdAt_idx" ON public."WalletAuditLog" USING btree (action, "createdAt");


--
-- Name: WalletAuditLog_walletId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletAuditLog_walletId_createdAt_idx" ON public."WalletAuditLog" USING btree ("walletId", "createdAt");


--
-- Name: WalletAuthorization_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletAuthorization_status_expiresAt_idx" ON public."WalletAuthorization" USING btree (status, "expiresAt");


--
-- Name: WalletAuthorization_walletId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletAuthorization_walletId_status_idx" ON public."WalletAuthorization" USING btree ("walletId", status);


--
-- Name: WalletSpendingLimit_isActive_limitType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletSpendingLimit_isActive_limitType_idx" ON public."WalletSpendingLimit" USING btree ("isActive", "limitType");


--
-- Name: WalletSpendingLimit_walletId_limitType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletSpendingLimit_walletId_limitType_idx" ON public."WalletSpendingLimit" USING btree ("walletId", "limitType");


--
-- Name: WalletTransaction_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_orderId_idx" ON public."WalletTransaction" USING btree ("orderId");


--
-- Name: WalletTransaction_referenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_referenceId_idx" ON public."WalletTransaction" USING btree ("referenceId");


--
-- Name: WalletTransaction_type_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_type_status_createdAt_idx" ON public."WalletTransaction" USING btree (type, status, "createdAt");


--
-- Name: WalletTransaction_walletId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON public."WalletTransaction" USING btree ("walletId", "createdAt");


--
-- Name: Wallet_isAiAuthorized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Wallet_isAiAuthorized_idx" ON public."Wallet" USING btree ("isAiAuthorized");


--
-- Name: Wallet_isLocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Wallet_isLocked_idx" ON public."Wallet" USING btree ("isLocked");


--
-- Name: Wallet_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Wallet_userId_idx" ON public."Wallet" USING btree ("userId");


--
-- Name: Wallet_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Wallet_userId_key" ON public."Wallet" USING btree ("userId");


--
-- Name: idx_ai_preference_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preference_user ON public."AiPreference" USING btree ("userId");


--
-- Name: idx_analytics_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_type ON public."AnalyticsEvent" USING btree ("eventType", "createdAt" DESC);


--
-- Name: idx_analytics_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_user ON public."AnalyticsEvent" USING btree ("userId");


--
-- Name: idx_audit_suspicious; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_suspicious ON public."AuditLog" USING btree (suspicious) WHERE (suspicious = true);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public."AuditLog" USING btree ("userId", "timestamp" DESC);


--
-- Name: idx_behavior_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_behavior_action ON public."UserBehavior" USING btree (action);


--
-- Name: idx_behavior_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_behavior_product ON public."UserBehavior" USING btree ("productId");


--
-- Name: idx_behavior_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_behavior_user ON public."UserBehavior" USING btree ("userId", "createdAt" DESC);


--
-- Name: idx_chat_messages_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_intent ON public."ChatMessage" USING btree (intent) WHERE (intent IS NOT NULL);


--
-- Name: idx_feature_flags_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_flags_name ON public."FeatureFlag" USING btree (name);


--
-- Name: idx_magic_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_token ON public."MagicLink" USING btree (token);


--
-- Name: idx_obs_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obs_name ON public."ObservabilityMetric" USING btree ("metricName", "timestamp" DESC);


--
-- Name: idx_obs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obs_type ON public."ObservabilityMetric" USING btree ("metricType", "timestamp" DESC);


--
-- Name: idx_pref_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pref_user ON public."UserPreference" USING btree ("userId");


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public."Product" USING btree (category);


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_price ON public."Product" USING btree (price);


--
-- Name: idx_seller_products_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_products_search ON public."SellerProduct" USING gin (to_tsvector('english'::regconfig, ((title || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_token ON public."UserSession" USING btree (token);


--
-- Name: idx_sier_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sier_created ON public."SmartIntentEngineResponse" USING btree ("createdAt" DESC);


--
-- Name: idx_sier_enhanced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sier_enhanced ON public."SmartIntentEngineResponse" USING btree ("enhancedByAI");


--
-- Name: idx_sier_query_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sier_query_text ON public."SmartIntentEngineResponse" USING gin (to_tsvector('english'::regconfig, "queryText"));


--
-- Name: idx_sier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sier_user_id ON public."SmartIntentEngineResponse" USING btree ("userId");


--
-- Name: idx_sl_search_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_search_hash ON public."ShoppingListSearch" USING btree ("searchHash", "expiresAt");


--
-- Name: idx_sl_search_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_search_user ON public."ShoppingListSearch" USING btree ("userId", "createdAt" DESC);


--
-- Name: idx_user_address_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_address_user ON public."UserAddress" USING btree ("userId");


--
-- Name: idx_user_cart_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_cart_user ON public."UserCart" USING btree ("userId");


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public."User" USING btree (email);


--
-- Name: idx_wishlist_user_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wishlist_user_product ON public."WishlistItem" USING btree ("userId", "productName");


--
-- Name: idx_wtl_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtl_idempotency ON public."WalletTransactionLog" USING btree ("idempotencyKey");


--
-- Name: idx_wtl_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtl_state ON public."WalletTransactionLog" USING btree (state);


--
-- Name: idx_wtl_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtl_user ON public."WalletTransactionLog" USING btree ("userId", "createdAt" DESC);


--
-- Name: AIDecisionLog AIDecisionLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIDecisionLog"
    ADD CONSTRAINT "AIDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiPreference AiPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPreference"
    ADD CONSTRAINT "AiPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: AnalyticsEvent AnalyticsEvent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- Name: ApprovalRequest ApprovalRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalRequest"
    ADD CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- Name: AutoDecisionLog AutoDecisionLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoDecisionLog"
    ADD CONSTRAINT "AutoDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyRequest BuyRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyRequest"
    ADD CONSTRAINT "BuyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyingPattern BuyingPattern_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyingPattern"
    ADD CONSTRAINT "BuyingPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."UserPreferences"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CartItem CartItem_cartId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES public."Cart"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CartItem CartItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Cart Cart_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChatMessage ChatMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DemandMetrics DemandMetrics_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DemandMetrics"
    ADD CONSTRAINT "DemandMetrics_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ListingTemplate ListingTemplate_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingTemplate"
    ADD CONSTRAINT "ListingTemplate_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MagicLink MagicLink_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MagicLink"
    ADD CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: MemoryInsight MemoryInsight_userMemoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemoryInsight"
    ADD CONSTRAINT "MemoryInsight_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES public."UserMemory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MemoryInsight MemoryInsight_userPreferencesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemoryInsight"
    ADD CONSTRAINT "MemoryInsight_userPreferencesId_fkey" FOREIGN KEY ("userPreferencesId") REFERENCES public."UserPreferences"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PreferenceQuiz PreferenceQuiz_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PreferenceQuiz"
    ADD CONSTRAINT "PreferenceQuiz_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PriceHistory PriceHistory_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductBusinessMetrics ProductBusinessMetrics_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductBusinessMetrics"
    ADD CONSTRAINT "ProductBusinessMetrics_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductLearning ProductLearning_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductLearning"
    ADD CONSTRAINT "ProductLearning_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RankingPersonalization RankingPersonalization_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RankingPersonalization"
    ADD CONSTRAINT "RankingPersonalization_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerAiAnalytics SellerAiAnalytics_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerAiAnalytics"
    ADD CONSTRAINT "SellerAiAnalytics_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerProduct SellerProduct_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerProduct"
    ADD CONSTRAINT "SellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Seller Seller_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Seller"
    ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShoppingListSearch ShoppingListSearch_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShoppingListSearch"
    ADD CONSTRAINT "ShoppingListSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: SmartIntentEngineResponse SmartIntentEngineResponse_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartIntentEngineResponse"
    ADD CONSTRAINT "SmartIntentEngineResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- Name: UserAddress UserAddress_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAddress"
    ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserBehavior UserBehavior_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserBehavior"
    ADD CONSTRAINT "UserBehavior_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- Name: UserCart UserCart_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCart"
    ADD CONSTRAINT "UserCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserMemoryInteraction UserMemoryInteraction_userMemoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemoryInteraction"
    ADD CONSTRAINT "UserMemoryInteraction_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES public."UserMemory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserMemory UserMemory_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMemory"
    ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPreference UserPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreference"
    ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserPreferences UserPreferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPreferences"
    ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserSession UserSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: User User_defaultBillingAddressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_defaultBillingAddressId_fkey" FOREIGN KEY ("defaultBillingAddressId") REFERENCES public."UserAddress"(id) ON DELETE SET NULL;


--
-- Name: User User_defaultShippingAddressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_defaultShippingAddressId_fkey" FOREIGN KEY ("defaultShippingAddressId") REFERENCES public."UserAddress"(id) ON DELETE SET NULL;


--
-- Name: WalletAuditLog WalletAuditLog_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuditLog"
    ADD CONSTRAINT "WalletAuditLog_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WalletAuthorization WalletAuthorization_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletAuthorization"
    ADD CONSTRAINT "WalletAuthorization_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WalletSpendingLimit WalletSpendingLimit_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletSpendingLimit"
    ADD CONSTRAINT "WalletSpendingLimit_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WalletTransactionLog WalletTransactionLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransactionLog"
    ADD CONSTRAINT "WalletTransactionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: WalletTransaction WalletTransaction_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wallet Wallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict HyDzf1oRbHXxO99hhTvhBRjwVR5PXhbN5TTq9VMcXq0b5qPSabfWXCwsHSPpEAW

