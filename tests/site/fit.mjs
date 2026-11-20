// node tests/site/fit.mjs [all] [slug ...]   Every page holds at any size, not at two. Every step of every story, and
// a page of every other kind, at a spread of screens (small, short and landscape phones, a fold, tablets both ways,
// laptops, a large screen, and text set larger: the root font at 130% and 200%), with reduced motion so that each
// look is of the layout settled. Fails on:
// - anything wider than the screen (the page scrolls sideways), or text that stands past either edge of the screen
//   where nothing scrolls to it (a row of chips that scrolls sideways may run on under its fade);
// - on a story's stage: a caption cut (its text past its band, or past the screen), a caption under the figure, the
//   sea's key or the controls; a figure not wholly in its room (title, rows, note: a strip that slides is held to its
//   window); the stage's step and back buttons under 44px, a tick under 44px tall or 24px wide; and a step that moves
//   the figure or the caption's band (layout that jumps as one steps);
// - a chart's title or legend not wholly in view (a strip that pans in its window: its pinned title and legend), a row
//   cut at the top or foot of a panned strip at rest, a row the step brings forward out of view, a legend that names
//   hollow rings at the moment where none are drawn; a stacked figure under 240px; a flowing card that goes on under
//   the controls without its fade and mark.
// A look is of the screen as it stands: what it cannot see is a text drawn on a canvas (the seas' names: labels.mjs),
// a colour, or an overlap between two pieces of text inside one SVG (labels.mjs holds the figures to that).
// `all` walks every size; by default a representative set that keeps it under about four minutes on two pages.
import { base, browser, done } from "./serve.mjs";
import { STORIES } from "../../site/story.js";
const args = process.argv.slice(2), every = args[0] === "all" && args.shift(), slugs = args.length ? args : STORIES.map((s) => s.slug);
const started = Date.now();
// [width, height, root font %]
const ALL = [[320, 568], [344, 882], [360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [430, 932], [480, 854], [540, 720], [600, 960], [768, 1024], [820, 1180], [912, 1368],
  [1024, 768], [1180, 820], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [667, 375], [844, 390], [932, 430], [390, 844, 130], [390, 844, 200], [1280, 800, 200]];
// (the stories, the long part, at five of them: the smallest phone, a phone with larger text, a phone held sideways, a
// tablet upright and a laptop; the other pages at eight)
const STORY_SIZES = every ? ALL : [[320, 568], [360, 740], [390, 844, 130], [844, 390], [1366, 768]];
const PAGE_SIZES = every ? ALL : [...STORY_SIZES, [768, 1024], [1024, 768], [1920, 1080]];
const OTHERS = ["#/", "#/peta", "#/kata/korupsi", "#/tahun", "#/temuan", "#/metode", "#/main", "#/tebak", "#/balap", "#/entitas", "#/potret/jokowi", "#/cerita", "#/tidak-ada"];

/** In the page: text and boxes standing past the screen's sides where nothing scrolls to them. */
const sideways = () => {
  const W = innerWidth, wrong = [];
  if (document.documentElement.scrollWidth > W + 1) wrong.push(`the page is ${document.documentElement.scrollWidth}px wide`);
  const scrolls = (n) => { for (let p = n.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true; } return false; };
  for (const n of document.querySelectorAll("#view *, .masthead *")) {
    if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(n).visibility === "hidden") continue;
    if ((r.right > W + 1 || r.left < -1) && !scrolls(n)) wrong.push(`“${n.textContent.trim().slice(0, 30)}” stands at ${Math.round(r.left)}–${Math.round(r.right)}px`);
    if (wrong.length > 4) break;
  }
  return wrong;
};

