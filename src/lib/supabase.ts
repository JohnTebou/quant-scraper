import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Problem {
  id?: string;
  name: string;
  link: string;
  url_ending: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unknown';
  description?: string;
  created_at?: string;
  updated_at?: string;
  scraped_at?: string;
}

export interface Tag {
  id?: string;
  name: string;
  created_at?: string;
}

export interface ProblemWithTags extends Problem {
  tags?: string[];
}

export interface ScrapeRun {
  id?: string;
  started_at?: string;
  completed_at?: string;
  questions_found?: number;
  questions_new?: number;
  questions_updated?: number;
  status: 'running' | 'completed' | 'failed';
  error_message?: string;
}







