/**
 * Upload scraped question content to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface QuestionContent {
  name: string;
  link: string;
  url_ending: string;
  difficulty: string;
  tags: string[];
  questionText: string;
  questionHtml: string;
  hasLatex: boolean;
  scrapedAt: string;
}

async function uploadQuestions() {
  console.log('📤 Uploading question content to Supabase...\n');

  // Read scraped questions
  let questions: QuestionContent[];
  try {
    const data = await readFile('all-questions-content.json', 'utf-8');
    questions = JSON.parse(data);
    console.log(`✅ Loaded ${questions.length} questions from all-questions-content.json\n`);
  } catch (error) {
    console.error('❌ Error reading all-questions-content.json:', error);
    process.exit(1);
  }

  let updated = 0;
  let errors = 0;
  let skipped = 0;

  console.log('Processing questions...\n');

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    try {
      // Skip if question text is empty or error
      if (!question.questionText || question.questionText.includes('ERROR')) {
        skipped++;
        continue;
      }

      // Update question in database
      const { error: updateError } = await supabase
        .from('quantguide_questions')
        .update({
          question_text: question.questionText,
          question_html: question.questionHtml,
          has_latex: question.hasLatex,
          updated_at: new Date().toISOString(),
        })
        .eq('url_ending', question.url_ending);

      if (updateError) {
        console.error(`❌ Error updating ${question.name}:`, updateError.message);
        errors++;
      } else {
        updated++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`   Processed ${i + 1}/${questions.length} questions...`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${question.name}:`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Upload complete!');
  console.log('='.repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Total processed: ${questions.length}`);
  console.log('='.repeat(60));

  // Verify
  const { count } = await supabase
    .from('quantguide_questions')
    .select('*', { count: 'exact', head: true })
    .not('question_text', 'is', null);

  console.log(`\n📊 Questions with content in database: ${count}`);
}

uploadQuestions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});






