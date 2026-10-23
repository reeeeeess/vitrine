import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";

/** A title too long for its place glides to its end and back, with a pause at each end (Apple Music). */
export function Marquee({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const overflow = (inner.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0);
      setShift(overflow > 4 ? overflow + 12 : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span
      ref={box}
      className={cn("marquee-box block overflow-hidden whitespace-nowrap", shift > 0 && "[mask-image:linear-gradient(to_right,transparent,black_3%,black_95%,transparent)]", className)}
      title={shift ? text : undefined}
    >
      <span
        ref={inner}
        className={cn("inline-block", shift > 0 && "marquee")}
        style={shift ? ({ "--shift": `-${shift}px`, animationDuration: `${6 + shift / 25}s` } as CSSProperties) : undefined}
      >
        {text}
      </span>
    </span>
  );
}
