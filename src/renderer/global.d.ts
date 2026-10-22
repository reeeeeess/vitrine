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
}

// The part of the Web Playback SDK this app uses.
export namespace SpotifySdk {
  interface Image {
    url: string;
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
    track_window: { current_track: SdkTrack | null };
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
