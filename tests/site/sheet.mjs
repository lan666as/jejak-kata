// node tests/site/sheet.mjs <out.png> <width> <scheme> <slug> ...   Every scene of these stories at its first step, side by
// side on one sheet: to look at how each stage shares its room between figure and caption.
import { base, browser, done } from "./serve.mjs";
const [out, width, scheme, ...slugs] = process.argv.slice(2);
const page = await browser.newPage({ viewport: { width: +width, height: +width >= 900 ? 900 : 740 }, colorScheme: scheme });
const shots = [];
for (const slug of slugs) {
  await page.goto(`${base}#/cerita/${slug}`); await page.waitForSelector(".stage .plate svg", { timeout: 20000 }).catch(() => {});
  const scenes = await page.locator(".scene").count();
  for (let k = 0; k < scenes; k++) {
    await page.evaluate((k) => { const s = document.getElementById(`scene-${k}`), b = s.querySelector(".beat").offsetHeight; scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + b); }, k);
    await page.waitForTimeout(1600);
    shots.push({ name: `${slug} ${k + 1}`, src: "data:image/png;base64," + (await page.screenshot()).toString("base64") });
  }
}
const cols = +width >= 900 ? 3 : 6, w = +width >= 900 ? 480 : 300;
const sheet = await browser.newPage({ viewport: { width: cols * (w + 8), height: 400 } });
await sheet.setContent(`<body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:8px;font:12px sans-serif">${shots.map((s) => `<figure style="margin:0"><img src="${s.src}" style="width:${w}px;display:block"><figcaption>${s.name}</figcaption></figure>`).join("")}</body>`);
await sheet.screenshot({ path: out, fullPage: true });
await done(0);
