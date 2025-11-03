-- ============================================================
-- PART 1: DROP ALL VIEWS (Keep stats and main table)
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
-- PART 2: BACKUP EXISTING DATA
-- ============================================================

-- Backup existing columns to temporary columns
ALTER TABLE quantguide_questions 
  ADD COLUMN IF NOT EXISTS difficulty_backup TEXT,
  ADD COLUMN IF NOT EXISTS tags_backup TEXT[];

UPDATE quantguide_questions
SET difficulty_backup = difficulty,
    tags_backup = tags;

-- ============================================================
-- PART 3: DROP OLD COLUMNS (so we can drop enums)
-- ============================================================

ALTER TABLE quantguide_questions 
  DROP COLUMN IF EXISTS difficulty CASCADE,
  DROP COLUMN IF EXISTS tags CASCADE;

-- ============================================================
-- PART 4: CREATE ENUMS
-- ============================================================

-- Drop existing enums if they exist
DROP TYPE IF EXISTS difficulty_level CASCADE;
DROP TYPE IF EXISTS question_tag CASCADE;

-- Create difficulty enum
CREATE TYPE difficulty_level AS ENUM ('Easy', 'Medium', 'Hard', 'Unknown');

-- Create tag enum (based on actual tags in your data)
CREATE TYPE question_tag AS ENUM (
  'Probability',
  'Brainteasers',
  'Finance',
  'Statistics',
  'Pure Math'
);

-- ============================================================
-- PART 5: CREATE NEW COLUMNS WITH ENUM TYPES
-- ============================================================

-- Add new columns with enum types
ALTER TABLE quantguide_questions 
  ADD COLUMN difficulty difficulty_level,
  ADD COLUMN tag question_tag;

-- ============================================================
-- PART 6: MIGRATE DATA FROM BACKUP
-- ============================================================

-- Migrate difficulty data
UPDATE quantguide_questions
SET difficulty = difficulty_backup::difficulty_level
WHERE difficulty_backup IN ('Easy', 'Medium', 'Hard', 'Unknown');

-- Migrate tag data (take first tag from array)
UPDATE quantguide_questions
SET tag = (tags_backup[1])::question_tag
WHERE tags_backup IS NOT NULL 
  AND array_length(tags_backup, 1) > 0
  AND tags_backup[1] IN ('Probability', 'Brainteasers', 'Finance', 'Statistics', 'Pure Math');

-- ============================================================
-- PART 7: CLEANUP BACKUP COLUMNS
-- ============================================================

-- Drop backup columns
ALTER TABLE quantguide_questions 
  DROP COLUMN difficulty_backup,
  DROP COLUMN tags_backup;

-- Make difficulty NOT NULL (tag can be NULL)
ALTER TABLE quantguide_questions 
  ALTER COLUMN difficulty SET NOT NULL;

-- ============================================================
-- PART 8: RECREATE INDEXES
-- ============================================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_quantguide_questions_difficulty;
DROP INDEX IF EXISTS idx_quantguide_questions_tags;

-- Create new indexes
CREATE INDEX idx_quantguide_questions_difficulty ON quantguide_questions(difficulty);
CREATE INDEX idx_quantguide_questions_tag ON quantguide_questions(tag);

-- ============================================================
-- PART 9: UPDATE COMMENTS
-- ============================================================

COMMENT ON COLUMN quantguide_questions.difficulty IS 'Question difficulty level (Easy, Medium, Hard, Unknown)';
COMMENT ON COLUMN quantguide_questions.tag IS 'Primary question category/tag';

-- ============================================================
-- PART 10: CREATE SIMPLE STATS VIEWS
-- ============================================================

-- Count by difficulty
CREATE OR REPLACE VIEW quantguide_stats_difficulty AS
SELECT 
  difficulty,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions), 2) as percentage
FROM quantguide_questions
GROUP BY difficulty
ORDER BY count DESC;

-- Count by tag
CREATE OR REPLACE VIEW quantguide_stats_tag AS
SELECT 
  tag,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions WHERE tag IS NOT NULL), 2) as percentage
FROM quantguide_questions
WHERE tag IS NOT NULL
GROUP BY tag
ORDER BY count DESC;

-- Count by difficulty and tag
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

COMMENT ON VIEW quantguide_stats_difficulty IS 'Question count and percentage by difficulty';
COMMENT ON VIEW quantguide_stats_tag IS 'Question count and percentage by tag';
COMMENT ON VIEW quantguide_stats_difficulty_tag IS 'Question count by difficulty and tag combination';
COMMENT ON VIEW quantguide_summary IS 'Overall summary statistics';

