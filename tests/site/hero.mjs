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
  ["WebGL", {}, null, (s) => s.gl && s.dives && s.extra > 300 && s.role === "application" && !s.state.held],
  ["no WebGL", {}, NO_GL, (s) => !s.gl && !s.dives && s.extra === 0 && s.role === "application"],
  ["reduced motion", { reducedMotion: "reduce" }, null, (s) => s.gl && !s.dives && s.extra === 0 && s.role === "application" && s.state.held],
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
    // By keyboard alone: Tab reaches the sea (after the header), which shows its focus and rings a light, the arrows
    // move the ring to another, and Enter sails it.
    let keys = "flat chart";
    if (first.gl) {
      let tabs = 0;
      while (tabs++ < 20 && !(await page.evaluate(() => document.activeElement?.matches(".hero canvas")))) await page.keyboard.press("Tab");
      const ringed = await page.evaluate(() => [document.querySelector(".hero .chart").sea.state().revealed, getComputedStyle(document.activeElement).outlineStyle, document.querySelector(".hero-key .keys").getBoundingClientRect().width > 1]);
      await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(200);
      const moved = await page.evaluate(() => document.querySelector(".hero .chart").sea.state().revealed);
      await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
      const sailed = (await page.evaluate(look)).route;
      keys = `Tab ${tabs}x, ringed ${ringed[0]} (outline ${ringed[1]}, keys said ${ringed[2]}), arrow -> ${moved}, Enter sails ${sailed}`;
      if (!(tabs <= 20 && ringed[0] && ringed[1] === "solid" && ringed[2] && moved && moved !== ringed[0] && sailed && sailed !== first.route)) errors.push("keys: " + keys);
      await page.locator(".hero-try button", { hasText: "jokowi" }).focus();
    }
    await page.locator(".hero-try button", { hasText: "prabowo" }).click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(look);
    // Scrolled halfway down the hero's dive, the sea is still on screen under the header (held there while diving).
    await page.evaluate(() => scrollTo(0, innerHeight * 0.4)); await page.waitForTimeout(600);
    const held = await page.evaluate(() => Math.round(document.querySelector(".hero-sea").getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight));
    // And the dive has gone as far as the scroll has: the camera has pitched down (the sea's own depth says so).
    const depth = await page.evaluate(() => document.querySelector(".hero .chart").sea?.state?.().depth ?? 0);
    const ok = expect(first) && ladder && first.route && after.route === "prabowo" && (!first.gl || after.label.includes("prabowo")) && (first.dives ? held === 0 && depth > 0.1 : true) && !errors.length;
    log(`hero, ${name} @${width}px`, ok, `${first.gl ? "3D sea" : "flat chart"} (${first.role}, ${first.extra}px past the sea); first route ${first.route}, then ${after.route}; dive ${first.dives ? `${first.extra}px, sea ${held}px under the header halfway, depth ${depth}` : "none"}; ladder ${steps.length ? `${rungs[0][1]} -> ${steps.at(-1)[1]}, ${Math.round(steps.at(-1)[0] - steps[0][0])} ms from its first step to its last` : rungs.length ? `stays at ${rungs[0][1]}` : "none"}; ${first.state ? JSON.stringify(first.state) : ""}; keys: ${keys}; errors ${errors.length}${errors.length ? " " + errors[0].slice(0, 90) : ""}`);
    await page.close();
  }
}
// On the smallest phone (320x568): nothing of the sky (the legend, the year) lies on the headline, and the field's
// placeholder is whole in its field.
{ const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  await page.goto(base + "#/");
  await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const h = document.querySelector(".hero h1").getBoundingClientRect(), over = (b) => b.bottom > h.top && b.top < h.bottom && b.right > h.left && b.left < h.right;
    const on = [...document.querySelectorAll(".hero-key, .hero .when")].filter((n) => getComputedStyle(n).visibility === "visible" && n.getClientRects().length && over(n.getBoundingClientRect())).map((n) => n.className);
    const input = document.querySelector(".hero .suggest input"), cs = getComputedStyle(input), c = document.createElement("canvas").getContext("2d");
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return { on, need: Math.ceil(c.measureText(input.placeholder).width), room: Math.floor(input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
  });
  log("hero @320x568", !r.on.length && r.need <= r.room, `${r.on.length ? `on the headline: ${r.on.join(", ")}` : "nothing on the headline"}; the placeholder ${r.need}px in its field's ${r.room}px`);
  await page.close(); }
// The headline keeps 3:1 (large text) against the brightest of what is behind it, at a short phone, a phone and a
// laptop: measured from a screenshot of its box with its letters made transparent, once the arrival has lit the sea.
for (const [width, height, phone] of [[320, 568, true], [390, 844, true], [1440, 900, false], [1920, 1080, false]]) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: phone, isMobile: phone });
  await page.goto(base + "#/");
  await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const box = await page.evaluate(() => { const h = document.querySelector(".hero h1"), r = h.getBoundingClientRect(); h.style.color = "transparent"; return { x: r.left, y: r.top, width: r.width, height: r.height, ink: getComputedStyle(document.documentElement).getPropertyValue("--on-deep").trim() }; });
  const shot = (await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } })).toString("base64");
  const worst = await page.evaluate(async ({ shot, ink }) => {
    const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode();
    const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }).getContext("2d"); c.drawImage(img, 0, 0);
    const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const d = c.getImageData(0, 0, img.width, img.height).data, all = [];
    for (let i = 0; i < d.length; i += 4) all.push(lum(d[i], d[i + 1], d[i + 2]));
    all.sort((a, b) => a - b);
    const bg = all[Math.floor(all.length * 0.99)], hex = ink.replace("#", ""), text = lum(...[0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)));
    return (text + 0.05) / (bg + 0.05);
  }, { shot, ink: box.ink });
  log(`headline contrast @${width}x${height}`, worst >= 3, `${worst.toFixed(1)}:1 against the brightest 1% behind it`);
  await page.close(); }
await done(failures);
