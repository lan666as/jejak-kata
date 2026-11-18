// node tests/site/look.mjs <out dir> <width> <scheme> <name>=<hash>[@scroll,...] ...   Screenshots to look at while designing.
import { base, browser, done } from "./serve.mjs";
const [out, width, scheme, ...shots] = process.argv.slice(2);
const page = await browser.newPage({ viewport: { width: +width, height: +width >= 900 ? 900 : 740 }, colorScheme: scheme });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const shot of shots) {
  const [name, rest] = shot.split("="), [hash, scrolls = "0"] = rest.split("@");
  await page.goto(base + hash); await page.waitForTimeout(3200);
  for (const y of scrolls.split(",")) { await page.evaluate((y) => scrollTo(0, +y), y); await page.waitForTimeout(1100); await page.screenshot({ path: `${out}/${name}-${width}-${scheme}-${y}.png` }); }
}
console.log(errors.length ? errors.join("\n") : "no errors");
await done(0);
