// The only bridge between the page and the main process. Everything here is a call the main process
// checks again; nothing of Node or Electron reaches the page.
import { contextBridge, ipcRenderer } from "electron";

const api = {
  platform: process.platform,
  auth: {
    status: () => ipcRenderer.invoke("auth:status"),
    login: (clientId: string) => ipcRenderer.invoke("auth:login", clientId),
    logout: () => ipcRenderer.invoke("auth:logout"),
    token: (force = false) => ipcRenderer.invoke("auth:token", force),
  },
  drm: {
    status: () => ipcRenderer.invoke("drm:status"),
  },
  lyrics: {
    get: (query: unknown) => ipcRenderer.invoke("lyrics:get", query),
    clear: () => ipcRenderer.invoke("lyrics:clear"),
    translate: (lines: unknown) => ipcRenderer.invoke("lyrics:translate", { lines }),
  },
  lastfm: {
    status: () => ipcRenderer.invoke("lastfm:status"),
    keys: (keys: unknown) => ipcRenderer.invoke("lastfm:keys", keys),
    connect: () => ipcRenderer.invoke("lastfm:connect"),
    disconnect: () => ipcRenderer.invoke("lastfm:disconnect"),
    now: (track: unknown) => ipcRenderer.invoke("lastfm:now", track),
    scrobble: (listen: unknown) => ipcRenderer.invoke("lastfm:scrobble", listen),
  },
  credits: {
    get: (isrc: string) => ipcRenderer.invoke("credits:get", isrc),
  },
  translation: {
    get: () => ipcRenderer.invoke("translation:get"),
    set: (settings: unknown) => ipcRenderer.invoke("translation:set", settings),
  },
  openExternal: (url: string) => ipcRenderer.invoke("shell:open", url),
  copy: (text: string) => ipcRenderer.invoke("clipboard:write", text),
  overlay: {
    toggle: () => ipcRenderer.invoke("overlay:toggle"),
    status: () => ipcRenderer.invoke("overlay:status"),
    /** from the main window: the line to show */
    send: (line: unknown) => ipcRenderer.invoke("overlay:line", line),
    /** in the main window: the overlay opened or closed */
    onStatus: (listener: (open: boolean) => void) => {
      const forward = (_event: unknown, open: boolean) => listener(open);
      ipcRenderer.on("overlay:status", forward);
      return () => ipcRenderer.removeListener("overlay:status", forward);
    },
    /** in the overlay: each new line */
    onLine: (listener: (line: unknown) => void) => {
      const forward = (_event: unknown, line: unknown) => listener(line);
      ipcRenderer.on("overlay:line", forward);
      return () => ipcRenderer.removeListener("overlay:line", forward);
    },
  },
  window: {
    setMini: (on: boolean) => ipcRenderer.invoke("window:mini", on),
  },
  info: () => ipcRenderer.invoke("app:info"),
  errors: {
    add: (error: unknown) => ipcRenderer.invoke("errors:add", error),
    info: () => ipcRenderer.invoke("errors:info"),
    copy: () => ipcRenderer.invoke("errors:copy"),
    ticket: () => ipcRenderer.invoke("errors:ticket"),
    clear: () => ipcRenderer.invoke("errors:clear"),
  },
  app: {
    /** the interface's language, for the tray, the dialogs and the notifications */
    setLanguage: (language: string) => ipcRenderer.invoke("app:language", language),
  },
  launchSpotify: () => ipcRenderer.invoke("spotify:launch"),
  equalizer: {
    get: () => ipcRenderer.invoke("eq:get"),
    set: (settings: unknown) => ipcRenderer.invoke("eq:set", settings),
    openEditor: () => ipcRenderer.invoke("eq:open"),
  },
  moments: {
    get: () => ipcRenderer.invoke("moments:get"),
    set: (moments: unknown) => ipcRenderer.invoke("moments:set", moments),
  },
  pins: {
    get: () => ipcRenderer.invoke("pins:get"),
    set: (pins: unknown) => ipcRenderer.invoke("pins:set", pins),
  },
  desktop: {
    get: () => ipcRenderer.invoke("desktop:get"),
    set: (settings: unknown) => ipcRenderer.invoke("desktop:set", settings),
    update: (nowPlaying: unknown) => ipcRenderer.invoke("desktop:update", nowPlaying),
    keys: () => ipcRenderer.invoke("desktop:keys"),
    setKeys: (change: unknown) => ipcRenderer.invoke("desktop:set-keys", change),
    /** Commands from the tray and the taskbar buttons; returns the function that stops listening. */
    onCommand: (listener: (command: unknown) => void) => {
      const forward = (_event: unknown, command: unknown) => listener(command);
      ipcRenderer.on("desktop:command", forward);
      return () => ipcRenderer.removeListener("desktop:command", forward);
    },
  },
  history: {
    add: (play: unknown) => ipcRenderer.invoke("history:add", play),
    extend: (at: string, playedMs: number) => ipcRenderer.invoke("history:extend", at, playedMs),
    summary: (query: unknown) => ipcRenderer.invoke("history:summary", query),
    insight: (kind: string) => ipcRenderer.invoke("history:insight", kind),
    info: () => ipcRenderer.invoke("history:info"),
    sync: () => ipcRenderer.invoke("history:sync"),
    import: () => ipcRenderer.invoke("history:import"),
    clear: () => ipcRenderer.invoke("history:clear"),
    export: () => ipcRenderer.invoke("history:export"),
    enabled: () => ipcRenderer.invoke("history:enabled"),
    setEnabled: (on: boolean) => ipcRenderer.invoke("history:set-enabled", on),
  },
  browserPlayer: {
    status: () => ipcRenderer.invoke("browser-player:status"),
    start: () => ipcRenderer.invoke("browser-player:start"),
    stop: () => ipcRenderer.invoke("browser-player:stop"),
    command: (command: unknown) => ipcRenderer.invoke("browser-player:command", command),
    /** The player's own state, on every change; returns the function that stops listening. */
    onState: (listener: (state: unknown) => void) => {
      const forward = (_event: unknown, state: unknown) => listener(state);
      ipcRenderer.on("browser-player:state", forward);
      return () => ipcRenderer.removeListener("browser-player:state", forward);
    },
    /** Errors the browser's player reports; returns the function that stops listening. */
    onEvent: (listener: (event: unknown) => void) => {
      const forward = (_event: unknown, payload: unknown) => listener(payload);
      ipcRenderer.on("browser-player:event", forward);
      return () => ipcRenderer.removeListener("browser-player:event", forward);
    },
  },
  discord: {
    get: () => ipcRenderer.invoke("discord:get"),
    set: (settings: unknown) => ipcRenderer.invoke("discord:set", settings),
    update: (nowPlaying: unknown) => ipcRenderer.invoke("discord:update", nowPlaying),
  },
  updates: {
    get: () => ipcRenderer.invoke("update:get"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    /** Calls back on every change; returns the function that stops listening. */
    subscribe: (listener: (state: unknown) => void) => {
      const forward = (_event: unknown, state: unknown) => listener(state);
      ipcRenderer.on("update:status", forward);
      return () => ipcRenderer.removeListener("update:status", forward);
    },
  },
};

contextBridge.exposeInMainWorld("vitrine", api);
