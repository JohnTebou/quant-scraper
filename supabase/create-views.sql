-- Create views for different difficulties and tags
-- Views automatically update when the main table changes

-- ============================================================
-- DIFFICULTY VIEWS
-- ============================================================

-- Easy questions
CREATE OR REPLACE VIEW quantguide_difficulty_easy AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Easy';

-- Medium questions
CREATE OR REPLACE VIEW quantguide_difficulty_medium AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Medium';

-- Hard questions
CREATE OR REPLACE VIEW quantguide_difficulty_hard AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Hard';

-- Unknown difficulty questions
CREATE OR REPLACE VIEW quantguide_difficulty_unknown AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Unknown';

-- ============================================================
-- TAG VIEWS (Based on current tags in database)
-- ============================================================

-- Probability questions
CREATE OR REPLACE VIEW quantguide_tag_probability AS
SELECT * FROM quantguide_questions
WHERE 'Probability' = ANY(tags);

-- Brainteasers questions
CREATE OR REPLACE VIEW quantguide_tag_brainteasers AS
SELECT * FROM quantguide_questions
WHERE 'Brainteasers' = ANY(tags);

-- Finance questions
CREATE OR REPLACE VIEW quantguide_tag_finance AS
SELECT * FROM quantguide_questions
WHERE 'Finance' = ANY(tags);

-- Statistics questions
CREATE OR REPLACE VIEW quantguide_tag_statistics AS
SELECT * FROM quantguide_questions
WHERE 'Statistics' = ANY(tags);

-- Pure Math questions
CREATE OR REPLACE VIEW quantguide_tag_pure_math AS
SELECT * FROM quantguide_questions
WHERE 'Pure Math' = ANY(tags);

-- Coding questions
CREATE OR REPLACE VIEW quantguide_tag_coding AS
SELECT * FROM quantguide_questions
WHERE 'Coding' = ANY(tags);

-- Pricing questions
CREATE OR REPLACE VIEW quantguide_tag_pricing AS
SELECT * FROM quantguide_questions
WHERE 'Pricing' = ANY(tags);

-- ============================================================
-- COMBINED VIEWS (Difficulty + Tag)
-- ============================================================

-- Easy Probability
CREATE OR REPLACE VIEW quantguide_easy_probability AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Easy' AND 'Probability' = ANY(tags);

-- Medium Probability
CREATE OR REPLACE VIEW quantguide_medium_probability AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Medium' AND 'Probability' = ANY(tags);

-- Hard Probability
CREATE OR REPLACE VIEW quantguide_hard_probability AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Hard' AND 'Probability' = ANY(tags);

-- Easy Brainteasers
CREATE OR REPLACE VIEW quantguide_easy_brainteasers AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Easy' AND 'Brainteasers' = ANY(tags);

-- Medium Brainteasers
CREATE OR REPLACE VIEW quantguide_medium_brainteasers AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Medium' AND 'Brainteasers' = ANY(tags);

-- Hard Brainteasers
CREATE OR REPLACE VIEW quantguide_hard_brainteasers AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Hard' AND 'Brainteasers' = ANY(tags);

-- Easy Finance
CREATE OR REPLACE VIEW quantguide_easy_finance AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Easy' AND 'Finance' = ANY(tags);

-- Medium Finance
CREATE OR REPLACE VIEW quantguide_medium_finance AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Medium' AND 'Finance' = ANY(tags);

-- Hard Finance
CREATE OR REPLACE VIEW quantguide_hard_finance AS
SELECT * FROM quantguide_questions
WHERE difficulty = 'Hard' AND 'Finance' = ANY(tags);

-- ============================================================
-- SUMMARY VIEWS
-- ============================================================

-- Count by difficulty
CREATE OR REPLACE VIEW quantguide_stats_by_difficulty AS
SELECT 
  difficulty,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions), 2) as percentage
FROM quantguide_questions
GROUP BY difficulty
ORDER BY count DESC;

-- Count by tag
CREATE OR REPLACE VIEW quantguide_stats_by_tag AS
SELECT 
  unnest(tags) as tag,
  COUNT(*) as count
FROM quantguide_questions
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY tag
ORDER BY count DESC;

-- Count by difficulty and tag
CREATE OR REPLACE VIEW quantguide_stats_by_difficulty_and_tag AS
SELECT 
  difficulty,
  unnest(tags) as tag,
  COUNT(*) as count
FROM quantguide_questions
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY difficulty, tag
ORDER BY difficulty, count DESC;

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Function to get questions by multiple tags (AND logic)
CREATE OR REPLACE FUNCTION get_questions_with_all_tags(tag_array TEXT[])
RETURNS TABLE (
  id UUID,
  name TEXT,
  link TEXT,
  difficulty TEXT,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.name, q.link, q.difficulty, q.tags
  FROM quantguide_questions q
  WHERE q.tags @> tag_array;
END;
$$ LANGUAGE plpgsql;

-- Function to get questions by any of multiple tags (OR logic)
CREATE OR REPLACE FUNCTION get_questions_with_any_tags(tag_array TEXT[])
RETURNS TABLE (
  id UUID,
  name TEXT,
  link TEXT,
  difficulty TEXT,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.name, q.link, q.difficulty, q.tags
  FROM quantguide_questions q
  WHERE q.tags && tag_array;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON VIEW quantguide_difficulty_easy IS 'All easy difficulty questions';
COMMENT ON VIEW quantguide_difficulty_medium IS 'All medium difficulty questions';
COMMENT ON VIEW quantguide_difficulty_hard IS 'All hard difficulty questions';
COMMENT ON VIEW quantguide_tag_probability IS 'All probability questions';
COMMENT ON VIEW quantguide_tag_brainteasers IS 'All brainteaser questions';
COMMENT ON VIEW quantguide_tag_finance IS 'All finance questions';
COMMENT ON VIEW quantguide_stats_by_difficulty IS 'Question count and percentage by difficulty';
COMMENT ON VIEW quantguide_stats_by_tag IS 'Question count by tag';






