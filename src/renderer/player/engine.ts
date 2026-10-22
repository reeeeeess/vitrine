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

export function currentPosition(state: Pick<PlaybackState, "paused" | "positionMs" | "durationMs" | "updatedAt">, now = Date.now()): number {
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
let appVersion = "";

// Spotify refusing to play here comes from how the app is built (its DRM signature), so it is
// remembered for this version only: the next version, perhaps signed, tries again by itself.
const REFUSED_KEY = "vitrine.localPlaybackRefused";
const REFUSED_MESSAGE =
  "Spotify refuse le lecteur intégré de cette version (signature DRM castlabs manquante). Vitrine joue sur cet ordinateur via Microsoft Edge ou Google Chrome, ou à défaut dans l'appli Spotify officielle.";

function refusedVersion(): string | null {
  try {
    return localStorage.getItem(REFUSED_KEY);
  } catch {
    return null;
  }
}

/** Forgets the refusal and restarts the page, so the local player tries again. */
export function retryLocalPlayback(): void {
  try {
    localStorage.removeItem(REFUSED_KEY);
  } catch {
    // nothing stored
  }
  window.location.reload();
}

export async function startPlayback(widevine: boolean, reason: string): Promise<void> {
  // React's strict mode runs effects twice in development; one player is enough
  if (started) return;
  started = true;
  void poll();
  setInterval(() => void poll(), POLL_MS);
  watchBrowserPlayer();
  document.addEventListener("visibilitychange", () => !document.hidden && void poll());

  if (!widevine) {
    playback.set({ sdk: "off", sdkMessage: reason });
    return;
  }
  // Spotify already refused this very version: go straight to driving the person's other devices
  const version = (await window.vitrine.info?.().catch(() => undefined))?.version ?? "";
  appVersion = version;
  if (version && refusedVersion() === version) {
    playback.set({ sdk: "off", sdkMessage: REFUSED_MESSAGE });
    void ensureBrowserPlayer();
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

type LocalCommand = Parameters<Window["vitrine"]["browserPlayer"]["command"]>[0];

/**
 * Runs a command on this computer's player while it is the one playing: the SDK inside Vitrine, or
 * the one in Edge or Chrome. Null otherwise, and the Web API drives the active device instead.
 */
function runLocally(command: LocalCommand): Promise<void> | null {
  if (!localActive) return null;
  if (viaBrowser) return window.vitrine.browserPlayer.command(command);
  if (!player) return null;
  switch (command.type) {
    case "toggle":
      return player.togglePlay();
    case "pause":
      return player.pause();
    case "resume":
      return player.resume();
    case "next":
      return player.nextTrack();
    case "previous":
      return player.previousTrack();
    case "seek":
      return player.seek(command.ms);
    case "volume":
      return player.setVolume(command.value);
  }
}

export async function togglePlay(): Promise<void> {
  const local = runLocally({ type: "toggle" });
  if (local) return local;
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
  const local = runLocally({ type: "next" });
  if (local) return local;
  await api.next(targetDevice());
  refreshSoon();
}

export async function previous(): Promise<void> {
  const local = runLocally({ type: "previous" });
  if (local) return local;
  await api.previous(targetDevice());
  refreshSoon();
}

export async function seek(ms: number): Promise<void> {
  playback.set({ positionMs: ms, updatedAt: Date.now() });
  const local = runLocally({ type: "seek", ms });
  if (local) return local;
  await api.seek(ms, targetDevice());
}

let volumeTimer: ReturnType<typeof setTimeout> | undefined;
export function setVolume(volume: number): void {
  const value = Math.min(1, Math.max(0, volume));
  playback.set({ volume: value });
  // the SDK applies it at once, but does not tell Spotify Connect: the Web API call below does,
  // so the volume other devices show for this computer stays right
  if (!runLocally({ type: "volume", value }) && playback.get().device?.local) void player?.setVolume(value);
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
    super("Aucun appareil Spotify disponible : installez ou ouvrez l'appli Spotify sur ce PC, ou ouvrez Spotify sur votre téléphone.");
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
  try {
    if (appVersion) localStorage.setItem(REFUSED_KEY, appVersion);
  } catch {
    // remembered for this session only
  }
  playback.set((state) => ({
    sdk: "error",
    sdkMessage: REFUSED_MESSAGE,
    localDeviceId: undefined,
    device: state.device?.local ? undefined : state.device,
    paused: true,
  }));
  if (await ensureBrowserPlayer()) {
    notify("Le lecteur intégré est refusé par Spotify (DRM) : Vitrine joue désormais via votre navigateur. Relancez la lecture.");
  } else {
    notify("Spotify refuse la lecture dans Vitrine (DRM). La musique passe par l'appli Spotify officielle : relancez la lecture.", "error");
  }
}

// ── playing through Edge or Chrome ────────────────────────────────────────

let browserFailed = false;
let browserErrors: number[] = [];

/**
 * Starts the player hosted by Microsoft Edge or Google Chrome (main process, browserPlayer.ts) and
 * makes it this computer's device. Returns false when no such browser is installed or it failed.
 */
export function ensureBrowserPlayer(): Promise<boolean> {
  browserStarting ??= startBrowserPlayer().finally(() => {
    browserStarting = null;
  });
  return browserStarting;
}

let browserStarting: Promise<boolean> | null = null;
let viaBrowser = false;

async function startBrowserPlayer(): Promise<boolean> {
  const bridge = window.vitrine.browserPlayer;
  if (browserFailed || !bridge) return false;
  const known = await bridge.status().catch(() => undefined);
  if (!known?.browser) {
    browserFailed = true;
    return false;
  }
  // already running: start() answers at once; closed meanwhile: it opens the browser again
  if (known.state !== "ready") playback.set({ sdk: "loading", sdkMessage: `Démarrage du lecteur via ${known.browser}…` });
  const status = await bridge.start().catch(() => undefined);
  if (status?.state !== "ready" || !status.deviceId) {
    browserFailed = true;
    viaBrowser = false;
    playback.set({ sdk: "error", localDeviceId: undefined, sdkMessage: `${REFUSED_MESSAGE} (${status?.detail ?? "lecteur navigateur indisponible"})` });
    return false;
  }
  viaBrowser = true;
  playback.set({
    sdk: "ready",
    localDeviceId: status.deviceId,
    sdkMessage: `Lecture sur cet ordinateur via ${status.browser} : son lecteur DRM est reconnu par Spotify.`,
  });
  return true;
}

/**
 * The browser's player failing in a row, or closed: step aside, as with the built-in player.
 * Its own state is the truth for this computer: Spotify's Web API keeps reporting the position
 * and the pause of such a device as they were when the track started.
 */
function watchBrowserPlayer(): void {
  window.vitrine.browserPlayer?.onState((state) => {
    if (viaBrowser) applySdkState(state);
  });
  window.vitrine.browserPlayer?.onEvent(({ type, message }) => {
    if (type === "not_ready" || type === "state" || type === "autoplay_failed") return;
    const now = Date.now();
    browserErrors = [...browserErrors.filter((time) => now - time < ERROR_WINDOW_MS), now];
    if (type === "playback_error" && browserErrors.length < ERRORS_BEFORE_GIVING_UP) {
      notify(`Titre sauté : Spotify a interrompu la lecture (${message}).`, "error");
      return;
    }
    browserFailed = true;
    viaBrowser = false;
    void window.vitrine.browserPlayer.stop();
    playback.set((state) => ({
      sdk: "error",
      sdkMessage: `Le lecteur via navigateur a échoué (${message || type}). Vitrine joue dans l'appli Spotify officielle.`,
      localDeviceId: undefined,
      device: state.device?.local ? undefined : state.device,
      paused: true,
    }));
    notify("Le lecteur via navigateur a échoué : la musique passe par l'appli Spotify officielle.", "error");
  });
}

const LAUNCH_WAIT_MS = 25_000;

/** Opens the official Spotify app in the background and waits for it to show up in Connect. */
async function launchSpotifyAndWait(): Promise<string | undefined> {
  const how = await window.vitrine.launchSpotify?.().catch(() => null);
  if (!how) return undefined;
  notify("Ouverture de Spotify en arrière-plan…");
  const end = Date.now() + LAUNCH_WAIT_MS;
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const device = await otherDevice().catch(() => undefined);
    if (device) return device;
  }
  return undefined;
}

async function start(body: api.PlayBody): Promise<void> {
  // the built-in player is refused or missing: this computer still plays, through Edge or Chrome,
  // unless the person picked another device on purpose
  const state = playback.get();
  const chose = Boolean(chosenDevice && state.device?.id === chosenDevice);
  if (!chose && (viaBrowser || state.sdk === "off" || state.sdk === "error" || browserStarting)) await ensureBrowserPlayer();
  const device = startTarget(playback.get(), chosenDevice) ?? (await otherDevice()) ?? (await launchSpotifyAndWait());
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

export function playTracks(uris: string[], index = 0, positionMs?: number): Promise<void> {
  // Spotify takes at most 100 uris: send the hundred around the one asked for
  const first = Math.max(0, Math.min(index - 50, uris.length - 100));
  return start({ uris: uris.slice(first, first + 100), offset: { position: index - first }, ...(positionMs ? { position_ms: Math.round(positionMs) } : {}) });
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

/**
 * Plays Liked Songs from a track. Spotify plays the collection as a context when it is asked for
 * "spotify:user:<id>:collection"; failing that, the loaded tracks themselves are sent.
 */
export async function playLiked(userId: string | undefined, uris: string[], index = 0): Promise<void> {
  if (userId) {
    try {
      await playContext(`spotify:user:${userId}:collection`, uris[index]);
      return;
    } catch (error) {
      if (!(error instanceof api.SpotifyApiError) || ![400, 403, 404].includes(error.status)) throw error;
    }
  }
  await playTracks(uris, index);
}
