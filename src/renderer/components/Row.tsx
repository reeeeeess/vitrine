import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * A titled, horizontally scrolling row with arrows, as on Movix's home page: its number in mono
 * above the title as on mysticsaba.com ("01 / ÉCOUTE"), and Movix's short accent line below.
 */
export function Row({ title, number, kicker, action, children }: { title: string; number?: number; kicker?: string; action?: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: "smooth" });
  };
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/80 transition-colors hover:bg-white/15 hover:text-white";
  return (
    <section className="mt-10">
      <header className="mb-3 flex items-end justify-between gap-4 px-1">
        <div>
          {number !== undefined && (
            <span className="kicker block font-mono font-medium text-red-500">
              {String(number).padStart(2, "0")} / {kicker ?? title}
            </span>
          )}
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
          <span className="mt-2 block h-[3px] w-10 rounded-full accent-bg" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button className={arrow} onClick={() => scroll(-1)} aria-label="Précédent">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button className={arrow} onClick={() => scroll(1)} aria-label="Suivant">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div ref={track} className="scrollbar-hide -mx-2 flex snap-x gap-1 overflow-x-auto scroll-smooth px-1 pb-2">
        {children}
      </div>
    </section>
  );
}
