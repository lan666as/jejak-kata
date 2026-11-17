// node tests/site/shot.mjs <hash> <out.png> [width] [scroll]   One screenshot of one address, to look at.
import { base, browser, done } from "./serve.mjs";
const [hash, out, width = "1280", scroll = "0"] = process.argv.slice(2);
const page = await browser.newPage({ viewport: { width: +width, height: +width > 700 ? 800 : 740 }, colorScheme: +width > 700 ? "light" : "dark" });
await page.goto(base + hash);
await page.waitForTimeout(3000);
await page.mouse.wheel(0, +scroll);
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
await done(0);
