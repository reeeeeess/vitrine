import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: class {} }));
const { findBrowser, playerPage, DEVICE_NAME } = await import("../electron/browserPlayer");

describe("findBrowser", () => {
  const env = { "ProgramFiles(x86)": "C:\\Program Files (x86)", ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\riad\\AppData\\Local" };
  const edge = path.join(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe");
  const chrome = path.join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe");

  it("prefers Edge, which every Windows has", () => {
    expect(findBrowser("win32", env, (file) => file === edge || file === chrome)).toEqual({ name: "Microsoft Edge", path: edge });
  });

  it("falls back to Chrome, then to nothing", () => {
    expect(findBrowser("win32", env, (file) => file === chrome)?.name).toBe("Google Chrome");
    expect(findBrowser("win32", env, () => false)).toBeNull();
  });

  it("knows where macOS keeps them", () => {
    expect(findBrowser("darwin", {}, (file) => file.includes("Google Chrome.app"))?.path).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  });
});

describe("playerPage", () => {
  it("names the device as the built-in player does and reports back with the key", () => {
    const page = playerPage();
    expect(page).toContain(JSON.stringify(DEVICE_NAME));
    expect(page).toContain('fetch("/token?k=" + key)');
    expect(page).toContain("https://sdk.scdn.co/spotify-player.js");
  });
});
