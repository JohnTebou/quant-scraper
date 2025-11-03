-- ============================================================
-- UPDATE SCHEMA: Remove description, add question_text and question_html
-- ============================================================

-- Drop description column
ALTER TABLE quantguide_questions 
  DROP COLUMN IF EXISTS description;

-- Add new columns for question content
ALTER TABLE quantguide_questions 
  ADD COLUMN IF NOT EXISTS question_text TEXT,
  ADD COLUMN IF NOT EXISTS question_html TEXT,
  ADD COLUMN IF NOT EXISTS has_latex BOOLEAN DEFAULT false;

-- Add index for searching question text
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_question_text 
  ON quantguide_questions USING gin(to_tsvector('english', question_text));

-- Add comments
COMMENT ON COLUMN quantguide_questions.question_text IS 'Plain text of the question (for AI categorization)';
COMMENT ON COLUMN quantguide_questions.question_html IS 'HTML content with LaTeX/KaTeX formatting preserved';
COMMENT ON COLUMN quantguide_questions.has_latex IS 'Whether the question contains LaTeX/mathematical notation';

-- Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quantguide_questions'
ORDER BY ordinal_position;






