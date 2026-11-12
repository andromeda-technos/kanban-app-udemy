import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ActivityLog, Assignee, Board, Column, Task, TokenTimer } from '../types/kanban';
import { TableSpec, stableStringify } from './mappers';
import { migrateLocalMediaToCloud } from '../utils/mediaStore';

export type SyncStatus =
  | 'local' // no Supabase: browser-only mode
  | 'loading' // first download after login
  | 'needs-migration' // cloud is empty: ask what to do
  | 'synced'
  | 'saving'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  error: string | null;
  uploadLocalData: () => Promise<void>;
  startFresh: () => void;
  retry: () => void;
}

interface Binding<T> {
  spec: TableSpec<T>;
  items: T[];
  set: Dispatch<SetStateAction<T[]>>;
  realtime: boolean;
}

export interface SyncBindings {
  boards: Binding<Board>;
  columns: Binding<Column>;
  tasks: Binding<Task>;
  assignees: Binding<Assignee>;
  tags: Binding<string>;
  timers: Binding<TokenTimer>;
  logs: Binding<ActivityLog>;
}

type AnyBinding = Binding<unknown>;

// Parents before children for upserts (foreign keys); children first for deletes.
const UPSERT_ORDER: (keyof SyncBindings)[] = ['boards', 'columns', 'tasks', 'assignees', 'tags', 'timers', 'logs'];
const DELETE_ORDER: (keyof SyncBindings)[] = ['logs', 'timers', 'tags', 'tasks', 'columns', 'boards', 'assignees'];

const DEBOUNCE_MS = 600;
const RETRY_MS = 10_000;

const fail = (where: string, error: { message: string } | null) => {
  if (error) throw new Error(`${where}: ${error.message}`);
};

/**
 * Keeps the Kanban state in sync with Supabase.
 * The app keeps working on plain React state; this hook mirrors it to the database by diffing
 * against the last known server copy, and applies realtime changes from teammates.
 */
