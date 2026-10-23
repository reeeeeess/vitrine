import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";
import { Spinner } from "./components/Artwork";
import { FullPlayer } from "./components/FullPlayer";
import { LyricsStage } from "./components/LyricsStage";
import { Roulette } from "./components/Roulette";
import { ScreenSaver } from "./components/ScreenSaver";
import { MiniPlayer } from "./components/MiniPlayer";
import { Header } from "./components/Header";
import { Ambiance } from "./components/Ambiance";
import { NowPanel, PANEL_ROOM, useNowPanel } from "./components/NowPanel";
import { NowPlayingBar, run } from "./components/NowPlayingBar";
import { PlaylistDialog } from "./components/PlaylistDialog";
import { QueuePanel } from "./components/QueuePanel";
import { Toasts } from "./components/Toasts";
import { MomentsView } from "./views/Moments";
import { UpNext } from "./components/UpNext";
import { ImagePreview } from "./components/ImagePreview";
import { VersionsPanel } from "./components/VersionsPanel";
import { EqualizerPanel } from "./components/EqualizerPanel";
import { ClassicMode } from "./components/ClassicMode";
import { Intro } from "./components/Intro";
import { retro, RetroVitrine } from "./components/RetroVitrine";
import { TrackMenuHost } from "./components/TrackMenu";
import type { AuthStatus, DrmStatus } from "./global";
import * as api from "./lib/spotify";
import { useStore } from "./lib/store";
import { errorMessage, formatTime } from "./lib/format";
import { lite } from "./lib/lite";
import { theme } from "./lib/theme";
import { navigate, notify, ui } from "./lib/ui";
import * as engine from "./player/engine";
import { connectDesktop } from "./player/desktopBridge";
import { connectDiscord } from "./player/discordBridge";
import { connectHistory } from "./player/history";
import { connectLoop } from "./player/loop";
import { connectKaraoke } from "./player/karaoke";
import { loadPins } from "./lib/pins";
import { addMoment, loadMoments, moments, reachedMoment } from "./lib/moments";
import { connectOverlay } from "./player/overlayBridge";
import { connectTrash } from "./player/trashBridge";
import { connectDynamicAccent } from "./player/dynamicAccent";
import { connectMediaSession } from "./player/mediaSession";
import { connectUpdates } from "./lib/updates";
import { ArtistView } from "./views/Artist";
import { CollectionView } from "./views/Collection";
import { Flow } from "./views/Flow";
import { Home } from "./views/Home";
import { Library } from "./views/Library";
import { LikedView } from "./views/Liked";
import { Login } from "./views/Login";
import { Search } from "./views/Search";
import { Settings } from "./views/Settings";
import { Stats } from "./views/Stats";

