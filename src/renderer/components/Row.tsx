import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

/** A titled, horizontally scrolling row with arrows, as on Movix's home page. */
export function Row({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: "smooth" });
  };
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/80 transition-colors hover:bg-white/15 hover:text-white";
  return (
    <section className="mt-10">
      <header className="mb-3 flex items-center justify-between gap-4 px-1">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
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
