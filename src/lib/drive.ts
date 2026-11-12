/** Minimal Google Drive v3 REST client (drive.file scope). */
import { clearDriveToken } from './google';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,mimeType,size,webViewLink,iconLink';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export class DriveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const call = async <T>(token: string, url: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401) clearDriveToken();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      msg = (await res.json()).error?.message ?? msg;
    } catch {
      /* not JSON */
    }
    throw new DriveError(msg, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
};

export const createFolder = (token: string, name: string, parentId?: string) =>
  call<DriveFile>(token, `${API}/files?fields=${FILE_FIELDS}`, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });

/** true when this user + app can access the file/folder (drive.file grants are per user). */
export const canAccess = async (token: string, id: string) => {
  try {
    await call(token, `${API}/files/${id}?fields=id`);
    return true;
  } catch (e) {
    if (e instanceof DriveError && (e.status === 404 || e.status === 403)) return false;
    throw e;
  }
};

export const getFile = (token: string, id: string) => call<DriveFile>(token, `${API}/files/${id}?fields=${FILE_FIELDS}`);

export const trashFile = (token: string, id: string) =>
  call(token, `${API}/files/${id}`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });

/** Give a Gmail edit access (Google sends them an email). Children of a folder inherit it. */
export const shareWithEmail = (token: string, fileId: string, email: string) =>
  call(token, `${API}/files/${fileId}/permissions?sendNotificationEmail=true`, {
    method: 'POST',
    body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }),
  });

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Browsers report archives inconsistently (Windows: "application/x-zip-compressed",
 * sometimes an empty type), so the MIME type is derived from the extension when known.
 */
const MIME_BY_EXT: Record<string, string> = {
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  skill: 'application/zip',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
};

export const mimeOf = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? (file.type || 'application/octet-stream');
};

// 8 MiB per request (must be a multiple of 256 KiB)
const CHUNK = 8 * 1024 * 1024;
const MAX_RETRIES = 4;

interface ChunkResult {
  status: number;
  body: string;
  range: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const readError = (status: number, body: string) => {
  try {
    const msg = JSON.parse(body)?.error?.message;
    if (msg) return `${msg} (${status})`;
  } catch {
    /* not JSON */
  }
  return `Upload gagal (${status})`;
};

/** One PUT to the resumable session; resolves with the status even when it is an error. */
const putChunk = (
  location: string,
  body: Blob | null,
  contentRange: string,
  type: string,
  onProgress?: (loaded: number) => void
) =>
  new Promise<ChunkResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', location);
    if (body) xhr.setRequestHeader('Content-Type', type);
    xhr.setRequestHeader('Content-Range', contentRange);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded);
    xhr.onload = () => {
      let range: string | null = null;
      try {
        range = xhr.getResponseHeader('Range');
      } catch {
        /* header not exposed */
      }
      resolve({ status: xhr.status, body: xhr.responseText, range });
    };
    xhr.onerror = () => reject(new DriveError('Koneksi terputus saat upload', 0));
    xhr.send(body);
  });

/**
 * Resumable upload in 8 MiB chunks with progress. A chunk that fails because of the network
 * or a server hiccup (5xx / 429) is retried, continuing from what Drive already received.
 */
export const uploadFile = async (
  token: string,
  file: File,
  parentId: string,
  onProgress?: (ratio: number) => void
): Promise<DriveFile> => {
  const type = mimeOf(file);
  const total = file.size;

  const init = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': type,
      'X-Upload-Content-Length': String(total),
    },
    body: JSON.stringify({ name: file.name, parents: [parentId], mimeType: type }),
  });
  if (init.status === 401) clearDriveToken();
  if (!init.ok) {
    let msg = `${init.status} ${init.statusText}`;
    try {
      msg = (await init.json()).error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new DriveError(msg, init.status);
  }
  const location = init.headers.get('Location');
  if (!location) throw new DriveError('Drive tidak mengembalikan URL upload', 500);

  // Empty file: a single empty PUT finishes the session
  if (total === 0) {
    const res = await putChunk(location, file, 'bytes */0', type);
    if (res.status >= 200 && res.status < 300) return JSON.parse(res.body);
    throw new DriveError(readError(res.status, res.body), res.status);
  }

  let offset = 0;
  let retries = 0;
  while (offset < total) {
    const end = Math.min(offset + CHUNK, total);
    let res: ChunkResult;
    try {
      res = await putChunk(location, file.slice(offset, end), `bytes ${offset}-${end - 1}/${total}`, type, (loaded) =>
        onProgress?.((offset + loaded) / total)
      );
    } catch (e) {
      res = { status: 0, body: (e as Error).message, range: null };
    }

    if (res.status >= 200 && res.status < 300) {
      onProgress?.(1);
      return JSON.parse(res.body);
    }
    if (res.status === 308) {
      // Chunk accepted; Drive says how much it has (fall back to the chunk end)
      const m = res.range?.match(/bytes=0-(\d+)/);
      offset = m ? Number(m[1]) + 1 : end;
      retries = 0;
      continue;
    }

    const transient = res.status === 0 || res.status === 429 || res.status >= 500;
    if (!transient || retries >= MAX_RETRIES) {
      if (res.status === 401) clearDriveToken();
      throw new DriveError(res.status === 0 ? 'Koneksi terputus saat upload' : readError(res.status, res.body), res.status);
    }
    retries++;
    await sleep(1000 * 2 ** (retries - 1));
    // Ask Drive how far it got, then continue from there
    try {
      const status = await putChunk(location, null, `bytes */${total}`, type);
      if (status.status >= 200 && status.status < 300) return JSON.parse(status.body);
      if (status.status === 308) {
        const m = status.range?.match(/bytes=0-(\d+)/);
        offset = m ? Number(m[1]) + 1 : 0;
      }
    } catch {
      /* still offline: retry the same chunk */
    }
  }
  throw new DriveError('Upload tidak selesai', 500);
};
