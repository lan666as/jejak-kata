// node tests/site/fails.mjs   No dead pages: for each family of pages, a data file it needs fails (its first two
// requests are cut off, slowly), at 390 and 1440 wide. While it waits, the part shows a skeleton; the file is asked
// for a second time on its own (one retry); then the part says so with a "Try again" button (no "data not available"
// and an empty page); pressing it brings the part without reloading the page.
import { base, browser, done } from "./serve.mjs";
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
// [family, address, the file that fails, what shows the part is there, where to scroll for it]
const CASES = [
  ["home: how it is measured", "#/", "lenses.json", ".measure-number:not(:empty)", ".measure"],
  ["a story's figure", "#/cerita/kata-korupsi", "together.json", "#scene-0 .stage-figure .plate svg", null],
  ["a word", "#/kata/kpk", "id-web-news-kompas/meta.json", ".lens-section", null],
  ["findings", "#/temuan", "id-web-news-kompas/meta.json", ".duets svg", null],
  ["the map", "#/peta", "id-web-news-kompas/first.json", ".chart > canvas", null],
  ["play: the quiz", "#/kuis", "quiz.json", ".choices button", null],
];
for (const width of [390, 1440]) for (const [name, hash, file, there, scroll] of CASES) {
  const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 900 } }), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let asked = 0;
  await page.route(`**/data/${file}`, async (route) => (++asked <= 2 ? (await new Promise((r) => setTimeout(r, 400)), route.abort("connectionreset")) : route.continue()));
  // Whether a skeleton was ever in the page, and whether the page was loaded again (it must not be).
  await page.addInitScript(() => { window.__loads = (window.__loads || 0) + 1; new MutationObserver(() => document.querySelector(".skeleton") && (window.__skeleton = true)).observe(document, { childList: true, subtree: true }); });
  await page.goto(base + hash);
  if (scroll) { await page.waitForSelector(scroll); await page.evaluate((s) => document.querySelector(s).scrollIntoView(), scroll); }
  const failed = await page.waitForSelector(".failed button", { timeout: 15000 }).then(() => true, () => false);
  const said = failed ? await page.locator(".failed").first().innerText() : "";
  const before = { asked, skeleton: await page.evaluate(() => !!window.__skeleton), dead: await page.evaluate(() => /Data belum tersedia|not available yet/.test(document.body.innerText)) };
  await page.evaluate(() => (window.__same = 1));
  if (failed) await page.locator(".failed button").first().click();
  const back = await page.waitForSelector(there, { timeout: 20000 }).then(() => true, () => false);
  const after = await page.evaluate(() => ({ same: window.__same === 1, failed: document.querySelectorAll(".failed").length }));
  log(`${name} @${width}px`, before.skeleton && before.asked === 2 && failed && !before.dead && back && after.same && !after.failed && !errors.length,
    `skeleton ${before.skeleton}; asked ${before.asked} times before failing; says "${said.replace(/\s+/g, " ").slice(0, 60)}"; after "Try again": ${back ? "there" : "missing"}, page not reloaded ${after.same}, failures left ${after.failed}; errors ${errors.length} ${errors[0] || ""}`);
  await page.close();
}
await done(failures);
