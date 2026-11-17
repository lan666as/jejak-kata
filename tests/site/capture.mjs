// node tests/site/capture.mjs <out dir>   The main pages at phone and desktop width, light and dark, at the top and after a scroll.
import { base, browser, done } from "./serve.mjs";
const out = process.argv[2];
const pages = [["home", "#/", [0, 900]], ["stories", "#/cerita", [0]], ["story", "#/cerita/diamankan", [0, 700, 1500]], ["story2", "#/cerita/viral-polisi", [1200]], ["map", "#/peta", [0]], ["word", "#/kata/kpk", [0, 900]],
  ["play", "#/main", [0]], ["portrait", "#/potret/prabowo", [0]], ["findings", "#/temuan", [0, 800]], ["method", "#/metode", [0]], ["quiz", "#/kuis", [0]], ["tide", "#/pasang/1/person", [0]]];
for (const [width, height, scheme] of [[390, 780, "light"], [390, 780, "dark"], [1440, 900, "light"]]) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  for (const [name, hash, scrolls] of pages) {
    await page.goto(base + hash); await page.waitForTimeout(2600);
    for (const y of scrolls) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name}-${width}-${scheme}-${y}.png` }); }
  }
  await page.close();
}
await done(0);
