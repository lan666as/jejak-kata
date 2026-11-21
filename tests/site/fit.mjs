// node tests/site/fit.mjs [all] [slug ...]   Every page holds at any size, not at two. Every step of every story, and
// a page of every other kind, at a spread of screens (small, short and landscape phones, a fold, tablets both ways,
// laptops, a large screen, and text set larger: the root font at 130% and 200%, and at 130% once more set only after
// the story has been laid out, as a reader who enlarges the text on a page already open), with reduced motion so that
// each look is of the layout settled. Each story is walked twice: by scrolling to each step, and by the next button; and
// once more with every caption 30% longer (injected here into story.js as it is served: story.js is not changed).
// Fails on:
// - anything wider than the screen (the page scrolls sideways), or text that stands past either edge of the screen
//   where nothing scrolls to it (a row of chips that scrolls sideways may run on under its fade);
// - on a story's stage, at rest, read line by line (the text's own line boxes): a line of the caption cut (part of it
//   clipped by its band, the header or the screen's edge), a caption faded (a mask or an opacity under 1 on it), a
//   line under the controls, the sea's key, the figure or the step's meta, or below the controls' top; text of
//   anything else (the step before, a card) lying on a line of it; and a caption whose text goes on out of sight
//   without the one way to read the rest, its "Baca selengkapnya" control, wholly on screen, 44px tall and clear of
//   the text (app.js, stage: clamp); a caption that reads on showing fewer than two lines of its text (beyond its
//   head) while a stacked figure keeps more than its least, 240px. Where the button walk finds that control it presses
//   it: the sheet that opens must be opaque, clear of the controls, hold every line of the caption, whole (scrolled to
//   its end where it is longer than the stage), and be no taller than its text needs (a short text leaves the figure
//   in sight); pressed again, it closes. The controls must be opaque;
// - a figure not wholly in its room (title, rows, note: a strip that slides is held to its window); the stage's step
//   and back buttons under 44px, a tick under 44px tall or 24px wide; a step that moves the figure or the caption's
//   band (layout that jumps as one steps);
// - a chart's title or legend not wholly in view (a strip that pans: its pinned title and legend), a row cut at the
//   top or foot of a panned strip at rest, any row the step names (its focus; "*" the row of all pages) out of view
//   (in the window, or in the rows shown past the gap where the window elides it), a number on the beacon not wholly
//   inside the window or the rows past the gap (half a pill cut at the figure's edge), any text on a figure under 12px on
//   screen, a legend that names hollow rings at the moment where none are drawn; a stacked figure under 240px.
// A look is of the screen as it stands: what it cannot see is a text drawn on a canvas (the seas' names: labels.mjs),
// a colour's contrast, or an overlap between two pieces of text inside one SVG (labels.mjs holds the figures to that).
// `all` walks every size, and the phones at 100%, 130% and 200% with captions as they are and 30% longer; by default
// a representative set that keeps it under about five minutes on two pages.
import { base, browser, done } from "./serve.mjs";
import { STORIES } from "../../site/story.js";
const args = process.argv.slice(2), every = args[0] === "all" && args.shift(), slugs = args.length ? args : STORIES.map((s) => s.slug);
const started = Date.now();
// [width, height, root font %]
const ALL = [[320, 568], [344, 882], [360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [430, 932], [480, 854], [540, 720], [600, 960], [768, 1024], [820, 1180], [912, 1368],
  [1024, 768], [1180, 820], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [667, 375], [844, 390], [932, 430], [390, 844, 130], [390, 844, 200], [1280, 800, 200]];
// The phones (and a tablet) a story's captions are held at, at three text sizes, as they are and 30% longer.
const PHONES = [[320, 568], [360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [430, 932], [844, 390], [932, 430], [768, 1024]].flatMap(([w, h]) => [100, 130, 200].map((f) => [w, h, f]));
const key = ([w, h, f = 100, late = ""]) => `${w}x${h}@${f}${late}`;
// (by default the stories, the long part, at five of them: the smallest phone, a phone with larger text, a phone held
// sideways, a tablet upright and a laptop; the next button at the first three; with the captions 30% longer at the
// first and third; the other pages at eight)
// ([w, h, font, "late"]: the root font set only once the story is laid out)
const STORY_SIZES = every ? [...new Map([...ALL, ...PHONES, [390, 844, 130, "late"]].map((s) => [key(s), s])).values()] : [[320, 568], [360, 740], [390, 844, 130], [390, 844, 130, "late"], [844, 390], [1366, 768]];
const LONG_SIZES = every ? [...PHONES] : [[320, 568], [390, 844, 130]];
// (by default the next button walks at the three hardest: the smallest phone, larger text, a phone held sideways)
const BUTTON = (size) => every || ONLY || ["320x568@100", "390x844@130", "390x844@130late", "844x390@100"].includes(key(size));
const PAGE_SIZES = every ? ALL : [[320, 568], [360, 740], [390, 844, 130], [844, 390], [1366, 768], [768, 1024], [1024, 768], [1920, 1080]];
// FIT_SIZES=320x568,390x844@130 walks the stories at those sizes only (both ways), and no other page: a quick look.
const ONLY = process.env.FIT_SIZES?.split(",").map((x) => [...x.match(/\d+/g).map(Number), ...(/late/.test(x) ? ["late"] : [])].map((v, i) => (i === 2 && v === undefined ? 100 : v)));
if (ONLY) STORY_SIZES.splice(0, Infinity, ...ONLY), LONG_SIZES.splice(0, Infinity, ...ONLY), PAGE_SIZES.splice(0, Infinity);
const OTHERS = ["#/", "#/peta", "#/kata/korupsi", "#/tahun", "#/temuan", "#/metode", "#/main", "#/tebak", "#/kuis", "#/menempel", "#/redaksi", "#/balap", "#/entitas", "#/potret/jokowi", "#/cerita", "#/tidak-ada"];

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

/** In the page: the helpers a look needs, put on window once. */
const helpers = () => {
  if (window.__fit) return;
  const r = (n) => n.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const seen = (n) => !!n && n.getClientRects().length > 0 && n.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !n.closest(".hidden");
  /** The lines of text under `node` as the reader sees them: a box per line (a line's pieces joined), as tall as its
   *  glyphs' box or, where the line is set tighter than that (a title), as its line (about the same middle). */
  const lines = (node) => {
    const boxes = [], walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.textContent.trim() || !seen(t.parentElement)) continue;
      const range = document.createRange(), line = parseFloat(getComputedStyle(t.parentElement).lineHeight);
      range.selectNodeContents(t);
      for (const b of range.getClientRects()) {
        const h = Math.min(b.height, line || b.height), mid = (b.top + b.bottom) / 2;
        if (b.width > 1 && b.height > 1) boxes.push({ top: mid - h / 2, bottom: mid + h / 2, left: b.left, right: b.right, text: t.textContent.trim() });
      }
    }
    const rows = [];
    for (const b of boxes.sort((a, b) => a.top - b.top)) {
      const row = rows.find((x) => Math.abs((x.top + x.bottom) / 2 - (b.top + b.bottom) / 2) < Math.min(x.bottom - x.top, b.bottom - b.top) / 2);
      if (row) Object.assign(row, { top: Math.min(row.top, b.top), bottom: Math.max(row.bottom, b.bottom), left: Math.min(row.left, b.left), right: Math.max(row.right, b.right) });
      else rows.push({ ...b });
    }
    return rows;
  };
  /** What of the screen a node's text can show in: the screen under the header, cut by every box around it that clips. */
  const clip = (node) => {
    const box = { top: document.querySelector(".masthead").getBoundingClientRect().bottom, bottom: innerHeight, left: 0, right: innerWidth };
    for (let p = node.nodeType === 1 ? node : node.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowY === "visible" && cs.overflowX === "visible" && cs.clipPath === "none") continue;
      const b = r(p);
      Object.assign(box, { top: Math.max(box.top, b.top), bottom: Math.min(box.bottom, b.bottom), left: Math.max(box.left, b.left), right: Math.min(box.right, b.right) });
    }
    return box;
  };
  /** A caption's text as it stands: its lines whole in view, cut, or out of sight; what lies on them; whether faded. */
  const read = (text, stop, others) => {
    const wrong = [], box = clip(text), all = lines(text), shownLines = [], gone = [];
    for (const l of all) {
      const inside = l.top >= box.top - 1 && l.bottom <= box.bottom + 1 && l.left >= box.left - 1 && l.right <= box.right + 1, out = l.bottom <= box.top + 1 || l.top >= box.bottom - 1;
      if (inside) shownLines.push(l);
      else if (out) gone.push(l);
      else wrong.push(`a line of the caption is cut at rest (“${l.text.slice(0, 24)}”, ${Math.round(l.top)}–${Math.round(l.bottom)} in ${Math.round(box.top)}–${Math.round(box.bottom)})`);
    }
    for (let p = text; p && p !== stop; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ((cs.maskImage && cs.maskImage !== "none") || (cs.webkitMaskImage && cs.webkitMaskImage !== "none")) { wrong.push("the caption is faded (a mask over it)"); break; }
      if (+cs.opacity < 1) { wrong.push(`the caption is faded (opacity ${cs.opacity})`); break; }
    }
    // Nothing lies on a line: the controls, the sea's key, the figure, the meta, another text.
    for (const [name, n] of others) if (n && (!n.getClientRects || (seen(n) && n.textContent.trim() !== ""))) {
      const b = n.getClientRects ? r(n) : n;  // (an element, or the figure's box as it shows)
      const on = shownLines.find((l) => hit(l, b));
      if (on) wrong.push(`${name} lies on the caption's text (“${on.text.slice(0, 24)}”)`);
    }
    return { wrong, shown: shownLines, gone, box };
  };
  /** Text of anything else in the scene that is seen on a line of the caption (the step before, a card, a ghost). */
  const ghosts = (scene, text, shownLines) => {
    const out = [];
    if (!shownLines.length) return out;
    const area = { top: Math.min(...shownLines.map((l) => l.top)), bottom: Math.max(...shownLines.map((l) => l.bottom)), left: Math.min(...shownLines.map((l) => l.left)), right: Math.max(...shownLines.map((l) => l.right)) };
    for (const n of scene.querySelectorAll("*")) {
      if (text.contains(n) || n.contains(text) || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) || !hit(r(n), area) || !seen(n)) continue;
      const box = clip(n), on = lines(n).map((a) => ({ ...a, top: Math.max(a.top, box.top), bottom: Math.min(a.bottom, box.bottom), left: Math.max(a.left, box.left), right: Math.min(a.right, box.right) }))
        .find((a) => a.bottom - a.top > 2 && a.right - a.left > 2 && shownLines.some((l) => hit(a, l)));
      if (on) out.push(`text shows through the caption (“${on.text.slice(0, 24)}”)`);
      if (out.length) break;
    }
    return out;
  };
  const opaque = (n) => { const c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g); return !!c && (c.length < 4 || +c[3] === 1); };
  window.__fit = { r, hit, seen, lines, clip, read, ghosts, opaque };
};

