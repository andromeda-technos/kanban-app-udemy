import React, { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useNow } from '../hooks/useNow';

interface Zone {
  code: 'WIB' | 'WITA' | 'WIT';
  tz: string;
  offset: string;
  region: string;
  /** Browser time zones that count as this zone */
  aliases: string[];
}

const ZONES: Zone[] = [
  { code: 'WIB', tz: 'Asia/Jakarta', offset: 'UTC+7', region: 'Sumatra, Jawa, Kalbar, Kalteng', aliases: ['Asia/Jakarta', 'Asia/Pontianak'] },
  { code: 'WITA', tz: 'Asia/Makassar', offset: 'UTC+8', region: 'Bali, NTB, NTT, Kalsel, Kaltim, Kaltara, Sulawesi', aliases: ['Asia/Makassar'] },
  { code: 'WIT', tz: 'Asia/Jayapura', offset: 'UTC+9', region: 'Maluku & Papua', aliases: ['Asia/Jayapura'] },
];

// One formatter per zone (creating Intl formatters every second is wasteful)
const formatters = ZONES.map(
  (z) =>
    new Intl.DateTimeFormat('id-ID', {
      timeZone: z.tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
);

const partsOf = (fmt: Intl.DateTimeFormat, now: number) => {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { hh: p.hour, mm: p.minute, ss: p.second, day: p.weekday, hour: Number(p.hour) };
};

/** Live clocks for the three Indonesian time zones; the viewer's own zone is highlighted. */
export const IndonesiaClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const now = useNow(1000);
  const localZone = useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return ZONES.find((z) => z.aliases.includes(tz))?.code;
  }, []);

  return (
    <div
      className={`grid grid-cols-3 gap-1.5 sm:gap-2 ${className}`}
      role="group"
      aria-label="Jam wilayah Indonesia"
    >
      {ZONES.map((z, i) => {
        const t = partsOf(formatters[i], now);
        const isDay = t.hour >= 6 && t.hour < 18;
        const isLocal = localZone === z.code;
        return (
          <div
            key={z.code}
            title={`${z.code} (${z.offset}) · ${z.region}`}
            className={`relative min-w-0 rounded-xl border px-2.5 py-1.5 backdrop-blur-sm transition-colors ${
              isLocal
                ? 'border-blue-300 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50'
                : 'border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide">
              {isDay ? (
                <Sun className="w-3 h-3 text-amber-500 shrink-0" />
              ) : (
                <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
              )}
              <span className={isLocal ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}>
                {z.code}
              </span>
              <span className="font-medium text-slate-400 dark:text-slate-500 truncate">
                {isLocal ? '· lokal' : `· ${t.day}`}
              </span>
            </div>
            <div className="font-mono tabular-nums text-sm sm:text-base font-bold leading-tight text-slate-800 dark:text-slate-100">
              {t.hh}:{t.mm}
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500">:{t.ss}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
