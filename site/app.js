// Jejak Kata: a static reader for the files written by `python -m idhist.export` and `idhist.highlights`.
// No build step and no dependencies.
// Routes: /  kata/<word>[/<lens>]  potret/<name>  peta/<lens>/<word>...  balap/<lens>/<word>...
//         cerita[/<slug>[/<scene>[/<step>]]]  main  kuis  tebak  menempel/<word>/<outlet>/<era>/<kind>
//         pasang/<outlet>/<kind>  redaksi/<name>  lingkaran/<name>/<outlet>  tahun  temuan  bergeser  entitas  metode
// How a route is written as an address (a real path where a page was generated for it, "#/..." otherwise, "en/"
// for English) is address.js.

import { seaChart } from "./chart.js";
import { TEXT, LENS_TEXT, NOTES, GLOSS, FEATURED, SHOWCASE, STORIES, SITE } from "./text.js";
import { address, routeOf, named, canonical, EMBED, PAGES, PLAY, QUIZ_NAMES, GUESS_WORDS } from "./address.js";
import { board, measure } from "./labels.js";
import { figureOf, focused, lensFrom, sceneWords, FELL, OUTLETS, OUTLET, PUBLISHER, said as saidIn, dash } from "./scenes.js";

// The plates (plate.js) are fetched only by the pages that draw them (a story, two play pages): the first page, read
// cold on a phone, does without them. `plating()` resolves once these names are there.
let plate, strip, plates, savePlate, plateImage, stripLeast, inks, plated = null;
const plating = () => (plated ||= import("./plate.js").then((m) => ({ plate, strip, plates, savePlate, plateImage, stripLeast, inks } = m)));

const DATA = "data";
const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the colour steps
const WIKIPEDIA = "https://id.wikipedia.org/wiki/";
const BEAT = 1500; // milliseconds a player stays on one period
const MAIN = "id-web-news-kompas"; // the lens of the first page: yearly, one publisher, 2011-2024
const LEG = 900; // milliseconds a ship takes from one period to the next (--d-leg)
const BUCKET = 64; // entries per file of words and of paths, as idhist.export writes them (each lens's meta says so too)
const said = (label) => saidIn(label, language);
const ERAS_SHOWN = ["2010–2014", "2015–2019", "2020–2024"];
const ROUTES = ["--route", "--route-2", "--ink", "--ink-3"]; // colours of the first, second ... chosen word
const view = document.getElementById("view");
const masthead = document.querySelector(".masthead");
const tipNode = document.getElementById("tip");

/** A value kept in `store` (localStorage or sessionStorage), read or, with `value`, written; nothing where storage is
 *  refused (Safari with all cookies blocked throws on any use of it). */
function kept(store, key, value) {
  try {
    return value === undefined ? window[store].getItem(key) : window[store].setItem(key, value);
  } catch {
    return null;
  }
}
let language = kept("localStorage", "language") || "id";
const t = (key, ...args) => {
  const s = TEXT[language][key] ?? TEXT.id[key] ?? key;
  return typeof s === "function" ? s(...args) : s;
};
const lensText = (lens) => LENS_TEXT[lens.lens][language];
/** What a word of the first page is, for a reader who may not know (text.js, GLOSS), in the language shown. */
const gloss = (word) => GLOSS[word]?.[language] || "";

// Sound (sound.js) is on unless this viewer turned it off (the choice is kept; where storage is refused it is on at
// each visit). A browser lets sound start only after the reader has done something on the page, so once the page has
// been painted the AudioContext is made and sound.js fetched: where the browser lets it run, the sea is heard at once;
// else the first press, key or tap anywhere starts it (a scroll or a hover does not count, as browsers see it), with a
// slow fade in, and until then the first page's hero says so ("Sound is on: tap anywhere to hear it", with the toggle).
// Turned off, nothing of it is made on later visits. A frame on another site (an embed) is silent unless turned on
// there, and keeps no choice. Without Web Audio there is no toggle.
const WebAudio = window.AudioContext || window.webkitAudioContext;
let sounding = null, made = null, context = null, hearing = false, heard = "home";  // the layer once made, its context; whether it is on; the page's family
/** A sound of what the site does, if sound is on. */
const hear = (name, ...args) => hearing && sounding?.play(name, ...args);
const embedded = () => document.documentElement.classList.contains("embedded");
/** Whether the sound is waiting for the reader's first gesture (on, but not yet allowed to play). */
const waiting = () => hearing && context?.state !== "running";
const GESTURES = ["pointerdown", "keydown", "touchend"];
/** Sound on (or off). `chosen`: the reader pressed the toggle (kept, and the sound "on" is heard). Called within a
 *  gesture, it lets the context run; outside one it makes the layer ready and waits. */
function listen(on, chosen = true) {
  hearing = on;
  document.querySelectorAll(".sound-toggle").forEach((b) => b.setAttribute("aria-pressed", on));
  if (chosen && !embedded()) kept("localStorage", "sound", on ? "on" : "off");
  if (!on) return heardNow(), sounding?.off();
  if (!context) (context = new WebAudio()).addEventListener("statechange", heardNow);  // (where the browser lets it, it runs at once)
  if (context.state !== "running") return void (navigator.userActivation?.isActive !== false && context.resume().then(() => hearing && listen(true, chosen), () => {}));  // (sound.js is fetched once it can be heard: nothing on a first visit's line before)
  made ||= import("./sound.js").then((m) => (sounding = m.sound(context))).catch(() => null);
  made.then((s) => s && (!hearing ? s.off() : (s.on(chosen ? 1.5 : 4), s.bed(heard), chosen && s.play("on"))));  // off again before it was ready
}
/** Sound is playing, or turned off: the first gesture is no longer waited for, and the hero's note fades (keeping its
 *  room until the page changes: nothing moves). */
function heardNow() {
  if (waiting()) return;
  for (const kind of GESTURES) removeEventListener(kind, wake, true);
  document.querySelector(".sound-ask")?.classList.add("gone");
  if (hearing && !made) listen(true, false);
}
/** The hero's note while the sound waits for the reader: what is the case, and the toggle to turn it off. */
const soundAsk = () => `<p class="sound-ask" role="status">${document.getElementById("sound").outerHTML.replace(' id="sound"', "").replace(/<span[^>]*>[^<]*<\/span>/, `<span class="hidden">${t("sound")}</span>`)}<span>${t("sound_waiting")}</span></p>`;
function wake(e) {
  if (e.target.closest?.(".sound-toggle")) return;  // that press says for itself
  if (hearing) listen(true, false);
}

// ---- data ---------------------------------------------------------------

/** A file of data, fetched once and kept. A fetch that fails (no connection, an answer other than 200, a body cut off
 *  or not JSON) is asked again once, AGAIN ms later; a file that is not there (404) is not. What still fails is not
 *  kept: the next ask (the reader's "Try again", awaited) fetches it anew, where a failure kept would fail for the
 *  rest of the visit. */
const AGAIN = 800;
const cache = new Map();
const json = (path) => {
  const get = () => fetch(`${DATA}/${path}`).then((r) => (r.ok ? r.json() : Promise.reject(Object.assign(new Error(`${path}: ${r.status}`), { status: r.status }))));
  if (!cache.has(path))
    cache.set(path, get().catch((e) => (e.status === 404 ? Promise.reject(e) : new Promise((wait) => setTimeout(wait, AGAIN)).then(get)))
      .catch((e) => (cache.delete(path), Promise.reject(e))));
  return cache.get(path);
};

/** A lens with its meta, a word -> index map, and which entries are entities (index -> Wikipedia article); undefined
 *  where its meta does not come (and then asked for anew next time). */
const loaded = new Map();
const lensNamed = (name) => {
  if (!loaded.has(name))
    loaded.set(name, json(`${name}/meta.json`).then((meta) => {
      const articles = new Map(Object.entries(meta.entities).map(([i, article]) => [+i, article]));
      return { ...lensFrom(meta), articles, kind: (i) => meta.kinds[i] || "other" };
    }).catch(() => (loaded.delete(name), undefined)));
  return loaded.get(name);
};
/** Every lens. The first page needs only one, so nothing waits for this unless it asks. */
const allLenses = () => json("lenses.json").then((names) => Promise.all(names.map(lensNamed)));
const bucket = (lens, folder, i) => json(`${lens.lens}/${folder}/${Math.floor(i / lens.bucket)}.json`);
const entry = async (lens, i) => (await bucket(lens, "words", i)).find((e) => e.word === i);
const entryOf = (lens, word) => (lens.isEntry(lens.index.get(word)) ? entry(lens, lens.index.get(word)) : null);
const entriesOf = async (lens, list) => (await Promise.all(list.map((w) => entryOf(lens, w)))).filter(Boolean);
const pathOf = async (lens, i) => (await bucket(lens, "paths", i).catch(() => [])).find((p) => p.word === i);
const highlights = (lens) => json(`${lens.lens}/highlights.json`);
/** The adjectives or verbs that keep a name company, per period: [[word, strength], ...] or nothing. */
const saidOf = async (lens, word, lexicon) => (await pathOf(lens, lens.index.get(word)))?.[lexicon];

// ---- small helpers --------------------------------------------------------

const el = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** The site's root, where this file is: every address is relative to it, on whichever page a visit began (the
 *  document's base says so too, so that data and files are found from any path). */
const ROOT = new URL("./", import.meta.url);
(document.querySelector("base") || document.head.appendChild(document.createElement("base"))).href = ROOT.href;
const href = (...parts) => ROOT.pathname + address(parts, language);
/** An address as a whole URL, as it is shared. */
const whole = (to) => new URL(to, ROOT).href;
/** Going to an address of the site: a new entry in the browser's history, and its page. */
const visit = (to) => (whole(to) !== location.href && history.pushState(null, "", to), moved());
const link = (word) => `<a href="${href("kata", word)}">${word}</a>`;
const number = (x, digits = 1) => x.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (share) => (share * 100).toLocaleString(language, { maximumSignificantDigits: 2 }) + "%";
const step = (shift) => STEPS.filter((s) => shift >= s).length;
const pairIndex = (lens, a, b) => lens.pairs.findIndex(([x, y]) => x === a && y === b);
const largest = (shifts) => Math.max(...shifts.filter((s) => s !== null));
const known = (e) => e.with.map((w, p) => (w.length ? p : -1)).filter((p) => p >= 0); // periods with enough of the word
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The width the page's content has: the main column without its gutters. */
const room = () => {
  const style = getComputedStyle(view);
  return view.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
};
/** The tide line, where the night meets the paper: the curve along which the home hero's dive turns the sea into the
 *  chart (sea.js, edge()), drawn across the width of the screen. `above`: the paper lies above it (the footer). */
const TIDE = (() => {
  let d = "";
  for (let i = 0; i <= 96; i++) {
    const x = -1 + i / 48, e = 0.035 * Math.sin(x * 4.1 + 1.3) + 0.018 * Math.sin(x * 9.7);
    d += `${i ? "L" : "M"}${((i * 200) / 96).toFixed(1)},${(6 - e * 100).toFixed(2)}`;
  }
  return d;
})();
/** The tide line in small, as a mark: where the dive ends, the night turned into paper. */
const TIDE_MARK = `<svg class="tide-mark" viewBox="0 0 28 14" width="28" height="14" aria-hidden="true"><path d="M1 9C6 4 10 12 15 8S23 4 27 7"/></svg>`;
const tideLine = (above = false) => `<svg class="tide-line${above ? " above" : ""}" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="tide-paper" d="${TIDE}${above ? "V-2H0Z" : "V14H0Z"}"/><path class="tide-foam" d="${TIDE}"/></svg>`;

/** The head every page starts with, on the deep: a kicker (a label, or a link back), the title, and a lede, with the
 *  night sea held still behind them (`sea`: what `shore` is given) and the tide line under them, where the page's
 *  paper begins. `more`: what else belongs in the head (a note about a name). The title rises in, word by word, or
 *  letter by letter for a word's own page. */
const pageHead = (title, { kicker, to, lede, cls = "", sea = {}, more = "" } = {}) => {
  const head = el(`<div class="page-head shore${sea ? "" : " joined"}"><div class="shore-sea">${sea ? GRATICULE : ""}</div>${kicker ? (to ? `<a class="kicker" href="${to}">${kicker}</a>` : `<p class="kicker">${kicker}</p>`) : ""}
    <h1${cls ? ` class="${cls}"` : ""}>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}${more}${sea ? tideLine() : ""}</div>`);
  rise(head.querySelector("h1"), cls === "word-title");
  if (sea) shore(head, { pitch: 0.62, ...sea });  // a head is a short band: its sea is seen from higher, so that it fills it  // without: the head runs on into a band of the deep below it (the map's)
  return head;
};

/** A title that rises into place, word by word (or letter by letter): each part in a span the reader's tools do not
 *  read apart (the title keeps its text in aria-label). Nothing moves with reduced motion, nor on a page turn, which
 *  carries the old title over into this one. */
function rise(h1, letters = false) {
  if (still() || h1.children.length || document.documentElement.classList.contains("turning")) return h1;
  const text = h1.textContent.trim();
  let i = 0;
  h1.setAttribute("aria-label", text);
  h1.innerHTML = text.split(/\s+/).map((word) => `<span class="part" aria-hidden="true">${letters ? [...word].map((c) => `<span style="--i:${i++}">${escape(c)}</span>`).join("") : `<span style="--i:${i++}">${escape(word)}</span>`}</span>`).join(" ");
  h1.classList.add("rising");
  return h1;
}

/**
 * The night sea held still behind `box` (a page head, a story's cover, the footer): one frame of the chart's first
 * screen of words, where the chart puts them, made once the page has been painted and only where WebGL2 is (the
 * graticule stays where it is not). first `count` of `words` on that screen, or `routes` already found, are drawn sailed to their
 * last port; `look` turns the camera where there is no route; `open(rect)` says where the water is clear of text, as
 * [top, right, bottom, left] in pixels (by default the right half on a wide screen, the upper half on a phone).
 */
async function shore(box, { words = [], count = 3, routes = null, name: named, look, open, names = 12, pitch = null } = {}) {
  const holder = box.querySelector(".shore-sea");
  if (!holder || !window.WebGL2RenderingContext) return null;
  const [module, first] = await Promise.all([import("./sea.js"), json(`${MAIN}/first.json`), painted()]).catch(() => []);
  if (!first || !box.isConnected) return null;
  const name = (id) => named?.(id) ?? first.names[first.words.indexOf(id)];
  routes = await routes;
  // `words`: a list (or a promise of one, or what it is made from the first screen's chart), each a word or a list of
  // which the first word on the first screen is taken.
  words = await (typeof words === "function" ? words(first) : words);
  if (!routes) {
    const ids = [...new Set(words.map((w) => [].concat(w).find((x) => first.names.includes(x))).filter(Boolean))].map((w) => first.words[first.names.indexOf(w)]).slice(0, count + 2);
    const paths = await Promise.all(ids.map((id) => json(`${MAIN}/paths/${Math.floor(id / BUCKET)}.json`).then((list) => list.find((p) => p.word === id)).catch(() => null)));
    routes = ids.map((id, k) => ({ id, color: ROUTES[Math.min(k, 3)], route: paths[k]?.route || [] })).filter((r) => r.route.some(Boolean)).slice(0, count);
  }
  if (!box.isConnected) return null;
  const label = routes.length ? t("sea_label_route", routes.map((r) => name(r.id)).join(", ")) : t("sea_label");
  const sea = module.nightSea({ chart: first, name, pick: (id) => visit(href("kata", name(id))), periods: first.periods, tip, label, hold: true, most: 2500, names: innerWidth < 600 ? Math.min(names, 6) : names, pitch, host: box });
  if (!sea) return null;
  holder.replaceChildren(sea.node);
  // By default the water is open beside the head's text from 900px (from its right edge), above it on a phone.
  const rect = holder.getBoundingClientRect(), texts = [...box.children].filter((n) => !n.matches(".shore-sea, .tide-line")), text = Math.max(0, ...texts.map((n) => {
    const r = n.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(n);  // the text's own extent, not its box's: a paragraph's box is as wide as its measure
    return Math.min(r.right, range.getBoundingClientRect().right) - rect.left;
  })), top = Math.min(rect.height, ...texts.map((n) => n.getBoundingClientRect().top - rect.top));
  // On a phone the water is above the text (the head leaves room for it), and no name is written under the text.
  sea.inset(open ? open(rect) : innerWidth >= 900 ? [rect.height * 0.1, rect.width * 0.03, rect.height * 0.14, Math.max(rect.width * 0.42, text + 48)] : [rect.height * 0.04, 0, Math.max(rect.height * 0.5, rect.height - top + 8), 0]);
  if (routes.length) (sea.routes(routes), sea.time(first.periods.length - 1, 0), sea.frame(routes.map((r) => r.id), 0));
  else if (look) sea.look(look);
  box.classList.add("lit");
  return sea;
}
/** The kicker of a page reached from the play page: a way back to it. */
const fromPlay = () => ({ kicker: t("nav_play"), to: href("main") });
// What the sea behind each family of pages shows (shore, `words`): only the routes of words the page is about.
/** The words of the first screen that moved most, among its frequent ones: for the pages about change. */
const MOVED = (first) => first.words.map((_, k) => k).filter((k) => k < 800 && first.moved[k] !== null).sort((a, b) => first.moved[b] - first.moved[a]).map((k) => first.names[k]);
/** The words these stories ask the reader to check, one list per story (story.js, fetched for it). */
const storyWords = (list) => import("./story.js").then((m) => list.map((s) => m.STORIES.find((x) => x.slug === s.slug)?.scenes.flatMap((part) => part.check || []) || []));

/** Show `text` beside the pointer, or hide the tip when there is none. */
function tip(text, e) {
  tipNode.hidden = !text;
  if (!text) return;
  tipNode.textContent = text;
  tipNode.style.left = Math.max(4, Math.min(e.clientX + 12, innerWidth - tipNode.offsetWidth - 4)) + "px";
  tipNode.style.top = e.clientY + 14 + "px";
}
function hover(node, text) {
  node.addEventListener("pointermove", (e) => tip(typeof text === "function" ? text(e) : text, e));
  node.addEventListener("pointerleave", () => tip(null));
}

/** A row of buttons of which one is pressed; `show(i)` is called for the pressed one. */
function tabs(labels, show, first = 0, style = "tabs") {
  const list = el(`<ul class="${style}">${labels.map((label) => `<li><button type="button">${label}</button></li>`).join("")}</ul>`);
  const buttons = [...list.querySelectorAll("button")];
  const press = (i) => {
    buttons.forEach((b, j) => b.setAttribute("aria-pressed", i === j));
    show(i);
    // In a row that scrolls sideways, the pressed one is brought into the row's view.
    requestAnimationFrame(() => {
      const row = list.getBoundingClientRect(), at = buttons[i].getBoundingClientRect();
      if (at.left < row.left || at.right > row.right) list.scrollLeft += at.left - row.left - parseFloat(getComputedStyle(list).paddingLeft);
    });
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => press(i)));
  press(first);
  return list;
}

/**
 * The one way a part of a page waits for its data and fails: in `holder`, a quiet skeleton of the part to come (`shape`:
 * "part", a figure with its title; "plate", a story's figure; "page", a page's head and a part), as tall as the part
 * will be, so that nothing moves when it lands; then the part `make()` returns (a node, or a promise of one), and
 * `then(node)` once it is in place. Where its data did not come (json() has already asked twice), a plain line and
 * "Try again", which makes the part again without reloading the page. Only the last asked of a holder is shown.
 */
function awaited(holder, make, { shape = "part", then } = {}) {
  const turn = (holder.turn = (holder.turn || 0) + 1), mine = () => holder.turn === turn;
  const made = Promise.resolve().then(make);
  holder.replaceChildren(el(`<div class="skeleton ${shape}" role="status" aria-label="${t("loading")}">${shape === "page" ? `<div class="page-head shore"><i></i><i></i><i></i>${tideLine()}</div>` : ""}<i></i><i></i><b></b></div>`));
  return made.then((node) => mine() && (node instanceof Node && holder.replaceChildren(node), then?.(node)), () => {
    if (!mine()) return;
    // One press tries again every part of the page that failed (the stages of a story often wait for one file).
    const box = Object.assign(el(`<div class="failed" role="alert"><p><b>${t("failed_title")}.</b> ${t("failed")}</p><button type="button" class="primary">${t("reload")}</button></div>`), { again: () => awaited(holder, make, { shape, then }) });
    box.querySelector("button").addEventListener("click", () => document.querySelectorAll(".failed").forEach((b) => b.again()));
    holder.replaceChildren(box);
  });
}

/** Tabs over one holder: the content of the pressed tab replaces the last. */
function switcher(labels, content, first = 0, style = "tabs") {
  const holder = el(`<div class="holder"></div>`), box = el("<div></div>");
  box.append(tabs(labels, (i) => awaited(holder, () => content(i)), first, style), holder);
  return box;
}

/**
 * A figure is {node, labels, show(i)}: something that can be shown at each of a row of moments.
 * `played` puts a play button and a slider under it; a story's `stage` lets the reader's steps drive it instead.
 */
function played(figure, start = figure.labels.length - 1) {
  const box = el(`<div></div>`);
  const bar = el(`<div class="player"><button type="button" aria-label="${t("play")}">▶</button>
    <input type="range" min="0" max="${figure.labels.length - 1}" value="${start}" aria-label="${t("period")}"><output></output></div>`);
  const [button, slider, output] = bar.children;
  // A figure that asks for a rail (a word's route) has its years under the slider, each a stop to go to: pressing one
  // and drawing the finger or the mouse along them scrubs the figure through the years.
  const n = figure.labels.length, every = Math.ceil(n / Math.max(2, (Math.min(innerWidth, 1120) - 160) / 44));  // a year named every so often, as many as fit
  const rail = figure.rail && el(`<ol class="rail" aria-hidden="true">${figure.labels.map((l, i) => `<li${(i % every && i < n - 1) || (i < n - 1 && n - 1 - i < every) ? ' class="quiet"' : ""}>${i && i < n - 1 ? "’" + String(l).slice(-2) : l}</li>`).join("")}</ol>`);
  if (rail) {
    let held = false;
    const at = (e) => { const r = rail.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (figure.labels.length - 1)); };
    rail.addEventListener("pointerdown", (e) => ((held = true), rail.setPointerCapture(e.pointerId), stop(), go(at(e))));
    rail.addEventListener("pointermove", (e) => held && +slider.value !== at(e) && go(at(e)));
    rail.addEventListener("pointerup", () => (held = false));
    rail.addEventListener("pointercancel", () => (held = false));
  }
  let timer = null;
  const go = (i) => {
    slider.value = i;
    output.textContent = figure.labels[i];
    rail?.querySelectorAll("li").forEach((li, j) => li.classList.toggle("on", j === +i));
    figure.show(i);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    button.textContent = "▶";
    button.setAttribute("aria-label", t("play"));
  };
  button.addEventListener("click", () => {
    if (timer) return stop();
    if (+slider.value >= figure.labels.length - 1) go(0);
    button.textContent = "❚❚";
    button.setAttribute("aria-label", t("pause"));
    timer = setInterval(() => (!bar.isConnected || +slider.value >= figure.labels.length - 1 ? stop() : go(+slider.value + 1)), BEAT);
  });
  slider.addEventListener("input", () => (stop(), go(+slider.value)));
  figure.goto = go; // so that a click inside the figure can move the slider too
  box.append(figure.node, bar, ...(rail ? [rail] : []));
  go(start);
  return box;
}

