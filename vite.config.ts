import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The packaged app gets a strict Content-Security-Policy. The dev server is left without one,
// because Vite's hot reload injects inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://sdk.scdn.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.fontshare.com",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob: https:",
  "frame-src https://sdk.scdn.co https://*.spotify.com",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "vitrine-csp",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  root: fileURLToPath(new URL("./src/renderer", import.meta.url)),
  base: "./",
  plugins: [react(), contentSecurityPolicy()],
  build: {
    outDir: fileURLToPath(new URL("./dist/renderer", import.meta.url)),
    emptyOutDir: true,
    target: "chrome130",
  },
  server: { port: 5173, strictPort: true },
});
