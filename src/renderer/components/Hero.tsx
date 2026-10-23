import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { lite } from "../lib/lite";
import { useStore } from "../lib/store";
import { artworkColor, rgbVar } from "../lib/palette";
import { Artwork } from "./Artwork";

export interface HeroSlide {
  key: string;
  kicker: string;
  tags: string[];
  title: string;
  subtitle?: string;
  image?: string;
  /** 64 px: the blurred backdrop */
  thumb?: string;
  onPlay?: () => void;
  onOpen?: () => void;
}

const AUTOPLAY_MS = 7000;

function Slide({ slide, active }: { slide: HeroSlide; active: boolean }) {
  const [color, setColor] = useState("220 38 38");
  useEffect(() => {
    void artworkColor(slide.image).then((rgb) => setColor(rgbVar(rgb)));
  }, [slide.image]);
  return (
    <div className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden">
      {/* only the slide in view gets its moving, blurred backdrop: the others would hold memory for nothing */}
      {active && (slide.thumb ?? slide.image) && (
        <img src={slide.thumb ?? slide.image} alt="" aria-hidden="true" className="fx-blur absolute inset-0 h-full w-full animate-slow-pan object-cover opacity-60 blur-3xl" />
      )}
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 120% at 85% 40%, rgb(${color} / 0.45), transparent 60%)` }} />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      <div className="relative z-10 flex h-full items-center gap-10 px-12 pb-10">
        <motion.div
          className="max-w-2xl flex-1"
          initial={false}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="kicker inline-flex items-center rounded-full border border-red-500/40 bg-red-600/25 px-3 py-1 font-semibold text-red-100">
              {slide.kicker}
            </span>
            {slide.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-5 line-clamp-2 font-display text-5xl leading-[1.05] tracking-tight xl:text-6xl">{slide.title}</h1>
          {slide.subtitle && <p className="mt-4 line-clamp-2 max-w-xl text-base text-white/70">{slide.subtitle}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {slide.onPlay && (
              <button
                onClick={slide.onPlay}
                className="btn-primary text-base"
              >
                <Play className="h-5 w-5 fill-current" />
                Lecture
              </button>
            )}
            {slide.onOpen && (
              <button
                onClick={slide.onOpen}
                className="btn-ghost text-base"
              >
                <Info className="h-5 w-5" />
                Voir
              </button>
            )}
          </div>
        </motion.div>
        <motion.div
          className="hidden w-[min(34vh,320px)] shrink-0 lg:block"
          initial={false}
          animate={active ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.94, rotate: -2 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <Artwork src={slide.image} className="rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10" />
        </motion.div>
      </div>
    </div>
  );
}

/** The big rotating banner at the top of the home page. */
export function Hero({ slides }: { slides: HeroSlide[] }) {
  // light mode, or a pause asked for: the banner stays on its slide
  const autoplay = useStore(lite, (s) => s.effects.autoplay);
  const [paused, setPaused] = useState(false);
  const plugins = useMemo(() => (autoplay ? [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: false, stopOnMouseEnter: true })] : []), [autoplay]);
  const [viewport, embla] = useEmblaCarousel({ loop: true }, plugins);
  const [selected, setSelected] = useState(0);
  const running = autoplay && !paused;

  useEffect(() => {
    const plugin = embla?.plugins().autoplay;
    if (!plugin) return;
    if (paused) plugin.stop();
    else plugin.play();
  }, [embla, paused]);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const go = useCallback((index: number) => embla?.scrollTo(index), [embla]);
  if (slides.length === 0) return null;

  return (
    <section className="relative isolate h-[55vh] max-h-[560px] min-h-[380px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
      <div ref={viewport} className="h-full overflow-hidden">
        <div className="flex h-full">
          {slides.map((slide, index) => (
            <Slide key={slide.key} slide={slide} active={index === selected} />
          ))}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2 backdrop-blur">
            <button onClick={() => embla?.scrollPrev()} className="text-white/70 hover:text-white" aria-label="Précédent">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {slides.map((slide, index) => (
              <button key={slide.key} onClick={() => go(index)} className="py-2" aria-label={`Aller à ${slide.title}`}>
                <span className="block h-1 w-14 overflow-hidden rounded-full bg-white/15">
                  <span
                    key={index === selected ? `on-${selected}` : "off"}
                    className={cn("block h-full rounded-full bg-white", index === selected ? (running ? "animate-[heroProgress_linear_forwards]" : "w-full") : "w-0")}
                    style={index === selected && running ? { animationDuration: `${AUTOPLAY_MS}ms` } : undefined}
                  />
                </span>
              </button>
            ))}
            <button onClick={() => embla?.scrollNext()} className="text-white/70 hover:text-white" aria-label="Suivant">
              <ChevronRight className="h-4 w-4" />
            </button>
            {autoplay && (
              <button
                onClick={() => setPaused((value) => !value)}
                className="ml-1 border-l border-white/15 pl-3 text-white/70 hover:text-white"
                aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}
                aria-pressed={paused}
              >
                {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