/** The numbers a step names, those on the beacon (plate.js), for the sound of the step: its notes follow them. */
const beaconed = (room) => [...room.querySelectorAll(".plate:not(.off) .beacon[opacity='1']")].map((pill) => {
  const said = pill.nextElementSibling?.textContent || "", n = (/(\d[\d.,]*)\s*%/.exec(said) || /(\d[\d.,]*)\D*$/.exec(said))?.[1];
  return n ? parseFloat(n.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")) : NaN;
});

/**
 * A scene of a story on its stage. The figure holds the screen and the caption sits in one place beside it (below
 * it on a narrow screen); moving a step turns the caption while the figure's marks travel. Step 0 opens the scene
 * with its title and text; step j shows caption j (`at` names the figure's moment, `focus` what to bring forward,
 * `mark` a moment inside a plate). Under the sticky stage lies a run of beats, one per step: the page's scroll
 * position chooses the step (`voyage`), and every caption stays in its beat, in reading order, for screen readers
 * and find-in-page. `steer(j)` is asked to move to step j; returns {node, stage, figure box, steps, on(), go(j)}.
 */
function stage(part, k, of, steer, intro = "") {
  const words = part[language], n = part.steps.length;
  const head = (j) => dash(part.steps[j - 1].head ?? part.steps[j - 1].mark ?? part.steps[j - 1].at);
  const name = (j) => (j ? t("step_name", j, n, head(j)) : t("opening", words.title));
  const arrow = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}"/></svg>`;
  const node = el(`<section class="scene" id="scene-${k}" aria-labelledby="scene-${k}-title">
    <div class="stage" data-step="0" tabindex="-1"><div class="stage-figure"></div>
      <div class="stage-side"><p class="stage-meta"><span class="stage-part">${of > 1 ? words.title : ""}</span><span class="count"></span></p>
        <div class="caption" aria-live="polite"></div><p class="sea-key" aria-hidden="true"></p>
        <div class="stage-nav"><button type="button" class="step back">${arrow("M15 5l-7 7 7 7")}<span>${t("step_back")}</span></button>
          <ol class="ticks" aria-label="${t("steps_label")}">${[...Array(n + 1)].map((_, j) => `<li><button type="button" aria-label="${escape(name(j).replace(/<[^>]+>/g, ""))}"></button></li>`).join("")}</ol>
          <button type="button" class="step on"><span>${t("step_on")}</span>${arrow("M9 5l7 7-7 7")}</button></div></div></div>
    <ol class="beats">${[...Array(n + 1)].map((_, j) => `<li class="beat"><div class="hidden">${j ? `<p><b>${head(j)}.</b> ${part.steps[j - 1][language]}</p>`
      : `<h2 id="scene-${k}-title">${words.title}</h2>${words.text ? `<p>${words.text}</p>` : ""}`}</div></li>`).join("")}</ol></section>`);
  const box = node.firstElementChild, room = box.firstElementChild, caption = box.querySelector(".caption"), count = box.querySelector(".count");
  const ticks = [...box.querySelectorAll(".ticks button")], [back, ahead] = box.querySelectorAll(".step");
  let at = -1, figure = null, sizes = [];
  const said = (j) => (j ? `<p class="head">${head(j)}</p><p>${part.steps[j - 1][language]}</p>`
    : `<p class="title">${words.title}</p>${intro ? `<p class="intro">${intro}</p>` : ""}${words.text ? `<p>${words.text}</p>` : ""}${k ? "" : `<p class="hint">${t("stage_hint")}</p>`}`);
  const show = (j = at) => {
    if (!figure || j < 0) return;
    const step = part.steps[Math.max(0, j - 1)], i = figure.labels.indexOf(step.at);
    box.dataset.plate = i;
    if (i >= 0) figure.show(i, j ? step.focus : undefined, step.mark);
  };
  // A strip taller than its window (share, on a phone) slides through it as the page scrolls through the scene: at
  // each step to the rows the step brings forward (at the opening to its top; where a step names none, as far down
  // as the step is through the scene), and between two steps, between their two places. Its edges fade where it
  // goes on. `places` are worked out once, from the rows each step leaves unfaded (attributes only: nothing is laid
  // out between two steps, so no mark starts to travel), then the figure is shown at its own step again.
  let places = null, most = 0;
  const slide = (f) => {
    if (!places) return;
    const j = Math.max(0, Math.min(n, f)), a = places[Math.floor(j)], b = places[Math.ceil(j)], y = a + (b - a) * (j - Math.floor(j));
    room.style.setProperty("--slide", `${y.toFixed(1)}px`);
    room.style.setProperty("--above", y > 1 ? "var(--s6)" : "0px");
    room.style.setProperty("--below", y < most - 1 ? "var(--s6)" : "0px");
  };
  const reach = () => {
    const svg = room.querySelector(".plate svg"), scale = svg.getBoundingClientRect().height / svg.viewBox.baseVal.height, open = room.clientHeight;
    most = Math.max(0, svg.getBoundingClientRect().height - open);
    places = [...Array(n + 1)].map((_, j) => {
      show(j);
      const rows = [...room.querySelectorAll(".plate:not(.off) .row")], named = rows.filter((r) => r.style.opacity === "1");
      if (!j || named.length === rows.length) return (most * j) / n;
      const ys = named.map((r) => +r.querySelector("line").getAttribute("y1") * scale), top = Math.min(...ys) - 32, bottom = Math.max(...ys) + 32;
      return Math.max(0, Math.min(most, bottom - top <= open ? (top + bottom - open) / 2 : top));
    });
    show();
  };
  const go = (j) => {
    if (j === at) return;
    const backwards = j < at, was = at;
    at = j;
    box.dataset.step = j;
    show();
    if (was >= 0) hear("step", backwards, j ? beaconed(room) : [], j);
    // The caption turns: the one that was leaves a few pixels the way the reader came from, the new one comes in.
    for (const old of caption.querySelectorAll(".turn:not(.out)")) {
      old.classList.add("out");
      old.classList.toggle("back", backwards);
      old.setAttribute("aria-hidden", "true");
      setTimeout(() => old.remove(), parseFloat(getComputedStyle(old).transitionDuration) * 1000 + 60);
    }
    caption.append(el(`<div class="turn${backwards ? " back" : ""}" style="${sizes[j] || ""}">${said(j)}</div>`));
    caption.scrollTop = 0;
    count.textContent = j ? `${j} / ${n}` : t("steps_n", n);
    ticks.forEach((b, m) => (b.classList.toggle("past", m < j), m === j ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
    requestAnimationFrame(more);
  };
  // A caption longer than its band scrolls inside it; the band's lower edge fades while there is more below.
  // A long caption can also be reached and scrolled by keyboard.
  const more = () => {
    caption.classList.toggle("more", caption.scrollTop + caption.clientHeight < caption.scrollHeight - 2);
    if (caption.scrollHeight > caption.clientHeight + 2) caption.tabIndex = 0;
    else if (document.activeElement !== caption) caption.removeAttribute("tabindex");
  };
  caption.addEventListener("scroll", more, { passive: true });
  ticks.forEach((b, m) => b.addEventListener("click", () => steer(m)));
  back.addEventListener("click", () => steer(at - 1));
  ahead.addEventListener("click", () => steer(at + 1));
  go(0);
  // Each step's caption at the size that fits its band (fit, from 900px).
  const sized = (list) => ((sizes = list), caption.querySelector(".turn:not(.out)")?.setAttribute("style", sizes[at] || ""), more());
  return { node, stage: box, room, caption, said, sized, steps: n + 1, on: () => at, go, slide, figure: () => figure, hold: (made) => ((figure = made), box.classList.contains("tall") ? reach() : show()) };
}

// ---- figures --------------------------------------------------------------

/** Share of units containing each word, per period; one line per entry, named when there are several. */
function frequencyChart(lens, series, chosen = []) {
  const W = Math.max(280, Math.min(880, room())), H = W > 600 ? 230 : 190, L = 44, R = 12, T = 10, B = 26; // drawn at its real size, so text stays legible
  const n = lens.periods.length;
  const top = Math.max(...series.flatMap((e) => e.share)) * 1.1 || 1;
  const x = (i) => L + ((W - L - R) * i) / (n - 1);
  const y = (v) => H - B - ((H - T - B) * v) / top;
  const every = Math.ceil(n / (W / 90));
  const points = (e) => e.share.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const k = (i) => Math.min(i, 3);
  const svg = el(`<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("frequency")}">
    ${[0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}"/>
      <text x="${L - 6}" y="${y(top * f) + 4}" text-anchor="end">${percent(top * f)}</text>`).join("")}
    ${lens.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p}</text>`)).join("")}
    ${chosen.map((i) => `<line class="mark" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/>`).join("")}
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    ${series.length === 1 ? `<polygon class="area" points="${x(0)},${y(0)} ${points(series[0])} ${x(n - 1)},${y(0)}"/>` : ""}
    ${series.map((e, i) => `<polyline class="line draw k${k(i)}" pathLength="1" points="${points(e)}"/>
      ${e.share.map((v, j) => `<circle class="pt k${k(i)}" cx="${x(j)}" cy="${y(v)}" r="3.5"/>`).join("")}`).join("")}
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
  </svg>`);
  const cross = svg.querySelector(".cross"), plot = svg.querySelector("rect");
  hover(plot, (ev) => {
    const box = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((((ev.clientX - box.left) / box.width) * W - L) / (W - L - R)) * (n - 1))));
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    cross.setAttribute("visibility", "visible");
    const values = series.map((e) => (series.length > 1 ? `${lens.words[e.word]} ${percent(e.share[i])}` : percent(e.share[i])));
    return `${lens.periods[i]}: ${values.join(", ")} ${t("of_units", lens)}`;
  });
  plot.addEventListener("pointerleave", () => cross.setAttribute("visibility", "hidden"));
  if (series.length === 1) return svg;
  const figure = el(`<div><div class="legend">${series.map((e, i) => `<span><i class="k${k(i)}"></i>${lens.words[e.word]}</span>`).join("")}</div></div>`);
  figure.append(svg);
  return figure;
}

/** Shift between every two periods: earlier period down the side, later along the top. */
function shiftMatrix(lens, e, chosen, choose) {
  const n = lens.periods.length;
  const size = n > 8 ? 26 : lens.periods[0].length > 4 ? 68 : 44, L = 78, T = 20;
  const short = (p) => (n > 8 ? p.slice(2, 4) : p);
  const svg = el(`<svg viewBox="0 0 ${L + size * (n - 1) + 4} ${T + size * (n - 1) + 4}" width="${L + size * (n - 1) + 4}" role="img" aria-label="${t("matrix")}">
    ${lens.periods.slice(1).map((p, j) => `<text x="${L + size * j + size / 2}" y="${T - 7}" text-anchor="middle">${short(p)}</text>`).join("")}
    ${lens.periods.slice(0, -1).map((p, i) => `<text x="${L - 8}" y="${T + size * i + size / 2 + 4}" text-anchor="end">${p}</text>`).join("")}
  </svg>`);
  lens.pairs.forEach(([a, b], k) => {
    const s = e.shift[k];
    const cell = el(`<svg><rect style="--i:${b - a}" class="cell ${s === null ? "rare" : "s" + step(s)} ${a === chosen[0] && b === chosen[1] ? "chosen" : ""}"
      x="${L + size * (b - 1) + 1}" y="${T + size * a + 1}" width="${size - 2}" height="${size - 2}" rx="2"/></svg>`).firstElementChild;
    hover(cell, `${lens.periods[a]} → ${lens.periods[b]}: ${s === null ? t("too_rare") : number(s)}`);
    if (s !== null) cell.addEventListener("click", () => choose(a, b));
    svg.append(cell);
  });
  return svg;
}

const legend = () => `<div class="legend">${[0, 1, 2, 3, 4, 5]
  .map((i) => `<span><i class="s${i}"></i>${i === 0 ? `< ${STEPS[0]}` : i === 5 ? `≥ ${STEPS[4]}` : `${STEPS[i - 1]}–${STEPS[i]}`}</span>`)
  .join("")}<span><i class="rare"></i>${t("too_rare")}</span></div>`;

/**
 * A word in the middle and its company around it: an inner ring of the words it appears with, an outer ring of
 * the words that keep company like it. From one period to the next a word that stays keeps its place, a new one
 * sails in from the middle and is marked, one that leaves sails out.
 */
function orbit(lens, e) {
  const periods = known(e);
  const node = el(`<div class="orbit"><div class="core">${lens.words[e.word]}</div></div>`);
  new ResizeObserver(() => node.style.setProperty("--r", node.clientWidth / 2 + "px")).observe(node);
  const rings = { with: { size: 10, radius: [0.5, 0.64], cls: "" }, like: { size: 8, radius: [0.9, 0.9], cls: "like" } };
  const placed = { with: new Map(), like: new Map() }; // word id -> its chip and slot
  let last = -1;
  const show = (k) => {
    for (const [name, { size, radius, cls }] of Object.entries(rings)) {
      const now = e[name][periods[k]].slice(0, size), here = placed[name];
      for (const [id, { node: chip }] of here) {
        chip.classList.remove("new");
        if (now.includes(id)) continue;
        chip.classList.add("out");
        setTimeout(() => chip.remove(), 600);
        here.delete(id);
      }
      const taken = new Set([...here.values()].map((v) => v.slot));
      const free = [...Array(size).keys()].filter((s) => !taken.has(s));
      for (const id of now) {
        if (here.has(id)) continue;
        const slot = free.shift();
        const angle = (2 * Math.PI * (slot + (name === "like" ? 0.5 : 0))) / size - Math.PI / 2;
        const word = lens.words[id];
        const chip = el(lens.isEntry(id) ? `<a class="${cls} in" href="${href("kata", word)}">${word}</a>` : `<a class="${cls} in">${word}</a>`);
        chip.style.setProperty("--x", `calc(var(--r) * ${(radius[slot % 2] * Math.cos(angle)).toFixed(3)})`);
        chip.style.setProperty("--y", `calc(var(--r) * ${(radius[slot % 2] * Math.sin(angle)).toFixed(3)})`);
        if (last >= 0) chip.classList.add("new");
        node.append(chip);
        requestAnimationFrame(() => requestAnimationFrame(() => chip.classList.remove("in")));
        here.set(id, { node: chip, slot });
      }
    }
    last = k;
  };
  return { node, labels: periods.map((p) => lens.periods[p]), show };
}

/**
 * The path of a word among its own neighbours, after the figure in Hamilton, Leskovec and Jurafsky (2016).
 * The neighbours are islands that stay put; the word sails among them. The plate takes the whole band it stands in:
 * the route and the islands near it fitted to its width and to the height of the screen, and from 900px a column
 * beside it (under it on a phone) with the year the ship is at and the word's closest company that year (`e.like`, of which the plate's
 * rings are the first and the last year's). Every name is placed on one board (labels.js): the route, its ports, the
 * islands and the ship's year are reserved; the years along the route come first, then the islands' names, each beside
 * its island on the side away from the route where it can, else a line or more above or below (a leader ties it to its
 * island); a name with no clear spot is left out (the column and the lists name them all).
 */
