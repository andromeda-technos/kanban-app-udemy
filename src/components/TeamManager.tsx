import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Crown, LoaderCircle, Plus, Trash2, UserCheck } from 'lucide-react';

interface Member {
  email: string;
  role: 'owner' | 'member';
  added_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Team allowlist (Supabase `members`). Everyone can see it; only owners can change it. */
export const TeamManager: React.FC = () => {
  const { user, role } = useAuth();
  const isOwner = role === 'owner';
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase.from('members').select('*').order('added_at');
    if (err) setError(err.message);
    else setMembers((data ?? []) as Member[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Format email tidak valid.');
    if (members.some((m) => m.email.toLowerCase() === clean)) return setError('Email ini sudah terdaftar.');
    const { error: err } = await supabase!.from('members').insert({ email: clean, role: 'member' });
    if (err) return setError(err.message);
    setEmail('');
    setError('');
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`Keluarkan ${m.email} dari tim? Orang ini tidak bisa membuka data lagi.`)) return;
    const { error: err } = await supabase!.from('members').delete().eq('email', m.email);
    if (err) return setError(err.message);
    load();
  };

  const toggleOwner = async (m: Member) => {
    const next = m.role === 'owner' ? 'member' : 'owner';
    const { error: err } = await supabase!.from('members').update({ role: next }).eq('email', m.email);
    if (err) return setError(err.message);
    load();
  };

  const me = user?.email?.toLowerCase();

  return (
    <>
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-500" />
          Anggota Tim ({members.length})
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Hanya Gmail di daftar ini yang bisa membuka data tim setelah login Google. Selama aplikasi Google masih
          mode <em>Testing</em>, email yang sama juga harus ditambahkan sebagai <em>Test user</em> di Google Cloud.
        </p>
      </div>

      {isOwner ? (
        <form
          onSubmit={add}
          className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 space-y-2"
        >
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Tambah Anggota
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="nama@gmail.com"
              className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!email.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-slate-500 px-1">Hanya owner yang bisa menambah atau mengeluarkan anggota.</p>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <LoaderCircle className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const isMe = m.email.toLowerCase() === me;
            return (
              <li
                key={m.email}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-200">
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {m.email} {isMe && <span className="text-[11px] font-normal text-slate-400">(kamu)</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    {m.role === 'owner' && <Crown className="w-3 h-3 text-amber-500" />}
                    {m.role === 'owner' ? 'Owner' : 'Anggota'}
                  </p>
                </div>
                {isOwner && !isMe && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOwner(m)}
                      className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title={m.role === 'owner' ? 'Jadikan anggota biasa' : 'Jadikan owner'}
                    >
                      <Crown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Keluarkan dari tim"
                    >
                      <Trash2 className="w-4 h-4" />
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
