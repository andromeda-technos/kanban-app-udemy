import { Board, Column, Task, ActivityLog, FilterState } from '../types/kanban';

export const INITIAL_BOARDS: Board[] = [
  {
    id: 'board-1',
    title: '🚀 Sprint 24 - E-Commerce Platform',
    description: 'Pengembangan fitur utama kuartal 4: Checkout, Auth, dan Payment Gateway',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'board-2',
    title: '📱 Mobile App Launch',
    description: 'Roadmap perilisan aplikasi Android & iOS',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const INITIAL_COLUMNS: Column[] = [
  { id: 'col-backlog', boardId: 'board-1', title: 'Backlog', color: '#64748b', wipLimit: 10, order: 0 },
  { id: 'col-todo', boardId: 'board-1', title: 'To Do', color: '#3b82f6', wipLimit: 8, order: 1 },
  { id: 'col-in-progress', boardId: 'board-1', title: 'In Progress', color: '#f59e0b', wipLimit: 4, order: 2 },
  { id: 'col-review', boardId: 'board-1', title: 'In Review', color: '#8b5cf6', wipLimit: 3, order: 3 },
  { id: 'col-done', boardId: 'board-1', title: 'Done', color: '#10b981', wipLimit: 0, order: 4 },

  // Columns for board-2
  { id: 'col-b2-backlog', boardId: 'board-2', title: 'Idea & Backlog', color: '#64748b', wipLimit: 10, order: 0 },
  { id: 'col-b2-todo', boardId: 'board-2', title: 'Sprint Tasks', color: '#3b82f6', wipLimit: 6, order: 1 },
  { id: 'col-b2-progress', boardId: 'board-2', title: 'Developing', color: '#f59e0b', wipLimit: 3, order: 2 },
  { id: 'col-b2-done', boardId: 'board-2', title: 'Shipped', color: '#10b981', wipLimit: 0, order: 3 },
];

const today = new Date();
const formatDate = (daysOffset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    columnId: 'col-todo',
    title: 'Implementasi OAuth2 (Google & GitHub)',
    description: 'Buat alur login sosial media menggunakan NextAuth/OAuth2 standar industri dengan refresh token JWT.',
    priority: 'urgent',
    dueDate: formatDate(-1), // Kemarin (overdue untuk demo alert)
    tags: ['Backend', 'Security', 'Auth'],
    assignee: { id: 'u1', name: 'Rian Pratama', avatarColor: '#3b82f6' },
    subtasks: [
      { id: 's1-1', title: 'Daftar credentials Google Cloud Console', completed: true },
      { id: 's1-2', title: 'Daftar credentials GitHub Developer Apps', completed: true },
      { id: 's1-3', title: 'Buat handler callback API', completed: false },
      { id: 's1-4', title: 'Testing token refresh expiration', completed: false },
    ],
    order: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    columnId: 'col-in-progress',
    title: 'Redesign UI Checkout & Multiple Address',
    description: 'Sederhanakan alur pemilihan alamat pengiriman dan ringkasan pembayaran agar rasio konversi meningkat.',
    priority: 'high',
    dueDate: formatDate(1), // Besok
    tags: ['Frontend', 'UI/UX'],
    assignee: { id: 'u2', name: 'Sarah Anindya', avatarColor: '#ec4899' },
    subtasks: [
      { id: 's2-1', title: 'Design mockup di Figma', completed: true },
      { id: 's2-2', title: 'Slicing komponen React dengan Tailwind', completed: true },
      { id: 's2-3', title: 'Validasi form input kode pos & kurir', completed: false },
    ],
    order: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    columnId: 'col-in-progress',
    title: 'Integrasi Payment Gateway Midtrans Snap',
    description: 'Hubungkan webhook notifikasi transaksi, QRIS, Virtual Account BCA/Mandiri, dan kartu kredit.',
    priority: 'urgent',
    dueDate: formatDate(2),
    tags: ['Backend', 'Payment'],
    assignee: { id: 'u3', name: 'Dimas Kurnia', avatarColor: '#10b981' },
    subtasks: [
      { id: 's3-1', title: 'Buat endpoint /api/charge', completed: true },
      { id: 's3-2', title: 'Verifikasi signature HMAC sha512', completed: false },
      { id: 's3-3', title: 'Simulasi webhook di environment sandbox', completed: false },
    ],
    order: 1,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    columnId: 'col-review',
    title: 'Optimasi Query Database PostgreSQL',
    description: 'Tambahkan indeks komposit pada tabel order_items dan kurangi N+1 queries pada endpoint katalog.',
    priority: 'medium',
    dueDate: formatDate(3),
    tags: ['Database', 'Performance'],
    assignee: { id: 'u1', name: 'Rian Pratama', avatarColor: '#3b82f6' },
    subtasks: [
      { id: 's4-1', title: 'EXPLAIN ANALYZE query berat', completed: true },
      { id: 's4-2', title: 'Tambahkan index btree pada status & created_at', completed: true },
    ],
    order: 0,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-5',
    columnId: 'col-done',
    title: 'Setup CI/CD Pipeline GitHub Actions',
    description: 'Otomatisasi linting, build verification, dan deploy staging ke server Kubernetes pada pull request.',
    priority: 'high',
    dueDate: formatDate(-2),
    tags: ['DevOps', 'CI/CD'],
    assignee: { id: 'u4', name: 'Budi Santoso', avatarColor: '#8b5cf6' },
    subtasks: [
      { id: 's5-1', title: 'Setup workflow YAML lint & test', completed: true },
      { id: 's5-2', title: 'Build Docker image & push ke registry', completed: true },
      { id: 's5-3', title: 'Kirim notifikasi Telegram saat build sukses', completed: true },
    ],
    order: 0,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-6',
    columnId: 'col-backlog',
    title: 'Fitur Push Notification Web Push',
    description: 'Implementasi Service Worker untuk notifikasi diskon kilat dan pengingat keranjang belanja ditinggalkan.',
    priority: 'low',
    dueDate: formatDate(7),
    tags: ['PWA', 'Marketing'],
    assignee: { id: 'u2', name: 'Sarah Anindya', avatarColor: '#ec4899' },
    subtasks: [
      { id: 's6-1', title: 'Riset library web-push', completed: false },
      { id: 's6-2', title: 'Desain banner izin notifikasi', completed: false },
    ],
    order: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    action: 'move_task',
    details: 'Tugas "Setup CI/CD Pipeline GitHub Actions" selesai dipindahkan ke Done 🎉',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    action: 'update_task',
    details: 'Memperbarui subtask pada "Redesign UI Checkout & Multiple Address"',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    action: 'create_task',
    details: 'Tugas baru dibuat: "Implementasi OAuth2 (Google & GitHub)"',
  },
];

export const STORAGE_KEYS = {
  BOARDS: 'kanban_boards_v1',
  ACTIVE_BOARD_ID: 'kanban_active_board_id_v1',
  COLUMNS: 'kanban_columns_v1',
  TASKS: 'kanban_tasks_v1',
  LOGS: 'kanban_logs_v1',
  THEME: 'kanban_theme_v1',
};

export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Gagal membaca dari localStorage untuk key: ${key}`, error);
    return defaultValue;
  }
};

export const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Gagal menyimpan ke localStorage untuk key: ${key}`, error);
  }
};

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  priorities: [],
  tags: [],
  assignees: [],
  dueFilter: 'all',
  sortBy: 'custom',
};
