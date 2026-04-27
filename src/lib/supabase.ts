import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccsvsphewdxwqnbwcyub.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XWHi8VmPdHXaJweXsrzrqQ_WOd7QGMM';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Auth will run in mock mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
