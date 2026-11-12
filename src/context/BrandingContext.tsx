import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Kanban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { setBaseTitle } from '../utils/docTitle';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
export type LogoSpec =
  | { kind: 'default' }
  | { kind: 'emoji'; emoji: string; bg: string }
  /** `src` = 256px logo, `icon` = 64px PNG for the browser tab (both data URLs) */
  | { kind: 'image'; src: string; icon: string };

export interface Branding {
  appName: string;
  tagline: string;
  /** Empty = use the app name */
  tabTitle: string;
  logo: LogoSpec;
  /** null = same as the logo */
  favicon: LogoSpec | null;
}

export const DEFAULT_BRANDING: Branding = {
  appName: 'KanbanFlow',
  tagline: '',
  tabTitle: '',
  logo: { kind: 'default' },
  favicon: null,
};

const CACHE_KEY = 'kanban_branding_v1';
const SETTINGS_KEY = 'branding';

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2'/%3E%3Cpath d='M8 7v7'/%3E%3Cpath d='M12 7v4'/%3E%3Cpath d='M16 7v9'/%3E%3C/svg%3E";

export const faviconHref = (spec: LogoSpec): string => {
  if (spec.kind === 'image') return spec.icon;
  if (spec.kind === 'emoji') {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${spec.bg}'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='40'>${spec.emoji}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  return DEFAULT_FAVICON;
};

const sanitize = (raw: Partial<Branding> | null | undefined): Branding => ({
  ...DEFAULT_BRANDING,
  ...(raw ?? {}),
  logo: raw?.logo ?? DEFAULT_BRANDING.logo,
  favicon: raw?.favicon ?? null,
});

const readCache = (): Branding => {
  try {
    return sanitize(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
  } catch {
    return DEFAULT_BRANDING;
  }
};

const writeCache = (b: Branding) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    /* quota / private mode */
  }
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface BrandingContextValue {
  branding: Branding;
  /** Owner only in cloud mode; everyone in local mode */
  canEdit: boolean;
  saveBranding: (b: Branding) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cloudEnabled, membership, role } = useAuth();
  // Cached copy first, so the login screen and first paint already show the team's brand
  const [branding, setBranding] = useState<Branding>(readCache);
  const isMember = cloudEnabled && membership === 'member';

  // Load + live updates from app_settings (shared by the whole team)
  useEffect(() => {
    if (!isMember || !supabase) return;
    let alive = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const b = sanitize(data.value as Partial<Branding>);
        setBranding(b);
        writeCache(b);
      });
    const channel = supabase
      .channel('branding-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${SETTINGS_KEY}` },
        (p) => {
          const row = p.new as { value?: Partial<Branding> } | null;
          if (!row?.value) return;
          const b = sanitize(row.value);
          setBranding(b);
          writeCache(b);
        }
      )
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [isMember]);

  // Tab title + favicon
  useEffect(() => {
    setBaseTitle(branding.tabTitle.trim() || branding.appName.trim() || DEFAULT_BRANDING.appName);
    const href = faviconHref(branding.favicon ?? branding.logo);
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = href.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
    link.href = href;
  }, [branding]);

  const saveBranding = useCallback(
    async (next: Branding) => {
      const clean = sanitize({ ...next, appName: next.appName.trim() || DEFAULT_BRANDING.appName });
      if (isMember && supabase) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key: SETTINGS_KEY, value: clean, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      }
      setBranding(clean);
      writeCache(clean);
    },
    [isMember]
  );

  return (
    <BrandingContext.Provider value={{ branding, canEdit: !cloudEnabled || role === 'owner', saveBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// Logo rendering
// ---------------------------------------------------------------------------
const SIZES = {
  sm: { box: 'w-9 h-9 rounded-xl', icon: 'w-5 h-5', emoji: 'text-xl' },
  lg: { box: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7', emoji: 'text-3xl' },
} as const;

export const BrandLogo: React.FC<{ spec: LogoSpec; size?: keyof typeof SIZES; className?: string }> = ({
  spec,
  size = 'sm',
  className = '',
}) => {
  const s = SIZES[size];
  if (spec.kind === 'image') {
    return <img src={spec.src} alt="" className={`${s.box} shrink-0 object-contain ${className}`} draggable={false} />;
  }
  if (spec.kind === 'emoji') {
    return (
      <div
        className={`${s.box} shrink-0 flex items-center justify-center shadow-md ${className}`}
        style={{ backgroundColor: spec.bg }}
      >
        <span className={`${s.emoji} leading-none`}>{spec.emoji}</span>
      </div>
    );
  }
  return (
    <div
      className={`${s.box} shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ${className}`}
    >
      <Kanban className={s.icon} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Image upload → small square data URLs
// ---------------------------------------------------------------------------
const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak bisa dibaca.'));
    };
    img.src = url;
  });

const toSquare = (img: HTMLImageElement, size: number, type: string, quality?: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  const scale = Math.min(size / w, size / h); // contain, transparent padding
  const dw = w * scale;
  const dh = h * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return canvas.toDataURL(type, quality);
};

export const MAX_LOGO_FILE = 3 * 1024 * 1024;

/** Turns an uploaded file into a logo spec (256px WebP + 64px PNG favicon). */
export const imageFileToLogo = async (file: File): Promise<LogoSpec> => {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar (PNG, JPG, SVG, WebP, GIF).');
  if (file.size > MAX_LOGO_FILE) throw new Error('Ukuran gambar maksimal 3 MB.');
  const img = await loadImage(file);
  return { kind: 'image', src: toSquare(img, 256, 'image/webp', 0.9), icon: toSquare(img, 64, 'image/png') };
};
