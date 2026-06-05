-- Migration: Add new columns and tables for wallet integration, AI+ features, checkout failures
-- Run against delegatecart database

-- 1. Add monthlyAiBudget + defaultDeliveryDays + defaultPaymentMethod to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlyAiBudget" double precision DEFAULT 50000;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultDeliveryDays" integer DEFAULT 7;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultPaymentMethod" text DEFAULT 'cod';

-- 2. Add processedByAI and autoCheckout flags to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processedByAI" boolean NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autoCheckout" boolean NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingAddress" jsonb;

-- 3. Create AiShoppingList table for AI+ premium users
CREATE TABLE IF NOT EXISTS "AiShoppingList" (
  id SERIAL PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "rawText" text NOT NULL,
  "parsedItems" jsonb,
  "deliveryDays" integer,
  "paymentMethod" text,
  "totalBudget" double precision,
  "status" text NOT NULL DEFAULT 'pending',
  "results" jsonb,
  "orderId" integer REFERENCES "Order"(id),
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create CheckoutFailure table for tracking failed auto-checkouts
CREATE TABLE IF NOT EXISTS "CheckoutFailure" (
  id SERIAL PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "orderId" integer REFERENCES "Order"(id),
  "shoppingListId" integer,
  "aiShoppingListId" integer,
  "failureType" text NOT NULL,
  "failureReason" text NOT NULL,
  "failureDetails" jsonb,
  "items" jsonb,
  "totalAmount" double precision,
  "retryable" boolean NOT NULL DEFAULT true,
  "resolvedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add label column to UserAddress for Home/Work/Other tagging
ALTER TABLE "UserAddress" ADD COLUMN IF NOT EXISTS "label" text DEFAULT 'Home';

-- Done
SELECT 'Migration complete' AS status;