/** In the page: what is wrong on the stage of scene k as it stands at step j. */
const look = ([k, j]) => {
  const head = document.querySelector(".masthead").getBoundingClientRect().bottom, H = innerHeight, wrong = [];
  const stage = document.querySelector(`#scene-${k} .stage`), r = (n) => n.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  if (+stage.dataset.step !== j) wrong.push(`the stage is at step ${stage.dataset.step}`);
  const cap = stage.querySelector(".caption"), turn = cap.querySelector(".turn:not(.out)"), c = r(cap), t = turn && r(turn);
  const room = stage.querySelector(".stage-figure"), win = r(room), svg = stage.querySelector(".plate:not(.off) svg"), f = svg && r(svg), tall = stage.classList.contains("tall");
  const key = stage.querySelector(".sea-key"), nav = stage.querySelector(".stage-nav"), meta = stage.querySelector(".stage-meta");
  // Captions that flow as cards (app.js, stage: flow): the step's card stands where the band begins, clear of the
  // figure; the rest of a long one is read by scrolling the page (`more`: how far, checked below).
  const flow = stage.parentNode.classList.contains("flow"), card = flow && stage.parentNode.querySelectorAll(".beat")[j]?.querySelector(".said");
  const side = matchMedia("(width >= 900px) or ((orientation: landscape) and (width >= 560px))").matches;  // (app.js, SIDE)
  const end = r(nav).top - 1, more = card ? Math.max(0, Math.ceil(r(card).bottom - end)) : 0;
  if (card) {
    const d = r(card), shown = f && (tall ? win : f);
    if (Math.abs(d.top - c.top) > 4) wrong.push(`the step's card stands at ${Math.round(d.top)}px, its band at ${Math.round(c.top)}px`);
    if (shown && hit(d, shown)) wrong.push("the card lies on the figure");
    if (d.left < -1 || d.right > innerWidth + 1) wrong.push("the card runs past the screen's side");
  }
  if (t && !flow) {
    const risen = j === 0 && stage.classList.contains("risen") || j === 0 && getComputedStyle(turn).transform !== "none";
    if (t.bottom > H + 1 || t.top < head - 1) wrong.push(`the caption runs past the screen (${Math.round(t.top)}–${Math.round(t.bottom)}, screen ${Math.round(head)}–${H})`);
    if (t.bottom > c.bottom + 9 && !risen && cap.scrollHeight > cap.clientHeight + 1 && !cap.classList.contains("more")) wrong.push("the caption is cut in its band with nothing to say it goes on");
    if (cap.scrollHeight > cap.clientHeight + 1 && !risen) wrong.push(`the caption scrolls in its band (${cap.scrollHeight - cap.clientHeight}px more)`);
    for (const [name, n] of [["the sea's key", key], ["the controls", nav]]) if (n && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden" && hit(t, r(n))) wrong.push(`the caption lies under ${name}`);
    // (an opening may rise over the figure's foot, its note and the site's name, never over its marks)
    const shown = f && (tall ? win : f), foot = f ? 52 * (f.height / svg.viewBox.baseVal.height) : 0;
    if (shown && hit(t, shown) && !(risen && t.top >= shown.bottom - foot)) wrong.push("the caption lies on the figure");
  }
  if (f) {
    const box = tall ? win : f;
    if (box.top < head - 1 || box.bottom > H + 1 || box.left < -1 || box.right > innerWidth + 1) wrong.push(`the figure is not wholly on screen (${[box.top, box.bottom, box.left, box.right].map(Math.round).join(", ")})`);
    if (!tall && (f.top < win.top - 1 || f.bottom > win.bottom + 1)) wrong.push(`the figure is ${Math.round(f.height)}px tall in a room of ${Math.round(win.height)}px`);
    // (the opening's meta rises with it over the figure's foot)
    for (const n of [meta, key, nav]) if (n && n.getClientRects().length && hit(box, r(n)) && getComputedStyle(n).visibility !== "hidden" && !(j === 0 && n === meta && r(n).top >= box.bottom - 52 * (f.height / svg.viewBox.baseVal.height))) wrong.push(`the figure lies under ${n.className}`);
  }
  // The chart's head: a strip that pans shows its title and legend pinned over its window; any other, its own.
  const pin = stage.querySelector(".pinned"), pinned = tall && pin && getComputedStyle(pin).display !== "none";
  if (f) {
    const top = pinned ? r(pin) : svg.querySelector(".title").getBoundingClientRect(), legendBox = svg.querySelector("circle")?.getBoundingClientRect();
    if (tall && !pinned && svg.dataset.pitch) wrong.push("a strip that pans has no pinned title and legend");
    if (top.top < Math.max(head, win.top) - 1 || top.bottom > win.bottom + 1 || (!pinned && legendBox && (legendBox.top < Math.max(head, win.top) - 1 || legendBox.bottom > win.bottom + 1))) wrong.push(`the chart's title or legend is not wholly in view (${Math.round(top.top)}–${Math.round(top.bottom)}, window ${Math.round(win.top)}–${Math.round(win.bottom)})`);
    // A strip that pans, at rest: no row cut at the head or the foot of what shows, and the rows the step names in view.
    if (pinned && svg.dataset.pitch) {
      const cut = getComputedStyle(room).getPropertyValue("--cut").trim(), from = r(pin).bottom, to = cut.endsWith("px") ? win.top + parseFloat(cut) : win.bottom;
      const scale = f.height / svg.viewBox.baseVal.height, half = (+svg.dataset.pitch * scale) / 2;
      const bands = [...svg.querySelectorAll(".row")].map((g) => { const y = r(g.querySelector("line")).top; return { a: y - half, b: y + half, named: g.style.opacity === "1" }; });
      if (bands.some((x) => x.a < from - 1.5 && x.b > from + 1.5 || x.a < to - 1.5 && x.b > to + 1.5)) wrong.push("a row of the panned chart is cut at rest");
      const named = bands.filter((x) => x.named);
      if (named.length < bands.length && named.length && named.at(-1).b - named[0].a <= to - from && named.some((x) => x.a < from - 1.5 || x.b > to + 1.5)) wrong.push("a row the step names is out of view");
    }
    // Hollow rings are named in the legend only where they are drawn: not at the strip's first moment.
    const rings = svg.querySelector(".rings-key"), first = rings?.textContent.split(": ").at(-1), now = svg.querySelector(".state")?.textContent;
    if (rings && (rings.getAttribute("opacity") !== "0") !== (now !== first)) wrong.push(`the legend's hollow rings ${now === first ? "are named where none are drawn" : "are not named"}`);
    if (!side && win.height < 239.5) wrong.push(`the figure's window is ${Math.round(win.height)}px tall`);
  }
  if (card && r(card).bottom > end + 8 && !stage.classList.contains("more-below")) wrong.push("the card goes on under the controls with no fade or mark");
  for (const b of stage.querySelectorAll(".stage-nav .step")) { const s = r(b); if (s.width < 43.5 || s.height < 43.5) wrong.push(`a step button is ${Math.round(s.width)}x${Math.round(s.height)}px`); }
  const ticks = [...stage.querySelectorAll(".ticks:not(.glance) button")].map(r);  // (a row of ticks too narrow to be targets is a picture: app.js, glance)
  if (ticks.some((s) => s.height < 43.5 || s.width < 23.5)) wrong.push(`a tick is ${Math.round(Math.min(...ticks.map((s) => s.width)))}x${Math.round(Math.min(...ticks.map((s) => s.height)))}px`);
  return { wrong, more, at: [Math.round(win.top), Math.round(win.height), Math.round(c.top), Math.round(c.height)].join(",") };
};

let failures = 0, looks = 0;
const report = (where, wrong) => { if (!wrong.length) return; failures++; console.log(`FAIL ${where}: ${[...new Set(wrong)].slice(0, 4).join("; ")}`); };
const fresh = async ([width, height, font = 100]) => {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width < 900, isMobile: false });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  if (font !== 100) await page.addInitScript((font) => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = font + "%")), font);
  return page;
};
const name = ([w, h, font]) => `${w}x${h}${font ? ` @${font}%` : ""}`;

