#!/usr/bin/env tsx

// Takes all our AI categories and turns them into SQL statements
// Much easier than trying to connect to the database directly

import fs from 'fs';
import path from 'path';

interface CategorizedQuestion {
  name: string;
  url_ending: string;
  aiCategories: string[];
}

async function prepareUploadData() {
  try {
    // Load up all our categorized questions
    const dataPath = path.join(process.cwd(), 'categorizer', 'openai_categorized_final_experimental.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Experimental categorized file not found:', dataPath);
      process.exit(1);
    }

    console.log('📂 Reading categorized questions...');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const questions: CategorizedQuestion[] = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${questions.length} categorized questions`);
    
    // Turn each question into a nice SQL UPDATE statement
    const sqlStatements: string[] = [];
    
    questions.forEach((question, index) => {
      if (question.aiCategories && question.aiCategories.length > 0) {
        const categoriesArray = `ARRAY[${question.aiCategories.map(cat => `'${cat.replace(/'/g, "''")}'`).join(', ')}]`;
        const sql = `UPDATE quantguide_questions SET categories = ${categoriesArray} WHERE url_ending = '${question.url_ending.replace(/'/g, "''")}';`;
        sqlStatements.push(sql);
      }
    });
    
    // Write SQL file
    const sqlContent = `-- AI Categories Upload SQL
-- Generated from openai_categorized_final_experimental.json
-- Total questions with categories: ${sqlStatements.length}

-- Add categories column if it doesn't exist
ALTER TABLE quantguide_questions 
ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_quantguide_questions_categories 
ON quantguide_questions USING GIN(categories);

-- Update statements
${sqlStatements.join('\n')}

-- Verification query
SELECT 
  COUNT(*) as total_questions,
  COUNT(categories) as questions_with_categories,
  COUNT(*) - COUNT(categories) as uncategorized_questions
FROM quantguide_questions;
`;
    
    const sqlPath = path.join(process.cwd(), 'supabase', 'upload-categories.sql');
    fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
    
    console.log(`✅ SQL upload script created: ${sqlPath}`);
    console.log(`📊 Generated ${sqlStatements.length} UPDATE statements`);
    
    // Create summary statistics
    const categoryStats = new Map<string, number>();
    questions.forEach(q => {
      q.aiCategories?.forEach(cat => {
        categoryStats.set(cat, (categoryStats.get(cat) || 0) + 1);
      });
    });
    
    console.log('\n📊 Category Statistics:');
    console.log('─'.repeat(60));
    Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count], i) => {
        const pct = (count / questions.length * 100).toFixed(1);
        console.log(`${(i+1).toString().padStart(2)}. ${cat.padEnd(35)} ${count.toString().padStart(4)} (${pct}%)`);
      });
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Run: supabase/add-categories-column.sql');
    console.log('2. Run: supabase/upload-categories.sql');
    console.log('3. Run: supabase/create-category-views.sql');
    console.log('4. Verify with: SELECT * FROM quantguide_category_stats LIMIT 10;');
    
  } catch (error) {
    console.error('❌ Preparation failed:', error);
    process.exit(1);
  }
}

// Run the preparation
prepareUploadData().catch(console.error);
