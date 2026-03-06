import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env.local');
}



export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function testSupabaseConnection() {
  try {

    const { data, error } = await supabase
      .from('tasks')
      .select('id, status')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test FAILED:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === '42P01') {
        console.error('TABLE "tasks" DOES NOT EXIST!');
        console.error('Please run supabase-setup.sql in your Supabase SQL Editor');
        console.error('Instructions: See SUPABASE_SETUP_INSTRUCTIONS.md');
      } else if (error.code === '42703' || error.code === 'PGRST204') {
        console.error('COLUMN MISSING! Table exists but is OUTDATED!');
        console.error('Please run supabase-migration.sql in your Supabase SQL Editor');
        console.error('This will add the new columns (status, is_template, etc.)');
      }
      
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
}
