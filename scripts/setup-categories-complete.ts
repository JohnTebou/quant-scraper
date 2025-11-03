#!/usr/bin/env tsx

/**
 * Complete setup for AI-generated categories
 * 
 * This script:
 * 1. Adds categories column to database
 * 2. Uploads categorized data
 * 3. Creates category views
 * 4. Provides statistics and verification
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(projectRoot, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CategorizedQuestion {
  name: string;
  link: string;
  url_ending: string;
  difficulty: string;
  tags: string[];
  questionText: string;
  aiCategories: string[];
}

async function executeSQL(sql: string, description: string) {
  console.log(`🔧 ${description}...`);
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error(`❌ ${description} failed:`, error);
    return false;
  } else {
    console.log(`✅ ${description} completed`);
    return true;
  }
}

async function setupCategories() {
  try {
    console.log('🚀 Starting complete category setup...\n');
    
    // Step 1: Add categories column
    console.log('📋 Step 1: Database Schema Update');
    const addColumnSQL = `
      -- Add categories column if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'quantguide_questions' 
          AND column_name = 'categories'
        ) THEN
          ALTER TABLE quantguide_questions ADD COLUMN categories TEXT[];
          CREATE INDEX idx_quantguide_questions_categories ON quantguide_questions USING GIN(categories);
        END IF;
      END $$;
    `;
    
    await executeSQL(addColumnSQL, 'Adding categories column');
    
    // Step 2: Load and upload categorized data
    console.log('\n📋 Step 2: Upload Categorized Data');
    const dataPath = path.join(projectRoot, 'categorizer', 'openai_categorized_final_experimental.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Experimental categorized file not found:', dataPath);
      process.exit(1);
    }

    console.log('📂 Reading categorized questions...');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const questions: CategorizedQuestion[] = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${questions.length} categorized questions`);
    
    // Upload in batches
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(questions.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);
      
      try {
        // Prepare batch update data
        const updates = batch.map(q => ({
          url_ending: q.url_ending,
          categories: q.aiCategories
        }));
        
        // Use upsert to update categories
        const { error } = await supabase
          .from('quantguide_questions')
          .upsert(
            updates.map(u => ({ 
              url_ending: u.url_ending, 
              categories: u.categories 
            })),
            { 
              onConflict: 'url_ending',
              ignoreDuplicates: false 
            }
          );
        
        if (error) {
          console.error(`❌ Batch ${batchNum} failed:`, error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          const progress = ((i + batch.length) / questions.length * 100).toFixed(1);
          console.log(`   ✅ Batch ${batchNum} complete - Progress: ${progress}%`);
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batchNum} error:`, error);
        errorCount += batch.length;
      }
    }
    
    console.log(`\n📊 Upload Summary:`);
    console.log(`   ✅ Successful updates: ${successCount}`);
    console.log(`   ❌ Failed updates: ${errorCount}`);
    console.log(`   📈 Success rate: ${(successCount / questions.length * 100).toFixed(1)}%`);
    
    // Step 3: Create category views
    console.log('\n📋 Step 3: Create Category Views');
    const viewsPath = path.join(projectRoot, 'supabase', 'create-category-views.sql');
    const viewsSQL = fs.readFileSync(viewsPath, 'utf-8');
    
    await executeSQL(viewsSQL, 'Creating category views');
    
    // Step 4: Verify and show statistics
    console.log('\n📋 Step 4: Verification and Statistics');
    
    // Get category statistics
    const { data: stats, error: statsError } = await supabase
      .from('quantguide_category_stats')
      .select('*')
      .order('question_count', { ascending: false })
      .limit(10);
    
    if (statsError) {
      console.error('❌ Error fetching stats:', statsError);
    } else if (stats) {
      console.log('\n📊 Top 10 Categories:');
      console.log('─'.repeat(80));
      stats.forEach((stat, i) => {
        console.log(`${(i+1).toString().padStart(2)}. ${stat.category_name.padEnd(35)} ${stat.question_count.toString().padStart(4)} questions (${stat.percentage}%)`);
      });
    }
    
    // Check uncategorized questions
    const { count: uncategorizedCount } = await supabase
      .from('quantguide_uncategorized')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📋 Summary:`);
    console.log(`   📚 Total questions: ${questions.length}`);
    console.log(`   🏷️  Categorized: ${questions.length - (uncategorizedCount || 0)}`);
    console.log(`   ❓ Uncategorized: ${uncategorizedCount || 0}`);
    console.log(`   📊 Category views created: 22`);
    console.log(`   📈 Statistics view: quantguide_category_stats`);
    
    console.log('\n🎉 Category setup complete!');
    console.log('\n📋 Available Views:');
    console.log('   • quantguide_category_[name] - Individual category views');
    console.log('   • quantguide_category_stats - Category statistics');
    console.log('   • quantguide_category_combinations - Category combinations');
    console.log('   • quantguide_uncategorized - Questions without categories');
    console.log('   • quantguide_multi_category - Questions with multiple categories');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
console.log('🎯 AI Category Database Setup');
console.log('═'.repeat(80));
setupCategories().catch(console.error);
