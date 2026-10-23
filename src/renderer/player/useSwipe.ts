import { useRef, type PointerEvent, type WheelEvent } from "react";

/** how far a swipe goes before it counts, in pixels */
const SWIPE_PX = 70;
/** one swipe at a time: trackpads keep sending events for a while after the gesture */
const COOLDOWN_MS = 700;

export type SwipeDirection = "next" | "previous";

/** Sums a horizontal trackpad gesture; says when it has gone far enough, and which way. */
export function swipeFrom(total: number, deltaX: number, deltaY: number): { total: number; direction?: SwipeDirection } {
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return { total: 0 };
  const sum = total + deltaX;
  if (Math.abs(sum) < SWIPE_PX) return { total: sum };
  return { total: 0, direction: sum > 0 ? "next" : "previous" };
}

/**
 * Swiping the now-playing bar changes track (Apple Music, iOS 26.1): a two-finger swipe on the trackpad,
 * or a drag with the mouse. A drag that swiped does not also count as a click.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const total = useRef(0);
  const last = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const fire = (direction: SwipeDirection) => {
    const now = Date.now();
    if (now - last.current < COOLDOWN_MS) return;
    last.current = now;
    onSwipe(direction);
  };

  return {
    onWheel: (event: WheelEvent) => {
      const step = swipeFrom(total.current, event.deltaX, event.deltaY);
      total.current = step.total;
      if (step.direction) fire(step.direction);
    },
    onPointerDown: (event: PointerEvent) => {
      start.current = { x: event.clientX, y: event.clientY };
      swiped.current = false;
    },
    onPointerUp: (event: PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = event.clientX - from.x;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(event.clientY - from.y) < 40) {
        swiped.current = true;
        // dragging to the left brings the next track in, as on a phone
        fire(dx < 0 ? "next" : "previous");
      }
    },
    onClickCapture: (event: { stopPropagation(): void; preventDefault(): void }) => {
      if (!swiped.current) return;
      swiped.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
