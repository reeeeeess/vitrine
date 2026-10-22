// Renders build/icon.svg to build/icon.png (1024×1024), which electron-builder turns into the
// Windows .ico and the macOS .icns. Only needed after editing the SVG:
//   npm i --no-save playwright && npx playwright install chromium && node scripts/make-icon.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync(new URL("../build/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator("svg").screenshot({ path: new URL("../build/icon.png", import.meta.url).pathname, omitBackground: true });
await browser.close();
console.log("build/icon.png written");
