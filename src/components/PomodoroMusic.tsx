import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Coffee, ListMusic, Music2, Pause, Play, Plus, SkipForward, Trash2, Volume2, VolumeX } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
type Slot = 'focus' | 'rest';

export interface Track {
  id: string;
  url: string;
  videoId?: string;
  listId?: string;
  title: string;
}

interface MusicState {
  enabled: boolean;
  volume: number;
  muted: boolean;
  focus: Track[];
  rest: Track[];
}

const KEY = 'kanban_pomodoro_music_v1';
const DEFAULT_STATE: MusicState = { enabled: true, volume: 60, muted: false, focus: [], rest: [] };

const loadState = (): MusicState => {
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(localStorage.getItem(KEY) || 'null') ?? {}) };
  } catch {
    return DEFAULT_STATE;
  }
};

/** Accepts watch / youtu.be / shorts / live / embed / music.youtube / playlist links. */
export const parseYouTube = (raw: string): { videoId?: string; listId?: string } | null => {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (!['youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
  const listId = url.searchParams.get('list') ?? undefined;
  let videoId: string | undefined;
  if (host === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0];
  else if (url.searchParams.get('v')) videoId = url.searchParams.get('v')!;
  else {
    const m = url.pathname.match(/^\/(shorts|live|embed)\/([\w-]{6,})/);
    if (m) videoId = m[2];
  }
  if (videoId && !/^[\w-]{6,}$/.test(videoId)) videoId = undefined;
  if (!videoId && !listId) return null;
  return { videoId, listId };
};

const fetchTitle = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()).title ?? null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// YouTube IFrame API
// ---------------------------------------------------------------------------
let ytReady: Promise<any> | null = null;
const loadYT = () =>
  (ytReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      ytReady = null;
      reject(new Error('Gagal memuat YouTube'));
    };
    document.head.appendChild(s);
  }));

const SLOT_META: Record<Slot, { label: string; icon: typeof Brain; chip: string }> = {
  focus: { label: 'Musik Fokus', icon: Brain, chip: 'text-rose-600 dark:text-rose-300' },
  rest: { label: 'Musik Rehat', icon: Coffee, chip: 'text-emerald-600 dark:text-emerald-300' },
};

