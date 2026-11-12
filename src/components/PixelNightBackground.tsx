import React, { useEffect, useRef } from 'react';

/**
 * Pixel-art night scene behind the board:
 *  - static dithered night sky full of stars (a few twinkle), with an occasional shooting star
 *    (Clawd jumps for joy when one appears → `pixel-shooting-star` window event)
 *  - bottom of the screen: ground, a big tree lit from below, a person resting under it,
 *    and a campfire with pixel flames, a flickering glow and rising embers.
 *
 * Rendered on a low-resolution canvas scaled up with `image-rendering: pixelated`.
 * Static parts are drawn once per resize; only the moving bits are redrawn (~15 fps).
 * Paused while the tab is hidden, a single still frame for `prefers-reduced-motion`.
 */

type RGB = [number, number, number];
type Theme = 'light' | 'dark';

const FPS = 15;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER4[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pack = (c: RGB) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Deterministic random so the scene looks the same after every resize. */
const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PALETTES = {
  dark: {
    sky: ['#03040a', '#05060f', '#070916', '#0a0c1d', '#0d0f24', '#11122a', '#15142e', '#1a1630', '#21182e'].map(hex),
    stars: ['#ffffff', '#cfe0ff', '#fff2cc', '#d9d4ff'].map(hex),
    starDensity: 230,
    starAlpha: 1,
    ground: ['#0a0706', '#0d0907', '#120c09', '#160f0b'].map(hex),
    grass: hex('#0f0b08'),
    leaf: hex('#0a0806'),
    trunk: hex('#100a07'),
    shooting: hex('#ffffff'),
  },
  light: {
    // dawn sky, light enough for dark text on top of it
    sky: ['#dfe5fb', '#e3e4f8', '#e8e3f4', '#eee2ee', '#f3e1e6', '#f7dfdb', '#f9dbcf', '#f8d3c1', '#f3c8ae'].map(hex),
    stars: ['#8b93b8', '#9aa2c7', '#a99fc4'].map(hex),
    starDensity: 1100,
    starAlpha: 0.7,
    ground: ['#2a1d16', '#2f2119', '#33241b', '#3a291f'].map(hex),
    grass: hex('#241811'),
    leaf: hex('#1f1712'),
    trunk: hex('#241a14'),
    shooting: hex('#7c86b5'),
  },
};

const WARM = ['#5c2510', '#7a3213', '#a3461a', '#c9612a', '#e8863b'].map(hex);
const LOG = hex('#3a2214');
const FIRE = ['#000000', '#3b0a05', '#5e1407', '#87210a', '#b0350c', '#d24e0e', '#ec6b14', '#f78a1f', '#fca72e', '#fdc145', '#fed867', '#ffea94', '#fff7cf'].map(hex);
const FIRE_MAX = FIRE.length - 1;

// Person sitting on the ground, facing left (towards the fire)
const PERSON = [
  '..##...',
  '.####..',
  '..##...',
  '.###...',
  '####...',
  '.####..',
  '..####.',
  '.######',
  '##...##',
];

interface Star {
  x: number;
  y: number;
  c: RGB;
  phase: number;
  speed: number;
}

interface Scene {
  W: number;
  H: number;
  groundTop: number;
  /** sky, stars, tree (behind the board) */
  base: Uint32Array;
  /** ground strip, logs, person, trunk foot (in front of the board, transparent elsewhere) */
  front: Uint32Array;
  twinkles: Star[];
  fireX: number;
  fireW: number;
  fireH: number;
  glowR: number;
  starRect: { w: number; h: number };
  palette: (typeof PALETTES)['dark'];
}

// ---------------------------------------------------------------------------
// Static layer
// ---------------------------------------------------------------------------
const buildScene = (W: number, H: number, theme: Theme): Scene => {
  const P = PALETTES[theme];
  const rand = mulberry(20241112);
  const base = new Uint32Array(W * H);
  const front = new Uint32Array(W * H); // 0 = fully transparent
  const groundH = Math.max(10, Math.round(H * 0.06));
  const groundTop = H - groundH;

  const get = (x: number, y: number): RGB => {
    const v = base[y * W + x];
    return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];
  };
  const set = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    base[(y | 0) * W + (x | 0)] = pack(c);
  };
  const setFront = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    front[(y | 0) * W + (x | 0)] = pack(c);
  };
  const blend = (x: number, y: number, c: RGB, a: number) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = get(x, y);
    set(x, y, [o[0] + (c[0] - o[0]) * a, o[1] + (c[1] - o[1]) * a, o[2] + (c[2] - o[2]) * a].map(Math.round) as RGB);
  };

  // Sky: banded gradient with ordered dithering between bands
  const bands = P.sky;
  for (let y = 0; y < groundTop; y++) {
    const f = (y / groundTop) * (bands.length - 1);
    const i = Math.floor(f);
    const frac = f - i;
    for (let x = 0; x < W; x++) {
      const c = frac > bayer(x, y) ? bands[Math.min(i + 1, bands.length - 1)] : bands[i];
      base[y * W + x] = pack(c);
    }
  }

  // Stars
  const twinkles: Star[] = [];
  const starCount = Math.round((W * groundTop) / P.starDensity);
  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * groundTop * 0.9);
    const c = P.stars[Math.floor(rand() * P.stars.length)];
    const roll = rand();
    if (roll < 0.12) {
      twinkles.push({ x, y, c, phase: rand() * Math.PI * 2, speed: 0.6 + rand() * 1.6 });
    } else if (roll < 0.16) {
      // bigger "plus" star
      blend(x, y, c, P.starAlpha);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(x + dx, y + dy, c, 0.35 * P.starAlpha);
    } else {
      blend(x, y, c, (0.25 + rand() * 0.7) * P.starAlpha);
    }
  }

  // Ground with speckles and grass tufts (front layer)
  for (let y = groundTop; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = rand();
      setFront(x, y, P.ground[r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3]);
    }
  }
  for (let x = 0; x < W; x++) {
    if (rand() < 0.4) {
      const h = 1 + Math.floor(rand() * 3);
      for (let k = 1; k <= h; k++) setFront(x, groundTop - k, P.grass);
    }
  }

  // Layout (scales with the screen; phones get a smaller tree)
  const u = Math.min(W, H * 1.25);
  const r = Math.max(22, u * 0.17);
  const treeX = Math.round(W - r * 0.55);
  const canopyY = Math.round(groundTop - r * 1.5);
  const fireX = Math.round(clamp(treeX - r * 1.75, W * 0.3, W));
  const fireW = Math.max(7, Math.round(r * 0.17));
  const fireH = Math.round(fireW * 1.9);
  const glowR = r * 1.35;

  const warmth = (x: number, y: number) => {
    const d = Math.hypot(x - fireX, (y - groundTop) * 1.1);
    return clamp(1 - d / (r * 3.3)) ** 1.4;
  };

  // Trunk + branches
  const thickLine = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const w = w0 + (w1 - w0) * t;
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        for (let dy = -Math.ceil(w); dy <= Math.ceil(w); dy++) {
          if (dx * dx + dy * dy > w * w) continue;
          const px = Math.round(cx + dx);
          const py = Math.round(cy + dy);
          // the side facing the fire catches some light
          const lit = dx < 0 && rand() < warmth(px, py) * 1.1;
          const c = lit ? WARM[Math.min(WARM.length - 1, Math.floor(warmth(px, py) * 4))] : P.trunk;
          set(px, py, c);
          if (py >= groundTop - 3) setFront(px, py, c); // the foot of the trunk stands on the ground
        }
      }
    }
  };
  const topX = treeX - r * 0.18;
  const topY = canopyY + r * 0.25;
  const tw = Math.max(2, r / 14);
  thickLine(treeX + r * 0.12, H, topX, topY, tw * 1.3, tw * 0.7);
  for (const [bx, by] of [
    [-0.8, -0.15],
    [-0.35, -0.65],
    [0.35, -0.55],
    [0.85, -0.05],
    [-1.05, 0.25],
  ]) {
    thickLine(topX, topY, treeX + bx * r, canopyY + by * r, tw * 0.55, 0.6);
  }

  // Foliage: overlapping ragged blobs, speckled with holes and warm firelight
  const leafMask = new Uint8Array(W * H);
  for (let i = 0; i < 30; i++) {
    const cx = treeX + (rand() * 2 - 1) * r * 1.05;
    const cy = canopyY + (rand() * 2 - 1.2) * r * 0.55;
    const br = r * (0.2 + rand() * 0.26);
    for (let y = Math.floor(cy - br); y <= cy + br; y++) {
      for (let x = Math.floor(cx - br * 1.3); x <= cx + br * 1.3; x++) {
        if (x < 0 || y < 0 || x >= W || y >= groundTop) continue;
        const d = Math.hypot((x - cx) / 1.3, y - cy);
        if (d < br * (0.75 + rand() * 0.35)) leafMask[y * W + x] = 1;
      }
    }
  }
  for (let y = 0; y < groundTop; y++) {
    for (let x = 0; x < W; x++) {
      if (!leafMask[y * W + x] || rand() < 0.16) continue;
      const w = warmth(x, y) * (y > canopyY - r * 0.2 ? 1 : 0.55); // lower leaves get more light
      if (rand() < w * 0.95) set(x, y, WARM[Math.min(WARM.length - 1, Math.floor(w * 5.5 * rand()))]);
      else set(x, y, P.leaf);
    }
  }

  // Logs under the fire
  for (let k = -Math.round(fireW * 0.6); k <= Math.round(fireW * 0.6); k++) {
    setFront(fireX + k, groundTop - 1 + Math.round(k * 0.15), LOG);
    setFront(fireX + k, groundTop - 1 - Math.round(k * 0.15), LOG);
  }

  // Person resting under the tree, rim-lit on the fire side
  const scale = r > 45 ? 2 : 1;
  const px0 = Math.round(fireX + fireW * 0.75 + 2 * scale);
  const py0 = groundTop - PERSON.length * scale;
  PERSON.forEach((row, ry) => {
    const first = row.indexOf('#');
    [...row].forEach((ch, rx) => {
      if (ch !== '#') return;
      const c = rx === first ? WARM[4] : rx === first + 1 ? WARM[1] : P.trunk;
      for (let sx = 0; sx < scale; sx++) for (let sy = 0; sy < scale; sy++) setFront(px0 + rx * scale + sx, py0 + ry * scale + sy, c);
    });
  });

  return {
    W,
    H,
    groundTop,
    base,
    front,
    twinkles,
    fireX,
    fireW,
    fireH,
    glowR,
    starRect: { w: W, h: Math.round(groundTop * 0.6) },
    palette: P,
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const PixelNightBackground: React.FC<{ theme: Theme }> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frontCanvas = frontRef.current;
    const ctx = canvas?.getContext('2d');
    const fctx = frontCanvas?.getContext('2d');
    if (!canvas || !ctx || !frontCanvas || !fctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let scene: Scene;
    let img: ImageData;
    let frame: Uint32Array;
    let fimg: ImageData;
    let fframe: Uint32Array;
    let fire: Uint8Array;
    let embers: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShootingAt = performance.now() + 5000 + Math.random() * 6000;
    let raf = 0;
    let last = 0;
    let t = 0;

    const setup = () => {
      const px = window.innerWidth >= 768 ? 3 : 2;
      const W = Math.ceil(window.innerWidth / px);
      const H = Math.ceil(window.innerHeight / px);
      canvas.width = frontCanvas.width = W;
      canvas.height = frontCanvas.height = H;
      scene = buildScene(W, H, theme);
      img = ctx.createImageData(W, H);
      frame = new Uint32Array(img.data.buffer);
      fimg = fctx.createImageData(W, H);
      fframe = new Uint32Array(fimg.data.buffer);
      // Lets Clawd stand on the ground strip
      document.documentElement.style.setProperty('--pixel-ground-h', `${(H - scene.groundTop) * px}px`);
      fire = new Uint8Array(scene.fireW * scene.fireH);
      embers = [];
    };

    const add = (buf: Uint32Array, x: number, y: number, c: RGB, a: number) => {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= scene.W || y >= scene.H || a <= 0) return;
      const i = y * scene.W + x;
      const v = buf[i];
      if (v >>> 24 === 0) return; // nothing to light up on a transparent pixel
      const r = Math.min(255, (v & 255) + c[0] * a);
      const g = Math.min(255, ((v >>> 8) & 255) + c[1] * a);
      const b = Math.min(255, ((v >>> 16) & 255) + c[2] * a);
      buf[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    };
    const put = (buf: Uint32Array, x: number, y: number, c: RGB) => {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= scene.W || y >= scene.H) return;
      buf[y * scene.W + x] = pack(c);
    };
    const mix = (buf: Uint32Array, x: number, y: number, c: RGB, a: number) => {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= scene.W || y >= scene.H || a <= 0) return;
      const i = y * scene.W + x;
      const v = buf[i];
      if (v >>> 24 === 0) {
        // transparent (front layer) -> a semi-transparent pixel of that colour
        buf[i] = ((Math.round(clamp(a) * 255) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
        return;
      }
      const o: RGB = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];
      buf[i] = pack([0, 1, 2].map((k) => Math.round(o[k] + (c[k] - o[k]) * a)) as RGB);
    };

    const stepFire = () => {
      const { fireW: fw, fireH: fh } = scene;
      const mid = (fw - 1) / 2;
      for (let x = 0; x < fw; x++) {
        const centre = 1 - Math.abs(x - mid) / (mid + 1);
        fire[(fh - 1) * fw + x] = Math.round(FIRE_MAX * (0.45 + 0.55 * centre) * (0.8 + Math.random() * 0.2));
      }
      for (let y = 0; y < fh - 1; y++) {
        for (let x = 0; x < fw; x++) {
          const src = fire[(y + 1) * fw + x];
          const rnd = Math.random();
          const decay = rnd < 0.25 ? 0 : rnd < 0.8 ? 1 : 2;
          const dst = Math.min(fw - 1, Math.max(0, x + (Math.random() < 0.5 ? -1 : Math.random() < 0.5 ? 1 : 0)));
          fire[y * fw + dst] = Math.max(0, src - decay);
        }
      }
    };

    const render = (now: number) => {
      t += 1 / FPS;
      frame.set(scene.base);
      fframe.set(scene.front);
      const { groundTop, fireX, fireW, fireH, glowR, W } = scene;

      // Twinkling stars
      for (const s of scene.twinkles) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(t * s.speed + s.phase));
        mix(frame, s.x, s.y, s.c, a * scene.palette.starAlpha);
      }

      // Firelight glow (banded + dithered so it stays pixel-y)
      const flicker = 0.82 + 0.12 * Math.sin(t * 9) + Math.random() * 0.1;
      const R = glowR * (0.95 + Math.random() * 0.06);
      const gy = groundTop - 2;
      for (let y = Math.floor(gy - R / 1.4); y <= Math.min(scene.H - 1, gy + R / 2.2); y++) {
        for (let x = Math.floor(fireX - R); x <= fireX + R; x++) {
          const d = Math.hypot(x - fireX, (y - gy) * (y > gy ? 2.2 : 1.4)) / R;
          if (d >= 1) continue;
          const strength = (1 - d) ** 2 * 0.5 * flicker;
          const level = Math.floor(strength * 5 + bayer(x, y)) / 5;
          if (level > 0) add(y >= groundTop - 3 ? fframe : frame, x, y, [255, 110, 35], level);
        }
      }

      // Flames
      if (!reduced) stepFire();
      for (let y = 0; y < fireH; y++) {
        for (let x = 0; x < fireW; x++) {
          const v = fire[y * fireW + x];
          if (v > 1) put(fframe, fireX - Math.floor(fireW / 2) + x, groundTop - fireH + y - 1, FIRE[v]);
        }
      }

      // Embers drifting up
      if (Math.random() < 0.45) {
        embers.push({
          x: fireX + (Math.random() - 0.5) * fireW * 0.6,
          y: groundTop - fireH * 0.7,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.5 + Math.random() * 0.8),
          life: 0,
          max: 12 + Math.random() * 18,
        });
      }
      embers = embers.filter((e) => {
        e.life++;
        e.x += e.vx + Math.sin((t + e.max) * 3) * 0.2;
        e.y += e.vy;
        const a = 1 - e.life / e.max;
        if (a <= 0) return false;
        mix(fframe, e.x, e.y, e.life < 4 ? FIRE[11] : FIRE[8], a);
        return true;
      });

      // Shooting star
      if (!shooting && now >= nextShootingAt) {
        const fromLeft = Math.random() < 0.5;
        shooting = {
          x: fromLeft ? Math.random() * W * 0.5 : W * 0.5 + Math.random() * W * 0.5,
          y: Math.random() * scene.starRect.h * 0.5,
          vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 1.5),
          vy: 1.2 + Math.random() * 0.8,
          life: 16 + Math.floor(Math.random() * 8),
        };
        nextShootingAt = now + 12000 + Math.random() * 18000;
        window.dispatchEvent(new CustomEvent('pixel-shooting-star'));
      }
      if (shooting) {
        const s = shooting;
        const len = 10;
        for (let k = 0; k < len; k++) {
          mix(frame, s.x - (s.vx * k) / 2, s.y - (s.vy * k) / 2, scene.palette.shooting, (1 - k / len) * Math.min(1, s.life / 6));
        }
        s.x += s.vx;
        s.y += s.vy;
        if (--s.life <= 0) shooting = null;
      }

      ctx.putImageData(img, 0, 0);
      fctx.putImageData(fimg, 0, 0);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / FPS) return;
      last = now;
      render(now);
    };

    setup();
    if (reduced) {
      for (let i = 0; i < 30; i++) stepFire();
      render(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        setup();
        if (reduced) render(0);
      }, 150);
    };
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.documentElement.style.removeProperty('--pixel-ground-h');
    };
  }, [theme]);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full [image-rendering:pixelated]" />
      </div>
      {/* Ground strip with the campfire scene sits above the board (clicks pass through) */}
      <canvas
        ref={frontRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-20 w-full h-full [image-rendering:pixelated]"
      />
    </>
  );
};
