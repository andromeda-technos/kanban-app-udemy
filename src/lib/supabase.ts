import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Trim: a stray space/quote in .env.local ("KEY= value") must not crash the whole app
const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, '') || undefined;
const url = clean(import.meta.env.VITE_SUPABASE_URL);
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

const createSupabase = (): SupabaseClient | null => {
  if (!url || !anonKey || url.includes('xxxxxxxx')) return null;
  try {
    return createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (e) {
    console.error('Konfigurasi Supabase tidak valid, aplikasi berjalan di mode lokal.', e);
    return null;
  }
};

export const supabase: SupabaseClient | null = createSupabase();

/**
 * True when `.env.local` has valid Supabase keys. Without them the app keeps working
 * in local-only mode (data in this browser), which is handy during development.
 */
export const isSupabaseConfigured = supabase !== null;

/** Google scopes requested at sign-in. `drive.file` = only files this app creates or the user picks. */
export const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
