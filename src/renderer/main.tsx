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
import { ErrorBoundary } from "./components/ErrorBoundary";
import { connectErrorLog } from "./lib/errorLog";
import { languageSetting, startTranslating } from "./lib/i18n";
import { applyLite } from "./lib/lite";
import { applyTheme } from "./lib/theme";
import { LyricsOverlay } from "./views/LyricsOverlay";

connectErrorLog();
applyTheme();
applyLite();
// English: every text is swapped as it appears (lib/i18n.ts); the main process follows the same choice
startTranslating();
void window.vitrine?.app?.setLanguage(languageSetting()).catch(() => undefined);
// the window's own buttons sit over the page (titleBarOverlay, electron/main.ts): styles.css keeps their
// corner free with --wc-left and --wc-right
document.documentElement.dataset.platform = window.vitrine?.platform ?? "";

// the same page serves the lyrics overlay window (electron/overlay.ts), opened on #overlay
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>{location.hash === "#overlay" ? <LyricsOverlay /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
