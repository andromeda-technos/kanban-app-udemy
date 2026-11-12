import React, { useState, useEffect } from 'react';
import { useKanban } from '../context/KanbanContext';
import { AVATAR_COLOR_PRESETS } from '../utils/storage';
import { X, Settings, Users, Plus, Edit3, Trash2, Check, Tag as TagIcon, UserCheck, Palette } from 'lucide-react';
import { BrandingSettings } from './BrandingSettings';
import { useAuth } from '../context/AuthContext';
import { TeamManager } from './TeamManager';

export type SettingsTab = 'assignees' | 'tags' | 'team' | 'branding';

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const ColorPicker: React.FC<{ value: string; onChange: (hex: string) => void }> = ({
  value,
  onChange,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {AVATAR_COLOR_PRESETS.map((hex) => (
      <button
        key={hex}
        type="button"
        onClick={() => onChange(hex)}
        className={`w-6 h-6 rounded-full transition-transform ${
          value === hex
            ? 'scale-125 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900'
            : 'hover:scale-110'
        }`}
        style={{ backgroundColor: hex }}
        title={hex}
      />
    ))}
  </div>
);

const Avatar: React.FC<{ name: string; color: string }> = ({ name, color }) => (
  <div
    className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
    style={{ backgroundColor: color }}
  >
    {(name.trim().charAt(0) || '?').toUpperCase()}
  </div>
);

/** Tag directory: every tag offered in the task form. Rename/delete apply to all tasks. */
const TagManager: React.FC = () => {
  const { tagOptions, tasks, createTag, renameTag, deleteTag } = useKanban();
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const usageOf = (tag: string) => tasks.filter((t) => t.tags.includes(tag)).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    if (!createTag(newTag)) {
      setError(`Tag "${newTag.trim()}" sudah ada.`);
      return;
    }
    setNewTag('');
    setError('');
  };

  const saveEdit = () => {
    if (!editingTag || !editValue.trim()) return;
    if (!renameTag(editingTag, editValue)) {
      setError(`Tag "${editValue.trim()}" sudah ada.`);
      return;
    }
    setEditingTag(null);
    setError('');
  };

  const handleDelete = (tag: string) => {
    const count = usageOf(tag);
    const msg =
      count > 0
        ? `Hapus tag "${tag}"? Tag ini juga akan dilepas dari ${count} tugas.`
        : `Hapus tag "${tag}"?`;
    if (confirm(msg)) {
      deleteTag(tag);
      if (editingTag === tag) setEditingTag(null);
    }
  };

  return (
    <>
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-blue-500" />
          Daftar Tag ({tagOptions.length})
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Tag yang pernah dipakai di tugas otomatis tercatat di sini dan muncul sebagai pilihan saat
          membuat/mengedit tugas. Mengubah nama atau menghapus tag berlaku untuk semua tugas.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 space-y-2"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Tambah Tag Baru
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value);
              if (error) setError('');
            }}
            placeholder="Contoh: Testing, Dokumentasi, Klien"
            className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={!newTag.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>
        {error && <p className="text-[11px] text-rose-500">{error}</p>}
      </form>

      {tagOptions.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-8">Belum ada tag. Tambahkan tag di atas.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tagOptions.map((tag) => {
            const count = usageOf(tag);
            const isEditing = editingTag === tag;
            return (
              <li
                key={tag}
                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                  isEditing
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                }`}
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        if (error) setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setEditingTag(null);
                        }
                      }}
                      className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={!editValue.trim()}
                      className="p-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      title="Simpan"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(null);
                        setError('');
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Batal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        #{tag}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {count > 0 ? `Dipakai di ${count} tugas` : 'Belum dipakai'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(tag);
                        setEditValue(tag);
                        setError('');
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Ubah nama tag"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Hapus tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'assignees',
}) => {
  const { assignees, tasks, tagOptions, createAssignee, updateAssignee, deleteAssignee } = useKanban();
  const { cloudEnabled } = useAuth();
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(AVATAR_COLOR_PRESETS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(AVATAR_COLOR_PRESETS[0]);

  useEffect(() => {
    setNewName('');
    setNewColor(AVATAR_COLOR_PRESETS[Math.floor(Math.random() * AVATAR_COLOR_PRESETS.length)]);
    setEditingId(null);
    setTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isDuplicate = (name: string, ignoreId?: string) =>
    assignees.some(
      (a) => a.id !== ignoreId && a.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const taskCountFor = (id: string) => tasks.filter((t) => t.assignees.some((a) => a.id === id)).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (isDuplicate(name)) {
      alert(`Assignee "${name}" sudah ada.`);
      return;
    }
    createAssignee(name, newColor);
    setNewName('');
    setNewColor(AVATAR_COLOR_PRESETS[Math.floor(Math.random() * AVATAR_COLOR_PRESETS.length)]);
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    if (isDuplicate(name, editingId)) {
      alert(`Assignee "${name}" sudah ada.`);
      return;
    }
    updateAssignee(editingId, name, editColor);
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    const count = taskCountFor(id);
    const msg =
      count > 0
        ? `Hapus "${name}"? ${count} tugas akan dilepas dari orang ini.`
        : `Hapus "${name}"?`;
    if (confirm(msg)) {
      deleteAssignee(id);
      if (editingId === id) setEditingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="sheet-panel relative w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 text-blue-500" />
            Global Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 sm:px-6 pt-4 overflow-x-auto shrink-0">
          {(
            [
              { id: 'assignees', label: 'Assignee', icon: Users, count: assignees.length as number | null },
              { id: 'tags', label: 'Tag', icon: TagIcon, count: tagOptions.length as number | null },
              ...(cloudEnabled ? [{ id: 'team', label: 'Tim', icon: UserCheck, count: null }] : []),
              { id: 'branding', label: 'Tampilan', icon: Palette, count: null },
            ] as { id: SettingsTab; label: string; icon: typeof Users; count: number | null }[]
          ).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== null && (
                <span
                  className={`px-1.5 rounded-full text-[10px] ${
                    tab === id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {tab === 'branding' ? (
            <BrandingSettings />
          ) : tab === 'team' ? (
            <TeamManager />
          ) : tab === 'tags' ? (
            <TagManager />
          ) : (
          <>
          {/* Section: Assignees */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Daftar Assignee ({assignees.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assignee berlaku untuk semua papan. Perubahan nama atau warna otomatis diterapkan ke
              seluruh tugas terkait.
            </p>
          </div>

          {/* Add form */}
          <form
            onSubmit={handleAdd}
            className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 space-y-3"
          >
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Tambah Assignee Baru
            </label>
            <div className="flex items-center gap-2">
              <Avatar name={newName} color={newColor} />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama lengkap, contoh: Andi Wijaya"
                className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </form>

          {/* List */}
          {assignees.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8">
              Belum ada assignee. Tambahkan anggota tim di atas.
            </div>
          ) : (
            <ul className="space-y-2">
              {assignees.map((a) => {
                const count = taskCountFor(a.id);
                const isEditing = editingId === a.id;
                return (
                  <li
                    key={a.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      isEditing
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={editName} color={editColor} />
                          <input
                            type="text"
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                              }
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                setEditingId(null);
                              }
                            }}
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={!editName.trim()}
                            className="p-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            title="Simpan"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <ColorPicker value={editColor} onChange={setEditColor} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name} color={a.avatarColor} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {a.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{count} tugas ditugaskan</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(a.id, a.name, a.avatarColor)}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Edit assignee"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, a.name)}
                          className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Hapus assignee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
