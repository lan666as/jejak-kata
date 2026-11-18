// node tests/site/gpu.mjs <site url> <out dir>   Frame times and screen recordings of the live site on a machine with a
// GPU (a rented one: the VPS draws WebGL in software). Says which renderer drew, then for a phone and a desktop screen,
// at full speed and with the processor four times slower: the home hero's arrival and route, its dive, the map being
// dragged, a story being stepped through. Needs only playwright; nothing here is part of a deploy.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const [url, out = "gpu"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const TRIES = [["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu"], ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"], ["--use-gl=egl", "--ignore-gpu-blocklist", "--enable-gpu"], []];
const rendererOf = (page) => page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"), d = g?.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g ? "WebGL2" : "no WebGL2"; });
let browser, renderer;
for (const args of TRIES) {
  browser = await chromium.launch({ headless: true, args: ["--headless=new", ...args] });
  const page = await browser.newPage(); await page.goto("about:blank"); renderer = await rendererOf(page); await page.close();
  console.log(`${JSON.stringify(args)} -> ${renderer}`);
  if (!/SwiftShader|llvmpipe|no WebGL2/i.test(renderer)) break;
  await browser.close();
}
const stats = (list) => { const s = [...list].sort((a, b) => a - b); return s.length ? { frames: s.length, median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s.at(-1).toFixed(1), over33: s.filter((x) => x > 34).length } : { frames: 0 }; };
const frames = () => { window.__frames = []; let last = 0, on = false; const tick = (t) => { if (on && last) __frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); window.__record = (yes) => { on = yes; if (yes) __frames = []; }; };
const take = async (page) => stats(await page.evaluate(() => (__record(false), __frames)));
for (const [name, viewport, scale, touch] of [["phone", { width: 390, height: 844 }, 3, true], ["desktop", { width: 1440, height: 900 }, 1, false]]) {
  for (const slow of [1, 4]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: touch, isMobile: false, recordVideo: slow === 1 ? { dir: out, size: viewport } : undefined });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
    await page.addInitScript(frames);
    const line = {};
    // home: the arrival and the first route, then the dive
    await page.goto(url + "#/"); await page.evaluate(() => __record(true));
    await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2200); line.arrival = await take(page);
    await page.mouse.move(viewport.width / 2, viewport.height / 2); await page.evaluate(() => __record(true));
    for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 30); await page.waitForTimeout(16); }
    await page.waitForTimeout(500); line.dive = await take(page);
    line.sea = await page.evaluate(() => document.querySelector(".hero .chart")?.sea?.state?.() || null);
    // the map, dragged
    await page.goto(url + "#/peta"); await page.waitForTimeout(4000);
    const box = await page.locator("#view canvas").first().boundingBox().catch(() => null);
    if (box) {
      await page.evaluate(() => __record(true));
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      for (let i = 0; i < 60; i++) { await page.mouse.move(box.x + box.width / 2 + 3 * i * (i < 30 ? 1 : -1) + (i >= 30 ? 180 : 0), box.y + box.height / 2 + i); await page.waitForTimeout(16); }
      await page.mouse.up(); line.map = await take(page);
    }
    // a story, stepped through by key
    await page.goto(url + "#/cerita/kata-korupsi"); await page.waitForTimeout(3000);
    await page.locator(".begin").click().catch(() => {}); await page.waitForTimeout(1200);
    await page.evaluate(() => __record(true));
    for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(1100); }
    line.story = await take(page);
    console.log(`${name}, processor ${slow}x slower, ${renderer}: ${JSON.stringify(line)}`);
    await page.screenshot({ path: `${out}/${name}-${slow}x-story.png` });
    await context.close();
  }
}
await browser.close();
