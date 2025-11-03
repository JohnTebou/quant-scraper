-- Adding a categories column to store all the AI-generated tags
-- Just a simple text array - nothing fancy

-- Add the categories column
ALTER TABLE quantguide_questions 
ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Make queries faster with an index (trust me, you'll need it)
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_categories 
ON quantguide_questions USING GIN(categories);

-- Document what this column actually does
COMMENT ON COLUMN quantguide_questions.categories IS 'AI-generated categories based on how you would actually solve the problem - much better than just keyword matching';

-- The update trigger should already handle this column, but just making sure
