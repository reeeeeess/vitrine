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
};

contextBridge.exposeInMainWorld("vitrine", api);
