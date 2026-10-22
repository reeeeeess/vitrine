// Playback. Two ways to play, behind one set of commands:
//  - local: the Web Playback SDK makes this app a Spotify Connect device, "Vitrine (cet ordinateur)".
//    It needs Widevine (castlabs' Electron) and Spotify Premium.
//  - remote: whatever device is active (phone, the official app, a speaker) is driven through the
//    Web API, and its state is polled.
import type { SpotifySdk } from "../global";
import * as api from "../lib/spotify";
import { createStore } from "../lib/store";
import { notify } from "../lib/ui";
import { pickImage, type Track } from "../lib/types";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const DEVICE_NAME = "Vitrine (cet ordinateur)";
const POLL_MS = 2500;

export type Repeat = "off" | "context" | "track";

export interface ActiveDevice {
  id: string;
  name: string;
  type: string;
  local: boolean;
}

export interface PlaybackState {
  sdk: "off" | "loading" | "ready" | "error";
  sdkMessage?: string;
  localDeviceId?: string;
  device?: ActiveDevice;
  track?: Track;
  contextUri?: string;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  /** when positionMs was true, for the progress bar to run on from */
  updatedAt: number;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
}

export const playback = createStore<PlaybackState>({
  sdk: "off",
  paused: true,
  positionMs: 0,
  durationMs: 0,
  updatedAt: Date.now(),
  shuffle: false,
  repeat: "off",
  volume: 0.7,
});

let player: SpotifySdk.Player | null = null;
let recentErrors: number[] = [];
const ERROR_WINDOW_MS = 30_000;
const ERRORS_BEFORE_GIVING_UP = 2;
/** the SDK reports a state only while this computer is the one playing */
let localActive = false;

export function currentPosition(state: PlaybackState, now = Date.now()): number {
  if (state.paused) return state.positionMs;
  return Math.min(state.durationMs || Infinity, state.positionMs + (now - state.updatedAt));
}

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Le lecteur Spotify ne s'est pas chargé.")), 20_000);
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timer);
      resolve();
    };
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Le lecteur Spotify est injoignable."));
    };
    document.head.append(script);
  });
}

function mapSdkTrack(track: SpotifySdk.SdkTrack): Track {
  return {
    id: track.id ?? track.uri,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((artist) => artist.name),
    artistIds: track.artists.map((artist) => artist.uri.split(":").pop() ?? "").filter(Boolean),
    albumName: track.album.name,
    albumId: track.album.uri.split(":").pop(),
    image: pickImage(track.album.images, 300),
    imageLarge: pickImage(track.album.images, 640),
    durationMs: track.duration_ms,
    explicit: false,
  };
}

function applySdkState(state: SpotifySdk.State | null): void {
  if (!state || !state.track_window.current_track) {
    localActive = false;
    return;
  }
  localActive = true;
  playback.set((current) => ({
    device: { id: current.localDeviceId ?? "", name: DEVICE_NAME, type: "Computer", local: true },
    track: mapSdkTrack(state.track_window.current_track as SpotifySdk.SdkTrack),
    contextUri: state.context.uri ?? undefined,
    paused: state.paused,
    positionMs: state.position,
    durationMs: state.duration,
    updatedAt: Date.now(),
    shuffle: state.shuffle,
    repeat: (["off", "context", "track"] as const)[state.repeat_mode] ?? "off",
  }));
}

async function poll(): Promise<void> {
  if (document.hidden) return;
  try {
    const remote = await api.playerState();
    const localId = playback.get().localDeviceId;
    if (localActive && remote?.device?.id === localId) return; // the SDK already says it all
    if (remote?.device?.id !== localId) localActive = false;
    if (!remote) {
      if (!localActive) playback.set({ device: undefined, paused: true });
      return;
    }
    playback.set({
      device: remote.device
        ? {
            ...remote.device,
            // once the local player has stepped aside, Spotify may still report it for a moment
            local: remote.device.id === localId || (!localId && remote.device.name === DEVICE_NAME),
            name: remote.device.id === localId ? DEVICE_NAME : remote.device.name,
          }
        : undefined,
      track: remote.track ?? undefined,
      contextUri: remote.contextUri,
      paused: !remote.isPlaying,
      positionMs: remote.progressMs,
      durationMs: remote.track?.durationMs ?? 0,
      updatedAt: Date.now(),
      shuffle: remote.shuffle,
      repeat: remote.repeat,
      ...(remote.device?.volumePercent != null && remote.device.id !== localId ? { volume: remote.device.volumePercent / 100 } : {}),
    });
  } catch {
    // a missed poll is caught up by the next one
  }
}

