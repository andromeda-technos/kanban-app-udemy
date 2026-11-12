import { useLayoutEffect, RefObject } from 'react';

/**
 * FLIP animation (First, Last, Invert, Play) for every element inside `containerRef`
 * that has a `data-column-id` or `data-task-id` attribute.
 *
 * Whenever the DOM inside the container changes (reorder, task moved to another column,
 * drop indicator inserted, card added...), each tracked element glides from where it was
 * on screen to its new place instead of jumping. Newly added elements fade/slide in, and the
 * element that travelled the farthest (usually the one just dropped) gets a small "pop".
 *
 * Positions are keyed by id, so a task card remounted in another column still animates.
 */

const TRACKED_SELECTOR = '[data-column-id], [data-task-id]';
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'; // fast start, soft landing
const MOVE_DURATION = 380;
const DROP_DURATION = 460;
const ENTER_DURATION = 280;
const DROP_POP_MIN_DISTANCE = 40;
const ANIM_IDS = new Set(['flip-move', 'flip-enter']);

type Point = { x: number; y: number };

const keyOf = (el: HTMLElement) =>
  el.dataset.taskId ? `task:${el.dataset.taskId}` : `col:${el.dataset.columnId}`;

/** Translate currently applied to this element alone by a running animation (0,0 when idle). */
const ownOffset = (el: HTMLElement): Point => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(t);
  // Account for the drop "pop" scale (transform-origin is the center) so it isn't mistaken for movement
  return {
    x: m.m41 - ((m.a - 1) * el.offsetWidth) / 2,
    y: m.m42 - ((m.d - 1) * el.offsetHeight) / 2,
  };
};

/** Closest tracked ancestor (a task card's column), if any. */
const trackedParent = (el: HTMLElement): HTMLElement | null =>
  el.parentElement?.closest<HTMLElement>(TRACKED_SELECTOR) ?? null;

/** Total animated offset on screen: the element's own plus its animating column's. */
const visualOffset = (el: HTMLElement): Point => {
  let x = 0;
  let y = 0;
  for (let cur: HTMLElement | null = el; cur; cur = trackedParent(cur)) {
    const o = ownOffset(cur);
    x += o.x;
    y += o.y;
  }
  return { x, y };
};

/** Layout position on screen, ignoring any in-flight animation offsets. */
const layoutPos = (el: HTMLElement): Point => {
  const r = el.getBoundingClientRect();
  const o = visualOffset(el);
  return { x: r.left - o.x, y: r.top - o.y };
};

/**
 * @param pausedRef while `true`, DOM changes are only re-measured, never animated. Used while
 * another library (dnd-kit) is animating the same elements, so both don't fight each other.
 */
export const useFlipAnimation = (
  containerRef: RefObject<HTMLElement | null>,
  pausedRef?: RefObject<boolean>
) => {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tracked = () => Array.from(container.querySelectorAll<HTMLElement>(TRACKED_SELECTOR));

    // Last known layout position of every tracked element
    let positions = new Map<string, Point>();
    const measure = () => {
      const next = new Map<string, Point>();
      tracked().forEach((el) => next.set(keyOf(el), layoutPos(el)));
      positions = next;
    };

    const play = () => {
      if (pausedRef?.current) {
        measure();
        return;
      }
      const els = tracked();

      // FIRST: where each element appears right now = old layout + any in-flight offset
      const first = new Map<HTMLElement, Point>();
      els.forEach((el) => {
        const before = positions.get(keyOf(el));
        if (before) {
          const o = visualOffset(el);
          first.set(el, { x: before.x + o.x, y: before.y + o.y });
        }
      });
      els.forEach((el) =>
        el.getAnimations().forEach((a) => {
          if (ANIM_IDS.has(a.id)) a.cancel();
        })
      );

      // LAST + INVERT: on-screen delta of every element that existed before
      const delta = new Map<HTMLElement, Point>();
      const entering: HTMLElement[] = [];
      els.forEach((el) => {
        const start = first.get(el);
        if (!start) {
          entering.push(el);
          return;
        }
        const end = el.getBoundingClientRect();
        delta.set(el, { x: start.x - end.left, y: start.y - end.top });
      });

      // A card inside a moving column already travels with it, so only animate the remainder
      const moves: { el: HTMLElement; dx: number; dy: number; dist: number }[] = [];
      delta.forEach((d, el) => {
        const parent = trackedParent(el);
        const pd = parent ? delta.get(parent) : undefined;
        const dx = d.x - (pd?.x ?? 0);
        const dy = d.y - (pd?.y ?? 0);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          moves.push({ el, dx, dy, dist: Math.hypot(dx, dy) });
        }
      });

      // PLAY
      if (!reduceMotion) {
        const dropped = moves.reduce<(typeof moves)[number] | null>(
          (best, m) => (m.dist >= DROP_POP_MIN_DISTANCE && (!best || m.dist > best.dist) ? m : best),
          null
        );

        moves.forEach(({ el, dx, dy }) => {
          const isDropped = dropped?.el === el;
          // Whole columns get a subtler lift than single cards
          const lift = el.dataset.columnId ? 1.025 : 1.05;
          const settle = el.dataset.columnId ? 1.01 : 1.02;
          const anim = el.animate(
            isDropped
              ? [
                  { transform: `translate(${dx}px, ${dy}px) scale(${lift})`, zIndex: 20 },
                  { transform: `translate(0, 0) scale(${settle})`, offset: 0.7, zIndex: 20 },
                  { transform: 'translate(0, 0) scale(1)', zIndex: 20 },
                ]
              : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: isDropped ? DROP_DURATION : MOVE_DURATION, easing: EASE_OUT }
          );
          anim.id = 'flip-move';

          if (isDropped) {
            // Soft glow that fades out once it lands
            el.animate(
              [
                { boxShadow: '0 0 0 3px rgba(59,130,246,0.5), 0 20px 40px -12px rgba(15,23,42,0.35)' },
                { boxShadow: '0 0 0 3px rgba(59,130,246,0.35), 0 10px 24px -12px rgba(15,23,42,0.25)', offset: 0.5 },
                { boxShadow: '0 0 0 0 rgba(59,130,246,0), 0 0 0 0 rgba(15,23,42,0)' },
              ],
              { duration: 1000, easing: 'ease-out' }
            );
          }
        });

        entering.forEach((el, i) => {
          const anim = el.animate(
            [
              { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            {
              duration: ENTER_DURATION,
              delay: Math.min(i, 10) * 30,
              easing: EASE_OUT,
              fill: 'backwards',
            }
          );
          anim.id = 'flip-enter';
        });
      }

      measure();
    };

    measure();

    // DOM changes inside the board → animate (MutationObserver runs before the next paint)
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.type === 'childList')) play();
    });
    observer.observe(container, { childList: true, subtree: true });

    // Scrolling/resizing moves things without a reorder: re-measure only, never animate
    // Capture on window catches the page scroll as well as the board's horizontal scroll
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, pausedRef]);
};
