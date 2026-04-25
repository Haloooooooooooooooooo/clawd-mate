import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep warning non-fatal so app can still run in guest mode.
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

const safeUrl = supabaseUrl || 'http://127.0.0.1';
const safeAnonKey = supabaseAnonKey || 'public-anon-key';

export const supabase = createClient(safeUrl, safeAnonKey);