function pathFigure(lens, path, e) {
  const beside = room() >= 900, COLUMN = 280;
  const W = Math.max(300, Math.round(room() - (beside ? COLUMN + 40 : 0))), H = Math.round(Math.max(300, Math.min(W * (beside ? 0.62 : 0.9), beside ? innerHeight - 250 : 560))), P = 34, SIDE = Math.round(Math.min(170, W * 0.2));
  const raw = path.path.map((xy, p) => xy && { p, xy }).filter(Boolean);
  const smooth = (k, d) => (raw.length > 6 && k > 0 && k < raw.length - 1 ? (raw[k - 1].xy[d] + 2 * raw[k].xy[d] + raw[k + 1].xy[d]) / 4 : raw[k].xy[d]);
  const moved = raw.map((r, k) => [smooth(k, 0), smooth(k, 1)]);
  // The view is fitted to the route and the islands near it: an island far out (more than half the route's own extent
  // beyond it) stands at the edge, an arrow pointing on to where it lies, so that one far word does not shrink the
  // route into a corner.
  const reach = [0, 1].map((d) => { const lo = Math.min(...moved.map((xy) => xy[d])), hi = Math.max(...moved.map((xy) => xy[d])), span = Math.max(hi - lo, 1e-9); return [lo - span / 2, hi + span / 2]; });
  const inside = (xy) => reach.every(([lo, hi], d) => xy[d] >= lo && xy[d] <= hi), all = [...path.at.filter(inside), ...moved];  // (the far ones hang from the route's end, below)
  const scale = (d, size, pad) => {
    const low = Math.min(...all.map((xy) => xy[d])), high = Math.max(...all.map((xy) => xy[d]));
    const f = (v) => pad + ((size - 2 * pad) * (Math.max(low, Math.min(high, v)) - low)) / (high - low || 1);
    f.out = (v) => (v < reach[d][0] ? -1 : v > reach[d][1] ? 1 : 0);
    return f;
  };
  const x = scale(0, W, SIDE), y = scale(1, H, P);
  const steps = moved.map((xy, k) => ({ p: raw[k].p, x: x(xy[0]), y: y(xy[1]) }));
  const at = (k) => steps[Math.max(0, Math.min(steps.length - 1, k))];
  const curve = steps.slice(1).map((s, k) => {
    const [p0, p1, p2, p3] = [at(k - 1), at(k), s, at(k + 2)];
    return `C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }).join(" ");
  const d = `M${steps[0].x},${steps[0].y} ${curve}`;
  const mid = { x: steps.reduce((s, p) => s + p.x, 0) / steps.length, y: steps.reduce((s, p) => s + p.y, 0) / steps.length };
  const marks = path.near.map((id, k) => ({ id, late: k >= path.early, x: x(path.at[k][0]), y: y(path.at[k][1]), out: [x.out(path.at[k][0]), y.out(path.at[k][1])] }));
  // An island far out is hung on a dotted spur from the route's last port (towards the plate's roomier side), one under
  // the other, its arrow pointing on to where it lies: it belongs to the route's end, not to the plate's edge.
  const last = steps.at(-1), far = marks.filter((m) => m.out[0] || m.out[1]), down = last.y < H / 2 ? 1 : -1;
  far.forEach((m, j) => Object.assign(m, { x: last.x, y: Math.max(P, Math.min(H - P, last.y + down * (34 + 24 * j))) }));
  const spur = far.length ? `<path class="spur" d="M${last.x},${last.y}V${far.at(-1).y}"/>` : "";
  // The board: the route (through its ports, a point every few pixels), its ports, the islands, the spur and the
  // ship's year at the last port (where the ship rests) are reserved.
  const type = getComputedStyle(document.documentElement).getPropertyValue("--type").trim(), B = board([2, 2, W - 2, H - 2]);
  B.line(steps.map((s) => [s.x, s.y]), 5);
  B.reserve(...steps.map((s) => [s.x - 6, s.y - 6, s.x + 6, s.y + 6]), ...marks.map((m) => [m.x - 7, m.y - 7, m.x + 7, m.y + 7]), far.length && [last.x - 3, Math.min(last.y, far.at(-1).y), last.x + 3, Math.max(last.y, far.at(-1).y)]);
  const shipYear = String(lens.periods[last.p]), shipWide = measure(shipYear, `800 13px ${type}`);
  B.reserve([last.x - shipWide / 2 - 4, last.y - 30, last.x + shipWide / 2 + 4, last.y - 12], [last.x - 11, last.y - 11, last.x + 11, last.y + 11]);
  // The years along the route: the first port in full, then each port clear of the last one named, on the side away
  // from the route's turn (else the other side); not the last port, which the ship's own year names.
  const years = [];
  steps.slice(0, -1).forEach((s, k) => {
    if (k && years.length && Math.hypot(s.x - years.at(-1).x, s.y - years.at(-1).y) < 40) return;
    const [a, b] = [at(k - 1), at(k + 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, text = k ? "’" + String(lens.periods[s.p]).slice(-2) : String(lens.periods[s.p]), wide = measure(text, `700 12px ${type}`);
    const spots = [1, -1, 1.6, -1.6].map((f) => { const tx = s.x + (-dy / len) * 15 * f, ty = s.y + (dx / len) * 15 * f + 4; return [tx - wide / 2 - 2, ty - 11, tx + wide / 2 + 2, ty + 3]; });
    const box = B.place(spots, text);
    if (box) years.push({ x: s.x, y: s.y, tx: (box[0] + box[2]) / 2, ty: box[3] - 3, text });
  });
  // The islands' names, the nearest company first.
  for (const m of marks) {
    const word = lens.words[m.id], width = measure(word, `400 13px ${type}`) + 4, side = m.x >= mid.x ? 1 : -1, beside_ = (sd) => (sd > 0 ? m.x + 10 : m.x - 10 - width);
    const middle = Math.max(2, Math.min(W - 2 - width, m.x - width / 2));
    const spots = [...[side, -side].flatMap((sd) => [0, -16, 16, -32, 32, -48, 48].map((dy) => [beside_(sd), m.y + dy])), ...[-18, 22, -34, 38, -50, 54].map((dy) => [middle, m.y + dy])];
    const box = B.place(spots.map(([lx, ly]) => [lx, ly - 11, lx + width, ly + 4]), word);
    if (box) Object.assign(m, { lx: box[0], ly: box[1] + 11, tie: Math.max(box[0], Math.min(box[2], m.x)) });
  }
  const near = (late) => marks.filter((m) => m.late === late).map((m) => lens.isEntry(m.id) ? link(lens.words[m.id]) : lens.words[m.id]);
  const company = (p) => (e?.like[p] || []).map((i) => (lens.isEntry(i) ? link(lens.words[i]) : lens.words[i])).join(", ");
  const node = el(`<div class="path-plate"><div class="legend"><span><i class="early"></i>${t("near_early", lens.periods[steps[0].p])}</span>
    <span><i class="late"></i>${t("near_late", lens.periods[steps.at(-1).p])}</span><span><i class="route-key"></i>${t("path_key")}</span></div>
    <div class="path-body"><svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("path")}">
    <defs><marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--route)"/></marker><marker id="far" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)"/></marker></defs>
    ${marks.map((m) => `${m.lx === undefined ? "" : `<line class="leader" x1="${m.x}" y1="${m.y}" x2="${m.tie}" y2="${m.ly - 3}"/>`}<circle class="island ${m.late ? "late" : ""}" cx="${m.x}" cy="${m.y}" r="5"><title>${escape(lens.words[m.id])}</title></circle>${m.out[0] || m.out[1] ? `<path class="leader" d="M${m.x + 7 * m.out[0]},${m.y + 7 * m.out[1]}l${8 * m.out[0]},${8 * m.out[1]}" marker-end="url(#far)"/>` : ""}`).join("")}
    ${spur}<path class="casing" d="${d}"/><path class="route-line draw" pathLength="1" marker-end="url(#head)" d="${d}"/>
    ${steps.map((s, k) => `<circle class="route-step" data-k="${k}" cx="${s.x}" cy="${s.y}" r="4.5"><title>${lens.periods[s.p]}</title></circle>`).join("")}
    ${years.map((v) => `<text class="route-year" x="${v.tx.toFixed(1)}" y="${v.ty.toFixed(1)}" text-anchor="middle">${v.text}</text>`).join("")}
    ${marks.filter((m) => m.lx !== undefined).map((m) => `<text class="island-label" data-word="${escape(lens.words[m.id])}" x="${m.lx + 2}" y="${m.ly}">${lens.words[m.id]}</text>`).join("")}
    <circle class="ship" r="9" cx="${steps[0].x}" cy="${steps[0].y}"/><text class="when-label" text-anchor="middle"></text>
  </svg>${`<aside class="path-near"><p class="path-year" aria-hidden="true"></p><h3 class="path-now"></h3><p class="path-company"></p>
    <h3><i class="early"></i>${lens.periods[steps[0].p]}</h3><p>${near(false).join(", ")}</p><h3><i class="late"></i>${lens.periods[steps.at(-1).p]}</h3><p>${near(true).join(", ")}</p></aside>`}</div></div>`);
  const ship = node.querySelector(".ship"), label = node.querySelector(".when-label");
  const figure = { node, labels: steps.map((s) => lens.periods[s.p]), rail: true };
  figure.show = (k) => {
    ship.setAttribute("cx", steps[k].x);
    ship.setAttribute("cy", steps[k].y);
    label.setAttribute("x", steps[k].x);
    label.setAttribute("y", steps[k].y - 16);
    label.textContent = lens.periods[steps[k].p];
    // The column (under the plate on a phone): the year the ship is at, and its company that year.
    node.querySelector(".path-year").textContent = lens.periods[steps[k].p];
    node.querySelector(".path-now").textContent = t("near_now", lens.periods[steps[k].p]);
    node.querySelector(".path-company").innerHTML = company(steps[k].p);
  };
  node.querySelectorAll(".route-step").forEach((c) => c.addEventListener("click", () => (figure.goto || figure.show)(+c.dataset.k)));
  node.querySelectorAll(".island-label").forEach((n) => n.addEventListener("click", () => visit(href("kata", n.dataset.word))));
  return figure;
}

/** The chart of a lens with the routes of the given words on it. `pick(word)` is called when an island is clicked.
 *  With `night`, the chart is drawn for the deep (the home page's hero). With `sea` (sea.js) it is the 3D sea where
 *  WebGL2 is, and with `explore` that sea is the map's: the reader moves over it. */
async function chartFigure(name, list, pick = (word) => visit(href("kata", word)), height = "min(70vh, 560px)", { night = false, wait, sea, eager = false, explore = false, over, host } = {}) {
  const first = await json(`${name}/first.json`), label = new Map(first.words.map((id, k) => [id, first.names[k]]));
  // The whole lens comes later (after `wait`, if given); the chart is on screen before it.
  const meta = Promise.resolve(wait).then(() => lensNamed(name));
  let lens = null;
  // At night, with `sea` (sea.js), the chart is the 3D sea; where WebGL2 is not there, the night chart of chart.js.
  const given = { chart: first, name: (id) => (lens ? lens.words[id] : label.get(id)), pick: async (id) => pick((await meta).words[id]), periods: first.periods, tip, label: t("chart_keys"), night, over, host };
  const deep = sea && sea({ ...given, ...(explore ? { explore, label: t("sea_keys"), controls: { in: t("zoom_in"), out: t("zoom_out"), all: t("zoom_all"), turn: t("sea_turn"), above: t("sea_above"), level: t("sea_level") } } : { label: t("sea_label") }) });
  const chart = deep || seaChart(given);
  if (height && !(deep && explore)) chart.node.style.height = height;  // the map's sea is as tall as its band (style.css)
  // The rest of the islands join the chart with the lens, or (`eager`, the hero's arrival) as soon as they come.
  meta.then((l) => (lens = l)).catch(() => {});
  const whole = json(`${name}/chart.json`), more = (eager ? whole : Promise.all([meta, whole]).then(([, w]) => w)).then((w) => chart.more(w)).catch(() => {});
  const figure = { node: chart.node, labels: first.periods, chart, show: (p) => chart.time(p), more };
  /** The route of a word of the first screen, before the whole lens is here: its number is on the first screen and
   *  its path in bucket number / BUCKET. A word that is not there, or not in that bucket, waits for the lens. */
  const quick = async (word) => {
    const k = first.names.indexOf(word);
    if (k < 0 || lens) return null;
    const id = first.words[k], found = (await json(`${name}/paths/${Math.floor(id / BUCKET)}.json`).catch(() => [])).find((p) => p.word === id);
    return found?.route ? [{ id, color: ROUTES[0], route: found.route }] : null;
  };
  figure.set = async (names, { ms = 900, most } = {}) => {
    let routes = names.length === 1 ? await quick(names[0]) : null;
    if (!routes) {
      const l = await meta, ids = names.map((w) => l.index.get(w)).filter((i) => i !== undefined);
      const paths = await Promise.all(ids.map((i) => pathOf(l, i)));
      routes = ids.map((id, k) => ({ id, color: ROUTES[Math.min(k, 3)], route: paths[k]?.route || [] }));
    }
    chart.routes(routes);
    const frame = () => chart.frame(routes.map((r) => r.id), ms, most);
    if (ms) requestAnimationFrame(frame);  // a glide starts from where the view stands in the next frame
    else frame();  // a cut: the islands are painted once, already where the route is
    return routes.some((r) => r.route.some(Boolean));
  };
  if (list.length) await figure.set(list);
  return figure;
}

/** Who shares a page with a name, period by period: the nearer the middle, the larger the share of its pages. */
function circle(stick, i) {
  const node = el(`<div class="orbit circle"><div class="core">${stick.names[i]}</div></div>`);
  new ResizeObserver(() => node.style.setProperty("--r", node.clientWidth / 2 + "px")).observe(node);
  const beside = stick.beside[i].map((list) => list.filter(([j]) => stick.kinds[j] === "p").slice(0, 6));
  const all = [...new Set(beside.flat().map(([j]) => j))];
  const chips = all.map((j) => node.appendChild(el(`<a class="out" href="${href("lingkaran", stick.names[j])}"></a>`)));
  // Names keep their place from period to period; only their distance from the middle changes. The places lie
  // on two arcs, above and below, so that names stand over one another and not side by side.
  const half = Math.ceil(all.length / 2);
  const angle = (k) => ((k % 2 ? 90 : -90) + (half > 1 ? (Math.floor(k / 2) / (half - 1) - 0.5) * 110 : 0)) * (Math.PI / 180);
  const show = (p) => {
    const most = Math.max(1, ...beside[p].map(([, v]) => v));
    chips.forEach((chip, k) => {
      const found = beside[p].find(([j]) => j === all[k]), radius = found ? 0.98 - 0.42 * (found[1] / most) : 1.3;
      chip.style.setProperty("--x", `calc(var(--r) * ${(0.8 * radius * Math.cos(angle(k))).toFixed(3)})`);
      chip.style.setProperty("--y", `calc(var(--r) * ${(1.25 * radius * Math.sin(angle(k))).toFixed(3)})`);
      chip.classList.toggle("out", !found);
      chip.innerHTML = `${stick.names[all[k]]}${found ? ` <b>${Math.round(found[1] / 10)}%</b>` : ""}`;
    });
  };
  return { node, labels: ERAS_SHOWN, show };
}

/** Who is mentioned most, period by period: bars that overtake each other. `focus` is drawn in the route colour. */
function race(lens, entries, focus, rows = 10) {
  const ROW = 34;
  const top = Math.max(...entries.flatMap((e) => e.share));
  const node = el(`<div class="race" style="height:${ROW * Math.min(rows, entries.length) + 8}px"><div class="year"></div>
    ${entries.map((e) => `<div class="row ${lens.words[e.word] === focus ? "focus" : ""}"><span class="name">${link(lens.words[e.word])}</span>
      <span class="track"><span class="bar"></span><span class="value"></span></span></div>`).join("")}</div>`);
  const nodes = [...node.querySelectorAll(".row")];
  const show = (p) => {
    node.querySelector(".year").textContent = lens.periods[p];
    const order = entries.map((e, k) => k).sort((a, b) => entries[b].share[p] - entries[a].share[p]);
    order.forEach((k, rank) => {
      const share = entries[k].share[p];
      nodes[k].style.transform = `translateY(${Math.min(rank, rows) * ROW}px)`;
      nodes[k].style.opacity = rank < rows && share > 0 ? 1 : 0;
      nodes[k].querySelector(".bar").style.width = (78 * share) / top + "%";
      nodes[k].querySelector(".value").textContent = percent(share);
    });
  };
  return { node, labels: lens.periods, show };
}

/** The adjectives or the verbs that keep a name company, as bars, period by period. */
async function traitBars(lens, word, lexicon) {
  const lists = await saidOf(lens, word, lexicon);
  const periods = (lists || []).map((list, p) => (list.length ? p : -1)).filter((p) => p >= 0);
  if (!periods.length) return null;
  const node = el(`<div class="bars"></div>`);
  const show = (k) => {
    const list = lists[periods[k]], top = list[0][1];
    node.innerHTML = list.map(([id, s]) => `<span>${lens.isEntry(id) ? link(lens.words[id]) : lens.words[id]}</span><span class="bar" style="width:${(100 * s) / top}%"></span>`).join("");
  };
  return { node, labels: periods.map((p) => lens.periods[p]), show };
}

/** Two names head to head: the adjectives or verbs that keep one of them company much more than the other. */
async function duel(lens, first, second, lexicon) {
  const [a, b] = await Promise.all([first, second].map((w) => saidOf(lens, w, lexicon)));
  if (!a || !b) return null;
  const periods = lens.periods.map((_, p) => p).filter((p) => a[p].length && b[p].length);
  if (!periods.length) return null;
  const node = el(`<div class="duel"></div>`);
  const show = (k) => {
    const p = periods[k], score = new Map();
    a[p].forEach(([id, s]) => score.set(id, s));
    b[p].forEach(([id, s]) => score.set(id, (score.get(id) || 0) - s));
    const rows = [...score].filter(([, s]) => s).sort((x, y) => y[1] - x[1]);
    const most = Math.max(...rows.map(([, s]) => Math.abs(s)));
    const bar = (s, cls) => `<span class="bar ${cls}" style="width:${(110 * Math.abs(s)) / most}px"></span>`;
    node.innerHTML = `<span class="head left">${first}</span><span></span><span class="head">${second}</span>` + rows
      .map(([id, s]) => `<span class="left side">${s > 0 ? bar(s, "") : ""}</span><span>${lens.words[id]}</span><span class="side">${s < 0 ? bar(s, "k1") : ""}</span>`).join("");
  };
  return { node, labels: periods.map((p) => lens.periods[p]), show };
}

/** The company two words keep: what only the first has, what both have, what only the second has. */
function split(lens, a, b) {
  const node = el(`<div class="pair three"></div>`);
  const show = (p) => {
    const both = a.with[p].filter((i) => b.with[p].includes(i));
    const column = (title, ids, cls) => `<div><h3>${title}</h3>${words(lens, ids.filter((i) => !both.includes(i) || cls === "both"), null, "")}</div>`;
    node.innerHTML = column(t("only", lens.words[a.word]), a.with[p]) + column(t("both"), both, "both") + column(t("only", lens.words[b.word]), b.with[p]);
  };
  return { node, labels: lens.periods, show };
}

/** One small chart per word: when it arrived, when it peaked. With `rival`, a second, grey line per chart. */
function sparks(lens, entries, rivals = []) {
  const W = 150, H = 44;
  const line = (e, top) => e.share.map((v, i) => `${(W * i) / (e.share.length - 1)},${H - 4 - ((H - 8) * v) / top}`).join(" ");
  return el(`<ul class="sparks">${entries.map((e, k) => {
    const top = Math.max(...e.share, ...(rivals[k]?.share || [])), peak = e.share.indexOf(Math.max(...e.share));
    return `<li><a href="${href("kata", lens.words[e.word])}"><b>${lens.words[e.word]}</b>
      <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" aria-hidden="true">
        ${rivals[k] ? `<polyline class="spark-line k1 draw" pathLength="1" points="${line(rivals[k], top)}"/>` : `<polygon class="spark-area" points="0,${H} ${line(e, top)} ${W},${H}"/>`}
        <polyline class="spark-line draw" pathLength="1" points="${line(e, top)}"/></svg>
      <small>${rivals[k] ? escape(t("in_company", lens.words[rivals[k].word])) : t("peak", lens.periods[peak], percent(e.share[peak]))}</small></a></li>`;
  }).join("")}</ul>`);
}

/** A wall of posters to scroll sideways: each period in its own words, the first one largest. */
async function wall(lens) {
  const { peaks } = await highlights(lens);
  return el(`<div class="wall">${lens.periods.map((p, i) => {
    const [first, ...rest] = peaks[i].map((w) => lens.words[w]);
    return first ? `<div class="poster"><span class="year">${p}</span><span class="top">${link(first)}</span><ol>${rest.slice(0, 7).map((w) => `<li>${link(w)}</li>`).join("")}</ol></div>` : "";
  }).join("")}</div>`);
}

// ---- pieces of pages ------------------------------------------------------

/** A list of words; those absent from `other` are marked as gained ("new") or lost ("gone"). */
function words(lens, ids, other, mark) {
  if (!ids.length) return `<p class="sub">–</p>`;
  const there = new Set(other);
  return `<ul class="words">${ids
    .map((i) => `<li class="${other && !there.has(i) ? mark : ""}">${lens.isEntry(i) ? link(lens.words[i]) : lens.words[i]}</li>`)
    .join("")}</ul>`;
}

/** The company a word gained and lost between two periods, on one line each. */
function turnover(lens, e, a, b) {
  const only = (p, q) => e.with[p].filter((i) => !e.with[q].includes(i)).map((i) => lens.words[i]);
  const row = (sign, list) => (list.length ? `<span class="${sign}">${list.join(", ")}</span>` : "");
  return row("new", only(b, a)) + row("gone", only(a, b));
}

function download(name, data) {
  const a = el(`<a class="sub" download="${name}.json">${t("download")}</a>`);
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  return a;
}

/** An entry with its indexes replaced by words, for people who want the numbers. */
const readable = (lens, e) => ({
  word: lens.words[e.word],
  lens: lens.lens,
  periods: lens.periods,
  share_of_units: e.share,
  shift: Object.fromEntries(lens.pairs.map(([a, b], k) => [`${lens.periods[a]} > ${lens.periods[b]}`, e.shift[k]])),
  with: e.with.map((ids) => ids.map((i) => lens.words[i])),
  like: e.like.map((ids) => ids.map((i) => lens.words[i])),
});

/** The numbers of a word in one lens: how often, how far it shifted, and two periods side by side. */
function numbers(lens, e) {
  const body = el("<div></div>");
  const scored = e.shift.map((s, k) => [s, k]).filter(([s]) => s !== null);
  const widest = scored.length ? lens.pairs[scored.reduce((m, c) => (c[0] > m[0] ? c : m))[1]] : [0, lens.periods.length - 1];
  const draw = (a, b) => {
    const s = e.shift[pairIndex(lens, a, b)];
    const options = (selected, from, to) =>
      lens.periods.map((p, i) => (i < from || i > to ? "" : `<option value="${i}" ${i === selected ? "selected" : ""}>${p}</option>`)).join("");
    body.replaceChildren(
      el(`<h3>${t("frequency")}</h3>`),
      el(`<p class="sub">${t("frequency_about", lens)}</p>`),
      frequencyChart(lens, [e], [a, b]),
      el(`<h3>${t("matrix")}</h3>`),
      el(`<p class="sub">${t("matrix_about", lens.flag)}</p>`),
      shiftMatrix(lens, e, [a, b], draw),
      el(legend()),
      el(`<div class="controls"><label>${t("compare")} <select data-side="a">${options(a, 0, b - 1)}</select></label>
        <label>${t("with_period")} <select data-side="b">${options(b, a + 1, lens.periods.length - 1)}</select></label></div>`),
      el(`<p class="headline">${s === null ? t("too_rare_pair") : t("verdict", number(s), s >= lens.flag)}</p>`),
      el(`<p class="sub">${t("marks")}</p>`),
      el(`<div class="pair">${[a, b]
        .map((p, side) => `<div><h3>${lens.periods[p]}</h3>
          <p class="sub">${t("with")}</p>${words(lens, e.with[p], e.with[side ? a : b], side ? "new" : "gone")}
          <p class="sub">${t("like")}</p>${words(lens, e.like[p], e.like[side ? a : b], side ? "new" : "gone")}</div>`)
        .join("")}</div>`),
      el(`<details><summary>${t("all_periods")}</summary><div class="table" tabindex="0"><table>
        <tr><th>${t("period")}</th><th class="n">${t("share")}</th><th>${t("with")}</th><th>${t("like")}</th></tr>
        ${lens.periods.map((p, i) => `<tr><td>${p}</td><td class="n">${percent(e.share[i])}</td>
          <td>${e.with[i].map((w) => lens.words[w]).join(", ")}</td><td>${e.like[i].map((w) => lens.words[w]).join(", ")}</td></tr>`).join("")}
      </table></div></details>`),
      download(`${lens.words[e.word]}.${lens.lens}`, readable(lens, e)),
    );
    body.querySelectorAll("select").forEach((select) =>
      select.addEventListener("change", () => {
        const [na, nb] = [...body.querySelectorAll("select")].map((s) => +s.value);
        draw(na, nb);
      }),
    );
  };
  draw(...widest);
  return body;
}

/** A figure as a band of the deep, edge to edge, the tide line above and under it: a word's route, a stage of its own. */
const onDeep = (box) => (box.classList.add("deep-band"), box.prepend(el(tideLine(true))), box.append(el(tideLine())), box);
/** A figure with its player and a line under it saying how to read it. */
const explained = (figure, about, start, fold = false) => {
  const box = played(figure, start);
  box.append(el(fold ? `<details class="about"><summary>${t("read_figure")}</summary><p class="sub">${about}</p></details>` : `<p class="sub">${about}</p>`));
  return box;
};

/** A word in one lens: its path among its neighbours, its route on the chart, its company, the numbers, and for a name what is said of it. */
async function lensSection(lens, e) {
  const word = lens.words[e.word];
  const section = el(`<section class="lens-section"><p class="sub lens-about">${lensText(lens).about}</p>
    ${lens.sensitivity ? `<details class="about"><summary>${t("tests_title")}</summary><p class="sub">${t("sensitivity", lens.sensitivity, percent)}</p></details>` : ""}</section>`);
  const path = await pathOf(lens, e.word);
  const said = async () => {
    const box = el(`<div><p class="sub">${t("traits_about")}</p></div>`);
    for (const lexicon of ["verbs", "adjectives"]) {
      const bars = await traitBars(lens, word, lexicon).catch(() => null);
      if (bars) box.append(el(`<h3>${t(lexicon)}</h3>`), played(bars));
    }
    return box;
  };
  const views = [
    path?.path && [t("path"), () => onDeep(explained(pathFigure(lens, path, e), t("path_about"), undefined, true))],
    path?.route && [t("chart"), async () => explained(await chartFigure(lens.lens, [word]), t("chart_about"), undefined, true)],
    known(e).length > 1 && [t("orbit"), () => explained(orbit(lens, e), t("orbit_about"))],
    [t("numbers"), () => numbers(lens, e)],
    lens.articles.has(e.word) && [t("said"), said],
  ].filter(Boolean);
  // The figure first; what the lens is, under it. The route stands on the deep that the tabs stand on; any other
  // figure on paper, under the tide line.
  section.prepend(switcher(views.map((v) => v[0]), async (i) => { const made = await views[i][1](); return made.classList.contains("deep-band") ? made : el(`<div><div class="ashore">${tideLine()}</div></div>`).appendChild(made).parentNode; }));
  return section;
}

/** One lens at a time: a tab per lens, labelled with what `label(lens)` returns, showing `section(lens)`. */
async function perLens(found, label, section, first = 0) {
  view.append(switcher(await Promise.all(found.map(label)), (i) => section(found[i]), first, "chips"));
}

/** A field that offers the words of a lens as one types; `chosen(word)` gets the one picked. `lens` may still be on
 *  its way (a promise): the field is there at once and offers words once it has them. */
function suggest(lens, placeholder, button, chosen) {
  const form = el(`<form class="controls suggest" autocomplete="off"><span><input type="search" placeholder="${placeholder}" aria-label="${placeholder}" enterkeyhint="go"><ul class="offers" hidden></ul></span><button class="primary">${button}</button></form>`);
  const [input, offers] = [form.querySelector("input"), form.querySelector("ul")];
  const ready = Promise.resolve(lens);
  const take = (word) => {
    offers.hidden = true;
    input.value = "";
    chosen(word);
  };
  input.addEventListener("input", async () => {
    const l = await ready, q = input.value.trim().toLowerCase(), hits = [];
    if (!l) return;
    if (q) for (const [w, i] of l.index) if (w.startsWith(q) && l.isEntry(i) && hits.push(w) === 8) break; // in order of frequency
    offers.innerHTML = hits.length ? hits.map((w) => `<li><button type="button">${w}</button></li>`).join("") : q ? `<li class="none">${t("no_offers", escape(q))}</li>` : "";
    offers.hidden = !q;
    offers.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => take(b.textContent)));
  });
  input.addEventListener("keydown", (e) => e.key === "Escape" && (offers.hidden = true));
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const word = offers.querySelector("button")?.textContent || input.value.trim().toLowerCase();
    if (word) take(word);
  });
  form.addEventListener("focusout", (e) => !form.contains(e.relatedTarget) && setTimeout(() => !form.contains(document.activeElement) && (offers.hidden = true), 0));
  return form;
}

/** A text field that adds a word to `list` if `lens` has it, and chips to take words out again. */
function picker(lens, list, changed, most = 12) {
  const box = el(`<div><ul class="picked"></ul></div>`);
  const draw = () => {
    box.firstElementChild.innerHTML = list.map((w, k) => `<li class="k${k}">${w}<button type="button" data-k="${k}" aria-label="${t("remove")} ${w}">×</button></li>`).join("");
    box.querySelectorAll("li button").forEach((b) => b.addEventListener("click", () => (list.splice(+b.dataset.k, 1), draw(), changed())));
  };
  box.append(suggest(lens, t("add_word"), t("add"), (word) => {
    if (!lens.isEntry(lens.index.get(word)) || list.includes(word)) return;
    if (list.length >= most) list.shift();
    list.push(word);
    draw();
    changed();
  }));
  draw();
  box.redraw = draw;
  return box;
}

// ---- pages ----------------------------------------------------------------

/** What the sea behind a word's head shows: the word's route on the first page's lens (Kompas, year by year), when
 *  it has one there, named from that lens. */
const wordSea = (lens, word) => !lens ? {} : {
  name: (id) => lens.words[id], names: 6,
  routes: lens.isEntry(lens.index.get(word)) ? pathOf(lens, lens.index.get(word)).then((p) => (p?.route?.some(Boolean) ? [{ id: p.word, color: "--route", route: p.route }] : [])) : [],
};

async function wordPage(word, opened) {
  const all = await allLenses();
  const found = all.filter((lens) => lens.isEntry(lens.index.get(word)));
  const named = found.find((lens) => lens.articles.has(lens.index.get(word)));
  const kind = named && named.kind(named.index.get(word));
  // What the head says about the word besides its name: that it is a name, and what it names; a note of our own.
  let notes = "";
  if (named) {
    const i = named.index.get(word), article = named.articles.get(i);
    const same = new Set(found.flatMap((lens) => [...lens.articles].filter(([j, a]) => a === article && lens.isEntry(j)).map(([j]) => lens.words[j])));
    same.delete(word);
    notes += `<p class="note">${t("entity", `<a href="${WIKIPEDIA}${encodeURIComponent(article.replaceAll(" ", "_"))}">${escape(article)}</a>`)}
      ${same.size ? t("also_written", [...same].map(link).join(", ")) : ""}</p>`;
  }
  if (NOTES[word]) notes += `<p class="note">${NOTES[word][language]}</p>`;
  // What the word is, in one line, where a reader may not know (text.js, GLOSS).
  if (gloss(word)) notes = `<p class="gloss">${escape(gloss(word))}</p>` + notes;
  view.classList.add("word");
  view.replaceChildren(pageHead(escape(word), { kicker: named ? `<span class="dot ${kind}"></span>${t("name")}${kind === "other" ? "" : ` · ${t("kind_one_" + kind)}`}` : t("word"), cls: "word-title",
    more: notes && `<div class="head-notes">${notes}</div>`, sea: wordSea(all.find((lens) => lens.lens === MAIN), word) }));
  if (!found.length) {
    const h1 = view.querySelector(".page-head h1");
    h1.removeAttribute("aria-label");
    h1.textContent = t("word_missing", word);
    return view.append(el(`<section class="empty"><p>${t(all.some((lens) => lens.index.has(word)) ? "is_name" : "not_found")}</p><p>${t("word_missing_next")}</p>
      <ul class="words">${FEATURED.map((w) => `<li>${link(w)}</li>`).join("")}</ul></section>`));
  }

  const entries = new Map(await Promise.all(found.map(async (lens) => [lens, await entryOf(lens, word)])));
  // Open on the lens of the first page when the word is there: one publisher, year by year.
  const most = Math.max(0, found.findIndex((lens) => lens.lens === (opened || MAIN)));
  await perLens(
    found,
    (lens) => `${lensText(lens).short || lensText(lens).title} <b>${Number.isFinite(largest(entries.get(lens).shift)) ? number(largest(entries.get(lens).shift)) : "–"}</b>`,
    (lens) => lensSection(lens, entries.get(lens)),
    most,
  );
  const lens = found[most];
  // What to do next with the word, as cards: its portrait (for a name), the chart with other words, a race.
  const action = (to, what) => `<li><a class="card action" href="${to}"><b class="card-title">${t(what + "_ask")}</b><span class="card-text">${t(what + "_do")}</span></a></li>`;
  view.append(el(`<ul class="cards actions">${named ? action(href("potret", word), "portrait") : ""}${action(href("peta", lens.lens, word), "rival")}${action(href("balap", lens.lens, word), "race")}</ul>`), tools(href("kata", word, lens.lens), {}));
}

/** The chart of a lens, with up to four words of the reader's choosing sailing across it; two of them are compared below. */
async function chartPage(name = MAIN, ...list) {
  const lens = (await lensNamed(name)) || (await lensNamed(MAIN));
  list = list.filter((w) => lens.isEntry(lens.index.get(w))).slice(0, 4);
  const all = await allLenses();
  const select = el(`<select aria-label="${t("lens")}">${all.map((l) => `<option value="${l.lens}" ${l === lens ? "selected" : ""}>${lensText(l).title}</option>`).join("")}</select>`);
  select.addEventListener("change", () => visit(href("peta", select.value, ...list)));
  const below = el("<div></div>");
  // Where WebGL2 is, the map is the night sea, the width of the screen, and the reader moves over it (dragging,
  // turning, coming near, looking from above); elsewhere it is the chart on paper (chart.js).
  const gl = window.WebGL2RenderingContext ? (await import("./sea.js").catch(() => null))?.nightSea : null;
  // A map opened with no word shows one route already sailed, as an example, until the reader chooses a word.
  const demo = list.length || !lens.isEntry(lens.index.get(SHOWCASE[0])) ? null : SHOWCASE[0];
  const figure = await chartFigure(lens.lens, demo ? [demo] : list, (word) => {
    hear("light");
    if (list.includes(word)) return visit(href("kata", word));
    if (list.length >= 4) list.shift();
    list.push(word);
    update();
  }, undefined, { sea: gl, explore: true });
  const deep = !!figure.chart.state;
  const update = async () => {
    history.replaceState(null, "", href("peta", lens.lens, ...list));
    view.querySelector(".map-demo")?.remove();
    pick.redraw();
    address();
    await figure.set(list);
    await rivalry();
  };
  const pick = picker(lens, list, () => (hear("tick"), update()), 4);
  const rivalry = async () => {
    below.replaceChildren();
    if (list.length < 2) return below.append(el(`<p class="sub">${t("rival_hint")}</p>`));
    const [a, b] = await entriesOf(lens, list.slice(0, 2));
    below.append(el(`<h2>${t("rival_title", list[0], list[1])}</h2>`), el(`<p class="sub">${t("split_about")}</p>`), played(split(lens, a, b)));
    for (const lexicon of ["verbs", "adjectives"]) {
      const fight = await duel(lens, list[0], list[1], lexicon).catch(() => null);
      if (fight) below.append(el(`<h3>${t(lexicon)}</h3>`), el(`<p class="sub">${t("duel_about")}</p>`), played(fight));
    }
    below.append(el(`<h3>${t("frequency")}</h3>`), frequencyChart(lens, [a, b]));
  };
  const controls = el(`<div class="controls"></div>`);
  controls.append(select);
  const share = el("<div></div>");
  const address = () => share.replaceChildren(tools(href("peta", lens.lens, ...list), { check: list }));
  address();
  const head = pageHead(t("nav_chart"), { kicker: lensText(lens).title, lede: t("chart_lede"), sea: deep ? null : {} });
  if (!deep) view.replaceChildren(head, controls, pick, explained(figure, t("chart_about")), el(legendMoved()), share, below);
  else {
    // The head runs on into a band of the deep that holds the sea and what steers it; the paper begins under it.
    const band = el(`<section class="map-deep" aria-label="${t("nav_chart")}"></section>`);
    const steer = el(`<div class="map-steer"></div>`);
    steer.append(controls, pick);
    if (demo) steer.append(el(`<p class="sub map-demo">${t("map_demo", demo)}</p>`));
    // How to move over the sea, on the sea, until the reader does.
    const hint = el(`<p class="sea-hint" aria-hidden="true">${t(matchMedia("(pointer: coarse)").matches ? "map_hint_touch" : "map_hint_mouse")}</p>`);
    figure.node.append(hint);
    for (const kind of ["pointerdown", "keydown", "wheel"]) figure.node.addEventListener(kind, () => hint.classList.add("gone"), { once: true, passive: true });
    band.append(steer, explained(figure, t("chart_about")), el(legendMoved()), el(tideLine()));
    view.replaceChildren(head, band, share, below);
  }
  await rivalry();
}
const legendMoved = () => `<div class="legend"><span>${t("moved")}</span>${[0, 1, 2, 3, 4, 5].map((i) => `<span><i class="s${i}"></i>${i === 0 ? `< ${STEPS[0]}` : i === 5 ? `≥ ${STEPS[4]}` : `${STEPS[i - 1]}–${STEPS[i]}`}</span>`).join("")}</div>`;

/** A race of the reader's own words. */
async function racePage(name = MAIN, ...list) {
  const lens = (await lensNamed(name)) || (await lensNamed(MAIN));
  list = list.filter((w) => lens.isEntry(lens.index.get(w)));
  if (!list.length) list = (lens.lens === MAIN ? ["jokowi", "prabowo", "ahok", "anies baswedan", "gibran", "megawati"] : FEATURED).filter((w) => lens.isEntry(lens.index.get(w)));
  const all = (await allLenses()).filter((l) => l.periods.length >= 4);
  const select = el(`<select aria-label="${t("lens")}">${all.map((l) => `<option value="${l.lens}" ${l === lens ? "selected" : ""}>${lensText(l).title}</option>`).join("")}</select>`);
  select.addEventListener("change", () => visit(href("balap", select.value, ...list)));
  const holder = el("<div></div>");
  const draw = async () => {
    history.replaceState(null, "", href("balap", lens.lens, ...list));
    const entries = await entriesOf(lens, list);
    holder.replaceChildren(...(entries.length ? [played(race(lens, entries, null, 12), 0), el(`<h3>${t("frequency")}</h3>`), frequencyChart(lens, entries), tools(href("balap", lens.lens, ...list), { check: list })] : [el(`<p class="sub">${t("race_empty")}</p>`)]));
  };
  const controls = el(`<div class="controls"></div>`);
  controls.append(select);
  view.replaceChildren(pageHead(t("nav_race"), { ...fromPlay(), lede: t("race_lede"), sea: { words: list, count: 4 } }), controls, picker(lens, list, draw), holder);
  await draw();
}

/** Each period in its own words: a wall of posters, lens by lens. */
async function yearsPage() {
  const found = await allLenses();
  // The head's sea lights what the game's picture shows (PICTURES): each year's own word.
  const own = json("years.json").then((y) => { const peaks = peaksOf(y).filter((x) => x.stand >= 2); return y.years.map((_, p) => peaks.find((x) => x.p === p)?.w).filter(Boolean).reverse(); }).catch(() => []);
  view.replaceChildren(pageHead(t("nav_years"), { ...fromPlay(), lede: t("years_about"), sea: { words: own } }));
  view.append(switcher(found.map((lens) => lensText(lens).short || lensText(lens).title), (i) => wall(found[i]), Math.max(0, found.findIndex((lens) => lens.lens === MAIN)), "chips"));
}

/** Two words over the periods, on one scale: the one that fell in grey, named where it starts; the one that rose in the
 *  route's colour, named where it ends; the year its line first runs above the other's, marked (and on the lead, named:
 *  a small one keeps only its first and last year). Drawn at the width it is shown at, so its text is as set. */
function duet(lens, rose, fell, W = 340, H = 150, lead = false) {
  const L = 10, R = 10, T = 26, B = 24, n = lens.periods.length, top = Math.max(...rose.share, ...fell.share) || 1;
  const x = (i) => L + ((W - L - R) * i) / (n - 1), y = (v) => H - B - ((H - T - B) * v) / top;
  const points = (e) => e.share.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const cross = rose.share.findIndex((v, i) => i > 0 && v > fell.share[i] && rose.share[i - 1] <= fell.share[i - 1]);
  const [a, b] = [lens.words[rose.word], lens.words[fell.word]];
  // Where the two lines meet, between the period before the crossing and the crossing: marked as the lines reach it
  // (they draw from left to right together; --at, how far along), named with its year on the lead pair.
  const f = cross > 0 ? (fell.share[cross - 1] - rose.share[cross - 1]) / (rose.share[cross] - rose.share[cross - 1] - fell.share[cross] + fell.share[cross - 1]) : 0;
  const [cx, cy] = cross > 0 ? [x(cross - 1 + f), y(rose.share[cross - 1] + f * (rose.share[cross] - rose.share[cross - 1]))] : [0, 0], at = ((cx - L) / (W - L - R)).toFixed(2);
  return `<svg class="duet-figure" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escape(t("duet_label", a, b, lens.periods[cross] ?? ""))}">
    <line class="grid" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
    <polyline class="spark-line k1 draw" pathLength="1" points="${points(fell)}"/><polyline class="spark-line draw" pathLength="1" points="${points(rose)}"/>
    ${cross > 0 ? `<g class="crossing" style="--at:${at}"><line class="cross" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T - 6}" y2="${H - B}"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${lead ? 6 : 4}"/>${lead ? `<text class="duet-year" x="${cx.toFixed(1)}" y="${T - 10}" text-anchor="middle">${lens.periods[cross]}</text>` : ""}</g>` : ""}
    <text class="duet-fell" x="${L}" y="${Math.max(12, y(fell.share[0]) - 7)}">${escape(b)}</text>
    <text class="duet-rose" x="${W - R}" y="${Math.max(12, y(rose.share.at(-1)) - 7)}" text-anchor="end">${escape(a)}</text>
    <text x="${L}" y="${H - 6}">${lens.periods[0]}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${lens.periods.at(-1)}</text></svg>`;
}

/** What the counting turned up by itself: who took whose place, what came and went, what came and stayed. Each list
 *  is the counting's own ranking (idhist/highlights.py); the page shows its top and folds the rest, and of the pairs
 *  only those whose lines cross clearly (the rising word starts below the falling one and ends at least OVERTAKE
 *  times as common: a drift of topic, where both live on, does not), and says so. */
const LEAD = 6, OVERTAKE = 2;
async function findingsPage() {
  // Which sources have pairs is read from their small lists alone: the page does not wait for every source's words.
  const names = await json("lenses.json");
  const found = (await Promise.all(names.map((name) => json(`${name}/highlights.json`).then((h) => (h.swaps?.length ? name : null)).catch(() => null)))).filter(Boolean);
  view.replaceChildren(pageHead(t("nav_findings"), { kicker: t("findings_kicker"), lede: t("findings_lede"), sea: { words: MOVED } }));
  const third = (e, end) => { const k = Math.max(1, Math.floor(e.share.length / 3)), part = end ? e.share.slice(-k) : e.share.slice(0, k); return part.reduce((x, y) => x + y, 0) / k; };
  const crosses = (rose, fell) => third(rose, true) >= OVERTAKE * third(fell, true) && third(rose, false) < third(fell, false);
  /** A list's top in full, the rest folded under it. */
  const folded = (list, top, make, rest = make) => {
    const box = el("<div></div>");
    box.append(make(list.slice(0, top)));
    if (list.length > top) {
      const more = el(`<details class="more-finds"><summary>${t("show_rest", list.length - top)}</summary></details>`);
      more.append(rest(list.slice(top)));
      box.append(more);
    }
    return box;
  };
  const section = async (name) => {
    const lens = await lensNamed(name), { swaps, arrivals } = await highlights(lens);
    const box = el("<div></div>");
    const pairs = (await Promise.all(swaps.map(([fell, rose]) => Promise.all([entry(lens, rose), entry(lens, fell)])))).filter(([r, f]) => r && f && crosses(r, f));
    // The first pair leads, across the page; the next under it, by how many times as common the rising word ends.
    const effect = ([r, f]) => third(r, true) / third(f, true), shown = [pairs[0], ...pairs.slice(1, LEAD).sort((a, b) => effect(b) - effect(a))].filter(Boolean);
    const w = room(), wide = innerWidth >= 900, cols = wide ? 3 : Math.max(1, Math.floor((w + 16) / 320)), col = Math.floor((w - 16 * (cols - 1)) / cols - 50);
    box.append(el(`<h2>${t("swaps_title")}</h2>`), el(`<div class="told"><p class="sub">${t("swaps_about")}</p><p class="rule">${t("swaps_rule", pairs.length, swaps.length, Math.min(LEAD, pairs.length))}</p></div>`),
      folded(pairs, LEAD, () => el(`<ul class="duets">${shown.map(([r, f], k) => `<li><a href="${href("kata", lens.words[r.word])}"><b class="duet-word">${lens.words[r.word]}</b><span class="duet-was">${escape(t("in_company", lens.words[f.word]))}</span>${k ? duet(lens, r, f, col, Math.round(col * 0.45)) : duet(lens, r, f, w - (wide ? 66 : 50), wide ? 300 : 200, true)}</a></li>`).join("")}</ul>`),
        (list) => sparks(lens, list.map((p) => p[0]), list.map((p) => p[1]))));
    for (const kind of ["went", "stayed"]) {
      const entries = (await Promise.all(arrivals[kind].map(([w]) => entry(lens, w)))).filter(Boolean);
      box.append(el(`<h2>${t(kind + "_title")}</h2>`), el(`<p class="sub">${t(kind + "_about")} ${t("list_rule", Math.min(8, entries.length), entries.length)}</p>`), folded(entries, 8, (list) => sparks(lens, list)));
    }
    return box;
  };
  view.append(switcher(found.map((name) => LENS_TEXT[name][language].short || LENS_TEXT[name][language].title), (i) => section(found[i]), Math.max(0, found.indexOf(MAIN)), "chips"));
}

/** Lists per lens; a word also flagged between the same periods in another lens is marked. */
async function moversPage() {
  const all = await Promise.all((await allLenses()).map(async (lens) => ({ lens, movers: await json(`${lens.lens}/movers.json`) })));
  const key = (lens, m) => `${lens.periods[m.a]}>${lens.periods[m.b]}`;
  const elsewhere = (lens, m, word) =>
    all.filter((o) => o.lens !== lens && o.movers.some((x) => key(o.lens, x) === key(lens, m) && x.words.some(([w]) => o.lens.words[w] === word)));
  view.replaceChildren(pageHead(t("nav_movers"), { ...fromPlay(), lede: t("play_bergeser_about"), sea: { words: MOVED } }), el(`<p class="note">${t("movers_about")}</p>`));
  await perLens(all.map((o) => o.lens), (lens) => lensText(lens).short || lensText(lens).title, (lens) => {
    const { movers } = all.find((o) => o.lens === lens);
    const section = el(`<section><p class="sub">${lensText(lens).about}</p>
      <div class="controls"><label>${t("between")} <select name="pair">${movers
        .map((m, i) => `<option value="${i}">${lens.periods[m.a]} → ${lens.periods[m.b]}</option>`)
        .join("")}</select></label>
        <label>${t("show")} <select name="kind">${["all", "words", "entities"].map((k) => `<option value="${k}">${t("kind_" + k)}</option>`).join("")}</select></label></div>
      <p class="sub"></p><ul class="movers"></ul></section>`);
    const [pair, kind] = section.querySelectorAll("select");
    const draw = () => {
      const m = movers[pair.value];
      const rows = m.words
        .filter(([w]) => kind.value === "all" || (kind.value === "entities") === lens.articles.has(w))
        .map(([w, s]) => ({ word: lens.words[w], s, also: elsewhere(lens, m, lens.words[w]) }));
      rows.sort((x, y) => y.also.length - x.also.length || y.s - x.s);
      section.querySelector("p:last-of-type").textContent = t("flagged", m.flagged, m.scored, lens.flag) + (rows.some((r) => r.also.length) ? " " + t("replicated") : "");
      section.querySelector("ul").innerHTML = rows
        .slice(0, 120)
        .map((r) => `<li title="${r.also.map((o) => lensText(o.lens).title).join("; ")}">${link(r.word)} <span class="score"><i class="s${step(r.s)}"></i>${number(r.s)}${"●".repeat(r.also.length)}</span></li>`)
        .join("");
    };
    pair.value = movers.length - 1;
    section.querySelectorAll("select").forEach((select) => select.addEventListener("change", draw));
    draw();
    return section;
  });
}

/** The entities of each lens by kind, most frequent first, the names of one article together. */
async function entitiesPage() {
  const found = (await allLenses()).filter((lens) => lens.articles.size);
  const kinds = ["person", "organisation", "place", "other"];
  // The head's sea lights what the game's picture counts (PICTURES): the names of Kompas's tide table, people first.
  const named = json("years.json").then((y) => ["person", "organisation", "place"].map((kind) => y.tide[KOMPAS][kind][0]?.word).filter(Boolean)).catch(() => QUIZ_NAMES);
  view.replaceChildren(pageHead(t("nav_entities"), { ...fromPlay(), lede: t("entities_about"), sea: { words: named } }));
  const section = (lens) => {
    const box = el(`<section><div class="controls"><label>${t("filter")} <input type="search"></label></div></section>`);
    const input = box.querySelector("input");
    const list = el(`<ul class="movers"></ul>`);
    let kind = kinds[0];
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const byArticle = new Map();
      for (const [i, article] of [...lens.articles].sort((x, y) => x[0] - y[0]))
        if (lens.kind(i) === kind) byArticle.set(article, [...(byArticle.get(article) || []), lens.words[i]]);
      list.innerHTML = [...byArticle.values()]
        .filter((names) => !q || names.some((name) => name.includes(q)))
        .slice(0, 300)
        .map((names) => `<li>${names.map(link).join(", ")}</li>`)
        .join("");
    };
    input.addEventListener("input", draw);
    const pick = (i) => {
      kind = kinds[i];
      draw();
    };
    box.append(tabs(kinds.map((k) => `<span class="dot ${k}"></span>${t("kind_" + k)}`), pick), list);
    return box;
  };
  view.append(switcher(found.map((lens) => lensText(lens).short || lensText(lens).title), (k) => section(found[k]), Math.max(0, found.findIndex((lens) => lens.lens === MAIN)), "chips"));
}

/** The room a figure has on its stage, measured on the stage: the width and height to draw it at, and the zoom
 *  to show it at. A plate is drawn at most 760px wide so that its text keeps its size; on a larger stage it is
 *  shown up to 1.5 times larger (a 1920px screen's stage), never wider or taller than its room, and beside the
 *  caption never much taller than wide. */
const figureSize = (room) => {
  const width = room.clientWidth, height = innerWidth >= 900 ? Math.min(room.clientHeight, width * 0.9) : room.clientHeight;
  const zoom = Math.min(1.5, Math.max(1, width / 760));
  return [Math.floor(width / zoom), Math.floor(height / zoom), zoom];
};
const thousands = (n) => Math.round(n).toLocaleString(language);

/** The title of plate i of a scene: a sentence, one per plate, or made from the plate's name (or its pair). */
const plateTitle = (scene, p, i) => {
  const title = scene[language].plate;
  return typeof title === "function" ? title(...(scene.type === "pairs" ? scene.pairs[i] : [p.name])) : Array.isArray(title) ? title[i] : title;
};
/** What a plate's note says at state i: over how many pages. */
const PLATE_NOTES = {
  lines: (f) => (i) => t("pages_all", lensText(f.source).short, f.source.periods[i], thousands(f.source.units[i])),
  together: (f, scene) => (i) => t("pages_naming", thousands(f.source.pages[i]), scene.word, f.source.periods[i]),
  yearly: (f, scene, k) => (i) => t("pages_year", f.source.years[i], OUTLETS.map((o, j) => `${OUTLET[j]} ${thousands(f.source.pages[o][i])}`)
    .filter((_, j) => (scene.by === "outlet" ? j === k : scene.outlet === undefined || j === scene.outlet)).join(", ")),
  forget: () => () => t("forget_note"),
  split: (f, scene, k, p) => (i) => t("pages_all", lensText(f.source).short, scene.periods[i], thousands(f.source.units[p.at[i]])),
  stuck: (f, scene) => (i) => t("pages_stuck", scene.rows[0], dash(f.source.periods[i]), f.source.pages(i).map((n, k) => `${OUTLET[k]} ${thousands(n)}`).join(", ")),
  fell: (f, scene, k, p) => () => t("pages_fell", OUTLET.map((o, j) => `${o} ${thousands(f.source.pages[j][p.span[0]])} → ${thousands(f.source.pages[j][p.span[1]])}`).join(", ")),
  asked: (f, scene, k, p) => (i) => scene[language].note(p.states[i]),
};
PLATE_NOTES.pairs = PLATE_NOTES.lines;
PLATE_NOTES.left = PLATE_NOTES.forget;
/**
 * A story's figure (what it draws is scenes.js): lines on a plate or rows on a strip, one or, where its plates have
 * names, several of which one is seen. Its `show(i, focus, mark)` takes the step's focus as the step names it.
 */
const ROOMY = 72;  // beside the caption a strip's rows stand at most this far apart: a strip of few rows is not stretched to the stage's height
async function sceneFigure(scene, w, h, on) {
  const f = await figureOf(scene, { json, lens: lensNamed, entry: entryOf }, language, { wide: innerWidth > 760 });
  const make = (p, k) => {
    const spec = { title: plateTitle(scene, p, k), pages: PLATE_NOTES[scene.type](f, scene, k, p), base: ["forget", "left"].includes(scene.type) ? 1 : undefined };
    const made = f.draw === "plate"
      ? plate({ ...spec, periods: p.states, series: p.rows.map((r) => ({ label: r.label, values: r.values.map((v) => v[0]), off: r.off?.map((v) => v[0]) })) }, w, h)
      : strip({ ...spec, states: p.states, series: p.series, rows: p.rows, most: p.most, format: f.times ? (v) => "÷" + number(v) : undefined, empty: t("too_few") }, w,
        innerWidth >= 900 ? Math.min(h, stripLeast(spec.title, p.rows.length, w, p.series, ROOMY)) : h);
    return { ...made, show: (i, focus) => made.show(i, focused(p, focus)) };
  };
  inks(on);  // on a stage (`on`), drawn in the night's inks
  try { return f.plates[0].name === null ? make(f.plates[0], 0) : plates(f.plates.map((p) => p.name), (k) => make(f.plates[k], k)); }
  finally { inks(); }
}
/** The rows and series of a scene drawn as a strip (plate.js), known before its data comes: what its stage must make
 *  room for. */
const STRIPS = {
  stuck: (p) => [p.rows.length + (p.all ? 1 : 0), OUTLET],
  asked: (p) => (p.rows === "shares" ? [p.shares.length, p.publishers.map((x) => said(PUBLISHER[x]))] : [p.publishers.length, p.shares.map(([, label]) => said(label))]),
  fell: () => [FELL(innerWidth > 760), OUTLET],
  left: (p) => [p.names.length, OUTLET],
  split: (p) => [p.pairs.length, [p[language].series]],
};
/**
 * On a phone a stage shares its height between the figure and the caption band by need (--fig): the band keeps room
 * for its tallest step, and the figure gets the rest, at least half (a strip that slides, up to three fifths). Where the
 * tallest step would not fit beside that, the stage's captions are set a size smaller (--turn: 1rem, then --t-small),
 * and at the last the figure gives up a little more (to two fifths). The opening (step 0: the scene's title and text, and on the first stage the story's intro),
 * where it is longer still, rises over the figure's foot while it is read (--rise). No caption is cut. A strip of more rows
 * than that room keeps 26px apart is drawn at the height that does (`tall`), in a window of that room, and slides
 * through it as the page scrolls through the scene (stage, `slide`).
 */
const TURN = ["", "1rem", "var(--t-small)"], FOOT = 50;  // (a plate's note and the site's name: plate.js, sheet)
function share(s, part) {
  const box = s.stage, side = box.querySelector(".stage-side"), style = getComputedStyle(box);
  const whole = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parseFloat(style.rowGap), chrome = side.offsetHeight - s.caption.offsetHeight;
  const titles = [].concat(part[language].plate).filter((x) => typeof x === "string"), [rows, series] = STRIPS[part.type]?.(part) || [0, []];
  const need = rows ? Math.max(...titles.map((title) => stripLeast(title, rows, s.room.clientWidth, series))) : 0;
  // The figure wants half the stage, a strip taller than that up to three fifths (its window shows more of its rows).
  const want = need ? Math.min(need, whole * 0.6) : whole / 2;
  const probe = el(`<div class="caption" style="position:absolute;visibility:hidden;width:${s.caption.clientWidth}px;height:auto;overflow:visible"></div>`);
  side.append(probe);
  const high = (j) => ((probe.innerHTML = `<div class="turn">${s.said(j)}</div>`), probe.scrollHeight);
  let text = 0, open = 0;
  for (const size of TURN) {
    box.style.setProperty("--turn", size || "var(--t-body)");
    [open, text] = [high(0), Math.max(0, ...[...Array(s.steps - 1)].map((_, j) => high(j + 1)))];
    if (whole - chrome - text >= want) break;
  }
  probe.remove();
  // The opening may rise over the figure's foot (FOOT: its note and the site's name), never over a mark: where it is
  // longer, lines give it the room (down to three tenths of the stage), and a strip keeps the room its rows need: the
  // window it is seen in then ends where the opening begins, fading there as a sliding strip's window does (`risen`).
  const clear = Math.floor(whole - chrome - open + FOOT);
  let fig = Math.floor(Math.max(whole * 0.4, whole - chrome - text));
  if (!need && fig > clear) fig = Math.max(Math.floor(whole * 0.3), clear);
  else if (need && need <= fig) fig = Math.max(need, Math.min(fig, clear));
  box.style.setProperty("--fig", fig + "px");
  s.tall = need > fig ? need : 0;
  box.classList.toggle("tall", !!s.tall);
  const rise = Math.ceil(Math.max(0, open - (whole - chrome - fig)));
  box.style.setProperty("--rise", rise + "px");
  box.classList.toggle("risen", rise > FOOT);
}
/** From 900px a story's captions take at most two sizes: --t-caption where a step fits its band at it, and for every
 *  other step one size smaller, the largest of the ladder at which the longest caption of the whole story fits (an
 *  opening's title then at --t-h2). Measured in the language and at the width shown: no caption is cut, none scrolls,
 *  and the type does not step from size to size. */
const CAPTION = ["", "--caption:var(--t-lede);--caption-title:var(--t-h2)", "--caption:var(--t-body);--caption-title:var(--t-h2)", "--caption:var(--t-small);--caption-title:var(--t-h3)"];
function fit(stages) {
  const fits = stages.map((s) => {
    const probe = el(`<div class="caption" style="position:absolute;visibility:hidden;width:${s.caption.clientWidth}px;height:auto;overflow:visible"></div>`);
    s.caption.after(probe);
    const rows = [...Array(s.steps)].map((_, j) => CAPTION.map((size) => ((probe.innerHTML = `<div class="turn" style="${size}">${s.said(j)}</div>`), probe.scrollHeight <= s.caption.clientHeight)));
    probe.remove();
    return rows;
  });
  const small = CAPTION.findIndex((_, c) => c && fits.every((rows) => rows.every((row) => row[c]))), smaller = CAPTION[small < 0 ? CAPTION.length - 1 : small];
  stages.forEach((s, k) => s.sized(fits[k].map((row) => (row[0] ? "" : smaller))));
}
const SCENE_DATA = { together: "together.json", stuck: "together.json", yearly: "years.json", forget: "years.json", left: "years.json", fell: "stopped.json" };

/** A button that copies `text()` and says so. */
const copier = (label, text) => {
  const copy = el(`<button type="button">${label}</button>`);
  copy.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(text());
    copy.textContent = t("copied");
  });
  return copy;
};

/** The figure an address shows, as an image file to share, made before it is asked for (a share sheet opens only
 *  straight from the press: Safari will not wait for an image to be drawn). */
const shareImages = new WeakMap();
const sharedImage = (node, step) => {
  const made = shareImages.get(node);
  if (made?.step === step) return made;
  const image = { step, file: null };
  shareImages.set(node, image);
  plating().then(() => plateImage(node)).then((blob) => (image.file = new File([blob], "jejak-kata.png", { type: "image/png" }))).catch(() => {});
  return image;
};

/**
 * Share an address: where the device has a share sheet, it opens with the title, a line and the whole address (and
 * the figure as an image, where it can take files); elsewhere a short list of plain links to where people share, and
 * the address to copy. No script of any of those sites is loaded. `what()` says what is shared at the moment of
 * asking: { title, url, image } (image: the node a plate is shown in, and which step it is at).
 */
/** A small mark for each place to share, drawn in a few strokes (no script, image or font of those sites). */
const SHARE_ICONS = {
  WhatsApp: `<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.2z"/>`, X: `<path d="M5 5l14 14M19 5L5 19"/>`, Telegram: `<path d="M4 11.5l16-6.5-3 14-5-4-2.5 3v-4.5L17 7"/>`,
  Facebook: `<path d="M14 20v-7h3l.5-3H14V8.5c0-1 .5-1.5 1.5-1.5H18V4h-3c-2.5 0-4 1.5-4 4v2H8v3h3v7"/>`, LinkedIn: `<path d="M6 10v9M6 6v.5M10 19v-9M10 14c0-2.5 1.5-4 3.5-4s3.5 1 3.5 4v5"/>`,
  Bluesky: `<path d="M12 11C10 7 6 4.5 5 6c-1 2 0 6 3 6.5-3 .5-3 4 0 5s3.5-3 4-5.5c.5 2.5 1 6.5 4 5.5s3-4.5 0-5c3-.5 4-4.5 3-6.5-1-1.5-5 1-7 5z"/>`,
  email: `<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 8l8 5 8-5"/>`, link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  embed: `<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>`,
};
const icon = (name) => `<svg class="share-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SHARE_ICONS[name]}</svg>`;
function sharer(label, what, cls = "") {
  const box = el(`<details class="share${cls ? " " + cls : ""}"><summary class="button">${label}</summary><div class="share-to"><p>${t("share_label")}</p><ul></ul></div></details>`);
  const summary = box.firstElementChild, ready = () => what().image && sharedImage(...what().image);
  summary.addEventListener("pointerdown", ready);
  summary.addEventListener("focus", ready);
  summary.addEventListener("click", (e) => {
    const { title, url, image, embed } = what();
    if (!box.open) hear("sheet");
    if (!box.open && navigator.share) {
      e.preventDefault();
      const data = { title, text: t("share_text", title), url }, file = image && sharedImage(...image).file;
      if (file && navigator.canShare?.({ ...data, files: [file] })) data.files = [file];
      return void navigator.share(data).catch(() => {});
    }
    const u = encodeURIComponent(url), said = encodeURIComponent(t("share_text", title));
    box.querySelector("ul").replaceChildren(...[["WhatsApp", `https://wa.me/?text=${said}%20${u}`], ["X", `https://x.com/intent/post?text=${said}&url=${u}`],
      ["Telegram", `https://t.me/share/url?url=${u}&text=${said}`], ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
      ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`], ["Bluesky", `https://bsky.app/intent/compose?text=${said}%20${u}`], [t("email"), `mailto:?subject=${said}&amp;body=${u}`, "email"]]
      .map(([name, to, mark = name]) => el(`<li><a href="${to}"${to.startsWith("mailto") ? "" : ' target="_blank" rel="noopener"'}>${icon(mark)}${name}</a></li>`)), el(`<li class="copy"></li>`));
    // The one way to copy the address; and where a figure can stand on another site, the code of a frame that shows it (embedPage).
    box.querySelector(".copy").append(copier(`${icon("link")}${t("copy_link")}`, () => url));
    if (embed) box.querySelector(".copy").append(copier(`${icon("embed")}${t("copy_embed")}`,
      () => `<iframe src="${embed}" title="${escape(`${title} · Jejak Kata`)}" width="100%" height="700" style="border:0;max-width:760px" loading="lazy"></iframe>`));
  });
  return box;
}
// A list of places to share closes when the reader turns elsewhere.
document.addEventListener("click", (e) => document.querySelectorAll("details.share[open]").forEach((box) => box.contains(e.target) || (box.open = false)));
addEventListener("keydown", (e) => e.key === "Escape" && document.querySelectorAll("details.share[open]").forEach((box) => ((box.open = false), box.firstElementChild.focus())));

/** A table (rows of cells, the first the header) as CSV text: numbers as they are, text quoted where it must be. */
const csv = (rows) => rows.map((row) => row.map((v) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n") + "\n";

/** Buttons under a figure: save it as an image (a plate), download the numbers it draws as CSV (`table()`: what the
 *  figure loaded, plate.js), share it (`share`: what sharer() is given), copy its address, and where to check it. */
function tools(address, { image, table, check = [], data, share } = {}) {
  const row = el(`<div class="controls tools"></div>`);
  if (image) {
    const save = el(`<button type="button">${t("save_image")}</button>`);
    save.addEventListener("click", () => savePlate(typeof image === "function" ? image() : image, "jejak-kata"));
    row.append(save);
  }
  if (table) {
    const get = el(`<button type="button">${t("save_csv")}</button>`);
    get.addEventListener("click", () => {
      const rows = table();
      if (!rows) return;
      const url = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }));
      Object.assign(document.createElement("a"), { href: url, download: "jejak-kata.csv" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
    row.append(get);
  }
  // Shared, the address is copied from the list of places to share; else by a button of its own: one way to copy it.
  row.append(share ? sharer(t("share"), share) : copier(t("copy_link"), () => whole(typeof address === "function" ? address() : address)));
  const list = [].concat(data || []), files = list.map((file) => `<a href="${DATA}/${file}">${t("check_data")}${list.length > 1 ? ` (${file})` : ""}</a>`);
  if (check.length || files.length) row.append(el(`<span>${t("check")} ${[...check.map(link), ...files].join(", ")}</span>`));
  return row;
}

/** A story as a card, led by its key number and the line that says what the number counts. Large: on the deep. */
const keyOf = (story) => ({ number: story.key.number[language] || story.key.number, label: story.key[language] });
/** A story's teaser as a card says it: its first sentence, whole (never cut inside a number or a word). */
const firstSentence = (text) => text.match(/^.+?[.?!](?=\s+[A-Z“"]|$)/)?.[0] || text;
const storyCard = (story, large = false) => {
  const key = keyOf(story), words = story[language];
  return `<li><a class="card story-card${large ? " large" : ""}" href="${href("cerita", story.slug)}"><span class="key"><b class="key-number">${key.number}</b><span class="key-label">${key.label}</span></span>
    <b class="card-title">${words.title}</b><span class="card-text">${firstSentence(words.teaser)}</span></a></li>`;
};
/** Story cards: `large`, the newest three on the deep; else as an index, a row each under a rule, the number beside. */
const storyCards = (list, large = false) => `<ul class="cards doors story-cards${large ? " large" : " index"}">${list.map((s) => storyCard(s, large)).join("")}</ul>`;
/**
 * What each thing to play with draws, as a small picture of its own figure from its own data: a play card leads with
 * it. `d` is the data (Kompas's names and the words beside them by term, stick.json; the three publishers' yearly
 * shares and tides, years.json; the first page's chart, first.json), W and H the picture's size in pixels; each gives
 * the inside of its SVG and a note that says what it shows. The route's colour marks what the game asks about; no text
 * is under 12px.
 */
const KOMPAS = OUTLETS[0], TERM = ERAS_SHOWN.length - 1;
const namesFor = (s, word, least) => s.names.map((_, i) => i).filter((i) => s.kinds[i] === "p" && s.pages[i][TERM] >= least && s.share[word][i][TERM] !== null)
  .sort((a, b) => s.share[word][b][TERM] - s.share[word][a][TERM]);
/** The words of years.json each with the year it peaked in Kompas and how far that peak stands above its mean. */
const peaksOf = (y) => Object.entries(y.share).map(([w, by]) => {
  const v = by[KOMPAS].map((x) => x || 0), top = Math.max(...v), mean = v.reduce((a, b) => a + b, 0) / v.length;
  return { w, p: v.indexOf(top), stand: mean ? top / mean : 0 };
}).sort((a, b) => b.stand - a.stand);
const svgText = (x, y, text, cls = "", anchor = "start") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}"${cls ? ` class="${cls}"` : ""}${anchor === "start" ? "" : ` text-anchor="${anchor}"`}>${escape(String(text))}</text>`;
/** Rows of names with a dot each on one scale, the first in the route's colour (menempel, bergeser). */
const dotRows = (rows, W, H, value) => {
  // The names keep a column of at most 128px, clear of the picture's left edge: a longer one is cut with an ellipsis.
  const n = rows.length, pitch = H / n, L = Math.min(W * 0.55, 128, 18 + 6.6 * Math.max(...rows.map((r) => r.label.length))), R = 44, most = Math.max(...rows.map((r) => r.v)) * 1.04, fits = Math.floor((L - 18) / 6.6);
  return rows.map((r, k) => {
    const y = pitch * (k + 0.5), x = L + ((W - L - R) * r.v) / most;
    return `<g class="in" style="--i:${k}">${svgText(L - 8, y + 4.5, r.label.length > fits ? r.label.slice(0, fits - 1).trimEnd() + "…" : r.label, k ? "" : "strong", "end")}<path class="line dotted" d="M${L} ${y}H${W - R}"/>
      <circle class="${k ? "mute" : "on"}" cx="${x.toFixed(1)}" cy="${y}" r="5.5"/>${svgText(W - R + 8, y + 4.5, value(r.v), "soft")}</g>`;
  }).join("");
};
const PICTURES = {
  // Of 100 pages naming the person that "tersangka" sticks to most, how many hold it.
  tebak: ({ stick: s }, W, H) => {
    const word = "tersangka", i = namesFor(s, word, 1500)[0], n = Math.round(s.share[word][i][TERM] / 10), c = Math.min(H, W * 0.5) / 10;
    const cells = [...Array(100)].map((_, k) => `<rect class="in ${k < n ? "on" : "mute faint"}" style="--i:${Math.floor(k / 10)}" x="${((k % 10) * c).toFixed(1)}" y="${(Math.floor(k / 10) * c).toFixed(1)}" width="${(c * 0.82).toFixed(1)}" height="${(c * 0.82).toFixed(1)}" rx="${(c * 0.16).toFixed(1)}"/>`).join("");
    const size = Math.min(H * 0.5, (W - 10 * c) * 0.42);
    return { svg: `${cells}<text class="big" x="${(10 * c + 18).toFixed(1)}" y="${(10 * c * 0.62).toFixed(1)}" style="font-size:${size.toFixed(0)}px">${n}</text>${svgText(10 * c + 20, 10 * c * 0.62 + 22, "/ 100", "soft")}`,
      note: `“${word}” · ${s.names[i]} · Kompas ${ERAS_SHOWN[TERM]}` };
  },
  // A year's own words, and four years to choose from.
  kuis: ({ years: y }, W, H) => {
    const peaks = peaksOf(y).filter((x) => x.stand >= 2.5), count = (p) => peaks.filter((x) => x.p === p).length;
    const p = y.years.map((_, i) => i).sort((a, b) => count(b) - count(a) || b - a)[0], clue = peaks.filter((x) => x.p === p).slice(0, 3).map((x) => x.w);
    const choices = [...new Set([p - 6, p - 3, p, p + 3, p + 5].map((i) => Math.max(0, Math.min(y.years.length - 1, i))))].slice(0, 4).sort((a, b) => a - b);
    // The year's words over the picture's height, the four years at its foot: no empty band under them.
    const w = Math.min(72, (W - 24) / 4), h = 30, top = H - h - 2, pitch = Math.max(22, (top - 20 - 18) / Math.max(1, clue.length - 1));
    return { svg: clue.map((word, k) => svgText(0, 20 + k * pitch, word, k ? "" : "strong word")).join("") + choices.map((c, k) => {
      const x = k * (w + 8);
      return `<g class="in" style="--i:${k}"><rect class="${c === p ? "on" : "line"}" x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}"/>${svgText(x + w / 2, top + h / 2 + 4.5, y.years[c], c === p ? "on-text" : "", "middle")}</g>`;
    }).join(""), note: `Kompas ${y.years[p]}` };
  },
  // The names "tersangka" sticks to most.
  menempel: ({ stick: s }, W, H) => {
    const word = "tersangka", rows = namesFor(s, word, STUCK_PAGES).slice(0, Math.max(3, Math.min(5, Math.floor(H / 26)))).map((i) => ({ label: s.names[i], v: s.share[word][i][TERM] }));
    return { svg: dotRows(rows, W, H, (v) => `${Math.round(v / 10)}%`), note: `“${word}” · Kompas ${ERAS_SHOWN[TERM]}` };
  },
  // Who shares a page with prabowo, nearer the more often.
  lingkaran: ({ stick: s }, W, H) => {
    const name = "prabowo", i = s.names.indexOf(name), list = s.beside[i][TERM].filter(([j]) => s.kinds[j] === "p").slice(0, 6), most = list[0][1];
    const cx = W / 2, cy = H / 2 - 6, rx = Math.min(W / 2 - 16, H * 1.3), ry = H / 2 - 12, half = Math.ceil(list.length / 2);
    const angle = (k) => ((k % 2 ? 90 : -90) + (half > 1 ? (Math.floor(k / 2) / (half - 1) - 0.5) * 110 : 0)) * (Math.PI / 180);
    return { svg: `<ellipse class="line dotted" cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>` + list.map(([, v], k) => {
      const r = 0.98 - 0.42 * (v / most), x = cx + rx * r * Math.cos(angle(k)), y = cy + ry * r * Math.sin(angle(k));
      return `<g class="in" style="--i:${k}"><path class="line" d="M${cx} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}"/><circle class="mute" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + 4 * (v / most)).toFixed(1)}"/>${W >= 300 && k < 4 ? svgText(x, y + (k % 2 ? 20 : -11), s.names[list[k][0]], "soft halo", "middle") : ""}</g>`;
    }).join("") + `<circle class="on" cx="${cx}" cy="${cy}" r="7"/>${svgText(cx, cy + 26, name, "strong halo", "middle")}`,
    note: `${name} · Kompas ${ERAS_SHOWN[TERM]}` };
  },
  // The words on which the three newsrooms differ most in the last year: a dot for each.
  redaksi: ({ years: y }, W, H) => {
    const last = y.years.length - 1, of = (w) => OUTLETS.map((o) => y.share[w][o][last]);
    const rows = Object.keys(y.share).filter((w) => of(w).every((v) => v !== null)).map((w) => ({ w, v: of(w), spread: Math.max(...of(w)) - Math.min(...of(w)) }))
      .sort((a, b) => b.spread - a.spread).slice(0, Math.max(3, Math.min(5, Math.floor(H / 26))));
    const pitch = H / rows.length, L = Math.min(W * 0.4, 10 + 7 * Math.max(...rows.map((r) => r.w.length))), most = Math.max(...rows.flatMap((r) => r.v)) * 1.04;
    return { svg: rows.map((r, k) => {
      const yy = pitch * (k + 0.5);
      return `<g class="in" style="--i:${k}">${svgText(L - 8, yy + 4.5, r.w, "", "end")}<path class="line dotted" d="M${L} ${yy}H${W - 6}"/>${r.v.map((v, j) => `<circle class="c${j + 1}" cx="${(L + ((W - L - 12) * v) / most).toFixed(1)}" cy="${yy}" r="5.5"/>`).join("")}</g>`;
    }).join(""), note: `${OUTLET.map((o, j) => `<i class="c${j + 1}"></i>${o}`).join(" ")} · ${y.years[last]}` };
  },
  // A row per name, a column per year, each row shaded against its own best year: the names in the order of that year.
  pasang: ({ years: y }, W, H) => {
    const all = y.tide[KOMPAS].person.map((r) => ({ ...r, peak: Math.max(...r.share.map((v) => v || 0)) })).map((r) => ({ ...r, when: r.share.indexOf(r.peak) })).sort((a, b) => a.when - b.when || b.peak - a.peak);
    const n = Math.floor(H / 13), rows = [...Array(n)].map((_, k) => all[Math.round((k * (all.length - 1)) / (n - 1))]), L = W >= 420 ? 104 : 0, cw = (W - L) / y.years.length, ch = H / n;
    const level = (v, peak) => [0.08, 0.25, 0.45, 0.65, 0.85].filter((s) => v / peak >= s).length;
    return { svg: rows.map((r, k) => (L ? svgText(L - 6, ch * (k + 0.5) + 4.5, r.word, "soft", "end") : "") + r.share.map((v, c) => `<rect class="in s${v === null ? 0 : level(v, r.peak)}" style="--i:${c}" x="${(L + c * cw + 1).toFixed(1)}" y="${(k * ch + 1).toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" rx="2"/>`).join("")).join(""),
      note: `${t("kind_person")} · Kompas ${y.years[0]}–${y.years.at(-1)}` };
  },
  // Who was named most in the last year, as bars.
  balap: ({ years: y }, W, H) => {
    const last = y.years.length - 1, rows = ["jokowi", "prabowo", "ahok", "anies baswedan", "gibran", "megawati"].filter((w) => y.share[w]?.[KOMPAS][last]).map((w) => ({ w, v: y.share[w][KOMPAS][last] }))
      .sort((a, b) => b.v - a.v).slice(0, Math.max(3, Math.min(5, Math.floor(H / 26)))), pitch = H / rows.length, top = rows[0].v;
    const L = Math.min(W * 0.4, 10 + 7 * Math.max(...rows.map((r) => r.w.length))), room = W - L - 48;
    return { svg: `<text class="big faint" x="${W}" y="${H - 4}" text-anchor="end" style="font-size:${Math.round(H * 0.42)}px">${y.years[last]}</text>` + rows.map((r, k) => {
      const yy = pitch * k + 4, h = pitch - 8;
      return `<g class="in" style="--i:${k}">${svgText(L - 8, yy + h / 2 + 4.5, r.w, k ? "" : "strong", "end")}<rect class="${k ? "mute" : "on"}" x="${L}" y="${yy.toFixed(1)}" width="${((room * r.v) / top).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>${svgText(L + (room * r.v) / top + 6, yy + h / 2 + 4.5, percent(r.v), "soft")}</g>`;
    }).join(""), note: `Kompas ${y.years[last]}` };
  },
  // Each year in its own word: the word of years.json that stands highest in that year.
  tahun: ({ years: y }, W, H) => {
    const peaks = peaksOf(y).filter((x) => x.stand >= 2 && x.w.length <= 14), own = y.years.map((_, p) => peaks.find((x) => x.p === p)).map((x, p) => x && { p, w: x.w }).filter(Boolean);
    const k = Math.max(2, Math.min(own.length, Math.floor(W / 112))), shown = [...Array(k)].map((_, j) => own[Math.round((j * (own.length - 1)) / (k - 1))]), w = (W - (k - 1) * 8) / k;
    return { svg: shown.map((x, j) => `<g class="in" style="--i:${j}"><rect class="line" x="${(j * (w + 8)).toFixed(1)}" y="0.5" width="${w.toFixed(1)}" height="${H - 1}" rx="4"/>${j === k - 1 ? `<path class="on-line" d="M${(j * (w + 8) + 2).toFixed(1)} 1.5H${(j * (w + 8) + w - 2).toFixed(1)}" stroke-width="3"/>` : ""}
      ${svgText(j * (w + 8) + 10, 22, y.years[x.p], "soft")}${x.w.split(" ").map((part, m) => svgText(j * (w + 8) + 10, H - 14 - (x.w.split(" ").length - 1 - m) * 18, part, "word")).join("")}</g>`).join(""),
    note: `Kompas ${y.years[0]}–${y.years.at(-1)}` };
  },
  // The frequent words of the first page that moved most: lights as high as they moved, as on the night sea.
  bergeser: ({ first: f }, W, H) => {
    const k = Math.max(3, Math.min(6, Math.floor(W / 64))), names = MOVED(f).slice(0, k), v = names.map((w) => f.moved[f.names.indexOf(w)]), top = Math.max(...v), water = H - 36, gap = W / k;
    return { svg: `<path class="line" d="M0 ${water}H${W}"/>` + names.map((w, j) => {
      const x = gap * (j + 0.5), y = water - ((water - 14) * v[j]) / top;
      return `<g class="in" style="--i:${j}"><path class="line dotted" d="M${x.toFixed(1)} ${water}V${y.toFixed(1)}"/><circle class="${j ? "mute" : "on"}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${j ? 5 : 6.5}"/>${svgText(x, j % 2 ? H - 2 : H - 18, w, j ? "" : "strong", "middle")}</g>`;
    }).join(""), note: `Kompas ${f.periods[0]}–${f.periods.at(-1)}` };
  },
  // The names of the tide table by kind: a dot for each.
  entitas: ({ years: y }, W, H) => {
    const kinds = ["person", "organisation", "place"], col = W / 3, lines = Math.floor((H - 26) / 12);
    return { svg: kinds.map((kind, j) => {
      const list = y.tide[KOMPAS][kind], per = Math.ceil(list.length / lines), gap = Math.min(12, (col - 14) / per);
      return list.map((_, k) => `<circle class="in ${kind}" style="--i:${Math.floor(k / per)}" cx="${(j * col + 5 + (k % per) * gap).toFixed(1)}" cy="${(5 + Math.floor(k / per) * 12).toFixed(1)}" r="${Math.min(4.5, gap * 0.4).toFixed(1)}"/>`).join("")
        + svgText(j * col, H - 4, `${list.length} ${t("kind_" + kind)}`, "soft");
    }).join(""), note: `Kompas ${y.years[0]}–${y.years.at(-1)}` };
  },
};
/** The play cards' pictures, drawn once their data has come (when they come near the screen) and again when their
 *  width changes; where the data cannot come, the card is text alone. */
function pictured(box) {
  const pics = [...box.querySelectorAll(".play-pic")];
  const fill = async () => {
    const [stick, years, first] = await Promise.all([stickOf(0), json("years.json"), json(`${MAIN}/first.json`)]), d = { stick, years, first };
    for (const pic of pics) {
      let width = 0;
      new ResizeObserver(() => {
        if (!pic.isConnected || Math.abs(pic.clientWidth - width) < 2) return;
        width = pic.clientWidth;
        const { svg, note } = PICTURES[pic.dataset.page](d, width, pic.clientHeight);
        pic.innerHTML = `<svg viewBox="0 0 ${width} ${pic.clientHeight}" width="${width}" height="${pic.clientHeight}" aria-hidden="true">${svg}</svg>`;
        pic.nextElementSibling.innerHTML = note;
      }).observe(pic);
    }
  };
  const seen = new IntersectionObserver((list) => list.some((e) => e.isIntersecting) && (seen.disconnect(), fill().catch(() => pics.forEach((pic) => pic.remove()))), { rootMargin: "400px 0px" });
  seen.observe(box);
  return box;
}
const WIDE = { pasang: "wide", tahun: "wide right" };  // on a wide screen these two take two columns of "more"
const playCard = (page, lead = false) => `<li${WIDE[page] ? ` class="${WIDE[page]}"` : ""}><a class="card play-card${lead ? " lead" : ""}" href="${href(page)}">${lead ? `<span class="kicker">${t("play_lead")}</span>` : ""}<span class="play-pic" data-page="${page}"></span><span class="play-note"></span>
  <b class="card-title">${t(`play_${page}`)}</b><span class="card-text">${t(`play_${page}_about`)}</span></a></li>`;
/** The first thing to play leads, on the deep, its picture large; the next two beside it. */
const playTop = () => pictured(el(`<ul class="cards doors play-cards play-top">${PLAY.slice(0, 3).map((page, k) => playCard(page, !k)).join("")}</ul>`));

/** The chart's graticule, faint: what lies behind a head on the deep until the night sea is there (or where it
 *  cannot be). Lines only; no route that no word sailed. */
const GRATICULE = `<svg class="graticule" viewBox="0 0 1200 800" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
  ${[...Array(13)].map((_, i) => `<path d="M${i * 100} 0V800"/>`).join("")}${[...Array(9)].map((_, i) => `<path d="M0 ${i * 100}H1200"/>`).join("")}</svg>`;
/** Minutes to read a story at 200 words a minute, counted from its own text in the language shown. */
const readingTime = (story) => {
  const words = [story[language].teaser, story[language].intro, story[language].limits, ...story.scenes.flatMap((part) => [part[language].text || "", ...part.steps.map((step) => step[language])])];
  return Math.max(1, Math.round(words.join(" ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));
};

const SHARE_MARK = `<svg class="share-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v6.5h14V13"/></svg>`;

/** How to cite a story: a line to copy, and the same as BibTeX. Its author and its date are what the site states
 *  (SITE, the story's `published`). */
function cite(story, url) {
  const title = story[language].title, year = story.published.slice(0, 4);
  const line = `${SITE.author} (${year}). ${title}. ${SITE.name}. ${url}`;
  const bibtex = `@misc{jejakkata-${story.slug},\n  author = {${SITE.author}},\n  title = {${title}},\n  year = {${year}},\n  howpublished = {${SITE.name}},\n  url = {${url}}\n}`;
  const box = el(`<details class="cite"><summary>${t("cite")}</summary><p class="cite-line">${escape(line)}</p><pre>${escape(bibtex)}</pre><div class="controls"></div></details>`);
  box.querySelector(".controls").append(copier(t("cite_copy"), () => line), copier(t("cite_bibtex"), () => bibtex));
  return box;
}

/** What a story's data cannot say (story.js, `limits`: its own paragraphs, word for word) as a list, a paragraph an
 *  item; each led in bold by its own first words: the lead it already has (<b>), else its first sentence where that is
 *  short (12 words at most). Only the markup is the site's: the text is not changed. */
const limitsList = (html) => `<ul class="limits-list">${[...el(`<div>${html}</div>`).children].map((p) => {
  const text = p.firstChild, end = text?.nodeType === 3 ? text.data.search(/[.?!](\s|$)/) : -1, lead = end > 0 ? text.data.slice(0, end + 1) : "";
  if (lead && lead.split(/\s+/).length <= 12) (text.data = text.data.slice(end + 1)), p.prepend(Object.assign(document.createElement("b"), { textContent: lead }));  // (a paragraph led by its own <b> starts with that, not with text)
  return `<li>${p.innerHTML}</li>`;
}).join("")}</ul>`;

/** Every story, led by its key number; the newest three large, on the deep. */
function storiesPage() {
  view.replaceChildren(pageHead(t("nav_stories"), { kicker: t("stories_kicker", STORIES.length), lede: t("stories_lede"), sea: { words: storyWords(STORIES.slice(0, 3)) } }), el(storyCards(STORIES.slice(0, 3), true)),
    el(`<h2 class="cards-head">${t("more_stories")}</h2>`), el(storyCards(STORIES.slice(3))));
}

/** A key number that ticks up to itself as it surfaces, once (the cover's, from 900px where it is shown): each figure
 *  in it counts up from 0 on the site's curve (--sail, a leg), keeping its decimals and its separator; a denominator
 *  ("139 / 200") stands as it is, and so does a key with no figure ("KPK"). With reduced motion it is simply there. */
function tickUp(node) {
  const text = node?.textContent || "", figures = [...text.matchAll(/(?<!\/\s*|[\d.,])\d+(?:[.,]\d+)?/g)];
  if (!figures.length || still() || !node.getClientRects().length) return;
  const style = getComputedStyle(document.documentElement), ms = (k) => parseFloat(style.getPropertyValue(k)) || 0;
  const timing = document.createElement("i").animate({ opacity: [0, 1] }, { duration: ms("--d-leg"), delay: ms("--d-turn") * 1.6, easing: style.getPropertyValue("--sail").trim() || "ease", fill: "both" });
  const at = (f) => figures.reduceRight((said, m) => {
    const [whole, mark = ".", decimals = ""] = m[0].match(/^\d+(?:([.,])(\d+))?$/), value = parseFloat(m[0].replace(",", ".")) * f;
    return said.slice(0, m.index) + value.toFixed(decimals.length).replace(".", mark) + said.slice(m.index + whole.length);
  }, text);
  node.setAttribute("aria-label", text);
  const tick = () => {
    if (!node.isConnected) return;
    if (timing.playState === "finished") return (node.textContent = text), node.removeAttribute("aria-label");
    node.textContent = at(timing.effect.getComputedTiming().progress ?? 0);
    requestAnimationFrame(tick);
  };
  tick();
}

/** The words a scene is about, as story.js names them: its word, its rows, lines, pairs or names, then those it asks
 *  the reader to check. */
const FLIGHT = 600;  // ms the story's sea takes from one step's view to the next
/**
 * The sea under a story's stages (DESIGN.md, "The story"): one held sea behind every stage's figure, whose camera
 * flies to each step (FLIGHT, on the site's curve): to the words the step brings forward (its focus), else the
 * scene's words, each looked up on the first page's chart (a word it does not have is not lit); the step's words are
 * ringed in the beacon and named, the scene's others faintly; where the scene follows one word (its `word`, or the one
 * word a step brings forward), that word's route is sailed to the step's year. The view is framed in the water the
 * stage leaves open (beside the caption from 900px, under it on a phone). At a new scene (`entering`: the moment its
 * gong is heard, and from the cover) the sea takes the whole stage for a leg (LEG): the figure and the caption give
 * way, the camera flies to the scene's words, the route sails; then the card comes back over it and the sea glides
 * into the open water. A key on the stage (above its controls) says in a line what the sea shows, made from what is lit. With reduced
 * motion no flight and no taking over: a crossfade, and the key. Without WebGL2 the stages keep the graticule.
 * Returns `to(k, j, entering)`, or null where there is no such sea.
 */
async function storySea(holder, stages, parts) {
  if (!window.WebGL2RenderingContext) return null;
  const [module, first] = await Promise.all([import("./sea.js"), json(`${MAIN}/first.json`), painted()]).catch(() => []);
  if (!first || !holder.isConnected) return null;
  // The words are looked up on the first screen of the chart; from 900px the whole chart and its lens follow, and the
  // step is lit again with every word the lens has (a phone keeps to the first screen: it stays cheap).
  let lens = null, k = 0, at = "", now = null, full = 0;
  const named = new Map(first.words.map((id, k) => [id, first.names[k]])), idOf = (w) => (lens ? lens.index.get(w) : first.words[first.names.indexOf(w)]);
  const ids = (list) => [...new Set(list.map(idOf).filter((id) => id !== undefined && sea.has(id)))];  // (only what the sea carries)
  const nameOf = (id) => (lens ? lens.words[id] : named.get(id));
  // What lies over the sea on the stage shown: no name is written under it (while the sea has the stage, only the
  // controls and the key).
  const over = () => [...stages[k].stage.querySelectorAll(full ? ".sea-key, .stage-nav" : ".stage-meta, .caption .turn:not(.out), .sea-key, .stage-nav, .stage-figure .plate:not(.off) svg")];
  const wide = innerWidth >= 900, sea = module.nightSea({ chart: first, name: nameOf, pick: (id) => visit(href("kata", nameOf(id))), periods: first.periods, tip, label: t("sea_label"),
    hold: true, fly: true, rung: window.seaRung ?? 0, most: wide ? Infinity : 2500, names: 0, over, host: holder.parentNode });
  if (!sea) return null;
  holder.append(sea.node);
  addEventListener("resize", () => holder.isConnected && (at = ""));  // the open water is found again at the next step's look
  if (wide) Promise.all([lensNamed(MAIN), json(`${MAIN}/chart.json`)]).then(([l, whole]) => ((lens = l), sea.more(whole), (at = ""), now && to(...now))).catch(() => {});
  const paths = new Map(), route = (id) => paths.get(id) || paths.set(id, json(`${MAIN}/paths/${Math.floor(id / BUCKET)}.json`).then((list) => list.find((p) => p.word === id)?.route || []).catch(() => [])).get(id);
  /** The open water of a stage as it now stands, [top, right, bottom, left] in pixels of the sea: under the caption
   *  (and beside the plate from 900px), at least a band above the controls (a long caption is shaded over it); with
   *  `whole`, all of the stage above its controls. */
  const water = (stage, whole = false) => {
    const box = holder.getBoundingClientRect(), r = (n) => n.getBoundingClientRect(), text = stage.querySelector(".caption .turn:not(.out)") || stage.querySelector(".caption");
    const plate = r(stage.querySelector(".stage-figure .plate:not(.off) svg") || stage.querySelector(".stage-figure")), nav = r(stage.querySelector(".sea-key"));
    const bottom = box.bottom - nav.top + 8, top = Math.min(r(text).bottom - box.top + 16, box.height - bottom - (wide ? 240 : 100));
    if (whole) return [24, wide ? 48 : 16, bottom, wide ? 48 : 16];
    return wide ? [top, box.right - r(stage).right + 32, bottom, plate.right - box.left + 32] : [top, 0, bottom, 0];
  };
  const to = async (scene, j, entering = false) => {
    const label = `${scene}/${j}`;
    now = [scene, j];
    if (label === at) return;
    at = label;
    k = scene;
    const part = parts[scene], step = j ? part.steps[j - 1] : null, focus = ids(step?.focus || []), rest = ids(sceneWords(part)).filter((id) => !focus.includes(id)).slice(0, 12);
    // The sea takes the stage at once, with the gong; its flight starts as soon as the route is there.
    const stage = stages[scene].stage, taking = entering && !still();
    if (taking) (stages.forEach((s) => s.stage.classList.remove("sea-full")), stage.classList.add("sea-full"), (full = performance.now()));
    // The route sailed: the scene's own word, else the one word the step brings forward.
    const one = ids([part.word || ""])[0] ?? (focus.length === 1 && (step.focus || []).length === 1 ? focus[0] : undefined), sailed = one === undefined ? [] : [{ id: one, route: await route(one) }];
    if (at !== label) return;  // moved on while the route came
    const year = first.periods.indexOf(String(step?.at ?? "").match(/\d{4}/g)?.at(-1)), sail = !j || !sailed[0]?.route.some(Boolean) ? 0 : year >= 0 ? year : first.periods.length - 1;
    // The key: the words lit (those the step brings forward first; as many named as fit its room, at most four, the
    // rest counted) and the route as far as sailed.
    const shown = [...focus, ...rest], sailedTo = sail && sailed.length ? t("sea_key_route", nameOf(one), first.periods[sail]) : "", keyed = stage.querySelector(".sea-key");
    for (let n = Math.min(4, shown.length); n >= 0; n--) {
      keyed.textContent = shown.length || sailedTo ? t("sea_key", shown.slice(0, n).map(nameOf).join(", ") + (shown.length > n ? t(n ? "sea_key_more" : "sea_key_count", shown.length - n) : ""), sailedTo) : "";
      if (keyed.scrollWidth <= keyed.clientWidth + 1) break;
    }
    const view = (box, ms) => {
      sea.inset(box);
      sea.routes(sailed);
      sea.light([...focus.map((id) => ({ id, strong: true })), ...rest.map((id) => ({ id }))]);
      sea.time(sail, ms);
      sea.frame(focus.length ? focus : rest, ms / 1.4);  // a frame glides 1.4 times the time it is given
    };
    // The bed follows the flight: the water closes a little as the camera lifts, and opens as it comes down.
    if (hearing && !still()) (sounding?.dive(0.15, true), setTimeout(() => hearing && sounding?.dive(0, true), taking ? LEG : FLIGHT));
    if (taking) {
      view(water(stage, true), LEG);
      // Then the card comes back over the sea, and the sea glides into the water the stage leaves open.
      return setTimeout(() => (stage.classList.remove("sea-full"), (full = 0), at === label && requestAnimationFrame(() => view(water(stage), FLIGHT))), LEG);
    }
    if (!still() || !sea.state().routes && !sea.state().lit) return view(water(stage), FLIGHT);
    // With reduced motion the view is not flown but crossfaded, through the deep.
    const away = holder.animate({ opacity: [1, 0] }, { duration: FLIGHT / 4, fill: "forwards" });
    away.finished.then(() => (view(water(stage), 0), holder.animate({ opacity: [0, 1] }, { duration: FLIGHT / 4 }), away.cancel())).catch(() => {});
  };
  return to;
}

/** The story on screen, if one is: `ask()` after a scroll or a resize, `key(e)` for the keyboard, `place()` for
 *  where to return to. A story keeps its place by step, not by pixels, since its cover is not as tall in each
 *  language: `marks` holds, for each entry of the browser's history, [scene, step] or [-1, pixels past the landing]. */
let voyage = null;
const marks = new Map();
addEventListener("scroll", () => voyage?.ask(), { passive: true });
addEventListener("resize", () => voyage?.ask());
addEventListener("keydown", (e) => voyage?.key(e));
addEventListener("scrollend", () => voyage?.arrived());

/**
 * A story is a voyage in three parts: a cover on the deep, a stage per scene, and a landing on the chart that says
 * what the data cannot tell. The cover and the stages are laid out before any figure is drawn, so nothing moves
 * once it is on screen; each figure is then drawn at the size its stage has.
 */
async function storyPage(slug, scene, step, more) {
  if (!slug) return storiesPage();
  if (!STORIES.some((s) => s.slug === slug)) return lostPage();
  if (scene === EMBED) return embedPage(slug, step, more);
  // Laid out full width from the first frame (index.html says so too), also while the plates and the story's body
  // (story.js: its intro, limits and scenes; the cards need only text.js) are on their way.
  view.classList.add("voyage");
  document.documentElement.classList.add("voyaging");
  const story = (await Promise.all([import("./story.js"), plating()]))[0].STORIES.find((s) => s.slug === slug);
  const words = story[language], next = STORIES[(STORIES.findIndex((s) => s.slug === slug) + 1) % STORIES.length], parts = story.scenes;
  const cover = el(`<header class="cover shore"><div class="shore-sea">${GRATICULE}</div><div class="cover-text"><a class="kicker" href="${href("cerita")}">${t("nav_stories")}</a>
    <p class="cover-kicker">${t("story")} · ${t("read_time", readingTime(story))}</p><h1${words.title.length > 34 ? ' class="long"' : ""}>${words.title}</h1>
    <div class="cover-body"><div><p class="deck">${words.teaser}</p>
    <button type="button" class="primary begin">${t("begin")}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button></div><div class="cover-side"><p class="cover-key"><b class="key-number">${keyOf(story).number}</b><span class="key-label">${keyOf(story).label}</span></p><p class="cover-intro">${words.intro}</p></div></div></div></header>`);
  let last = 0;  // the scene seen last: what the tools save and link to
  // On a phone the cover holds the title, the deck and "Mulai"; the intro opens the first scene instead.
  const stages = parts.map((part, k) => stage(part, k, parts.length, (j) => steer(k, j), k ? "" : words.intro));
  // Shared: the story from its cover and its landing; from a stage, the step it is on (its address opens there),
  // with the figure as an image.
  const shared = () => ({ title: words.title, url: whole(href("cerita", slug)) });
  cover.querySelector(".begin").after(sharer(t("share"), shared, "on-deep"));
  stages.forEach((s, k) => s.stage.querySelector(".stage-meta").append(sharer(`${SHARE_MARK}<span class="hidden">${t("share_step")}</span>`,
    () => ({ title: words.title, url: whole(href("cerita", slug, String(k), String(s.on()))), image: [s.room, s.on()], embed: whole(href("cerita", slug, "embed", String(k), String(s.on()))) }), "step")));
  const landing = el(`<section class="landing">${tideLine()}<div class="limits"><h2>${t("limits_title")}</h2>${limitsList(words.limits)}</div></section>`);
  landing.append(tools(() => href("cerita", slug, String(last)), { image: () => stages[last].room, table: () => stages[last].figure()?.table?.(),
    share: () => ({ ...shared(), embed: whole(href("cerita", slug, "embed", String(last), String(stages[last].on()))) }), check: [...new Set(parts.flatMap((part) => part.check || []))],
    data: [...new Set(parts.map((part) => (part.type === "asked" ? `pages/${part.name}.json` : SCENE_DATA[part.type])).filter(Boolean))] }),
    cite(story, whole(href("cerita", slug))),
    el(`<a class="card next-story" href="${href("cerita", next.slug)}"><span class="kicker">${t("next_story")}</span><b class="card-title">${next[language].title}</b><span class="card-text">${next[language].teaser}</span></a>`),
    el(`<ul class="links"><li><a href="${href("cerita")}">${t("all_stories")}</a></li></ul>`));
  // The stages lie on one sea (storySea), held under them while they pass.
  const scenes = el(`<div class="scenes${window.WebGL2RenderingContext ? " sea-on" : ""}"><div class="story-sea" aria-hidden="true"></div></div>`);
  scenes.append(...stages.map((s) => s.node));
  view.replaceChildren(cover, scenes, landing);
  rise(cover.querySelector("h1"));
  tickUp(cover.querySelector(".cover-key .key-number"));
  // Behind the cover, the night sea with the route of the story's own word (the first of the words it asks the
  // reader to check that is on the chart's first screen): to the right of the title on a wide screen, above it on a phone.
  shore(cover, { words: parts.flatMap((part) => part.check || []), count: 1, names: 8, open: (r) => {
    const text = cover.querySelector(innerWidth >= 900 ? ".cover-body" : ".cover-text").getBoundingClientRect();
    return innerWidth >= 900 ? [r.height * 0.1, r.width * 0.03, r.bottom - text.top + 16, r.width * 0.56] : [r.height * 0.03, 0, r.bottom - text.top + 8, 0];
  } });

  // Where the page stands when stage k shows step j: the stage stuck under the header, j beats down.
  const head = () => masthead.offsetHeight;
  const spot = (k, j) => scrollY + stages[k].node.getBoundingClientRect().top - head() + j * stages[k].node.querySelector(".beat").offsetHeight;
  const glide = (top) => scrollTo({ top, behavior: still() ? "instant" : "smooth" });
  let aim = null, asked = false, landed = null, sea = null, heardScene = null;
  // Step j of scene k, or past either end of the scene into the one before or after, the cover or the landing.
  function steer(k, j) {
    if (j < 0 && k === 0) return (aim = null), glide(0);
    if (j < 0) return steer(k - 1, stages[k - 1].steps - 1);
    if (j >= stages[k].steps && k === stages.length - 1) return (aim = null), glide(scrollY + landing.getBoundingClientRect().top - head());
    if (j >= stages[k].steps) return steer(k + 1, 0);
    aim = [k, j];
    glide(spot(k, j));
  }
  const frame = () => {
    asked = false;
    if (!landing.isConnected) return;
    // All that is measured is measured first; then the stages are told their step.
    const top = head(), rects = stages.map((s) => s.node.getBoundingClientRect()), beats = stages.map((s) => s.node.querySelector(".beat").offsetHeight);
    const middle = top + (innerHeight - top) / 2, height = innerHeight - top;
    stages.forEach((s, k) => (s.go(Math.max(0, Math.min(s.steps - 1, Math.round((top - rects[k].top) / beats[k])))), s.slide((top - rects[k].top) / beats[k])));
    // The step steered to is reached (also where the browser has no scrollend, as Safari before 26).
    if (aim && Math.abs(rects[aim[0]].top - top + aim[1] * beats[aim[0]]) < 2) aim = null;
    const seen = rects.findIndex((r) => r.top <= middle && r.bottom >= middle), shore = landing.getBoundingClientRect().top;
    // A new scene (going on, or back from the scene after or the landing) is heard as the larger gong of its cycle
    // (sound.js), and in the same frame the sea takes its stage (storySea).
    const entering = seen >= 0 && heardScene !== null && seen !== heardScene;
    if (seen >= 0) (last = seen), sea?.(seen, stages[seen].on(), entering);
    if (entering) hear("scene", seen, heardScene >= 0 ? seen < heardScene : !!landed);
    heardScene = seen;
    if (landed === false && shore < middle) hear("land");  // ashore
    landed = shore < middle;
    if (!rendering && !menuOpen()) marks.set(history.state?.id, seen >= 0 ? [seen, stages[seen].on()] : shore <= top ? [-1, top - shore] : null);
    const sailed = (top - rects[0].top) / (rects.at(-1).bottom - height - rects[0].top);
    masthead.style.setProperty("--voyage", Math.max(0, Math.min(1, sailed)).toFixed(4));
  };
  voyage = {
    ask: () => asked || ((asked = true), requestAnimationFrame(frame)),
    arrived: () => (aim = null),
    place: () => {
      const mark = marks.get(history.state?.id);
      return !mark ? null : mark[0] < 0 ? scrollY + landing.getBoundingClientRect().top - head() + mark[1] : spot(...mark);
    },
    key: (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || menuOpen() || !landing.isConnected) return;
      const forward = ["ArrowDown", "ArrowRight", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
      if (!forward && !["ArrowUp", "ArrowLeft", "PageUp", " "].includes(e.key)) return;
      if (e.target.closest?.("input, textarea, select, .masthead") || (e.key === " " && e.target.closest?.("button, a, summary"))) return;
      const caption = e.target.closest?.(".caption");
      if (caption && caption.scrollHeight > caption.clientHeight && e.key.startsWith("Arrow")) return;  // a long caption scrolls itself
      // Only while a stage holds the middle of the screen: elsewhere the keys scroll the page as they always do.
      const top = head(), middle = top + (innerHeight - top) / 2;
      const k = stages.findIndex((s) => { const r = s.node.getBoundingClientRect(); return r.top <= middle && r.bottom >= middle; });
      if (k < 0) return;
      e.preventDefault();
      const [from, j] = aim || [k, stages[k].on()];
      steer(from, j + (forward ? 1 : -1));
    },
  };
  cover.querySelector(".begin").addEventListener("click", () => (hear("open"), steer(0, 0), stages[0].stage.focus({ preventScroll: true })));
  if (scene && stages[+scene]) scrollTo(0, spot(+scene, Math.max(0, Math.min(stages[+scene].steps - 1, +step || 0))));
  frame();

  // The figures, each at the size of its stage, with the step each stage is on; then the sea under them.
  if (innerWidth < 900) stages.forEach((s, k) => share(s, parts[k]));
  else fit(stages);
  storySea(scenes.firstElementChild, stages, parts).then((to) => ((sea = to), frame()));
  await Promise.all(parts.map((part, k) => {
    const [w, h, zoom] = figureSize(stages[k].room);
    return awaited(stages[k].room, async () => {
      const made = await sceneFigure(part, w, stages[k].tall || h, stages[k].room);
      made.node.querySelectorAll(".plate svg").forEach((svg) => (svg.style.width = svg.width.baseVal.value * zoom + "px"));
      return Object.assign(made.node, { made });
    }, { shape: "plate", then: (node) => (stages[k].hold(node.made), frame()) });  // a strip that slides takes its place
  }));
}

/**
 * One figure of a story, framed for another site (an iframe): the plate of scene k at step j, its caption, the steps
 * to move through, and the way to the story itself. No header, no footer; it fills the frame it is given. Its
 * address names the story as its canonical address (address.js), and the generated page says so too.
 */
async function embedPage(slug, k = "0", j = "0") {
  document.documentElement.classList.add("embedded");
  view.classList.add("embed");
  const story = (await Promise.all([import("./story.js"), plating()]))[0].STORIES.find((s) => s.slug === slug), words = story[language];
  const part = story.scenes[+k] || story.scenes[(k = "0")], n = part.steps.length, open = (at) => whole(href("cerita", slug, String(k), String(at)));
  const box = el(`<article class="embed-box"><h1 class="embed-title"><a href="${open(0)}" target="_top">${words.title}</a></h1><div class="embed-figure"></div><div class="embed-caption" aria-live="polite"></div>
    <p class="embed-foot"><button type="button" class="step back" aria-label="${t("step_back")}">‹</button><span class="count"></span><button type="button" class="step on" aria-label="${t("step_on")}">›</button>
      <a class="embed-open" href="${open(0)}" target="_top">${t("embed_open")} →</a></p></article>`);
  view.replaceChildren(box);
  const room = box.querySelector(".embed-figure"), caption = box.querySelector(".embed-caption"), count = box.querySelector(".count"), link = box.querySelector(".embed-open");
  const width = Math.min(760, room.clientWidth), height = Math.max(240, innerHeight - box.offsetHeight - 120);
  let figure = null;
  const head = (at) => dash(part.steps[at - 1].head ?? part.steps[at - 1].mark ?? part.steps[at - 1].at);
  const go = (at) => {
    if (!figure) return;
    at = Math.max(0, Math.min(n, at));
    const step = part.steps[Math.max(0, at - 1)], i = figure.labels.indexOf(step.at);
    if (i >= 0) figure.show(i, at ? step.focus : undefined, step.mark);
    if (at !== +j) hear("step", at < +j, at ? beaconed(room) : [], at);
    caption.innerHTML = at ? `<p><b>${head(at)}.</b> ${part.steps[at - 1][language]}</p>` : `<p><b>${part[language].title}.</b> ${part[language].text || ""}</p>`;
    count.textContent = at ? `${at} / ${n}` : t("steps_n", n);
    link.href = open(at);
    box.querySelector(".back").disabled = !at;
    box.querySelector(".on").disabled = at === n;
    history.replaceState(history.state, "", href("cerita", slug, EMBED, String(k), String(at)));
    j = at;
  };
  if (WebAudio) box.querySelector(".embed-open").before(document.getElementById("sound").cloneNode(true));
  box.querySelector(".embed-foot .sound-toggle")?.removeAttribute("id");
  box.querySelector(".back").addEventListener("click", () => go(+j - 1));
  box.querySelector(".on").addEventListener("click", () => go(+j + 1));
  await awaited(room, () => sceneFigure(part, width, height).then((made) => ((figure = made), made.node)), { shape: "plate", then: () => go(+j || 0) });
}

/**
 * The first page. A hero on the deep: the chart of words at night, one route drawn once as the page arrives, the
 * headline, a field that sails any word, and words to try. Then, on the chart: three stories led by their key
 * numbers, the things to play with, and how it is all measured. The hero's text is on screen before any data.
 */
async function homePage() {
  const down = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
  // What a light and a route are, in two glyphs, beside the sea; the dive is signposted by the tide line it ends on.
  const key = `<div class="hero-key"><p><svg viewBox="0 0 28 22" width="28" height="22" aria-hidden="true"><path class="water" d="M3 19h22"/><path d="M14 9v10" stroke-dasharray="2 2"/><circle class="light" cx="14" cy="6" r="3.5"/></svg>${t("hero_key_light")}</p>
    <p><svg viewBox="0 0 28 22" width="28" height="22" aria-hidden="true"><path class="route" d="M3 16C9 4 17 18 25 7"/><circle class="port" cx="3" cy="16" r="2"/><circle class="port" cx="14" cy="11" r="2"/><circle class="port ship" cx="25" cy="7" r="3"/></svg>${t("hero_key_route")}</p></div>`;
  const glossed = (w) => (gloss(w) ? ` title="${escape(gloss(w))}" aria-label="${escape(`${w}: ${gloss(w)}`)}"` : "");
  const hero = el(`<section class="hero" aria-labelledby="hero-title"><div class="hero-track"><div class="hero-sea"><div class="chart night"></div>${key}</div></div>
    <div class="hero-text"><h1 id="hero-title">${t("title")}</h1><p class="hero-lede">${t("hero_lede")}</p><div class="hero-ask"></div>
      <div class="hero-try"><span id="hero-try">${t("hero_try")}</span><ul class="chips" aria-labelledby="hero-try">${SHOWCASE.map((w) => `<li><button type="button" aria-pressed="false"${glossed(w)}>${w}</button></li>`).join("")}</ul></div>
      <div class="hero-foot"><p class="hero-now" role="status"></p>${waiting() ? soundAsk() : ""}<button type="button" class="hero-down quiet">${TIDE_MARK}<span class="dive-cue">${t("hero_dive")}</span><span class="no-dive">${t("hero_down")}</span>${down}</button></div></div></section>`);
  const featured = el(`<section class="featured" aria-labelledby="featured-title"><p class="kicker">${t("featured_kicker")}</p><h2 id="featured-title">${t("featured_title")}</h2>
    ${storyCards(STORIES.slice(0, 3), true)}<p class="more"><a class="button" href="${href("cerita")}">${t("all_stories_n", STORIES.length)}</a></p></section>`);
  const play = el(`<section class="play-home" aria-labelledby="play-title"><p class="kicker">${t("nav_play")}</p><h2 id="play-title">${t("play_home_title")}</h2><p class="sub">${t("play_lede")}</p>
    <p class="more"><a class="button" href="${href("main")}">${t("all_play_n", PLAY.length)}</a></p></section>`);
  play.querySelector(".more").before(playTop());
  const measure = el(`<section class="measure" aria-labelledby="measure-title"><p class="kicker">${t("measure_kicker")}</p><h2 id="measure-title">${t("measure_title")}</h2>
    <div class="measure-cols">${["sources", "text", "tests"].map((k) => `<div class="measure-col" data-k="${k}"><h3>${t(`measure_${k}_title`)}</h3><p class="measure-number">&nbsp;</p><p class="measure-label">&nbsp;</p><div class="measure-more"></div></div>`).join("")}</div>
    <p class="more"><a href="${href("metode")}">${t("measure_more")}</a></p></section>`);
  view.classList.add("home");
  view.replaceChildren(hero, featured, play, measure);
  hero.querySelector(".hero-down").addEventListener("click", () => featured.scrollIntoView({ behavior: still() ? "instant" : "smooth" }));
  measured(measure);

  const gl = document.documentElement.classList.contains("dives") || still() ? import("./sea.js").catch(() => null) : null;
  // The whole lens (half a megabyte) is asked for once the first route has been drawn, or as soon as the reader
  // types or picks a word: reading it would otherwise hold up the frames of the route drawing itself.
  let wanted, figure = null, sailing = null, pending = null;
  const want = new Promise((done) => (wanted = done)), lens = want.then(() => lensNamed(MAIN));
  const now = hero.querySelector(".hero-now"), chips = [...hero.querySelectorAll(".hero-try button")];
  // A word sails: its route is framed in the open part of the hero, then the ship travels it, period by period.
  const sail = async (word) => {
    if (!figure?.node.isConnected) return void (pending = word);
    sailing = word;
    figure.chart.notes?.(null);  // the reader has moved on: the notes give way
    chips.forEach((b) => b.setAttribute("aria-pressed", b.textContent === word));
    if ((await figure.set([word], { most: 9 })) && sailing === word) (moor(word), go(word));
  };
  // The ship at its first port, and the word named under the field, with what it is where a reader may not know.
  const moor = (word) => {
    figure.chart.time(0, 0);
    now.innerHTML = `<span class="hidden">${t("sailing", escape(word))}</span><a href="${href("kata", word)}">${t("hero_open", escape(word))}</a>${gloss(word) ? `<span class="gloss">${escape(gloss(word))}</span>` : ""}`;
    figure.chart.describe?.(t("sea_label_route", escape(word)));
  };
  const go = (word, intro = false) => {
    if (!figure.node.isConnected || sailing !== word) return;
    figure.node.dataset.route = word;
    const last = figure.labels.length - 1;
    // The one motion on the site that nobody asked for: the first route, drawn once, in about two legs.
    if (intro) return figure.chart.time(last, still() ? 0 : 2 * LEG), hear("route", last + 1, still() ? 0 : 2 * LEG), setTimeout(wanted, still() ? 0 : 2 * LEG + 400);
    setTimeout(() => figure.node.isConnected && sailing === word && (figure.chart.time(last, still() ? 0 : 520 * last), hear("route", last + 1, still() ? 0 : 520 * last)), LEG);
  };
  hero.querySelector(".hero-ask").addEventListener("focusin", () => wanted());
  hero.querySelector(".hero-ask").append(suggest(lens, t("hero_ask"), t("hero_go"), async (word) => {
    const l = await lens;
    if (!l?.isEntry(l.index.get(word))) return visit(href("kata", word));
    sail(word);
  }));
  // On a phone the row of chips scrolls: its gap is set so that about 30px of the first chip it cannot show peek out
  // under its fade, a clear sign that it goes on.
  const row = hero.querySelector(".hero-try .chips"), peek = () => {
    row.style.gap = "";
    if (getComputedStyle(row).overflowX !== "auto") return;
    const w = [...row.children].map((li) => li.offsetWidth), room = row.getBoundingClientRect().right - row.firstElementChild.getBoundingClientRect().left;
    let best = null;
    for (let m = 1, sum = w[0]; m < w.length; sum += w[m++]) { const g = (room - 30 - sum) / m; if (g >= 4 && g <= 20 && (best === null || Math.abs(g - 8) < Math.abs(best - 8))) best = g; }
    if (best !== null) row.style.gap = best.toFixed(1) + "px";
  };
  document.fonts.ready.then(peek);
  addEventListener("resize", peek);
  hero.querySelector(".hero-try").addEventListener("click", (e) => e.target.matches("button") && (wanted(), sail(e.target.textContent)));

  // The 3D sea is fetched beside the data, and made only once the hero's text has been painted.
  const sea = (await Promise.all([gl, painted()]))[0]?.nightSea;
  // The arrival, once a session: the sea starts dark and its words come on as they arrive, the route last.
  const arriving = !!sea && !still() && !kept("sessionStorage", "arrived");
  figure = await chartFigure(MAIN, [], (word) => sail(word), null, { night: true, wait: want, sea, eager: arriving, over: () => hero.querySelectorAll(".hero-text > *, .hero-key"), host: hero }).catch(() => null);
  if (!hero.isConnected) return;
  const diving = !!figure?.chart.dive && document.documentElement.classList.contains("dives");
  if (!diving) document.documentElement.classList.remove("dives");  // no sea to dive into: the hero is one screen
  if (!figure) return hero.querySelector(".hero-sea").classList.add("failed");
  // The route is framed where the text is not: above it on a phone, to its right on a wide screen.
  const inset = () => {
    const box = hero.querySelector(".hero-sea").getBoundingClientRect(), text = hero.querySelector(".hero-text").getBoundingClientRect(), wide = innerWidth >= 900;
    figure.chart.inset(wide ? [box.height * 0.12, box.width * 0.04, box.height * 0.16, text.right - box.left] : [box.height * 0.08, 0, box.bottom - text.top - hero.querySelector("h1").offsetTop + 8, 0]);
  };
  inset();
  addEventListener("resize", inset);
  // The first route is laid out before the chart is shown, so that its islands are painted once, already framed
  // on the route; the ship sets out a frame after they are on screen.
  const first = pending || SHOWCASE[0];
  sailing = first;
  chips.forEach((b) => b.setAttribute("aria-pressed", b.textContent === first));
  const drawn = await figure.set([first], { ms: 0, most: 9 });
  if (!hero.isConnected) return;
  if (drawn) moor(first);
  hero.querySelector(".hero-sea .chart").replaceWith(figure.node);
  const lit = arriving && drawn && figure.chart.arrive?.((n) => t("tally", thousands(n)));
  if (lit) hear("arrive");
  await figure.chart.drawn();
  if (lit) {
    // Lit when the front has crossed the chart and the rest of the words are in (or have not come in time).
    await Promise.race([Promise.all([lit, figure.more]), new Promise((done) => setTimeout(done, 2600))]);
    figure.chart.tallied();
    kept("sessionStorage", "arrived", 1);
  } else if (!still()) await settled();  // the sea settles on screen, then the ship sets out
  if (drawn) go(first, !pending);
  // Once the first route has sailed, two notes say what a light's height and the route are.
  if (drawn && !pending) figure.chart.notes?.({ rise: t("note_rise"), route: (word, from, to) => t("note_route", word, from, to) });
  if (still() || figure.chart.hand) return;  // (the sea answers the hand itself: sea.js)
  // Depth: on the flat chart the far islands follow the pointer a little, and the tilt of a phone where the browser
  // gives it without asking.
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) return;  // not while the chart is being dragged
    const box = hero.getBoundingClientRect();
    figure.chart.tilt(((e.clientX - box.left) / box.width) * 2 - 1, ((e.clientY - box.top) / box.height) * 2 - 1);
  });
  hero.addEventListener("pointerleave", () => figure.chart.tilt(0, 0));
  if (diving && window.DeviceOrientationEvent && !DeviceOrientationEvent.requestPermission && matchMedia("(pointer: coarse)").matches) {
    let rest = null;
    const tilt = (e) => {
      if (!hero.isConnected) return removeEventListener("deviceorientation", tilt);
      if (e.gamma === null) return;
      rest ??= [e.gamma, e.beta];
      figure.chart.tilt(Math.max(-1, Math.min(1, (e.gamma - rest[0]) / 25)), Math.max(-1, Math.min(1, (e.beta - rest[1]) / 25)));
    };
    addEventListener("deviceorientation", tilt);
  }
  // The dive: scrolling out of the hero pitches the camera down until the sea is the paper of the page below. The
  // sea is held on screen (sticky) while the hero's last part scrolls past; the text gives way as it goes.
  let asked = false;
  const dive = () => {
    asked = false;
    if (!hero.isConnected) return removeEventListener("scroll", ask);
    const p = Math.max(0, Math.min(1, scrollY / Math.max(1, featured.offsetTop - hero.offsetTop - hero.querySelector(".hero-sea").offsetHeight)));
    hero.style.setProperty("--dive", p.toFixed(3));
    hero.classList.toggle("away", p > 0.3);
    figure.chart.dive(p);
    if (hearing) sounding?.dive(p);  // and the sea is heard from under the water
  };
  const ask = () => asked || ((asked = true), requestAnimationFrame(dive));
  const lift = () => (hero.isConnected ? scrollY < hero.offsetHeight + 200 && figure.chart.lift(scrollY) : removeEventListener("scroll", lift));
  addEventListener("scroll", diving ? ask : lift, { passive: true });
  if (diving) dive();
}


/** Resolves after the next paint: what is in the page now is on screen. */
const painted = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done)));

/** Resolves once the screen keeps up again: three frames in a row each under 25 ms, or after `most` ms. A new layer
 *  on screen costs a few slow frames (more on a slow phone); a motion started then would stutter. */
const settled = (most = 1500) => new Promise((done) => {
  let last = 0, calm = 0;
  const end = performance.now() + most, tick = (t) => {
    calm = last && t - last < 25 ? calm + 1 : 0;
    last = t;
    calm >= 3 || t > end ? done() : requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

/** The three columns of "how it is measured", made from the data itself once they come near the screen. */
function measured(section) {
  const cols = section.querySelector(".measure-cols");
  const fill = async () => {
    const names = await json("lenses.json"), own = names.filter((name) => !/-(tribun|okezone|kompas|tempo)$/.test(name)); // one publisher's lens is a part of the news
    const lenses = await Promise.all(own.map(lensNamed)), main = await lensNamed(MAIN);
    if (!lenses.every(Boolean) || !main) throw new Error("lenses");
    const years = lenses.flatMap((l) => l.periods.join(" ").match(/\d{4}/g).map(Number)), total = (l) => l.units.reduce((x, y) => x + y, 0);
    const amount = (n) => (n >= 1e6 ? `${number(n / 1e6, n >= 1e7 ? 0 : 1)} ${t("million")}` : thousands(n));
    const col = (k, big, label, more) => `<div class="measure-col" data-k="${k}"><h3>${t(`measure_${k}_title`)}</h3><p class="measure-number">${big}</p><p class="measure-label">${label}</p><div class="measure-more">${more}</div></div>`;
    return el(`<div>${col("sources", String(names.length), t("measure_sources", `${Math.min(...years)}–${Math.max(...years)}`), `<ul class="measure-list">${lenses.map((l) => `<li>${lensText(l).title}</li>`).join("")}</ul>`)}
      ${col("text", number(lenses.reduce((sum, l) => sum + total(l), 0) / 1e6, 0), t("measure_text"), `<ul class="measure-list">${[...lenses].sort((a, b) => total(b) - total(a)).map((l) => `<li><span>${lensText(l).title}</span><b>${amount(total(l))}</b></li>`).join("")}</ul>`)}
      ${main.sensitivity ? col("tests", percent(main.sensitivity.found["0.8"]), t("measure_tests", lensText(main).short), `<p>${t("measure_alarms", percent(main.sensitivity.false_alarms), percent(main.sensitivity.found["0.4"]))}</p>`) : ""}</div>`);
  };
  const seen = new IntersectionObserver((list) => list.some((e) => e.isIntersecting) && (seen.disconnect(), awaited(cols, () => fill().then((box) => { const f = document.createDocumentFragment(); f.append(...box.children); return f; }))), { rootMargin: "600px 0px" });
  seen.observe(section);
}

/** An address that leads nowhere: said plainly, on the deep, with the ways back. Behind it, where WebGL2 is there,
 *  the night sea held still, with no route on it: every word on the chart, and not this page. */
function lostPage() {
  const lost = el(`<section class="lost page-head shore"><div class="shore-sea">${GRATICULE}</div><p class="cover-kicker">${t("lost_kicker")}</p><h1>${t("lost_title")}</h1><p class="deck">${t("lost_lede")}</p>
    <p class="lost-ways"><a class="button primary" href="${href()}">${t("lost_home")}</a><a class="button" href="${href("cerita")}">${t("nav_stories")}</a><a class="button" href="${href("main")}">${t("nav_play")}</a><a class="button" href="${href("peta")}">${t("nav_chart")}</a></p>${tideLine()}</section>`);
  view.replaceChildren(lost);
  // The lights lie where the text is not: beside it on a wide screen, above it on a phone (shore's default).
  shore(lost, { names: 24, pitch: 0.5, look: { x: 0.2, z: 0.1, dist: 1.5, yaw: -0.35 } });
}

/** One screen about a name: when it peaked, its voyage, what the news had it doing, and who keeps company like it. */
async function portraitPage(word) {
  const lens = await lensNamed(MAIN), e = lens && (await entryOf(lens, word));
  if (!e) return wordPage(word);
  const peak = e.share.indexOf(Math.max(...e.share)), last = known(e).at(-1), path = await pathOf(lens, e.word);
  const said = async (lexicon) => ((await saidOf(lens, word, lexicon))?.findLast((list) => list.length) || []).slice(0, 8).map(([id]) => id);
  const [verbs, adjectives] = await Promise.all([said("verbs"), said("adjectives")]);
  view.replaceChildren(
    pageHead(escape(word), { kicker: t("portrait"), cls: "word-title", lede: t("peak_year", lens.periods[peak], percent(e.share[peak])), sea: wordSea(lens, word) }),
    frequencyChart(lens, [e], [peak]),
    el(`<div class="pair"><div><h3>${t("verbs")}</h3>${words(lens, verbs)}</div><div><h3>${t("adjectives")}</h3>${words(lens, adjectives)}</div></div>`),
    el(`<h3>${t("most_alike")} (${lens.periods[last]})</h3>`),
    el(words(lens, e.like[last])),
  );
  if (path?.path) view.append(el(`<h3>${t("path")}</h3>`), onDeep(played(pathFigure(lens, path, e))));
  view.append(el(`<p class="sub">${lensText(lens).title}. ${t("traits_about")}</p>`),
    el(`<ul class="links"><li><a href="${href("lingkaran", word)}">${t("play_lingkaran")}</a></li><li><a href="${href("redaksi", word)}">${t("play_redaksi")}</a></li></ul>`), tools(href("potret", word), { check: [word] }));
}

/** A game's voyage, one port per round: answered right (filled in the route's colour), wrong (a ring), the round on
 *  now (the ship) and those to come (small dots); under each answered port, its answer. With `inline`, its colours
 *  are written into it, so that it can be saved as an image (plate.js reads no stylesheet). */
function voyageMark(results, rounds, { inline = false, width = 300 } = {}) {
  const W = width, H = 92, x = (k) => 16 + ((W - 32) * k) / Math.max(1, rounds - 1), y = (k) => 38 + 10 * Math.sin(k * 1.3);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), c = (name, attr) => (inline ? ` ${attr}="${css(name)}"` : "");
  const path = [...Array(rounds)].map((_, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(k).toFixed(1)}`).join("");
  const done = results.length, sailed = [...Array(Math.max(1, done))].map((_, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(k).toFixed(1)}`).join("");
  return `<svg class="voyage-mark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <path class="sea-line" d="${path}" fill="none" stroke-dasharray="2 4"${c("--line-2", "stroke")}/>${done > 1 ? `<path class="sailed" d="${sailed}" fill="none" stroke-width="3" stroke-linecap="round"${c("--route", "stroke")}/>` : ""}
    ${[...Array(rounds)].map((_, k) => {
      const r = results[k], cls = !r ? (k === done ? "now" : "next") : r.ok ? "right" : "wrong";
      const fill = { right: c("--route", "fill"), wrong: c("--chart-2", "fill"), now: c("--ink", "fill"), next: c("--line-2", "fill") }[cls], stroke = cls === "wrong" ? c("--ink", "stroke") : "";
      return `<circle class="${cls}" cx="${x(k).toFixed(1)}" cy="${y(k).toFixed(1)}" r="${{ right: 7, wrong: 6, now: 8, next: 3.5 }[cls]}"${fill}${stroke}${cls === "wrong" ? ' stroke-width="2"' : ""}/>
        ${r ? `<text x="${x(k).toFixed(1)}" y="${(y(k) + 26).toFixed(1)}" text-anchor="middle" style="font-size:11px;font-weight:700"${c(r.ok ? "--ink" : "--ink-3", "fill")}>${escape(String(r.label))}</text>` : ""}`;
    }).join("")}</svg>`;
}

/** A finished game as a plate to save and share: its score as the title, its voyage, the site's name. */
function scorePlate(title, results, rounds, width = 640) {
  // Drawn at the width it is shown at (at most 640px), so that its text keeps its size on a phone: the title on two
  // lines (at its colon) where one would not fit, never under 13px.
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), W = Math.max(280, Math.min(640, Math.floor(width)));
  const font = (size) => `800 ${size}px ${css("--type")}`, cut = title.indexOf(": ") + 1;
  const lines = measure(title, font(24)) <= W - 32 || cut < 1 ? [title] : [title.slice(0, cut), title.slice(cut + 1)];
  const size = Math.max(13, Math.min(24, ...lines.map((l) => (24 * (W - 32)) / measure(l, font(24))))), top = 14 + size * 1.2 * lines.length, H = top + 158;
  return el(`<div class="plate"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escape(title)}" style="font-family:${css("--type").replace(/"/g, "'")}">
    <rect width="${W}" height="${H}" fill="${css("--paper")}"/>${lines.map((l, i) => `<text x="16" y="${(14 + size * (1 + 1.2 * i)).toFixed(1)}" style="font-size:${size.toFixed(1)}px;font-weight:800;fill:${css("--ink")}">${escape(l)}</text>`).join("")}
    <g transform="translate(10 ${(top + 10).toFixed(1)})">${voyageMark(results, rounds, { inline: true, width: W - 20 }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
    <text x="16" y="${H - 14}" style="font-size:12px;font-weight:700;fill:${css("--ink")}">Jejak Kata · zidan.dev/jejak-kata</text></svg></div>`);
}

/** Two games: name the year from its own words; name the person or institution from its verbs and adjectives. Each a
 *  board: the round on paper, and beside it the game's voyage so far; at the end, the score as a plate to save. */
async function quizPage() {
  const lens = await lensNamed(MAIN), { peaks } = await highlights(lens), ROUNDS = 8;
  const pick = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
  const names = ["jokowi", "prabowo", "ahok", "anies baswedan", "megawati", "sby", "ganjar pranowo", "sri mulyani", "luhut", "ridwan kamil", "kpk", "polri", "dpr", "mahfud md", "erick thohir", "setya novanto"].filter((w) => lens.isEntry(lens.index.get(w)));
  const games = {
    year: async () => {
      const p = pick(lens.periods.map((_, i) => i).filter((i) => peaks[i].length >= 8), 1)[0];
      return { ask: t("quiz_year_ask"), clue: words(lens, peaks[p].slice(0, 10).map((w) => w), null, "").replace(/<a [^>]*>|<\/a>/g, ""),
        answer: lens.periods[p], choices: pick([lens.periods[p], ...pick(lens.periods.filter((x, i) => Math.abs(i - p) > 1), 3)], 4).sort() };
    },
    who: async () => {
      for (;;) {
        const name = pick(names, 1)[0], verbs = await saidOf(lens, name, "verbs"), adjectives = await saidOf(lens, name, "adjectives");
        const periods = (verbs || []).map((list, i) => (list.length >= 5 ? i : -1)).filter((i) => i >= 0);
        if (!periods.length) continue;
        const p = pick(periods, 1)[0], ids = [...verbs[p].slice(0, 7), ...(adjectives?.[p] || []).slice(0, 4)].map(([id]) => id);
        return { ask: t("quiz_who_ask", lens.periods[p]), clue: words(lens, ids, null, "").replace(/<a [^>]*>|<\/a>/g, ""), answer: name, choices: pick([name, ...pick(names.filter((n) => n !== name), 3)], 4) };
      }
    },
  };
  view.replaceChildren(pageHead(t("nav_quiz"), { ...fromPlay(), lede: t("quiz_lede"), sea: { words: names } }));
  const play = (kind, label) => {
    const board = el(`<div class="quiz-board"><div class="quiz quiz-card"></div><aside class="quiz-log"><h3>${t("quiz_log")}</h3><div class="quiz-voyage"></div><p class="quiz-tally"></p></aside></div>`);
    const box = board.querySelector(".quiz"), log = board.querySelector(".quiz-voyage"), tally = board.querySelector(".quiz-tally");
    let results = [];
    const sailed = () => ((log.innerHTML = voyageMark(results, ROUNDS)), (tally.textContent = t("quiz_tally", results.filter((r) => r.ok).length, results.length)));
    const next = async () => {
      sailed();
      if (results.length === ROUNDS) {
        const right = results.filter((r) => r.ok).length, plate = scorePlate(t("quiz_plate", label, right, ROUNDS), results, ROUNDS, box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft));
        box.innerHTML = `<p class="score">${t("quiz_score", right, ROUNDS)}</p>`;
        const again = el(`<button type="button" class="primary">${t("quiz_again")}</button>`), share = el(`<button type="button">${t("copy_link")}</button>`), row = el(`<p class="controls"></p>`);
        const save = el(`<button type="button">${t("quiz_save")}</button>`);
        again.addEventListener("click", () => ((results = []), next()));
        share.addEventListener("click", async () => {
          await navigator.clipboard?.writeText(`${t("quiz_share", right, ROUNDS)} ${whole(href("kuis"))}`);
          share.textContent = t("copied");
        });
        save.addEventListener("click", async () => (await plating(), savePlate(box, "jejak-kata-kuis")));
        row.append(again, save, share);
        return box.append(plate, row);
      }
      const q = await games[kind]();
      box.innerHTML = `<p class="step">${results.length + 1} / ${ROUNDS}</p><p class="ask">${q.ask}</p>${q.clue}<p class="choices">${q.choices.map((c) => `<button type="button">${c}</button>`).join("")}</p><p class="verdict" role="status"></p>`;
      box.querySelectorAll(".choices button").forEach((b) =>
        b.addEventListener("click", () => {
          const ok = b.textContent === q.answer;
          hear(ok ? "right" : "wrong");
          results.push({ ok, label: kind === "year" ? q.answer : q.answer.split(" ")[0] });
          sailed();
          box.querySelectorAll(".choices button").forEach((x) => ((x.disabled = true), x.classList.toggle("right", x.textContent === q.answer), x.classList.toggle("chosen", x === b && !ok)));
          box.querySelector(".verdict").innerHTML = `<span>${ok ? t("quiz_right") : t("quiz_wrong", q.answer)}</span> <button type="button" class="primary">${t("quiz_next")}</button>`;
          box.querySelector(".verdict button").addEventListener("click", next);
        }),
      );
    };
    next();
    return board;
  };
  view.append(switcher([t("quiz_year"), t("quiz_who")], (i) => play(i ? "who" : "year", t(i ? "quiz_who" : "quiz_year"))));
}

/** How it works, and what the planted-change test found each lens can see. */
/** A row of buttons of which one is pressed; pressing another goes to `to(i)`. */
const choice = (labels, on, to) => `<ul class="chips">${labels.map((label, i) => `<li><a role="button" aria-pressed="${i === +on}" href="${to(i)}">${label}</a></li>`).join("")}</ul>`;
const stickOf = (k) => json(`${OUTLETS[+k] || OUTLETS[0]}/stick.json`);
const STUCK_PAGES = 300; // a name is ranked in a period only with this many pages naming it

/** Which names a word sticks to: of the pages naming each, the share that also hold the word. */
async function stuckPage(word = "tersangka", k = "0", era = "2", kind = "p") {
  await plating();
  const s = await stickOf(k), share = s.share[word] || s.share[(word = s.words[0])], p = +era;
  const ranked = s.names.map((_, i) => i).filter((i) => s.kinds[i] === kind && s.pages[i][p] >= STUCK_PAGES && share[i][p] !== null).sort((a, b) => share[b][p] - share[a][p]);
  const to = (w, a, b, c) => href("menempel", w, String(a), String(b), c);
  const figure = strip({ title: t("stuck_plate", word, OUTLET[+k], ERAS_SHOWN[p]), note: t("stuck_note", STUCK_PAGES), states: ERAS_SHOWN, series: [OUTLET[+k]],
    rows: ranked.slice(0, innerWidth > 760 ? 16 : 12).map((i) => ({ label: s.names[i], values: ERAS_SHOWN.map((_, q) => [share[i][q] === null ? null : share[i][q] / 1000]) })) }, Math.min(room(), 720), innerWidth > 760 ? 520 : 440);
  figure.show(p);
  const box = el(`<section></section>`);
  box.append(figure.node, tools(to(word, k, era, kind), { image: box, table: figure.table, data: `${OUTLETS[+k]}/stick.json` }));
  const pick = el(`<p class="controls"><label>${t("stuck_word")} <select>${s.words.map((w) => `<option${w === word ? " selected" : ""}>${w}</option>`).join("")}</select></label></p>`);
  pick.querySelector("select").addEventListener("change", (e) => visit(to(e.target.value, k, era, kind)));
  view.replaceChildren(pageHead(t("play_menempel"), { ...fromPlay(), lede: t("stuck_lede"), sea: { words: [word, ...ranked.map((i) => s.names[i])] } }), pick,
    el(choice(OUTLET, k, (i) => to(word, i, era, kind))), el(choice(ERAS_SHOWN, era, (i) => to(word, k, i, kind))), el(choice([t("people"), t("organisations")], kind === "p" ? 0 : 1, (i) => to(word, k, era, "po"[i]))),
    box, el(`<p class="note">${t("stuck_warning")}</p>`),
    el(`<div class="table" tabindex="0"><table><tr><th>${t("name")}</th><th class="n">${t("stuck_share", word)}</th><th class="n">${t("pages")}</th><th></th></tr>${ranked.slice(0, 40).map((i) =>
      `<tr><td>${link(s.names[i])}</td><td class="n">${number(share[i][p] / 10)}%</td><td class="n">${thousands(s.pages[i][p])}</td><td><a href="${href("redaksi", s.names[i])}">${t("three_rooms")}</a></td></tr>`).join("")}</table></div>`));
}

/** Tide table: a row per name, a column per year; each row is shaded against its own best year, rows in order of that year. */
async function tidePage(k = "0", kind = "person") {
  const y = await json("years.json"), lens = OUTLETS[+k] || OUTLETS[0];
  const rows = y.tide[lens][kind].map((r) => ({ ...r, peak: Math.max(...r.share.map((v) => v || 0)) })).map((r) => ({ ...r, when: r.share.indexOf(r.peak) })).sort((a, b) => a.when - b.when || b.peak - a.peak);
  const kinds = ["person", "organisation", "place"], level = (v, peak) => [0.08, 0.25, 0.45, 0.65, 0.85].filter((s) => v / peak >= s).length;
  const table = el(`<div class="tide" tabindex="0"><table><tr><th></th>${y.years.map((year) => `<th>${String(year).slice(2)}</th>`).join("")}</tr>${rows.map((r) =>
    `<tr><th><a href="${href("potret", r.word)}">${r.word}</a></th>${r.share.map((v, i) => `<td style="--i:${i}" class="t${v === null ? "x" : level(v, r.peak)}" data-tip="${r.word} ${y.years[i]}: ${v === null ? "–" : number(v * 1000) + "‰"} ${t("of_pages", thousands(y.pages[lens][i]))}"></td>`).join("")}</tr>`).join("")}</table></div>`);
  table.addEventListener("pointermove", (e) => tip(e.target.dataset?.tip || null, e));
  table.addEventListener("pointerleave", () => tip(null));
  view.replaceChildren(pageHead(t("play_pasang"), { ...fromPlay(), lede: t("tide_lede"), sea: { words: rows.map((r) => r.word).reverse() } }),
    el(choice(OUTLET, k, (i) => href("pasang", String(i), kind))), el(choice([t("people"), t("organisations"), t("places")], kinds.indexOf(kind), (i) => href("pasang", k, kinds[i]))),
    el(`<p class="legend"><span>${t("tide_legend")}</span>${[0, 1, 2, 3, 4, 5].map((i) => `<span><i class="t${i}"></i></span>`).join("")}</p>`), table,
    el(`<p class="note">${t("tide_note", OUTLET[+k], thousands(Math.min(...y.pages[lens])), thousands(Math.max(...y.pages[lens])))}</p>`), tools(href("pasang", k, kind), { data: "years.json" }));
}

/** One name in three newsrooms: the words on which they differ most, period by period. */
async function roomsPage(name = "pdip") {
  await plating();
  const all = await Promise.all(OUTLETS.map((_, k) => stickOf(k))), at = all.map((s) => s.names.indexOf(name));
  const words = all[0].words.filter((w) => all.every((s) => s.share[w]));
  const value = (w, k, p) => (at[k] < 0 || all[k].share[w][at[k]][p] === null ? null : all[k].share[w][at[k]][p] / 1000);
  const spread = (w) => {
    const last = OUTLETS.map((_, k) => value(w, k, 2)).filter((v) => v !== null);
    return last.length < 2 ? -1 : Math.max(...last) - Math.min(...last);
  };
  const rows = words.filter((w) => spread(w) >= 0).sort((a, b) => spread(b) - spread(a)).slice(0, 12);
  const names = [...new Set(all.flatMap((s) => s.names))].sort();
  const form = el(`<form class="controls"><input type="search" list="names" placeholder="${t("rooms_ask")}" aria-label="${t("rooms_ask")}"><datalist id="names">${names.map((n) => `<option>${n}</option>`).join("")}</datalist><button class="primary">${t("show")}</button></form>`);
  form.addEventListener("submit", (e) => (e.preventDefault(), names.includes(form.firstElementChild.value.trim().toLowerCase()) && visit(href("redaksi", form.firstElementChild.value.trim().toLowerCase()))));
  view.replaceChildren(pageHead(t("play_redaksi"), { ...fromPlay(), lede: t("rooms_lede"), sea: { words: [name, ...rows] } }), form);
  if (!rows.length) return view.append(el(`<p>${t("rooms_none", escape(name))}</p>`));
  const figure = strip({ title: t("rooms_plate", name), states: ERAS_SHOWN, series: OUTLET, rows: rows.map((w) => ({ label: w, values: ERAS_SHOWN.map((_, p) => OUTLETS.map((_, k) => value(w, k, p))) })),
    pages: (p) => t("pages_stuck", name, ERAS_SHOWN[p], OUTLET.map((o, k) => `${o} ${at[k] < 0 ? "–" : thousands(all[k].pages[at[k]][p])}`).join(", ")) }, Math.min(room(), 720), 440);
  const box = el(`<section></section>`);
  box.append(played(figure), tools(href("redaksi", name), { image: box, table: figure.table, check: [name], data: `${OUTLETS[0]}/stick.json` }));
  view.append(box, el(`<p class="note">${t("rooms_note")}</p>`));
}

/** Who shares a page with a name: a circle that rearranges itself from period to period. */
async function circlePage(name = "prabowo", k = "0") {
  const s = await stickOf(k), i = s.names.indexOf(name), names = s.names.filter((_, j) => s.kinds[j] === "p" && s.beside[j].some((list) => list.length));
  const form = el(`<form class="controls"><input type="search" list="names" placeholder="${t("circle_ask")}" aria-label="${t("circle_ask")}"><datalist id="names">${names.map((n) => `<option>${n}</option>`).join("")}</datalist><button class="primary">${t("show")}</button></form>`);
  form.addEventListener("submit", (e) => (e.preventDefault(), s.names.includes(form.firstElementChild.value.trim().toLowerCase()) && visit(href("lingkaran", form.firstElementChild.value.trim().toLowerCase(), k))));
  view.replaceChildren(pageHead(t("play_lingkaran"), { ...fromPlay(), lede: t("circle_lede"), sea: { words: [name, ...(i < 0 ? [] : s.beside[i].flat().map(([j]) => s.names[j]))] } }), form, el(choice(OUTLET, k, (j) => href("lingkaran", name, String(j)))));
  if (i < 0) return view.append(el(`<p>${t("rooms_none", escape(name))}</p>`));
  const figure = circle(s, i);
  view.append(played(figure), el(`<p class="note">${t("circle_note", name, ERAS_SHOWN.map((era, p) => `${era}: ${thousands(s.pages[i][p])}`).join("; "))}</p>`),
    tools(href("lingkaran", name, k), { check: [name], data: `${OUTLETS[+k]}/stick.json` }));
}

/** Guess the number: of 100 pages naming someone, how many also hold a word. Six rounds, then a score to share. */
async function guessPage() {
  const s = await stickOf(0), pool = [], ROUNDS = 6;
  s.names.forEach((name, i) => {
    if (s.pages[i][2] < 1500 || s.kinds[i] !== "p") return;
    for (const w of GUESS_WORDS) if (s.share[w]?.[i][2] >= 40) pool.push({ name, w, v: Math.round(s.share[w][i][2] / 10), pages: s.pages[i][2] });
  });
  const rounds = [];
  while (rounds.length < ROUNDS && pool.length) {
    const [q] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    if (!rounds.some((r) => r.name === q.name || r.w === q.w)) rounds.push(q);
  }
  // The round on paper; beside it the game's voyage: a port per round, filled where the guess came within ten.
  const board = el(`<div class="quiz-board"><section class="quiz quiz-card"></section><aside class="quiz-log"><h3>${t("quiz_log")}</h3><div class="quiz-voyage"></div><p class="quiz-tally"></p></aside></div>`);
  const box = board.querySelector(".quiz"), results = [], sailed = () => ((board.querySelector(".quiz-voyage").innerHTML = voyageMark(results, rounds.length)), (board.querySelector(".quiz-tally").textContent = `${score} / ${rounds.length * 100}`));
  view.replaceChildren(pageHead(t("play_tebak"), { ...fromPlay(), lede: t("guess_lede"), sea: { words: GUESS_WORDS } }), board);
  let score = 0;
  const ask = (k) => {
    sailed();
    if (k === rounds.length) {
      const said = t("guess_share", score, rounds.length * 100, whole(href("tebak")));
      box.replaceChildren(el(`<p class="score">${score} / ${rounds.length * 100}</p>`), el(`<p>${t("guess_done")}</p>`), scorePlate(`${t("play_tebak")}: ${score} / ${rounds.length * 100}`, results, rounds.length, box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft)),
        el(`<p class="controls"><button type="button">${t("copy_score")}</button><button type="button">${t("quiz_save")}</button><a role="button" class="primary" href="${href("tebak")}">${t("again")}</a></p>`));
      const [copy, save] = box.querySelectorAll(".controls button");
      copy.addEventListener("click", async (e) => (await navigator.clipboard?.writeText(said), (e.target.textContent = t("copied"))));
      save.addEventListener("click", async () => (await plating(), savePlate(box, "jejak-kata-tebak")));
      box.querySelector("a").addEventListener("click", (e) => (e.preventDefault(), guessPage()));
      return;
    }
    const q = rounds[k];
    box.replaceChildren(el(`<p class="step">${k + 1} / ${rounds.length}</p>`), el(`<p class="ask">${t("guess_ask", q.name, q.w)}</p>`),
      el(`<div class="gauge"><input type="range" min="0" max="100" value="50" aria-label="${t("guess_yours")}"><div class="scale"><i class="yours"></i><i class="truth" hidden></i></div><output>50</output></div>`),
      el(`<p class="controls"><button type="button" class="primary">${t("guess_lock")}</button></p>`), el(`<p class="verdict" hidden></p>`));
    const [slider, scale, output] = box.querySelector(".gauge").children, [yours, truth] = scale.children, verdict = box.querySelector(".verdict"), button = box.querySelector(".controls button");
    const move = () => ((output.textContent = slider.value), (yours.style.transform = `translateX(${slider.value * (scale.clientWidth / 100)}px)`));
    slider.addEventListener("input", move);
    requestAnimationFrame(move);
    button.addEventListener("click", () => {
      if (slider.disabled) return ask(k + 1);
      slider.disabled = true;
      const won = Math.max(0, 100 - 4 * Math.abs(q.v - slider.value));
      score += won;
      results.push({ ok: Math.abs(q.v - slider.value) <= 10, label: `+${won}` });
      sailed();
      truth.hidden = false;
      truth.style.transform = `translateX(${q.v * (scale.clientWidth / 100)}px)`;
      verdict.hidden = false;
      verdict.innerHTML = t("guess_truth", q.v, thousands(q.pages), q.name, q.w, won) + ` <a href="${href("menempel", q.w, "0", "2", "p")}">${t("guess_more", q.w)}</a>`;
      button.textContent = k + 1 === rounds.length ? t("guess_score") : t("next");
    });
  };
  ask(0);
}

/** The things to play with, each led by a picture of its own figure: the first leads, on the deep, its picture large;
 *  the next two beside it; the rest under "more", two of them wide. */
async function playPage() {
  view.replaceChildren(pageHead(t("nav_play"), { kicker: t("play_kicker", PLAY.length), lede: t("play_lede"), sea: { words: QUIZ_NAMES, count: 4 } }), playTop(),
    el(`<h2 class="cards-head">${t("play_more")}</h2>`), pictured(el(`<ul class="cards doors play-cards play-more">${PLAY.slice(3).map((page) => playCard(page)).join("")}</ul>`)));
}

/** The method on one word the first page sails (`jokowi`, from its third year to its fourth: from governor to
 *  president), in four steps, every number read from the data of the first page's lens: the year's pages (meta.json,
 *  units), the share of them that hold the word and the words it appears with most (words/, share and with), its port
 *  on the chart and the ports of those words the first screen has (paths/, route; first.json), and a year on its new
 *  company, its new port and the shift between the two years (words/, shift). Stepped by its controls or played
 *  once through; with reduced motion each step is a cut. */
const DEMO = ["jokowi", 2, 3];
async function methodDemo() {
  const [word, a, b] = DEMO, lens = await lensNamed(MAIN), first = await json(`${MAIN}/first.json`), i = lens?.index.get(word);
  const [e, path] = lens ? await Promise.all([entry(lens, i), pathOf(lens, i)]) : [];
  if (!e || !path?.route[a] || !path.route[b]) return el("<div></div>");
  const company = (p) => e.with[p].slice(0, 3).map((j) => lens.words[j]), list = (words) => new Intl.ListFormat(language).format(words.map((w) => `“${w}”`));
  const port = (w) => { const k = first.names.indexOf(w); return k < 0 ? null : [first.x[k], first.y[k]]; };
  const shift = e.shift[pairIndex(lens, a, b)], [ya, yb] = [lens.periods[a], lens.periods[b]];
  const said = [t("demo_1", ya, thousands(lens.units[a]), word, percent(e.share[a])), t("demo_2", word, list(company(a))), t("demo_3", word, ya),
    t("demo_4", word, yb, list(company(b)), shift === null ? "–" : number(shift), shift >= lens.flag)];
  // The page on the left (beside the chart from 640px, above it on a phone), the chart fitted to the ports it shows.
  const W = Math.min(room(), 1120), wide = W >= 640, H = wide ? 270 : 430, top = wide ? 0 : 220, left = wide ? Math.round(W * 0.38) : 0, cw = W - left, ch = H - top;
  const words = [...new Set([...company(a), ...company(b)])].map((w) => ({ w, at: port(w), from: company(a).includes(w) ? 3 : 4 })).filter((x) => x.at);
  const all = [path.route[a], path.route[b], ...words.map((x) => x.at)], xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 120), mid = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2];
  const scale = Math.min(cw - 40, ch - 40) / span, X = (p) => left + cw / 2 + (p[0] - mid[0]) * scale, Y = (p) => top + ch / 2 + (p[1] - mid[1]) * scale;
  // (the chart's own graticule, a line every 125 units, where it falls in the panel)
  const grid = [...Array(17)].map((_, k) => (k - 8) * 125).flatMap((v) => [[X([v, 0]), `M${X([v, 0]).toFixed(1)} ${top}V${H}`, left, W], [Y([0, v]), `M${left} ${Y([0, v]).toFixed(1)}H${W}`, top, H]])
    .filter(([at, , lo, hi]) => at > lo && at < hi).map(([, d]) => `<path class="demo-grid" d="${d}"/>`).join("");
  const [pa, pb] = [path.route[a], path.route[b]].map((p) => [X(p), Y(p)]);
  // Names on the chart are placed on one board (labels.js): the word first, then its company; one with no room is left out.
  const B = board([left + 4, top + 4, W - 4, H - 4]), font = `600 13px ${getComputedStyle(document.documentElement).getPropertyValue("--type")}`;
  const name = (p, text, cls, from, strong) => {
    const w = measure(text, strong ? font.replace("600", "800") : font) + 6, k = B.place([[p[0] + 10, p[1] - 9], [p[0] - 10 - w, p[1] - 9], [p[0] - w / 2, p[1] - 30], [p[0] - w / 2, p[1] + 12]].map(([x, y]) => [x, y, x + w, y + 18]), text);
    return k ? `<text class="${cls}" data-from="${from}" x="${(k[0] + 3).toFixed(1)}" y="${(k[1] + 13).toFixed(1)}">${escape(text)}</text>` : "";
  };
  B.reserve([pa[0] - 9, pa[1] - 9, pa[0] + 9, pa[1] + 9], [pb[0] - 9, pb[1] - 9, pb[0] + 9, pb[1] + 9]);
  const names = [name(pa, `${word} ${ya}`, "demo-word", 3, true), name(pb, `${word} ${yb}`, "demo-word", 4, true), ...words.map((x) => name([X(x.at), Y(x.at)], x.w, "demo-near", x.from))];
  const lines = [0, 1, 2, 3, 4, 5, 6].map((k) => `<path class="demo-line${k === 2 ? " on" : ""}" d="M14 ${30 + k * 15}H${k === 2 ? 66 : 14 + 52 + ((k * 23) % 30)}"/>`).join("");
  const textX = 120;
  const svg = `<svg class="demo-figure" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escape(said.join(" "))}">
    <g data-from="1"><rect class="demo-page" x="0" y="10" width="96" height="128" rx="6"/>${lines}
      <text class="demo-big" x="${textX}" y="52">${thousands(lens.units[a])}</text><text class="demo-small" x="${textX}" y="72">${t("demo_pages")} · Kompas ${ya}</text>
      <text class="demo-big on" x="${textX}" y="116">${percent(e.share[a])}</text><text class="demo-small" x="${textX}" y="136">${escape(t("demo_hold", word))}</text></g>
    <g data-from="2">${company(a).map((w, k) => `<path class="demo-tie" d="M66 ${60}C${wide ? 80 : 90} ${60} ${wide ? 60 : 70} ${164 + k * 18} 96 ${160 + k * 18}"/><text class="demo-near" x="104" y="${164 + k * 18}">${escape(w)}</text>`).join("")}</g>
    <g data-from="3">${grid}</g>
    ${words.map((x) => `<circle class="demo-dot" data-from="${x.from}" cx="${X(x.at).toFixed(1)}" cy="${Y(x.at).toFixed(1)}" r="4"/>`).join("")}
    <path class="demo-trail" data-from="4" pathLength="1" d="M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}"/>
    <circle class="demo-ship" data-from="3" r="7" cx="0" cy="0" style="transform:translate(${pa[0].toFixed(1)}px,${pa[1].toFixed(1)}px)" data-a="${pa.map((v) => v.toFixed(1))}" data-b="${pb.map((v) => v.toFixed(1))}"/>
    ${names.join("")}</svg>`;
  const box = el(`<figure class="method-demo"><figcaption class="demo-title">${escape(t("demo_title", word, ya, yb))}</figcaption>${svg}
    <p class="demo-said" aria-live="polite"></p><div class="demo-controls"><button type="button" class="demo-play">${t("demo_play")}</button>
    <ol class="demo-steps">${t("demo_steps").map((s, k) => `<li><button type="button" data-step="${k + 1}">${k + 1}. ${s}</button></li>`).join("")}</ol></div>
    <p class="demo-source">${t("demo_source")}</p></figure>`);
  const ship = box.querySelector(".demo-ship");
  let at = 0, playing = 0;
  const show = (n) => {
    at = n;
    box.querySelectorAll("[data-from]").forEach((x) => x.classList.toggle("shown", +x.dataset.from <= n));
    box.querySelectorAll(".demo-steps button").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.step === n));
    const [x, y] = ship.dataset[n >= 4 ? "b" : "a"].split(",");
    ship.style.transform = `translate(${x}px,${y}px)`;
    box.querySelector(".demo-said").textContent = said[n - 1];
  };
  box.querySelectorAll(".demo-steps button").forEach((x) => x.addEventListener("click", () => (clearInterval(playing), show(+x.dataset.step))));
  box.querySelector(".demo-play").addEventListener("click", () => {
    clearInterval(playing);
    show(1);
    playing = setInterval(() => (at < 4 && box.isConnected ? show(at + 1) : clearInterval(playing)), BEAT * 1.6);
  });
  show(1);
  return box;
}

