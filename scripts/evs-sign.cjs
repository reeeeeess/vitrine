// electron-builder afterPack hook: signs the packaged app for Widevine VMP with castlabs EVS, which
// Spotify needs to trust this app's DRM in production. Runs only when the EVS account is set up
// (EVS_ACCOUNT_NAME); otherwise the build goes on unsigned, which suits development.
// On macOS this must run before code signing, which afterPack does.
const { execFileSync } = require("node:child_process");

exports.default = async function evsSign(context) {
  if (!process.env.EVS_ACCOUNT_NAME) {
    console.log("  • EVS: no EVS_ACCOUNT_NAME, skipping Widevine VMP signing");
    return;
  }
  // VMP exists on Windows and macOS only: Widevine on Linux plays without it
  if (context.electronPlatformName === "linux") return;
  const python = process.platform === "win32" ? "python" : "python3";
  execFileSync(python, ["-m", "castlabs_evs.vmp", "sign-pkg", context.appOutDir], { stdio: "inherit" });
};
