import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/lib/config';

export const hasSupabaseConfig =
  CONFIG.supabaseUrl.trim().length > 0 && CONFIG.supabaseAnonKey.trim().length > 0;

export const supabase = hasSupabaseConfig
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
