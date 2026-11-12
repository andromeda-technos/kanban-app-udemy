import React, { useState } from 'react';
import { useKanban } from '../context/KanbanContext';
import { CloudUpload, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';

/**
 * Blocking states of the cloud sync:
 * - first download of the team data
 * - empty workspace: upload this browser's data or start fresh
 * - first download failed
 */
export const SyncOverlay: React.FC = () => {
  const { sync, boards, tasks } = useKanban();
  const [busy, setBusy] = useState(false);

  const firstLoadFailed = sync.status === 'error' && sync.error?.startsWith('Muat data');
  if (sync.status !== 'loading' && sync.status !== 'needs-migration' && !firstLoadFailed) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {sync.status === 'loading' && (
          <div className="text-center py-4">
            <LoaderCircle className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Memuat data tim...</p>
          </div>
        )}

        {firstLoadFailed && (
          <div className="text-center">
            <TriangleAlert className="w-9 h-9 mx-auto text-rose-500" />
            <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">Gagal memuat data dari Supabase</p>
            <p className="mt-1 text-xs text-slate-500 break-words">{sync.error}</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Pastikan skema <code>supabase/schema.sql</code> sudah dijalankan.
            </p>
            <button
              type="button"
              onClick={sync.retry}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Coba lagi
            </button>
          </div>
        )}

        {sync.status === 'needs-migration' && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Workspace tim masih kosong</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ini pertama kalinya data disimpan ke cloud. Mau mulai dari mana?
            </p>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await sync.uploadLocalData();
                  setBusy(false);
                }}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-left hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle className="w-5 h-5 mt-0.5 shrink-0 text-blue-600 animate-spin" />
                ) : (
                  <CloudUpload className="w-5 h-5 mt-0.5 shrink-0 text-blue-600" />
                )}
                <span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                    Unggah data dari browser ini
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {boards.length} board dan {tasks.length} tugas yang ada sekarang dipindahkan ke cloud, termasuk media
                    sampul yang diunggah.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm('Mulai dengan board kosong? Data di browser ini tidak akan diunggah.')) sync.startFresh();
                }}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                <Sparkles className="w-5 h-5 mt-0.5 shrink-0 text-violet-500" />
                <span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Mulai dari kosong</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Satu board baru dengan kolom To Do, In Progress, Review, Done.
                  </span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
