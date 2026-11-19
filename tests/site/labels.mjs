// node tests/site/labels.mjs   Names over a picture never overlap (site/labels.js, the one placement): on the home
// hero (its route sailed and its notes out, then after a click on its open water), a story's sea (steps of three
// stories), the map and two words' route plates, at 1440 and 390 wide; on each, no name twice. On a sea, the names it placed (sea.labels()) must not touch each other, what the sea
// reserved (the routes, the rings) or, measured here from the page, what lies over the sea (the hero's text and legend;
// the story's figure, caption, meta and controls; the map's buttons, year and fields). On a plate, the islands' names,
// the years along the route and the ship's year must not touch each other or the route.
// Then every step of every story, at 390 and 1440 wide: on the figure shown, no name, value or pill touches another
// (a pill and its own value excepted), and no row of a strip and no name of a line is cut: each wholly inside the
// figure's window (a strip that slides, or one a phone's opening rises over: each row wholly inside its window; one
// at its edge fades there) and clear of the caption and its meta
// that lie over the figure (a phone's opening rises over the figure's foot, never over a row).
// node tests/site/labels.mjs [figures]   only the stories' figures
import { base, browser, done } from "./serve.mjs";
import { STORIES } from "../../site/story.js";
const only = process.argv[2];
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };

/** In the page: what is wrong with the names on the sea in `chart` (a selector), given what lies over it (`over`). */
const seaLook = ([chart, over]) => {
  const sea = document.querySelector(chart)?.sea;
  if (!sea) return { missing: true };
  const { names, reserved } = sea.labels(), hit = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
  const dom = [...document.querySelectorAll(over)].map((n) => n.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => [r.left, r.top, r.right, r.bottom]);
  const wrong = [];
  names.forEach((a, i) => {
    names.slice(i + 1).forEach((b) => (hit(a.box, b.box) && wrong.push(`"${a.text}" on "${b.text}"`), a.text === b.text && wrong.push(`"${a.text}" named twice`)));
    if (reserved.some((r) => hit(a.box, r))) wrong.push(`"${a.text}" on the route or a ring`);
    if (dom.some((r) => hit(a.box, r))) wrong.push(`"${a.text}" under what lies over the sea`);
  });
  return { names: names.map((n) => n.text), wrong };
};
/** In the page: what is wrong with the names on a word's route plate. */
const plateLook = () => {
  const svg = document.querySelector(".path-plate svg");
  if (!svg) return { missing: true };
  const hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const texts = [...svg.querySelectorAll("text.island-label, text.route-year, text.when-label")].filter((t) => t.textContent.trim()).map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }));
  const route = svg.querySelector(".route-line"), m = route.getScreenCTM(), length = route.getTotalLength();
  const points = [...Array(Math.ceil(length / 3))].map((_, i) => route.getPointAtLength(i * 3)).map((p) => [p.x * m.a + p.y * m.c + m.e, p.x * m.b + p.y * m.d + m.f]);
  const wrong = [];
  texts.forEach((a, i) => {
    texts.slice(i + 1).forEach((b) => (hit(a.r, b.r) && wrong.push(`"${a.text}" on "${b.text}"`), a.text === b.text && wrong.push(`"${a.text}" named twice`)));
    if (points.some(([x, y]) => x > a.r.left + 1 && x < a.r.right - 1 && y > a.r.top + 1 && y < a.r.bottom - 1)) wrong.push(`"${a.text}" on the route`);
  });
  return { names: texts.map((t) => t.text), wrong };
};
const stage = (page, k, j) => page.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight); }, [k, j]);
const report = (name, s) => log(name, !s.missing && !s.wrong.length, s.missing ? "no picture" : `${s.names.length} names${s.wrong.length ? `; ${s.wrong.slice(0, 4).join("; ")}` : ""}`);

