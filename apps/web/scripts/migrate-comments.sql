-- Migration: Add comments column to SmartIntentEngineResponse
-- Append-only audit/change log for tracking all modifications

ALTER TABLE "SmartIntentEngineResponse" 
  ADD COLUMN IF NOT EXISTS "comments" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add index for performance on the comments field
CREATE INDEX IF NOT EXISTS "idx_smart_intent_comments" 
  ON "SmartIntentEngineResponse" USING gin("comments");

-- Verify migration
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'SmartIntentEngineResponse' 
ORDER BY ordinal_position;