async function methodPage() {
  view.replaceChildren(pageHead(t("method_title"), { kicker: t("method_kicker"), lede: t("method_lede"), sea: { look: { dist: 1.9, x: 0.02, z: 0.06 }, pitch: 1.2, names: 24 } }), el(`<div class="method-body"><article class="prose">${t("method")}</article><aside class="caveats">${t("caveats")}</aside></div>`));
  const demo = el(`<div class="demo-holder"></div>`);
  view.querySelector(".method-body").before(demo);
  awaited(demo, methodDemo);
  const tested = (await allLenses()).filter((lens) => lens.sensitivity);
  const found = (lens, share) => percent(lens.sensitivity.found[share]);
  view.append(
    el(`<h2>${t("tests_title")}</h2>`),
    el(`<p class="sub">${t("tests_about")}</p>`),
    el(`<div class="table" tabindex="0"><table><tr><th>${t("lens")}</th><th class="n">${t("units")}</th><th class="n">20%</th><th class="n">40%</th><th class="n">80%</th><th class="n">${t("false_alarms")}</th></tr>
      ${tested.map((lens) => `<tr><td>${lensText(lens).title}</td><td class="n">${lens.units.reduce((x, y) => x + y).toLocaleString(language)}</td>
        ${["0.2", "0.4", "0.8"].map((share) => `<td class="n">${found(lens, share)}</td>`).join("")}<td class="n">${percent(lens.sensitivity.false_alarms)}</td></tr>`).join("")}
    </table></div>`),
  );
}

