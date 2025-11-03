-- ============================================================
-- CLEAN MIGRATION: Works regardless of current state
-- ============================================================

-- ============================================================
-- PART 1: DROP ALL VIEWS
-- ============================================================

DROP VIEW IF EXISTS quantguide_difficulty_easy CASCADE;
DROP VIEW IF EXISTS quantguide_difficulty_medium CASCADE;
DROP VIEW IF EXISTS quantguide_difficulty_hard CASCADE;
DROP VIEW IF EXISTS quantguide_difficulty_unknown CASCADE;
DROP VIEW IF EXISTS quantguide_tag_probability CASCADE;
DROP VIEW IF EXISTS quantguide_tag_brainteasers CASCADE;
DROP VIEW IF EXISTS quantguide_tag_finance CASCADE;
DROP VIEW IF EXISTS quantguide_tag_statistics CASCADE;
DROP VIEW IF EXISTS quantguide_tag_pure_math CASCADE;
DROP VIEW IF EXISTS quantguide_tag_coding CASCADE;
DROP VIEW IF EXISTS quantguide_tag_pricing CASCADE;
DROP VIEW IF EXISTS quantguide_easy_probability CASCADE;
DROP VIEW IF EXISTS quantguide_medium_probability CASCADE;
DROP VIEW IF EXISTS quantguide_hard_probability CASCADE;
DROP VIEW IF EXISTS quantguide_easy_brainteasers CASCADE;
DROP VIEW IF EXISTS quantguide_medium_brainteasers CASCADE;
DROP VIEW IF EXISTS quantguide_hard_brainteasers CASCADE;
DROP VIEW IF EXISTS quantguide_easy_finance CASCADE;
DROP VIEW IF EXISTS quantguide_medium_finance CASCADE;
DROP VIEW IF EXISTS quantguide_hard_finance CASCADE;
DROP VIEW IF EXISTS quantguide_stats_by_difficulty CASCADE;
DROP VIEW IF EXISTS quantguide_stats_by_tag CASCADE;
DROP VIEW IF EXISTS quantguide_stats_by_difficulty_and_tag CASCADE;

DROP FUNCTION IF EXISTS get_questions_with_all_tags(TEXT[]);
DROP FUNCTION IF EXISTS get_questions_with_any_tags(TEXT[]);

-- ============================================================
-- PART 2: CHECK CURRENT STATE AND CLEAN UP
-- ============================================================

-- Drop any backup columns from failed migrations
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS difficulty_backup CASCADE;
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS tags_backup CASCADE;
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS difficulty_enum CASCADE;
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS tag_enum CASCADE;

-- Drop existing enum-typed columns if they exist
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS difficulty CASCADE;
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS tag CASCADE;
ALTER TABLE quantguide_questions DROP COLUMN IF EXISTS tags CASCADE;

-- ============================================================
-- PART 3: DROP AND RECREATE ENUMS
-- ============================================================

DROP TYPE IF EXISTS difficulty_level CASCADE;
DROP TYPE IF EXISTS question_tag CASCADE;

CREATE TYPE difficulty_level AS ENUM ('Easy', 'Medium', 'Hard', 'Unknown');
CREATE TYPE question_tag AS ENUM (
  'Probability',
  'Brainteasers',
  'Finance',
  'Statistics',
  'Pure Math'
);

-- ============================================================
-- PART 4: ADD NEW COLUMNS WITH ENUM TYPES
-- ============================================================

ALTER TABLE quantguide_questions 
  ADD COLUMN difficulty difficulty_level,
  ADD COLUMN tag question_tag;

-- ============================================================
-- PART 5: POPULATE FROM SCRAPED DATA
-- ============================================================

-- You'll need to re-upload your data using the upload script
-- The columns are now ready with the correct enum types

-- Make difficulty NOT NULL
ALTER TABLE quantguide_questions 
  ALTER COLUMN difficulty SET NOT NULL;

-- ============================================================
-- PART 6: CREATE INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_quantguide_questions_difficulty;
DROP INDEX IF EXISTS idx_quantguide_questions_tags;
DROP INDEX IF EXISTS idx_quantguide_questions_tag;

CREATE INDEX idx_quantguide_questions_difficulty ON quantguide_questions(difficulty);
CREATE INDEX idx_quantguide_questions_tag ON quantguide_questions(tag);

-- ============================================================
-- PART 7: UPDATE COMMENTS
-- ============================================================

COMMENT ON COLUMN quantguide_questions.difficulty IS 'Question difficulty level (Easy, Medium, Hard, Unknown)';
COMMENT ON COLUMN quantguide_questions.tag IS 'Primary question category/tag';

-- ============================================================
-- PART 8: CREATE SIMPLE STATS VIEWS
-- ============================================================

CREATE OR REPLACE VIEW quantguide_stats_difficulty AS
SELECT 
  difficulty,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions), 2) as percentage
FROM quantguide_questions
GROUP BY difficulty
ORDER BY count DESC;

CREATE OR REPLACE VIEW quantguide_stats_tag AS
SELECT 
  tag,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions WHERE tag IS NOT NULL), 2) as percentage
FROM quantguide_questions
WHERE tag IS NOT NULL
GROUP BY tag
ORDER BY count DESC;

CREATE OR REPLACE VIEW quantguide_stats_difficulty_tag AS
SELECT 
  difficulty,
  tag,
  COUNT(*) as count
FROM quantguide_questions
WHERE tag IS NOT NULL
GROUP BY difficulty, tag
ORDER BY difficulty, count DESC;

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

COMMENT ON VIEW quantguide_stats_difficulty IS 'Question count and percentage by difficulty';
COMMENT ON VIEW quantguide_stats_tag IS 'Question count and percentage by tag';
COMMENT ON VIEW quantguide_stats_difficulty_tag IS 'Question count by difficulty and tag combination';
COMMENT ON VIEW quantguide_summary IS 'Overall summary statistics';







