-- Seed Demo Users for Role-Based Authorization
-- Run after initial schema migration to create demo accounts.
-- Passwords should be set via the app's auth flow (NEXT_PUBLIC_ADMIN_PASSWORD env var).

-- Ensure idempotency: only insert if email doesn't exist

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'admin@delegatecart.com', 'Admin', 'admin', 'AI_PLUS', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'admin@delegatecart.com');

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'analytics@delegatecart.com', 'Analytics', 'analytics', 'BASIC', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'analytics@delegatecart.com');

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'aiplusdemo@delegatecart.com', 'AI Plus Demo', 'aiplus', 'AI_PLUS', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'aiplusdemo@delegatecart.com');

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'observability@delegatecart.com', 'Observability', 'observability', 'BASIC', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'observability@delegatecart.com');

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'reenforcedlearning@delegatecart.com', 'Reinforced Learning', 'reinforced-learning', 'BASIC', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'reenforcedlearning@delegatecart.com');

INSERT INTO "User" (email, name, role, subscription, created_at, updated_at)
SELECT 'basicdemo@delegatecart.com', 'Basic Demo', 'basic', 'BASIC', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'basicdemo@delegatecart.com');
