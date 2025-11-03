-- Category views for all the AI-generated tags
-- These update automatically when we change the main table
-- Built from GPT-4o's strategy-focused analysis (pretty smart stuff)

-- ============================================================
-- INDIVIDUAL CATEGORY VIEWS
-- ============================================================

-- Algebra questions
CREATE OR REPLACE VIEW quantguide_category_algebra AS
SELECT * FROM quantguide_questions
WHERE 'Algebra' = ANY(categories);

-- Binomial Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_binomial_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Binomial Random Variables' = ANY(categories);

-- Calculus questions
CREATE OR REPLACE VIEW quantguide_category_calculus AS
SELECT * FROM quantguide_questions
WHERE 'Calculus' = ANY(categories);

-- Cards questions
CREATE OR REPLACE VIEW quantguide_category_cards AS
SELECT * FROM quantguide_questions
WHERE 'Cards' = ANY(categories);

-- Coins questions
CREATE OR REPLACE VIEW quantguide_category_coins AS
SELECT * FROM quantguide_questions
WHERE 'Coins' = ANY(categories);

-- Combinatorics questions
CREATE OR REPLACE VIEW quantguide_category_combinatorics AS
SELECT * FROM quantguide_questions
WHERE 'Combinatorics' = ANY(categories);

-- Continuous Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_continuous_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Continuous Random Variables' = ANY(categories);

-- Dice questions
CREATE OR REPLACE VIEW quantguide_category_dice AS
SELECT * FROM quantguide_questions
WHERE 'Dice' = ANY(categories);

-- Discrete Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_discrete_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Discrete Random Variables' = ANY(categories);

-- Exponential Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_exponential_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Exponential Random Variables' = ANY(categories);

-- Game Theory questions
CREATE OR REPLACE VIEW quantguide_category_game_theory AS
SELECT * FROM quantguide_questions
WHERE 'Game Theory' = ANY(categories);

-- Geometry questions
CREATE OR REPLACE VIEW quantguide_category_geometry AS
SELECT * FROM quantguide_questions
WHERE 'Geometry' = ANY(categories);

-- Grids questions
CREATE OR REPLACE VIEW quantguide_category_grids AS
SELECT * FROM quantguide_questions
WHERE 'Grids' = ANY(categories);

-- Hypergeometric Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_hypergeometric_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Hypergeometric Random Variables' = ANY(categories);

-- Linear Algebra questions
CREATE OR REPLACE VIEW quantguide_category_linear_algebra AS
SELECT * FROM quantguide_questions
WHERE 'Linear Algebra' = ANY(categories);

-- Markov Chains questions
CREATE OR REPLACE VIEW quantguide_category_markov_chains AS
SELECT * FROM quantguide_questions
WHERE 'Markov Chains' = ANY(categories);

-- Martingales questions
CREATE OR REPLACE VIEW quantguide_category_martingales AS
SELECT * FROM quantguide_questions
WHERE 'Martingales' = ANY(categories);

-- Normal Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_normal_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Normal Random Variables' = ANY(categories);

-- Poisson Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_poisson_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Poisson Random Variables' = ANY(categories);

-- Random Walks questions
CREATE OR REPLACE VIEW quantguide_category_random_walks AS
SELECT * FROM quantguide_questions
WHERE 'Random Walks' = ANY(categories);

-- Stochastic Processes questions
CREATE OR REPLACE VIEW quantguide_category_stochastic_processes AS
SELECT * FROM quantguide_questions
WHERE 'Stochastic Processes' = ANY(categories);

-- Uniform Random Variables questions
CREATE OR REPLACE VIEW quantguide_category_uniform_random_variables AS
SELECT * FROM quantguide_questions
WHERE 'Uniform Random Variables' = ANY(categories);

-- ============================================================
-- STATS AND ANALYTICS VIEWS
-- ============================================================

CREATE OR REPLACE VIEW quantguide_category_stats AS
WITH category_counts AS (
  SELECT 
    unnest(categories) AS category_name,
    COUNT(*) AS question_count
  FROM quantguide_questions 
  WHERE categories IS NOT NULL
  GROUP BY unnest(categories)
),
difficulty_breakdown AS (
  SELECT 
    unnest(categories) AS category_name,
    difficulty,
    COUNT(*) AS count
  FROM quantguide_questions 
  WHERE categories IS NOT NULL
  GROUP BY unnest(categories), difficulty
),
category_combinations AS (
  SELECT 
    categories,
    COUNT(*) AS combination_count
  FROM quantguide_questions 
  WHERE categories IS NOT NULL AND array_length(categories, 1) > 1
  GROUP BY categories
  ORDER BY combination_count DESC
  LIMIT 20
)
SELECT 
  cc.category_name,
  cc.question_count,
  ROUND(cc.question_count * 100.0 / (SELECT COUNT(*) FROM quantguide_questions WHERE categories IS NOT NULL), 2) AS percentage,
  
  -- Difficulty breakdown
  COALESCE(easy.count, 0) AS easy_count,
  COALESCE(medium.count, 0) AS medium_count,
  COALESCE(hard.count, 0) AS hard_count,
  
  -- Percentages by difficulty
  ROUND(COALESCE(easy.count, 0) * 100.0 / cc.question_count, 1) AS easy_pct,
  ROUND(COALESCE(medium.count, 0) * 100.0 / cc.question_count, 1) AS medium_pct,
  ROUND(COALESCE(hard.count, 0) * 100.0 / cc.question_count, 1) AS hard_pct

