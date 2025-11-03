/**
 * Check Supabase connection and data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabase() {
  console.log('🔍 Checking Supabase connection...\n');
  
  // Test connection
  const { data, error, count } = await supabase
    .from('quantguide_questions')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  if (error) {
    console.error('❌ Error connecting to Supabase:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
    return;
  }

  console.log('✅ Connected to Supabase!');
  console.log(`📊 Total questions in database: ${count || 0}\n`);

  if (data && data.length > 0) {
    console.log('Sample questions:');
    console.log('='.repeat(60));
    data.forEach((q, i) => {
      console.log(`\n${i + 1}. ${q.name}`);
      console.log(`   Difficulty: ${q.difficulty}`);
      console.log(`   Tags: ${q.tags?.join(', ') || 'None'}`);
      console.log(`   Link: ${q.link}`);
    });
  } else {
    console.log('⚠️  No questions found in database');
  }

  // Get difficulty breakdown
  const { data: allQuestions } = await supabase
    .from('quantguide_questions')
    .select('difficulty');

  if (allQuestions) {
    const counts: Record<string, number> = {};
    allQuestions.forEach(q => {
      counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
    });

    console.log('\n\n📊 Difficulty breakdown:');
    console.log('='.repeat(60));
    Object.entries(counts).forEach(([diff, count]) => {
      console.log(`   ${diff}: ${count}`);
    });
  }

  // Get tag breakdown
  const { data: questionsWithTags } = await supabase
    .from('quantguide_questions')
    .select('tags');

  if (questionsWithTags) {
    const tagCounts: Record<string, number> = {};
    questionsWithTags.forEach(q => {
      if (q.tags) {
        q.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    console.log('\n\n🏷️  Top tags:');
    console.log('='.repeat(60));
    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count}`);
      });
  }
}

checkSupabase();






