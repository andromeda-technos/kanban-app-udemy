import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { GOOGLE_SCOPES, isSupabaseConfigured, supabase } from '../lib/supabase';

export type Membership = 'checking' | 'member' | 'not-member' | 'error';

interface AuthContextType {
  /** false = local-only mode (no Supabase keys in .env.local) */
  cloudEnabled: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  membership: Membership;
  role: 'owner' | 'member' | null;
  /** Error returned by Supabase/Google in the redirect URL (e.g. expired OAuth state) */
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  recheckMembership: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_TOKEN_KEY = 'kanban_google_access_token';

/**
 * Google access token returned at sign-in (used later for the Drive API).
 * Supabase only hands it over right after the OAuth redirect, so keep it for the tab session.
 */
const rememberGoogleToken = (session: Session | null) => {
  if (!session?.provider_token) return;
  try {
    sessionStorage.setItem(
      GOOGLE_TOKEN_KEY,
      JSON.stringify({ token: session.provider_token, expiresAt: Date.now() + 55 * 60_000 })
    );
  } catch {
    /* storage blocked */
  }
};

export const getStoredGoogleToken = (): string | null => {
  try {
    const raw = sessionStorage.getItem(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    return Date.now() < expiresAt ? token : null;
  } catch {
    return null;
  }
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  bad_oauth_state: 'Sesi login kedaluwarsa. Silakan klik "Masuk dengan Google" lagi.',
  access_denied: 'Akses ditolak oleh Google. Pastikan akun ini diizinkan (Test user / aplikasi sudah dipublikasikan).',
};

/** Reads `?error=...` / `#error=...` left by a failed OAuth redirect, then cleans the URL. */
const readAuthErrorFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('error_code') || hash.get('error_code') || params.get('error') || hash.get('error');
  if (!code) return null;
  const description = params.get('error_description') || hash.get('error_description') || code;
  window.history.replaceState(null, '', window.location.pathname);
  return AUTH_ERROR_MESSAGES[code] ?? description.replace(/\+/g, ' ');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authError] = useState(readAuthErrorFromUrl);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership>('checking');
  const [role, setRole] = useState<'owner' | 'member' | null>(null);
  const [checkNonce, setCheckNonce] = useState(0);

  // Session lifecycle
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      rememberGoogleToken(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      rememberGoogleToken(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Is this Google account on the team allowlist?
  const email = session?.user.email?.toLowerCase() ?? null;
  useEffect(() => {
    if (!supabase || !email) {
      setMembership('checking');
      setRole(null);
      return;
    }
    let alive = true;
    setMembership('checking');
    supabase
      .from('members')
      .select('role')
      .ilike('email', email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error('Gagal cek keanggotaan', error);
          setMembership('error');
        } else if (data) {
          setMembership('member');
          setRole(data.role);
        } else {
          setMembership('not-member');
          setRole(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [email, checkNonce]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: GOOGLE_SCOPES,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) alert(`Gagal login: ${error.message}`);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        cloudEnabled: isSupabaseConfigured,
        loading,
        session,
        user: session?.user ?? null,
        membership,
        role,
        authError,
        signInWithGoogle,
        signOut,
        recheckMembership: () => setCheckNonce((n) => n + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
