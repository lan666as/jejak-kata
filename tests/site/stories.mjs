// node tests/site/stories.mjs [slug ...]   Reads every story (or those named) like a reader, at desktop width in light and at phone
// width in dark, and fails on any problem. Down: "Mulai", then one key press per step (arrow keys, space, page down), to
// the landing. Up: one scroll per step, back to the cover, and between every two steps a look at the position halfway.
// At every step the stage must be stuck under the header, show the step's caption and counter, have its figure wholly on
// screen at the step's moment with a strip's rows at least 17px apart on screen and no text under 12px (a strip drawn
// taller than its window on a phone: the window on screen, and the rows the step names inside it), and keep its caption
// band on screen, showing the whole step or at least six lines (a caption longer than the band must scroll in it); on a
// phone no caption is cut at all (an opening longer than the band rises over the figure's foot, wholly on screen).
// Where the stages lie on the sea, going down, once the sea has landed: the key above the controls names one of the
// step's own words (seaWords in scenes.js, those the chart has) or, where the caption leaves the sea no room to name one,
// the band is dropped (the caption's shade covers it; counted in the summary); it lists no word the sea has not named on
// screen; and where a step brings other words forward than the step before, the key says something else, at both widths.
// Then the step buttons and the ticks, and the whole story once more with reduced motion.
import { readFileSync } from "node:fs";
import { TEXT } from "../../site/text.js";
import { STORIES } from "../../site/story.js";
import { seaWords } from "../../site/scenes.js";
import { base, browser, done } from "./serve.mjs";
const slugs = process.argv.length > 2 ? process.argv.slice(2) : STORIES.map((s) => s.slug);
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const dash = (s) => String(s).replace(/-/g, "–").replace(/\s+/g, " ").trim();
const started = Date.now();
const lens = (file) => JSON.parse(readFileSync(new URL(`../../site/data/id-web-news-kompas/${file}`, import.meta.url)));
const charted = new Set(lens("chart.json").words), index = new Map(lens("meta.json").words.map((w, i) => [w, i]));
/** The words a step brings forward that the chart has; the first is the one the sea's key must name. */
const subjects = (part, step) => seaWords(part, step).filter((w) => charted.has(index.get(w)));
/** The words a key lists ("Di peta: a, b dan 2 lagi · rute “c” sampai 2014"), and the word of its route. */
const listed = (key) => (key.split(/: /)[1] || "").split(" · ").filter((part) => !/^(rute|the route)/.test(part)).join("").replace(/ (dan \d+ lagi|and \d+ more)$|^\d+ (kata|words)$/, "").split(", ").filter(Boolean);
const routed = (key) => key.match(/(?:rute|route of) “([^”]+)”/)?.[1];

