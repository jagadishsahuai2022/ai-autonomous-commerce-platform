-- Add missing columns to SmartIntentEngineResponse
ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "comments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- Seed some example self-learning records so the dashboard shows data
INSERT INTO "SmartIntentEngineResponse" 
  ("queryBy", "queryText", "initialProductSuggestionText", "intentEngineResponse", "supervisedResponse", "isActive", "comments", "createdAt", "updatedAt")
VALUES
  (
    'admin@delegatecart.com',
    'lg washing machine under 50000',
    'Great choice! Here are the top washing machines I recommend: 1. LG EcoHybrid 9 Lite (₹46,299) 2. LG Direct Drive 2 5G (₹47,599) 3. LG AI DD 6.5 4G (₹36,099) — Pro Tip: Inverter technology saves 30-50% energy.',
    '{"engine_version": "v2", "intent": {"category": "washing_machine", "brand": "lg", "budget": {"min": 0, "max": 50000}}, "questions": [{"id": "q1", "category": "use_case"}, {"id": "q2", "category": "feature"}]}',
    '{"products": [{"name": "LG EcoHybrid 9 Lite", "price": 46299, "rating": 4.5}, {"name": "LG Direct Drive 2 5G", "price": 47599, "rating": 4.3}], "recommendation": "LG front-load washers under 50k with inverter motor are most energy efficient"}',
    true,
    '[{"action": "created", "by": "system", "at": "2026-04-09T00:00:00Z", "message": "Initial capture from Smart Assistant"}]',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  ),
  (
    'admin@delegatecart.com',
    'apple laptop under 200000',
    'Great choice! Here are the top laptops I recommend: 1. Apple MacBook Air M3 (₹1,14,990) 2. Apple MacBook Pro 14 M3 (₹1,69,990) 3. Apple MacBook Pro 16 M3 Pro (₹2,19,990)',
    '{"engine_version": "v2", "intent": {"category": "laptop", "brand": "apple", "budget": {"min": 0, "max": 200000}}, "questions": []}',
    '{"products": [{"name": "MacBook Air M3 13\"", "price": 114900}, {"name": "MacBook Pro 14\" M3", "price": 169900}], "recommendation": "MacBook Air M3 offers best value for most users under 2L"}',
    true,
    '[{"action": "created", "by": "system", "at": "2026-04-09T00:00:00Z"}, {"action": "supervisor_edited", "by": "admin@delegatecart.com", "at": "2026-04-09T01:00:00Z", "message": "Updated with accurate pricing"}]',
    NOW() - INTERVAL '1 hour 30 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    'admin@delegatecart.com',
    'split air conditioner under 60000',
    'Here are the best ACs within your budget: 1. Voltas SAC 1★ (₹30,199) 2. LG Direct Drive 2 5G (₹47,599) 3. Voltas SAC 1 Lite★★ (₹48,799)',
    '{"engine_version": "v2", "intent": {"category": "ac", "budget": {"min": 0, "max": 60000}}, "questions": [{"id": "q1", "category": "brand"}, {"id": "q2", "category": "use_case"}]}',
    '{}',
    true,
    '[{"action": "created", "by": "system", "at": "2026-04-09T00:30:00Z"}]',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'anonymous',
    'samsung phone under 30000',
    'Top Samsung phones under ₹30,000: 1. Samsung Galaxy A55 5G (₹26,999) 2. Samsung Galaxy M55 5G (₹24,999) 3. Samsung Galaxy A35 5G (₹22,999)',
    '{"engine_version": "v2", "intent": {"category": "phone", "brand": "samsung", "budget": {"min": 0, "max": 30000}}, "questions": [{"id": "q1", "category": "use_case"}]}',
    '{}',
    true,
    '[{"action": "created", "by": "system", "at": "2026-04-09T00:45:00Z"}]',
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '45 minutes'
  ),
  (
    'anonymous',
    'gaming laptop under 100000',
    'Best gaming laptops under ₹1L: 1. ASUS ROG Strix 1TB SSD + 512GB (₹1,16,899) 2. Acer Nitro V 16 1TB SSD (₹32,499)',
    '{"engine_version": "v2", "intent": {"category": "laptop", "use_case": "gaming", "budget": {"min": 0, "max": 100000}}, "questions": [{"id": "q1", "category": "feature"}]}',
    '{"recommendation": "ASUS ROG or Lenovo Legion offers best gaming performance per rupee"}',
    true,
    '[{"action": "created", "by": "system", "at": "2026-04-09T01:00:00Z"}, {"action": "ai_enriched", "by": "gemini-flash", "at": "2026-04-09T01:30:00Z"}]',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '15 minutes'
  )
ON CONFLICT DO NOTHING;
