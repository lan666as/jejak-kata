// Jejak Kata: a static reader for the files written by `python -m idhist.export` and `idhist.highlights`.
// No build step and no dependencies.
// Routes: #/  #/kata/<word>[/<lens>]  #/potret/<name>  #/peta/<lens>/<word>...  #/balap/<lens>/<word>...
//         #/cerita/<slug>[/<scene>]  #/kuis  #/tahun  #/temuan  #/bergeser  #/entitas  #/metode

import { seaChart } from "./chart.js";
import { plate, plates, savePlate } from "./plate.js";
import { TEXT, LENS_TEXT, NOTES, FEATURED, SHOWCASE, STORIES } from "./text.js";

const DATA = "data";
const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the colour steps
const WIKIPEDIA = "https://id.wikipedia.org/wiki/";
const BEAT = 1500; // milliseconds a player stays on one period
const MAIN = "id-web-news-kompas"; // the lens of the first page: yearly, one publisher, 2011-2024
const ROUTES = ["--route", "--route-2", "--ink", "--ink-3"]; // colours of the first, second ... chosen word
const view = document.getElementById("view");
const tipNode = document.getElementById("tip");

let language = localStorage.getItem("language") || "id";
const t = (key, ...args) => {
  const s = TEXT[language][key] ?? TEXT.id[key] ?? key;
  return typeof s === "function" ? s(...args) : s;
};
const lensText = (lens) => LENS_TEXT[lens.lens][language];

// ---- data ---------------------------------------------------------------

const cache = new Map();
const json = (path) => {
  if (!cache.has(path)) cache.set(path, fetch(`${DATA}/${path}`).then((r) => (r.ok ? r.json() : Promise.reject(path))));
  return cache.get(path);
};

/** A lens with its meta, a word -> index map, and which entries are entities (index -> Wikipedia article). */
const loaded = new Map();
const lensNamed = (name) => {
  if (!loaded.has(name))
    loaded.set(name, json(`${name}/meta.json`).then((meta) => {
      const hidden = new Set(meta.names);
      const index = new Map(meta.words.map((w, i) => [w, i]));
      const articles = new Map(Object.entries(meta.entities).map(([i, article]) => [+i, article]));
      const kind = (i) => meta.kinds[i] || "other";
      return { ...meta, index, articles, kind, isEntry: (i) => i !== undefined && !hidden.has(i) };
    }).catch(() => undefined));
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
const href = (...parts) => "#/" + parts.map(encodeURIComponent).join("/");
const link = (word) => `<a href="${href("kata", word)}">${word}</a>`;
const number = (x, digits = 1) => x.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (share) => (share * 100).toLocaleString(language, { maximumSignificantDigits: 2 }) + "%";
const step = (shift) => STEPS.filter((s) => shift >= s).length;
const pairIndex = (lens, a, b) => lens.pairs.findIndex(([x, y]) => x === a && y === b);
const largest = (shifts) => Math.max(...shifts.filter((s) => s !== null));
const known = (e) => e.with.map((w, p) => (w.length ? p : -1)).filter((p) => p >= 0); // periods with enough of the word
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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
function tabs(labels, show, first = 0) {
  const list = el(`<ul class="tabs">${labels.map((label) => `<li><button type="button">${label}</button></li>`).join("")}</ul>`);
  const buttons = [...list.querySelectorAll("button")];
  const press = (i) => {
    buttons.forEach((b, j) => b.setAttribute("aria-pressed", i === j));
    show(i);
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => press(i)));
  press(first);
  return list;
}

/** Tabs over one holder: the content of the pressed tab replaces the last. */
function switcher(labels, content, first = 0) {
  const holder = el("<div></div>");
  const box = el("<div></div>");
  const show = async (i) => holder.replaceChildren(await Promise.resolve(content(i)).catch(() => el(`<p class="sub">${t("no_data")}</p>`)));
  box.append(tabs(labels, show, first), holder);
  return box;
}

/**
 * A figure is {node, labels, show(i)}: something that can be shown at each of a row of moments.
 * `played` puts a play button and a slider under it; `scrolly` lets the page's scrolling drive it instead.
 */
function played(figure, start = figure.labels.length - 1) {
  const box = el(`<div></div>`);
  const bar = el(`<div class="player"><button type="button" aria-label="${t("play")}">▶</button>
    <input type="range" min="0" max="${figure.labels.length - 1}" value="${start}" aria-label="${t("period")}"><output></output></div>`);
  const [button, slider, output] = bar.children;
  let timer = null;
  const go = (i) => {
    slider.value = i;
    output.textContent = figure.labels[i];
    figure.show(i);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    button.textContent = "▶";
  };
  button.addEventListener("click", () => {
    if (timer) return stop();
    if (+slider.value >= figure.labels.length - 1) go(0);
    button.textContent = "❚❚";
    timer = setInterval(() => (!bar.isConnected || +slider.value >= figure.labels.length - 1 ? stop() : go(+slider.value + 1)), BEAT);
  });
  slider.addEventListener("input", () => (stop(), go(+slider.value)));
  figure.goto = go; // so that a click inside the figure can move the slider too
  box.append(figure.node, bar);
  go(start);
  return box;
}

