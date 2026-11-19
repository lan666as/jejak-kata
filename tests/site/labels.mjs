// node tests/site/labels.mjs   Names over a picture never overlap (site/labels.js, the one placement): on the home
// hero (its route sailed and its notes out), a story's sea (three steps of two stories), the map and two words' route
// plates, at 1440 and 390 wide. On a sea, the names it placed (sea.labels()) must not touch each other, what the sea
// reserved (the routes, the rings) or, measured here from the page, what lies over the sea (the hero's text and legend;
// the story's figure, caption, meta and controls; the map's buttons, year and fields). On a plate, the islands' names,
// the years along the route and the ship's year must not touch each other or the route.
import { base, browser, done } from "./serve.mjs";
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
    names.slice(i + 1).forEach((b) => hit(a.box, b.box) && wrong.push(`"${a.text}" on "${b.text}"`));
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
    texts.slice(i + 1).forEach((b) => hit(a.r, b.r) && wrong.push(`"${a.text}" on "${b.text}"`));
    if (points.some(([x, y]) => x > a.r.left + 1 && x < a.r.right - 1 && y > a.r.top + 1 && y < a.r.bottom - 1)) wrong.push(`"${a.text}" on the route`);
  });
  return { names: texts.map((t) => t.text), wrong };
};
const stage = (page, k, j) => page.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight); }, [k, j]);
const report = (name, s) => log(name, !s.missing && !s.wrong.length, s.missing ? "no picture" : `${s.names.length} names${s.wrong.length ? `; ${s.wrong.slice(0, 4).join("; ")}` : ""}`);

for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 900 } }), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "#/"); await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(6000);
  report(`home hero @${width}px`, await page.evaluate(seaLook, [".hero .chart", ".hero-text > *, .hero-key"]));
  for (const [slug, steps] of [["kata-korupsi", [[0, 3], [1, 2], [2, 4]]], ["viral-polisi", [[0, 1], [1, 2], [2, 3]]]]) {
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
await done(failures);