function Shell({ drm, onLogout }: { drm: DrmStatus; onLogout: () => void }) {
  const route = useStore(ui, (s) => s.route);
  const fullPlayer = useStore(ui, (s) => s.fullPlayer);
  const lyricsStage = useStore(ui, (s) => s.lyricsStage);
  const roulette = useStore(ui, (s) => s.roulette);
  const queueOpen = useStore(ui, (s) => s.queueOpen);
  const mini = useStore(ui, (s) => s.mini);
  const playlistDialog = useStore(ui, (s) => s.playlistDialog);
  const retroOpen = useStore(retro, (s) => s.period !== null);
  const mystic = useStore(theme, (s) => s.current === "mystic");
  // a new page animates in; a new search in the same page does not
  const routeKey = `${route.name}-${"id" in route ? route.id : ""}`;
  const [profile, setProfile] = useState<api.Profile>();
  const [scrolled, setScrolled] = useState(false);
  const panel = useNowPanel();

  useEffect(() => {
    api.me().then(setProfile, () => undefined);
    void engine.startPlayback(drm.widevine, drm.detail);
  }, [drm]);

  useEffect(() => connectMediaSession((error) => notify(errorMessage(error), "error")), []);
  useEffect(() => connectDiscord(), []);
  useEffect(() => connectDesktop((error) => notify(errorMessage(error), "error")), []);
  useEffect(() => connectDynamicAccent(), []);
  useEffect(() => connectUpdates(), []);
  useEffect(() => connectHistory(), []);
  useEffect(() => connectLoop(), []);
  useEffect(() => connectKaraoke(), []);
  useEffect(() => void loadPins(), []);
  useEffect(() => {
    void loadMoments();
    // the note of a moment shows when the song reaches it again
    let last = { uri: "", position: 0 };
    const timer = setInterval(() => {
      const state = engine.playback.get();
      const position = engine.currentPosition(state);
      const uri = state.track?.uri ?? "";
      const mark = !state.paused && uri === last.uri ? reachedMoment(moments.get().list, uri, last.position, position) : null;
      if (mark) notify(`📍 ${mark.note || `Votre moment à ${formatTime(mark.atMs)}`}`);
      last = { uri, position };
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => connectOverlay(), []);
  useEffect(() => connectTrash(), []);

  // space plays and pauses, except while typing; and the Music app's shortcuts (Mac): Ctrl+L goes to
  // the track playing, Ctrl+↑/↓ sets the volume, Ctrl+M marks a moment
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.code === "Space" && !typing) {
        event.preventDefault();
        run(engine.togglePlay);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || typing) return;
      const state = engine.playback.get();
      const key = event.key.toLowerCase();
      if (key === "l" && state.track?.albumId) {
        event.preventDefault();
        ui.set({ reveal: state.track.uri });
        navigate({ name: "album", id: state.track.albumId });
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        engine.setVolume(state.volume + (event.key === "ArrowUp" ? 0.05 : -0.05));
      } else if (key === "m" && state.track) {
        event.preventDefault();
        void addMoment(state.track, engine.currentPosition(state));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  let view: React.ReactNode;
  switch (route.name) {
    case "home":
      view = <Home name={profile?.name} />;
      break;
    case "flow":
      view = <Flow key={route.seed?.uri ?? "flow"} seed={route.seed} />;
      break;
    case "search":
      view = <Search query={route.query} />;
      break;
    case "library":
      view = <Library />;
      break;
    case "stats":
      view = <Stats />;
      break;
    case "liked":
      view = <LikedView />;
      break;
    case "moments":
      view = <MomentsView />;
      break;
    case "settings":
      view = <Settings profile={profile} onLogout={onLogout} />;
      break;
    case "artist":
      view = <ArtistView key={route.id} id={route.id} />;
      break;
    case "playlist":
    case "album":
      view = <CollectionView key={`${route.name}-${route.id}`} kind={route.name} id={route.id} />;
      break;
  }

  if (mini) return <MiniPlayer />;

  return (
    // isolate: the ambiance sits under the page, above the window's own background
    <div className="relative isolate h-full">
      <Ambiance />
      <Header profile={profile} scrolled={scrolled || route.name === "flow"} onLogout={onLogout} />
      {/* Flow takes the whole height between the header and the player bar, and scrolls on its own */}
      {route.name === "flow" ? (
        view
      ) : (
      <main
        className="main scrollbar-thin h-full overflow-y-auto px-8 pb-36 pt-24 transition-[margin] duration-300"
        // the "À l'écoute" panel takes the right of the window; the page and its scrollbar stop before it
        style={{ marginRight: panel ? PANEL_ROOM : 0 }}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
        onClick={() => ui.get().devicesOpen && ui.set({ devicesOpen: false })}
      >
        {/* pages come in as on mysticsaba.com: one curve for every movement, cubic-bezier(.22, 1, .36, 1) */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            className="mx-auto max-w-[1800px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: "easeIn" } }}
          >
            {view}
          </motion.div>
        </AnimatePresence>
      </main>
      )}
      <NowPanel />
      <NowPlayingBar />
      <AnimatePresence>{queueOpen && <QueuePanel />}</AnimatePresence>
      <AnimatePresence>{fullPlayer && <FullPlayer />}</AnimatePresence>
      <AnimatePresence>{lyricsStage && <LyricsStage />}</AnimatePresence>
      <AnimatePresence>{roulette && <Roulette />}</AnimatePresence>
      <AnimatePresence>{retroOpen && <RetroVitrine name={profile?.name} />}</AnimatePresence>
      <ImagePreview />
      <VersionsPanel />
      <EqualizerPanel />
      <ClassicMode />
      <Intro />
      <ScreenSaver />
      <AnimatePresence>{playlistDialog && <PlaylistDialog />}</AnimatePresence>
      <TrackMenuHost />
      {/* mysticsaba.com's film grain, over everything, in the Mystic theme */}
      {mystic && <div className="fx-grain pointer-events-none fixed inset-[-50%] z-[65] opacity-[0.045]" aria-hidden="true" />}
    </div>
  );
}

export function App() {
  const transitions = useStore(lite, (s) => s.effects.transitions);
  const [auth, setAuth] = useState<AuthStatus>();
  const [drm, setDrm] = useState<DrmStatus>();

  useEffect(() => {
    void Promise.all([window.vitrine.auth.status(), window.vitrine.drm.status()]).then(([status, drmStatus]) => {
      setAuth(status);
      setDrm(drmStatus);
    });
  }, []);

  const logout = async () => {
    await window.vitrine.auth.logout();
    // the Web Playback SDK and the polling hold the old session: start clean
    window.location.reload();
  };

  return (
    // light mode: panels and pages appear without sliding
    <MotionConfig reducedMotion={transitions ? "never" : "always"}>
      {!auth || !drm ? (
        <Spinner className="h-full" />
      ) : auth.loggedIn ? (
        <Shell drm={drm} onLogout={() => void logout()} />
      ) : (
        <Login status={auth} drm={drm} onLoggedIn={setAuth} />
      )}
      <Toasts />
      <UpNext />
    </MotionConfig>
  );
}