export function refreshSoon(delay = 600): void {
  setTimeout(() => void poll(), delay);
}

let started = false;

export async function startPlayback(widevine: boolean, reason: string): Promise<void> {
  // React's strict mode runs effects twice in development; one player is enough
  if (started) return;
  started = true;
  void poll();
  setInterval(() => void poll(), POLL_MS);
  document.addEventListener("visibilitychange", () => !document.hidden && void poll());

  if (!widevine) {
    playback.set({ sdk: "off", sdkMessage: reason });
    return;
  }
  playback.set({ sdk: "loading", sdkMessage: undefined });
  try {
    await loadSdk();
  } catch (error) {
    playback.set({ sdk: "error", sdkMessage: (error as Error).message });
    return;
  }
  const Player = window.Spotify?.Player;
  if (!Player) return;
  player = new Player({
    name: DEVICE_NAME,
    volume: playback.get().volume,
    getOAuthToken: (cb) => void window.vitrine.auth.token().then(cb, () => undefined),
  });
  player.addListener("ready", ({ device_id }) => playback.set({ sdk: "ready", sdkMessage: undefined, localDeviceId: device_id }));
  player.addListener("not_ready", () => playback.set({ sdk: "loading", sdkMessage: "Reconnexion du lecteur…" }));
  player.addListener("player_state_changed", applySdkState);
  const failures = {
    initialization_error: "Le lecteur intégré n'a pas pu démarrer (DRM).",
    authentication_error: "Spotify a refusé la session du lecteur, reconnectez-vous.",
    account_error: "La lecture sur cet ordinateur nécessite Spotify Premium.",
  } as const;
  for (const [event, message] of Object.entries(failures) as [keyof typeof failures, string][]) {
    player.addListener(event, ({ message: detail }) => {
      playback.set({ sdk: "error", sdkMessage: message });
      notify(`${message} (${detail})`, "error");
    });
  }
  // the SDK skips to the next track after a playback error: say so, or the skip looks random;
  // errors in a row mean Spotify refuses this computer, and the player steps aside
  player.addListener("playback_error", ({ message }) => {
    const now = Date.now();
    recentErrors = [...recentErrors.filter((time) => now - time < ERROR_WINDOW_MS), now];
    if (recentErrors.length >= ERRORS_BEFORE_GIVING_UP) {
      void giveUpLocalPlayback();
      return;
    }
    notify(`Titre sauté : Spotify a interrompu la lecture sur cet ordinateur (${message}).`, "error");
  });
  if (!(await player.connect())) playback.set({ sdk: "error", sdkMessage: "Le lecteur intégré a été refusé." });
}

// ── commands ──────────────────────────────────────────────────────────────

function targetDevice(): string | undefined {
  const state = playback.get();
  return state.device?.id || state.localDeviceId;
}

const useSdk = () => localActive && player !== null;

export async function togglePlay(): Promise<void> {
  if (useSdk()) return player!.togglePlay();
  const state = playback.get();
  if (!state.track) return;
  playback.set({ paused: !state.paused, positionMs: currentPosition(state), updatedAt: Date.now() });
  try {
    await (state.paused ? api.play(targetDevice()) : api.pause(targetDevice()));
  } finally {
    refreshSoon();
  }
}

export async function next(): Promise<void> {
  if (useSdk()) return player!.nextTrack();
  await api.next(targetDevice());
  refreshSoon();
}

export async function previous(): Promise<void> {
  if (useSdk()) return player!.previousTrack();
  await api.previous(targetDevice());
  refreshSoon();
}

export async function seek(ms: number): Promise<void> {
  playback.set({ positionMs: ms, updatedAt: Date.now() });
  if (useSdk()) return player!.seek(ms);
  await api.seek(ms, targetDevice());
}

let volumeTimer: ReturnType<typeof setTimeout> | undefined;
export function setVolume(volume: number): void {
  const value = Math.min(1, Math.max(0, volume));
  playback.set({ volume: value });
  // the SDK applies it at once, but does not tell Spotify Connect: the Web API call below does,
  // so the volume other devices show for this computer stays right
  if (useSdk() || playback.get().device?.local) void player?.setVolume(value);
  // a slider sends many values; the Web API is asked for the last one
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => void api.setVolume(value * 100, targetDevice()).catch(() => undefined), 200);
}

