// Bundles the main process and the preload script. VITRINE_CLIENT_ID, when set at build time,
// is built in so people are not asked for a Spotify Client ID.
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  define: {
    "process.env.VITRINE_CLIENT_ID": JSON.stringify(process.env.VITRINE_CLIENT_ID ?? ""),
    "process.env.VITRINE_LASTFM_KEY": JSON.stringify(process.env.VITRINE_LASTFM_KEY ?? ""),
    "process.env.VITRINE_LASTFM_SECRET": JSON.stringify(process.env.VITRINE_LASTFM_SECRET ?? ""),
  },
};

await build({ ...shared, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.js" });
await build({ ...shared, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.js" });
console.log("dist-electron/ built");
