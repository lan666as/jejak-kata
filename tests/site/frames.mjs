// node tests/site/frames.mjs [cpu slowdown]   Frame times on the home page's hero at 360x740, twice the pixels, with the
// processor slowed (default 4x, a low-end phone): while the sea arrives and the first route draws itself, and while
// the reader scrolls down through the dive. Also says how the sea ended up drawn (its resolution drops on a slow screen).
// On a machine without a GPU the browser draws WebGL in software (SwiftShader), on the processor: the numbers here are
// then far worse than on any phone with a GPU, and say more about this machine than about the page.
import { base, browser, done } from "./serve.mjs";
const slow = +(process.argv[2] || 4);
const stats = (list) => { const s = [...list].sort((a, b) => a - b); return { frames: s.length, median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s.at(-1).toFixed(1) }; };
let failures = 0;
for (let run = 1; run <= 3; run++) {
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
  const renderer = await page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"), d = g?.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g ? "WebGL2" : "no WebGL2"; });
  // Every frame's time, from the moment the sea is in the page.
  await page.addInitScript(() => {
    window.__frames = []; let last = 0, on = false;
    const tick = (t) => { if (on && last) __frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__record = (yes) => { on = yes; if (yes) __frames = []; };
    new MutationObserver(() => document.querySelector(".hero .chart > canvas") && !window.__seen && ((window.__seen = 1), __record(true))).observe(document, { subtree: true, childList: true });
  });
  await page.goto(base + "#/");
  await page.waitForFunction(() => window.__seen, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 });
  await page.waitForTimeout(1900);  // the route takes two legs, 1800 ms
  const draw = stats(await page.evaluate(() => (__record(false), __frames)));
  await page.waitForTimeout(1500);
  await page.mouse.move(180, 300);
  await page.evaluate(() => __record(true));
  for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(16); }
  await page.waitForTimeout(300);
  const dive = stats(await page.evaluate(() => (__record(false), __frames)));
  const sea = await page.evaluate(() => document.querySelector(".hero .chart").sea?.state() || "flat chart");
  const ok = draw.median < 20 && Math.round(draw.worst) <= 50 && dive.median < 20 && Math.round(dive.worst) <= 50;  // 50 ms is three frames at 60 Hz
  failures += !ok;
  console.log(`${ok ? "ok  " : "FAIL"} run ${run}, processor ${slow}x slower, ${renderer}: arrival and route ${JSON.stringify(draw)} ms; dive ${JSON.stringify(dive)} ms; sea ${JSON.stringify(sea)}`);
  await page.close();
}
await done(failures);