// ---- shell ----------------------------------------------------------------

// Each entry of the browser's history gets a number, and the place the reader had scrolled to is kept with it:
// coming back to an entry, or changing the language, returns to that place; a new entry starts at the top.
history.scrollRestoration = "manual";
const places = new Map();
let rendering = false, first = true;
addEventListener("scroll", () => rendering || menuOpen() || places.set(history.state?.id, scrollY), { passive: true });
/** On a phone the footer's data and licence are folded (a line each, opened by a tap); from 900px they stand open. */
const foldFoot = () => document.querySelectorAll(".foot-fold").forEach((d) => (d.open = matchMedia("(min-width: 900px)").matches));
matchMedia("(min-width: 900px)").addEventListener("change", foldFoot);
/** The header stays on screen at every width; a story's stage is held just below it, at its height. */
const shell = () => document.documentElement.style.setProperty("--head", masthead.offsetHeight + "px");
addEventListener("resize", shell);

/** The route on screen, and the address it was shown at (address.js). */
let here = [], routed = "";
function route() {
  tip(null);
  // The address says the route, and the language where it says one (an old address at the root does not). It is
  // then written as this route and language write it: a real path where there is a page, English under en/.
  const said = routeOf(location.pathname.slice(ROOT.pathname.length) + location.hash);
  if (said.language) language = said.language;
  const [page, ...args] = (here = said.parts);
  history.replaceState(history.state?.id ? history.state : { id: Date.now() + Math.random() }, "", href(...here));
  routed = location.href;
  const place = places.get(history.state.id) || 0;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-t]").forEach((node) => (node.innerHTML = t(node.dataset.t)));
  foldFoot();
  document.querySelectorAll(".masthead a[data-to]").forEach((a) => (a.setAttribute("href", href(...[a.dataset.to].filter(Boolean))), a.dataset.to && a.dataset.to === page ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const other = language === "id" ? "en" : "id", languageButton = document.getElementById("language");
  languageButton.textContent = other === "en" ? "English" : "Bahasa Indonesia";
  languageButton.lang = other;
  document.querySelector(".menu nav").setAttribute("aria-label", t("nav_label"));
  const query = document.getElementById("query");
  query.placeholder = t("search");
  query.setAttribute("aria-label", t("search_label"));
  menuLabels();
  shell();
  heard = !page ? "home" : page === "cerita" && args[0] ? "story" : page === "peta" ? "map" : ["kata", "potret"].includes(page) ? "word" : "rest";
  if (hearing) sounding?.bed(heard);
  const pages = { kata: wordPage, potret: portraitPage, kuis: quizPage, tebak: guessPage, menempel: stuckPage, pasang: tidePage, redaksi: roomsPage, lingkaran: circlePage, main: playPage,
    peta: chartPage, balap: racePage, tahun: yearsPage, temuan: findingsPage, bergeser: moversPage, entitas: entitiesPage, cerita: storyPage, metode: methodPage };
  const render = () => {
    rendering = true;
    for (const node of view.querySelectorAll(".gl")) node.sea?.end();  // the old page's seas let the GPU go
    // A story is laid out across the whole width and snaps to its steps; any other page is neither.
    voyage = null;
    view.classList.remove("voyage", "home", "embed", "word");
    document.documentElement.classList.remove("voyaging", "embedded");
    masthead.style.removeProperty("--voyage");
    if (!place) scrollTo(0, 0);
    // The page's skeleton while its data comes, and where it does not come, a line and "Try again" (awaited).
    return awaited(view, () => (page ? pages[page] || lostPage : homePage)(...args), { shape: "page", then: () => describe(page, args) })
      .then(() => {
        describe(page, args);
        settle();
        if (place) scrollTo(0, voyage?.place() ?? place);
        rendering = false;
      });
  };
  // A page turn: the old page gives way to the new one (--d-turn). The new one is caught as it stands after a
  // moment, so that a page still fetching its data does not hold the screen still.
  // While it turns, the new page's own entrances wait (html.turning, style.css) and its title is carried over rather
  // than rising; they play once the turn is done.
  if (first || still() || !document.startViewTransition) render();
  else {
    document.documentElement.classList.add("turning");
    document.startViewTransition(() => Promise.race([render(), new Promise((done) => setTimeout(done, 240))])).finished
      .finally(() => document.documentElement.classList.remove("turning"));
  }
  first = false;
}

/** Key numbers settle into place once, as they first come into view; with reduced motion they are simply there. */
const settling = new IntersectionObserver((list) => list.forEach((e) => e.isIntersecting && (settling.unobserve(e.target), e.target.classList.add("in"))), { rootMargin: "0px 0px -8% 0px" });
function settle() {
  if (still()) return;
  for (const node of view.querySelectorAll(".key-number, .measure-number")) {
    if (node.getBoundingClientRect().top < innerHeight) continue;  // on screen at once: already in place
    node.classList.add("settle");
    settling.observe(node);
  }
}

// A large story card leans towards the mouse, a few degrees, and a glint crosses its key number.
addEventListener("pointermove", (e) => {
  const card = e.pointerType === "mouse" && e.target.closest?.(".story-card.large");
  for (const other of document.querySelectorAll(".story-card.leaning")) if (other !== card) (other.classList.remove("leaning"), other.style.removeProperty("--rx"), other.style.removeProperty("--ry"));
  if (!card || still()) return;
  const box = card.getBoundingClientRect(), x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
  card.classList.add("leaning");
  card.style.setProperty("--ry", `${((x - 0.5) * 5).toFixed(2)}deg`);
  card.style.setProperty("--rx", `${((0.5 - y) * 4).toFixed(2)}deg`);
  card.style.setProperty("--gx", `${Math.round(x * 140 - 20)}%`);
}, { passive: true });

/** The window's title and the page's description, from what the page shows: its title and its lede. */
function describe(page, args) {
  // A page with a name of its own is called what its generated page is called (address.js); any other, after its title and lede.
  const title = view.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim(), lede = view.querySelector(".page-head .lede, .cover .deck, .lost .deck, .empty p");
  const own = view.querySelector(".lost") ? null : named([page, ...args], language);
  document.title = own?.title || `${title || t("nav_label")} · Jejak Kata`;
  // The page served for an unknown path (404.html) has neither tag: the first page reached from it gets them.
  const tag = (selector, html) => document.head.querySelector(selector) || document.head.appendChild(el(html));
  tag('meta[name="description"]', '<meta name="description">').content = own?.description || lede?.textContent.replace(/\s+/g, " ").trim() || t("desc_home");
  // What a browser's own share button sends (Chrome on Android sends this, not the address bar).
  tag('link[rel="canonical"]', '<link rel="canonical">').setAttribute("href", whole(href(...canonical([page, ...args]).filter(Boolean))));
}

// ---- the header: search, and below 900px the menu sheet ---------------------

const menu = document.getElementById("menu"), menuButton = document.getElementById("menu-button"), searchButton = document.getElementById("search-button");
const wideHeader = matchMedia("(min-width: 900px)");
const menuOpen = () => menu.classList.contains("open");
function menuLabels() {
  menuButton.querySelector("span").textContent = t(menuOpen() ? "menu_close" : "menu");
}
/** What can take focus in the header while the sheet is open: the bar and the sheet, nothing behind. */
const focusable = () => [...masthead.querySelectorAll("a[href], button, input, [tabindex]:not([tabindex='-1'])")].filter((node) => node.getClientRects().length && !node.closest("[hidden], [inert]"));
function openMenu(focus) {
  if (wideHeader.matches || menuOpen()) return focus?.focus();
  menu.classList.add("open");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  menu.setAttribute("aria-label", t("menu"));
  [menuButton, searchButton].forEach((b) => b.setAttribute("aria-expanded", "true"));
  for (const node of [view, document.querySelector(".site-foot"), document.getElementById("skip")]) node.inert = true;
  document.documentElement.classList.add("locked");
  menuLabels();
  (focus || menu.querySelector("nav a")).focus();
}
function closeMenu(returnFocus) {
  if (!menuOpen()) return;
  menu.classList.remove("open");
  ["role", "aria-modal", "aria-label"].forEach((name) => menu.removeAttribute(name));
  [menuButton, searchButton].forEach((b) => b.setAttribute("aria-expanded", "false"));
  for (const node of [view, document.querySelector(".site-foot"), document.getElementById("skip")]) node.inert = false;
  document.documentElement.classList.remove("locked");
  document.getElementById("suggestions").hidden = true;
  menuLabels();
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => (menuOpen() ? closeMenu(true) : openMenu()));
searchButton.addEventListener("click", () => (menuOpen() ? document.getElementById("query").focus() : openMenu(document.getElementById("query"))));
masthead.addEventListener("keydown", (e) => {
  if (!menuOpen()) return;
  if (e.key === "Escape") return closeMenu(true);
  if (e.key !== "Tab") return;
  const list = focusable(), at = list.indexOf(document.activeElement);
  if (e.shiftKey && at <= 0) (e.preventDefault(), list.at(-1).focus());
  else if (!e.shiftKey && at === list.length - 1) (e.preventDefault(), list[0].focus());
});
menu.addEventListener("click", (e) => e.target.closest("a[href]") && closeMenu());  // a link to the page one is on changes no address
wideHeader.addEventListener("change", () => closeMenu());
document.getElementById("skip").addEventListener("click", (e) => (e.preventDefault(), view.focus()));

function search() {
  const query = document.getElementById("query");
  const list = document.getElementById("suggestions");
  const go = (word) => {
    list.hidden = true;
    query.value = "";
    if (word) visit(href("kata", word));
  };
  query.addEventListener("input", async () => {
    const q = query.value.trim().toLowerCase();
    const seen = new Set();
    if (q) for (const lens of await allLenses()) for (const [w, i] of lens.index) if (w.startsWith(q) && lens.isEntry(i)) seen.add(w);
    const hits = [...seen].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 8);
    if (q !== query.value.trim().toLowerCase()) return;  // a later keystroke has asked already
    list.innerHTML = hits.length ? hits.map((w) => `<li>${link(w)}</li>`).join("") : q ? `<li class="none">${t("no_offers", escape(q))}</li>` : "";
    list.hidden = !q;
  });
  query.addEventListener("keydown", (e) => e.key === "ArrowDown" && !list.hidden && (e.preventDefault(), list.querySelector("a")?.focus()));
  list.addEventListener("keydown", (e) => {
    const links = [...list.querySelectorAll("a")], at = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") (e.preventDefault(), (links[at + (e.key === "ArrowDown" ? 1 : -1)] || query).focus());
  });
  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault();
    go(query.value.trim().toLowerCase());
  });
  document.addEventListener("click", (e) => !e.target.closest("#search") && (list.hidden = true));
}

