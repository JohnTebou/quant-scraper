#!/usr/bin/env tsx

/**
 * Upload AI-generated categories to Supabase database
 * 
 * This script:
 * 1. Reads the experimental categorized questions JSON
 * 2. Updates the quantguide_questions table with categories
 * 3. Provides progress tracking and error handling
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

async function uploadCategories() {
  try {
    // Read the experimental categorized data
    const dataPath = path.join(projectRoot, 'categorizer', 'openai_categorized_final_experimental.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Experimental categorized file not found:', dataPath);
      process.exit(1);
    }

    console.log('📂 Reading categorized questions...');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const questions: CategorizedQuestion[] = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${questions.length} categorized questions`);
    
    // Check if categories column exists
    console.log('🔍 Checking database schema...');
    const { data: columns, error: schemaError } = await supabase
      .from('quantguide_questions')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);
      process.exit(1);
    }

    // Update questions with categories in batches
    console.log('🚀 Starting category upload...');
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(questions.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);
      
      try {
        // Update each question in the batch
        for (const question of batch) {
          const { error } = await supabase
            .from('quantguide_questions')
            .update({ 
              categories: question.aiCategories 
            })
            .eq('url_ending', question.url_ending);
          
          if (error) {
            console.error(`❌ Error updating ${question.name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        }
        
        // Progress update
        const progress = ((i + batch.length) / questions.length * 100).toFixed(1);
        console.log(`   ✅ Batch ${batchNum} complete - Progress: ${progress}%`);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Batch ${batchNum} failed:`, error);
        errorCount += batch.length;
      }
    }
    
    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Successful updates: ${successCount}`);
    console.log(`   ❌ Failed updates: ${errorCount}`);
    console.log(`   📈 Success rate: ${(successCount / questions.length * 100).toFixed(1)}%`);
    
    if (successCount > 0) {
      console.log('\n🎉 Categories successfully uploaded to database!');
      console.log('📋 Next steps:');
      console.log('   1. Run the category views SQL script');
      console.log('   2. Verify the views are working');
      console.log('   3. Check category statistics');
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

// Run the upload
uploadCategories().catch(console.error);
