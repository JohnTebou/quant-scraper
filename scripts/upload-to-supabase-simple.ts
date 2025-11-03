// Takes all our scraped questions and uploads them to Supabase
// The simple version - no fancy stuff, just gets the job done

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';
import type { ScrapedProblem } from '../src/lib/scraper';

// Grab our secret keys from the environment file
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function uploadToSupabase() {
  console.log('📤 Uploading QuantGuide problems to Supabase...\n');

  // Load up all the questions we scraped
  let problems: ScrapedProblem[];
  try {
    const data = await readFile('scraped-problems.json', 'utf-8');
    problems = JSON.parse(data);
    console.log(`✅ Loaded ${problems.length} problems from scraped-problems.json\n`);
  } catch (error) {
    console.error('❌ Error reading scraped-problems.json:', error);
    process.exit(1);
  }

  let questionsNew = 0;
  let questionsUpdated = 0;
  let errors = 0;

  console.log('Processing questions...\n');

  // Process each problem
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const urlEnding = problem.link.split('/').pop() || '';

    try {
      // Check if question already exists
      const { data: existing, error: selectError } = await supabase
        .from('quantguide_questions')
        .select('id')
        .eq('url_ending', urlEnding)
        .maybeSingle();

      if (selectError) {
        console.error(`❌ Error checking ${problem.name}:`, selectError.message);
        errors++;
        continue;
      }

      if (existing) {
        // Update existing question
        const { error: updateError } = await supabase
          .from('quantguide_questions')
          .update({
            name: problem.name,
            link: problem.link,
            difficulty: problem.difficulty,
            tag: problem.tags?.[0] || null, // Use first tag as primary tag
            scraped_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Error updating ${problem.name}:`, updateError.message);
          errors++;
        } else {
          questionsUpdated++;
        }
      } else {
        // Insert new question
        const { error: insertError } = await supabase
          .from('quantguide_questions')
          .insert({
            name: problem.name,
            link: problem.link,
            url_ending: urlEnding,
            difficulty: problem.difficulty,
            tag: problem.tags?.[0] || null, // Use first tag as primary tag
            scraped_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`❌ Error inserting ${problem.name}:`, insertError.message);
          errors++;
        } else {
          questionsNew++;
        }
      }

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`   Processed ${i + 1}/${problems.length} questions...`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${problem.name}:`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Upload complete!');
  console.log('='.repeat(60));
  console.log(`📊 New questions: ${questionsNew}`);
  console.log(`🔄 Updated questions: ${questionsUpdated}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Total processed: ${problems.length}`);
  console.log('='.repeat(60));
  
  // Show some stats
  const { data: stats, error: statsError } = await supabase
    .from('quantguide_questions')
    .select('difficulty', { count: 'exact', head: true });

  if (!statsError && stats) {
    console.log(`\n📊 Total questions in database: ${stats.length || 0}`);
  }

  // Show difficulty breakdown
  const { data: difficultyStats } = await supabase
    .from('quantguide_questions')
    .select('difficulty')
    .then(result => {
      if (result.data) {
        const counts: Record<string, number> = {};
        result.data.forEach(row => {
          counts[row.difficulty] = (counts[row.difficulty] || 0) + 1;
        });
        return { data: counts };
      }
      return { data: null };
    });

  if (difficultyStats) {
    console.log('\n📊 Difficulty breakdown:');
    Object.entries(difficultyStats).forEach(([diff, count]) => {
      console.log(`   ${diff}: ${count}`);
    });
  }

  // Show tag breakdown
  const { data: tagStats } = await supabase
    .from('quantguide_questions')
    .select('tag')
    .then(result => {
      if (result.data) {
        const counts: Record<string, number> = {};
        result.data.forEach(row => {
          if (row.tag) {
            counts[row.tag] = (counts[row.tag] || 0) + 1;
          }
        });
        return { data: counts };
      }
      return { data: null };
    });

  if (tagStats) {
    console.log('\n📊 Tag breakdown:');
    Object.entries(tagStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count}`);
      });
  }
}

uploadToSupabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