/** In the page: what is wrong on the stage of scene k as it stands at step j. */
const look = ([k, j]) => {
  const { r, hit, seen, read, ghosts, opaque } = window.__fit;
  const head = document.querySelector(".masthead").getBoundingClientRect().bottom, H = innerHeight, wrong = [];
  const scene = document.getElementById(`scene-${k}`), stage = scene.querySelector(".stage");
  if (+stage.dataset.step !== j) wrong.push(`the stage is at step ${stage.dataset.step}`);
  const cap = stage.querySelector(".caption"), c = r(cap);
  const room = stage.querySelector(".stage-figure"), win = r(room), svg = stage.querySelector(".plate:not(.off) svg"), f = svg && r(svg), tall = stage.classList.contains("tall");
  const key = stage.querySelector(".sea-key"), nav = stage.querySelector(".stage-nav"), meta = stage.querySelector(".stage-meta"), more = stage.querySelector(".more-button");
  // The step's text: its caption on the stage, or where a caption is set apart as a card in its beat, that card.
  const card = scene.querySelectorAll(".beat")[j]?.querySelector(".said"), text = seen(card) ? card : cap.querySelector(".turn:not(.out)");
  const shownFig = f && (tall ? win : f);
  const reading = read(text, stage, [["the controls", nav], ["the sea's key", key], ["the step's meta", meta], ["the figure", shownFig], ["its own control", more]]);
  wrong.push(...reading.wrong, ...ghosts(scene, text, reading.shown));
  const navTop = r(nav).top, under = reading.shown.find((l) => l.bottom > navTop + 1);
  if (under) wrong.push(`a line of the caption stands at or below the controls (“${under.text.slice(0, 24)}”)`);
  // What is out of sight is reached by the one way: the "read on" control, on screen, a target, clear of the text.
  const hidden = reading.gone.length ? Math.round(reading.gone.at(-1).bottom - reading.box.bottom) : 0;
  // A caption that reads on shows at least two lines of its text where a stacked figure has more than its least (a
  // step's head is not its text; an opening's title, run into its text, is).
  const side = matchMedia("(width >= 900px) or ((orientation: landscape) and (width >= 560px))").matches;  // (app.js, SIDE)
  const body = [...text.querySelectorAll(j ? "p:not(.head, .title)" : "p:not(.head)")].filter((p) => seen(p));
  if (hidden && !side && body.length && win.height > 241) {
    const lines = reading.shown.filter((l) => body.some((p) => { const b = r(p); return l.top >= b.top - 1 && l.bottom <= b.bottom + 1; })).length;
    if (lines < 2) wrong.push(`the caption shows ${lines} line${lines === 1 ? "" : "s"} of its text while the figure takes ${Math.round(win.height)}px`);
  }
  if (hidden) {
    const b = more && r(more);
    if (!seen(more) || !more.textContent.trim()) wrong.push(`the caption goes on out of sight (${hidden}px) with no control to read the rest`);
    else if (b.top < head - 1 || b.bottom > H + 1 || b.height < 43.5) wrong.push(`the control to read on is not wholly on screen or under 44px (${Math.round(b.top)}–${Math.round(b.bottom)})`);
  }
  // A caption cut short ends on its last whole sentence that fits (app.js, clamp: the rest set aside until it is read
  // on); only where not even the first sentence of its text fits is it cut at a whole line, and then no sentence ends
  // in sight. Either way its control to read on is there.
  if (stage.classList.contains("clamped") && text === cap.querySelector(".turn:not(.out)")) {
    const said = text.textContent.trim(), bottom = r(text).bottom, range = document.createRange(), walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let fits = false;
    for (let t = walk.nextNode(); t && !fits; t = walk.nextNode()) if (!t.parentElement.closest(".head, .title")) for (const m of t.data.matchAll(/[.?!…]["”’)]*(?=\s|$)/g)) {
      range.setStart(t, m.index); range.setEnd(t, m.index + 1);
      const g = range.getClientRects()[0];
      if (g?.height && g.bottom <= bottom + 1) fits = true;
    }
    if (text.whole && !/[.?!…]["”’)]*$/.test(said)) wrong.push(`the caption is cut short off a sentence's end (“…${said.slice(-24)}”)`);
    if (!text.whole && fits) wrong.push(`the caption is cut at a line though a whole sentence of it fits (“…${said.slice(-24)}”)`);
    if (!seen(more)) wrong.push("a caption cut short has no control to read the rest");
  }
  // The scene's name over the caption, and the plate's title, are whole: never cut, never past their room.
  const part = meta?.querySelector(".stage-part");
  if (part && seen(part) && part.scrollWidth > part.clientWidth + 1) wrong.push(`the scene's name is cut (“${part.textContent.slice(0, 30)}”)`);
  if (svg) for (const line of svg.querySelectorAll(".title tspan")) if (line.getComputedTextLength() > svg.viewBox.baseVal.width - 12) { wrong.push(`the plate's title runs past its width (“${line.textContent.slice(0, 30)}”)`); break; }
  for (const b of stage.querySelectorAll(".stage-nav .step")) if (!opaque(b)) wrong.push("a control is not opaque");
  // A step's text set apart (old: cards in the page's scroll) never stands off its band.
  if (card && seen(card) && Math.abs(r(card).top - c.top) > 4) wrong.push(`the step's card stands at ${Math.round(r(card).top)}px, its band at ${Math.round(c.top)}px`);
  if (f) {
    const box = tall ? win : f;
    if (box.top < head - 1 || box.bottom > H + 1 || box.left < -1 || box.right > innerWidth + 1) wrong.push(`the figure is not wholly on screen (${[box.top, box.bottom, box.left, box.right].map(Math.round).join(", ")})`);
    if (!tall && (f.top < win.top - 1 || f.bottom > win.bottom + 1)) wrong.push(`the figure is ${Math.round(f.height)}px tall in a room of ${Math.round(win.height)}px`);
    // (the opening's meta rises with it over the figure's foot)
    for (const n of [meta, key, nav]) if (n && n.getClientRects().length && hit(box, r(n)) && getComputedStyle(n).visibility !== "hidden" && !(j === 0 && n === meta && r(n).top >= box.bottom - 52 * (f.height / svg.viewBox.baseVal.height))) wrong.push(`the figure lies under ${n.className}`);
    // No text on a figure under 12px on screen (at every phone size, 320 included).
    // (a plate held to a height keeps its shape inside its box: drawn at the smaller of the two scales)
    const scale = Math.min(f.width / svg.viewBox.baseVal.width, f.height / svg.viewBox.baseVal.height), small = Math.min(...[...svg.querySelectorAll("text")].filter((t) => t.textContent.trim()).map((t) => parseFloat(getComputedStyle(t).fontSize) * scale));
    if (small < 11.95) wrong.push(`a label on the figure is ${small.toFixed(1)}px on screen`);
  }
  // The chart's head: a strip that pans shows its title and legend pinned over its window; any other, its own.
  const pin = stage.querySelector(".pinned"), pinned = tall && pin && getComputedStyle(pin).display !== "none";
  if (f) {
    const top = pinned ? r(pin) : svg.querySelector(".title").getBoundingClientRect(), legendBox = svg.querySelector("circle")?.getBoundingClientRect();
    if (tall && !pinned && svg.dataset.pitch) wrong.push("a strip that pans has no pinned title and legend");
    if (top.top < Math.max(head, win.top) - 1 || top.bottom > win.bottom + 1 || (!pinned && legendBox && (legendBox.top < Math.max(head, win.top) - 1 || legendBox.bottom > win.bottom + 1))) wrong.push(`the chart's title or legend is not wholly in view (${Math.round(top.top)}–${Math.round(top.bottom)}, window ${Math.round(win.top)}–${Math.round(win.bottom)})`);
    // A strip that pans, at rest: no row cut at the head or the foot of what shows, and every row the step names in
    // view: in the window, or among the rows shown past its gap (`.elided`, app.js stage: the window elides the rows
    // between two the step names that lie far apart).
    if (pinned && svg.dataset.pitch) {
      const cut = getComputedStyle(room).getPropertyValue("--cut").trim(), from = r(pin).bottom, gap = stage.querySelector(".elided"), shut = seen(gap) ? r(gap).top : null;
      const to = shut ?? (cut.endsWith("px") ? win.top + parseFloat(cut) : win.bottom);
      const scale = f.height / svg.viewBox.baseVal.height, half = (+svg.dataset.pitch * scale) / 2;
      const bands = [...svg.querySelectorAll(".row")].map((g, i) => { const y = r(g.querySelector("line")).top; return { i, a: y - half, b: y + half, named: g.style.opacity === "1", label: g.querySelector("text").textContent }; });
      if (bands.some((x) => x.a < from - 1.5 && x.b > from + 1.5 || x.a < to - 1.5 && x.b > to + 1.5)) wrong.push("a row of the panned chart is cut at rest");
      const named = bands.filter((x) => x.named), past = shut === null ? [] : gap.dataset.rows.split(",").map((run) => run.split("-").map(Number));
      if (named.length < bands.length) {
        // (where a step names more rows than the window can hold at their least pitch, as many of them as fit: the
        // marks of the rows skipped take a row each, so all but two of the window's rows are named ones)
        const room = Math.floor((win.bottom - from + 1.5) / (2 * half)), hidden = named.filter((x) => (x.a < from - 1.5 || x.b > to + 1.5) && !past.some(([a, b]) => x.i >= a && x.i <= b));
        const out = named.length > room ? (named.length - hidden.length >= room - 2 ? [] : hidden) : hidden;
        if (out.length) wrong.push(`a row the step names is out of view (${out.map((x) => x.label).join(", ")})`);
        if (shut !== null && (r(gap).bottom > win.bottom + 1 || r(gap).top < from - 1)) wrong.push("the rows past the gap are not wholly in the window");
      }
      // The numbers on the beacon, whole: in the window above its cut, or within the rows shown past the gap.
      const views = [...(seen(gap) ? gap.querySelectorAll("svg") : [])].map((v) => ({ box: r(v), vb: v.viewBox.baseVal }));
      for (const g of svg.querySelectorAll(".row")) {
        const pill = g.querySelector(".beacon");
        if (!pill || pill.getAttribute("opacity") !== "1") continue;
        const p = r(pill), y = +pill.getAttribute("y"), hgt = +pill.getAttribute("height");
        const inWindow = p.top >= from - 1 && p.bottom <= to + 1, past = views.find((v) => y + hgt / 2 >= v.vb.y && y + hgt / 2 <= v.vb.y + v.vb.height);
        const inPast = past && y >= past.vb.y - 0.5 && y + hgt <= past.vb.y + past.vb.height + 0.5;
        if (!inWindow && !inPast && (past || (p.bottom > from + 1 && p.top < to - 1))) { wrong.push(`the number on the beacon of “${g.querySelector("text").textContent}” is cut at the figure's edge`); break; }
      }
    }
    // Hollow rings are named in the legend only where they are drawn: not at the strip's first moment.
    const rings = svg.querySelector(".rings-key"), first = rings?.textContent.split(": ").at(-1), now = svg.querySelector(".state")?.textContent;
    if (rings && (rings.getAttribute("opacity") !== "0") !== (now !== first)) wrong.push(`the legend's hollow rings ${now === first ? "are named where none are drawn" : "are not named"}`);
    const side = matchMedia("(width >= 900px) or ((orientation: landscape) and (width >= 560px))").matches;  // (app.js, SIDE)
    if (!side && win.height < 239.5) wrong.push(`the figure's window is ${Math.round(win.height)}px tall`);
  }
  for (const b of stage.querySelectorAll(".stage-nav .step")) { const s = r(b); if (s.width < 43.5 || s.height < 43.5) wrong.push(`a step button is ${Math.round(s.width)}x${Math.round(s.height)}px`); }
  const ticks = [...stage.querySelectorAll(".ticks:not(.glance) button")].filter((b) => b.getClientRects().length).map(r);  // (a row of ticks too narrow to be targets is a picture: app.js, glance; set aside where the control to read on takes its place)
  if (ticks.some((s) => s.height < 43.5 || s.width < 23.5)) wrong.push(`a tick is ${Math.round(Math.min(...ticks.map((s) => s.width)))}x${Math.round(Math.min(...ticks.map((s) => s.height)))}px`);
  return { wrong, hidden, at: [Math.round(win.top), Math.round(win.height), Math.round(c.top), Math.round(c.height)].join(",") };
};

/** In the page, the "read on" control pressed: the sheet holds the whole caption, opaque, clear of the controls. */
const sheet = async (k) => {
  const { r, hit, read, opaque } = window.__fit, wrong = [];
  const stage = document.querySelector(`#scene-${k} .stage`), cap = stage.querySelector(".caption"), nav = stage.querySelector(".stage-nav"), more = stage.querySelector(".more-button");
  const text = cap.querySelector(".turn:not(.out)");
  if (more.getAttribute("aria-expanded") !== "true") wrong.push("the control to read on does not open the caption");
  if (!opaque(cap)) wrong.push("the open caption is not opaque");
  if (hit(r(cap), r(nav))) wrong.push("the open caption lies under the controls");
  const all = window.__fit.lines(text).length;
  // (taller than the stage, the sheet scrolls: at its top no line is cut; scrolled, each line is seen whole somewhere)
  const scroller = [cap, ...cap.querySelectorAll("*")].find((n) => ["auto", "scroll"].includes(getComputedStyle(n).overflowY)) || cap;
  let seenLines = new Set();
  for (let tries = 0; tries < 40; tries++) {
    const at = read(text, stage, [["the controls", nav], ["its own control", more]]);
    wrong.push(...at.wrong.filter((w) => !tries || !/cut at rest/.test(w)));
    at.shown.forEach((l) => seenLines.add(Math.round(l.top + scroller.scrollTop)));
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) break;
    scroller.scrollTop += Math.max(20, scroller.clientHeight - 40);
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  }
  if (seenLines.size < all) wrong.push(`the open caption shows ${seenLines.size} of its ${all} lines`);
  // (no taller than its text: a sheet that does not scroll ends a little under its control)
  const turns = cap.querySelector(".turns"), spare = r(cap).bottom - r(more).bottom;
  if (turns.scrollHeight <= turns.clientHeight + 1 && spare > 40) wrong.push(`the open caption runs ${Math.round(spare)}px past its text, over the figure`);
  return [...new Set(wrong)];
};

let failures = 0, looks = 0;
const report = (where, wrong) => { if (!wrong.length) return; failures++; console.log(`FAIL ${where}: ${[...new Set(wrong)].slice(0, 4).join("; ")}`); };
// Every caption 30% longer: its own words again at its end, as many as make up 30% of its length (the steps, each
// scene's opening text and the story's intro).
const LONGER = `
const grow = (h) => { if (typeof h !== "string" || !h) return h; const plain = h.replace(/<[^>]+>/g, ""), words = plain.split(/\\s+/); let add = "", i = 0; while (add.length < plain.length * 0.3) add += (add ? " " : "") + words[i++ % words.length]; return h + " " + add; };
for (const s of STORIES) { for (const l of ["id", "en"]) s[l].intro = grow(s[l].intro); for (const p of s.scenes) { for (const l of ["id", "en"]) if (typeof p[l].text === "string") p[l].text = grow(p[l].text); p.steps.forEach((st) => { st.id = grow(st.id); st.en = grow(st.en); }); } }`;
const fresh = async ([width, height, font = 100, late], longer = false) => {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width < 900, isMobile: false });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  if (font !== 100 && !late) await page.addInitScript((font) => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = font + "%")), font);
  if (longer) await page.route(/\/story\.js$/, async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()) + LONGER, headers: { ...res.headers(), "content-encoding": "identity" } }); });
  return page;
};
const name = ([w, h, font, late], longer) => `${w}x${h}${font && font !== 100 ? ` @${font}%${late ? " set after load" : ""}` : ""}${longer ? " (captions +30%)" : ""}`;