// ---------------------------------------------------------------------------
// Component (mounted for as long as the Pomodoro widget exists, so music keeps playing)
// ---------------------------------------------------------------------------
export const PomodoroMusic: React.FC<{ phase: 'work' | 'break' | 'long'; running: boolean }> = ({ phase, running }) => {
  const [music, setMusic] = useState<MusicState>(loadState);
  const [tab, setTab] = useState<Slot>(phase === 'work' ? 'focus' : 'rest');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [nowTitle, setNowTitle] = useState('');
  const [playerError, setPlayerError] = useState('');

  const slot: Slot = phase === 'work' ? 'focus' : 'rest';
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const indexRef = useRef<Record<Slot, number>>({ focus: 0, rest: 0 });
  const loadedRef = useRef<string>(''); // `${slot}:${trackId}` currently in the player
  const [failed, setFailed] = useState<Set<string>>(() => new Set()); // tracks YouTube refused to play
  const failedRef = useRef(failed);
  const wantPlayRef = useRef(false); // was the last request "play"? (used when skipping a broken track)
  failedRef.current = failed;
  const live = useRef({ slot, music, running });
  live.current = { slot, music, running };

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(music));
    } catch {
      /* ignore */
    }
  }, [music]);

  // Follow the phase in the editor tab too
  useEffect(() => setTab(slot), [slot]);

  // ---- player ----------------------------------------------------------------
  const currentTrack = (s: Slot = live.current.slot): Track | undefined => {
    const list = live.current.music[s];
    if (!list.length) return undefined;
    return list[indexRef.current[s] % list.length];
  };

  const loadTrack = useCallback((s: Slot, autoplay: boolean) => {
    const p = playerRef.current;
    const track = currentTrack(s);
    if (!p || !track) return;
    setPlayerError('');
    wantPlayRef.current = autoplay;
    loadedRef.current = `${s}:${track.id}`;
    setNowTitle(track.title);
    if (track.listId && !track.videoId) {
      const args = { listType: 'playlist', list: track.listId, index: 0 };
      if (autoplay) p.loadPlaylist(args);
      else p.cuePlaylist(args);
    } else if (track.listId && track.videoId) {
      // video opened from a playlist → play the whole playlist
      const args = { listType: 'playlist', list: track.listId, index: 0 };
      if (autoplay) p.loadPlaylist(args);
      else p.cuePlaylist(args);
    } else if (track.videoId) {
      if (autoplay) p.loadVideoById(track.videoId);
      else p.cueVideoById(track.videoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Next playable track (skips ones that failed); returns false when none is left. */
  const next = useCallback(
    (s: Slot = live.current.slot, autoplay = true) => {
      const list = live.current.music[s];
      for (let step = 1; step <= list.length; step++) {
        const i = (indexRef.current[s] + step) % list.length;
        if (failedRef.current.has(list[i].id)) continue;
        indexRef.current[s] = i;
        loadTrack(s, autoplay);
        return true;
      }
      return false;
    },
    [loadTrack]
  );

  // Create the player once (lazily, the first time music is turned on)
  useEffect(() => {
    if (!music.enabled || playerRef.current || !hostRef.current) return;
    let cancelled = false;
    loadYT()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        const el = document.createElement('div'); // YT replaces this node with its iframe
        hostRef.current.appendChild(el);
        playerRef.current = new YT.Player(el, {
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              playerRef.current.setVolume(live.current.music.volume);
              if (live.current.music.muted) playerRef.current.mute();
              setReady(true);
            },
            onStateChange: (e: any) => {
              const S = window.YT.PlayerState;
              setPlaying(e.data === S.PLAYING);
              if (e.data === S.PLAYING) {
                const t = playerRef.current?.getVideoData?.().title;
                if (t) setNowTitle(t);
              }
              if (e.data === S.ENDED) {
                const p = playerRef.current;
                const list: string[] | null = p?.getPlaylist?.() ?? null;
                const idx: number = p?.getPlaylistIndex?.() ?? -1;
                // Inside a YouTube playlist: only move on after its last video
                if (list && list.length > 1 && idx < list.length - 1) return;
                next(live.current.slot, true);
              }
            },
            onError: (e: any) => {
              const code = e?.data;
              const reason =
                code === 101 || code === 150
                  ? 'diblokir pemiliknya untuk diputar di luar YouTube, atau sudah tidak tersedia'
                  : code === 100
                  ? 'tidak ditemukan atau privat'
                  : 'gagal diputar';
              const bad = loadedRef.current.split(':')[1];
              const s = live.current.slot;
              if (bad) setFailed((prev) => new Set(prev).add(bad));
              if (bad) failedRef.current = new Set(failedRef.current).add(bad);
              window.setTimeout(() => {
                const moved = next(s, wantPlayRef.current || live.current.running);
                setPlayerError(
                  moved
                    ? `Lagu tadi ${reason}. Lanjut ke berikutnya.`
                    : `Lagu ${reason}. Tidak ada lagu lain yang bisa diputar di playlist ini.`
                );
              }, 1200);
            },
          },
        });
      })
      .catch((err: Error) => setPlayerError(err.message));
    return () => {
      cancelled = true;
    };
  }, [music.enabled, next]);

  // Follow the timer: right playlist for the phase, play while running, pause when paused
  const trackKey = music[slot].map((t) => t.id).join(',');
  useEffect(() => {
    // Track list edited → give every remaining track a fresh chance
    setFailed(new Set());
    setPlayerError('');
  }, [trackKey]);
  useEffect(() => {
    const p = playerRef.current;
    if (!ready || !p) return;
    if (!music.enabled || music[slot].length === 0) {
      p.pauseVideo?.();
      if (music[slot].length === 0) setNowTitle('');
      return;
    }
    const track = currentTrack(slot);
    const wanted = `${slot}:${track?.id}`;
    if (loadedRef.current !== wanted) loadTrack(slot, running);
    else if (running) p.playVideo();
    else p.pauseVideo();
    wantPlayRef.current = running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slot, running, music.enabled, trackKey]);

  // Volume / mute
  useEffect(() => {
    const p = playerRef.current;
    if (!ready || !p) return;
    p.setVolume(music.volume);
    if (music.muted) p.mute();
    else p.unMute();
  }, [ready, music.volume, music.muted]);

  // ---- editing ---------------------------------------------------------------
  const addTrack = async () => {
    const parsed = parseYouTube(input);
    if (!parsed) {
      setInputError('Link YouTube tidak dikenali. Contoh: https://youtu.be/... atau https://www.youtube.com/playlist?list=...');
      return;
    }
    const url = input.trim();
    const id = `yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const placeholder = parsed.listId && !parsed.videoId ? 'Playlist YouTube' : 'Video YouTube';
    const target = tab;
    setMusic((m) => ({ ...m, [target]: [...m[target], { id, url, ...parsed, title: placeholder }] }));
    setInput('');
    setInputError('');
    const title = await fetchTitle(url);
    if (title) {
      setMusic((m) => ({ ...m, [target]: m[target].map((t) => (t.id === id ? { ...t, title } : t)) }));
    }
  };

  const removeTrack = (s: Slot, id: string) =>
    setMusic((m) => {
      const list = m[s].filter((t) => t.id !== id);
      if (indexRef.current[s] >= list.length) indexRef.current[s] = 0;
      if (loadedRef.current === `${s}:${id}`) loadedRef.current = '';
      return { ...m, [s]: list };
    });

  const playTrackAt = (s: Slot, i: number) => {
    indexRef.current[s] = i;
    if (s === slot) loadTrack(s, true);
  };

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    wantPlayRef.current = !playing;
    if (playing) p.pauseVideo();
    else if (loadedRef.current.startsWith(`${slot}:`)) p.playVideo();
    else loadTrack(slot, true);
  };

  const list = music[tab];
  const activeList = music[slot];
  const SlotIcon = SLOT_META[slot].icon;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Music2 className="w-4 h-4 text-violet-500" />
          Musik
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={music.enabled}
          onClick={() => setMusic((m) => ({ ...m, enabled: !m.enabled }))}
          className={`relative w-8 h-4.5 rounded-full transition-colors ${music.enabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}
          title={music.enabled ? 'Matikan musik' : 'Nyalakan musik'}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${music.enabled ? 'left-4' : 'left-0.5'}`}
          />
        </button>
      </div>

      {/* Player stays mounted (hidden when music is off) so it never reloads */}
      <div className={music.enabled ? 'px-3 pb-3 space-y-2.5' : 'hidden'}>
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900">
          <div ref={hostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
          {activeList.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4 text-[11px] text-slate-400">
              <ListMusic className="w-5 h-5" />
              Belum ada lagu untuk {SLOT_META[slot].label.toLowerCase()}. Tempel link YouTube di bawah.
            </div>
          )}
        </div>

        {/* Now playing + controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!ready || activeList.length === 0}
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40"
            title={playing ? 'Jeda musik' : 'Putar musik'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => next(slot, true)}
            disabled={!ready || activeList.length < 2}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 disabled:opacity-40"
            title="Lagu berikutnya"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1 text-[10px] font-bold ${SLOT_META[slot].chip}`}>
              <SlotIcon className="w-3 h-3" />
              {SLOT_META[slot].label}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{nowTitle || '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => setMusic((m) => ({ ...m, muted: !m.muted }))}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title={music.muted ? 'Bunyikan' : 'Bisukan'}
          >
            {music.muted || music.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={music.volume}
            onChange={(e) => setMusic((m) => ({ ...m, volume: Number(e.target.value), muted: false }))}
            className="w-16 accent-violet-600"
            aria-label="Volume musik"
          />
        </div>
        {playerError && <p className="text-[10px] text-amber-600 dark:text-amber-400">{playerError}</p>}

        {/* Playlists */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(['focus', 'rest'] as Slot[]).map((s) => {
            const M = SLOT_META[s];
            const Icon = M.icon;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setTab(s)}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                  tab === s ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500'
                }`}
              >
                <Icon className="w-3 h-3" />
                {M.label}
                <span className="text-slate-400">{music[s].length}</span>
              </button>
            );
          })}
        </div>

        {list.length > 0 && (
          <ul className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {list.map((t, i) => {
              const isNow = loadedRef.current === `${tab}:${t.id}`;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 p-1.5 rounded-lg ${
                    isNow ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {t.videoId ? (
                    <img
                      src={`https://i.ytimg.com/vi/${t.videoId}/default.jpg`}
                      alt=""
                      className="w-10 h-7 shrink-0 rounded object-cover bg-slate-200 dark:bg-slate-700"
                    />
                  ) : (
                    <span className="w-10 h-7 shrink-0 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <ListMusic className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => playTrackAt(tab, i)}
                    disabled={tab !== slot}
                    className="min-w-0 flex-1 text-left text-[11px] text-slate-700 dark:text-slate-200 truncate enabled:hover:text-violet-600"
                    title={tab === slot ? 'Putar sekarang' : t.title}
                  >
                    {isNow && '♪ '}
                    {t.title}
                    {failed.has(t.id) && <span className="block text-[10px] text-rose-500">tidak bisa diputar</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrack(tab, t.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Hapus dari playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTrack();
              }
            }}
            placeholder={`Tempel link YouTube untuk ${SLOT_META[tab].label.toLowerCase()}...`}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="button"
            onClick={addTrack}
            disabled={!input.trim()}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah
          </button>
        </div>
        {inputError && <p className="text-[10px] text-rose-500">{inputError}</p>}
        <p className="text-[10px] text-slate-400">
          Bisa link video, playlist, atau live. Lagu fokus diputar saat fokus, lagu rehat saat rehat, berulang terus.
        </p>
      </div>
    </div>
  );
};
