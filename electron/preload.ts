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
  },
  openExternal: (url: string) => ipcRenderer.invoke("shell:open", url),
  window: {
    setMini: (on: boolean) => ipcRenderer.invoke("window:mini", on),
  },
  info: () => ipcRenderer.invoke("app:info"),
  launchSpotify: () => ipcRenderer.invoke("spotify:launch"),
  desktop: {
    get: () => ipcRenderer.invoke("desktop:get"),
    set: (settings: unknown) => ipcRenderer.invoke("desktop:set", settings),
    update: (nowPlaying: unknown) => ipcRenderer.invoke("desktop:update", nowPlaying),
    /** Commands from the tray and the taskbar buttons; returns the function that stops listening. */
    onCommand: (listener: (command: unknown) => void) => {
      const forward = (_event: unknown, command: unknown) => listener(command);
      ipcRenderer.on("desktop:command", forward);
      return () => ipcRenderer.removeListener("desktop:command", forward);
    },
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
