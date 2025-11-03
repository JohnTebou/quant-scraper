/**
 * Get current table structure from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getTableDDL() {
  console.log('🔍 Getting table structure from Supabase...\n');

  // Get column information
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'quantguide_questions'
        ORDER BY ordinal_position;
      `
    });

  if (colError) {
    console.log('⚠️  RPC not available, trying direct query...\n');
    
    // Try to get a sample row to see structure
    const { data: sample, error: sampleError } = await supabase
      .from('quantguide_questions')
      .select('*')
      .limit(1)
      .single();

    if (sampleError) {
      console.error('❌ Error:', sampleError);
    } else if (sample) {
      console.log('📊 Current Table Structure (from sample row):\n');
      console.log('Columns present:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  - ${key}: ${type} = ${JSON.stringify(value)}`);
      });
    }

    // Get count
    const { count } = await supabase
      .from('quantguide_questions')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Total rows: ${count}`);

    // Try to get distinct values for difficulty and tags
    const { data: allRows } = await supabase
      .from('quantguide_questions')
      .select('difficulty, tag, tags')
      .limit(100);

    if (allRows && allRows.length > 0) {
      console.log('\n📊 Sample Data Analysis (first 100 rows):');
      
      // Check what columns exist
      const firstRow = allRows[0];
      console.log('\nColumns in response:');
      Object.keys(firstRow).forEach(key => {
        console.log(`  - ${key}`);
      });

      // Analyze difficulty
      if ('difficulty' in firstRow) {
        const difficulties = new Set(allRows.map(r => r.difficulty).filter(Boolean));
        console.log(`\nDifficulty values: ${Array.from(difficulties).join(', ')}`);
        console.log(`Difficulty type: ${typeof firstRow.difficulty}`);
      }

      // Analyze tag
      if ('tag' in firstRow) {
        const tags = new Set(allRows.map(r => r.tag).filter(Boolean));
        console.log(`\nTag values: ${Array.from(tags).join(', ')}`);
        console.log(`Tag type: ${typeof firstRow.tag}`);
      }

      // Analyze tags array
      if ('tags' in firstRow) {
        console.log(`\nTags array exists: ${firstRow.tags !== null && firstRow.tags !== undefined}`);
        if (firstRow.tags) {
          console.log(`Tags array type: ${Array.isArray(firstRow.tags) ? 'array' : typeof firstRow.tags}`);
        }
      }
    }

  } else {
    console.log('✅ Column Information:\n');
    console.log(columns);
  }

  // Check for enums
  console.log('\n🔍 Checking for custom types/enums...\n');
  console.log('Run this SQL in Supabase SQL Editor to see enums:');
  console.log('```sql');
  console.log(`SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;`);
  console.log('```');

  console.log('\n📋 And this to see full table structure:');
  console.log('```sql');
  console.log(`SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'quantguide_questions'
ORDER BY ordinal_position;`);
  console.log('```');
}

getTableDDL();