// ---- what every page shares: the footer's sea, figures that draw in, the title that carries over a page turn ----

/** Every page closes with the sea: the tide line, the paper giving way to the deep, and under it the night sea held
 *  still. Made once, when the footer first comes near the screen, and kept from page to page. */
const foot = document.querySelector(".site-foot");
foot.prepend(el(`<div class="foot-shore shore" aria-hidden="true"><div class="shore-sea">${GRATICULE}</div>${tideLine(true)}</div>`));
const footSeen = new IntersectionObserver((list) => list.some((e) => e.isIntersecting) && (footSeen.disconnect(),
  shore(foot.firstElementChild, { names: 10, look: { yaw: 0.5, dist: 1.25, x: 0.2, z: 0.25 }, open: (r) => [r.height * 0.3, 0, 0, 0] })), { rootMargin: "400px 0px" });
footSeen.observe(foot);

/** Figures draw in once, as they first come near the screen: a figure laid out below the screen waits (.unseen,
 *  its entrance held at its first frame) until it is there (style.css says how each draws in). The parts of a list
 *  (cards, small charts, posters) follow one another (--i), and so do a plate's lines and rows (plate.js, --k).
 *  Whether a figure is on screen is looked at on every scroll, resize and change of the page, not left to an observer:
 *  a figure reached by a jump (a fast wheel, a link to a place lower down) is simply there, with no entrance. */
