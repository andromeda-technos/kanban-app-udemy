import {
  Code,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Palette,
  Presentation,
  type LucideIcon,
} from 'lucide-react';

/**
 * Turns user input into an absolute http(s) URL ("docs.google.com/..." → "https://docs.google.com/...").
 * Returns null for anything that is not a valid web link (blocks javascript:, data:, etc).
 */
export const normalizeUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
};

export const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface LinkKind {
  label: string;
  icon: LucideIcon;
  className: string; // icon tint
}

/** Rough guess of what kind of document a link points to, for a matching icon. */
export const getLinkKind = (url: string): LinkKind => {
  const lower = url.toLowerCase();
  const host = getHostname(lower);

  if (host === 'docs.google.com' && lower.includes('/spreadsheets/'))
    return { label: 'Spreadsheet', icon: FileSpreadsheet, className: 'text-emerald-600 dark:text-emerald-400' };
  if (host === 'docs.google.com' && lower.includes('/presentation/'))
    return { label: 'Presentasi', icon: Presentation, className: 'text-amber-600 dark:text-amber-400' };
  if (/\.(xlsx?|csv)(\?|#|$)/.test(lower))
    return { label: 'Spreadsheet', icon: FileSpreadsheet, className: 'text-emerald-600 dark:text-emerald-400' };
  if (/\.(pptx?|key)(\?|#|$)/.test(lower))
    return { label: 'Presentasi', icon: Presentation, className: 'text-amber-600 dark:text-amber-400' };
  if (host.includes('figma.com') || host.includes('canva.com'))
    return { label: 'Desain', icon: Palette, className: 'text-fuchsia-600 dark:text-fuchsia-400' };
  if (host.includes('github.com') || host.includes('gitlab.com') || host.includes('bitbucket.org'))
    return { label: 'Repository', icon: Code, className: 'text-slate-700 dark:text-slate-300' };
  if (host === 'drive.google.com' || host.includes('dropbox.com') || host.includes('sharepoint.com') || host.includes('onedrive'))
    return { label: 'Folder / File', icon: FolderOpen, className: 'text-sky-600 dark:text-sky-400' };
  if (host === 'docs.google.com' || host.includes('notion.') || /\.(pdf|docx?|txt|md)(\?|#|$)/.test(lower))
    return { label: 'Dokumen', icon: FileText, className: 'text-blue-600 dark:text-blue-400' };

  return { label: 'Link', icon: Link2, className: 'text-slate-500 dark:text-slate-400' };
};