/** In the page: the stage that holds the middle of the screen, and all that a reader would see of it. */
const look = () => {
  const head = document.querySelector(".masthead").getBoundingClientRect().bottom, vh = innerHeight, vw = innerWidth, middle = head + (vh - head) / 2;
  const scenes = [...document.querySelectorAll(".scene")], k = scenes.findIndex((s) => { const r = s.getBoundingClientRect(); return r.top <= middle && r.bottom >= middle; });
  const landing = document.querySelector(".landing").getBoundingClientRect().top - head;
  if (k < 0) return { k, landing, y: scrollY };
  const stage = scenes[k].querySelector(".stage"), plates = [...stage.querySelectorAll(".plate")], shown = plates.filter((p) => !p.classList.contains("off"));
  const tall = stage.classList.contains("tall"), win = stage.querySelector(".stage-figure").getBoundingClientRect();
  const fig = tall ? win : shown[0]?.querySelector("svg").getBoundingClientRect(), cap = stage.querySelector(".caption"), c = cap.getBoundingClientRect();
  const rows = [...(shown[0]?.querySelectorAll(".row") || [])], named = rows.filter((r) => r.style.opacity === "1").length < rows.length ? rows.filter((r) => r.style.opacity === "1") : [];
  return { k, y: scrollY, landing, step: +stage.dataset.step, plate: +stage.dataset.plate, shownAt: plates.findIndex((p) => !p.classList.contains("off")), stack: !!stage.querySelector(".plates"),
    plates: shown.length, stuck: Math.round(stage.getBoundingClientRect().top - head),
    fig: fig && [fig.top - head, vh - fig.bottom, fig.left, vw - fig.right].map(Math.round), moment: shown[0]?.querySelector(".state, .marker text")?.textContent || "",
    cap: [c.top - head, vh - c.bottom].map(Math.round), capHeight: Math.round(c.height),
    longer: cap.scrollHeight > cap.clientHeight + 1, scrolls: ["auto", "scroll"].includes(getComputedStyle(cap).overflowY),
    squeezed: cap.clientHeight < Math.min(cap.scrollHeight, 6 * parseFloat(getComputedStyle(cap.querySelector(".turn:not(.out) p:last-child") || cap).lineHeight)) - 2,
    // (a turn comes in from a few pixels below: --s2)
    phone: vw < 900, cut: (() => { const t = cap.querySelector(".turn:not(.out)")?.getBoundingClientRect(); return !!t && (t.top < head - 1 || t.bottom > c.bottom + 9); })(),
    outside: named.filter((r) => { const b = r.querySelector("line").getBoundingClientRect(); return b.top < win.top || b.bottom > win.bottom; }).length,
    smallest: Math.min(...[...(shown[0]?.querySelectorAll("text, tspan") || [])].filter((t) => t.textContent.trim()).map((t) => parseFloat(getComputedStyle(t).fontSize) * (shown[0].querySelector("svg").getBoundingClientRect().width / shown[0].querySelector("svg").viewBox.baseVal.width))),
    pitch: (() => { const ys = [...(shown[0]?.querySelectorAll(".row > line") || [])].map((t) => t.getBoundingClientRect().top); return ys.length > 1 ? Math.round(Math.min(...ys.slice(1).map((y, i) => y - ys[i]))) : null; })(),
    key: stage.querySelector(".sea-key").textContent, mute: stage.classList.contains("mute"), landed: stage.querySelector(".sea-key").dataset.at === `${k}/${stage.dataset.step}`, sea: !!document.querySelector(".story-sea .chart"),
    named: document.querySelector(".story-sea .chart")?.sea?.labels().names.map((n) => n.text) || [],
    text: cap.querySelector(".turn:not(.out)")?.textContent.replace(/\s+/g, " ").trim() || "", count: stage.querySelector(".count").textContent,
    tick: [...stage.querySelectorAll(".ticks button")].findIndex((b) => b.getAttribute("aria-current") === "step") };
};
/** In the page: whether some caption can be read, at least 40px of it, between the header and the bottom of the screen. */
const someCaption = () => {
  const head = document.querySelector(".masthead").getBoundingClientRect().bottom;
  return [...document.querySelectorAll(".caption")].some((c) => { const r = c.getBoundingClientRect(); return c.querySelector(".turn:not(.out)")?.textContent.trim() && Math.min(r.bottom, innerHeight) - Math.max(r.top, head) >= 40; });
};
/** Wait until the page has stopped scrolling. */
const settle = (page) => page.waitForTimeout(60).then(() => page.evaluate(() => new Promise((ok) => {
  let last = -1, same = 0;
  const tick = () => ((same = scrollY === last ? same + 1 : 0), (last = scrollY), same >= 4 ? ok() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
})));
/** Where step j of scene k is: the stage stuck under the header, j beats down. */
const spot = (page, k, j) => page.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`);
  return Math.round(scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight); }, [k, j]);

/** What is wrong with what the reader sees at step j of scene k. */
function judge(story, k, j, s, before = null) {
  const part = story.scenes[k], n = part.steps.length, step = part.steps[Math.max(0, j - 1)], wrong = [];
  if (s.k !== k) return [`the stage of scene ${s.k + 1} is on screen, not scene ${k + 1}`];
  if (s.step !== j) wrong.push(`the stage is at step ${s.step}`);
  if (Math.abs(s.stuck) > 1) wrong.push(`the stage is ${s.stuck}px from the header`);
  if (s.tick !== j) wrong.push(`tick ${s.tick} is marked`);
  if (s.count !== (j ? `${j} / ${n}` : TEXT.id.steps_n(n))) wrong.push(`the counter says "${s.count}"`);
  if (j ? !s.text.includes(plain(step.id)) : !s.text.startsWith(plain(part.id.title))) wrong.push(`the caption says "${s.text.slice(0, 40)}"`);
  if (s.plates !== 1) wrong.push(`${s.plates} figures shown`);
  else {
    if (s.fig.some((d) => d < -1)) wrong.push(`the figure is cut (top, bottom, left, right: ${s.fig.join(", ")})`);
    if (s.stack && (s.plate < 0 || s.shownAt !== s.plate)) wrong.push(`plate ${s.shownAt} shown, the step asks for plate ${s.plate}`);
    const moment = step.mark ?? (s.stack ? null : step.at);
    if (moment !== null && dash(s.moment) !== dash(moment)) wrong.push(`the figure is at "${s.moment}", the step at "${moment}"`);
  }
  if (s.pitch !== null && s.pitch < 17) wrong.push(`the figure's rows are ${s.pitch}px apart on screen`);
  if (s.outside) wrong.push(`${s.outside} of the rows the step names are outside the figure's window`);
  if (s.smallest < 11.9) wrong.push(`the figure has text ${s.smallest.toFixed(1)}px tall on screen`);
  if (s.phone && s.cut) wrong.push("the caption is cut: not wholly on screen in its band");
  if (!s.phone && s.squeezed) wrong.push("the caption band shows less than the step or six lines");
  if (s.cap.some((d) => d < -1)) wrong.push(`the caption band is off screen (top, bottom: ${s.cap.join(", ")})`);
  if (!s.phone && s.longer && !s.scrolls) wrong.push("the caption is longer than its band and the band does not scroll");
  if (s.capHeight < 60) wrong.push(`the caption band is ${s.capHeight}px tall`);
  if (s.sea && s.landed) {
    // The step's own words: one of them named, or the band dropped (where the caption leaves the sea no room to name one).
    const own = j ? subjects(part, step) : [];
    if (own.length && !own.some((w) => listed(s.key).includes(w) || routed(s.key) === w) && !s.mute) wrong.push(`the sea's key says "${s.key}", none of the step's ${own.join(", ")}`);
    if (!s.key !== s.mute) wrong.push(s.mute ? "the band is dropped though the key names words" : "the key is empty but its band is kept");
    const unnamed = listed(s.key).filter((w) => !s.named.includes(w));
    if (unnamed.length) wrong.push(`the sea's key lists ${unnamed.join(", ")}, which the sea does not name`);
    // A step that brings other words forward than the one before it changes what the key says.
    const [now, then] = [subjects(part, step), j > 1 ? subjects(part, part.steps[j - 2]) : []], within = (a, b) => a.every((w) => b.includes(w));
    const was = before?.k === k && before.step === j - 1 && before.landed && !before.mute && !s.mute && now.length && then.length && !within(now, then) && !within(then, now);
    if (was && before.key === s.key) wrong.push(`the sea's key still says "${s.key}" though the step brings ${subjects(part, step).join(", ")} forward`);
  }
  return wrong;
}

