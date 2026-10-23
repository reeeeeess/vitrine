// Renders build/icon.svg to build/icon.png (1024×1024), which electron-builder turns into the
// Windows .ico and the macOS .icns, and build/tray.svg to the tray icons in assets/ (colour for
// Windows and Linux, black "template" for the macOS menu bar). Only needed after editing an SVG:
//   npm i --no-save playwright && npx playwright install chromium && node scripts/make-icon.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync(new URL("../build/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator("svg").screenshot({ path: new URL("../build/icon.png", import.meta.url).pathname, omitBackground: true });

const tray = readFileSync(new URL("../build/tray.svg", import.meta.url), "utf8");
const variants = [
  { name: "tray", brackets: "#DC2626", bars: "#FFFFFF" },
  { name: "trayTemplate", brackets: "#000000", bars: "#000000" },
];
for (const { name, brackets, bars } of variants) {
  for (const [suffix, size] of [["", 16], ["@2x", 32]]) {
    const svg = tray.replace(/BRACKETS/g, brackets).replace(/BARS/g, bars).replace('width="32" height="32"', `width="${size}" height="${size}"`);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator("svg").screenshot({ path: new URL(`../assets/${name}${suffix}.png`, import.meta.url).pathname, omitBackground: true });
  }
}
await browser.close();
console.log("build/icon.png and assets/tray*.png written");
