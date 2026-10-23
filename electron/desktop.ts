// What makes Vitrine feel at home on the desktop: an icon in the notification area with playback
// controls, closing into it instead of quitting, the Windows taskbar preview buttons, a notification
// when the track changes, starting with the session, and keyboard shortcuts that work from any app.
// Settings live in config.json ("desktop").
import { app, BrowserWindow, globalShortcut, Menu, nativeImage, net, Notification, Tray, type NativeImage } from "electron";
import path from "node:path";
import { cleanAccelerator, GLOBAL_SHORTCUTS, globalShortcuts, type DesktopCommand } from "./cli";
import { readConfig, updateConfig, type DesktopSettings, type Pin } from "./config";
import { applyAutostart } from "./linuxDesktop";
import { tr } from "./locale";

export type { DesktopSettings };

export interface DesktopNowPlaying {
  title: string;
  artist: string;
  imageUrl?: string;
  paused: boolean;
  /** the music plays inside the page (Electron's own player): freeing the page would stop it */
  holdsAudio?: boolean;
}

const DEFAULTS: DesktopSettings = { closeToTray: true, notifications: false, openAtLogin: false, globalShortcuts: true, freeWhenHidden: true, recaps: true };
/** passed when Windows or macOS starts Vitrine with the session: it opens straight into the tray */
export const HIDDEN_ARG = "--hidden";

const asset = (name: string) => path.join(__dirname, "../assets", name);

export function desktopSettings(): DesktopSettings {
  return { ...DEFAULTS, ...(readConfig().desktop ?? {}) };
}

export class Desktop {
  private tray: Tray | null = null;
  private quitting = false;
  private nowPlaying: DesktopNowPlaying | null = null;
  private lastNotified = "";
  private icons: Record<"play" | "pause" | "next" | "previous", NativeImage> | null = null;
  /** the shortcuts another app already holds */
  takenShortcuts: string[] = [];

  constructor(
    private readonly window: () => BrowserWindow | null,
    private readonly showWindow: () => void,
    /** commands the main process runs itself, without the page */
    private readonly own: Partial<Record<DesktopCommand, () => void>> = {},
  ) {}

  start(): void {
    app.on("before-quit", () => {
      this.quitting = true;
    });
    app.on("will-quit", () => globalShortcut.unregisterAll());
    this.applyLoginItem(desktopSettings().openAtLogin);
    this.applyShortcuts(desktopSettings().globalShortcuts);
    this.createTray();
  }

  /** Called for the main window: closing it hides it into the tray when the setting says so. */
  attach(window: BrowserWindow): void {
    window.on("close", (event) => {
      if (!this.quitting && this.tray && desktopSettings().closeToTray) {
        event.preventDefault();
        window.hide();
      }
    });
    this.updateThumbar();
  }

  settings(): DesktopSettings & { takenShortcuts: string[] } {
    return { ...desktopSettings(), takenShortcuts: this.takenShortcuts };
  }

  setSettings(next: DesktopSettings): DesktopSettings & { takenShortcuts: string[] } {
    updateConfig({ desktop: next });
    this.applyLoginItem(next.openAtLogin);
    this.applyShortcuts(next.globalShortcuts);
    return this.settings();
  }

  /** The global shortcuts and their keys, the person's own where changed. */
  keys(): { shortcuts: ReturnType<typeof globalShortcuts>; taken: string[] } {
    return { shortcuts: globalShortcuts(readConfig().globalKeys), taken: this.takenShortcuts };
  }

  /** New keys for one global shortcut (or its own back, without keys); two with the same keys swap. */
  setKeys(raw: unknown): ReturnType<Desktop["keys"]> {
    const input = (raw ?? {}) as { command?: unknown; accelerator?: unknown };
    const target = GLOBAL_SHORTCUTS.find((shortcut) => shortcut.command === input.command);
    if (target) {
      const current = globalShortcuts(readConfig().globalKeys);
      const own: Partial<Record<DesktopCommand, string>> = Object.fromEntries(current.map((shortcut) => [shortcut.command, shortcut.accelerator]));
      const wanted = input.accelerator === null ? target.accelerator : cleanAccelerator(input.accelerator);
      if (wanted) {
        const holder = current.find((shortcut) => shortcut.accelerator === wanted && shortcut.command !== target.command);
        if (holder) own[holder.command] = own[target.command];
        own[target.command] = wanted;
        // only what differs from Vitrine's own keys is kept
        const changed = Object.fromEntries(GLOBAL_SHORTCUTS.filter((shortcut) => own[shortcut.command] !== shortcut.accelerator).map((shortcut) => [shortcut.command, own[shortcut.command]]));
        updateConfig({ globalKeys: changed });
        this.applyShortcuts(desktopSettings().globalShortcuts);
      }
    }
    return this.keys();
  }

  /** A command from the tray, the taskbar, a shortcut or the command line, for the page to run. */
  command(command: DesktopCommand): void {
    const own = this.own[command];
    if (own) return own();
    // the page is freed: the main process answers, or brings the page back for what needs it
    if (!this.window()) return this.withoutPage?.(command);
    if (command === "flow") this.showWindow();
    this.window()?.webContents.send("desktop:command", command);
  }

  private pins: Pin[] = [];

  /** The pinned playlists, albums and artists, for the tray menu. */
  setPins(pins: Pin[]): void {
    this.pins = pins;
    this.refreshTray();
  }

  /** set by main.ts: what to do with a command while the page is freed */
  withoutPage: ((command: DesktopCommand) => void) | null = null;

