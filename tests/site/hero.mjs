// node tests/site/hero.mjs   The home page's hero three ways: with WebGL (the 3D sea, the dive), without WebGL (the flat
// night chart of chart.js, one screen tall), and with reduced motion (the 3D sea held still, no dive). In each: the
// first route is drawn, a chip sails another word, the sea has a text alternative, and nothing throws. Where the sea
// moves, its quality ladder (sea.js) only ever steps down, and settles within 1.5 s of its first step.
import { base, browser, done } from "./serve.mjs";
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
const NO_GL = () => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
};
const look = () => {
  const hero = document.querySelector(".hero"), chart = hero.querySelector(".chart"), sea = hero.querySelector(".hero-sea"), canvas = chart.querySelector(":scope > canvas");
  return { gl: chart.classList.contains("gl"), route: chart.dataset.route, dives: document.documentElement.classList.contains("dives"), extra: Math.round(hero.offsetHeight - sea.offsetHeight),
    label: canvas?.getAttribute("aria-label") || "", role: canvas?.getAttribute("role"), state: chart.sea?.state(), title: getComputedStyle(hero.querySelector("h1")).opacity };
};
for (const [name, options, init, expect] of [
  ["WebGL", {}, null, (s) => s.gl && s.dives && s.extra > 300 && s.role === "img" && !s.state.held],
  ["no WebGL", {}, NO_GL, (s) => !s.gl && !s.dives && s.extra === 0 && s.role === "application"],
  ["reduced motion", { reducedMotion: "reduce" }, null, (s) => s.gl && !s.dives && s.extra === 0 && s.role === "img" && s.state.held],
]) {
  for (const [width, height] of [[360, 740], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, ...options });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (init) await page.addInitScript(init);
    await page.addInitScript(() => { window.__rungs = []; setInterval(() => window.seaRung !== undefined && window.__rungs.at(-1)?.[1] !== window.seaRung && __rungs.push([performance.now(), window.seaRung]), 50); });
    await page.goto(base + "#/");
    await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const first = await page.evaluate(look);
    const rungs = await page.evaluate(() => __rungs), steps = rungs.slice(1), ladder = !first.gl || first.state.held ? !rungs.length
      : rungs.length > 0 && rungs.every((r, i) => !i || r[1] === rungs[i - 1][1] + 1) && (!steps.length || steps.at(-1)[0] - steps[0][0] <= 1500);
    await page.locator(".hero-try button", { hasText: "prabowo" }).click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(look);
    // Scrolled halfway down the hero's dive, the sea is still on screen under the header (held there while diving).
    await page.evaluate(() => scrollTo(0, innerHeight * 0.4)); await page.waitForTimeout(600);
    const held = await page.evaluate(() => Math.round(document.querySelector(".hero-sea").getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight));
    // And the dive has gone as far as the scroll has: the camera has pitched down (the sea's own depth says so).
    const depth = await page.evaluate(() => document.querySelector(".hero .chart").sea?.state?.().depth ?? 0);
    const ok = expect(first) && ladder && first.route && after.route === "prabowo" && (!first.gl || after.label.includes("prabowo")) && (first.dives ? held === 0 && depth > 0.1 : true) && !errors.length;
    log(`hero, ${name} @${width}px`, ok, `${first.gl ? "3D sea" : "flat chart"} (${first.role}, ${first.extra}px past the sea); first route ${first.route}, then ${after.route}; dive ${first.dives ? `${first.extra}px, sea ${held}px under the header halfway, depth ${depth}` : "none"}; ladder ${steps.length ? `${rungs[0][1]} -> ${steps.at(-1)[1]}, ${Math.round(steps.at(-1)[0] - steps[0][0])} ms from its first step to its last` : rungs.length ? `stays at ${rungs[0][1]}` : "none"}; ${first.state ? JSON.stringify(first.state) : ""}; errors ${errors.length}${errors.length ? " " + errors[0].slice(0, 90) : ""}`);
    await page.close();
  }
}
await done(failures);