export const useSupabaseSync = (
  enabled: boolean,
  bindings: SyncBindings,
  onFreshStart: () => void,
  onLoaded: (boards: Board[]) => void
): SyncState => {
  const [status, setStatus] = useState<SyncStatus>(enabled ? 'loading' : 'local');
  const [error, setError] = useState<string | null>(null);

  // Latest bindings for async code
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  /** Last state known to be on the server: table → (key → stable JSON row) */
  const snapshots = useRef(new Map<string, Map<string, string>>());
  const writesEnabled = useRef(false);
  const flushTimer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);
  const flushAgain = useRef(false);

  const snapshotOf = (table: string) => {
    let snap = snapshots.current.get(table);
    if (!snap) {
      snap = new Map();
      snapshots.current.set(table, snap);
    }
    return snap;
  };

  // ---------- push local changes ----------
  const flush = useCallback(async () => {
    if (!supabase || !writesEnabled.current) return;
    if (flushing.current) {
      flushAgain.current = true;
      return;
    }
    flushing.current = true;
    try {
      let wrote = false;
      for (const name of UPSERT_ORDER) {
        const { spec, items } = bindingsRef.current[name] as AnyBinding;
        const snap = snapshotOf(spec.table);
        const changed: { key: string; row: Record<string, unknown>; json: string }[] = [];
        for (const item of items) {
          const row = spec.toRow(item);
          const json = stableStringify(row);
          const key = spec.keyOf(item);
          if (snap.get(key) !== json) changed.push({ key, row, json });
        }
        if (changed.length === 0) continue;
        if (!wrote) setStatus('saving');
        wrote = true;
        const { error: err } = await supabase.from(spec.table).upsert(changed.map((c) => c.row));
        fail(`Simpan ${spec.table}`, err);
        changed.forEach((c) => snap.set(c.key, c.json));
      }
      for (const name of DELETE_ORDER) {
        const { spec, items } = bindingsRef.current[name] as AnyBinding;
        const snap = snapshotOf(spec.table);
        const present = new Set(items.map((i) => spec.keyOf(i)));
        const removed = [...snap.keys()].filter((k) => !present.has(k));
        if (removed.length === 0) continue;
        if (!wrote) setStatus('saving');
        wrote = true;
        const { error: err } = await supabase.from(spec.table).delete().in(spec.key, removed);
        fail(`Hapus ${spec.table}`, err);
        removed.forEach((k) => snap.delete(k));
      }
      setStatus('synced');
      setError(null);
    } catch (e) {
      console.error(e);
      setStatus('error');
      setError((e as Error).message);
      window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => flush(), RETRY_MS);
    } finally {
      flushing.current = false;
      if (flushAgain.current) {
        flushAgain.current = false;
        flush();
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => flush(), DEBOUNCE_MS);
  }, [flush]);

  // Any local state change → debounced push
  const { boards, columns, tasks, assignees, tags, timers, logs } = bindings;
  useEffect(() => {
    if (writesEnabled.current) scheduleFlush();
  }, [boards.items, columns.items, tasks.items, assignees.items, tags.items, timers.items, logs.items, scheduleFlush]);

  // Push pending changes before the tab closes / goes to background
  useEffect(() => {
    if (!enabled) return;
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [enabled, flush]);

  // ---------- initial download + realtime ----------
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribeRealtime = useCallback(() => {
    if (!supabase || channelRef.current) return;
    let channel = supabase.channel('kanban-sync');
    (Object.values(bindingsRef.current) as AnyBinding[])
      .filter((b) => b.realtime)
      .forEach(({ spec }) => {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: spec.table },
          (payload) => {
            const binding = (Object.values(bindingsRef.current) as AnyBinding[]).find(
              (b) => b.spec.table === spec.table
            );
            if (!binding) return;
            const snap = snapshotOf(spec.table);
            if (payload.eventType === 'DELETE') {
              const key = String((payload.old as Record<string, unknown>)[spec.key]);
              snap.delete(key);
              binding.set((prev) => prev.filter((i) => spec.keyOf(i) !== key));
            } else {
              const item = spec.fromRow(payload.new as Record<string, unknown>);
              const key = spec.keyOf(item);
              snap.set(key, stableStringify(spec.toRow(item)));
              binding.set((prev) => {
                const idx = prev.findIndex((i) => spec.keyOf(i) === key);
                if (idx === -1) return [...prev, item];
                const next = [...prev];
                next[idx] = item;
                return next;
              });
            }
          }
        );
      });
    channel.subscribe();
    channelRef.current = channel;
  }, []);

  const enableWrites = useCallback(() => {
    writesEnabled.current = true;
    subscribeRealtime();
    flush();
  }, [flush, subscribeRealtime]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setStatus('loading');
    setError(null);
    try {
      const b = bindingsRef.current;
      const results = await Promise.all([
        supabase.from('boards').select('*').order('created_at'),
        supabase.from('columns').select('*').order('sort_order'),
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('assignees').select('*'),
        supabase.from('tags').select('*'),
        supabase.from('token_timers').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      results.forEach((r, i) => fail(`Muat data (${i})`, r.error));
      const [rb, rc, rt, ra, rtg, rtm, rl] = results.map((r) => (r.data ?? []) as Record<string, unknown>[]);

      if (rb.length === 0) {
        // Empty workspace: let the user choose between uploading this browser's data or a fresh start
        setStatus('needs-migration');
        return;
      }

      const apply = <T,>(binding: Binding<T>, rows: Record<string, unknown>[]) => {
        const items = rows.map((r) => binding.spec.fromRow(r));
        const snap = snapshotOf(binding.spec.table);
        snap.clear();
        items.forEach((i) => snap.set(binding.spec.keyOf(i), stableStringify(binding.spec.toRow(i))));
        binding.set(items);
        return items;
      };
      const loadedBoards = apply(b.boards, rb);
      apply(b.columns, rc);
      apply(b.tasks, rt);
      apply(b.assignees, ra);
      apply(b.tags, rtg);
      apply(b.timers, rtm);
      apply(b.logs, rl);
      onLoaded(loadedBoards);

      setStatus('synced');
      enableWrites();
    } catch (e) {
      console.error(e);
      setStatus('error');
      setError((e as Error).message);
    }
  }, [enableWrites, onLoaded]);

  useEffect(() => {
    if (!enabled) return;
    load();
    return () => {
      writesEnabled.current = false;
      window.clearTimeout(flushTimer.current);
      if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ---------- empty-workspace choices ----------
  const uploadLocalData = useCallback(async () => {
    setStatus('saving');
    try {
      // Cover files uploaded earlier live in this browser's IndexedDB → move them to Supabase Storage
      const tasksWithCloudMedia = await migrateLocalMediaToCloud(bindingsRef.current.tasks.items);
      bindingsRef.current.tasks.set(tasksWithCloudMedia);
      snapshots.current.clear();
      // Let React commit the new tasks before the first push
      window.setTimeout(enableWrites, 0);
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }, [enableWrites]);

  const startFresh = useCallback(() => {
    snapshots.current.clear();
    onFreshStart();
    window.setTimeout(enableWrites, 0);
  }, [enableWrites, onFreshStart]);

  const retry = useCallback(() => {
    if (writesEnabled.current) flush();
    else load();
  }, [flush, load]);

  return { status, error, uploadLocalData, startFresh, retry };
};
