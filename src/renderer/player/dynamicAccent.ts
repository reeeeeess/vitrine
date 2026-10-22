// When the person asks for it, the accent follows the artwork of the track playing.
import { artworkColor } from "../lib/palette";
import { applyAccent, theme } from "../lib/theme";
import { playback } from "./engine";

export function connectDynamicAccent(): () => void {
  let shown: string | undefined;
  const update = () => {
    const image = theme.get().dynamic ? playback.get().track?.image : undefined;
    if (image === shown) return;
    shown = image;
    if (!image) {
      applyAccent(null);
      return;
    }
    void artworkColor(image).then((color) => {
      if (shown === image) applyAccent(color);
    });
  };
  update();
  const stopPlayback = playback.subscribe(update);
  const stopTheme = theme.subscribe(update);
  return () => {
    stopPlayback();
    stopTheme();
    applyAccent(null);
  };
}
