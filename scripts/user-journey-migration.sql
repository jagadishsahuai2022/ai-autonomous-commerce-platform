-- ============================================================
-- User Journey Event Tracking Migration
-- Creates UserJourneyEvent table for observability dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS "UserJourneyEvent" (
  id            BIGSERIAL PRIMARY KEY,
  "sessionId"   TEXT NOT NULL,
  "journeyId"   TEXT,                          -- groups events for a single purchase flow
  "userId"      INTEGER,
  "userEmail"   TEXT,
  "userName"    TEXT,
  "eventType"   TEXT NOT NULL,                 -- see event type list below
  "productId"   TEXT,
  "productName" TEXT,
  "productCategory" TEXT,
  "productPrice" NUMERIC(12,2),
  "orderId"     TEXT,
  metadata      JSONB DEFAULT '{}',
  "previousEventId" BIGINT REFERENCES "UserJourneyEvent"(id) ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event types:
--   product_clicked    – user clicks a product card on listing page
--   wishlist_added     – product added to wishlist
--   wishlist_removed   – product removed from wishlist
--   cart_added         – product added to cart
--   cart_removed       – product removed from cart
--   checkout_started   – user proceeds to checkout
--   payment_started    – payment page loaded
--   payment_success    – payment completed successfully
--   payment_failed     – payment failed
--   order_placed       – order confirmed
--   order_failed       – order creation failed

CREATE INDEX IF NOT EXISTS "idx_uje_session"   ON "UserJourneyEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_uje_journey"   ON "UserJourneyEvent"("journeyId");
CREATE INDEX IF NOT EXISTS "idx_uje_user"      ON "UserJourneyEvent"("userId");
CREATE INDEX IF NOT EXISTS "idx_uje_type"      ON "UserJourneyEvent"("eventType");
CREATE INDEX IF NOT EXISTS "idx_uje_created"   ON "UserJourneyEvent"("createdAt" DESC);

-- Seed a few demo events so the dashboard has data immediately
INSERT INTO "UserJourneyEvent" ("sessionId","journeyId","userId","userEmail","userName","eventType","productId","productName","productCategory","productPrice","metadata","createdAt")
VALUES
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','product_clicked','mock-1','Apple 15 Pro Max 5G Black','Electronics',139999,'{"source":"listing"}',NOW() - INTERVAL '2 hours'),
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','cart_added','mock-1','Apple 15 Pro Max 5G Black','Electronics',139999,'{"quantity":1}',NOW() - INTERVAL '1 hour 55 minutes'),
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','checkout_started',NULL,NULL,NULL,NULL,'{"cartTotal":139999,"itemCount":1}',NOW() - INTERVAL '1 hour 50 minutes'),
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','payment_started',NULL,NULL,NULL,NULL,'{"amount":139999,"method":"credit_card"}',NOW() - INTERVAL '1 hour 45 minutes'),
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','payment_success',NULL,NULL,NULL,NULL,'{"transactionId":"txn-demo-1","amount":139999}',NOW() - INTERVAL '1 hour 40 minutes'),
  ('sess-demo-1','journey-demo-1',1,'demo@delegatecart.com','Demo User','order_placed',NULL,NULL,NULL,NULL,'{"orderId":"ORD-DEMO-001","total":139999}',NOW() - INTERVAL '1 hour 38 minutes'),
  ('sess-demo-2',NULL,2,'alice@example.com','Alice Johnson','product_clicked','mock-2','Samsung Galaxy S24 Ultra Pro Black','Electronics',129999,'{"source":"search"}',NOW() - INTERVAL '30 minutes'),
  ('sess-demo-2',NULL,2,'alice@example.com','Alice Johnson','wishlist_added','mock-2','Samsung Galaxy S24 Ultra Pro Black','Electronics',129999,'{}',NOW() - INTERVAL '28 minutes'),
  ('sess-demo-2',NULL,2,'alice@example.com','Alice Johnson','product_clicked','mock-1001','Dell XPS 15 5G Black','Electronics',189999,'{"source":"listing"}',NOW() - INTERVAL '20 minutes'),
  ('sess-demo-2',NULL,2,'alice@example.com','Alice Johnson','cart_added','mock-1001','Dell XPS 15 5G Black','Electronics',189999,'{"quantity":1}',NOW() - INTERVAL '18 minutes'),
  ('sess-demo-3',NULL,3,'bob@example.com','Bob Smith','product_clicked','mock-2000','Sony WH-1000XM5 5G Black','Electronics',24999,'{"source":"recommendation"}',NOW() - INTERVAL '10 minutes'),
  ('sess-demo-3',NULL,3,'bob@example.com','Bob Smith','cart_added','mock-2000','Sony WH-1000XM5 5G Black','Electronics',24999,'{"quantity":2}',NOW() - INTERVAL '8 minutes')
ON CONFLICT DO NOTHING;
