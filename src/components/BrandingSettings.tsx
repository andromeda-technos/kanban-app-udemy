import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, Lock, RotateCcw, Smile, Sparkles, X } from 'lucide-react';
import {
  Branding,
  BrandLogo,
  DEFAULT_BRANDING,
  LogoSpec,
  faviconHref,
  imageFileToLogo,
  useBranding,
} from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';

const EMOJI_PRESETS = ['🚀', '📋', '✅', '🧩', '🔥', '⚡', '🎯', '🦊', '🐙', '🍅', '🌙', '💼'];
const BG_PRESETS = ['#2563eb', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#d97706', '#16a34a', '#0891b2', '#0f172a', '#f1f5f9'];

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
const labelCls = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5';

/** Logo source picker: default / emoji / uploaded image. */
const LogoPicker: React.FC<{
  value: LogoSpec;
  onChange: (spec: LogoSpec) => void;
  disabled?: boolean;
  allowDefault?: boolean;
}> = ({ value, onChange, disabled, allowDefault = true }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emoji = value.kind === 'emoji' ? value : { kind: 'emoji' as const, emoji: '🚀', bg: BG_PRESETS[0] };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await imageFileToLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses gambar.');
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    ...(allowDefault ? [{ kind: 'default' as const, label: 'Bawaan', icon: Sparkles }] : []),
    { kind: 'emoji' as const, label: 'Emoji', icon: Smile },
    { kind: 'image' as const, label: 'Gambar', icon: ImagePlus },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {modes.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (kind === 'default') onChange({ kind: 'default' });
              else if (kind === 'emoji') onChange(emoji);
              else if (value.kind !== 'image') fileRef.current?.click();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${
              value.kind === kind
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {value.kind === 'emoji' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              value={value.emoji}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, emoji: [...e.target.value].slice(-2).join('') || '🚀' })}
              className={`${inputCls} w-20 text-center text-lg`}
              aria-label="Emoji logo"
            />
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, emoji: em })}
                  className={`w-8 h-8 rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    value.emoji === em ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Latar</span>
            {BG_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, bg: c })}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border border-slate-300/60 dark:border-slate-600 flex items-center justify-center ${
                  value.bg === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900' : ''
                }`}
                title={c}
              >
                {value.bg === c && <Check className={`w-3 h-3 ${c === '#f1f5f9' ? 'text-slate-700' : 'text-white'}`} />}
              </button>
            ))}
            <input
              type="color"
              disabled={disabled}
              value={value.bg}
              onChange={(e) => onChange({ ...value, bg: e.target.value })}
              className="w-7 h-7 rounded-md border-0 bg-transparent cursor-pointer"
              title="Warna lain"
            />
          </div>
        </div>
      )}

      {value.kind === 'image' && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
          <img src={value.src} alt="" className="w-12 h-12 rounded-lg object-contain bg-white dark:bg-slate-900" />
          <div className="flex-1 min-w-0 text-[11px] text-slate-500 dark:text-slate-400">
            Gambar diperkecil otomatis jadi 256px. Paling bagus pakai gambar persegi dengan latar transparan.
          </div>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-60"
          >
            Ganti
          </button>
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Memproses gambar...
        </p>
      )}
      {error && <p className="text-[11px] text-rose-500">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};

/** Global Settings → Tampilan: app name, tagline, logo, tab title and favicon. */
export const BrandingSettings: React.FC = () => {
  const { branding, canEdit, saveBranding } = useBranding();
  const { cloudEnabled } = useAuth();
  const [draft, setDraft] = useState<Branding>(branding);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Someone else saved meanwhile → show their version
  useEffect(() => setDraft(branding), [branding]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(branding);
  const set = (patch: Partial<Branding>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus(null);
  };

  const save = async (value: Branding) => {
    setSaving(true);
    setStatus(null);
    try {
      await saveBranding(value);
      setStatus({ ok: true, text: cloudEnabled ? 'Tersimpan untuk seluruh tim.' : 'Tersimpan.' });
    } catch (e) {
      setStatus({ ok: false, text: `Gagal menyimpan: ${e instanceof Error ? e.message : 'coba lagi'}` });
    } finally {
      setSaving(false);
    }
  };

  const tabTitle = draft.tabTitle.trim() || draft.appName.trim() || DEFAULT_BRANDING.appName;
  const favicon = draft.favicon ?? draft.logo;
  const disabled = !canEdit || saving;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tampilan & Identitas</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Nama, deskripsi, logo, dan ikon tab browser.
          {cloudEnabled ? ' Berlaku untuk seluruh anggota tim.' : ''}
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          Hanya owner tim yang bisa mengubah tampilan ini.
        </div>
      )}

      {/* Preview */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-end gap-1 px-2 pt-2 bg-slate-200/70 dark:bg-slate-800">
          <div className="flex items-center gap-2 max-w-[240px] px-3 py-1.5 rounded-t-lg bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200">
            <img src={faviconHref(favicon)} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
            <span className="truncate">{tabTitle}</span>
            <X className="w-3 h-3 shrink-0 text-slate-400" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <BrandLogo spec={draft.logo} />
          <div className="min-w-0">
            <p className="font-black text-lg leading-tight truncate bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              {draft.appName.trim() || DEFAULT_BRANDING.appName}
            </p>
            {draft.tagline.trim() && (
              <p className="text-[11px] text-slate-400 truncate">{draft.tagline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Texts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nama aplikasi (header)</label>
          <input
            value={draft.appName}
            maxLength={32}
            disabled={disabled}
            onChange={(e) => set({ appName: e.target.value })}
            placeholder={DEFAULT_BRANDING.appName}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Judul tab browser</label>
          <input
            value={draft.tabTitle}
            maxLength={60}
            disabled={disabled}
            onChange={(e) => set({ tabTitle: e.target.value })}
            placeholder={`Kosong = ${draft.appName.trim() || DEFAULT_BRANDING.appName}`}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Deskripsi singkat (di bawah nama)</label>
          <input
            value={draft.tagline}
            maxLength={60}
            disabled={disabled}
            onChange={(e) => set({ tagline: e.target.value })}
            placeholder="Contoh: Workspace tim Andromeda"
            className={inputCls}
          />
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className={labelCls}>Logo</label>
        <LogoPicker value={draft.logo} onChange={(logo) => set({ logo })} disabled={disabled} />
      </div>

      {/* Favicon */}
      <div>
        <label className={labelCls}>Ikon tab browser (favicon)</label>
        <label className="flex items-center gap-2 mb-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={draft.favicon === null}
            onChange={(e) =>
              set({ favicon: e.target.checked ? null : draft.logo.kind === 'default' ? { kind: 'emoji', emoji: '🚀', bg: BG_PRESETS[0] } : draft.logo })
            }
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          Samakan dengan logo
        </label>
        {draft.favicon !== null && (
          <LogoPicker value={draft.favicon} onChange={(favicon) => set({ favicon })} disabled={disabled} />
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {status && (
            <span className={`mr-auto text-xs ${status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {status.text}
            </span>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (confirm('Kembalikan nama, logo, dan ikon tab ke bawaan?')) save(DEFAULT_BRANDING);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke bawaan
          </button>
          {dirty && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setDraft(branding)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => save(draft)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      )}
    </div>
  );
};
