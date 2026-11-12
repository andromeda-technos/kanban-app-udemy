import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useKanban } from './KanbanContext';
import {
  DriveAuthNeeded,
  authorizeDrive,
  clearDriveToken,
  getDriveToken,
  isGoogleConfigured,
  openPicker,
  preloadGoogle,
} from '../lib/google';
import { createPortal } from 'react-dom';
import { canAccess, createFolder, DriveError, FOLDER_MIME, shareWithEmail, trashFile, uploadFile } from '../lib/drive';
import { BACKUPS_FOLDER, DATA_CATEGORIES, ROOT_FOLDER_NAME } from '../utils/dataCenter';

/** A row of the Pusat Data index (Supabase `files`). */
export interface DataFile {
  id: string;
  driveFileId?: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  category: string;
  description?: string;
  webViewLink?: string;
  boardId?: string;
  taskId?: string;
  subtaskId?: string;
  uploadedBy: string;
  createdAt: string;
}

/** Team Drive folder layout, shared through `app_settings.drive_folders`. */
export interface DriveFolders {
  rootId: string;
  rootLink?: string;
  categories: Record<string, string>; // category key → folder id
  backupsId?: string;
  sharedWith: string[];
  createdBy: string;
}

export interface FileLink {
  taskId?: string;
  subtaskId?: string;
}

export interface UploadProgress {
  id: string;
  name: string;
  ratio: number;
  error?: string;
}

type Connection = 'unknown' | 'connected' | 'needs-connect';

