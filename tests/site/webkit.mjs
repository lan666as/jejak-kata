// node tests/site/webkit.mjs   The site in WebKit (Safari's engine), if Playwright's WebKit can run here; says so and
// passes if it cannot. At 390x844 with touch and at 1440x900, with WebGL2 and without it (the fallback), and once as an
// older Safari would have it (no View Transitions; no scrollend event, as before Safari 26; storage that throws, as
// with all cookies blocked): the home page (the sea or the flat chart, the first route), a story (the cover, "Mulai" to
// a stage stuck under the header and snapping to its steps, a later step, a key after scrolling by hand, the landing),
// the map, a word's page and the stories index. Everything must be there and usable, with nothing thrown and no
// sideways scroll. WebKit on Linux needs libraries a plain server lacks; without root they can be unpacked from the
// distribution's packages into a folder whose path is WEBKIT_LIBS (README, "Checking the site").
import { existsSync } from "node:fs";
import { homedir } from "node:os";
const libs = process.env.WEBKIT_LIBS || `${homedir()}/.cache/ms-playwright/webkit-libs`;
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";  // a missing library then shows as a failed launch
if (existsSync(`${libs}/root/usr/share/glvnd/egl_vendor.d`)) process.env.__EGL_VENDOR_LIBRARY_DIRS = `${libs}/root/usr/share/glvnd/egl_vendor.d`;
process.env.ENGINE = "webkit";
const serve = await import("./serve.mjs").catch((e) => (console.log(`skip: WebKit cannot run here (${e.message.split("\n")[0]})`), process.exit(0)));
const { base, browser, done } = serve;

