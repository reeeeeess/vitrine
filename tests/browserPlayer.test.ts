import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: class {} }));
const { findBrowser, parseCommand, playerPage, DEVICE_NAME } = await import("../electron/browserPlayer");

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

  it("reports the player's own state and waits for Vitrine's commands", () => {
    const page = playerPage();
    expect(page).toContain('"player_state_changed"');
    expect(page).toContain('post("/state"');
    expect(page).toContain('fetch("/command?k=" + key)');
  });
});

describe("parseCommand", () => {
  it("passes the commands the page knows", () => {
    expect(parseCommand({ type: "toggle" })).toEqual({ type: "toggle" });
    expect(parseCommand({ type: "next", extra: 1 })).toEqual({ type: "next" });
    expect(parseCommand({ type: "seek", ms: 61_000.4 })).toEqual({ type: "seek", ms: 61_000 });
  });

  it("keeps the volume between 0 and 1", () => {
    expect(parseCommand({ type: "volume", value: 3 })).toEqual({ type: "volume", value: 1 });
    expect(parseCommand({ type: "volume", value: -1 })).toEqual({ type: "volume", value: 0 });
  });

  it("drops anything else", () => {
    expect(parseCommand({ type: "seek", ms: -5 })).toBeNull();
    expect(parseCommand({ type: "seek", ms: "10" })).toBeNull();
    expect(parseCommand({ type: "eval", code: "x" })).toBeNull();
    expect(parseCommand(null)).toBeNull();
  });
});
