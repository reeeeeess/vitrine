// While the page is freed (Vitrine hidden in the tray, see main.ts), the main process answers the tray,
// the taskbar buttons and the shortcuts itself, and keeps the tray and Discord told of what plays:
// through the browser's player when it is the one playing, otherwise through the Web API.
import { net } from "electron";
import type { BrowserPlayer } from "./browserPlayer";
import type { DesktopCommand } from "./cli";

export interface Playing {
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  trackId?: string;
  durationMs: number;
  positionMs: number;
  paused: boolean;
}

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const images = (album: Json | undefined) => (Array.isArray(album?.images) ? (album!.images as Json[]) : []);

/** What /me/player says plays, or null. */
export function fromPlayer(body: unknown): Playing | null {
  const state = (body ?? {}) as Json;
  const item = state.item as Json | null | undefined;
  if (!item || !text(item.name)) return null;
  const album = item.album as Json | undefined;
  const artists = Array.isArray(item.artists) ? (item.artists as Json[]).map((a) => text(a.name)).filter(Boolean) : [];
  return {
    title: text(item.name),
    artist: artists.join(", "),
    album: text(album?.name) || undefined,
    imageUrl: text(images(album).find((image) => Number(image.width) <= 300)?.url ?? images(album)[0]?.url) || undefined,
    trackId: text(item.id) || undefined,
    durationMs: Number(item.duration_ms) || 0,
    positionMs: Number(state.progress_ms) || 0,
    paused: state.is_playing !== true,
  };
}

/** What the browser's player says plays (its own state: the Web API's is frozen for it), or null. */
export function fromSdkState(raw: unknown): Playing | null {
  const state = (raw ?? {}) as Json;
  const track = (state.track_window as Json | undefined)?.current_track as Json | null | undefined;
  if (!track || !text(track.name)) return null;
  const album = track.album as Json | undefined;
  const artists = Array.isArray(track.artists) ? (track.artists as Json[]).map((a) => text(a.name)).filter(Boolean) : [];
  return {
    title: text(track.name),
    artist: artists.join(", "),
    album: text(album?.name) || undefined,
    imageUrl: text(images(album).find((image) => Number(image.width) <= 300)?.url ?? images(album)[0]?.url) || undefined,
    trackId: text(track.id) || undefined,
    durationMs: Number(state.duration) || 0,
    positionMs: Number(state.position) || 0,
    paused: state.paused === true,
  };
}

export class RemoteControl {
  constructor(
    private readonly accessToken: () => Promise<string>,
    private readonly browser: () => BrowserPlayer | null,
  ) {}

  /** Spotify's pause after too many requests: asking during it would only lengthen it */
  private pausedUntil = 0;

  private async api(path: string, method = "GET"): Promise<Response> {
    if (Date.now() < this.pausedUntil) throw new Error("Spotify demande d'attendre (trop de requêtes).");
    const response = await net.fetch(`https://api.spotify.com/v1${path}`, { method, headers: { authorization: `Bearer ${await this.accessToken()}` } });
    if (response.status === 429) this.pausedUntil = Date.now() + (Number(response.headers.get("retry-after")) || 30) * 1000;
    return response;
  }

  /** the browser's player, when it is the one playing */
  private playingBrowser(): BrowserPlayer | null {
    const player = this.browser();
    return player && player.status.state === "ready" && fromSdkState(player.lastState) ? player : null;
  }

  async nowPlaying(): Promise<Playing | null> {
    const browser = this.playingBrowser();
    if (browser) return fromSdkState(browser.lastState);
    const response = await this.api("/me/player");
    return response.status === 200 ? fromPlayer(await response.json()) : null;
  }

  async run(command: DesktopCommand): Promise<void> {
    const browser = this.playingBrowser();
    if (browser && (command === "toggle" || command === "next" || command === "previous")) {
      browser.command({ type: command });
      return;
    }
    if (command === "next" || command === "previous") {
      await this.api(`/me/player/${command}`, "POST");
    } else if (command === "toggle") {
      const playing = await this.nowPlaying();
      await this.api(`/me/player/${playing && !playing.paused ? "pause" : "play"}`, "PUT");
    } else if (command === "like") {
      const playing = await this.nowPlaying();
      if (playing?.trackId) await this.api(`/me/tracks?ids=${encodeURIComponent(playing.trackId)}`, "PUT");
    }
  }
}
