import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MediaAttachment } from '../types/kanban';
import { MAX_UPLOAD_MB, mediaFromUrl, saveUpload, useMediaSrc } from '../utils/mediaStore';
import { normalizeUrl } from '../utils/links';
import { Film, ImageOff, LoaderCircle, Maximize2, Upload, X } from 'lucide-react';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Muted looping video that only plays while on screen (saves CPU with many cards). */
const LoopingVideo: React.FC<{ src: string; className?: string }> = ({ src, className }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || prefersReducedMotion()) return;
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? video.play().catch(() => {}) : video.pause()),
      { threshold: 0.25 }
    );
    io.observe(video);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      draggable={false}
      controls={prefersReducedMotion()}
      className={className}
    />
  );
};

/** Large preview overlay. */
const MediaLightbox: React.FC<{ media: MediaAttachment; src: string; title: string; onClose: () => void }> = ({
  media,
  src,
  title,
  onClose,
}) => {
  useEffect(() => {
    // Capture phase + stop: Esc closes only the preview, not the task form behind it
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-10 bg-slate-950/80 backdrop-blur-sm animate-[toast-in_200ms_ease-out]"
      onClick={onClose}
    >
      <figure className="relative max-w-5xl w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {media.kind === 'video' ? (
          <video src={src} autoPlay muted loop playsInline controls className="max-h-[80vh] max-w-full rounded-xl shadow-2xl" />
        ) : (
          <img src={src} alt={title} className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain" />
        )}
        <figcaption className="text-sm font-semibold text-white/90 text-center">{title}</figcaption>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 p-2 rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100"
          title="Tutup (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </figure>
    </div>,
    document.body
  );
};

interface MediaViewProps {
  media: MediaAttachment;
  title: string;
  /** "cover": full-bleed banner at the top of a task card. "preview": framed box in the task form. */
  variant?: 'cover' | 'preview';
  onRemove?: () => void;
  onReplace?: () => void;
  className?: string;
}

/** Task cover: photo / GIF / looping video. Click to enlarge. */
export const MediaView: React.FC<MediaViewProps> = ({
  media,
  title,
  variant = 'preview',
  onRemove,
  onReplace,
  className = '',
}) => {
  const { src, missing } = useMediaSrc(media);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [src]);

  const isCover = variant === 'cover';
  const box = `relative group/media overflow-hidden bg-slate-100 dark:bg-slate-800 ${
    isCover ? 'h-36 rounded-t-xl' : 'h-44 rounded-xl border border-slate-200 dark:border-slate-700'
  } ${className}`;

  if (missing || broken) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-1 text-[11px] text-slate-400`}>
        <ImageOff className="w-4 h-4" />
        {missing ? 'File tidak ada di browser ini' : 'Media gagal dimuat'}
        {onRemove && (
          <button type="button" onClick={onRemove} className="font-semibold text-rose-500 hover:underline">
            Hapus
          </button>
        )}
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`${box} flex items-center justify-center`}>
        <LoaderCircle className="w-4 h-4 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={box}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full h-full cursor-zoom-in"
        title="Klik untuk memperbesar"
      >
        {media.kind === 'video' ? (
          <LoopingVideo src={src} className="w-full h-full object-cover" />
        ) : (
          <img
            src={src}
            alt={title}
            loading="lazy"
            draggable={false}
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        )}
        {/* Lofi mood: soft warm tint + fade into the card */}
        {isCover && (
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-amber-200/10 mix-blend-normal" />
        )}
      </button>

      {/* Overlay actions */}
      <div className="absolute top-1.5 right-1.5 hover-reveal flex gap-1 opacity-0 group-hover/media:opacity-100 focus-within:opacity-100 transition-opacity">
        {media.kind === 'video' && (
          <span className="p-1 rounded-md bg-black/50 text-white" title="Video">
            <Film className="w-3 h-3" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1 rounded-md bg-black/50 text-white hover:bg-black/70"
          title="Perbesar"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
        {onReplace && (
          <button
            type="button"
            onClick={onReplace}
            className="p-1 rounded-md bg-black/50 text-white hover:bg-black/70"
            title="Ganti media"
          >
            <Upload className="w-3 h-3" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-md bg-black/50 text-white hover:bg-rose-600"
            title="Hapus media"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && <MediaLightbox media={media} src={src} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
};

/** Inline picker: paste a URL or upload an image / GIF / video file. */
export const MediaEditor: React.FC<{
  onChange: (media: MediaAttachment) => void;
  onClose: () => void;
  className?: string;
}> = ({ onChange, onClose, className = '' }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyUrl = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) return setError('URL tidak valid.');
    onChange(mediaFromUrl(normalized));
    onClose();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return setError('Hanya file gambar, GIF, atau video.');
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return setError(`Ukuran maksimal ${MAX_UPLOAD_MB} MB.`);
    }
    setUploading(true);
    try {
      onChange(await saveUpload(file));
      onClose();
    } catch {
      setError('Gagal menyimpan file di browser (penyimpanan penuh atau mode privat?).');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`p-2 rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5 ${className}`}
    >
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyUrl();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          placeholder="Tempel URL foto / GIF / video (.mp4, .webm)"
          className="flex-1 min-w-0 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-100 select-text"
        />
        <button
          type="button"
          onClick={applyUrl}
          disabled={!url.trim()}
          className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold"
        >
          Pakai
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
        >
          {uploading ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? 'Menyimpan...' : `Unggah file (maks ${MAX_UPLOAD_MB} MB)`}
        </button>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">
          Batal
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
};