/** Every step of every story at one size. */
async function stories(size) {
  const page = await fresh(size);
  for (const slug of slugs) {
    const story = STORIES.find((s) => s.slug === slug);
    await page.goto(`${base}#/cerita/${slug}`);
    await page.waitForSelector(".stage .plate svg", { state: "attached", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    report(`${slug} cover ${name(size)}`, await page.evaluate(sideways));
    for (const [k, part] of story.scenes.entries()) {
      const at = new Set();
      for (let j = 0; j <= part.steps.length; j++) {
        await page.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight + 2); }, [k, j]);
        await page.waitForFunction(([k, j]) => +document.querySelector(`#scene-${k} .stage`).dataset.step === j, [k, j], { timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(40);
        const s = await page.evaluate(look, [k, j]);
        looks++;
        // A card longer than its band: scrolled on by what is left of it, the step is the same and its foot above the controls.
        if (s.more) {
          const rest = await page.evaluate(([k, j, more]) => { scrollBy(0, more + 4); return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => {
            const sc = document.getElementById(`scene-${k}`), stage = sc.querySelector(".stage"), card = sc.querySelectorAll(".beat")[j].querySelector(".said");
            const wrong = [];
            if (+stage.dataset.step !== j) wrong.push(`read on, the card hands the stage to step ${stage.dataset.step} before its end`);
            if (card.getBoundingClientRect().bottom > stage.querySelector(".stage-nav").getBoundingClientRect().top + 1) wrong.push("read on, the card's end stays under the controls");
            ok(wrong);
          }))); }, [k, j, s.more]);
          s.wrong.push(...rest);
        }
        if (j) at.add(s.at);
        report(`${slug} scene ${k + 1} step ${j} ${name(size)}`, [...s.wrong, ...(j === part.steps.length ? await page.evaluate(sideways) : [])]);
      }
      if (at.size > 1 && Math.max(...[...at].map((x) => x.split(",")).flatMap((a, _, all) => a.map((v, i) => Math.abs(v - all[0][i])))) > 1.5) report(`${slug} scene ${k + 1} ${name(size)}`, [`stepping moves the figure or the caption's band (${[...at].join(" | ")})`]);
    }
    if (page.errors.length) report(`${slug} ${name(size)}`, page.errors.slice(0, 1));
  }
  await page.close();
}
/** A page of every other kind at one size: once arrived, and once scrolled to its foot. */
async function others(size) {
  const page = await fresh(size);
  for (const hash of OTHERS) {
    await page.goto(base + hash);
    await page.waitForTimeout(1000);
    const top = await page.evaluate(sideways);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    looks += 2;
    report(`${hash} ${name(size)}`, [...top, ...(await page.evaluate(sideways)), ...page.errors.slice(0, 1)]);
    page.errors = [];
  }
  await page.close();
}

// Two pages at a time, no more (a shared machine).
const jobs = [...STORY_SIZES.map((size) => () => stories(size)), ...PAGE_SIZES.map((size) => () => others(size))];
await Promise.all([0, 1].map(async () => { while (jobs.length) await jobs.shift()(); }));
console.log(`${failures ? `${failures} PROBLEMS` : "every page holds"}: ${looks} looks at ${PAGE_SIZES.length} sizes (${((Date.now() - started) / 1000).toFixed(0)} s)`);
await done(failures);