/** A figure that stays in place while captions scroll past; each caption names the moment (`at`) to show. */
function scrolly(figure, steps) {
  const box = el(`<div class="scrolly"><div class="pin"></div><div class="steps">${steps
    .map((s) => `<div data-at="${escape(s.at)}"><p><b>${s.at}</b>${s[language]}</p></div>`).join("")}</div></div>`);
  box.firstElementChild.append(figure.node);
  const nodes = [...box.querySelectorAll(".steps > div")];
  const watch = new IntersectionObserver(
    (seen) => {
      for (const s of seen) {
        if (!s.isIntersecting) continue;
        nodes.forEach((n) => n.classList.toggle("on", n === s.target));
        const i = figure.labels.indexOf(s.target.dataset.at);
        if (i >= 0) figure.show(i, steps[nodes.indexOf(s.target)].focus);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  nodes.forEach((n) => watch.observe(n));
  figure.show(Math.max(0, figure.labels.indexOf(steps[0].at)), steps[0].focus);
  return box;
}

// ---- figures --------------------------------------------------------------

/** Share of units containing each word, per period; one line per entry, named when there are several. */
function frequencyChart(lens, series, chosen = []) {
  const W = Math.max(280, Math.min(680, view.clientWidth - 32)), H = 190, L = 44, R = 12, T = 10, B = 26; // drawn at its real size, so text stays legible
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
    const cell = el(`<svg><rect class="cell ${s === null ? "rare" : "s" + step(s)} ${a === chosen[0] && b === chosen[1] ? "chosen" : ""}"
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
 * The neighbours are islands that stay put; the word sails among them. Names stand clear of the route, on the
 * side away from it, each tied to its island by a thin line.
 */
function pathFigure(lens, path) {
  const W = Math.max(300, Math.min(700, view.clientWidth - 32)), H = Math.round(W * 0.8), P = 30, SIDE = 96;
  const raw = path.path.map((xy, p) => xy && { p, xy }).filter(Boolean);
  const smooth = (k, d) => (raw.length > 6 && k > 0 && k < raw.length - 1 ? (raw[k - 1].xy[d] + 2 * raw[k].xy[d] + raw[k + 1].xy[d]) / 4 : raw[k].xy[d]);
  const moved = raw.map((r, k) => [smooth(k, 0), smooth(k, 1)]);
  const all = [...path.at, ...moved];
  const scale = (d, size, pad) => {
    const low = Math.min(...all.map((xy) => xy[d])), high = Math.max(...all.map((xy) => xy[d]));
    return (v) => pad + ((size - 2 * pad) * (v - low)) / (high - low || 1);
  };
  const x = scale(0, W, SIDE), y = scale(1, H, P);
  const steps = moved.map((xy, k) => ({ p: raw[k].p, x: x(xy[0]), y: y(xy[1]) }));
  const at = (k) => steps[Math.max(0, Math.min(steps.length - 1, k))];
  const curve = steps.slice(1).map((s, k) => {
    const [p0, p1, p2, p3] = [at(k - 1), at(k), s, at(k + 2)];
    return `C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }).join(" ");
  const d = `M${steps[0].x},${steps[0].y} ${curve}`;
  // Names go on the side of each island away from the middle of the route, then apart from each other.
  const mid = { x: steps.reduce((s, p) => s + p.x, 0) / steps.length, y: steps.reduce((s, p) => s + p.y, 0) / steps.length };
  const marks = path.near.map((id, k) => {
    const [ix, iy] = [x(path.at[k][0]), y(path.at[k][1])];
    const away = Math.hypot(ix - mid.x, iy - mid.y) || 1;
    return { id, late: k >= path.early, x: ix, y: iy, right: ix >= mid.x, lx: ix + (14 * (ix - mid.x)) / away, ly: iy + (14 * (iy - mid.y)) / away };
  });
  for (let round = 0; round < 40; round++)
    for (const a of marks)
      for (const b of marks)
        if (a !== b && a.right === b.right && Math.abs(a.lx - b.lx) < 110 && Math.abs(a.ly - b.ly) < 15) {
          const push = a.ly <= b.ly ? -1 : 1;
          a.ly += push;
          b.ly -= push;
        }
  marks.forEach((m) => (m.ly = Math.max(12, Math.min(H - 6, m.ly))));
  const node = el(`<div><div class="legend"><span><i class="early"></i>${t("near_early", lens.periods[steps[0].p])}</span>
    <span><i class="late"></i>${t("near_late", lens.periods[steps.at(-1).p])}</span></div>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("path")}">
    <defs><marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--route)"/></marker></defs>
    ${marks.map((m) => `<line class="leader" x1="${m.x}" y1="${m.y}" x2="${m.lx}" y2="${m.ly}"/><circle class="island ${m.late ? "late" : ""}" cx="${m.x}" cy="${m.y}" r="5"/>`).join("")}
    <path class="casing" d="${d}"/><path class="route-line draw" pathLength="1" marker-end="url(#head)" d="${d}"/>
    ${steps.map((s, k) => `<circle class="route-step" data-k="${k}" cx="${s.x}" cy="${s.y}" r="4.5"><title>${lens.periods[s.p]}</title></circle>`).join("")}
    ${marks.map((m) => `<text class="island-label" data-word="${escape(lens.words[m.id])}" x="${m.lx + (m.right ? 4 : -4)}" y="${m.ly + 4}" text-anchor="${m.right ? "start" : "end"}">${lens.words[m.id]}</text>`).join("")}
    <circle class="ship" r="9" cx="${steps[0].x}" cy="${steps[0].y}"/><text class="when-label" text-anchor="middle"></text>
  </svg></div>`);
  const ship = node.querySelector(".ship"), label = node.querySelector(".when-label");
  const figure = { node, labels: steps.map((s) => lens.periods[s.p]) };
  figure.show = (k) => {
    ship.setAttribute("cx", steps[k].x);
    ship.setAttribute("cy", steps[k].y);
    label.setAttribute("x", steps[k].x);
    label.setAttribute("y", steps[k].y - 16);
    label.textContent = lens.periods[steps[k].p];
  };
  node.querySelectorAll(".route-step").forEach((c) => c.addEventListener("click", () => (figure.goto || figure.show)(+c.dataset.k)));
  node.querySelectorAll(".island-label").forEach((n) => n.addEventListener("click", () => (location.hash = href("kata", n.dataset.word))));
  return figure;
}

/** The chart of a lens with the routes of the given words on it. `pick(word)` is called when an island is clicked. */
async function chartFigure(lens, list, pick = (word) => (location.hash = href("kata", word)), height = "min(70vh, 560px)") {
  const chart = seaChart({ chart: await json(`${lens.lens}/chart.json`), name: (id) => lens.words[id], pick: (id) => pick(lens.words[id]), periods: lens.periods, tip });
  chart.node.style.height = height;
  const figure = { node: chart.node, labels: lens.periods, chart, show: (p) => chart.time(p) };
  figure.set = async (names) => {
    const ids = names.map((w) => lens.index.get(w)).filter((i) => chart.has(i));
    const paths = await Promise.all(ids.map((i) => pathOf(lens, i)));
    chart.routes(ids.map((id, k) => ({ id, color: ROUTES[Math.min(k, 3)], route: paths[k]?.route || [] })));
    requestAnimationFrame(() => chart.frame(ids));
  };
  await figure.set(list);
  return figure;
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
  const node = el(`<div class="pair" style="grid-template-columns:1fr 1fr 1fr"></div>`);
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
        ${rivals[k] ? `<polyline class="spark-line k1" points="${line(rivals[k], top)}"/>` : `<polygon class="spark-area" points="0,${H} ${line(e, top)} ${W},${H}"/>`}
        <polyline class="spark-line" points="${line(e, top)}"/></svg>
      <small>${rivals[k] ? t("took_over", lens.words[rivals[k].word]) : t("peak", lens.periods[peak], percent(e.share[peak]))}</small></a></li>`;
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
      el(`<details><summary>${t("all_periods")}</summary><table>
        <tr><th>${t("period")}</th><th class="n">${t("share")}</th><th>${t("with")}</th><th>${t("like")}</th></tr>
        ${lens.periods.map((p, i) => `<tr><td>${p}</td><td class="n">${percent(e.share[i])}</td>
          <td>${e.with[i].map((w) => lens.words[w]).join(", ")}</td><td>${e.like[i].map((w) => lens.words[w]).join(", ")}</td></tr>`).join("")}
      </table></details>`),
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

/** A figure with its player and a line under it saying how to read it. */
const explained = (figure, about, start) => {
  const box = played(figure, start);
  box.append(el(`<p class="sub">${about}</p>`));
  return box;
};

/** A word in one lens: its path among its neighbours, its route on the chart, its company, the numbers, and for a name what is said of it. */
async function lensSection(lens, e) {
  const word = lens.words[e.word];
  const section = el(`<section><p class="sub">${lensText(lens).about}
    ${lens.sensitivity ? t("sensitivity", lens.sensitivity, percent) : ""}</p></section>`);
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
    path?.path && [t("path"), () => explained(pathFigure(lens, path), t("path_about"))],
    path?.route && [t("chart"), async () => explained(await chartFigure(lens, [word]), t("chart_about"))],
    known(e).length > 1 && [t("orbit"), () => explained(orbit(lens, e), t("orbit_about"))],
    [t("numbers"), () => numbers(lens, e)],
    lens.articles.has(e.word) && [t("said"), said],
  ].filter(Boolean);
  section.append(switcher(views.map((v) => v[0]), (i) => views[i][1]()));
  return section;
}

/** One lens at a time: a tab per lens, labelled with what `label(lens)` returns, showing `section(lens)`. */
async function perLens(found, label, section, first = 0) {
  view.append(switcher(await Promise.all(found.map(label)), (i) => section(found[i]), first));
}

/** A field that offers the words of a lens as one types; `chosen(word)` gets the one picked. */
function suggest(lens, placeholder, button, chosen) {
  const form = el(`<form class="controls suggest" autocomplete="off"><span><input type="search" placeholder="${placeholder}" aria-label="${placeholder}"><ul class="offers" hidden></ul></span><button>${button}</button></form>`);
  const [input, offers] = [form.querySelector("input"), form.querySelector("ul")];
  const take = (word) => {
    offers.hidden = true;
    input.value = "";
    chosen(word);
  };
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase(), hits = [];
    if (q) for (const [w, i] of lens.index) if (w.startsWith(q) && lens.isEntry(i) && hits.push(w) === 8) break; // in order of frequency
    offers.innerHTML = hits.map((w) => `<li><button type="button">${w}</button></li>`).join("");
    offers.hidden = !hits.length;
    offers.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => take(b.textContent)));
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const word = offers.querySelector("button")?.textContent || input.value.trim().toLowerCase();
    if (word) take(word);
  });
  return form;
}

/** A text field that adds a word to `list` if `lens` has it, and chips to take words out again. */
function picker(lens, list, changed, most = 12) {
  const box = el(`<div><ul class="picked"></ul></div>`);
  const draw = () => {
    box.firstElementChild.innerHTML = list.map((w, k) => `<li class="k${k}">${w}<button type="button" data-k="${k}" aria-label="${t("remove")}">×</button></li>`).join("");
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

async function wordPage(word, opened) {
  const all = await allLenses();
  const found = all.filter((lens) => lens.isEntry(lens.index.get(word)));
  view.replaceChildren(el(`<h1>${escape(word)}</h1>`));
  if (!found.length) return view.append(el(`<p>${t(all.some((lens) => lens.index.has(word)) ? "is_name" : "not_found")}</p>`));

  const named = found.find((lens) => lens.articles.has(lens.index.get(word)));
  if (named) {
    const i = named.index.get(word), article = named.articles.get(i);
    const same = new Set(found.flatMap((lens) => [...lens.articles].filter(([j, a]) => a === article && lens.isEntry(j)).map(([j]) => lens.words[j])));
    same.delete(word);
    view.append(
      el(`<p><span class="badge"><i class="${named.kind(i)}"></i>${t("kind_one_" + named.kind(i))}</span></p>`),
      el(`<p class="note">${t("entity", `<a href="${WIKIPEDIA}${encodeURIComponent(article.replaceAll(" ", "_"))}">${escape(article)}</a>`)}
        ${same.size ? t("also_written", [...same].map(link).join(", ")) : ""}</p>`),
    );
  }
  if (NOTES[word]) view.append(el(`<p class="note">${NOTES[word][language]}</p>`));

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
  view.append(el(`<p class="controls">${named ? `<a href="${href("potret", word)}">${t("portrait_ask")}</a>` : ""} <a href="${href("peta", lens.lens, word)}">${t("rival_ask")}</a> <a href="${href("balap", lens.lens, word)}">${t("race_ask")}</a></p>`), tools(href("kata", word, lens.lens), {}));
}

/** The chart of a lens, with up to four words of the reader's choosing sailing across it; two of them are compared below. */
async function chartPage(name = MAIN, ...list) {
  const lens = (await lensNamed(name)) || (await lensNamed(MAIN));
  list = list.filter((w) => lens.isEntry(lens.index.get(w))).slice(0, 4);
  const all = await allLenses();
  const select = el(`<select aria-label="${t("lens")}">${all.map((l) => `<option value="${l.lens}" ${l === lens ? "selected" : ""}>${lensText(l).title}</option>`).join("")}</select>`);
  select.addEventListener("change", () => (location.hash = href("peta", select.value, ...list)));
  const below = el("<div></div>");
  const figure = await chartFigure(lens, list, (word) => {
    if (list.includes(word)) return (location.hash = href("kata", word));
    if (list.length >= 4) list.shift();
    list.push(word);
    update();
  });
  const update = async () => {
    history.replaceState(null, "", href("peta", lens.lens, ...list));
    pick.redraw();
    address();
    await figure.set(list);
    await rivalry();
  };
  const pick = picker(lens, list, update, 4);
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
  view.replaceChildren(el(`<h1>${t("nav_chart")}</h1>`), el(`<p class="lede">${t("chart_lede")}</p>`), controls, pick, explained(figure, t("chart_about")), el(legendMoved()), share, below);
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
  select.addEventListener("change", () => (location.hash = href("balap", select.value, ...list)));
  const holder = el("<div></div>");
  const draw = async () => {
    history.replaceState(null, "", href("balap", lens.lens, ...list));
    const entries = await entriesOf(lens, list);
    holder.replaceChildren(...(entries.length ? [played(race(lens, entries, null, 12), 0), el(`<h3>${t("frequency")}</h3>`), frequencyChart(lens, entries), tools(href("balap", lens.lens, ...list), { check: list })] : [el(`<p class="sub">${t("race_empty")}</p>`)]));
  };
  const controls = el(`<div class="controls"></div>`);
  controls.append(select);
  view.replaceChildren(el(`<h1>${t("nav_race")}</h1>`), el(`<p class="lede">${t("race_lede")}</p>`), controls, picker(lens, list, draw), holder);
  await draw();
}

/** Each period in its own words: a wall of posters, lens by lens. */
async function yearsPage() {
  const found = await allLenses();
  view.replaceChildren(el(`<h1>${t("nav_years")}</h1>`), el(`<p class="lede">${t("years_about")}</p>`));
  view.append(switcher(found.map((lens) => lensText(lens).short || lensText(lens).title), (i) => wall(found[i]), Math.max(0, found.findIndex((lens) => lens.lens === MAIN))));
}

/** What the counting turned up by itself: who took whose place, what came and went, what came and stayed. */
async function findingsPage() {
  const found = [];
  for (const lens of await allLenses()) if ((await highlights(lens).catch(() => ({}))).swaps?.length) found.push(lens);
  view.replaceChildren(el(`<h1>${t("nav_findings")}</h1>`), el(`<p class="lede">${t("findings_lede")}</p>`));
  const section = async (lens) => {
    const { swaps, arrivals } = await highlights(lens);
    const box = el("<div></div>");
    const from = await Promise.all(swaps.slice(0, 24).map(([a]) => entry(lens, a))), to = await Promise.all(swaps.slice(0, 24).map(([, b]) => entry(lens, b)));
    const pairs = to.map((e, k) => [e, from[k]]).filter(([a, b]) => a && b);
    box.append(el(`<h2>${t("swaps_title")}</h2>`), el(`<p class="sub">${t("swaps_about")}</p>`), sparks(lens, pairs.map((p) => p[0]), pairs.map((p) => p[1])));
    for (const kind of ["went", "stayed"]) {
      const entries = (await Promise.all(arrivals[kind].slice(0, 24).map(([w]) => entry(lens, w)))).filter(Boolean);
      box.append(el(`<h2>${t(kind + "_title")}</h2>`), el(`<p class="sub">${t(kind + "_about")}</p>`), sparks(lens, entries));
    }
    return box;
  };
  view.append(switcher(found.map((lens) => lensText(lens).short || lensText(lens).title), (i) => section(found[i]), Math.max(0, found.findIndex((lens) => lens.lens === MAIN))));
}

/** Lists per lens; a word also flagged between the same periods in another lens is marked. */
async function moversPage() {
  const all = await Promise.all((await allLenses()).map(async (lens) => ({ lens, movers: await json(`${lens.lens}/movers.json`) })));
  const key = (lens, m) => `${lens.periods[m.a]}>${lens.periods[m.b]}`;
  const elsewhere = (lens, m, word) =>
    all.filter((o) => o.lens !== lens && o.movers.some((x) => key(o.lens, x) === key(lens, m) && x.words.some(([w]) => o.lens.words[w] === word)));
  view.replaceChildren(el(`<h1>${t("nav_movers")}</h1>`), el(`<p class="note">${t("movers_about")}</p>`));
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
  view.replaceChildren(el(`<h1>${t("nav_entities")}</h1>`), el(`<p class="note">${t("entities_about")}</p>`));
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
    box.append(tabs(kinds.map((k) => `<span class="dot ${k}"></span> ${t("kind_" + k)}`), pick), list);
    return box;
  };
  view.append(switcher(found.map((lens) => lensText(lens).short || lensText(lens).title), (k) => section(found[k]), Math.max(0, found.findIndex((lens) => lens.lens === MAIN))));
}

/** The figures a story can show. Each takes a scene's settings and returns a figure, or a plain node. */
const plateWidth = () => (innerWidth > 760 ? Math.min(view.clientWidth * 0.58, 640) : view.clientWidth - 8);
const SCENES = {
  /** How often each word is on a page of the lens, period by period. */
  lines: async (scene, l) => {
    const entries = await entriesOf(l, scene.words);
    return plate({ title: scene[language].plate, note: t("plate_note", t("of_units", l)), periods: l.periods, series: entries.map((e) => ({ label: l.words[e.word], values: e.share })) }, plateWidth());
  },
  /** Of the pages naming one word, the share that also contain each of the others (see idhist/together.py). */
  together: async (scene, l) => {
    const found = (await json("together.json"))[`${scene.lens}/${scene.word}`];
    return plate({ title: scene[language].plate, note: t("plate_note_together"), periods: l.periods, series: scene.with.filter((w) => found.with[w]).map((w) => ({ label: w, values: found.with[w] })) }, plateWidth());
  },
  /** One word in several lenses that have the same periods: a plate per word. */
  publishers: async (scene) => {
    const chosen = await Promise.all(scene.lenses.map(lensNamed));
    const rows = await Promise.all(scene.words.map((w) => Promise.all(chosen.map((l) => entryOf(l, w)))));
    return plates(scene.words, (i) => plate({ title: scene[language].plate(scene.words[i]), note: t("plate_note", t("of_units", chosen[0])), periods: chosen[0].periods,
      series: chosen.map((l, k) => ({ label: lensText(l).short, values: rows[i][k] ? rows[i][k].share : chosen[0].periods.map(() => null) })) }, plateWidth()));
  },
  /** Two words against each other: a plate per pair. */
  pairs: async (scene, l) => {
    const rows = await Promise.all(scene.pairs.map((pair) => entriesOf(l, pair)));
    return plates(scene.pairs.map((pair) => pair.join(" / ")), (i) => plate({ title: scene[language].plate(...scene.pairs[i]), note: t("plate_note", t("of_units", l)), periods: l.periods,
      series: rows[i].map((e) => ({ label: l.words[e.word], values: e.share })) }, plateWidth()));
  },
  race: async ({ lens, words: list, focus }, l) => race(l, await entriesOf(l, list), focus),
  chart: async ({ words: list }, l) => chartFigure(l, list, undefined, "min(72vh, 600px)"),
  path: async ({ word }, l) => pathFigure(l, await pathOf(l, l.index.get(word))),
  orbit: async ({ word }, l) => orbit(l, await entryOf(l, word)),
  duel: async ({ words: [a, b], lexicon }, l) => duel(l, a, b, lexicon),
  sparks: async ({ words: list }, l) => sparks(l, await entriesOf(l, list)),
  wall: async (scene, l) => wall(l),
  /** Chosen words between two periods: the shift in every lens named, and the company gained and lost in the first. */
  async table({ lenses: names, periods, groups }) {
    const chosen = await Promise.all(names.map(lensNamed));
    const [first] = chosen;
    const at = (lens) => pairIndex(lens, ...periods.map((p) => lens.periods.indexOf(p)));
    const score = (s) => (s === null || s === undefined ? "–" : `<span class="score"><i class="s${step(s)}"></i>${number(s)}</span>`);
    const box = el(`<details><summary>${t("table_open")}</summary><p class="sub">${periods.join(" → ")}. ${t("story_columns", lensText(first).title)} ${t("marks")}</p></details>`);
    for (const group of groups) {
      const rows = await Promise.all(
        group.words.map(async (word) => {
          const entries = await Promise.all(chosen.map((lens) => entryOf(lens, word)));
          const shifts = entries.map((e, k) => `<td class="n">${score(e && e.shift[at(chosen[k])])}</td>`).join("");
          const [a, b] = periods.map((p) => first.periods.indexOf(p));
          return `<tr><td>${entries.some(Boolean) ? link(word) : word}</td>${shifts}<td class="turnover">${entries[0] ? turnover(first, entries[0], a, b) : ""}</td></tr>`;
        }),
      );
      box.append(el(`<div><h3>${group[language]}</h3>
        <table><tr><th>${t("word")}</th>${chosen.map((lens) => `<th class="n">${lensText(lens).short || t("shift")}</th>`).join("")}<th>${t("gained_lost")}</th></tr>${rows.join("")}</table></div>`));
    }
    return box;
  },
};

/** Buttons under a figure: save it as an image (a plate), copy its address, and where to check it. */
function tools(address, { image, check = [], data } = {}) {
  const row = el(`<p class="controls tools"></p>`);
  if (image) {
    const save = el(`<button type="button">${t("save_image")}</button>`);
    save.addEventListener("click", () => savePlate(image, "jejak-kata"));
    row.append(save);
  }
  const copy = el(`<button type="button">${t("copy_link")}</button>`);
  copy.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(new URL(address, location.href).href);
    copy.textContent = t("copied");
  });
  row.append(copy);
  if (check.length || data) row.append(el(`<span>${t("check")} ${check.map(link).join(", ")}${data ? `${check.length ? ", " : ""}<a href="${DATA}/${data}">${t("check_data")}</a>` : ""}</span>`));
  return row;
}

/** A story: a question, scenes with pinned figures, and an ending that says what the data cannot tell. */
async function storyPage(slug, scene) {
  const story = STORIES.find((s) => s.slug === slug);
  view.replaceChildren(el(`<h1>${story[language].title}</h1>`), el(`<p class="lede">${story[language].intro}</p>`));
  for (const [k, part] of story.scenes.entries()) {
    const section = el(`<section id="scene-${k}"><h2>${part[language].title}</h2><div>${part[language].text || ""}</div></section>`);
    view.append(section);
    const shown = await SCENES[part.type](part, part.lens && (await lensNamed(part.lens))).catch(() => null);
    if (!shown) section.append(el(`<p class="sub">${t("no_data")}</p>`));
    else if (part.steps) section.append(scrolly(shown, part.steps));
    else section.append(shown.show ? played(shown, part.start ?? shown.labels.length - 1) : shown);
    const isPlate = ["lines", "together", "publishers", "pairs"].includes(part.type);
    section.append(tools(href("cerita", slug, String(k)), { image: isPlate && shown ? section : null, check: part.check, data: part.type === "together" ? "together.json" : null }));
  }
  view.append(el(`<section class="limits"><h2>${t("limits_title")}</h2>${story[language].limits}</section>`));
  if (scene) document.getElementById(`scene-${scene}`)?.scrollIntoView();
}

/** The first page: the chart, with one word after another sailing its route until the reader takes over. */
async function homePage() {
  const lens = await lensNamed(MAIN);
  const hero = el(`<section class="hero"><div class="over"><h1>${t("title")}</h1><p class="lede">${t("intro")}</p></div></section>`);
  view.replaceChildren(hero);
  let own = false;
  const chosen = el(`<p class="controls"></p>`);
  const sail = async (figure, word) => {
    await figure.set([word]);
    figure.chart.time(0, 0);
    chosen.innerHTML = `${t("sailing", link(word))} <a href="${href("peta", lens.lens, word)}">${t("rival_ask")}</a>`;
    const last = lens.periods.length - 1;
    setTimeout(() => figure.node.isConnected && figure.chart.time(last, still() ? 0 : 520 * last), 1200);
  };
  const figure = await chartFigure(lens, [], (word) => ((own = true), sail(figure, word)), "min(78vh, 720px)").catch(() => null);
  if (figure) {
    hero.prepend(figure.node);
    const form = suggest(lens, t("hero_ask"), t("hero_go"), (word) => {
      if (!lens.isEntry(lens.index.get(word))) return (location.hash = href("kata", word));
      own = true;
      sail(figure, word);
    });
    hero.querySelector(".over").append(form);
    let k = 0;
    const next = () => {
      if (own || !figure.node.isConnected) return;
      sail(figure, SHOWCASE[k++ % SHOWCASE.length]);
      setTimeout(next, 1200 + 520 * lens.periods.length + 2600);
    };
    next();
  }
  const posters = el(`<section><h2>${t("wall_title")}</h2><p class="sub">${t("years_about")}</p></section>`);
  posters.append(await wall(lens).catch(() => ""));
  const doors = [
    ...STORIES.map((s) => [href("cerita", s.slug), s[language].title, s[language].teaser]),
    [href("temuan"), t("nav_findings"), t("findings_lede")],
    [href("balap"), t("nav_race"), t("race_lede")],
    [href("peta"), t("nav_chart"), t("chart_lede")],
  ];
  view.append(
    chosen,
    posters,
    el(`<section><h2>${t("doors")}</h2><ul class="doors">${doors.map(([to, title, text]) => `<li><a href="${to}"><b>${title}</b><span>${text}</span></a></li>`).join("")}</ul></section>`),
    el(`<section><h2>${t("try")}</h2><ul class="words">${FEATURED.map((w) => `<li>${link(w)}</li>`).join("")}</ul></section>`),
    el(`<section>${t("caveats")}</section>`),
  );
}

/** One screen about a name: when it peaked, its voyage, what the news had it doing, and who keeps company like it. */
async function portraitPage(word) {
  const lens = await lensNamed(MAIN), e = lens && (await entryOf(lens, word));
  if (!e) return wordPage(word);
  const peak = e.share.indexOf(Math.max(...e.share)), last = known(e).at(-1), path = await pathOf(lens, e.word);
  const said = async (lexicon) => ((await saidOf(lens, word, lexicon))?.findLast((list) => list.length) || []).slice(0, 8).map(([id]) => id);
  const [verbs, adjectives] = await Promise.all([said("verbs"), said("adjectives")]);
  view.replaceChildren(
    el(`<h1>${escape(word)}</h1>`),
    el(`<p class="lede">${t("peak_year", lens.periods[peak], percent(e.share[peak]))}</p>`),
    frequencyChart(lens, [e], [peak]),
    el(`<div class="pair"><div><h3>${t("verbs")}</h3>${words(lens, verbs)}</div><div><h3>${t("adjectives")}</h3>${words(lens, adjectives)}</div></div>`),
    el(`<h3>${t("most_alike")} (${lens.periods[last]})</h3>`),
    el(words(lens, e.like[last])),
  );
  if (path?.path) view.append(el(`<h3>${t("path")}</h3>`), played(pathFigure(lens, path)));
  view.append(el(`<p class="sub">${lensText(lens).title}. ${t("traits_about")}</p>`), tools(href("potret", word), { check: [word] }));
}

/** Two games: name the year from its own words; name the person or institution from its verbs and adjectives. */
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
  view.replaceChildren(el(`<h1>${t("nav_quiz")}</h1>`), el(`<p class="lede">${t("quiz_lede")}</p>`));
  const play = (kind) => {
    const box = el(`<div class="quiz"></div>`);
    let right = 0, round = 0;
    const next = async () => {
      if (round === ROUNDS) {
        box.innerHTML = `<p class="score">${t("quiz_score", right, ROUNDS)}</p>`;
        const again = el(`<button type="button">${t("quiz_again")}</button>`), share = el(`<button type="button">${t("copy_link")}</button>`);
        again.addEventListener("click", () => ((right = round = 0), next()));
        share.addEventListener("click", async () => {
          await navigator.clipboard?.writeText(`${t("quiz_share", right, ROUNDS)} ${new URL(href("kuis"), location.href).href}`);
          share.textContent = t("copied");
        });
        return box.append(again, share);
      }
      const q = await games[kind]();
      round++;
      box.innerHTML = `<p class="sub">${round} / ${ROUNDS}</p><p>${q.ask}</p>${q.clue}<p class="choices">${q.choices.map((c) => `<button type="button">${c}</button>`).join("")}</p><p class="verdict" role="status"></p>`;
      box.querySelectorAll(".choices button").forEach((b) =>
        b.addEventListener("click", () => {
          const ok = b.textContent === q.answer;
          right += ok;
          box.querySelectorAll(".choices button").forEach((x) => ((x.disabled = true), x.classList.toggle("right", x.textContent === q.answer)));
          box.querySelector(".verdict").innerHTML = `${ok ? t("quiz_right") : t("quiz_wrong", q.answer)} <button type="button">${t("quiz_next")}</button>`;
          box.querySelector(".verdict button").addEventListener("click", next);
        }),
      );
    };
    next();
    return box;
  };
  view.append(switcher([t("quiz_year"), t("quiz_who")], (i) => play(i ? "who" : "year")));
}

/** How it works, and what the planted-change test found each lens can see. */
async function methodPage() {
  view.replaceChildren(el(`<article>${t("method")}</article>`));
  const tested = (await allLenses()).filter((lens) => lens.sensitivity);
  const found = (lens, share) => percent(lens.sensitivity.found[share]);
  view.append(
    el(`<h2>${t("tests_title")}</h2>`),
    el(`<p class="sub">${t("tests_about")}</p>`),
    el(`<table><tr><th>${t("lens")}</th><th class="n">${t("units")}</th><th class="n">20%</th><th class="n">40%</th><th class="n">80%</th><th class="n">${t("false_alarms")}</th></tr>
      ${tested.map((lens) => `<tr><td>${lensText(lens).title}</td><td class="n">${lens.units.reduce((x, y) => x + y).toLocaleString(language)}</td>
        ${["0.2", "0.4", "0.8"].map((share) => `<td class="n">${found(lens, share)}</td>`).join("")}<td class="n">${percent(lens.sensitivity.false_alarms)}</td></tr>`).join("")}
    </table>`),
  );
}

// ---- shell ----------------------------------------------------------------

function route() {
  tip(null);
  const [, page, ...args] = location.hash.split("/").map(decodeURIComponent);
  document.documentElement.lang = language;
  document.querySelectorAll("[data-t]").forEach((node) => (node.innerHTML = t(node.dataset.t)));
  document.querySelectorAll("nav a").forEach((a) => (a.getAttribute("href") === `#/${page}` ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.getElementById("language").textContent = language === "id" ? "English" : "Bahasa Indonesia";
  document.getElementById("query").placeholder = t("search");
  const pages = { kata: wordPage, potret: portraitPage, kuis: quizPage, peta: chartPage, balap: racePage, tahun: yearsPage, temuan: findingsPage, bergeser: moversPage, entitas: entitiesPage, cerita: storyPage, metode: methodPage };
  scrollTo(0, 0);
  Promise.resolve((pages[page] || homePage)(...args)).catch(() => view.replaceChildren(el(`<p>${t("no_data")}</p>`)));
}

function search() {
  const query = document.getElementById("query");
  const list = document.getElementById("suggestions");
  const go = (word) => {
    list.hidden = true;
    query.value = "";
    if (word) location.hash = href("kata", word);
  };
  query.addEventListener("input", async () => {
    const q = query.value.trim().toLowerCase();
    const seen = new Set();
    if (q) for (const lens of await allLenses()) for (const [w, i] of lens.index) if (w.startsWith(q) && lens.isEntry(i)) seen.add(w);
    const hits = [...seen].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 8);
    list.innerHTML = hits.map((w) => `<li>${link(w)}</li>`).join("");
    list.hidden = !hits.length;
  });
  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault();
    go(query.value.trim().toLowerCase());
  });
}

document.getElementById("language").addEventListener("click", () => {
  language = language === "id" ? "en" : "id";
  localStorage.setItem("language", language);
  route();
});
addEventListener("hashchange", () => {
  document.getElementById("suggestions").hidden = true;
  document.getElementById("query").value = "";
  route();
});
search();
route();
