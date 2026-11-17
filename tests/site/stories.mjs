// node tests/site/stories.mjs   Scrolls every story like a reader, down then up, at desktop and phone width, and fails on any problem.
// A caption is judged while it is where captions are read (the middle of the screen; on a phone the middle of
// what the pinned figure leaves free): then the figure must be whole on screen, clear of the header, showing that
// caption's moment, and the caption itself must be whole. It also counts screens inside a story with no caption.
import { STORIES } from "../../site/text.js";
import { base, browser, done } from "./serve.mjs";
const slugs = STORIES.map((s) => s.slug);
const state = () => {
  const vh = innerHeight, wide = innerWidth > 760, header = document.querySelector("header");
  const head = getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().bottom : 0;
  const boxes = [...document.querySelectorAll(".scrolly")].filter((b) => { const r = b.getBoundingClientRect(); return r.top < vh * 0.2 && r.bottom > vh * 0.8; });
  if (!boxes.length) return { inside: false };
  const box = boxes[0], pin = box.querySelector(".pin").firstElementChild.getBoundingClientRect();
  const line = wide ? vh / 2 : (Math.min(pin.bottom, vh * 0.6) + vh) / 2;
  const all = [...box.querySelectorAll(".steps > div")].map((d) => ({ d, r: d.querySelector("p").getBoundingClientRect() }));
  const visible = all.filter((c) => c.r.bottom > (wide ? head : pin.bottom) + 20 && c.r.top < vh - 20);
  const read = all.filter((c) => Math.abs((c.r.top + c.r.bottom) / 2 - line) < vh * 0.08)[0];
  const on = box.querySelector(".steps > div.on"), k = read ? all.findIndex((c) => c === read) : -1;
  return { inside: true, visible: visible.length, k, onK: on ? [...box.querySelectorAll(".steps > div")].indexOf(on) : -1, text: read ? read.d.innerText.slice(0, 26).replace(/\n/g, " ") : "",
    underHeader: Math.round(Math.max(0, head - pin.top)), cutBelow: Math.round(Math.max(0, pin.bottom - vh)), offLeft: pin.left < -1 || pin.right > innerWidth + 1,
    captionCut: read ? read.r.top < (wide ? head : pin.bottom) - 1 || read.r.bottom > vh + 1 : false, y: Math.round(scrollY) };
};
let total = 0;
for (const [width, height, scheme] of [[1280, 800, "light"], [360, 740, "dark"]]) {
  for (const slug of slugs) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { window.__shift = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__shift += e.value))).observe({ type: "layout-shift", buffered: true }); });
    await page.goto(`${base}#/cerita/${slug}`);
    await page.waitForSelector(".scrolly", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
    const length = await page.evaluate(() => document.documentElement.scrollHeight);
    const problems = new Map(); let blank = 0, screens = 0, captions = new Set();
    const pass = async (from, to, step, label) => {
      for (let y = from; step > 0 ? y < to : y > to; y += step) {
        await page.mouse.wheel(0, step); await page.waitForTimeout(90);
        const s = await page.evaluate(state);
        if (!s.inside) continue;
        screens++;
        if (!s.visible) blank++;
        if (s.k < 0) continue;
        captions.add(`${s.y > 0 ? "" : ""}${s.text}`);
        const wrong = [];
        if (s.onK !== s.k) wrong.push(`figure is at caption ${s.onK + 1}, reader is at caption ${s.k + 1}`);
        if (s.underHeader > 3) wrong.push(`figure ${s.underHeader}px under the header`);
        if (s.cutBelow > 3) wrong.push(`figure cut ${s.cutBelow}px at the bottom`);
        if (s.offLeft) wrong.push("figure wider than the screen");
        if (s.captionCut) wrong.push("caption cut");
        const key = `${label} "${s.text}": ${wrong.join("; ")}`;
        if (wrong.length) problems.set(key, 1);
      }
    };
    await pass(0, length, 40, "down");
    await pass(length, 0, -40, "up");
    const shift = await page.evaluate(() => window.__shift);
    total += problems.size + errors.length + (shift > 0.05);
    console.log(`== ${slug} @${width}px ${scheme}: ${problems.size} problems at ${captions.size} captions read; ${blank} of ${screens} positions inside a pinned section had no caption on screen; layout shift ${shift.toFixed(3)}; errors ${errors.length}${errors.length ? " " + errors[0].slice(0, 90) : ""}`);
    [...problems.keys()].slice(0, 6).forEach((p) => console.log("   " + p));
    await page.close();
  }
}
console.log(total ? `${total} PROBLEMS` : "stories hold");
await done(total);
