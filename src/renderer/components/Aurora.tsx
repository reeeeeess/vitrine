import { useEffect, useState } from "react";
import { useBlurred } from "../lib/blurred";
import { artworkColor, type Rgb } from "../lib/palette";

/** Three colours from the artwork's: itself, a lighter one and a shifted one. */
export function aurora([r, g, b]: Rgb): [string, string, string] {
  const light = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.45));
  return [`${r} ${g} ${b}`, light.join(" "), `${b} ${r} ${g}`];
}

/** a soft round glow of a colour, without a blur filter (a gradient is soft by itself) */
const glow = (color: string, alpha: number) => `radial-gradient(circle at center, rgb(${color} / ${alpha}) 0%, rgb(${color} / ${alpha * 0.45}) 35%, rgb(${color} / 0) 70%)`;

/**
 * The living backdrop of the lyrics and the player (Apple Music, Spicy Lyrics): the artwork blurred, two
 * copies of it turning slowly, and three glows of its colours drifting over it. Nothing is blurred at each
 * frame: the artwork is blurred once (lib/blurred.ts) and only moves, so it stays smooth. Left out in light
 * mode (fx-blur).
 */
export function Aurora({ thumb, art, dim = 0.35 }: { thumb?: string; art?: string; dim?: number }) {
  const [colors, setColors] = useState<[string, string, string]>(["220 38 38", "245 140 140", "38 220 38"]);
  const blurred = useBlurred(thumb ?? art);
  useEffect(() => {
    void artworkColor(thumb ?? art).then((rgb) => setColors(aurora(rgb)));
  }, [thumb ?? art]);
  // max-w-none: Tailwind's base keeps images within their box, which cut the backdrop short on the right
  const turning = "absolute max-w-none rounded-full object-cover will-change-transform [mask-image:radial-gradient(circle,black_30%,transparent_70%)]";
  return (
    <>
      {blurred && (
        <div className="fx-blur absolute inset-0 overflow-hidden" aria-hidden="true">
          <img src={blurred} alt="" className="absolute inset-[-10%] h-[120%] w-[120%] max-w-none object-cover opacity-70" />
          <img src={blurred} alt="" className={`${turning} left-[-30%] top-[-35%] h-[110vmax] w-[110vmax] animate-[spin_80s_linear_infinite] opacity-60`} />
          <img src={blurred} alt="" className={`${turning} bottom-[-40%] right-[-30%] h-[95vmax] w-[95vmax] animate-[spin_110s_linear_infinite_reverse] opacity-55`} />
        </div>
      )}
      <div className="fx-blur absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-[20%] top-[-5%] h-[100vh] w-[100vh] animate-[drift_24s_ease-in-out_infinite_alternate] will-change-transform" style={{ background: glow(colors[0], 0.5) }} />
        <div className="absolute right-[-15%] top-[-20%] h-[90vh] w-[90vh] animate-[drift_30s_ease-in-out_infinite_alternate-reverse] will-change-transform" style={{ background: glow(colors[1], 0.4) }} />
        <div className="absolute bottom-[-35%] left-[20%] h-[95vh] w-[95vh] animate-[drift_36s_ease-in-out_infinite_alternate] will-change-transform" style={{ background: glow(colors[2], 0.32) }} />
      </div>
      <div className="absolute inset-0" style={{ background: `rgb(0 0 0 / ${dim})` }} />
    </>
  );
}
