import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Spinner } from "./components/Artwork";
import { FullPlayer } from "./components/FullPlayer";
import { Header } from "./components/Header";
import { NowPlayingBar, run } from "./components/NowPlayingBar";
import { Toasts } from "./components/Toasts";
import type { AuthStatus, DrmStatus } from "./global";
import * as api from "./lib/spotify";
import { useStore } from "./lib/store";
import { ui } from "./lib/ui";
import * as engine from "./player/engine";
import { CollectionView } from "./views/Collection";
import { Home } from "./views/Home";
import { Library } from "./views/Library";
import { Login } from "./views/Login";
import { Search } from "./views/Search";
import { Stats } from "./views/Stats";

function Shell({ drm, onLogout }: { drm: DrmStatus; onLogout: () => void }) {
  const route = useStore(ui, (s) => s.route);
  const fullPlayer = useStore(ui, (s) => s.fullPlayer);
  const [profile, setProfile] = useState<api.Profile>();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.me().then(setProfile, () => undefined);
    void engine.startPlayback(drm.widevine, drm.detail);
  }, [drm]);

  // space plays and pauses, except while typing
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.code === "Space" && !typing) {
        event.preventDefault();
        run(engine.togglePlay);
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
    case "search":
      view = <Search query={route.query} />;
      break;
    case "library":
      view = <Library />;
      break;
    case "stats":
      view = <Stats />;
      break;
    case "playlist":
    case "album":
      view = <CollectionView key={`${route.name}-${route.id}`} kind={route.name} id={route.id} />;
      break;
  }

  return (
    <div className="relative h-full">
      <Header profile={profile} scrolled={scrolled} onLogout={onLogout} />
      <main
        className="main scrollbar-thin h-full overflow-y-auto px-8 pb-36 pt-24"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
        onClick={() => ui.get().devicesOpen && ui.set({ devicesOpen: false })}
      >
        <div className="mx-auto max-w-[1800px]">{view}</div>
      </main>
      <NowPlayingBar />
      <AnimatePresence>{fullPlayer && <FullPlayer />}</AnimatePresence>
    </div>
  );
}

export function App() {
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
    <>
      {!auth || !drm ? (
        <Spinner className="h-full" />
      ) : auth.loggedIn ? (
        <Shell drm={drm} onLogout={() => void logout()} />
      ) : (
        <Login status={auth} drm={drm} onLoggedIn={setAuth} />
      )}
      <Toasts />
    </>
  );
}