const FIGURES = "svg[role=img], .sparks, .cards, .race, .tide, .wall, .bars, .duel";
let sweeping = false, swept = 0;
const sweep = () => sweeping || ((sweeping = true), requestAnimationFrame(() => {
  sweeping = false;
  // A jump: the page moved more than a fifth of a screen since the last look (a fast wheel, a link lower down).
  const jump = Math.abs(scrollY - swept) > innerHeight * 0.2;
  swept = scrollY;
  for (const figure of view.querySelectorAll(".unseen")) {
    const top = figure.getBoundingClientRect().top;
    if (top > innerHeight * 0.96) continue;
    figure.classList.remove("unseen");
    if (jump || top < innerHeight * 0.6) figure.classList.add("arrived");  // reached by a jump, or already well on screen: simply there
  }
}));
addEventListener("scroll", sweep, { passive: true });
addEventListener("resize", sweep);
new MutationObserver((records) => {
  if (still()) return;
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType !== 1) continue;
    for (const figure of [node, ...node.querySelectorAll(FIGURES)]) {
      if (!figure.matches(FIGURES) || figure.closest(".hero, .unseen, .chart")) continue;
      if (figure.matches(".cards, .sparks, .wall")) [...figure.children].forEach((part, i) => part.style.setProperty("--i", Math.min(i, 12)));
      // On screen as it is laid out: it draws in now; below the screen: it waits.
      if (figure.getBoundingClientRect().top > innerHeight * 0.96) figure.classList.add("unseen");
    }
  }
  sweep();
}).observe(view, { childList: true, subtree: true });