export async function toggleShuffle(): Promise<void> {
  const shuffle = !playback.get().shuffle;
  playback.set({ shuffle });
  await api.setShuffle(shuffle, targetDevice());
}

export async function cycleRepeat(): Promise<void> {
  const order: Repeat[] = ["off", "context", "track"];
  const repeat = order[(order.indexOf(playback.get().repeat) + 1) % order.length];
  playback.set({ repeat });
  await api.setRepeat(repeat, targetDevice());
}

export class NoDeviceError extends Error {
  constructor() {
    super("Aucun appareil disponible : ouvrez Spotify sur un appareil, ou activez la lecture sur cet ordinateur.");
  }
}

/** a device the person picked in the devices menu; playback started here goes there */
let chosenDevice: string | undefined;

/**
 * Where a new playback goes: the device the person picked, if it is still the active one;
 * otherwise this computer when its player is ready, otherwise whatever device is active.
 * An active device that merely sits paused (another computer, a phone) does not win over this one.
 */
export function startTarget(state: Pick<PlaybackState, "device" | "localDeviceId" | "sdk">, chosen?: string): string | undefined {
  if (chosen && state.device?.id === chosen) return chosen;
  if (state.sdk === "ready" && state.localDeviceId) return state.localDeviceId;
  // without a working player here, this computer is no target, even if Spotify still lists it
  return state.device && !state.device.local ? state.device.id : undefined;
}

/** Another Spotify device to play on: the active one, else a computer, else any. */
async function otherDevice(): Promise<string | undefined> {
  const localId = playback.get().localDeviceId;
  const list = (await api.devices()).filter((device) => device.id !== localId && !device.name.startsWith("Vitrine"));
  return (list.find((d) => d.isActive) ?? list.find((d) => d.type === "Computer") ?? list[0])?.id;
}

/**
 * Spotify refused to play on this computer more than once in a short while: most likely the DRM
 * (Widevine without castlabs' VMP signature). The local player leaves Spotify Connect, so playback
 * goes to the person's other devices instead of skipping track after track.
 */
async function giveUpLocalPlayback(): Promise<void> {
  if (!player) return;
  const local = player;
  player = null;
  localActive = false;
  await local.pause().catch(() => undefined);
  local.disconnect();
  playback.set((state) => ({
    sdk: "error",
    sdkMessage:
      "Spotify refuse la lecture sur cet ordinateur (protection DRM de l'appli non reconnue : signature castlabs manquante). Vitrine pilote vos autres appareils Spotify à la place.",
    localDeviceId: undefined,
    device: state.device?.local ? undefined : state.device,
    paused: true,
  }));
  notify("Lecture impossible sur cet ordinateur (DRM). Vitrine passe en mode télécommande : la musique jouera sur un autre appareil Spotify ouvert.", "error");
}

async function start(body: api.PlayBody): Promise<void> {
  const device = startTarget(playback.get(), chosenDevice) ?? (await otherDevice());
  if (!device) throw new NoDeviceError();
  // the click that started playback also unlocks audio for the SDK
  if (device === playback.get().localDeviceId) await player?.activateElement().catch(() => undefined);
  try {
    await api.play(device, body);
  } catch (error) {
    // a freshly registered SDK device is sometimes unknown until playback is moved to it
    if (!(error instanceof api.SpotifyApiError) || error.status !== 404) throw error;
    await api.transfer(device, false);
    await api.play(device, body);
  }
  refreshSoon();
}

export function playContext(contextUri: string, trackUri?: string): Promise<void> {
  return start({ context_uri: contextUri, ...(trackUri ? { offset: { uri: trackUri } } : {}) });
}

export function playTracks(uris: string[], index = 0): Promise<void> {
  // Spotify takes at most 100 uris: send the hundred around the one asked for
  const first = Math.max(0, Math.min(index - 50, uris.length - 100));
  return start({ uris: uris.slice(first, first + 100), offset: { position: index - first } });
}

export async function transferTo(deviceId: string): Promise<void> {
  await api.transfer(deviceId, !playback.get().paused);
  const local = deviceId === playback.get().localDeviceId;
  chosenDevice = local ? undefined : deviceId;
  if (!local) localActive = false;
  refreshSoon(800);
}

export async function addToQueue(uri: string): Promise<void> {
  const device = playback.get().device?.id ?? startTarget(playback.get(), chosenDevice);
  if (!device) throw new NoDeviceError();
  await api.addToQueue(uri, device);
}