interface FilesContextType {
  enabled: boolean; // cloud + Google keys present
  files: DataFile[];
  loading: boolean;
  folders: DriveFolders | null;
  connection: Connection;
  uploads: UploadProgress[];
  setupFolders: () => Promise<void>;
  shareWithTeam: () => Promise<{ added: string[]; failed: string[] }>;
  connectFolders: () => Promise<void>;
  uploadFiles: (files: File[], category: string, link?: FileLink) => Promise<void>;
  importFromDrive: (category: string, link?: FileLink) => Promise<number>;
  addLinkEntry: (entry: { name: string; url: string; category: string; description?: string }, link?: FileLink) => Promise<void>;
  updateFile: (id: string, patch: Partial<Pick<DataFile, 'name' | 'category' | 'description' | 'taskId' | 'subtaskId'>>) => Promise<void>;
  removeFile: (file: DataFile, alsoTrashInDrive: boolean) => Promise<string | null>;
  filesForTask: (taskId: string) => DataFile[];
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

type Row = Record<string, unknown>;
const fromRow = (r: Row): DataFile => ({
  id: String(r.id),
  driveFileId: (r.drive_file_id as string) ?? undefined,
  name: String(r.name),
  mimeType: (r.mime_type as string) ?? undefined,
  sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : undefined,
  category: String(r.category),
  description: (r.description as string) ?? undefined,
  webViewLink: (r.web_view_link as string) ?? undefined,
  boardId: (r.board_id as string) ?? undefined,
  taskId: (r.task_id as string) ?? undefined,
  subtaskId: (r.subtask_id as string) ?? undefined,
  uploadedBy: String(r.uploaded_by ?? ''),
  createdAt: String(r.created_at),
});

const connectedKey = (rootId: string, email: string) => `kanban_drive_connected:${rootId}:${email}`;

export const FilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cloudEnabled, user } = useAuth();
  const { tasks, columns } = useKanban();
  const enabled = cloudEnabled && isGoogleConfigured && !!supabase;
  const email = user?.email?.toLowerCase() ?? '';

  const [files, setFiles] = useState<DataFile[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [folders, setFolders] = useState<DriveFolders | null>(null);
  const [connection, setConnection] = useState<Connection>('unknown');
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  // ---------- Drive permission (popup must come from a click) ----------
  const [authPrompt, setAuthPrompt] = useState<{
    label: string;
    allow: () => void;
    cancel: () => void;
    error?: string;
  } | null>(null);

  /**
   * Drive token for an action. When the permission has expired and we're no longer inside the
   * user's click, the action waits until they press "Izinkan Google Drive", then continues.
   */
  const obtainToken = useCallback(
    async (label: string): Promise<string> => {
      try {
        return await getDriveToken(email);
      } catch (e) {
        if (!(e instanceof DriveAuthNeeded)) throw e;
      }
      return new Promise<string>((resolve, reject) => {
        const prompt = {
          label,
          allow: () => {
            // synchronous inside the button's click → popup allowed
            authorizeDrive(email).then(
              (token) => {
                setAuthPrompt(null);
                resolve(token);
              },
              (err: Error) => setAuthPrompt((p) => (p ? { ...p, error: err.message } : p))
            );
          },
          cancel: () => {
            setAuthPrompt(null);
            reject(new Error('Izin Google Drive dibatalkan'));
          },
        };
        setAuthPrompt(prompt);
      });
    },
    [email]
  );

  // ---------- load + realtime ----------
  useEffect(() => {
    if (!enabled || !supabase) return;
    preloadGoogle();
    let alive = true;
    (async () => {
      const [f, s] = await Promise.all([
        supabase.from('files').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'drive_folders').maybeSingle(),
      ]);
      if (!alive) return;
      if (f.data) setFiles(f.data.map(fromRow));
      setFolders((s.data?.value as DriveFolders) ?? null);
      setLoading(false);
    })();

    const channel = supabase
      .channel('files-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = String((p.old as Row).id);
          setFiles((prev) => prev.filter((x) => x.id !== id));
        } else {
          const item = fromRow(p.new as Row);
          setFiles((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (p) => {
        const row = p.new as Row;
        if (row?.key === 'drive_folders') setFolders(row.value as DriveFolders);
      })
      .subscribe();

    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [enabled]);

  // Remembered per browser: has this account already linked the team folder?
  useEffect(() => {
    if (!folders || !email) return setConnection('unknown');
    if (folders.createdBy === email) return setConnection('connected');
    let remembered = false;
    try {
      remembered = localStorage.getItem(connectedKey(folders.rootId, email)) === '1';
    } catch {
      /* ignore */
    }
    setConnection(remembered ? 'connected' : 'needs-connect');
  }, [folders, email]);

  const markConnected = useCallback(
    (rootId: string) => {
      try {
        localStorage.setItem(connectedKey(rootId, email), '1');
      } catch {
        /* ignore */
      }
      setConnection('connected');
    },
    [email]
  );

  const saveFolders = async (value: DriveFolders) => {
    const { error } = await supabase!
      .from('app_settings')
      .upsert({ key: 'drive_folders', value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    setFolders(value);
  };

  // ---------- owner: create folders ----------
  const setupFolders = useCallback(async () => {
    const token = await obtainToken('menyiapkan folder tim');
    const root = await createFolder(token, ROOT_FOLDER_NAME);
    const categories: Record<string, string> = {};
    for (const c of DATA_CATEGORIES) {
      categories[c.key] = (await createFolder(token, c.folder, root.id)).id;
    }
    const backups = await createFolder(token, BACKUPS_FOLDER, root.id);
    await saveFolders({
      rootId: root.id,
      rootLink: root.webViewLink,
      categories,
      backupsId: backups.id,
      sharedWith: [],
      createdBy: email,
    });
    markConnected(root.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, markConnected, obtainToken]);

  // ---------- owner: share with every team member ----------
  const shareWithTeam = useCallback(async () => {
    if (!folders) throw new Error('Folder tim belum disiapkan');
    const token = await obtainToken('membagikan folder ke tim');
    const { data, error } = await supabase!.from('members').select('email');
    if (error) throw new Error(error.message);
    const targets = (data ?? [])
      .map((m) => String(m.email).toLowerCase())
      .filter((e) => e !== folders.createdBy && !folders.sharedWith.includes(e));
    const added: string[] = [];
    const failed: string[] = [];
    for (const target of targets) {
      try {
        await shareWithEmail(token, folders.rootId, target);
        added.push(target);
      } catch {
        failed.push(target);
      }
    }
    if (added.length) await saveFolders({ ...folders, sharedWith: [...folders.sharedWith, ...added] });
    return { added, failed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, email, obtainToken]);

  // ---------- members: grant this app access to the team folders (one time) ----------
  const connectFolders = useCallback(async () => {
    if (!folders) throw new Error('Owner belum menyiapkan folder tim');
    const token = await obtainToken('menghubungkan folder tim');
    const allIds = [folders.rootId, ...Object.values(folders.categories), folders.backupsId].filter(Boolean) as string[];
    const missing = async () => {
      const result: string[] = [];
      for (const id of allIds) if (!(await canAccess(token, id))) result.push(id);
      return result;
    };

    let left = await missing();
    if (left.includes(folders.rootId)) {
      await openPicker({ token, mode: 'folders', title: `Pilih folder "${ROOT_FOLDER_NAME}"` });
      left = await missing();
    }
    if (left.length > 0 && !left.includes(folders.rootId)) {
      // drive.file grants access per folder: let the user select the category folders too
      await openPicker({
        token,
        mode: 'folders',
        title: 'Pilih SEMUA folder kategori (Ctrl/Shift + klik), lalu Select',
        parentId: folders.rootId,
        multiselect: true,
      });
      left = await missing();
    }
    if (left.includes(folders.rootId)) {
      throw new Error(`Folder "${ROOT_FOLDER_NAME}" belum dipilih atau belum dibagikan ke akun ini.`);
    }
    if (left.length > 0) {
      throw new Error(`Masih ada ${left.length} folder kategori yang belum dipilih. Ulangi dan pilih semuanya.`);
    }
    markConnected(folders.rootId);
  }, [folders, email, markConnected, obtainToken]);

  // ---------- helpers ----------
  const boardOfTask = useCallback(
    (taskId?: string) => {
      if (!taskId) return null;
      const task = tasks.find((t) => t.id === taskId);
      return columns.find((c) => c.id === task?.columnId)?.boardId ?? null;
    },
    [tasks, columns]
  );

  const insertRows = async (rows: Row[]) => {
    const { data, error } = await supabase!.from('files').upsert(rows, { onConflict: 'drive_file_id' }).select();
    if (error) throw new Error(error.message);
    const added = (data ?? []).map(fromRow);
    setFiles((prev) => [...added, ...prev.filter((x) => !added.some((a) => a.id === x.id))]);
  };

  const linkColumns = (link?: FileLink) => ({
    task_id: link?.taskId ?? null,
    subtask_id: link?.subtaskId ?? null,
    board_id: boardOfTask(link?.taskId),
  });

  // ---------- upload ----------
  const uploadFiles = useCallback(
    async (list: File[], category: string, link?: FileLink) => {
      if (!folders) throw new Error('Folder Drive tim belum disiapkan');
      const parentId = folders.categories[category];
      let token = await obtainToken(list.length > 1 ? `mengunggah ${list.length} file` : `mengunggah "${list[0]?.name}"`);
      for (const file of list) {
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setUploads((prev) => [...prev, { id: uid, name: file.name, ratio: 0 }]);
        try {
          const onRatio = (ratio: number) =>
            setUploads((prev) => prev.map((u) => (u.id === uid ? { ...u, ratio } : u)));
          let driveFile;
          try {
            driveFile = await uploadFile(token, file, parentId, onRatio);
          } catch (err) {
            // Permission expired mid-way → ask again once, then retry this file
            if (!(err instanceof DriveError && err.status === 401)) throw err;
            clearDriveToken();
            token = await obtainToken(`mengunggah "${file.name}"`);
            driveFile = await uploadFile(token, file, parentId, onRatio);
          }
          await insertRows([
            {
              drive_file_id: driveFile.id,
              name: driveFile.name,
              mime_type: driveFile.mimeType,
              size_bytes: driveFile.size ? Number(driveFile.size) : file.size,
              category,
              web_view_link: driveFile.webViewLink,
              ...linkColumns(link),
            },
          ]);
          setUploads((prev) => prev.filter((u) => u.id !== uid));
        } catch (e) {
          const message =
            e instanceof DriveError && e.status === 404
              ? 'Folder belum terhubung. Klik "Hubungkan folder tim" dulu.'
              : (e as Error).message;
          if (e instanceof DriveError && e.status === 404) setConnection('needs-connect');
          setUploads((prev) => prev.map((u) => (u.id === uid ? { ...u, error: message } : u)));
          window.setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== uid)), 30000);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folders, email, boardOfTask, obtainToken]
  );

  // ---------- import existing Drive files ----------
  const importFromDrive = useCallback(
    async (category: string, link?: FileLink) => {
      const token = await obtainToken('mengimpor file dari Drive');
      const picked = await openPicker({ token, mode: 'files', title: 'Pilih file untuk Pusat Data', multiselect: true });
      const docs = picked.filter((d) => d.mimeType !== FOLDER_MIME);
      if (docs.length === 0) return 0;
      await insertRows(
        docs.map((d) => ({
          drive_file_id: d.id,
          name: d.name,
          mime_type: d.mimeType,
          size_bytes: d.sizeBytes ?? null,
          category,
          web_view_link: d.url ?? `https://drive.google.com/file/d/${d.id}/view`,
          ...linkColumns(link),
        }))
      );
      return docs.length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email, boardOfTask, obtainToken]
  );

  // ---------- link entries (e.g. GitHub repo) ----------
  const addLinkEntry = useCallback(
    async (entry: { name: string; url: string; category: string; description?: string }, link?: FileLink) => {
      const { data, error } = await supabase!
        .from('files')
        .insert({
          name: entry.name,
          category: entry.category,
          description: entry.description ?? null,
          web_view_link: entry.url,
          mime_type: 'text/uri-list',
          ...linkColumns(link),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const item = fromRow(data);
      setFiles((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardOfTask]
  );

  const updateFile = useCallback(
    async (id: string, patch: Partial<Pick<DataFile, 'name' | 'category' | 'description' | 'taskId' | 'subtaskId'>>) => {
      const row: Row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.description !== undefined) row.description = patch.description || null;
      if ('taskId' in patch) {
        row.task_id = patch.taskId ?? null;
        row.board_id = boardOfTask(patch.taskId);
      }
      if ('subtaskId' in patch) row.subtask_id = patch.subtaskId ?? null;
      row.updated_at = new Date().toISOString();
      const { data, error } = await supabase!.from('files').update(row).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      const item = fromRow(data);
      setFiles((prev) => prev.map((x) => (x.id === id ? item : x)));
    },
    [boardOfTask]
  );

  /** Returns a warning when the Drive file couldn't be trashed (e.g. uploaded by someone else). */
  const removeFile = useCallback(
    async (file: DataFile, alsoTrashInDrive: boolean) => {
      let warning: string | null = null;
      if (alsoTrashInDrive && file.driveFileId) {
        try {
          const token = await obtainToken('memindahkan file ke Sampah Drive');
          await trashFile(token, file.driveFileId);
        } catch {
          warning = 'File dihapus dari Pusat Data, tetapi tidak bisa dipindah ke Sampah Drive (mungkin diunggah orang lain). Hapus manual di Drive bila perlu.';
        }
      }
      const { error } = await supabase!.from('files').delete().eq('id', file.id);
      if (error) throw new Error(error.message);
      setFiles((prev) => prev.filter((x) => x.id !== file.id));
      return warning;
    },
    [email, obtainToken]
  );

  const filesForTask = useCallback((taskId: string) => files.filter((f) => f.taskId === taskId), [files]);

  const value = useMemo(
    () => ({
      enabled,
      files,
      loading,
      folders,
      connection,
      uploads,
      setupFolders,
      shareWithTeam,
      connectFolders,
      uploadFiles,
      importFromDrive,
      addLinkEntry,
      updateFile,
      removeFile,
      filesForTask,
    }),
    [enabled, files, loading, folders, connection, uploads, setupFolders, shareWithTeam, connectFolders, uploadFiles, importFromDrive, addLinkEntry, updateFile, removeFile, filesForTask]
  );

  return (
    <FilesContext.Provider value={value}>
      {children}
      {authPrompt &&
        createPortal(
          <div
            role="alertdialog"
            aria-label="Izin Google Drive"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] w-[calc(100vw-2rem)] max-w-md p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl animate-[toast-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                <svg viewBox="0 0 87.3 78" className="w-5 h-5" aria-hidden="true">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Izin Google Drive perlu diperbarui</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Untuk {authPrompt.label}. Izin dari Google berlaku sekitar 1 jam, klik tombol di bawah lalu prosesnya lanjut otomatis.
                </p>
                {authPrompt.error && <p className="mt-1.5 text-xs text-rose-500">{authPrompt.error}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={authPrompt.allow}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
                  >
                    Izinkan Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={authPrompt.cancel}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </FilesContext.Provider>
  );
};

export const useFiles = () => {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error('useFiles must be used within a FilesProvider');
  return ctx;
};
