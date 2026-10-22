// Discord Rich Presence over Discord's local IPC socket: shows "Listening to" with the track playing.
// Off by default; it needs the ID of a Discord application the person creates (discord.com/developers).
// When Discord is not running, it tries again every so often and stays quiet.
import net from "node:net";
import { buildActivity, encodeFrame, FrameReader, Op, socketPaths, type NowPlaying } from "./discordProtocol";

const RETRY_MS = 20_000;

export type DiscordState = "off" | "connecting" | "connected" | "unavailable" | "error";

export class DiscordPresence {
  private socket: net.Socket | null = null;
  private ready = false;
  private enabled = false;
  private appId = "";
  private retry: ReturnType<typeof setTimeout> | undefined;
  private current: NowPlaying | null = null;
  private nonce = 0;
  state: DiscordState = "off";
  detail = "";

  configure(enabled: boolean, appId: string): void {
    const changed = enabled !== this.enabled || appId !== this.appId;
    this.enabled = enabled;
    this.appId = appId.trim();
    if (!changed) return;
    this.disconnect();
    if (this.enabled && /^\d{15,25}$/.test(this.appId)) {
      void this.connect();
    } else {
      this.state = this.enabled ? "error" : "off";
      this.detail = this.enabled ? "ID d'application Discord invalide (une suite de chiffres)." : "";
    }
  }

  update(track: NowPlaying | null): void {
    this.current = track;
    this.send();
  }

  private send(): void {
    if (!this.socket || !this.ready) return;
    this.socket.write(
      encodeFrame(Op.Frame, {
        cmd: "SET_ACTIVITY",
        args: { pid: process.pid, activity: this.current ? buildActivity(this.current) : null },
        nonce: String(++this.nonce),
      }),
    );
  }

  private async connect(): Promise<void> {
    this.state = "connecting";
    for (const path of socketPaths(process.platform, process.env)) {
      const socket = await new Promise<net.Socket | null>((resolve) => {
        const candidate = net.createConnection(path);
        candidate.once("connect", () => resolve(candidate));
        candidate.once("error", () => resolve(null));
      });
      if (!socket) continue;
      if (!this.enabled) {
        socket.destroy();
        return;
      }
      this.attach(socket);
      return;
    }
    this.state = "unavailable";
    this.detail = "Discord n'est pas ouvert sur cet ordinateur.";
    this.scheduleRetry();
  }

  private attach(socket: net.Socket): void {
    this.socket = socket;
    const reader = new FrameReader();
    socket.on("data", (chunk: Buffer) => {
      for (const frame of reader.push(chunk)) {
        const data = frame.data as { cmd?: string; evt?: string; data?: { message?: string } } | null;
        if (frame.op === Op.Ping) socket.write(encodeFrame(Op.Pong, frame.data));
        else if (frame.op === Op.Close) {
          this.state = "error";
          this.detail = data?.data?.message ?? "Discord a refusé la connexion (ID d'application ?).";
          socket.destroy();
        } else if (data?.cmd === "DISPATCH" && data.evt === "READY") {
          this.ready = true;
          this.state = "connected";
          this.detail = "";
          this.send();
        } else if (data?.evt === "ERROR") {
          this.detail = data.data?.message ?? "Erreur Discord";
        }
      }
    });
    socket.on("close", () => {
      this.socket = null;
      this.ready = false;
      if (this.enabled && this.state !== "error") {
        this.state = "unavailable";
        this.detail = "Discord a été fermé.";
        this.scheduleRetry();
      }
    });
    socket.on("error", () => undefined);
    socket.write(encodeFrame(Op.Handshake, { v: 1, client_id: this.appId }));
  }

  private scheduleRetry(): void {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.enabled && !this.socket && void this.connect(), RETRY_MS);
  }

  private disconnect(): void {
    clearTimeout(this.retry);
    this.ready = false;
    if (this.socket) {
      this.socket.removeAllListeners("close");
      this.socket.destroy();
      this.socket = null;
    }
  }
}