/** In the page: what is wrong with the figure shown on scene k's stage. */
const figureLook = (k) => {
  const stage = document.querySelector(`#scene-${k} .stage`), svg = stage?.querySelector(".stage-figure .plate:not(.off) svg");
  if (!svg) return { missing: true };
  const r = (n) => n.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const shown = (n) => { for (let x = n; x && x !== svg; x = x.parentNode) if (x.style?.opacity === "0" || x.getAttribute?.("opacity") === "0") return false; return true; };
  // The names and values (a line's name at its end, a row's name and its value) and the pills on the beacon.
  const marks = [...svg.querySelectorAll(".series text, .row text, rect.beacon")].filter((n) => shown(n) && (n.tagName === "rect" || n.textContent.trim()))
    .map((n) => ({ n, text: n.tagName === "rect" ? `pill of "${n.nextElementSibling?.textContent}"` : n.textContent.trim(), box: r(n) })).filter((m) => m.box.width && m.box.height);
  const wrong = [];
  marks.forEach((a, i) => marks.slice(i + 1).forEach((b) => a.n.nextElementSibling !== b.n && b.n.nextElementSibling !== a.n && hit(a.box, b.box) && wrong.push(`"${a.text}" on "${b.text}"`)));
  // Nothing cut: inside the window, clear of the caption and its meta.
  const box = r(stage.querySelector(".stage-figure")), tall = stage.classList.contains("tall"), head = document.querySelector(".masthead").getBoundingClientRect().bottom;
  // (a strip that slides ends its window where a phone's opening rises over it: style.css)
  const ends = stage.matches(".tall, .risen") && stage.dataset.step === "0", rise = parseFloat(getComputedStyle(stage).getPropertyValue("--rise")) || 0;
  const win = { top: box.top, bottom: box.bottom - (ends ? rise + 4 : 0) };
  const over = [...stage.querySelectorAll(".caption .turn:not(.out), .stage-meta")].map(r).filter((b) => b.height);
  // A row is its name, its rule, its value and the dots that are shown.
  const union = (boxes) => ({ left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) });
  const parts = [...svg.querySelectorAll(".row")].map((g) => ({ text: g.querySelector("text")?.textContent.trim(), box: union([...g.querySelectorAll("text, line, .dot")].filter((n) => shown(n) && n.style.opacity !== "0" && (n.tagName !== "text" || n.textContent.trim())).map(r)) }))
    .concat(marks.filter((m) => m.n.closest(".series") && m.n.tagName === "text").map((m) => ({ text: m.text, box: m.box })));
  for (const p of parts) {
    // A strip that slides through its window: a row that is not wholly in the window is where the window fades.
    if ((tall || ends) && (p.box.top < win.top - 1 || p.box.bottom > win.bottom + 1)) continue;
    if (p.box.top < Math.max(win.top, head) - 1 || p.box.bottom > Math.min(win.bottom, innerHeight) + 1) wrong.push(`"${p.text}" cut by the figure's edge`);
    else if (over.some((o) => hit(p.box, o))) wrong.push(`"${p.text}" under the caption`);
  }
  return { names: marks.map((m) => m.text), wrong };
};
/** Every step of every story: its figure as figureLook sees it. */
async function stories(width) {
  const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 900 }, reducedMotion: "reduce", colorScheme: "dark" });
  let steps = 0, bad = 0;
  for (const story of STORIES) {
    await page.goto(`${base}#/cerita/${story.slug}`);
    await page.waitForFunction((n) => document.querySelectorAll(".stage .plate svg").length >= n, story.scenes.length, { timeout: 30000 }).catch(() => {});
    const wrong = [];
    for (const [k, part] of story.scenes.entries()) for (let j = 0; j <= part.steps.length; j++) {
      await stage(page, k, j);
      await page.waitForFunction(([k, j]) => document.querySelector(`#scene-${k} .stage`)?.dataset.step === String(j), [k, j], { timeout: 5000 }).catch(() => {});
      // (with reduced motion a mark still waits its turn, 45 ms a row, before it moves: until no transition is left)
      await page.waitForFunction(() => !document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === "running"), null, { timeout: 5000, polling: 50 }).catch(() => {});
      const s = await page.evaluate(figureLook, k);
      steps++;
      if (s.missing || s.wrong.length) (bad++, wrong.push(`scene ${k + 1} step ${j}: ${s.missing ? "no figure" : s.wrong.slice(0, 3).join("; ")}`));
    }
    log(`story ${story.slug} figures @${width}px`, !wrong.length, `${story.scenes.reduce((n, p) => n + p.steps.length + 1, 0)} steps${wrong.length ? `; ${wrong.length} wrong: ${wrong.slice(0, 4).join(" | ")}` : ""}`);
  }
  console.log(`     ${steps} steps at ${width}px, ${bad} with a figure's names touching or a row cut`);
  await page.close();
}

for (const width of only === "figures" ? [] : [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 900 } }), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "#/"); await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(6000);
  report(`home hero @${width}px`, await page.evaluate(seaLook, [".hero .chart", ".hero-text > *, .hero-key"]));
  // A click on the open water sails the word nearest it, which the pointer still rests on: it is named once.
  const water = await page.evaluate(() => { const r = document.querySelector(".hero .chart canvas").getBoundingClientRect(), t = document.querySelector(".hero-text").getBoundingClientRect();
    return innerWidth >= 900 ? [Math.round((t.right + r.right) / 2), Math.round(r.top + r.height * 0.55)] : [Math.round(r.width / 2), Math.round(r.top + 140)]; });
  await page.mouse.move(...water); await page.waitForTimeout(400); await page.mouse.click(...water); await page.waitForTimeout(4000);
  report(`home hero after a click on the water @${width}px`, await page.evaluate(seaLook, [".hero .chart", ".hero-text > *, .hero-key"]));
  for (const [slug, steps] of [["kata-korupsi", [[0, 3], [1, 2], [2, 4]]], ["viral-polisi", [[0, 1], [1, 2], [2, 3]]], ["dilupakan", [[0, 5], [0, 7]]]]) {
    await page.goto(`${base}#/cerita/${slug}`); await page.waitForSelector(".stage .plate svg", { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
    for (const [k, j] of steps) {
      if (!(await page.$(`#scene-${k}`))) continue;
      await stage(page, k, j); await page.waitForTimeout(2600);
      report(`story ${slug} scene ${k + 1} step ${j} @${width}px`, await page.evaluate(seaLook, [".story-sea .chart", `#scene-${k} :is(.stage-figure .plate:not(.off) svg, .caption .turn:not(.out), .stage-meta, .stage-nav), .sea-key`]));
    }
  }
  await page.goto(base + "#/peta"); await page.waitForTimeout(5000);
  report(`map @${width}px`, await page.evaluate(seaLook, [".map-deep .chart", ".map-deep .chart :is(.zoom, .when > *), .map-steer"]));
  for (const word of ["kpk", "korupsi"]) {
    await page.goto(`${base}#/kata/${word}`); await page.waitForSelector(".path-plate svg", { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(800);
    report(`word ${word} route plate @${width}px`, await page.evaluate(plateLook));
  }
  log(`no errors @${width}px`, !errors.length, errors.join(" | ") || "none");
  await page.close();
}
for (const width of [390, 1440]) await stories(width);
await done(failures);
