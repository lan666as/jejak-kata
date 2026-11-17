// node tests/site/frames.mjs [cpu slowdown]   Frame times on the home page's hero at 360x740, twice the pixels, with the
// processor slowed (default 4x, a low-end phone): while the first route draws itself, and while the chart is dragged.
import { base, browser, done } from "./serve.mjs";
const slow = +(process.argv[2] || 4);
const stats = (list) => { const s = [...list].sort((a, b) => a - b); return { frames: s.length, median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s.at(-1).toFixed(1) }; };
let failures = 0;
for (let run = 1; run <= 3; run++) {
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
  // Every frame's time, from the moment the route is first drawn.
  await page.addInitScript(() => {
    window.__frames = []; let last = 0, on = false;
    const tick = (t) => { if (on && last) __frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__record = (yes) => { on = yes; if (yes) __frames = []; };
    new MutationObserver(() => document.querySelector(".hero .chart[data-route]") && !window.__seen && ((window.__seen = 1), __record(true))).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-route"] });
  });
  await page.goto(base + "#/");
  await page.waitForFunction(() => window.__seen, null, { timeout: 30000 });
  await page.waitForTimeout(1900);  // the route takes two legs, 1800 ms
  const draw = stats(await page.evaluate(() => (__record(false), __frames)));
  await page.waitForTimeout(2500);  // the whole lens has come and been painted
  await page.evaluate(() => __record(true));
  const box = await page.locator(".hero .chart > canvas").boundingBox();
  await page.mouse.move(box.x + 180, box.y + 150); await page.mouse.down();
  for (let i = 1; i <= 60; i++) await page.mouse.move(box.x + 180 - 2 * i, box.y + 150 + i);
  await page.mouse.up();
  const drag = stats(await page.evaluate(() => (__record(false), __frames)));
  const ok = draw.median < 20 && Math.round(draw.worst) <= 50 && drag.median < 20 && Math.round(drag.worst) <= 50;  // 50 ms is three frames at 60 Hz
  failures += !ok;
  console.log(`${ok ? "ok  " : "FAIL"} run ${run}, processor ${slow}x slower: route drawing ${JSON.stringify(draw)} ms; dragging ${JSON.stringify(drag)} ms`);
  await page.close();
}
await done(failures);
