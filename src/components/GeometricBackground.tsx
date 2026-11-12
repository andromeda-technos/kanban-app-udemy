import React, { useEffect, useRef } from 'react';

/**
 * Decorative animated background: slowly drifting / rotating outline shapes joined by faint
 * "constellation" lines, over soft colour glows and a dot grid.
 *
 * - Fixed behind all content, `pointer-events: none` → never intercepts clicks or drags.
 * - ~30 fps, paused while the tab is hidden, static for `prefers-reduced-motion`.
 */

type ShapeKind = 'triangle' | 'square' | 'hexagon' | 'circle' | 'diamond';

interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  kind: ShapeKind;
  hue: number; // index into palette
}

const KINDS: ShapeKind[] = ['triangle', 'square', 'hexagon', 'circle', 'diamond'];
const FRAME_MS = 1000 / 30;
const LINK_DISTANCE = 190;

const PALETTES = {
  light: {
    shapes: ['59,130,246', '139,92,246', '6,182,212', '99,102,241'], // blue, violet, cyan, indigo
    shapeAlpha: 0.22,
    lineAlpha: 0.1,
  },
  dark: {
    shapes: ['96,165,250', '167,139,250', '34,211,238', '129,140,248'],
    shapeAlpha: 0.2,
    lineAlpha: 0.09,
  },
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const makeShape = (w: number, h: number): Shape => ({
  x: rand(0, w),
  y: rand(0, h),
  vx: rand(-0.18, 0.18),
  vy: rand(-0.14, 0.14),
  size: rand(10, 34),
  angle: rand(0, Math.PI * 2),
  spin: rand(-0.0025, 0.0025),
  kind: KINDS[Math.floor(Math.random() * KINDS.length)],
  hue: Math.floor(Math.random() * 4),
});

const polygon = (ctx: CanvasRenderingContext2D, sides: number, r: number, offset = 0) => {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = offset + (i / sides) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

const drawShape = (ctx: CanvasRenderingContext2D, s: Shape) => {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  switch (s.kind) {
    case 'triangle':
      polygon(ctx, 3, s.size, -Math.PI / 2);
      break;
    case 'square':
      polygon(ctx, 4, s.size, Math.PI / 4);
      break;
    case 'diamond':
      ctx.scale(0.7, 1);
      polygon(ctx, 4, s.size, 0);
      break;
    case 'hexagon':
      polygon(ctx, 6, s.size, 0);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, s.size * 0.8, 0, Math.PI * 2);
      break;
  }
  ctx.stroke();
  ctx.restore();
};

export const GeometricBackground: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let shapes: Shape[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with screen area (fewer shapes on phones)
      const target = Math.max(10, Math.min(38, Math.round((width * height) / 48000)));
      if (shapes.length > target) shapes = shapes.slice(0, target);
      while (shapes.length < target) shapes.push(makeShape(width, height));
      shapes.forEach((s) => {
        s.x = Math.min(s.x, width);
        s.y = Math.min(s.y, height);
      });
    };

    const draw = () => {
      const palette = PALETTES[themeRef.current];
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      // Constellation lines between nearby shapes, fading with distance
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i];
          const b = shapes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            const alpha = palette.lineAlpha * (1 - dist / LINK_DISTANCE);
            ctx.strokeStyle = `rgba(${palette.shapes[a.hue]},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.lineWidth = 1.4;
      shapes.forEach((s) => {
        ctx.strokeStyle = `rgba(${palette.shapes[s.hue]},${palette.shapeAlpha})`;
        drawShape(ctx, s);
      });
    };

    const step = () => {
      shapes.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.angle += s.spin;
        // Wrap around the edges with a margin so shapes glide in/out smoothly
        const m = s.size * 2;
        if (s.x < -m) s.x = width + m;
        if (s.x > width + m) s.x = -m;
        if (s.y < -m) s.y = height + m;
        if (s.y > height + m) s.y = -m;
      });
    };

    resize();
    draw();

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      step();
      draw();
    };

    const start = () => {
      if (!reduceMotion && !raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => {
      resize();
      draw();
    };

    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Redraw immediately on theme switch when the loop isn't running (reduced motion)
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [theme]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Soft drifting colour glows */}
      <div className="geo-glow geo-glow-1" />
      <div className="geo-glow geo-glow-2" />
      <div className="geo-glow geo-glow-3" />
      {/* Faint dot grid, fading towards the edges */}
      <div className="geo-grid absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
