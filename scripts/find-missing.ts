/**
 * Find questions that are in JSON but not in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findMissing() {
  console.log('🔍 Finding missing questions...\n');

  // Load scraped questions
  const data = await readFile('scraped-problems.json', 'utf-8');
  const scrapedProblems = JSON.parse(data);
  console.log(`📄 Scraped questions: ${scrapedProblems.length}`);

  // Get all questions from Supabase
  const { data: dbQuestions, error } = await supabase
    .from('quantguide_questions')
    .select('url_ending, name');

  if (error) {
    console.error('Error fetching from Supabase:', error);
    return;
  }

  console.log(`📊 Database questions: ${dbQuestions?.length || 0}\n`);

  // Create a set of URL endings in database
  const dbUrlEndings = new Set(dbQuestions?.map(q => q.url_ending) || []);

  // Find missing questions
  const missing = scrapedProblems.filter((p: any) => {
    const urlEnding = p.link.split('/').pop();
    return !dbUrlEndings.has(urlEnding);
  });

  console.log(`❌ Missing questions: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('Missing questions:');
    console.log('='.repeat(60));
    missing.forEach((q: any, i: number) => {
      const urlEnding = q.link.split('/').pop();
      console.log(`${i + 1}. ${q.name}`);
      console.log(`   URL: ${urlEnding}`);
      console.log(`   Difficulty: ${q.difficulty}`);
      console.log(`   Tags: ${q.tags?.join(', ') || 'None'}`);
      console.log();
    });

    // Try to upload missing ones
    console.log('📤 Attempting to upload missing questions...\n');
    
    for (const problem of missing) {
      const urlEnding = problem.link.split('/').pop();
      
      const { error: insertError } = await supabase
        .from('quantguide_questions')
        .insert({
          name: problem.name,
          link: problem.link,
          url_ending: urlEnding,
          difficulty: problem.difficulty,
          tags: problem.tags || [],
          scraped_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`❌ Error inserting ${problem.name}:`, insertError.message);
      } else {
        console.log(`✅ Inserted: ${problem.name}`);
      }
    }
  } else {
    console.log('✅ All questions are in the database!');
  }

  // Final count
  const { count } = await supabase
    .from('quantguide_questions')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Final database count: ${count}`);
}

findMissing();