let total = 0;
const fresh = async (options) => {
  const page = await browser.newPage(options);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.addInitScript(() => { window.__shift = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__shift += e.value))).observe({ type: "layout-shift", buffered: true }); });
  return page;
};
for (const [width, height, scheme] of [[1280, 800, "light"], [360, 740, "dark"]]) {
  for (const slug of slugs) {
    const story = STORIES.find((s) => s.slug === slug), t0 = Date.now();
    if (!story) { total++; console.log(`== ${slug}: no such story`); continue; }
    const page = await fresh({ viewport: { width, height }, colorScheme: scheme });
    await page.goto(`${base}#/cerita/${slug}`);
    await page.waitForSelector(".stage .plate svg", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
    const steps = story.scenes.flatMap((part, k) => [...Array(part.steps.length + 1)].map((_, j) => [k, j]));
    const problems = [], note = (where, wrong) => wrong.length && problems.push(`${where}: ${wrong.join("; ")}`);
    let before = null, muted = 0;
    const at = async (where, k, j, landing = false) => {
      // Going down, the sea's key is read once the sea has landed on the step (it says what the sea then names).
      if (landing) await page.waitForFunction(([k, j]) => !document.querySelector(".story-sea .chart") || document.querySelector(`#scene-${k} .sea-key`)?.dataset.at === `${k}/${j}`, [k, j], { timeout: 6000 }).catch(() => {});
      const s = await page.evaluate(look);
      s.landed &&= landing;  // (only then: a pointer moved over the sea names the light under it, and a name may give way)
      note(`${where} scene ${k + 1} step ${j}`, judge(story, k, j, s, landing ? before : null));
      if (landing) (before = s), (muted += s.landed && s.mute);
    };

    // Down: the cover's control, then one key per step, to the landing.
    await page.click(".begin"); await settle(page);
    await at("down", 0, 0, true);
    const keys = ["ArrowDown", "Space", "PageDown", "ArrowRight"];
    for (let i = 1; i < steps.length; i++) { await page.keyboard.press(keys[i % keys.length]); await settle(page); await at(`down (${keys[i % keys.length]})`, ...steps[i], true); }
    await page.keyboard.press("ArrowDown"); await settle(page);
    const landed = await page.evaluate(look);
    if (Math.abs(landed.landing) > 2) problems.push(`down: the last step's next key does not land on the landing (${Math.round(landed.landing)}px off)`);

    // Up: one scroll per step, and halfway between steps (snapping off for that look) some caption must be readable.
    let blank = 0, halfways = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      const to = await spot(page, ...steps[i]), from = await page.evaluate(() => scrollY);
      if (i < steps.length - 1) {
        halfways++;
        await page.evaluate((y) => { document.documentElement.style.scrollSnapType = "none"; scrollTo(0, y); }, Math.round((to + from) / 2));
        await page.waitForTimeout(60);
        if (!(await page.evaluate(someCaption))) (blank++, problems.push(`up: halfway above scene ${steps[i][0] + 1} step ${steps[i][1] + 1} no caption can be read`));
        await page.evaluate((y) => { scrollTo(0, y); document.documentElement.style.scrollSnapType = ""; }, from);
      }
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, to - from); await settle(page);
      await at("up (scroll)", ...steps[i]);
    }

    // The controls: next, previous, a tick, and the arrow keys each move one step.
    const last = story.scenes[0].steps.length;
    await page.evaluate((y) => scrollTo(0, y), await spot(page, 0, 0)); await settle(page);
    for (const [act, j] of [[".step.on", 1], [".step.on", 2], [".step.back", 1], [`.ticks li:nth-child(${last + 1}) button`, last], [".ticks li:nth-child(1) button", 0]]) {
      await page.click(`#scene-0 ${act}`); await settle(page); await at(`control ${act}`, 0, j);
    }
    for (const [key, j] of [["ArrowRight", 1], ["ArrowDown", 2], ["ArrowUp", 1], ["ArrowLeft", 0]]) { await page.keyboard.press(key); await settle(page); await at(`key ${key}`, 0, j); }

    const shift = await page.evaluate(() => window.__shift);
    const bad = problems.length + page.errors.length + (shift > 0.05);
    total += bad;
    console.log(`${bad ? "FAIL" : "ok  "} ${slug} @${width}px ${scheme}: ${steps.length} steps down by key and up by scroll, ${halfways} halfway looks (${blank} without a caption); layout shift ${shift.toFixed(3)}; sea band dropped on ${muted}; errors ${page.errors.length}${page.errors.length ? " " + page.errors[0].slice(0, 90) : ""}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    problems.slice(0, 8).forEach((p) => console.log("     " + p));
    await page.close();
  }
}

// Reduced motion: no snapping, steps cut, and every step can still be read to the end.
for (const slug of slugs) {
  const story = STORIES.find((s) => s.slug === slug);
  if (!story) continue;
  const page = await fresh({ viewport: { width: 390, height: 780 }, reducedMotion: "reduce" });
  await page.goto(`${base}#/cerita/${slug}`);
  await page.waitForSelector(".stage .plate svg", { timeout: 20000 }).catch(() => {});
  const problems = [];
  if ((await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)) !== "none") problems.push("the page still snaps");
  await page.click(".begin"); await settle(page);
  const steps = story.scenes.flatMap((part, k) => [...Array(part.steps.length + 1)].map((_, j) => [k, j]));
  for (let i = 0; i < steps.length; i++) {
    if (i) { await page.keyboard.press("ArrowDown"); await settle(page); }
    const wrong = judge(story, ...steps[i], await page.evaluate(look));
    if (wrong.length) problems.push(`scene ${steps[i][0] + 1} step ${steps[i][1]}: ${wrong.join("; ")}`);
  }
  await page.keyboard.press("ArrowDown"); await settle(page);
  if (Math.abs((await page.evaluate(look)).landing) > 2) problems.push("the end does not reach the landing");
  const bad = problems.length + page.errors.length;
  total += bad;
  console.log(`${bad ? "FAIL" : "ok  "} ${slug} with reduced motion @390px: ${steps.length} steps; errors ${page.errors.length}`);
  problems.slice(0, 6).forEach((p) => console.log("     " + p));
  await page.close();
}
console.log(`${total ? `${total} PROBLEMS` : "stories hold"} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
await done(total);
