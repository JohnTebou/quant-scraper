-- ============================================================
-- FIX ENUMS: Remove unused values (Coding, Pricing)
-- ============================================================
-- Current state:
--   - difficulty_level enum: Easy, Medium, Hard, Unknown ✅
--   - question_tag enum: Probability, Brainteasers, Finance, Statistics, Pure Math, Coding, Pricing
--   - Need to remove: Coding, Pricing (no data uses these)
-- ============================================================

-- IMPORTANT: PostgreSQL doesn't allow removing enum values directly
-- We need to recreate the enum

-- ============================================================
-- STEP 1: Drop views that depend on the tag column
-- ============================================================

DROP VIEW IF EXISTS quantguide_stats_tag CASCADE;
DROP VIEW IF EXISTS quantguide_stats_difficulty_tag CASCADE;
DROP VIEW IF EXISTS quantguide_summary CASCADE;

-- ============================================================
-- STEP 2: Create new enum without Coding/Pricing
-- ============================================================

CREATE TYPE question_tag_new AS ENUM (
  'Probability',
  'Brainteasers',
  'Finance',
  'Statistics',
  'Pure Math'
);

-- ============================================================
-- STEP 3: Migrate the column to the new enum
-- ============================================================

-- Convert the column to the new enum type
ALTER TABLE quantguide_questions 
  ALTER COLUMN tag TYPE question_tag_new 
  USING tag::text::question_tag_new;

-- ============================================================
-- STEP 4: Drop old enum and rename new one
-- ============================================================

DROP TYPE question_tag;
ALTER TYPE question_tag_new RENAME TO question_tag;

-- ============================================================
-- STEP 5: Recreate the views
-- ============================================================

-- Stats by tag
CREATE OR REPLACE VIEW quantguide_stats_tag AS
SELECT 
  tag,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions WHERE tag IS NOT NULL), 2) as percentage
FROM quantguide_questions
WHERE tag IS NOT NULL
GROUP BY tag
ORDER BY count DESC;

-- Stats by difficulty and tag
CREATE OR REPLACE VIEW quantguide_stats_difficulty_tag AS
SELECT 
  difficulty,
  tag,
  COUNT(*) as count
FROM quantguide_questions
WHERE tag IS NOT NULL
GROUP BY difficulty, tag
ORDER BY difficulty, count DESC;

-- Summary view
CREATE OR REPLACE VIEW quantguide_summary AS
SELECT 
  COUNT(*) as total_questions,
  COUNT(CASE WHEN difficulty = 'Easy' THEN 1 END) as easy_count,
  COUNT(CASE WHEN difficulty = 'Medium' THEN 1 END) as medium_count,
  COUNT(CASE WHEN difficulty = 'Hard' THEN 1 END) as hard_count,
  COUNT(CASE WHEN tag = 'Probability' THEN 1 END) as probability_count,
  COUNT(CASE WHEN tag = 'Brainteasers' THEN 1 END) as brainteasers_count,
  COUNT(CASE WHEN tag = 'Finance' THEN 1 END) as finance_count,
  COUNT(CASE WHEN tag = 'Statistics' THEN 1 END) as statistics_count,
  COUNT(CASE WHEN tag = 'Pure Math' THEN 1 END) as pure_math_count
FROM quantguide_questions;

COMMENT ON VIEW quantguide_stats_tag IS 'Question count and percentage by tag';
COMMENT ON VIEW quantguide_stats_difficulty_tag IS 'Question count by difficulty and tag combination';
COMMENT ON VIEW quantguide_summary IS 'Overall summary statistics';

-- ============================================================
-- STEP 6: Verify the change
-- ============================================================

-- Check enum values
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN ('difficulty_level', 'question_tag')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================================
-- DONE! Your enums now match your actual data:
--   - difficulty_level: Easy, Medium, Hard, Unknown
--   - question_tag: Probability, Brainteasers, Finance, Statistics, Pure Math
-- ============================================================