// A page turn carries the title over: the title of the card that was chosen becomes the new page's title (style.css
// names both `title`; the old page's own title steps aside for it).
document.addEventListener("click", (e) => {
  const title = !still() && document.startViewTransition && e.target.closest?.("a.card")?.querySelector(".card-title");
  if (!title || e.ctrlKey || e.metaKey || e.shiftKey) return;
  document.querySelectorAll("#view h1").forEach((h1) => (h1.style.viewTransitionName = "none"));
  title.style.viewTransitionName = "title";
}, true);

// The other language is the same route at its own address (en/ or not), in the same entry of the history.
document.getElementById("language").addEventListener("click", () => {
  language = language === "id" ? "en" : "id";
  kept("localStorage", "language", language);
  closeMenu();
  history.replaceState(history.state, "", href(...here));
  route();
});
// Sound: the toggle (in the header, and in an embed's foot), the invitation on the first page, and the sounds every
// page shares: a barely heard tick as a control is pointed at with a mouse or reached by keyboard, a press, a share
// sheet opening. A tab out of sight is silent (sound.js).
if (!WebAudio) document.getElementById("sound").hidden = true;
else if (kept("localStorage", "sound") !== "off" && !embedded()) {
  hearing = true;  // shown as on from the start; heard as soon as the browser lets it
  document.getElementById("sound").setAttribute("aria-pressed", "true");
  for (const kind of GESTURES) addEventListener(kind, wake, true);
  // After the first paint, at the first idle moment: making the context never holds up the page or its sea.
  painted().then(() => (window.requestIdleCallback ? requestIdleCallback(() => hearing && listen(true, false), { timeout: 3000 }) : setTimeout(() => hearing && listen(true, false), 1500)));
}
const CONTROLS = "button, [role=button], summary, a.card, .masthead nav a";
document.addEventListener("click", (e) => {
  if (e.target.closest?.(".sound-toggle")) return listen(!hearing);
  if (e.target.closest?.("button, [role=button], summary")) hear("press");
});
addEventListener("pointerover", (e) => e.pointerType === "mouse" && e.target.closest?.(CONTROLS) && e.target.closest(CONTROLS) !== e.relatedTarget?.closest?.(CONTROLS) && hear("hover"));
addEventListener("focusin", (e) => e.target.matches?.(CONTROLS) && e.target.matches(":focus-visible") && hear("hover"));

/** The address changed (a link, the back button, a fragment typed by hand): its page, once. */
function moved() {
  if (location.href === routed) return;
  document.getElementById("suggestions").hidden = true;
  document.getElementById("query").value = "";
  closeMenu();
  route();
}
addEventListener("hashchange", moved);
addEventListener("popstate", moved);
// A link to a page of the site is followed here, without loading the site again; files (data/...) and other sites
// are left to the browser.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
  const to = new URL(a.href), [first] = to.pathname.slice(ROOT.pathname.length).replace(/^en\//, "").split("/");
  if (to.origin !== location.origin || !to.pathname.startsWith(ROOT.pathname) || (first && !PAGES.includes(decodeURIComponent(first)))) return;
  e.preventDefault();
  visit(to.href);
});
search();
route();
