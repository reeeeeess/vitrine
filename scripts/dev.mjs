// Development: Vite serves the page with hot reload, Electron loads it from there.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";

const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();
const url = server.resolvedUrls.local[0];

await import("./build-main.mjs");

const electron = createRequire(import.meta.url)("electron");
const child = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
