import { useEffect, useState } from 'react';
import { MediaAttachment, Task } from '../types/kanban';
import { supabase } from '../lib/supabase';

const COVERS_BUCKET = 'covers';

/**
 * Uploaded task cover media lives in IndexedDB (localStorage is only ~5 MB and strings-only).
 * Only the file id is stored on the task; blobs are turned into object URLs on demand.
 */

const DB_NAME = 'kanban-media';
const STORE = 'files';
export const MAX_UPLOAD_MB = 25;

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i;

let dbPromise: Promise<IDBDatabase> | null = null;
const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
};

const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) =>
  openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );

export const putMediaFile = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id));
const getMediaFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
const deleteMediaFile = (id: string) => run('readwrite', (s) => s.delete(id));
const listMediaIds = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());

const kindOf = (type: string): MediaAttachment['kind'] => (type.startsWith('video/') ? 'video' : 'image');

/** Uploads to the team's Supabase Storage bucket (visible to every member). */
const uploadToCloud = async (blob: Blob, name: string): Promise<string> => {
  const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'media';
  const path = `${crypto.randomUUID()}/${safeName}`;
  const { error } = await supabase!.storage
    .from(COVERS_BUCKET)
    .upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return path;
};

const isSignedIn = async () => {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
};

/**
 * Saves an uploaded file and returns the media descriptor for the task:
 * Supabase Storage when signed in (shared with the team), otherwise this browser's IndexedDB.
 */
export const saveUpload = async (file: File): Promise<MediaAttachment> => {
  if (await isSignedIn()) {
    try {
      return { kind: kindOf(file.type), storagePath: await uploadToCloud(file, file.name), name: file.name };
    } catch (e) {
      throw new Error(describeCloudError((e as Error).message));
    }
  }
  const fileId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  try {
    await putMediaFile(fileId, file);
  } catch {
    throw new Error('Gagal menyimpan file di browser (penyimpanan penuh atau mode privat?).');
  }
  return { kind: kindOf(file.type), fileId, name: file.name };
};

/** Supabase Storage error → what the user should do about it. */
const describeCloudError = (raw: string): string => {
  const msg = raw || 'unknown error';
  if (/bucket not found/i.test(msg))
    return 'Tempat penyimpanan sampul ("covers") belum dibuat di Supabase. Jalankan bagian Storage di supabase/schema.sql lewat SQL Editor.';
  if (/row-level security|unauthorized|not allowed|permission|403/i.test(msg))
    return 'Akun ini belum diizinkan mengunggah sampul ke penyimpanan tim. Pastikan email terdaftar di Global Settings → Tim dan kebijakan Storage di supabase/schema.sql sudah dijalankan.';
  if (/exceed|too large|maximum allowed size|413/i.test(msg)) return 'Ukuran file melebihi batas penyimpanan sampul (25 MB).';
  if (/mime|content type/i.test(msg)) return 'Tipe file ini ditolak penyimpanan. Gunakan gambar (JPG, PNG, GIF, WebP) atau video (MP4, WebM).';
  if (/failed to fetch|network/i.test(msg)) return 'Koneksi ke Supabase terputus. Coba lagi.';
  return `Gagal mengunggah sampul: ${msg}`;
};

/** One-time move of covers stored in this browser (IndexedDB) to Supabase Storage. */
export const migrateLocalMediaToCloud = async (tasks: Task[]): Promise<Task[]> => {
  if (!(await isSignedIn())) return tasks;
  return Promise.all(
    tasks.map(async (t) => {
      if (!t.media?.fileId) return t;
      try {
        const blob = await getMediaFile(t.media.fileId);
        if (!blob) return { ...t, media: undefined };
        const storagePath = await uploadToCloud(blob, t.media.name ?? 'media');
        return { ...t, media: { kind: t.media.kind, storagePath, name: t.media.name } };
      } catch {
        return t; // keep the local reference; it just won't show for teammates
      }
    })
  );
};

export const mediaFromUrl = (url: string): MediaAttachment => ({
  kind: VIDEO_EXT.test(url) ? 'video' : 'image',
  url,
});

/** Deletes stored files that no task references anymore (run once at startup). */
export const cleanupOrphanMedia = async (tasks: Task[]) => {
  try {
    const used = new Set(tasks.map((t) => t.media?.fileId).filter(Boolean) as string[]);
    const ids = await listMediaIds();
    await Promise.all(ids.filter((id) => !used.has(String(id))).map((id) => deleteMediaFile(String(id))));
  } catch {
    /* IndexedDB unavailable (private mode etc.) — nothing to clean */
  }
};

// One object URL per stored file for the whole session
const objectUrls = new Map<string, Promise<string | null>>();
const objectUrlFor = (fileId: string) => {
  if (!objectUrls.has(fileId)) {
    objectUrls.set(
      fileId,
      getMediaFile(fileId)
        .then((blob) => (blob ? URL.createObjectURL(blob) : null))
        .catch(() => null)
    );
  }
  return objectUrls.get(fileId)!;
};

// Signed URLs for private Storage objects, cached for most of their lifetime
const SIGNED_URL_TTL = 60 * 60; // seconds
const signedUrls = new Map<string, { url: Promise<string | null>; expiresAt: number }>();
const signedUrlFor = (path: string) => {
  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const url = supabase!.storage
    .from(COVERS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
    .then(({ data }) => data?.signedUrl ?? null)
    .catch(() => null);
  signedUrls.set(path, { url, expiresAt: Date.now() + (SIGNED_URL_TTL - 300) * 1000 });
  return url;
};

/** Resolves a media descriptor to a playable src. `missing` = uploaded file not found in this browser. */
export const useMediaSrc = (media?: MediaAttachment) => {
  const [state, setState] = useState<{ src: string | null; missing: boolean }>({
    src: media?.url ?? null,
    missing: false,
  });

  useEffect(() => {
    if (!media) return setState({ src: null, missing: false });
    if (media.url) return setState({ src: media.url, missing: false });
    const pending = media.storagePath && supabase
      ? signedUrlFor(media.storagePath)
      : media.fileId
      ? objectUrlFor(media.fileId)
      : null;
    if (!pending) return setState({ src: null, missing: true });
    let alive = true;
    setState({ src: null, missing: false });
    pending.then((src) => alive && setState({ src, missing: !src }));
    return () => {
      alive = false;
    };
  }, [media?.url, media?.fileId, media?.storagePath]);

  return state;
};
