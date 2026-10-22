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
import { applyTheme } from "./lib/theme";
import { LyricsOverlay } from "./views/LyricsOverlay";

applyTheme();

// the same page serves the lyrics overlay window (electron/overlay.ts), opened on #overlay
createRoot(document.getElementById("root")!).render(<StrictMode>{location.hash === "#overlay" ? <LyricsOverlay /> : <App />}</StrictMode>);
