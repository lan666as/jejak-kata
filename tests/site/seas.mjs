// node tests/site/seas.mjs   The night sea away from the home hero (and its touch), three ways (WebGL, no WebGL, reduced motion):
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
  if (gl) { // by touch, on a phone (CDP touch events, several fingers at once)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...options }), p = await context.newPage(), cdp = await context.newCDPSession(p);
    p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
    if (init) await p.addInitScript(init);
    /** Fingers moving at once, each from a point to a point, in eight steps; then lifted. */
    const fingers = async (...paths) => {
      const at = (t) => paths.map(([[x0, y0], [x1, y1]], id) => ({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, id }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
      for (let i = 1; i <= 8; i++) (await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(i / 8) }), await p.waitForTimeout(16));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await p.waitForTimeout(held ? 300 : 700);
    };
    const aim = async () => ({ ...(await state(p, ".map-deep .chart")).aim, y: await p.evaluate(() => Math.round(scrollY)) });
    // No word is named under the buttons: the names' canvas is empty there.
    const underButtons = () => p.evaluate(() => {
      const chart = document.querySelector(".map-deep .chart"), names = chart.querySelectorAll("canvas")[1], box = names.getBoundingClientRect(), z = chart.querySelector(".zoom").getBoundingClientRect(), r = names.width / box.width;
      const data = names.getContext("2d").getImageData((z.left - box.left) * r, (z.top - box.top) * r, z.width * r, z.height * r).data;
      let inked = 0; for (let i = 3; i < data.length; i += 4) inked += data[i] > 0; return inked;
    });
    await p.goto(base + "#/peta/id-web-news-kompas/jokowi"); await p.waitForSelector(".map-deep .chart > canvas"); await p.waitForTimeout(2500);
    const box = await p.locator(".map-deep .chart > canvas").first().boundingBox();
    await p.evaluate((y) => scrollTo(0, y), box.y - 56); await p.waitForTimeout(400);
    const top = 56, [cx, cy] = [box.width / 2, top + box.height / 2];
    const a0 = await aim();
    await fingers([[cx, cy], [cx + 100, cy + 40]]); const a1 = await aim();
    await fingers([[cx - 50, cy], [cx - 110, cy]], [[cx + 50, cy], [cx + 110, cy]]); const a2 = await aim();
    await fingers([[cx - 60, cy], [cx, cy - 60]], [[cx + 60, cy], [cx, cy + 60]]); const a3 = await aim();
    await fingers([[cx - 60, cy + 60], [cx - 60, cy - 30]], [[cx + 60, cy + 60], [cx + 60, cy - 30]]); const a4 = await aim();
    const under = await underButtons();
    log(`map by touch, ${name}: one finger moves, two pinch, twist and tilt`, (a1.x !== a0.x || a1.z !== a0.z) && a1.dist === a0.dist && a2.dist < a1.dist * 0.7 && a3.yaw > a2.yaw + 0.5 && a4.pitch < a3.pitch - 0.2 && Math.abs(a4.dist - a3.dist) < 0.01 && Math.abs(a4.yaw - a3.yaw) < 0.01 && a4.y === a0.y && !under,
      `drag ${a0.x},${a0.z} -> ${a1.x},${a1.z}; pinch dist ${a1.dist} -> ${a2.dist}; clockwise twist yaw ${a2.yaw} -> ${a3.yaw}; two up pitch ${a3.pitch} -> ${a4.pitch} (dist ${a4.dist}, yaw ${a4.yaw}); page still at ${a4.y}; ${under} inked pixels under the buttons`);
    const spot = await p.evaluate(() => document.querySelector(".map-deep .chart").sea.spot()), before = await p.locator(".picked li").count();
    await p.touchscreen.tap(spot.at[0], top + spot.at[1]); await p.waitForTimeout(1800);
    const picked = await p.locator(".picked li").allInnerTexts(), after = await aim();
    log(`map by touch, ${name}: a tap picks the nearest word`, picked.length === before + 1 && picked.at(-1).includes(spot.word) && Number.isFinite(after.pitch), `"${spot.word}": ${before} -> ${picked.length} picked; pitch afterwards ${after.pitch}`);
    // A swipe that starts outside the sea scrolls the page, and leaves the sea where it was.
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
    const b0 = await aim(), steer = await p.locator(".map-steer").boundingBox();
    await fingers([[200, steer.y + 10], [200, steer.y - 290]]); const b1 = await aim();
    log(`map by touch, ${name}: a swipe outside the sea scrolls the page`, b1.y > b0.y + 150 && b1.x === b0.x && b1.z === b0.z && b1.dist === b0.dist, `scroll ${b0.y} -> ${b1.y}`);
    // The home hero: a swipe up scrolls the page; a tap on the open water sails the nearest word.
    await p.goto(base + "#/"); await p.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 20000 }); await p.waitForTimeout(held ? 800 : 3500);
    const near = await p.evaluate(() => { const c = document.querySelector(".hero .chart"), s = c.sea.spot(c.clientWidth / 2, c.clientHeight * 0.25), r = c.getBoundingClientRect();
      return s && { ...s, at: [r.left + s.at[0], r.top + s.at[1]], open: document.elementFromPoint(r.left + s.at[0], r.top + s.at[1]) === c.firstElementChild }; });
    if (near?.open) { await p.touchscreen.tap(...near.at); await p.waitForTimeout(2500); }
    const route = await p.evaluate(() => document.querySelector(".hero .chart").dataset.route);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    await fingers([[200, 300], [200, 60]]); const swiped = await p.evaluate(() => Math.round(scrollY));
    log(`hero by touch, ${name}`, near?.open && route === near.word && swiped > 150 && !p.errors.length, `tap on "${near?.word}" (open water: ${near?.open}) sails ${route}; a swipe up scrolls ${swiped}px; errors ${p.errors.length} ${p.errors[0] || ""}`);
    await context.close();
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
