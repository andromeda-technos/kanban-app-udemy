/**
 * Google Identity Services (access tokens for the Drive API) + Google Picker.
 * Scripts are loaded on demand; nothing Google-related loads until Drive is used.
 */
import { getStoredGoogleToken } from '../context/AuthContext';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY?.trim();
const GOOGLE_APP_ID = import.meta.env.VITE_GOOGLE_APP_ID?.trim();
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && GOOGLE_APP_ID);

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    document.head.appendChild(s);
  });

let gisReady: Promise<void> | null = null;
const loadGis = () => (gisReady ??= loadScript('https://accounts.google.com/gsi/client'));

let pickerReady: Promise<void> | null = null;
const loadPicker = () =>
  (pickerReady ??= loadScript('https://apis.google.com/js/api.js').then(
    () => new Promise<void>((resolve) => window.gapi.load('picker', { callback: resolve }))
  ));

/** Warm up the scripts (call early so the first click doesn't wait). */
export const preloadGoogle = () => {
  if (!isGoogleConfigured) return;
  loadGis()
    .then(ensureTokenClient)
    .catch(() => {});
  loadPicker().catch(() => {});
};

// ---------- access token ----------
/**
 * Browsers only allow Google's permission popup right after a click. Uploads used to ask for
 * the token after the file chooser / drag & drop, which is too late → "Failed to open popup
 * window". Now:
 *  - tokens are kept for the tab (sessionStorage) so reloads don't ask again,
 *  - the popup is only opened synchronously from a click (`authorizeDrive`),
 *  - outside a click, `getDriveToken` throws `DriveAuthNeeded` and the UI shows an
 *    "Izinkan Google Drive" button that calls `authorizeDrive` and then continues.
 */
const TOKEN_KEY = 'kanban_drive_token_v1';

export class DriveAuthNeeded extends Error {
  constructor() {
    super('Izin Google Drive perlu diperbarui');
  }
}

let cached: { token: string; expiresAt: number } | null = (() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return saved && saved.expiresAt > Date.now() ? saved : null;
  } catch {
    return null;
  }
})();

const remember = (token: string, expiresInSec: number) => {
  cached = { token, expiresAt: Date.now() + (expiresInSec - 120) * 1000 };
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(cached));
  } catch {
    /* ignore */
  }
};

/** A valid token if we already have one (no popup). */
export const peekDriveToken = (): string | null => {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  return getStoredGoogleToken();
};

type Waiter = { resolve: (t: string) => void; reject: (e: Error) => void };
let waiters: Waiter[] = [];
let tokenClient: any = null;

function ensureTokenClient() {
  if (tokenClient || !GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (res: any) => {
      const list = waiters;
      waiters = [];
      if (res.error || !res.access_token) {
        const err = new Error(res.error_description || res.error || 'Izin Google Drive ditolak');
        list.forEach((w) => w.reject(err));
        return;
      }
      remember(res.access_token, Number(res.expires_in) || 3600);
      list.forEach((w) => w.resolve(res.access_token));
    },
    error_callback: (err: any) => {
      const list = waiters;
      waiters = [];
      const message =
        err?.type === 'popup_failed_to_open'
          ? 'Popup Google diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.'
          : err?.type === 'popup_closed'
          ? 'Jendela izin Google ditutup sebelum selesai.'
          : err?.message || 'Izin Google Drive gagal';
      list.forEach((w) => w.reject(new Error(message)));
    },
  });
  return tokenClient;
}

/**
 * Opens Google's permission popup. MUST be called synchronously inside a click/tap handler
 * (no `await` before it), otherwise the browser blocks the popup.
 */
export const authorizeDrive = (loginHint?: string): Promise<string> => {
  const existing = peekDriveToken();
  if (existing) return Promise.resolve(existing);
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID belum diisi di .env.local'));
  const client = ensureTokenClient();
  if (!client) {
    loadGis().then(ensureTokenClient).catch(() => {});
    return Promise.reject(new Error('Layanan Google masih dimuat. Klik sekali lagi.'));
  }
  return new Promise((resolve, reject) => {
    waiters.push({ resolve, reject });
    client.requestAccessToken({ prompt: '', login_hint: loginHint });
  });
};

/** True while the page is still inside the short "just clicked" window that allows popups. */
const inUserGesture = () => {
  const ua = (navigator as any).userActivation;
  return ua ? Boolean(ua.isActive) : false;
};

/**
 * Returns a Drive access token. Uses a cached one or the token from the Google sign-in;
 * inside a click it may open the permission popup, otherwise it throws `DriveAuthNeeded`.
 */
export const getDriveToken = async (loginHint?: string): Promise<string> => {
  const existing = peekDriveToken();
  if (existing) return existing;
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID belum diisi di .env.local');
  if (inUserGesture() && ensureTokenClient()) return authorizeDrive(loginHint);
  throw new DriveAuthNeeded();
};

/** Forget the cached token (after a 401). */
export const clearDriveToken = () => {
  cached = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('kanban_google_access_token');
  } catch {
    /* ignore */
  }
};

// ---------- picker ----------
export interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  sizeBytes?: number;
}

interface PickerOptions {
  token: string;
  mode: 'folders' | 'files';
  title: string;
  parentId?: string;
  multiselect?: boolean;
}

export const openPicker = async ({ token, mode, title, parentId, multiselect }: PickerOptions) => {
  if (!isGoogleConfigured) throw new Error('Konfigurasi Google (Client ID / API key / App ID) belum lengkap');
  await loadPicker();
  const { picker } = window.google;

  const view =
    mode === 'folders'
      ? new picker.DocsView(picker.ViewId.FOLDERS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder')
      : new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
  if (parentId) view.setParent(parentId);

  return new Promise<PickedDoc[]>((resolve) => {
    const builder = new picker.PickerBuilder()
      .addView(view)
      .setTitle(title)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_APP_ID)
      .setLocale('id')
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d: any) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              url: d.url,
              sizeBytes: d.sizeBytes ? Number(d.sizeBytes) : undefined,
            }))
          );
        } else if (data.action === picker.Action.CANCEL) {
          resolve([]);
        }
      });
    if (multiselect) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
};
