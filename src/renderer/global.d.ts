export interface AuthStatus {
  loggedIn: boolean;
  clientId: string;
  clientIdBuiltIn: boolean;
  persistent: boolean;
}

export interface DrmStatus {
  widevine: boolean;
  detail: string;
}

export interface LyricsResult {
  synced: string | null;
  plain: string | null;
  instrumental: boolean;
}

export interface VitrineBridge {
  platform: string;
  auth: {
    status(): Promise<AuthStatus>;
    login(clientId: string): Promise<AuthStatus>;
    logout(): Promise<void>;
    token(force?: boolean): Promise<string>;
  };
  drm: { status(): Promise<DrmStatus> };
  lyrics: { get(query: { track: string; artist: string; album?: string; durationMs?: number }): Promise<LyricsResult | null> };
  openExternal(url: string): Promise<void>;
  copy(text: string): Promise<void>;
  overlay: {
    toggle(): Promise<boolean>;
    status(): Promise<boolean>;
    send(line: OverlayLine): Promise<void>;
    onStatus(listener: (open: boolean) => void): () => void;
    onLine(listener: (line: OverlayLine) => void): () => void;
  };
  window: { setMini(on: boolean): Promise<boolean> };
  info(): Promise<AppInfo>;
  launchSpotify(): Promise<"app" | "protocol" | null>;
  equalizer: {
    get(): Promise<EqualizerStatus>;
    set(settings: EqualizerSettings): Promise<EqualizerStatus>;
    openEditor(): Promise<void>;
  };
  moments: {
    get(): Promise<MomentMark[]>;
    set(moments: MomentMark[]): Promise<MomentMark[]>;
  };
  pins: {
    get(): Promise<Pin[]>;
    set(pins: Pin[]): Promise<Pin[]>;
  };
  desktop: {
    get(): Promise<DesktopSettings & { takenShortcuts: string[] }>;
    set(settings: DesktopSettings): Promise<DesktopSettings & { takenShortcuts: string[] }>;
    update(nowPlaying: { title: string; artist: string; imageUrl?: string; paused: boolean; holdsAudio?: boolean } | null): Promise<void>;
    onCommand(listener: (command: "toggle" | "next" | "previous" | "like" | "flow" | "lyrics" | "stats" | `play:${string}`) => void): () => void;
  };
  history: {
    add(play: HistoryPlay): Promise<void>;
    extend(at: string, playedMs: number): Promise<void>;
    summary(query: { days: number; source: "all" | "vitrine" | "spotify" | "import"; since?: number; until?: number }): Promise<import("./lib/listening").ListeningSummary>;
    insight(kind: "trackStats"): Promise<Record<string, import("./lib/insights").TrackStat>>;
    insight(kind: "quickPicks"): Promise<import("./lib/insights").QuickPick[]>;
    insight(kind: "moment"): Promise<import("./lib/insights").Moment | null>;
    insight(kind: "iceberg"): Promise<import("./lib/insights").IcebergLevel[] | null>;
    insight(kind: "week"): Promise<import("./lib/insights").WeekRecap | null>;
    insight(kind: "monthTop" | "yearTop"): Promise<{ uri: string; name: string; plays: number }[]>;
    info(): Promise<import("./lib/listening").HistoryInfo>;
    /** reads "recently played" now; resolves to how many plays were new */
    sync(): Promise<number>;
    /** null when the person cancelled the file dialog */
    import(): Promise<{ added: number; read: number; files: number } | null>;
    clear(): Promise<void>;
    /** false when the person cancelled the "Save as" dialog */
    export(): Promise<boolean>;
    enabled(): Promise<boolean>;
    setEnabled(on: boolean): Promise<boolean>;
  };
  browserPlayer: {
    status(): Promise<BrowserPlayerStatus | undefined>;
    start(): Promise<BrowserPlayerStatus | undefined>;
    stop(): Promise<void>;
    command(command: { type: "toggle" | "pause" | "resume" | "next" | "previous" } | { type: "seek"; ms: number } | { type: "volume"; value: number }): Promise<void>;
    onState(listener: (state: SpotifySdk.State | null) => void): () => void;
    onEvent(listener: (event: { type: string; message: string }) => void): () => void;
  };
  discord: {
    get(): Promise<DiscordInfo>;
    set(settings: { enabled: boolean; appId: string }): Promise<DiscordInfo>;
    update(nowPlaying: DiscordNowPlaying | null): Promise<void>;
  };
  updates: {
    get(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    install(): Promise<void>;
    subscribe(listener: (state: UpdateState) => void): () => void;
  };
}

export interface BrowserPlayerStatus {
  state: "off" | "starting" | "ready" | "error";
  browser: "Microsoft Edge" | "Google Chrome" | null;
  deviceId?: string;
  detail?: string;
}

export interface OverlayLine {
  line: string;
  next: string;
  title: string;
}

export interface DesktopSettings {
  closeToTray: boolean;
  notifications: boolean;
  openAtLogin: boolean;
  globalShortcuts: boolean;
  freeWhenHidden: boolean;
  recaps: boolean;
}

/** A play kept in this computer's listening history (electron/historyFile.ts). */
export interface HistoryPlay {
  at: string;
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistIds: string[];
  album: string;
  albumId?: string;
  image?: string;
  durationMs: number;
  playedMs: number;
  source?: "vitrine" | "spotify" | "import";
  device?: string;
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  gains: number[];
}

/** how the equalizer stands: Windows only, through Equalizer APO */
export interface EqualizerStatus {
  state: "unsupported" | "absent" | "needs-include" | "ready";
  settings: EqualizerSettings;
  includeLine?: string;
  configPath?: string;
}

/** an instant of a track, with a note (Moments) */
export interface MomentMark {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  image?: string;
  atMs: number;
  note: string;
  createdAt: string;
}

/** a playlist, album or artist pinned at the top of the library */
export interface Pin {
  uri: string;
  name: string;
  image?: string;
  kind: "playlist" | "album" | "artist";
}

export interface AppInfo {
  version: string;
  platform: string;
  packaged: boolean;
}

export interface DiscordInfo {
  enabled: boolean;
  appId: string;
  state: "off" | "connecting" | "connected" | "unavailable" | "error";
  detail: string;
}

export interface DiscordNowPlaying {
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  durationMs: number;
  positionMs: number;
  paused: boolean;
}

export interface UpdateState {
  status: "unsupported" | "idle" | "checking" | "downloading" | "ready" | "latest" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

// The part of the Web Playback SDK this app uses.
export namespace SpotifySdk {
  interface Image {
    url: string;
    width?: number | null;
  }
  interface SdkTrack {
    id: string | null;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string; uri: string }[];
    album: { name: string; uri: string; images: Image[] };
  }
  interface State {
    paused: boolean;
    position: number;
    duration: number;
    shuffle: boolean;
    repeat_mode: 0 | 1 | 2;
    context: { uri: string | null };
    track_window: { current_track: SdkTrack | null; next_tracks?: SdkTrack[] };
  }
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: "ready" | "not_ready", cb: (data: { device_id: string }) => void): void;
    addListener(event: "player_state_changed", cb: (state: State | null) => void): void;
    addListener(
      event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
      cb: (error: { message: string }) => void,
    ): void;
    togglePlay(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    nextTrack(): Promise<void>;
    previousTrack(): Promise<void>;
    seek(ms: number): Promise<void>;
    setVolume(volume: number): Promise<void>;
    activateElement(): Promise<void>;
  }
  interface PlayerConstructor {
    new (options: { name: string; getOAuthToken(cb: (token: string) => void): void; volume?: number }): Player;
  }
}

declare global {
  interface Window {
    vitrine: VitrineBridge;
    Spotify?: { Player: SpotifySdk.PlayerConstructor };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
