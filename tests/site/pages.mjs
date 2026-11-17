// node tests/site/pages.mjs   Uses the site like a reader: language switch, back button, shared link, slow line, chart, games, saved image.
import { base, browser, done } from "./serve.mjs";
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
const fresh = async (opts = {}) => { const p = await browser.newPage({ viewport: { width: 390, height: 780 }, ...opts }); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); return p; };
{ // language switch mid-page
  const p = await fresh(); await p.goto(base + "#/cerita/prabowo"); await p.waitForTimeout(2500); await p.mouse.wheel(0, 2500); await p.waitForTimeout(600);
  const before = await p.evaluate(() => scrollY); await p.click("#language"); await p.waitForTimeout(2500); const after = await p.evaluate(() => scrollY);
  log("language switch keeps the place", Math.abs(after - before) < 200, `scroll ${before} -> ${after}`); await p.close(); }
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
  await p.waitForSelector(".chart canvas", { timeout: 60000 }).catch(() => {}); const t = Date.now() - t0;
  log("slow connection (400 kbit/s): something on screen at 1.5 s", early > 0, `${early} characters of text at 1.5 s; chart after ${t} ms`); await p.close(); }
{ // chart: search, fly, keyboard, two words
  const p = await fresh({ viewport: { width: 1200, height: 800 } }); await p.goto(base + "#/peta"); await p.waitForTimeout(3000);
  await p.fill(".suggest input", "ahok"); await p.waitForTimeout(300); const offered = await p.locator(".offers button").count();
  await p.keyboard.press("Enter"); await p.waitForTimeout(1800);
  log("chart search offers words and adds the pick", offered > 0 && (await p.locator(".picked li").count()) === 1, `${offered} offers; ${await p.locator(".picked li").count()} picked; address ${await p.evaluate(() => location.hash)}`);
  const focusable = await p.evaluate(() => document.querySelector(".chart canvas").tabIndex >= 0);
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
  const p = await fresh({ viewport: { width: 1200, height: 800 } }); await p.goto(base + "#/peta"); await p.waitForSelector(".chart canvas"); await p.waitForTimeout(2500);
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
{ // saving a plate as an image with the site's typeface
  const p = await fresh({ viewport: { width: 1200, height: 800 }, acceptDownloads: true }); await p.goto(base + "#/cerita/prabowo"); await p.waitForSelector(".tools button");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.locator(".tools button").first().click()]);
  log("save image", !!d, d ? "an image is offered" : "no download"); await p.close(); }
await done(failures);
