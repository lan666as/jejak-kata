// node tests/site/seas.mjs   The night sea away from the home hero, three ways (WebGL, no WebGL, reduced motion):
// the map's sea explored by mouse, keys and buttons (turn, tilt, come near, from above, Enter on the ringed word, up to
// four routes); the sea held still behind a page head, a story's cover (with the route of the story's word) and the
// footer; the GPU let go when the page turns; and in each case the fallback or the still, with nothing thrown.
import { base, browser, done } from "./serve.mjs";
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
const NO_GL = () => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
  delete window.WebGL2RenderingContext;
};
const fresh = async (options = {}, init) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, ...options });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  if (init) await page.addInitScript(init);
  return page;
};
const state = (page, selector) => page.evaluate((s) => document.querySelector(s)?.sea?.state() || null, selector);

for (const [name, options, init] of [["WebGL", {}, null], ["reduced motion", { reducedMotion: "reduce" }, null], ["no WebGL", {}, NO_GL]]) {
  const gl = name !== "no WebGL", held = name === "reduced motion";
  { // the map
    const p = await fresh(options, init);
    await p.goto(base + "#/peta/id-web-news-kompas/jokowi/prabowo"); await p.waitForSelector(".chart > canvas"); await p.waitForTimeout(2500);
    const first = await state(p, ".map-deep .chart");
    if (!gl) {
      const flat = await p.evaluate(() => ({ band: !!document.querySelector(".map-deep"), role: document.querySelector(".chart > canvas:last-of-type, .chart > canvas")?.getAttribute("role"), gl: !!document.querySelector(".chart.gl") }));
      log(`map, ${name}`, !flat.band && !flat.gl && !p.errors.length, `flat chart on paper: ${JSON.stringify(flat)}; errors ${p.errors.length} ${p.errors[0] || ""}`);
      await p.close();
    } else {
      const canvas = p.locator(".map-deep .chart > canvas").first(), box = await canvas.boundingBox();
      // Drag moves over the water; the right button turns; Ctrl and the wheel come nearer.
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
      const dragged = await state(p, ".map-deep .chart");
      await p.mouse.down({ button: "right" }); await p.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 6 }); await p.mouse.up({ button: "right" }); await p.waitForTimeout(400);
      const turned = await state(p, ".map-deep .chart");
      await p.keyboard.down("Control"); await p.mouse.wheel(0, -300); await p.keyboard.up("Control"); await p.waitForTimeout(500);
      const nearer = await state(p, ".map-deep .chart");
      log(`map, ${name}: drag, turn, come near`, first.routes === 2 && first.held === held && (dragged.aim.x !== first.aim.x || dragged.aim.z !== first.aim.z) && turned.aim.yaw !== dragged.aim.yaw && nearer.aim.dist < turned.aim.dist && !p.errors.length,
        `${first.routes} routes, held ${first.held}; aim ${JSON.stringify(first.aim)} -> dragged ${JSON.stringify(dragged.aim)} -> turned yaw ${turned.aim.yaw} -> dist ${nearer.aim.dist}; errors ${p.errors.length} ${p.errors[0] || ""}`);
      // The keys: zero shows everything, Shift and an arrow turns, plus comes near; Enter chooses the ringed word.
      await canvas.focus(); await p.keyboard.press("0"); await p.waitForTimeout(700);
      const whole = await state(p, ".map-deep .chart");
      await p.keyboard.press("Shift+ArrowLeft"); await p.keyboard.press("+"); await p.waitForTimeout(700);
      const keyed = await state(p, ".map-deep .chart"), before = await p.locator(".picked li").count();
      await p.keyboard.press("Enter"); await p.waitForTimeout(1800);
      const after = await p.locator(".picked li").count(), routes = (await state(p, ".map-deep .chart")).routes;
      log(`map, ${name}: keys`, whole.aim.dist > 2 && keyed.aim.yaw !== whole.aim.yaw && keyed.aim.dist < whole.aim.dist && !!keyed.ringed && after === before + 1 && routes === after,
        `0 -> dist ${whole.aim.dist}; Shift+Left, + -> yaw ${keyed.aim.yaw}, dist ${keyed.aim.dist}; ringed "${keyed.ringed}"; Enter: ${before} -> ${after} words, ${routes} routes`);
      // From above: the sea becomes the chart on paper, and the legend takes the paper's colours.
      await p.click('.map-deep .zoom [data-k="above"]'); await p.waitForTimeout(1400);
      const above = await p.evaluate(() => ({ depth: document.querySelector(".map-deep .chart").sea.state().depth, pressed: document.querySelector('[data-k="above"]').getAttribute("aria-pressed"), legend: getComputedStyle(document.querySelector(".map-deep .legend i.s3")).backgroundColor, seq: getComputedStyle(document.documentElement).getPropertyValue("--seq-3").trim() }));
      log(`map, ${name}: from above`, above.depth === 1 && above.pressed === "true" && !p.errors.length, `${JSON.stringify(above)}; errors ${p.errors.length}`);
      // Nothing is drawn while nothing moves (the sea sleeps): no frame requested a second after the last move.
      const idle = await p.evaluate(() => new Promise((ok) => { let n = 0; const raf = requestAnimationFrame; window.requestAnimationFrame = (f) => (n++, raf(f)); setTimeout(() => ((window.requestAnimationFrame = raf), ok(n)), 1000); }));
      log(`map, ${name}: asleep when still`, idle <= 2, `${idle} frames asked for in a still second`);
      await p.close();
    }
  }
  { // the held seas: a page head, a story's cover with its word's route, the footer; let go on a page turn
    const p = await fresh(options, init);
    await p.goto(base + "#/main"); await p.waitForTimeout(2500);
    const head = await state(p, ".page-head .chart");
    await p.evaluate(() => (window.__old = document.querySelector(".page-head .chart")));
    await p.evaluate(() => (location.hash = "#/cerita/diamankan")); await p.waitForTimeout(3000);
    const ended = await p.evaluate(() => window.__old?.sea?.state().ended ?? null), cover = await state(p, ".cover .chart");
    const coverLabel = await p.evaluate(() => document.querySelector(".cover .chart > canvas")?.getAttribute("aria-label") || "");
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(2500);
    const foot = await state(p, ".foot-shore .chart"), graticule = await p.evaluate(() => document.querySelectorAll(".shore-sea .graticule").length);
    const titles = await p.evaluate(() => [...document.querySelectorAll("h1")].map((h) => h.classList.contains("rising")));
    const ok = gl ? head?.held && head.points <= 2500 && ended === true && cover?.held && cover.routes === 1 && coverLabel.includes("diamankan") && foot?.held : !head && !cover && !foot && graticule >= 2;
    log(`held seas, ${name}`, ok && (held ? titles.every((r) => !r) : true) && !p.errors.length,
      `head ${JSON.stringify(head && { held: head.held, points: head.points })}; old head's sea let go: ${ended}; cover ${JSON.stringify(cover && { held: cover.held, routes: cover.routes })} "${coverLabel.slice(-40)}"; footer ${!!foot}; graticules ${graticule}; titles rising ${titles}; errors ${p.errors.length} ${p.errors[0] || ""}`);
    await p.close();
  }
}
await done(failures);
