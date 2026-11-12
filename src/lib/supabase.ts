import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Trim: a stray space/quote in .env.local ("KEY= value") must not crash the whole app
const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, '') || undefined;
// "abc.supabase.co" (no scheme) or a trailing slash still works
const withScheme = (v?: string) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v)?.replace(/\/+$/, '');
const url = withScheme(clean(import.meta.env.VITE_SUPABASE_URL));
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

export interface ConfigProblem {
  name: string;
  problem: string;
}

const looksLikePlaceholder = (v: string) => /x{8,}|example.com|^your[-_ ]|^<.*>$/i.test(v);

/**
 * Every required env variable that is empty or obviously wrong, with a short reason.
 * Values themselves are never shown (only what is wrong with them).
 */
export const configProblems = (): ConfigProblem[] => {
  const env = import.meta.env as Record<string, string | undefined>;
  const out: ConfigProblem[] = [];
  const check = (name: string, valid: (v: string) => boolean, hint: string) => {
    const v = clean(env[name]);
    if (!v) out.push({ name, problem: 'kosong / belum masuk ke build' });
    else if (looksLikePlaceholder(v)) out.push({ name, problem: 'masih berisi nilai contoh (dari .env.example)' });
    else if (!valid(v)) out.push({ name, problem: hint });
  };
  check(
    'VITE_SUPABASE_URL',
    (v) => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(withScheme(v) ?? ''),
    'harus berbentuk https://<id-project>.supabase.co'
  );
  check(
    'VITE_SUPABASE_ANON_KEY',
    (v) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v) || /^sb_publishable_/.test(v),
    'bukan anon / publishable key (biasanya diawali "eyJ" atau "sb_publishable_")'
  );
  check('VITE_GOOGLE_CLIENT_ID', (v) => v.endsWith('.apps.googleusercontent.com'), 'harus diakhiri .apps.googleusercontent.com');
  check('VITE_GOOGLE_API_KEY', (v) => /^AIza[\w-]{30,}$/.test(v), 'API key Google biasanya diawali "AIza"');
  check('VITE_GOOGLE_APP_ID', (v) => /^\d{6,}$/.test(v), 'harus berupa Project number (angka saja)');
  if (!out.some((p) => p.name.startsWith('VITE_SUPABASE')) && !supabase) {
    out.push({ name: 'VITE_SUPABASE_URL', problem: 'ditolak oleh Supabase client (format URL tidak valid)' });
  }
  return out;
};

/** Names of required env variables that are empty (kept for compatibility). */
export const missingEnvVars = (): string[] => configProblems().map((p) => p.name);