FROM category_counts cc
LEFT JOIN difficulty_breakdown easy ON cc.category_name = easy.category_name AND easy.difficulty = 'Easy'
LEFT JOIN difficulty_breakdown medium ON cc.category_name = medium.category_name AND medium.difficulty = 'Medium'
LEFT JOIN difficulty_breakdown hard ON cc.category_name = hard.category_name AND hard.difficulty = 'Hard'
ORDER BY cc.question_count DESC;

-- ============================================================
-- CATEGORY COMBINATIONS VIEW
-- ============================================================

CREATE OR REPLACE VIEW quantguide_category_combinations AS
SELECT 
  categories,
  array_length(categories, 1) AS category_count,
  COUNT(*) AS question_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM quantguide_questions WHERE categories IS NOT NULL), 2) AS percentage,
  
  -- Sample questions with this combination
  (array_agg(name ORDER BY name))[1:3] AS sample_questions
  
FROM quantguide_questions 
WHERE categories IS NOT NULL AND array_length(categories, 1) > 1
GROUP BY categories, array_length(categories, 1)
HAVING COUNT(*) >= 2  -- Only show combinations that appear at least twice
ORDER BY question_count DESC, category_count ASC;

-- ============================================================
-- UNCATEGORIZED QUESTIONS VIEW
-- ============================================================

CREATE OR REPLACE VIEW quantguide_uncategorized AS
SELECT * FROM quantguide_questions
WHERE categories IS NULL OR categories = '{}' OR array_length(categories, 1) = 0;

-- ============================================================
-- MULTI-CATEGORY QUESTIONS VIEW
-- ============================================================

CREATE OR REPLACE VIEW quantguide_multi_category AS
SELECT 
  *,
  array_length(categories, 1) AS category_count
FROM quantguide_questions
WHERE categories IS NOT NULL AND array_length(categories, 1) > 1
ORDER BY array_length(categories, 1) DESC, name;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON VIEW quantguide_category_stats IS 'Statistics and breakdown of AI-generated categories across all questions';
COMMENT ON VIEW quantguide_category_combinations IS 'Most common combinations of categories assigned to questions';
COMMENT ON VIEW quantguide_uncategorized IS 'Questions that have no AI-generated categories assigned';
COMMENT ON VIEW quantguide_multi_category IS 'Questions with multiple AI-generated categories, ordered by category count';

-- Individual category view comments
COMMENT ON VIEW quantguide_category_algebra IS 'Questions requiring algebraic manipulation and equation solving';
COMMENT ON VIEW quantguide_category_combinatorics IS 'Questions involving counting, permutations, and combinations';
COMMENT ON VIEW quantguide_category_game_theory IS 'Questions involving strategic decision-making and Nash equilibrium';
COMMENT ON VIEW quantguide_category_coins IS 'Questions involving coin flips and tosses';
COMMENT ON VIEW quantguide_category_dice IS 'Questions involving dice rolls';
COMMENT ON VIEW quantguide_category_cards IS 'Questions involving playing cards and deck problems';
COMMENT ON VIEW quantguide_category_calculus IS 'Questions requiring derivatives, integrals, or optimization';
COMMENT ON VIEW quantguide_category_linear_algebra IS 'Questions involving matrices, eigenvalues, and linear systems';
COMMENT ON VIEW quantguide_category_geometry IS 'Questions involving shapes, areas, volumes, and distances';
COMMENT ON VIEW quantguide_category_stochastic_processes IS 'Questions involving time-dependent random processes';
COMMENT ON VIEW quantguide_category_markov_chains IS 'Questions involving state transitions and memoryless property';
COMMENT ON VIEW quantguide_category_random_walks IS 'Questions involving sum of random steps';
COMMENT ON VIEW quantguide_category_martingales IS 'Questions using martingale properties';
COMMENT ON VIEW quantguide_category_normal_random_variables IS 'Questions involving Gaussian/normal distributions';
COMMENT ON VIEW quantguide_category_uniform_random_variables IS 'Questions involving uniform distributions';
COMMENT ON VIEW quantguide_category_exponential_random_variables IS 'Questions involving exponential distributions and memoryless property';
COMMENT ON VIEW quantguide_category_binomial_random_variables IS 'Questions involving binomial distributions and independent trials';
COMMENT ON VIEW quantguide_category_poisson_random_variables IS 'Questions involving Poisson distributions and rare events';
COMMENT ON VIEW quantguide_category_hypergeometric_random_variables IS 'Questions involving sampling without replacement';
COMMENT ON VIEW quantguide_category_discrete_random_variables IS 'Questions involving discrete probability distributions';
COMMENT ON VIEW quantguide_category_continuous_random_variables IS 'Questions involving continuous probability distributions';
COMMENT ON VIEW quantguide_category_grids IS 'Questions involving lattice paths and grid navigation';
