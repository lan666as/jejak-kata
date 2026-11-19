// node tests/site/seas.mjs   The night sea away from the home hero (and its touch), three ways (WebGL, no WebGL, reduced motion):
// the map's sea explored by mouse, keys and buttons (turn, tilt, come near, from above, Enter on the ringed word, up to
// four routes); a story's stages on one sea that flies to each step (a crossfade with reduced motion), its figure's
// panel and captions legible over it, taking the whole stage at a new scene and saying what it shows in a key; the sea held still behind a page head, a story's cover (with the route of the
// story's word) and the footer; the GPU let go when the page turns; and in each case the fallback or the still, with nothing thrown.
// And the hand, on a page head, a story's stage and the hero: a sea leans to the pointer (not with reduced motion),
// names the light nearest it on its open water, draws nothing once the pointer is still, and a click on the light
// opens its word's page; a drag that starts on a head's sea selects no text, while the head's title can still be.
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
  { // a story's stages on one sea: it flies (about 600 ms) to each step's words, rings them, and sleeps between; with
    // reduced motion it cuts (a crossfade) instead; without WebGL the stages keep their graticule. Text on the figure's
    // panel and on a caption's shade keeps 4.5:1 over the brightest the sea can be (white).
    const p = await fresh(options, init), sea = () => state(p, ".story-sea .chart");
    await p.goto(base + "#/cerita/kata-korupsi"); await p.waitForSelector(".stage .plate svg"); await p.waitForTimeout(1500);
    const to = (k, j) => p.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight); }, [k, j]);
    await to(0, 1); await p.waitForTimeout(2500);
    const one = await sea();
    await to(0, 2); await p.waitForTimeout(250);
    const during = await sea(), fading = await p.evaluate(() => document.querySelector(".story-sea").getAnimations().length);
    await p.waitForTimeout(1500);
    const two = await sea();
    const idle = await p.evaluate(() => new Promise((ok) => { let n = 0; const raf = requestAnimationFrame; window.requestAnimationFrame = (f) => (n++, raf(f)); setTimeout(() => ((window.requestAnimationFrame = raf), ok(n)), 1000); }));
    const looks = await p.evaluate(() => {
      const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true }), over = (colour, under, alpha = 1) => {
        c.globalAlpha = 1; c.fillStyle = under; c.fillRect(0, 0, 1, 1); c.globalAlpha = alpha; c.fillStyle = colour; c.fillRect(0, 0, 1, 1);
        const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return `rgb(${r}, ${g}, ${b})`; };
      const lum = (rgb) => rgb.match(/\d+/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const opacity = (n, top) => { let o = 1; for (; n && n !== top; n = n.parentNode) o *= +getComputedStyle(n).opacity; return o; };
      const svg = document.querySelector("#scene-0 .plate:not(.off) svg"), panel = over(getComputedStyle(svg.querySelector("rect")).fill, "#ffffff"), deep = getComputedStyle(document.documentElement).getPropertyValue("--deep").trim();
      const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent.replace("●", "").trim() && getComputedStyle(t).fill !== over(deep, "#ffffff"));  // (not the numbers on the beacon)
      const panelWorst = Math.min(...texts.map((t) => ratio(over(getComputedStyle(t).fill, panel, opacity(t, svg.parentNode)), panel)));
      const turn = document.querySelector("#scene-0 .turn:not(.out)"), shade = over(getComputedStyle(turn).backgroundColor, "#ffffff");
      const captionWorst = Math.min(...[...turn.querySelectorAll("p")].map((q) => ratio(over(getComputedStyle(q).color, shade), shade)));
      return { panel, panelWorst: +panelWorst.toFixed(2), texts: texts.length, captionWorst: +captionWorst.toFixed(2), clear: getComputedStyle(document.querySelector("#scene-0 .stage")).backgroundColor, graticule: getComputedStyle(document.querySelector("#scene-0 .stage"), "::before").content };
    });
    const moved = (a, b) => a && b && ["x", "z", "dist", "yaw"].some((k) => a.aim[k] !== b.aim[k]);
    const ok = !gl ? !one && looks.graticule !== "none" && looks.clear !== "rgba(0, 0, 0, 0)"
      : one?.flies === !held && one.held && one.lit > 0 && moved(one, two) && (held ? !during.gliding && fading > 0 : during.gliding) && idle <= 2 && looks.panelWorst >= 4.5 && looks.captionWorst >= 4.5;
    log(`story's sea, ${name}`, ok && !p.errors.length, `${gl ? `flies ${one?.flies}, ${one?.lit} words lit; step 1 -> 2: aim ${JSON.stringify(one?.aim)} -> ${JSON.stringify(two?.aim)}, gliding at 250 ms ${during?.gliding}, crossfading ${fading}; ${idle} frames in a still second; ` : ""}panel ${looks.panel} (over white): ${looks.texts} texts, the faintest ${looks.panelWorst}:1; caption ${looks.captionWorst}:1; stage ${looks.clear}, graticule ${looks.graticule}; errors ${p.errors.length} ${p.errors[0] || ""}`);
    await p.close();
  }
  { // a new scene: the sea takes the whole stage for a leg (the figure and caption give way), then gives it back; not
    // with reduced motion. The key above the controls says what the sea shows, in the language shown.
    const p = await fresh(options, init);
    await p.addInitScript(() => { window.__took = 0; new MutationObserver(() => document.querySelector(".stage.sea-full") && (window.__took = window.__took || performance.now())).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] }); });
    await p.goto(base + "#/cerita/kata-korupsi"); await p.waitForSelector(".stage .plate svg"); await p.waitForTimeout(2000);
    await p.click(".begin"); await p.waitForTimeout(350);
    const during = await p.evaluate(() => ({ full: !!document.querySelector("#scene-0 .stage.sea-full"), figure: +getComputedStyle(document.querySelector("#scene-0 .stage-figure")).opacity }));
    await p.waitForTimeout(1800);
    const after = await p.evaluate(() => ({ took: window.__took > 0, full: !!document.querySelector(".stage.sea-full"), figure: +getComputedStyle(document.querySelector("#scene-0 .stage-figure")).opacity,
      key: document.querySelector("#scene-0 .sea-key")?.textContent || "", shown: !!document.querySelector("#scene-0 .sea-key")?.getClientRects().length,
      mute: !!document.querySelector("#scene-0 .stage.mute") }));
    // (the key says what the sea names; where the opening leaves it no room to name a word, the band is dropped)
    const keyed = after.key.startsWith("Di peta: ") || (after.mute && !after.key);
    const ok = !gl ? !after.shown && !after.took : held ? !after.took && keyed : during.full && during.figure < 0.5 && !after.full && after.figure === 1 && keyed;
    log(`story's sea takes the stage, ${name}`, ok && !p.errors.length, `350 ms after "Mulai": sea has the stage ${during.full}, figure opacity ${during.figure}; after: ${after.full ? "still" : "given back"}, figure ${after.figure}, took it ${after.took}; key ${after.shown ? `"${after.key}"` : "not shown"}; errors ${p.errors.length} ${p.errors[0] || ""}`);
    await p.close();
  }
  { // the hand: a page head (a play page's), a story's stage, the hero
    const p = await fresh(options, init), still = (selector) => p.waitForFunction((s) => !document.querySelector(s)?.sea?.state().leaning, selector, { timeout: 8000, polling: 100 }).catch(() => {});
    const idle = () => p.evaluate(() => new Promise((ok) => { let n = 0; const raf = requestAnimationFrame; window.requestAnimationFrame = (f) => (n++, raf(f)); setTimeout(() => ((window.requestAnimationFrame = raf), ok(n)), 1000); }));
    /** A light on the open water of the sea in `selector`, near (fx, fy) of it, where nothing lies over it. */
    const light = (selector, fx, fy) => p.evaluate(([s, fx, fy]) => { const c = document.querySelector(s), r = c?.getBoundingClientRect(), x = c?.sea?.spot(r.width * fx, r.height * fy);
      return x && { word: x.word, x: r.left + x.at[0], y: r.top + x.at[1], over: document.elementFromPoint(r.left + x.at[0], r.top + x.at[1])?.closest("p, h1, a, button, svg, .turn")?.tagName || null }; }, [selector, fx, fy]);
    await p.goto(base + "#/redaksi"); await p.waitForTimeout(3000);
    const h = gl && await light(".page-head .chart", 0.75, 0.45);
    let head = null;
    if (h) {
      await p.mouse.move(h.x - 40, h.y + 30); await p.mouse.move(h.x + 2, h.y + 1, { steps: 5 }); await still(".page-head .chart");
      head = { ...(await state(p, ".page-head .chart")), frames: await idle() };
    }
    // A drag from the head's water across its title selects nothing; a double click on the title still selects a word.
    const title = await p.locator(".page-head h1").boundingBox(), from = h || { x: title.x + title.width + 120, y: title.y + 20 };
    await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(title.x + 10, title.y + 10, { steps: 8 }); await p.mouse.up();
    const dragged = await p.evaluate(() => getSelection().toString().length);
    await p.mouse.dblclick(title.x + 8, title.y + title.height / 2);
    const word = await p.evaluate(() => getSelection().toString().trim());
    let opened = null;
    if (h) { await p.mouse.click(h.x + 2, h.y + 1); await p.waitForFunction(() => /\/kata\/|#\/kata\//.test(location.href), null, { timeout: 5000 }).catch(() => {}); opened = await p.evaluate(() => decodeURIComponent(location.pathname + location.hash)); }
    const okHead = !gl ? dragged === 0 && word.length > 0 : !h.over && head.revealed === h.word && (held ? head.lean.every((v) => v === 0) : head.lean.some((v) => v !== 0)) && head.frames <= 2 && dragged === 0 && word.length > 0 && opened?.includes(`kata/${h.word}`);
    log(`the hand on a page head, ${name}`, okHead && !p.errors.length, `${h ? `light "${h.word}" (under ${h.over || "nothing"}): named ${head.revealed}, lean ${head.lean}, ${head.frames} frames in a still second; a click opens ${opened}; ` : ""}a drag from the sea selects ${dragged} characters, a double click on the title "${word}"; errors ${p.errors.length} ${p.errors[0] || ""}`);
    if (gl) {
      // A story's stage: the sea under it answers the pointer on its open water (under the caption, beside the figure).
      await p.goto(base + "#/cerita/kata-korupsi"); await p.waitForSelector(".stage .plate svg"); await p.waitForTimeout(1500);
      await p.evaluate(() => { const s = document.getElementById("scene-0"); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + s.querySelector(".beat").offsetHeight); });
      await p.waitForTimeout(2600);
      const spots = [];
      for (const [fx, fy] of [[0.8, 0.7], [0.9, 0.62], [0.72, 0.66], [0.85, 0.75]]) { const x = await light(".story-sea .chart", fx, fy); if (x && !x.over) { spots.push(x); break; } }
      const at = spots[0];
      if (at) { await p.mouse.move(at.x + 30, at.y - 30); await p.mouse.move(at.x + 1, at.y + 1, { steps: 5 }); await still(".story-sea .chart"); }
      const stage = at && { ...(await state(p, ".story-sea .chart")), frames: await idle() };
      // (lights may stand a few pixels apart, and the view leans as the pointer comes: the light named is the one nearest
      // the pointer as the view stood then, which may be the neighbour of the one aimed at; a light must be named)
      log(`the hand on a story's stage, ${name}`, !!at && !!stage.revealed && (held ? stage.lean.every((v) => v === 0) : stage.lean.some((v) => v !== 0)) && stage.frames <= 2 && !p.errors.length,
        at ? `light "${at.word}": named ${stage.revealed}, lean ${stage.lean}, ${stage.frames} frames in a still second` : "no light found on the stage's open water");
      // The hero leans to the pointer anywhere on it.
      await p.goto(base + "#/"); await p.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
      await p.mouse.move(200, 300); await p.mouse.move(1100, 700, { steps: 6 }); await p.waitForTimeout(300);
      const hero = await state(p, ".hero .chart");
      log(`the hand on the hero, ${name}`, (held ? hero.lean.every((v) => v === 0) : hero.lean[0] > 0.3) && !p.errors.length, `lean ${hero.lean}`);
    }
    await p.close();
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
