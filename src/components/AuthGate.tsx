import React from 'react';
import { useAuth } from '../context/AuthContext';
import { configProblems } from '../lib/supabase';
import { GeometricBackground } from './GeometricBackground';
import { PixelNightBackground } from './PixelNightBackground';
import { PREF_KEYS, usePreference } from '../hooks/usePreference';
import { BrandLogo, useBranding } from '../context/BrandingContext';
import { LoaderCircle, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';

const isDark = () => document.documentElement.classList.contains('dark');

/** Centered card over the animated background, shared by the auth screens. */
const ScreenBackground: React.FC = () => {
  const [pixelBg] = usePreference(PREF_KEYS.PIXEL_BG, true);
  const theme = isDark() ? 'dark' : 'light';
  return pixelBg ? <PixelNightBackground theme={theme} /> : <GeometricBackground theme={theme} />;
};

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative isolate min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
    <ScreenBackground />
    <div className="relative z-10 w-full max-w-sm p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
      {children}
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

/**
 * Cloud mode: requires a Google sign-in and an email on the team allowlist.
 * Local mode (no Supabase keys): renders the app directly.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    cloudEnabled,
    loading,
    session,
    user,
    membership,
    authError,
    signInWithGoogle,
    signOut,
    recheckMembership,
  } = useAuth();
  const { branding } = useBranding();

  // Online build without keys: say so instead of silently running in local demo mode
  if (!cloudEnabled && import.meta.env.PROD) {
    const problems = configProblems();
    return (
      <Screen>
        <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
        <h1 className="mt-3 text-lg font-bold">Konfigurasi belum lengkap</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Environment variable website ini kosong atau isinya belum benar, jadi belum bisa terhubung ke database tim.
        </p>
        {problems.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-left">
            {problems.map((p) => (
              <li
                key={p.name + p.problem}
                className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
              >
                <span className="block text-xs font-mono font-bold">{p.name}</span>
                <span className="block text-[11px]">{p.problem}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-slate-400">
          Admin: isi variabel di Vercel → Settings → Environment Variables, lalu Redeploy.
        </p>
      </Screen>
    );
  }

  if (!cloudEnabled) return <>{children}</>;

  if (loading || (session && membership === 'checking')) {
    return (
      <Screen>
        <LoaderCircle className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
        <p className="mt-3 text-sm text-slate-500">Memeriksa akun...</p>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <BrandLogo spec={branding.logo} size="lg" className="mx-auto" />
        <h1 className="mt-4 text-xl font-black tracking-tight">{branding.appName}</h1>
        {branding.tagline && <p className="text-xs text-slate-400">{branding.tagline}</p>}
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Masuk dengan akun Google yang sudah didaftarkan ke tim.
        </p>
        {authError && (
          <div className="mt-4 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-left text-xs text-rose-700 dark:text-rose-300">
            {authError}
          </div>
        )}
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold shadow-sm transition-colors"
        >
          <GoogleIcon />
          Masuk dengan Google
        </button>
        <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          Aplikasi meminta akses Google Drive terbatas: hanya file yang dibuat atau dipilih lewat aplikasi ini.
        </p>
      </Screen>
    );
  }

  if (membership !== 'member') {
    return (
      <Screen>
        <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
        <h1 className="mt-3 text-lg font-bold">
          {membership === 'error' ? 'Gagal memeriksa akses' : 'Belum terdaftar di tim'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {membership === 'error' ? (
            'Periksa koneksi atau konfigurasi Supabase, lalu coba lagi.'
          ) : (
            <>
              Akun <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.email}</span> belum
              ditambahkan. Minta owner tim menambahkan email ini di Global Settings → Tim.
            </>
          )}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={recheckMembership}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Cek lagi
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Ganti akun
          </button>
        </div>
      </Screen>
    );
  }

  return <>{children}</>;
};
