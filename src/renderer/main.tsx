import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyLite } from "./lib/lite";
import { applyTheme } from "./lib/theme";
import { LyricsOverlay } from "./views/LyricsOverlay";

applyTheme();
applyLite();
// the window's own buttons sit over the page (titleBarOverlay, electron/main.ts): styles.css keeps their
// corner free with --wc-left and --wc-right
document.documentElement.dataset.platform = window.vitrine?.platform ?? "";

// the same page serves the lyrics overlay window (electron/overlay.ts), opened on #overlay
createRoot(document.getElementById("root")!).render(<StrictMode>{location.hash === "#overlay" ? <LyricsOverlay /> : <App />}</StrictMode>);
