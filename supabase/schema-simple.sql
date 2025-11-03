-- QuantGuide Questions Database Schema (Simplified)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main questions table for QuantGuide
CREATE TABLE IF NOT EXISTS quantguide_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  link TEXT UNIQUE NOT NULL,
  url_ending TEXT UNIQUE NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Unknown')),
  tags TEXT[], -- Array of tags (e.g., ['Probability', 'Brainteasers'])
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_difficulty ON quantguide_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_url_ending ON quantguide_questions(url_ending);
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_scraped_at ON quantguide_questions(scraped_at);
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_tags ON quantguide_questions USING GIN(tags);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_quantguide_questions_updated_at
  BEFORE UPDATE ON quantguide_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE quantguide_questions IS 'Stores all scraped quant interview questions from QuantGuide.io';
COMMENT ON COLUMN quantguide_questions.tags IS 'Array of tags from the source site (e.g., Probability, Brainteasers, Finance)';
COMMENT ON COLUMN quantguide_questions.url_ending IS 'The last part of the URL (e.g., "place-or-take" from /questions/place-or-take)';






