/**
 * Create all views in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createViews() {
  console.log('📊 Creating views in Supabase...\n');

  try {
    // Read the SQL file
    const sql = await readFile('supabase/create-views.sql', 'utf-8');
    
    console.log('✅ SQL file loaded');
    console.log('\n⚠️  NOTE: You need to run this SQL manually in Supabase SQL Editor');
    console.log('   The anon key doesn\'t have permission to create views\n');
    console.log('📋 Copy the SQL from: supabase/create-views.sql');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/bkthowihlelaqknolsdz/sql\n');
    
    // Show what views will be created
    const viewMatches = sql.match(/CREATE OR REPLACE VIEW (\w+)/g);
    if (viewMatches) {
      console.log(`📊 This will create ${viewMatches.length} views:\n`);
      
      console.log('Difficulty Views:');
      viewMatches
        .filter(m => m.includes('difficulty'))
        .forEach(m => {
          const name = m.replace('CREATE OR REPLACE VIEW ', '');
          console.log(`  - ${name}`);
        });
      
      console.log('\nTag Views:');
      viewMatches
        .filter(m => m.includes('tag_') && !m.includes('stats'))
        .forEach(m => {
          const name = m.replace('CREATE OR REPLACE VIEW ', '');
          console.log(`  - ${name}`);
        });
      
      console.log('\nCombined Views:');
      viewMatches
        .filter(m => m.includes('easy_') || m.includes('medium_') || m.includes('hard_'))
        .forEach(m => {
          const name = m.replace('CREATE OR REPLACE VIEW ', '');
          console.log(`  - ${name}`);
        });
      
      console.log('\nStats Views:');
      viewMatches
        .filter(m => m.includes('stats'))
        .forEach(m => {
          const name = m.replace('CREATE OR REPLACE VIEW ', '');
          console.log(`  - ${name}`);
        });
    }
    
    // Try to get current stats
    console.log('\n📊 Current Database Stats:\n');
    
    const { data: difficulties } = await supabase
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
    
    if (difficulties) {
      console.log('Difficulty Breakdown:');
      Object.entries(difficulties).forEach(([diff, count]) => {
        console.log(`  ${diff}: ${count}`);
      });
    }
    
    const { data: tags } = await supabase
      .from('quantguide_questions')
      .select('tags')
      .then(result => {
        if (result.data) {
          const tagCounts: Record<string, number> = {};
          result.data.forEach(row => {
            if (row.tags) {
              row.tags.forEach((tag: string) => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
              });
            }
          });
          return { data: tagCounts };
        }
        return { data: null };
      });
    
    if (tags) {
      console.log('\nTag Breakdown:');
      Object.entries(tags)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tag, count]) => {
          console.log(`  ${tag}: ${count}`);
        });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createViews();







