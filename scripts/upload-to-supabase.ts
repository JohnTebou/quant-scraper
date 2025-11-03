/**
 * Upload scraped problems to Supabase
 */

import { supabase } from '../src/lib/supabase';
import { readFile } from 'fs/promises';
import type { ScrapedProblem } from '../src/lib/scraper';

async function uploadToSupabase() {
  console.log('📤 Uploading problems to Supabase...\n');

  // Read scraped problems
  let problems: ScrapedProblem[];
  try {
    const data = await readFile('scraped-problems.json', 'utf-8');
    problems = JSON.parse(data);
    console.log(`✅ Loaded ${problems.length} problems from scraped-problems.json\n`);
  } catch (error) {
    console.error('❌ Error reading scraped-problems.json:', error);
    return;
  }

  // Start a scrape run
  const { data: scrapeRun, error: scrapeRunError } = await supabase
    .from('scrape_runs')
    .insert({
      started_at: new Date().toISOString(),
      status: 'running',
      questions_found: problems.length,
    })
    .select()
    .single();

  if (scrapeRunError) {
    console.error('❌ Error creating scrape run:', scrapeRunError);
    return;
  }

  console.log(`📊 Started scrape run: ${scrapeRun.id}\n`);

  let questionsNew = 0;
  let questionsUpdated = 0;
  let errors = 0;

  // Process each problem
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const urlEnding = problem.link.split('/').pop() || '';

    try {
      // Check if problem already exists
      const { data: existing } = await supabase
        .from('problems')
        .select('id')
        .eq('url_ending', urlEnding)
        .single();

      if (existing) {
        // Update existing problem
        const { error: updateError } = await supabase
          .from('problems')
          .update({
            name: problem.name,
            link: problem.link,
            difficulty: problem.difficulty,
            scraped_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Error updating ${problem.name}:`, updateError.message);
          errors++;
        } else {
          questionsUpdated++;
          
          // Update tags if they exist
          if (problem.tags && problem.tags.length > 0) {
            await updateProblemTags(existing.id, problem.tags);
          }
        }
      } else {
        // Insert new problem
        const { data: newProblem, error: insertError } = await supabase
          .from('problems')
          .insert({
            name: problem.name,
            link: problem.link,
            url_ending: urlEnding,
            difficulty: problem.difficulty,
            scraped_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error inserting ${problem.name}:`, insertError.message);
          errors++;
        } else {
          questionsNew++;
          
          // Add tags if they exist
          if (problem.tags && problem.tags.length > 0 && newProblem) {
            await updateProblemTags(newProblem.id, problem.tags);
          }
        }
      }

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`   Processed ${i + 1}/${problems.length} problems...`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${problem.name}:`, error);
      errors++;
    }
  }

  // Complete the scrape run
  const { error: completeError } = await supabase
    .from('scrape_runs')
    .update({
      completed_at: new Date().toISOString(),
      status: errors > 0 ? 'failed' : 'completed',
      questions_new: questionsNew,
      questions_updated: questionsUpdated,
      error_message: errors > 0 ? `${errors} errors occurred` : null,
    })
    .eq('id', scrapeRun.id);

  if (completeError) {
    console.error('❌ Error completing scrape run:', completeError);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Upload complete!');
  console.log('='.repeat(60));
  console.log(`📊 New questions: ${questionsNew}`);
  console.log(`🔄 Updated questions: ${questionsUpdated}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Total processed: ${problems.length}`);
  console.log('='.repeat(60));
}

async function updateProblemTags(problemId: string, tags: string[]) {
  // Get or create tags
  for (const tagName of tags) {
    try {
      // Get or create tag
      let { data: tag, error: tagError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .single();

      if (tagError && tagError.code === 'PGRST116') {
        // Tag doesn't exist, create it
        const { data: newTag, error: createError } = await supabase
          .from('tags')
          .insert({ name: tagName })
          .select()
          .single();

        if (createError) {
          console.error(`   ⚠️  Error creating tag ${tagName}:`, createError.message);
          continue;
        }
        tag = newTag;
      }

      if (tag) {
        // Link problem to tag (ignore if already exists)
        await supabase
          .from('problem_tags')
          .insert({
            problem_id: problemId,
            tag_id: tag.id,
          })
          .select()
          .single();
      }
    } catch (error) {
      // Ignore duplicate errors
    }
  }
}

uploadToSupabase();






