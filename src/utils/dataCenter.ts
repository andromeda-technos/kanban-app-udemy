import {
  Users,
  Map as MapIcon,
  BookOpen,
  FileText,
  LayoutTemplate,
  Palette,
  Code,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface DataCategory {
  key: string;
  label: string;
  folder: string; // sub-folder name inside the team Drive folder
  icon: LucideIcon;
  color: string; // tailwind text color
  hint: string;
}

export const DATA_CATEGORIES: DataCategory[] = [
  { key: 'responden', label: 'Responden', folder: '01 Responden', icon: Users, color: 'text-sky-500', hint: 'Hasil survei, wawancara, kuesioner' },
  { key: 'blueprint', label: 'Blueprint', folder: '02 Blueprint', icon: MapIcon, color: 'text-indigo-500', hint: 'Customer requirements blueprint' },
  { key: 'whitepaper', label: 'Whitepaper', folder: '03 Whitepaper', icon: BookOpen, color: 'text-amber-500', hint: 'Dokumen konsep & riset' },
  { key: 'prd', label: 'PRD', folder: '04 PRD', icon: FileText, color: 'text-blue-500', hint: 'Product requirements document' },
  { key: 'wireframe', label: 'Wireframe', folder: '05 Wireframe', icon: LayoutTemplate, color: 'text-slate-500', hint: 'Sketsa & struktur halaman' },
  { key: 'uiux', label: 'UI/UX', folder: '06 UI-UX', icon: Palette, color: 'text-fuchsia-500', hint: 'Desain visual, mockup, aset' },
  { key: 'source-code', label: 'Source Code', folder: '07 Source Code', icon: Code, color: 'text-emerald-500', hint: 'Arsip kode (.zip) atau link repo' },
  { key: 'skill-claude', label: 'Skill Claude', folder: '08 Skill Claude', icon: Sparkles, color: 'text-orange-500', hint: 'File skill (.md, .skill, .zip)' },
];

export const BACKUPS_FOLDER = 'Backups';
export const ROOT_FOLDER_NAME = 'Kanban App';

export const categoryOf = (key: string) => DATA_CATEGORIES.find((c) => c.key === key) ?? DATA_CATEGORIES[0];

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
};

/** Embeddable Drive preview (works for PDFs, images, video, Office/Docs, text & code). */
export const drivePreviewUrl = (driveFileId: string) => `https://drive.google.com/file/d/${driveFileId}/preview`;