/** Every step of every story at one size: reached by scrolling, then by the next button (which also opens the caption
 *  where it goes on). */
async function stories(size, longer = false, button = !longer && BUTTON(size)) {
  const page = await fresh(size, longer);
  for (const slug of slugs) {
    const story = STORIES.find((s) => s.slug === slug);
    await page.goto(`${base}#/cerita/${slug}`);
    await page.waitForSelector(".stage .plate svg", { state: "attached", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    if (size[3] === "late") { await page.evaluate((f) => (document.documentElement.style.fontSize = f + "%"), size[2]); await page.waitForTimeout(1200); }
    await page.evaluate(helpers);
    report(`${slug} cover ${name(size, longer)}`, await page.evaluate(sideways));
    for (const [k, part] of story.scenes.entries()) {
      const at = new Set();
      for (let j = 0; j <= part.steps.length; j++) {
        await page.evaluate(([k, j]) => { const s = document.getElementById(`scene-${k}`); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + j * s.querySelector(".beat").offsetHeight + 2); }, [k, j]);
        await page.waitForFunction(([k, j]) => +document.querySelector(`#scene-${k} .stage`).dataset.step === j, [k, j], { timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(40);
        const s = await page.evaluate(look, [k, j]);
        looks++;
        if (j) at.add(s.at);
        report(`${slug} scene ${k + 1} step ${j} ${name(size, longer)} (scrolled)`, [...s.wrong, ...(j === part.steps.length ? await page.evaluate(sideways) : [])]);
      }
      if (at.size > 1 && Math.max(...[...at].map((x) => x.split(",")).flatMap((a, _, all) => a.map((v, i) => Math.abs(v - all[0][i])))) > 1.5) report(`${slug} scene ${k + 1} ${name(size, longer)}`, [`stepping moves the figure or the caption's band (${[...at].join(" | ")})`]);
    }
    if (button) {
      // From the first stage's opening, the next button, step by step to the last.
      await page.evaluate(() => { const s = document.getElementById("scene-0"); scrollTo(0, scrollY + s.getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight + 2); });
      await page.waitForFunction(() => +document.querySelector("#scene-0 .stage").dataset.step === 0, null, { timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(70);
      for (const [k, part] of story.scenes.entries()) for (let j = 0; j <= part.steps.length; j++) {
        if (k || j) {
          await page.click(`#scene-${j ? k : k - 1} .stage-nav .step.on`);
          await page.waitForFunction(([k, j]) => { const s = document.querySelector(`#scene-${k} .stage`), r = s.getBoundingClientRect(); return +s.dataset.step === j && Math.abs(r.top - document.querySelector(".masthead").getBoundingClientRect().bottom) < 2; }, [k, j], { timeout: 2500 }).catch(() => {});
          await page.waitForTimeout(70);
        }
        const s = await page.evaluate(look, [k, j]);
        looks++;
        const wrong = [...s.wrong];
        if (s.hidden && !s.wrong.some((w) => /control/.test(w))) {
          await page.click(`#scene-${k} .more-button`);
          await page.waitForTimeout(80);
          wrong.push(...(await page.evaluate(sheet, k)));
          await page.click(`#scene-${k} .more-button`);
          await page.waitForTimeout(60);
          if (await page.evaluate((k) => document.querySelector(`#scene-${k} .stage`).classList.contains("reading"), k)) wrong.push("pressed again, the open caption does not close");
        }
        report(`${slug} scene ${k + 1} step ${j} ${name(size, longer)} (next button)`, wrong);
      }
    }
    if (page.errors.length) report(`${slug} ${name(size, longer)}`, page.errors.slice(0, 1));
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
const jobs = [...STORY_SIZES.map((size) => () => stories(size)), ...LONG_SIZES.map((size) => () => stories(size, true)), ...PAGE_SIZES.map((size) => () => others(size))];
await Promise.all([0, 1].map(async () => { while (jobs.length) await jobs.shift()(); }));
// On a touch phone every control is 44px tall, or has a 44px target around it (a ::before): the chips, the source tabs,
// the "Kata"/"Nama" switch, a race's ×, the circle's names, a stage's share mark. A link inside running text is exempt.
// (and at a phone's width with a mouse, as a narrowed desktop window is: the rows of a race, the links that are rows)
for (const touch of [true, false]) { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch, reducedMotion: "reduce" }), page = await ctx.newPage();
  for (const path of ["", "bergeser", "balap", "lingkaran", "menempel", "pasang", "tahun", "kata/korupsi", "kuis", "tebak", "temuan", "cerita/oknum"]) {
    await page.goto(`${base}#/${path}`); await page.waitForTimeout(2000);
    await page.evaluate(() => document.querySelectorAll("details.options").forEach((d) => (d.open = true)));
    looks++;
    report(`touch targets on /${path} at 390${touch ? "" : " with a mouse"}`, await page.evaluate(() => [...document.querySelectorAll("button, a[role=button], summary, select, input:not([type=hidden]), .chips a, .switch a, .orbit a, a.row-link")].filter((n) => {
      const r = n.getBoundingClientRect(), b = getComputedStyle(n, "::before");
      if (!r.width || !r.height || getComputedStyle(n).visibility === "hidden" || (n.tagName === "A" && !n.matches("[role=button]") && n.closest("p"))) return false;
      return Math.max(r.height, b.content !== "none" && b.position === "absolute" ? r.height - parseFloat(b.top) - parseFloat(b.bottom) : 0) < 43.5;
    }).map((n) => `“${(n.textContent || n.value || n.getAttribute("aria-label") || "").trim().slice(0, 16)}” ${Math.round(n.getBoundingClientRect().height)}px`)));
  }
  await ctx.close(); }
console.log(`${failures ? `${failures} PROBLEMS` : "every page holds"}: ${looks} looks at ${STORY_SIZES.length + LONG_SIZES.length} story sizes and ${PAGE_SIZES.length} page sizes (${((Date.now() - started) / 1000).toFixed(0)} s)`);
await done(failures);
