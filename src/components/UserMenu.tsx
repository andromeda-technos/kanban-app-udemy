import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useKanban } from '../context/KanbanContext';
import { Cloud, CloudOff, LoaderCircle, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';

/** Sync status dot + Google account menu (cloud mode only). */
export const UserMenu: React.FC = () => {
  const { cloudEnabled, user, role, signOut } = useAuth();
  const { sync } = useKanban();
  const [open, setOpen] = useState(false);

  if (!cloudEnabled || !user) return null;

  const meta = user.user_metadata ?? {};
  const name: string = meta.full_name || meta.name || user.email || 'Akun';
  const avatar: string | undefined = meta.avatar_url || meta.picture;

  const status = {
    synced: { icon: Cloud, label: 'Tersimpan di cloud', className: 'text-emerald-500' },
    saving: { icon: LoaderCircle, label: 'Menyimpan...', className: 'text-blue-500 animate-spin' },
    loading: { icon: LoaderCircle, label: 'Memuat...', className: 'text-blue-500 animate-spin' },
    'needs-migration': { icon: CloudOff, label: 'Belum tersinkron', className: 'text-amber-500' },
    error: { icon: TriangleAlert, label: 'Gagal sinkron, mencoba lagi', className: 'text-rose-500' },
    local: { icon: CloudOff, label: 'Mode lokal', className: 'text-slate-400' },
  }[sync.status];
  const StatusIcon = status.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 p-1 pr-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title={`${name} · ${status.label}`}
      >
        {avatar ? (
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-lg object-cover" />
        ) : (
          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <StatusIcon className={`w-3.5 h-3.5 ${status.className}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 z-50 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs">
            <div className="px-2.5 py-2">
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{name}</p>
              <p className="text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                {role === 'owner' ? 'Owner' : 'Anggota'}
              </span>
            </div>
            <div className="mx-1 my-1 px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex items-start gap-2">
              <StatusIcon className={`w-3.5 h-3.5 mt-px shrink-0 ${status.className}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-700 dark:text-slate-200">{status.label}</p>
                {sync.error && <p className="text-[10px] text-rose-500 break-words mt-0.5">{sync.error}</p>}
              </div>
              {sync.status === 'error' && (
                <button
                  type="button"
                  onClick={sync.retry}
                  className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800"
                  title="Coba sinkron sekarang"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </>
      )}
    </div>
  );
};
