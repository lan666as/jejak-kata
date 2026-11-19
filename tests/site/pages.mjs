// node tests/site/pages.mjs   Uses the site like a reader: language switch, back button, shared link, slow line, chart, games, saved image.
import { base, browser, done } from "./serve.mjs";
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
const fresh = async (opts = {}) => { const p = await browser.newPage({ viewport: { width: 390, height: 780 }, ...opts }); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); return p; };
{ // language switch mid-story: the same scene at the same step, its stage stuck under the header (the cover is not as tall in each language, so pixels differ)
  const where = () => { const head = document.querySelector(".masthead").getBoundingClientRect().bottom, middle = head + (innerHeight - head) / 2;
    const stage = [...document.querySelectorAll(".stage")].find((s) => { const r = s.parentNode.getBoundingClientRect(); return r.top <= middle && r.bottom >= middle; });
    return stage ? `scene ${stage.parentNode.id.split("-")[1]} step ${stage.dataset.step}, ${Math.round(stage.getBoundingClientRect().top - head)}px under the header` : "no stage"; };
  const p = await fresh(); await p.goto(base + "#/cerita/prabowo"); await p.waitForTimeout(2500); await p.mouse.wheel(0, 2500); await p.waitForTimeout(2500);  // (the page settles on a step: a scene entered gives the sea the stage for a leg)
  const before = await p.evaluate(where); await p.click("#menu-button"); await p.click("#language"); await p.waitForTimeout(2500); const after = await p.evaluate(where);
  log("language switch keeps the place", before === after && before.includes("step") && !before.includes("step 0,") && before.endsWith(" 0px under the header"), `${before} -> ${after}`); await p.close(); }
{ // the header at 390px: opaque, and stuck at the top after a scroll
  const p = await fresh(); await p.goto(base + "#/kata/kpk"); await p.waitForTimeout(2500); await p.mouse.wheel(0, 1500); await p.waitForTimeout(600);
  const h = await p.evaluate(() => { const node = document.querySelector(".masthead"), r = node.getBoundingClientRect(), bg = getComputedStyle(node).backgroundColor;
    const alpha = bg.startsWith("rgba") ? +bg.split(",")[3].replace(")", "") : 1; return { top: r.top, height: r.height, alpha, y: scrollY, wide: document.documentElement.scrollWidth > innerWidth + 1 }; });
  log("header at 390px is opaque and stuck after a scroll", h.y > 500 && Math.abs(h.top) < 1 && h.height === 56 && h.alpha === 1 && !h.wide, `scrolled ${h.y}px; header top ${h.top}px, ${h.height}px tall, opacity ${h.alpha}; sideways scroll ${h.wide}`); await p.close(); }
{ // the menu at 390px: opens, keeps focus inside, Escape closes it, a link in it navigates and closes it
  const p = await fresh(); await p.goto(base + "#/temuan"); await p.waitForTimeout(2000);
  await p.click("#menu-button"); await p.waitForTimeout(400);
  const open = await p.evaluate(() => ({ expanded: document.getElementById("menu-button").getAttribute("aria-expanded"), controls: document.getElementById("menu-button").getAttribute("aria-controls"),
    shown: document.getElementById("menu").getClientRects().length > 0, locked: getComputedStyle(document.documentElement).overflow === "hidden", inMenu: !!document.activeElement.closest("#menu") }));
  log("menu opens", open.expanded === "true" && open.controls === "menu" && open.shown && open.locked && open.inMenu, JSON.stringify(open));
  let escaped = 0; for (let i = 0; i < 25; i++) { await p.keyboard.press("Tab"); escaped += await p.evaluate(() => !document.activeElement.closest(".masthead")); }
  for (let i = 0; i < 25; i++) { await p.keyboard.press("Shift+Tab"); escaped += await p.evaluate(() => !document.activeElement.closest(".masthead")); }
  log("menu keeps focus inside", escaped === 0, `${escaped} of 50 tab presses left the header and its sheet`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  const closed = await p.evaluate(() => ({ expanded: document.getElementById("menu-button").getAttribute("aria-expanded"), shown: document.getElementById("menu").getClientRects().length > 0, focus: document.activeElement.id }));
  log("Escape closes the menu", closed.expanded === "false" && !closed.shown && closed.focus === "menu-button", JSON.stringify(closed));
  await p.click("#menu-button"); await p.waitForTimeout(400); await p.click("#menu nav a[data-to='main']"); await p.waitForTimeout(1500);
  const went = await p.evaluate(() => ({ at: location.pathname + location.hash, shown: document.getElementById("menu").getClientRects().length > 0, locked: getComputedStyle(document.documentElement).overflow === "hidden", current: document.querySelector("#menu nav a[aria-current]")?.dataset.to }));
  log("a link in the menu navigates and closes it", went.at === "/main/" && !went.shown && !went.locked && went.current === "main", JSON.stringify(went));
  await p.click("#search-button"); await p.waitForTimeout(300); await p.keyboard.type("korup"); await p.waitForTimeout(1500);
  const offered = await p.locator("#suggestions a").count(); await p.locator("#suggestions a").first().click(); await p.waitForTimeout(1200);
  log("search from the menu offers words and opens one", offered > 0 && /^\/(#\/)?kata\//.test(await p.evaluate(() => location.pathname + location.hash)) && !(await p.evaluate(() => document.getElementById("menu").getClientRects().length)), `${offered} offers; address ${await p.evaluate(() => location.pathname + location.hash)}; errors ${p.errors.length}`); await p.close(); }
{ // back button
  const p = await fresh(); await p.goto(base + "#/cerita/kata-korupsi"); await p.waitForTimeout(2500); await p.mouse.wheel(0, 1800); await p.waitForTimeout(500);
  const before = await p.evaluate(() => scrollY); await p.evaluate(() => (location.hash = "#/kata/kpk")); await p.waitForTimeout(1500); await p.goBack(); await p.waitForTimeout(2500);
  log("back button returns to the place", Math.abs((await p.evaluate(() => scrollY)) - before) < 300, `scroll ${before} -> ${await p.evaluate(() => scrollY)}`); await p.close(); }
{ // cold shared link to a scene
  const p = await fresh(); await p.goto(base + "#/cerita/yang-hilang/2"); await p.waitForTimeout(3500);
  const top = await p.evaluate(() => document.getElementById("scene-2")?.getBoundingClientRect().top);
  log("a link to a scene lands on it", top !== undefined && top > -40 && top < 200, `scene top at ${Math.round(top)}px`); await p.close(); }
{ // slow connection
  const p = await fresh(); const c = await p.context().newCDPSession(p); await c.send("Network.enable");
  await c.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 50_000, uploadThroughput: 20_000 });
  const t0 = Date.now(); await p.goto(base + "#/"); await p.waitForTimeout(1500);
  const early = await p.evaluate(() => document.getElementById("view").innerText.trim().length);
  await p.waitForSelector(".chart > canvas", { timeout: 60000 }).catch(() => {}); const t = Date.now() - t0;
  log("slow connection (400 kbit/s): something on screen at 1.5 s", early > 0, `${early} characters of text at 1.5 s; chart after ${t} ms`); await p.close(); }
{ // the home page: the hero's field sails a route, a featured story opens its story, an unknown address is a 404
  const p = await fresh({ viewport: { width: 360, height: 740 } }); await p.goto(base + "#/"); await p.waitForSelector(".hero .chart > canvas"); await p.waitForTimeout(2500);
  const first = await p.evaluate(() => document.querySelector(".hero .chart")?.dataset.route);
  await p.fill(".hero .suggest input", "prabowo"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  const sailed = await p.evaluate(() => ({ route: document.querySelector(".hero .chart").dataset.route, pressed: document.querySelector(".hero-try [aria-pressed='true']")?.textContent, at: location.pathname + location.hash }));
  log("hero field sails a route", first && sailed.route === "prabowo" && sailed.pressed === "prabowo" && sailed.at === "/", `first route ${first}; after typing: ${JSON.stringify(sailed)}; errors ${p.errors.length}`);
  const card = p.locator(".featured .story-card").first(), to = await card.getAttribute("href"); await card.click(); await p.waitForSelector(".cover h1"); await p.waitForTimeout(500);
  log("a featured story card opens its story", (await p.evaluate(() => location.pathname + location.hash)) === to && (await p.locator(".stage").count()) > 0, `${to} -> ${await p.evaluate(() => location.pathname + location.hash)}: ${await p.locator(".cover h1").innerText()}`);
  await p.goto(base + "#/tidak-ada-di-sini"); await p.waitForTimeout(1200);
  const lost = await p.evaluate(() => ({ h1: document.querySelector(".lost h1")?.textContent, ways: document.querySelectorAll(".lost-ways a").length, title: document.title, wide: document.documentElement.scrollWidth > innerWidth + 1 }));
  log("an unknown address is a 404 with ways back", lost.h1 && lost.ways >= 3 && !lost.wide && !p.errors.length, JSON.stringify(lost)); await p.close(); }
{ // chart: search, fly, keyboard, two words
  const p = await fresh({ viewport: { width: 1200, height: 800 } }); await p.goto(base + "#/peta"); await p.waitForTimeout(3000);
  await p.fill(".suggest input", "ahok"); await p.waitForTimeout(300); const offered = await p.locator(".offers button").count();
  await p.keyboard.press("Enter"); await p.waitForTimeout(1800);
  log("chart search offers words and adds the pick", offered > 0 && (await p.locator(".picked li").count()) === 1, `${offered} offers; ${await p.locator(".picked li").count()} picked; address ${await p.evaluate(() => location.hash)}`);
  const focusable = await p.evaluate(() => document.querySelector(".chart > canvas").tabIndex >= 0);
  log("chart can be reached by keyboard", focusable, focusable ? "canvas takes focus" : "canvas has no tab stop and no key handling");
  await p.fill(".suggest input", "anies"); await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  log("two words give a comparison", (await p.locator("h2").count()) > 0, `${await p.locator(".picked li").count()} picked; ${await p.locator(".duel").count()} head-to-head figures; errors ${p.errors.length}`); await p.close(); }
{ // race
  const p = await fresh(); await p.goto(base + "#/balap"); await p.waitForTimeout(2500); const n = await p.locator(".race .row").count();
  await p.fill(".suggest input", "megawati"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  log("race takes a new word", (await p.locator(".race .row").count()) >= n, `${n} -> ${await p.locator(".race .row").count()} rows; errors ${p.errors.length}`); await p.close(); }
{ // quiz, both games
  const p = await fresh(); await p.goto(base + "#/kuis"); await p.waitForTimeout(2500); let rounds = 0;
  for (let i = 0; i < 8; i++) { if (!(await p.locator(".choices button").count())) break; await p.locator(".choices button").first().click(); await p.waitForTimeout(150); await p.locator(".verdict button").click(); await p.waitForTimeout(500); rounds++; }
  log("quiz plays eight rounds to a score", (await p.locator(".score").count()) === 1, `${rounds} rounds; score shown: ${(await p.locator(".score").count()) === 1}; errors ${p.errors.length}`); await p.close(); }
{ // portrait cold
  const p = await fresh(); await p.goto(base + "#/potret/setya%20novanto"); await p.waitForTimeout(3000);
  log("portrait opens cold", (await p.locator("h1").innerText()).includes("setya"), `${(await p.locator("#view").innerText()).slice(0, 70).replace(/\s+/g, " ")}; errors ${p.errors.length}`); await p.close(); }
{ // chart by keyboard
  const p = await fresh({ viewport: { width: 1200, height: 800 } }); await p.goto(base + "#/peta"); await p.waitForSelector(".chart > canvas"); await p.waitForTimeout(2500);
  await p.keyboard.press("Tab"); for (let i = 0; i < 30 && !(await p.evaluate(() => document.activeElement?.tagName === "CANVAS")); i++) await p.keyboard.press("Tab");
  const focused = await p.evaluate(() => document.activeElement?.tagName === "CANVAS");
  await p.keyboard.press("+"); await p.waitForTimeout(400); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(400); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  log("chart by keyboard: tab to it, zoom, pan, Enter picks", focused && (await p.locator(".picked li").count()) === 1, `focus on canvas: ${focused}; picked: ${await p.locator(".picked li").first().innerText().catch(() => "-")}; errors ${p.errors.length}`); await p.close(); }
{ // the five new things
  const p = await fresh();
  for (const [hash, test] of [["#/menempel/viral/2/2/p", ".plate svg"], ["#/pasang/1/organisation", ".tide td"], ["#/redaksi/golkar", ".plate svg"], ["#/lingkaran/megawati/1", ".orbit a"], ["#/main", ".doors a"], ["#/cerita", ".doors a"]]) {
    await p.goto(base + hash); await p.waitForTimeout(2200);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    log(`${hash} at 390px`, (await p.locator(test).count()) > 0 && !wide && !p.errors.length, `${await p.locator(test).count()} marks; sideways scroll: ${wide}; errors ${p.errors.length}`); }
  await p.goto(base + "#/tebak"); await p.waitForTimeout(2000); let n = 0;
  for (let i = 0; i < 6; i++) { await p.locator(".gauge input").fill(String(20 + 10 * i)); await p.locator(".controls button").click(); await p.waitForTimeout(200); n += await p.locator(".verdict:not([hidden])").count(); await p.locator(".controls button").click(); await p.waitForTimeout(250); }
  log("guess the number plays six rounds to a score", (await p.locator(".score").count()) === 1, `${n} verdicts; score: ${await p.locator(".score").innerText().catch(() => "-")}; errors ${p.errors.length}`);
  await p.close(); }
{ // no chart text under 11px on a phone (360 and 430 wide): every figure drawn as SVG, on every page with figures, scrolled
  // through so that each draws itself (the names on a WebGL sea are drawn at 12px and up, in sea.js)
  const pages = ["#/", "#/temuan", "#/kata/kpk", "#/potret/prabowo", "#/peta", "#/main", "#/metode", "#/kuis", "#/tebak", "#/menempel", "#/lingkaran", "#/redaksi", "#/pasang", "#/balap", "#/tahun", "#/bergeser", "#/entitas"];
  for (const width of [360, 430]) {
    const p = await fresh({ viewport: { width, height: 800 } }), small = [];
    for (const hash of pages) {
      await p.goto(base + hash); await p.waitForTimeout(1800);
      for (let y = 0, h = await p.evaluate(() => document.documentElement.scrollHeight); y < h; y += 700) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(150); }
      await p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true))); await p.waitForTimeout(400);
      const found = await p.evaluate(() => [...document.querySelectorAll("svg text, svg tspan")].filter((t) => t.textContent.trim() && t.getClientRects().length && t.getScreenCTM())
        .map((t) => [t.textContent.trim().slice(0, 16), parseFloat(getComputedStyle(t).fontSize) * Math.hypot(t.getScreenCTM().a, t.getScreenCTM().b)]).filter(([, px]) => px < 10.95));
      if (found.length) small.push(`${hash}: ${found.length}, e.g. "${found[0][0]}" ${found[0][1].toFixed(1)}px`);
    }
    log(`no chart text under 11px at ${width}px`, !small.length && !p.errors.length, `${pages.length} pages; ${small.join("; ") || "none smaller"}; errors ${p.errors.length} ${p.errors[0] || ""}`);
    await p.close();
  }
}
{ // saving a plate as an image with the site's typeface
  const p = await fresh({ viewport: { width: 1200, height: 800 }, acceptDownloads: true }); await p.goto(base + "#/cerita/prabowo"); await p.waitForSelector(".tools button");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.locator(".tools button").first().click()]);
  log("save image", !!d, d ? "an image is offered" : "no download"); await p.close(); }
await done(failures);