let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
const NO_GL = () => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
  delete window.WebGL2RenderingContext;
};
const OLD = () => {
  delete Document.prototype.startViewTransition;
  const listen = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) { return type === "scrollend" ? undefined : listen.call(this, type, ...rest); };
  for (const store of ["localStorage", "sessionStorage"]) Object.defineProperty(window, store, { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
};
const wide = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const settle = (p) => p.waitForTimeout(60).then(() => p.evaluate(() => new Promise((ok) => {
  let last = -1, same = 0;
  const tick = () => ((same = scrollY === last ? same + 1 : 0), (last = scrollY), same >= 6 ? ok() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
})));

// A WebKit that launches without its libraries dies at its first page: that too is "cannot run here".
const engine = await (async () => {
  const p = await browser.newPage().catch((e) => (console.log(`skip: WebKit cannot run here (${e.message.split("\n")[0]})`), process.exit(0)));
  const found = await p.evaluate(() => ({ version: navigator.userAgent.match(/Version\/([\d.]+)/)?.[1], webgl2: !!document.createElement("canvas").getContext("webgl2"), timeline: CSS.supports("animation-timeline: view()"),
    transitions: !!document.startViewTransition, svh: CSS.supports("height: 100svh"), mix: CSS.supports("color: color-mix(in srgb, red, blue)"), stretch: CSS.supports("font-stretch: 75%") }));
  await p.close();
  return found;
})();
console.log(`WebKit ${engine.version}: ${Object.entries(engine).filter(([k]) => k !== "version").map(([k, v]) => `${k} ${v}`).join(", ")}`);

for (const [label, init] of [["", null], [", no WebGL", NO_GL], [", as an older Safari", OLD]]) {
  for (const [width, height, touch] of [[390, 844, true], [1440, 900, false]]) {
    const name = `${width}px${label}`, gl = engine.webgl2 && init !== NO_GL;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const p = await context.newPage();
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(e.message));
    if (init) await p.addInitScript(init);

    // Home: the hero's sea (or the flat chart), its first route drawn, the title in the condensed cut.
    await p.goto(base + "#/");
    await p.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const home = await p.evaluate(() => { const c = document.querySelector(".hero .chart"), h1 = document.querySelector(".hero h1");
      return { gl: !!c?.classList.contains("gl"), route: c?.dataset.route, stretch: h1 ? getComputedStyle(h1).fontStretch : "no title", dives: document.documentElement.classList.contains("dives"), rung: window.seaRung }; });
    log(`home @${name}`, home.route && home.gl === gl && home.dives === gl && /75%|condensed/.test(home.stretch) && !(await wide(p)) && !p.errors.length,
      `${home.gl ? "3D sea" : "flat chart"}, route ${home.route}, title stretch ${home.stretch}, dive ${home.dives}, rung ${home.rung}; errors ${p.errors.length} ${p.errors[0] || ""}`);

    // A story: the cover, then "Mulai" to the first stage, stuck under the header and snapping; a later step; the landing.
    await p.evaluate(() => (location.hash = "#/cerita/diamankan"));
    await p.waitForSelector(".stage .plate svg", { timeout: 20000, state: "attached" }).catch(() => {});
    await p.waitForTimeout(800);
    const cover = await p.evaluate(() => ({ h1: document.querySelector(".cover h1")?.getBoundingClientRect().height > 0, snap: getComputedStyle(document.documentElement).scrollSnapType, tall: document.querySelector(".cover").offsetHeight }));
    await p.click(".begin"); await settle(p);
    for (let i = 0; i < 2; i++) { await p.keyboard.press("ArrowDown"); await settle(p); }
    const stage = await p.evaluate(() => { const s = document.querySelector("#scene-0 .stage"), head = document.querySelector(".masthead").getBoundingClientRect().bottom, f = s.querySelector(".plate:not(.off) svg").getBoundingClientRect();
      return { stuck: Math.round(s.getBoundingClientRect().top - head), step: +s.dataset.step, caption: s.querySelector(".caption .turn:not(.out)")?.textContent.trim().slice(0, 30), fig: [f.top - head, innerHeight - f.bottom].map(Math.round), height: Math.round(s.getBoundingClientRect().height), screen: innerHeight - head }; });
    // Scrolled on by hand two steps, the next key goes on from there.
    await p.evaluate(() => scrollBy(0, 2 * document.querySelector("#scene-0 .beat").offsetHeight)); await settle(p);  // (mobile WebKit has no wheel to turn)
    await p.keyboard.press("ArrowDown"); await settle(p);
    stage.after = await p.evaluate(() => +document.querySelector("#scene-0 .stage").dataset.step);
    await p.evaluate(() => scrollTo(0, document.querySelector(".landing").offsetTop)); await p.waitForTimeout(600);
    const landing = await p.evaluate(() => ({ limits: !!document.querySelector(".limits h2")?.getBoundingClientRect().height, next: !!document.querySelector(".next-story") }));
    log(`story @${name}`, cover.h1 && cover.snap.includes("y") && stage.stuck === 0 && stage.step === 2 && stage.after === 5 && stage.caption && stage.fig.every((d) => d >= -1) && Math.abs(stage.height - stage.screen) <= 2 && landing.limits && landing.next && !(await wide(p)) && !p.errors.length,
      `cover ${cover.tall}px, snap "${cover.snap}"; stage ${stage.stuck}px under the header, ${stage.height}px tall of ${stage.screen}, step ${stage.step} "${stage.caption}…", a key after two steps by hand: step ${stage.after}, figure ${stage.fig}; landing ${JSON.stringify(landing)}; errors ${p.errors.length} ${p.errors[0] || ""}`);

    // The map: the sea in its band (or the chart on paper), moved by a drag or a finger.
    await p.evaluate(() => (location.hash = "#/peta/id-web-news-kompas/jokowi"));
    await p.waitForSelector(".chart > canvas", { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(2000);
    const before = await p.evaluate(() => document.querySelector(".map-deep .chart")?.sea?.state().aim || null);
    const canvas = await p.locator(".chart > canvas").first().boundingBox();
    if (gl && canvas) {
      await p.evaluate((y) => scrollTo(0, y), canvas.y - 60); await p.waitForTimeout(300);
      const box = await p.locator(".chart > canvas").first().boundingBox(), [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 120, y + 40, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
    }
    const after = await p.evaluate(() => document.querySelector(".map-deep .chart")?.sea?.state().aim || null);
    log(`map @${name}`, (gl ? before && after && (after.x !== before.x || after.z !== before.z) : !before && !!canvas) && !(await wide(p)) && !p.errors.length,
      gl ? `the sea moved by a drag: ${JSON.stringify(before)} -> ${JSON.stringify(after)}` : `the chart on paper: ${!!canvas}; errors ${p.errors.length} ${p.errors[0] || ""}`);

    // A word's page and the stories index.
    for (const [hash, test] of [["#/kata/kpk", ".lens-section svg, .lens-section .chart"], ["#/cerita", ".story-card"]]) {
      await p.evaluate((h) => (location.hash = h), hash);
      await p.waitForSelector(test, { timeout: 20000, state: "attached" }).catch(() => {}); await p.waitForTimeout(1200);
      const seen = await p.evaluate((t) => ({ marks: document.querySelectorAll(t).length, h1: document.querySelector("h1")?.textContent.trim().slice(0, 30), head: Math.round(document.querySelector(".page-head").getBoundingClientRect().height) }), test);
      log(`${hash} @${name}`, seen.marks > 0 && seen.h1 && !(await wide(p)) && !p.errors.length, `${seen.marks} of ${test}; "${seen.h1}"; head ${seen.head}px; errors ${p.errors.length} ${p.errors[0] || ""}`);
    }
    await context.close();
  }
}
await done(failures);
