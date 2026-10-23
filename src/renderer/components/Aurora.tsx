import { useEffect, useState } from "react";
import { artworkColor, type Rgb } from "../lib/palette";

/** Three colours from the artwork's: itself, a lighter one and a shifted one. */
export function aurora([r, g, b]: Rgb): [string, string, string] {
  const light = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.45));
  return [`${r} ${g} ${b}`, light.join(" "), `${b} ${r} ${g}`];
}

/**
 * The living backdrop of the lyrics and the player (Apple Music, Musix): the artwork blurred, and three
 * slow blobs of its colours drifting over it. Left out in light mode (fx-blur).
 */
export function Aurora({ thumb, art, dim = 0.35 }: { thumb?: string; art?: string; dim?: number }) {
  const [colors, setColors] = useState<[string, string, string]>(["220 38 38", "245 140 140", "38 220 38"]);
  useEffect(() => {
    void artworkColor(thumb ?? art).then((rgb) => setColors(aurora(rgb)));
  }, [thumb ?? art]);
  return (
    <>
      {thumb && <img src={thumb} alt="" aria-hidden="true" className="fx-blur absolute inset-[-10%] h-[120%] w-[120%] object-cover opacity-60 blur-[90px]" />}
      {/* two copies of the artwork turning slowly, as Apple Music's and Spicy Lyrics' backdrops do */}
      {thumb && (
        <div className="fx-blur absolute inset-0 overflow-hidden" aria-hidden="true">
          <img src={thumb} alt="" className="absolute left-[-30%] top-[-35%] h-[110vmax] w-[110vmax] animate-[spin_80s_linear_infinite] rounded-full object-cover opacity-50 blur-[90px] saturate-150" />
          <img src={thumb} alt="" className="absolute bottom-[-40%] right-[-30%] h-[95vmax] w-[95vmax] animate-[spin_110s_linear_infinite_reverse] rounded-full object-cover opacity-45 blur-[90px] saturate-150" />
        </div>
      )}
      <div className="fx-blur absolute inset-0" aria-hidden="true">
        <div className="absolute -left-[10%] top-[5%] h-[70vh] w-[70vh] animate-[drift_24s_ease-in-out_infinite_alternate] rounded-full blur-[120px]" style={{ background: `rgb(${colors[0]} / 0.55)` }} />
        <div className="absolute right-[-5%] top-[-10%] h-[60vh] w-[60vh] animate-[drift_30s_ease-in-out_infinite_alternate-reverse] rounded-full blur-[120px]" style={{ background: `rgb(${colors[1]} / 0.45)` }} />
        <div className="absolute bottom-[-20%] left-[30%] h-[65vh] w-[65vh] animate-[drift_36s_ease-in-out_infinite_alternate] rounded-full blur-[130px]" style={{ background: `rgb(${colors[2]} / 0.35)` }} />
      </div>
      <div className="absolute inset-0" style={{ background: `rgb(0 0 0 / ${dim})` }} />
    </>
  );
}
