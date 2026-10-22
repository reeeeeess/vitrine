// Lyrics over the desktop, as Liner does: a transparent window above every other, that the mouse goes
// through, showing the line being sung. The main window works the line out and sends it here.
import { BrowserWindow, screen } from "electron";

export interface OverlayLine {
  line: string;
  next: string;
  title: string;
}

const WIDTH = 1100;
const HEIGHT = 170;

export class LyricsOverlay {
  private window: BrowserWindow | null = null;

  constructor(
    private readonly url: string,
    private readonly preload: string,
    /** tells the main window to start or stop sending lines */
    private readonly onChange: (open: boolean) => void,
  ) {}

  get open(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  toggle(): boolean {
    if (this.open) this.close();
    else this.show();
    return this.open;
  }

  show(): void {
    if (this.open) return;
    const area = screen.getPrimaryDisplay().workArea;
    const window = new BrowserWindow({
      width: Math.min(WIDTH, area.width - 40),
      height: HEIGHT,
      x: Math.round(area.x + (area.width - Math.min(WIDTH, area.width - 40)) / 2),
      y: area.y + area.height - HEIGHT - 120,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      title: "Vitrine — paroles",
      webPreferences: { preload: this.preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    });
    // above full-screen apps too, and never in the way of a click
    window.setAlwaysOnTop(true, "screen-saver");
    window.setIgnoreMouseEvents(true);
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.once("ready-to-show", () => window.showInactive());
    window.on("closed", () => {
      if (this.window === window) this.window = null;
      this.onChange(false);
    });
    void window.loadURL(`${this.url}#overlay`);
    this.window = window;
    this.onChange(true);
  }

  close(): void {
    this.window?.close();
    this.window = null;
  }

  send(line: OverlayLine): void {
    if (this.open) this.window!.webContents.send("overlay:line", line);
  }
}

/** A line from the page, checked before it reaches the overlay. */
export function parseOverlayLine(raw: unknown): OverlayLine | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 300) : "");
  return { line: text(input.line), next: text(input.next), title: text(input.title) };
}