  /** What the page says plays: refreshes the tray, the taskbar buttons and maybe notifies. */
  update(nowPlaying: DesktopNowPlaying | null): void {
    const previous = this.nowPlaying;
    this.nowPlaying = nowPlaying;
    this.refreshTray();
    this.updateThumbar();
    const key = nowPlaying ? `${nowPlaying.title}|${nowPlaying.artist}` : "";
    if (nowPlaying && !nowPlaying.paused && key !== this.lastNotified && previous !== null) {
      this.lastNotified = key;
      void this.notify(nowPlaying);
    } else if (nowPlaying && key !== this.lastNotified && previous === null) {
      this.lastNotified = key; // the track already playing at launch is not news
    }
  }

  private send(command: DesktopCommand): void {
    this.command(command);
  }

  private applyShortcuts(on: boolean): void {
    globalShortcut.unregisterAll();
    this.takenShortcuts = [];
    if (!on) return;
    for (const { accelerator, command } of globalShortcuts(readConfig().globalKeys)) {
      // false when another app holds it: Vitrine goes without that one
      if (!globalShortcut.register(accelerator, () => this.command(command))) this.takenShortcuts.push(accelerator);
    }
  }

  private applyLoginItem(openAtLogin: boolean): void {
    // only an installed app registers itself, not a development run
    if (!app.isPackaged) return;
    if (process.platform === "linux") return applyAutostart(openAtLogin, process.env.APPIMAGE, HIDDEN_ARG);
    if (process.platform === "win32" || process.platform === "darwin") app.setLoginItemSettings({ openAtLogin, args: [HIDDEN_ARG] });
  }

  private createTray(): void {
    const mac = process.platform === "darwin";
    const image = nativeImage.createFromPath(asset(mac ? "trayTemplate.png" : "tray.png"));
    if (image.isEmpty()) return;
    if (mac) image.setTemplateImage(true);
    this.tray = new Tray(image);
    this.tray.on("click", () => this.showWindow());
    this.refreshTray();
  }

  /** The tray and the taskbar's buttons again, in a new language. */
  relabel(): void {
    this.refreshTray();
    this.updateThumbar();
  }

  private refreshTray(): void {
    if (!this.tray) return;
    const playing = this.nowPlaying;
    this.tray.setToolTip(playing ? `${playing.title} — ${playing.artist}`.slice(0, 120) : "Vitrine");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: playing ? `${playing.title} — ${playing.artist}`.slice(0, 60) : tr("Rien en cours"), enabled: false },
        { type: "separator" },
        { label: tr(playing?.paused === false ? "Pause" : "Lecture"), enabled: Boolean(playing), click: () => this.send("toggle") },
        { label: tr("Suivant"), enabled: Boolean(playing), click: () => this.send("next") },
        { label: tr("Précédent"), enabled: Boolean(playing), click: () => this.send("previous") },
        ...(this.pins.length
          ? [
              { type: "separator" as const },
              { label: tr("Épinglés"), submenu: this.pins.map((pin) => ({ label: pin.name.slice(0, 50), click: () => this.send(`play:${pin.uri}`) })) },
            ]
          : []),
        { type: "separator" },
        { label: tr("Afficher Vitrine"), click: () => this.showWindow() },
        {
          label: tr("Quitter"),
          click: () => {
            this.quitting = true;
            app.quit();
          },
        },
      ]),
    );
  }

  /** The three buttons under the window's preview in the Windows taskbar. */
  private updateThumbar(): void {
    const window = this.window();
    if (process.platform !== "win32" || !window) return;
    this.icons ??= {
      play: nativeImage.createFromPath(asset("play.png")),
      pause: nativeImage.createFromPath(asset("pause.png")),
      next: nativeImage.createFromPath(asset("next.png")),
      previous: nativeImage.createFromPath(asset("previous.png")),
    };
    const playing = this.nowPlaying;
    const flags: ("enabled" | "disabled")[] = playing ? ["enabled"] : ["disabled"];
    window.setThumbarButtons([
      { tooltip: tr("Précédent"), icon: this.icons.previous, flags, click: () => this.send("previous") },
      { tooltip: tr(playing?.paused === false ? "Pause" : "Lecture"), icon: playing?.paused === false ? this.icons.pause : this.icons.play, flags, click: () => this.send("toggle") },
      { tooltip: tr("Suivant"), icon: this.icons.next, flags, click: () => this.send("next") },
    ]);
  }

  private lastAnnounce = 0;

  /**
   * A recap or a milestone, as a notification (once a day at most, so it stays a pleasure); a click
   * opens the stats.
   */
  announce(title: string, body: string): boolean {
    if (!desktopSettings().recaps || !Notification.isSupported() || Date.now() - this.lastAnnounce < 20 * 3_600_000) return false;
    this.lastAnnounce = Date.now();
    const notification = new Notification({ title: tr(title), body: tr(body), silent: true });
    notification.on("click", () => {
      this.showWindow();
      this.command("stats");
    });
    notification.show();
    return true;
  }

  private async notify(track: DesktopNowPlaying): Promise<void> {
    const window = this.window();
    // nothing to announce to someone looking at the app
    if (!desktopSettings().notifications || !Notification.isSupported() || (window?.isVisible() && window.isFocused())) return;
    let icon: NativeImage | undefined;
    if (track.imageUrl?.startsWith("https://i.scdn.co/")) {
      try {
        const response = await net.fetch(track.imageUrl);
        if (response.ok) icon = nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer()));
      } catch {
        // a notification without its artwork
      }
    }
    const notification = new Notification({ title: track.title, body: track.artist, icon, silent: true });
    notification.on("click", () => this.showWindow());
    notification.show();
  }
}
