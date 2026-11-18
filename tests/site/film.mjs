// node tests/site/film.mjs <site url> <out dir> [desktop|phone]   The site presented to a jury, as a person would show it,
// recorded with Playwright's video: at 1440x900 with a mouse, and at 390x844 by touch. In order: the arrival on the first
// page (the sea lights up, the first route sails, the notes say what a light and a route are); a word typed and sailed;
// the dive, the sea turning into the chart; a story opened from its card (the cover, several steps, the landing); the
// map (turned, tilted, a second word added, seen from above and back); a word's page and its voyage played; the share
// sheet. The pointer moves on the site's curve and pauses where a person would. Meant for a machine with a GPU (it
// launches the full browser with the GPU switches gpu.mjs uses); on a machine without one it runs, slowly, to check it.
// The videos are <out>/film-desktop.webm and <out>/film-phone.webm; nothing here is part of a deploy.
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const [url, out = "film", only] = process.argv.slice(2);
if (!url) (console.error("node tests/site/film.mjs <site url> <out dir> [desktop|phone]"), process.exit(2));
mkdirSync(out, { recursive: true });
const { chromium } = await import("playwright").catch(() => import("playwright-core"));
const GPU = ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu"];
const browser = await chromium.launch({ headless: true, channel: "chromium", args: GPU }).catch(() => chromium.launch({ args: GPU }));
const at = (route) => new URL(route, url).href;  // "#/peta" on the live site is sent on to its own address
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const started = Date.now(), say = (what) => console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s  ${what}`);

/** A person in front of the page: a pointer (or a finger) that moves on a curve and pauses, and an eased scroll. */
function presenter(page, touch) {
  let x = 720, y = 450;
  const pause = (ms) => page.waitForTimeout(ms);
  /** The pointer glides to a point (or the middle of what a selector names) in `ms`, a frame at a time. */
  const glide = async (to, ms = 900) => {
    const [tx, ty] = typeof to === "string" ? await page.locator(to).first().boundingBox().then((b) => [b.x + b.width / 2, b.y + b.height / 2]) : to;
    if (!touch) for (let f = 1, n = Math.max(2, Math.round(ms / 16)); f <= n; f++) {
      const e = ease(f / n);
      await page.mouse.move(x + (tx - x) * e, y + (ty - y) * e - Math.sin(Math.PI * e) * 24);  // a slight arc, as a hand moves
      await pause(16);
    }
    [x, y] = [tx, ty];
  };
  /** Glide there, rest a moment, and press (a tap by touch). */
  const press = async (to, ms) => {
    await page.locator(typeof to === "string" ? to : "body").first().scrollIntoViewIfNeeded().catch(() => {});
    await glide(to, ms);
    await pause(220);
    touch ? await page.touchscreen.tap(x, y) : await page.mouse.click(x, y);
  };
  /** The page scrolls to `top` (a number, or a selector's top under the header) on the site's curve. */
  const scroll = async (top, ms = 2400) => {
    const y = typeof top === "number" ? top : await page.evaluate((s) => scrollY + document.querySelector(s).getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight, top);
    await page.evaluate(([to, ms]) => new Promise((done) => {
      const from = scrollY, t0 = performance.now(), e = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
      document.documentElement.style.scrollSnapType = "none";  // a presenter's scroll is not caught by a story's steps
      const tick = (t) => { const f = Math.min(1, (t - t0) / ms); scrollTo(0, from + (to - from) * e(f)); f < 1 ? requestAnimationFrame(tick) : (document.documentElement.style.scrollSnapType = "", done()); };
      requestAnimationFrame(tick);
    }), [y, ms]);
  };
  /** Fingers (CDP touch points) moving together from points to points in `ms`, then lifted. */
  const fingers = async (cdp, paths, ms = 700) => {
    const points = (f) => paths.map(([[x0, y0], [x1, y1]], id) => ({ x: x0 + (x1 - x0) * ease(f), y: y0 + (y1 - y0) * ease(f), id }));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(0) });
    for (let f = 1, n = Math.round(ms / 16); f <= n; f++) (await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(f / n) }), await pause(16));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  /** Drag over a box from one point to another (a fraction of it), with a button, on the curve. */
  const drag = async (box, [fx0, fy0], [fx1, fy1], { button = "left", shift = false, ms = 1400 } = {}) => {
    const [x0, y0, x1, y1] = [box.x + box.width * fx0, box.y + box.height * fy0, box.x + box.width * fx1, box.y + box.height * fy1];
    await glide([x0, y0], 500);
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.down({ button });
    for (let f = 1, n = Math.round(ms / 16); f <= n; f++) (await page.mouse.move(x0 + (x1 - x0) * ease(f / n), y0 + (y1 - y0) * ease(f / n)), await pause(16));
    await page.mouse.up({ button });
    if (shift) await page.keyboard.up("Shift");
    [x, y] = [x1, y1];
  };
  return { pause, glide, press, scroll, fingers, drag };
}

async function film(name, viewport, scale, touch) {
  const size = { width: viewport.width * Math.min(scale, 2), height: viewport.height * Math.min(scale, 2) };  // the video at the screen's own pixels (Playwright's video is VP8 at a fixed rate: the size is what can be raised)
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch, colorScheme: "dark", recordVideo: { dir: out, size } });
  const page = await context.newPage(), cdp = touch ? await context.newCDPSession(page) : null, p = presenter(page, touch);
  page.on("pageerror", (e) => say(`page error: ${e.message}`));
  const nav = async (to) => (touch ? (await p.press("#menu-button", 500), await p.pause(700), await p.press(`#menu nav a[data-to="${to}"]`, 600)) : await p.press(`.masthead nav a[data-to="${to}"]`, 900));

  say(`${name}: the arrival`);
  await page.goto(at("#/"));
  await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 60000 }).catch(() => {});
  await p.pause(5200);  // the words come on, the first route sails, the notes appear

  say(`${name}: a word typed and sailed`);
  await p.press(".hero .suggest input", 1100);
  await page.keyboard.type("nusantara", { delay: 110 });
  await p.pause(500);
  await page.keyboard.press("Enter");
  await p.pause(5500);
  if (!touch) (await p.glide([viewport.width * 0.78, viewport.height * 0.45], 1600), await p.glide([viewport.width * 0.62, viewport.height * 0.6], 1600));  // the sea leans to the pointer
  else await p.press(".hero-try li:nth-child(3) button", 600), await p.pause(5000);  // by touch, a chip sails another word

  say(`${name}: the dive`);
  await p.scroll(".featured", 5200);
  await p.pause(1800);

  say(`${name}: a story, from its card`);
  if (!touch) await p.glide(".featured .story-card", 1200), await p.pause(900);  // the card leans to the pointer
  await p.press(".featured .story-card", 600);
  await page.waitForSelector(".cover .chart, .cover.lit", { timeout: 30000 }).catch(() => {});
  await p.pause(3500);
  await p.press(".begin", 900);
  await p.pause(2600);
  for (let i = 0; i < 4; i++) {
    touch ? await p.fingers(cdp, [[[viewport.width / 2, viewport.height * 0.7], [viewport.width / 2, viewport.height * 0.35]]], 450) : await page.keyboard.press("ArrowDown");
    await p.pause(2600);
  }
  await p.scroll(".landing", 3000);
  await p.pause(3200);

  say(`${name}: the map`);
  await p.scroll(0, 1200);
  await nav("peta");
  await page.waitForSelector(".map-deep .chart > canvas", { timeout: 30000 }).catch(() => {});
  await p.pause(3500);
  const sea = await page.locator(".map-deep .chart > canvas").first().boundingBox();
  if (sea && !touch) {
    await p.drag(sea, [0.55, 0.55], [0.4, 0.5], { button: "right", ms: 1800 });  // turn
    await p.pause(800);
    await p.drag(sea, [0.5, 0.65], [0.5, 0.45], { shift: true, ms: 1400 });  // tilt
    await p.pause(800);
  } else if (sea) {
    await p.scroll(Math.max(0, (await page.evaluate(() => scrollY)) + sea.y - 56), 900);
    const [cx, cy] = [viewport.width / 2, 56 + sea.height / 2];
    await p.fingers(cdp, [[[cx - 60, cy], [cx, cy - 60]], [[cx + 60, cy], [cx, cy + 60]]], 1200);  // twist to turn
    await p.pause(700);
    await p.fingers(cdp, [[[cx - 60, cy + 60], [cx - 60, cy - 20]], [[cx + 60, cy + 60], [cx + 60, cy - 20]]], 1000);  // two fingers up: tilt
    await p.pause(700);
  }
  await p.press(".map-steer .suggest input", 900);
  await page.keyboard.type("prabowo", { delay: 110 });
  await page.keyboard.press("Enter");
  await p.pause(3500);
  await p.press('.map-deep .zoom [data-k="above"]', 900);
  await p.pause(3200);
  await p.press('.map-deep .zoom [data-k="above"]', 700);
  await p.pause(2500);

  say(`${name}: a word's page`);
  await page.goto(at("#/kata/kpk"));
  await page.waitForSelector(".lens-section svg", { timeout: 30000 }).catch(() => {});
  await p.pause(3000);
  await p.scroll(".lens-section", 2200);
  await p.pause(1200);
  await p.press(".lens-section .player button", 900);
  await p.pause(6000);

  say(`${name}: the share sheet`);
  await page.goto(at("#/cerita/oknum"));
  await page.waitForSelector(".cover .share", { timeout: 30000 }).catch(() => {});
  await p.pause(2500);
  await p.press(".cover .share > summary", 1000);
  await p.pause(3200);

  await context.close();
  const file = join(out, `film-${name}.webm`);
  renameSync(await page.video().path(), file);
  say(`${name}: ${file}`);
}

if (only !== "phone") await film("desktop", { width: 1440, height: 900 }, 1, false);
if (only !== "desktop") await film("phone", { width: 390, height: 844 }, 3, true);
await browser.close();
