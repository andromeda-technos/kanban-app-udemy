import React, { useMemo, useRef, useState } from 'react';
import { DataFile, useFiles } from '../../context/FilesContext';
import { useKanban } from '../../context/KanbanContext';
import { useAuth } from '../../context/AuthContext';
import { DATA_CATEGORIES, categoryOf, formatBytes } from '../../utils/dataCenter';
import { normalizeUrl } from '../../utils/links';
import { FilePreview, TaskLinkChooser, fileIconFor } from './FileBits';
import {
  CloudUpload,
  Database,
  ExternalLink,
  Eye,
  FolderOpen,
  FolderPlus,
  FolderSync,
  HardDrive,
  Link2,
  LoaderCircle,
  Plus,
  Search,
  Share2,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Status / setup strip for the team Drive folder. */
const DriveBanner: React.FC = () => {
  const { enabled, folders, connection, setupFolders, connectFolders, shareWithTeam } = useFiles();
  const { role, cloudEnabled } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ kind: 'ok', text });
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const box = 'flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border text-xs';
  const btn =
    'shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60';

  if (!enabled) {
    return (
      <div className={`${box} border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300`}>
        <TriangleAlert className="w-4 h-4 shrink-0" />
        {cloudEnabled
          ? 'Kunci Google (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY, VITE_GOOGLE_APP_ID) belum lengkap di .env.local.'
          : 'Pusat Data membutuhkan mode cloud (login Google + Supabase).'}
      </div>
    );
  }

  const feedback = message && (
    <p className={`mt-2 text-xs ${message.kind === 'ok' ? 'text-emerald-600' : 'text-rose-500'}`}>{message.text}</p>
  );

  if (!folders) {
    return (
      <div>
        <div className={`${box} border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 text-slate-700 dark:text-slate-200`}>
          <FolderPlus className="w-5 h-5 shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="font-bold">Folder Google Drive tim belum ada</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {role === 'owner'
                ? 'Buat folder "Kanban App" + subfolder per kategori di Drive kamu, lalu bagikan ke tim.'
                : 'Minta owner tim membuka Pusat Data dan menyiapkan folder Drive.'}
            </p>
          </div>
          {role === 'owner' && (
            <button type="button" disabled={!!busy} onClick={() => run('setup', async () => {
              await setupFolders();
              return 'Folder tim berhasil dibuat di Google Drive kamu.';
            })} className={btn}>
              {busy === 'setup' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              Siapkan folder tim
            </button>
          )}
        </div>
        {feedback}
      </div>
    );
  }

  if (connection === 'needs-connect') {
    return (
      <div>
        <div className={`${box} border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-slate-700 dark:text-slate-200`}>
          <FolderSync className="w-5 h-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-bold">Hubungkan folder tim (sekali saja)</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Pilih folder <b>Kanban App</b> di jendela Google. Bila diminta lagi, masuk ke folder itu lalu pilih{' '}
              <b>semua folder kategori</b> sekaligus (Ctrl/Shift + klik). Pastikan owner sudah membagikan folder ke Gmail kamu.
            </p>
          </div>
          <button type="button" disabled={!!busy} onClick={() => run('connect', async () => {
            await connectFolders();
            return 'Folder tim terhubung. Sekarang kamu bisa mengunggah file.';
          })} className={btn}>
            {busy === 'connect' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FolderSync className="w-4 h-4" />}
            Hubungkan folder tim
          </button>
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <div>
      <div className={`${box} border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 text-slate-700 dark:text-slate-200`}>
        <HardDrive className="w-5 h-5 shrink-0 text-emerald-600" />
        <div className="flex-1">
          <p className="font-bold">Terhubung ke Google Drive tim</p>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            File diunggah ke folder <b>Kanban App</b> sesuai kategorinya.
            {role === 'owner' && folders.sharedWith.length > 0 && ` Dibagikan ke ${folders.sharedWith.length} anggota.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {folders.rootLink && (
            <a
              href={folders.rootLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              Buka folder
            </a>
          )}
          {role === 'owner' && (
            <button type="button" disabled={!!busy} onClick={() => run('share', async () => {
              const { added, failed } = await shareWithTeam();
              if (added.length === 0 && failed.length === 0) return 'Semua anggota tim sudah punya akses.';
              return [
                added.length && `Dibagikan ke: ${added.join(', ')}.`,
                failed.length && `Gagal: ${failed.join(', ')}.`,
              ].filter(Boolean).join(' ');
            })} className={btn}>
              {busy === 'share' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Bagikan ke tim
            </button>
          )}
        </div>
      </div>
      {feedback}
    </div>
  );
};

/** Upload / import / add-link panel. */
const AddPanel: React.FC<{ category: string; setCategory: (c: string) => void }> = ({ category, setCategory }) => {
  const { enabled, folders, connection, uploads, uploadFiles, importFromDrive, addLinkEntry } = useFiles();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState('');
  const ready = !!folders && connection === 'connected';

  const upload = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    setError('');
    try {
      await uploadFiles(Array.from(list), category);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-500">Kategori</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
        >
          {DATA_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400 hidden sm:inline">{categoryOf(category).hint}</span>
      </div>

      <div
        onDragOver={(e) => {
          if (!ready) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (ready) upload(e.dataTransfer.files);
        }}
        className={`flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30'
        } ${ready ? '' : 'opacity-60'}`}
      >
        <CloudUpload className="w-7 h-7 text-blue-500 shrink-0" />
        <p className="flex-1 text-center sm:text-left text-xs text-slate-500 dark:text-slate-400">
          {ready ? (
            <>
              Seret file ke sini, atau pilih tombol di samping. File masuk ke folder{' '}
              <b className="text-slate-700 dark:text-slate-200">{categoryOf(category).folder}</b>.
            </>
          ) : (
            'Siapkan / hubungkan folder Drive tim dulu (lihat di atas).'
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Unggah file
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={async () => {
              setError('');
              try {
                await importFromDrive(category);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Masukkan file yang sudah ada di Google Drive"
          >
            <HardDrive className="w-4 h-4 text-emerald-500" />
            Impor dari Drive
          </button>
          <button
            type="button"
            disabled={!enabled}
            onClick={() => setShowLink(!showLink)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Mis. link repo GitHub"
          >
            <Link2 className="w-4 h-4 text-slate-500" />
            Tambah link
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {showLink && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const url = normalizeUrl(linkUrl);
            if (!url) return setError('URL tidak valid.');
            try {
              await addLinkEntry({ name: linkName.trim() || url, url, category });
              setLinkName('');
              setLinkUrl('');
              setShowLink(false);
              setError('');
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2"
        >
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Nama, mis: Repo Kanban App"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
            Simpan link
          </button>
        </form>
      )}

      {uploads.length > 0 && (
        <ul className="space-y-1.5">
          {uploads.map((u) => (
            <li key={u.id} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-slate-200">{u.name}</span>
                <span className={u.error ? 'text-rose-500' : 'text-slate-400'}>
                  {u.error ? 'Gagal' : `${Math.round(u.ratio * 100)}%`}
                </span>
              </div>
              {u.error ? (
                <p className="mt-1 text-[11px] text-rose-500">{u.error}</p>
              ) : (
                <div className="mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${u.ratio * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
};

/** One row in the file list (card on phones, row on desktop). */
const FileRow: React.FC<{
  file: DataFile;
  onPreview: () => void;
  onLink: () => void;
  onDelete: () => void;
}> = ({ file, onPreview, onLink, onDelete }) => {
  const { tasks } = useKanban();
  const { Icon, color } = fileIconFor(file);
  const cat = categoryOf(file.category);
  const task = tasks.find((t) => t.id === file.taskId);
  const subtask = task?.subtasks.find((s) => s.id === file.subtaskId);

  return (
    <li className="flex items-start sm:items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
      <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onPreview}
          className="block max-w-full text-left text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate"
        >
          {file.name}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          <span className={`inline-flex items-center gap-1 font-semibold ${cat.color}`}>
            <cat.icon className="w-3 h-3" />
            {cat.label}
          </span>
          {file.sizeBytes ? <span>{formatBytes(file.sizeBytes)}</span> : null}
          <span>{formatDate(file.createdAt)}</span>
          <span className="truncate max-w-[160px]">{file.uploadedBy.split('@')[0]}</span>
        </div>
        {task && (
          <button
            type="button"
            onClick={onLink}
            className="mt-1 inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-[11px] text-blue-700 dark:text-blue-300 hover:underline"
          >
            <Link2 className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {task.title}
              {subtask && ` › ${subtask.title}`}
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" onClick={onPreview} className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Pratinjau">
          <Eye className="w-4 h-4" />
        </button>
        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Buka di Drive / tab baru"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button type="button" onClick={onLink} className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Tautkan ke tugas / subtugas">
          <Link2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={onDelete} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Hapus">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
};

/** "Pusat Data": every work file of the team, stored in Google Drive and indexed in Supabase. */
export const DataCenterModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { files, loading, updateFile, removeFile } = useFiles();
  const { activeBoardId, boards } = useKanban();
  const [category, setCategory] = useState<string>('all');
  const [uploadCategory, setUploadCategory] = useState('prd');
  const [query, setQuery] = useState('');
  const [onlyBoard, setOnlyBoard] = useState(false);
  const [preview, setPreview] = useState<DataFile | null>(null);
  const [linking, setLinking] = useState<DataFile | null>(null);
  const [notice, setNotice] = useState('');

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => (map[f.category] = (map[f.category] ?? 0) + 1));
    return map;
  }, [files]);

  const q = query.trim().toLowerCase();
  const visible = files.filter(
    (f) =>
      (category === 'all' || f.category === category) &&
      (!onlyBoard || f.boardId === activeBoardId) &&
      (!q || f.name.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q) || f.uploadedBy.includes(q))
  );

  if (!isOpen) return null;

  const pickCategory = (key: string) => {
    setCategory(key);
    if (key !== 'all') setUploadCategory(key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="sheet-panel relative w-full max-w-4xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-blue-500" />
              Pusat Data
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">File kerja tim di Google Drive, bisa dicari & ditautkan ke tugas.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          <DriveBanner />
          <AddPanel category={uploadCategory} setCategory={setUploadCategory} />

          {/* Filters */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama file, deskripsi, atau pengunggah..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={onlyBoard} onChange={(e) => setOnlyBoard(e.target.checked)} className="rounded" />
                Hanya board "{boards.find((b) => b.id === activeBoardId)?.title ?? '-'}"
              </label>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {[{ key: 'all', label: 'Semua', icon: Database, color: 'text-slate-500' }, ...DATA_CATEGORIES].map((c) => {
                const active = category === c.key;
                const count = c.key === 'all' ? files.length : counts[c.key] ?? 0;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => pickCategory(c.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <c.icon className={`w-3.5 h-3.5 ${active ? 'text-white' : c.color}`} />
                    {c.label}
                    <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={() => setNotice('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {files.length === 0 ? 'Belum ada file. Unggah file pertama di atas.' : 'Tidak ada file yang cocok dengan filter.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onPreview={() => (f.driveFileId ? setPreview(f) : f.webViewLink && window.open(f.webViewLink, '_blank', 'noopener'))}
                  onLink={() => setLinking(f)}
                  onDelete={async () => {
                    if (!confirm(`Hapus "${f.name}" dari Pusat Data?`)) return;
                    const trash = !!f.driveFileId && confirm('Pindahkan juga file aslinya ke Sampah Google Drive?\n(OK = ya, Batal = hanya hapus dari Pusat Data)');
                    try {
                      const warning = await removeFile(f, trash);
                      if (warning) setNotice(warning);
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
      {linking && (
        <TaskLinkChooser
          current={{ taskId: linking.taskId, subtaskId: linking.subtaskId }}
          onClose={() => setLinking(null)}
          onPick={async (link) => {
            const target = linking;
            setLinking(null);
            try {
              await updateFile(target.id, { taskId: link.taskId, subtaskId: link.subtaskId });
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
};
