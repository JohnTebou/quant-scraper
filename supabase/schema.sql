-- QuantGuide Questions Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Problems table - stores all scraped questions
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  link TEXT UNIQUE NOT NULL,
  url_ending TEXT UNIQUE NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Unknown')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - stores all unique tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Problem tags junction table - many-to-many relationship
CREATE TABLE IF NOT EXISTS problem_tags (
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (problem_id, tag_id)
);

-- Categories table - for AI-generated categorizations
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Problem categories junction table
CREATE TABLE IF NOT EXISTS problem_categories (
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2), -- AI confidence score (0.00 to 1.00)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (problem_id, category_id)
);

-- Scraping metadata table - track scraping runs
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  questions_found INTEGER,
  questions_new INTEGER,
  questions_updated INTEGER,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_url_ending ON problems(url_ending);
CREATE INDEX IF NOT EXISTS idx_problems_scraped_at ON problems(scraped_at);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_problem_tags_problem_id ON problem_tags(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_tags_tag_id ON problem_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_problem_categories_problem_id ON problem_categories(problem_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_problems_updated_at
  BEFORE UPDATE ON problems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for problems with their tags
CREATE OR REPLACE VIEW problems_with_tags AS
SELECT 
  p.id,
  p.name,
  p.link,
  p.url_ending,
  p.difficulty,
  p.description,
  p.created_at,
  p.updated_at,
  p.scraped_at,
  ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM problems p
LEFT JOIN problem_tags pt ON p.id = pt.problem_id
LEFT JOIN tags t ON pt.tag_id = t.id
GROUP BY p.id, p.name, p.link, p.url_ending, p.difficulty, p.description, p.created_at, p.updated_at, p.scraped_at;

-- View for problems with categories
CREATE OR REPLACE VIEW problems_with_categories AS
SELECT 
  p.id,
  p.name,
  p.link,
  p.difficulty,
  ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) AS categories,
  AVG(pc.confidence) AS avg_confidence
FROM problems p
LEFT JOIN problem_categories pc ON p.id = pc.problem_id
LEFT JOIN categories c ON pc.category_id = c.id
GROUP BY p.id, p.name, p.link, p.difficulty;

-- Function to get or create tag
CREATE OR REPLACE FUNCTION get_or_create_tag(tag_name TEXT)
RETURNS UUID AS $$
DECLARE
  tag_id UUID;
BEGIN
  SELECT id INTO tag_id FROM tags WHERE name = tag_name;
  
  IF tag_id IS NULL THEN
    INSERT INTO tags (name) VALUES (tag_name) RETURNING id INTO tag_id;
  END IF;
  
  RETURN tag_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE problems IS 'Stores all scraped quant interview questions';
COMMENT ON TABLE tags IS 'Stores unique tags from the source site (e.g., Probability, Brainteasers)';
COMMENT ON TABLE categories IS 'Stores AI-generated categories for additional organization';
COMMENT ON TABLE problem_tags IS 'Junction table linking problems to their source tags';
COMMENT ON TABLE problem_categories IS 'Junction table linking problems to AI-generated categories';
COMMENT ON TABLE scrape_runs IS 'Tracks metadata about each scraping run';







