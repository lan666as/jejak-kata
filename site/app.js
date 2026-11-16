// Jejak Kata: a static reader for the files written by `python -m idhist.export`.
// No build step and no dependencies.
// Routes: #/  #/kata/<word>  #/banding/<word>/<word>  #/tahun  #/bergeser  #/entitas  #/cerita/<slug>  #/metode

import { TEXT, LENS_TEXT, NOTES, FEATURED, SHOWCASE, STORIES } from "./text.js";

const DATA = "data";
const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the colour steps
const WIKIPEDIA = "https://id.wikipedia.org/wiki/";
const BEAT = 1700; // milliseconds a player stays on one period
const view = document.getElementById("view");
const tip = document.getElementById("tip");

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

/** Every lens with its meta, a word -> index map, and which entries are entities (index -> Wikipedia article). */
const lenses = json("lenses.json").then((names) =>
  Promise.all(
    names.map(async (name) => {
      const meta = await json(`${name}/meta.json`);
      const hidden = new Set(meta.names);
      const index = new Map(meta.words.map((w, i) => [w, i]));
      const articles = new Map(Object.entries(meta.entities).map(([i, article]) => [+i, article]));
      const kind = (i) => meta.kinds[i] || "other";
      return { ...meta, index, articles, kind, isEntry: (i) => i !== undefined && !hidden.has(i) };
    }),
  ),
);
const lensNamed = async (name) => (await lenses).find((lens) => lens.lens === name);
const bucket = (lens, folder, i) => json(`${lens.lens}/${folder}/${Math.floor(i / lens.bucket)}.json`);
const entry = async (lens, i) => (await bucket(lens, "words", i)).find((e) => e.word === i);
const entryOf = (lens, word) => (lens.isEntry(lens.index.get(word)) ? entry(lens, lens.index.get(word)) : null);
const pathOf = async (lens, i) => (await bucket(lens, "paths", i).catch(() => [])).find((p) => p.word === i);
const highlights = (lens) => json(`${lens.lens}/highlights.json`);

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
/** Number the children of a node, so that CSS can bring them in one after another. */
const stagger = (node) => ([...node.children].forEach((child, i) => child.style.setProperty("--i", i)), node);

/** Count a number up to its value: a second of motion that says "this was counted". */
function countUp(node) {
  const target = +node.dataset.count, unit = node.dataset.unit || "", started = performance.now();
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / 1100);
    node.textContent = Math.round(target * (1 - (1 - progress) ** 3)).toLocaleString(language) + unit;
    if (progress < 1) requestAnimationFrame(frame);
  };
  node.textContent = target.toLocaleString(language) + unit;
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(frame);
}

function hover(node, text) {
  node.addEventListener("pointermove", (e) => {
    tip.textContent = typeof text === "function" ? text(e) : text;
    tip.hidden = false;
    const width = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(e.clientX + 12, innerWidth - width - 4)) + "px";
    tip.style.top = e.clientY + 14 + "px";
  });
  node.addEventListener("pointerleave", () => (tip.hidden = true));
}

/** A row of buttons of which one is pressed; `show(i)` is called for the pressed one. */
function tabs(labels, show, first = 0, cls = "") {
  const list = el(`<ul class="tabs ${cls}">${labels.map((label) => `<li><button type="button">${label}</button></li>`).join("")}</ul>`);
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
function switcher(labels, content, first = 0, cls = "") {
  const holder = el("<div></div>");
  const box = el("<div></div>");
  const show = async (i) => holder.replaceChildren(await Promise.resolve(content(i)).catch(() => el(`<p class="sub">${t("no_data")}</p>`)));
  box.append(tabs(labels, show, first, cls), holder);
  return box;
}

/**
 * The one control for everything that moves through time: play, a slider, and the period in large type.
 * `show(i)` draws period `labels[i]`. It starts by itself the first time it scrolls into view, and stops at the end.
 */
function player(labels, show, start = 0) {
  const node = el(`<div class="player"><button type="button" aria-label="${t("play")}">▶</button>
    <input type="range" min="0" max="${labels.length - 1}" value="${start}" aria-label="${t("period")}"><output></output></div>`);
  const [button, slider, output] = node.children;
  let timer = null;
  const go = (i) => {
    slider.value = i;
    output.textContent = labels[i];
    show(i);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    button.textContent = "▶";
  };
  const play = () => {
    if (+slider.value >= labels.length - 1) go(0);
    button.textContent = "❚❚";
    timer = setInterval(() => {
      if (!node.isConnected || +slider.value >= labels.length - 1) return stop();
      go(+slider.value + 1);
    }, BEAT);
  };
  button.addEventListener("click", () => (timer ? stop() : play()));
  slider.addEventListener("input", () => (stop(), go(+slider.value)));
  go(start);
  if (labels.length > 2 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.disconnect();
        go(0);
        play();
      },
      { threshold: 0.9 },
    );
    seen.observe(node);
  }
  return node;
}

// ---- charts ---------------------------------------------------------------

/** Share of units containing each word, per period. `series` is one entry, or two when words are compared. */
function frequencyChart(lens, series, chosen = []) {
  const W = Math.max(280, Math.min(640, view.clientWidth - 32)), H = 180, L = 44, R = 12, T = 10, B = 26; // drawn at its real size, so text stays legible
  const n = lens.periods.length;
  const top = Math.max(...series.flatMap((e) => e.share)) * 1.1 || 1;
  const x = (i) => L + ((W - L - R) * i) / (n - 1);
  const y = (v) => H - B - ((H - T - B) * v) / top;
  const every = Math.ceil(n / (W / 90));
  const points = (e) => e.share.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const svg = el(`<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("frequency")}">
    ${[0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}"/>
      <text x="${L - 6}" y="${y(top * f) + 4}" text-anchor="end">${percent(top * f)}</text>`).join("")}
    ${lens.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p}</text>`)).join("")}
    ${chosen.map((i) => `<line class="mark" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/>`).join("")}
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    ${series.map((e, k) => `<polygon class="area k${k}" points="${x(0)},${y(0)} ${points(e)} ${x(n - 1)},${y(0)}"/>
      <polyline class="line draw k${k}" pathLength="1" points="${points(e)}"/>
      ${e.share.map((v, i) => `<circle class="dot k${k}" style="--i:${i}" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("")}`).join("")}
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
  </svg>`);
  const cross = svg.querySelector(".cross");
  const nearest = (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
  };
  const plot = svg.querySelector("rect");
  hover(plot, (ev) => {
    const i = nearest(ev);
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    cross.setAttribute("visibility", "visible");
    const values = series.map((e) => (series.length > 1 ? `${lens.words[e.word]} ${percent(e.share[i])}` : percent(e.share[i])));
    return `${lens.periods[i]}: ${values.join(" · ")} ${t("of_units", lens)}`;
  });
  plot.addEventListener("pointerleave", () => cross.setAttribute("visibility", "hidden"));
  if (series.length === 1) return svg;
  const figure = el(`<div><div class="legend">${series.map((e, k) => `<span><i class="k${k}"></i>${lens.words[e.word]}</span>`).join("")}</div></div>`);
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
    const cell = el(`<svg><rect class="cell ${s === null ? "rare" : "s" + step(s)} ${a === chosen[0] && b === chosen[1] ? "chosen" : ""}" style="--i:${k}"
      x="${L + size * (b - 1) + 1}" y="${T + size * a + 1}" width="${size - 2}" height="${size - 2}" rx="4"/></svg>`).firstElementChild;
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
 * the words that keep company like it. Moving through the periods, a word that stays keeps its place, a new one
 * flies in from the middle and is marked, one that leaves drifts out.
 */
function orbit(lens, e) {
  const periods = known(e);
  const box = el(`<div><div class="orbit"><div class="core">${lens.words[e.word]}</div></div></div>`);
  const ring = box.firstElementChild;
  new ResizeObserver(() => ring.style.setProperty("--r", ring.clientWidth / 2 + "px")).observe(ring);
  const rings = { with: { size: 10, radius: [0.5, 0.64], cls: "" }, like: { size: 8, radius: [0.9, 0.9], cls: "like" } };
  const placed = { with: new Map(), like: new Map() }; // word id -> its chip and slot
  const show = (k) => {
    for (const [name, { size, radius, cls }] of Object.entries(rings)) {
      const now = e[name][periods[k]].slice(0, size);
      const here = placed[name];
      for (const [id, { node }] of here) {
        node.classList.remove("new");
        if (now.includes(id)) continue;
        node.classList.add("out");
        setTimeout(() => node.remove(), 700);
        here.delete(id);
      }
      const taken = new Set([...here.values()].map((v) => v.slot));
      const free = [...Array(size).keys()].filter((s) => !taken.has(s));
      for (const id of now) {
        if (here.has(id)) continue;
        const slot = free.shift();
        const angle = (2 * Math.PI * (slot + (name === "like" ? 0.5 : 0))) / size - Math.PI / 2;
        const r = radius[slot % 2];
        const word = lens.words[id];
        const node = el(lens.isEntry(id) ? `<a class="${cls} in" href="${href("kata", word)}">${word}</a>` : `<a class="${cls} in">${word}</a>`);
        node.style.setProperty("--x", `calc(var(--r) * ${(r * Math.cos(angle)).toFixed(3)})`);
        node.style.setProperty("--y", `calc(var(--r) * ${(r * Math.sin(angle)).toFixed(3)})`);
        if (k > 0) node.classList.add("new");
        ring.append(node);
        requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove("in")));
        here.set(id, { node, slot });
      }
    }
  };
  box.append(player(periods.map((p) => lens.periods[p]), show), el(`<p class="sub">${t("orbit_about")}</p>`));
  return box;
}

/**
 * The path of a word among its neighbours, after the figure in Hamilton, Leskovec and Jurafsky (2016). The
 * neighbours do not move; the word is drawn where it stands among them in each period.
 */
function pathChart(lens, path) {
  const W = Math.max(300, Math.min(640, view.clientWidth - 32)), H = Math.round(W * 0.78), P = 46;
  // With many periods each step is averaged with its neighbours: single years jitter more than they move.
  const raw = path.path.map((xy, p) => xy && { p, xy }).filter(Boolean);
  const smooth = (k, d) => (raw.length > 6 && k > 0 && k < raw.length - 1 ? (raw[k - 1].xy[d] + 2 * raw[k].xy[d] + raw[k + 1].xy[d]) / 4 : raw[k].xy[d]);
  const moved = raw.map((r, k) => [smooth(k, 0), smooth(k, 1)]);
  const all = [...path.at, ...moved];
  const scale = (d, size, pad) => {
    const low = Math.min(...all.map((xy) => xy[d])), high = Math.max(...all.map((xy) => xy[d]));
    return (v) => pad + ((size - 2 * pad) * (v - low)) / (high - low || 1);
  };
  const x = scale(0, W, P + 30), y = scale(1, H, P);
  const steps = moved.map((xy, k) => ({ p: raw[k].p, x: x(xy[0]), y: y(xy[1]) }));
  // A smooth line through the steps (Catmull-Rom as Bézier curves).
  const at = (k) => steps[Math.max(0, Math.min(steps.length - 1, k))];
  const curve = steps.slice(1).map((s, k) => {
    const [p0, p1, p2, p3] = [at(k - 1), at(k), s, at(k + 2)];
    return `C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }).join(" ");
  // Labels of neighbours that would print over each other are moved down.
  const marks = path.near.map((id, k) => ({ id, late: k >= path.early, x: x(path.at[k][0]), y: y(path.at[k][1]) })).sort((m, n) => m.y - n.y);
  marks.forEach((m, k) => {
    m.label = m.y + 4;
    for (const above of marks.slice(0, k)) if (Math.abs(above.x - m.x) < 120 && m.label - above.label < 14) m.label = above.label + 14;
  });
  const svg = el(`<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("path")}">
    <defs><marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker></defs>
    ${marks.map((m) => `<circle class="landmark ${m.late ? "late" : ""}" cx="${m.x}" cy="${m.y}" r="4"/>
      <text class="landmark-label" x="${m.x + (m.x > W / 2 ? -8 : 8)}" y="${m.label}" text-anchor="${m.x > W / 2 ? "end" : "start"}">${lens.words[m.id]}</text>`).join("")}
    <path class="path-line draw" pathLength="1" marker-end="url(#head)" d="M${steps[0].x},${steps[0].y} ${curve}"/>
    ${steps.map((s) => `<circle class="path-step" cx="${s.x}" cy="${s.y}" r="3"/>`).join("")}
    ${[steps[0], steps.at(-1)].map((s) => `<text class="step-label" x="${s.x}" y="${s.y - 12}" text-anchor="middle">${lens.periods[s.p]}</text>`).join("")}
    <circle class="path-halo" r="16" cx="${steps[0].x}" cy="${steps[0].y}"/><circle class="path-now" r="7" cx="${steps[0].x}" cy="${steps[0].y}"/>
  </svg>`);
  const [halo, now] = [svg.querySelector(".path-halo"), svg.querySelector(".path-now")];
  const box = el(`<div><div class="legend"><span><i class="early"></i>${t("near_early", lens.periods[steps[0].p])}</span>
    <span><i class="late"></i>${t("near_late", lens.periods[steps.at(-1).p])}</span></div></div>`);
  const show = (k) => [halo, now].forEach((c) => (c.setAttribute("cx", steps[k].x), c.setAttribute("cy", steps[k].y)));
  box.append(svg, player(steps.map((s) => lens.periods[s.p]), show, steps.length - 1), el(`<p class="sub">${t("path_about")}</p>`));
  return box;
}

/** Who is mentioned most, period by period: bars that overtake each other. `focus` is drawn in the accent. */
function race(lens, entries, focus, rows = 10) {
  const ROW = 34;
  const top = Math.max(...entries.flatMap((e) => e.share));
  const box = el(`<div><div class="race" style="height:${ROW * rows + 8}px"><div class="year"></div>
    ${entries.map((e) => `<div class="row ${lens.words[e.word] === focus ? "focus" : ""}"><span class="name">${link(lens.words[e.word])}</span>
      <span class="track"><span class="bar"></span><span class="value"></span></span></div>`).join("")}</div></div>`);
  const nodes = [...box.querySelectorAll(".row")];
  const show = (p) => {
    box.querySelector(".year").textContent = lens.periods[p];
    const order = entries.map((e, k) => k).sort((a, b) => entries[b].share[p] - entries[a].share[p]);
    order.forEach((k, rank) => {
      const share = entries[k].share[p];
      nodes[k].style.transform = `translateY(${Math.min(rank, rows) * ROW}px)`;
      nodes[k].style.opacity = rank < rows && share > 0 ? 1 : 0;
      nodes[k].querySelector(".bar").style.width = (78 * share) / top + "%";
      nodes[k].querySelector(".value").textContent = percent(share);
    });
  };
  box.append(player(lens.periods, show));
  return box;
}

/** One small chart per word: when it arrived, when it peaked. */
function sparks(lens, entries) {
  const W = 150, H = 44;
  return stagger(el(`<ul class="sparks">${entries.map((e) => {
    const top = Math.max(...e.share), peak = e.share.indexOf(top), n = e.share.length;
    const points = e.share.map((v, i) => `${(W * i) / (n - 1)},${H - 4 - ((H - 8) * v) / top}`).join(" ");
    return `<li><a class="card" href="${href("kata", lens.words[e.word])}"><b>${lens.words[e.word]}</b>
      <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" aria-hidden="true">
        <polygon class="spark-area" points="0,${H} ${points} ${W},${H}"/><polyline class="spark-line draw" pathLength="1" points="${points}"/></svg>
      <small>${t("peak", lens.periods[peak], percent(top))}</small></a></li>`;
  }).join("")}</ul>`));
}

/** A period in its own words: the words that belong to it more than to any other. */
async function years(lens) {
  const { peaks } = await highlights(lens);
  const box = el(`<div class="years"><div class="big"></div><ul class="words"></ul></div>`);
  const show = (p) => {
    box.querySelector(".big").textContent = lens.periods[p];
    const list = box.querySelector("ul");
    list.innerHTML = peaks[p].slice(0, 24).map((w) => `<li>${link(lens.words[w])}</li>`).join("");
    list.className = "words stagger";
    stagger(list);
  };
  box.append(player(lens.periods, show, lens.periods.length - 1));
  return box;
}

/** The adjectives that keep each name company, period by period; null if the lens has none for these names. */
async function traits(lens, names) {
  const found = (await highlights(lens)).traits;
  const rows = names.filter((w) => found[lens.index.get(w)]?.some((list) => list.length));
  if (!rows.length) return null;
  return el(`<table><tr><th>${t("name")}</th>${lens.periods.map((p) => `<th>${p}</th>`).join("")}</tr>
    ${rows.map((w) => `<tr><td>${link(w)}</td>${found[lens.index.get(w)]
      .map((list) => `<td>${list.slice(0, 5).map((a) => lens.words[a]).join(", ") || "–"}</td>`).join("")}</tr>`).join("")}</table>`);
}

// ---- pieces of pages ------------------------------------------------------

/** A list of words; those absent from `other` are marked as gained ("new") or lost ("gone"). */
function words(lens, ids, other, mark) {
  if (!ids.length) return `<p class="sub">${t("too_rare")}</p>`;
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

/** A word in one lens, up to four ways: its path among its neighbours, its company in orbit, the numbers, and for a name its adjectives. */
async function lensSection(lens, e) {
  const section = el(`<section><p class="sub">${lensText(lens).about}
    ${lens.sensitivity ? t("sensitivity", lens.sensitivity, percent) : ""}</p></section>`);
  const path = await pathOf(lens, e.word);
  const adjectives = lens.articles.has(e.word) ? await traits(lens, [lens.words[e.word]]).catch(() => null) : null;
  const described = () => {
    const box = el(`<div><p class="sub">${t("traits_about")}</p></div>`);
    box.append(adjectives);
    return box;
  };
  const views = [
    path && [t("path"), () => pathChart(lens, path)],
    known(e).length > 1 && [t("orbit"), () => orbit(lens, e)],
    [t("numbers"), () => numbers(lens, e)],
    adjectives && [t("traits"), described],
  ].filter(Boolean);
  section.append(switcher(views.map((v) => v[0]), (i) => views[i][1](), 0, "small"));
  return section;
}

/** One lens at a time: a tab per lens, labelled with what `label(lens)` returns, showing `section(lens)`. */
async function perLens(found, label, section, first = 0) {
  view.append(switcher(await Promise.all(found.map(label)), (i) => section(found[i]), first));
}

// ---- pages ----------------------------------------------------------------

async function wordPage(word) {
  const all = await lenses;
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
  const most = found.reduce((best, lens, k) => (largest(entries.get(lens).shift) > largest(entries.get(found[best]).shift) ? k : best), 0);
  await perLens(
    found,
    (lens) => `${lensText(lens).title} <b>${Number.isFinite(largest(entries.get(lens).shift)) ? number(largest(entries.get(lens).shift)) : "–"}</b>`,
    (lens) => lensSection(lens, entries.get(lens)),
    most,
  );

  const form = el(`<form class="controls"><label>${t("compare_word")} <input type="search" required></label><button>${t("go")}</button></form>`);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = href("banding", word, form.querySelector("input").value.trim().toLowerCase());
  });
  view.append(form);
}

/** Two words side by side in every lens that has both. */
async function comparePage(first, second) {
  const all = await lenses;
  const found = all.filter((lens) => [first, second].every((w) => lens.isEntry(lens.index.get(w))));
  view.replaceChildren(el(`<h1>${link(first)} · ${link(second)}</h1>`));
  if (!found.length) return view.append(el(`<p>${t("not_together")}</p>`));
  await perLens(found, (lens) => lensText(lens).title, async (lens) => {
    const pair = await Promise.all([first, second].map((w) => entryOf(lens, w)));
    const section = el(`<section><p class="sub">${lensText(lens).about}</p><h3>${t("frequency")}</h3><p class="sub">${t("frequency_about", lens)}</p></section>`);
    section.append(frequencyChart(lens, pair));
    const shared = (p) => pair[0].with[p].filter((i) => pair[1].with[p].includes(i));
    section.append(
      el(`<h3>${t("company_by_period")}</h3>`),
      el(`<p class="sub">${t("shared_about")}</p>`),
      el(`<table><tr><th>${t("period")}</th><th>${first}</th><th>${second}</th></tr>${lens.periods
        .map((p, i) => `<tr><td>${p}</td>${pair.map((e) => `<td>${e.with[i].map((w) => (shared(i).includes(w) ? `<b>${lens.words[w]}</b>` : lens.words[w])).join(", ")}</td>`).join("")}</tr>`)
        .join("")}</table>`),
    );
    return section;
  });
}

/** Each period in its own words. */
async function yearsPage() {
  const found = await lenses;
  view.replaceChildren(el(`<h1>${t("nav_years")}</h1>`), el(`<p class="lede">${t("years_about")}</p>`));
  const first = Math.max(0, found.findIndex((lens) => lens.lens === "id-web-news-kompas"));
  view.append(switcher(found.map((lens) => lensText(lens).title), (i) => years(found[i]), first));
}

/** Lists per lens; a word also flagged between the same periods in another lens is marked. */
async function moversPage() {
  const all = await Promise.all((await lenses).map(async (lens) => ({ lens, movers: await json(`${lens.lens}/movers.json`) })));
  const key = (lens, m) => `${lens.periods[m.a]}>${lens.periods[m.b]}`;
  const elsewhere = (lens, m, word) =>
    all.filter((o) => o.lens !== lens && o.movers.some((x) => key(o.lens, x) === key(lens, m) && x.words.some(([w]) => o.lens.words[w] === word)));
  view.replaceChildren(el(`<h1>${t("nav_movers")}</h1>`), el(`<p class="note">${t("movers_about")}</p>`));
  await perLens(all.map((o) => o.lens), (lens) => lensText(lens).title, (lens) => {
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
  const found = (await lenses).filter((lens) => lens.articles.size);
  const kinds = ["person", "organisation", "place", "other"];
  view.replaceChildren(el(`<h1>${t("nav_entities")}</h1>`), el(`<p class="note">${t("entities_about")}</p>`));
  const first = Math.max(0, found.findIndex((lens) => lens.lens === "id-web-news-kompas"));
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
        .map((names) => `<li>${names.map(link).join(" · ")}</li>`)
        .join("");
    };
    input.addEventListener("input", draw);
    const pick = (i) => {
      kind = kinds[i];
      draw();
    };
    box.append(tabs(kinds.map((k) => `<span class="dot ${k}"></span> ${t("kind_" + k)}`), pick, 0, "small"), list);
    return box;
  };
  view.append(switcher(found.map((lens) => lensText(lens).title), (k) => section(found[k]), first));
}

/** The scenes a story is made of. Each takes the scene's settings and returns what to show. */
const SCENES = {
  async race({ lens: name, words: list, focus }) {
    const lens = await lensNamed(name);
    return race(lens, (await Promise.all(list.map((w) => entryOf(lens, w)))).filter(Boolean), focus);
  },
  async path({ lens: name, word }) {
    const lens = await lensNamed(name);
    return pathChart(lens, await pathOf(lens, lens.index.get(word)));
  },
  async orbit({ lens: name, word }) {
    const lens = await lensNamed(name);
    return orbit(lens, await entryOf(lens, word));
  },
  async sparks({ lens: name, words: list }) {
    const lens = await lensNamed(name);
    return sparks(lens, (await Promise.all(list.map((w) => entryOf(lens, w)))).filter(Boolean));
  },
  async traits({ lens: name, words: list }) {
    return traits(await lensNamed(name), list);
  },
  async years({ lens: name }) {
    return years(await lensNamed(name));
  },
  /** Chosen words between two periods: the shift in every lens named, and the company gained and lost in the first. */
  async table({ lenses: names, periods, groups }) {
    const chosen = await Promise.all(names.map(lensNamed));
    const [first] = chosen;
    const at = (lens) => pairIndex(lens, ...periods.map((p) => lens.periods.indexOf(p)));
    const score = (s) => (s === null || s === undefined ? "–" : `<span class="score"><i class="s${step(s)}"></i>${number(s)}</span>`);
    const box = el(`<div><p class="sub">${periods.join(" → ")}. ${t("story_columns", lensText(first).title)} ${t("marks")}</p></div>`);
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

/** A story: a title, and scenes, each with a heading, a few words of text and one thing to watch. */
async function storyPage(slug) {
  const story = STORIES.find((s) => s.slug === slug);
  view.replaceChildren(el(`<p class="kicker">${t("stories")}</p>`), el(`<h1>${story[language].title}</h1>`), el(`<div class="lede">${story[language].intro}</div>`));
  for (const scene of story.scenes) {
    const section = el(`<section class="scene"><h2>${scene[language].title}</h2><div>${scene[language].text}</div><div class="card"></div></section>`);
    view.append(section);
    const shown = await SCENES[scene.type](scene).catch(() => null);
    section.lastElementChild.append(shown || el(`<p class="sub">${t("no_data")}</p>`));
  }
  if (story[language].outro) view.append(el(`<div>${story[language].outro}</div>`));
}

/** A word then and now, one word after another: the first and the last period it is known in. */
function showcase() {
  const box = el(`<div class="card"><div class="showcase"></div></div>`);
  let k = 0;
  const next = async () => {
    if (k && !box.isConnected) return;
    const [word, name] = SHOWCASE[k++ % SHOWCASE.length];
    const lens = await lensNamed(name);
    const e = lens && (await entryOf(lens, word));
    if (e) {
      const periods = known(e), [a, b] = [periods[0], periods.at(-1)];
      const side = (p) => `<div><small>${lens.periods[p]}</small>${words(lens, e.with[p].slice(0, 6), e.with[p === a ? b : a], p === a ? "gone" : "new")}</div>`;
      box.firstElementChild.innerHTML = `<div><a class="word" href="${href("kata", word)}">${word}</a><small>${lensText(lens).title}</small></div>
        <div class="arrow" aria-hidden="true">→</div><div>${side(a)}${side(b)}</div>`;
    }
    setTimeout(next, 5200);
  };
  next();
  return box;
}

async function homePage() {
  const all = await lenses;
  const total = all.filter((l) => !/-(tribun|okezone|kompas|tempo)$/.test(l.lens)).reduce((sum, l) => sum + l.units.reduce((x, y) => x + y), 0);
  const names = new Set(all.flatMap((l) => [...l.articles.values()])).size;
  const kompas = await lensNamed("id-web-news-kompas");
  const random = el(`<button type="button">${t("random")}</button>`);
  random.addEventListener("click", async () => {
    const pool = (await highlights(kompas)).peaks.flat();
    location.hash = href("kata", kompas.words[pool[Math.floor(Math.random() * pool.length)]]);
  });
  const hero = el(`<section class="hero"><p class="kicker">${t("kicker")}</p><h1>${t("title")}</h1><p class="lede">${t("intro")}</p></section>`);
  const stats = el(`<ul class="stats"><li><b data-count="${Math.round(total / 1e6)}" data-unit=" ${t("million")}"></b><span>${t("stat_units")}</span></li>
    <li><b data-count="${all.length}"></b><span>${t("stat_lenses")}</span></li><li><b data-count="${names}"></b><span>${t("stat_names")}</span></li>
    <li><b>1910–2026</b><span>${t("stat_span")}</span></li></ul>`);
  stats.querySelectorAll("[data-count]").forEach(countUp);
  hero.append(showcase(), stats);
  const year = el(`<section><h2>${t("nav_years")}</h2><p class="sub">${t("years_about")}</p><div class="card"></div></section>`);
  if (kompas) year.lastElementChild.append(await years(kompas).catch(() => ""));
  const featured = el(`<section><h2>${t("try")}</h2><ul class="featured">${FEATURED.map((w) => `<li>${link(w)}</li>`).join("")}</ul></section>`);
  stagger(featured.lastElementChild).classList.add("stagger");
  if (kompas) featured.append(random);
  view.replaceChildren(
    hero,
    el(`<section><h2>${t("stories")}</h2><ul class="cards">${STORIES.map((s) => `<li><a class="card" href="${href("cerita", s.slug)}"><b>${s[language].title}</b><span>${s[language].teaser}</span></a></li>`).join("")}</ul></section>`),
    year,
    featured,
    el(`<section>${t("caveats")}</section>`),
  );
}

/** How it works, and what the planted-change test found each lens can see. */
async function methodPage() {
  view.replaceChildren(el(`<article>${t("method")}</article>`));
  const tested = (await lenses).filter((lens) => lens.sensitivity);
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
  tip.hidden = true;
  const [, page, ...args] = location.hash.split("/").map(decodeURIComponent);
  document.documentElement.lang = language;
  document.querySelectorAll("[data-t]").forEach((node) => (node.innerHTML = t(node.dataset.t)));
  document.querySelectorAll("nav a").forEach((a) => (a.getAttribute("href") === `#/${page}` ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.getElementById("language").textContent = language === "id" ? "English" : "Bahasa Indonesia";
  document.getElementById("query").placeholder = t("search");
  const pages = { kata: wordPage, banding: comparePage, tahun: yearsPage, bergeser: moversPage, entitas: entitiesPage, cerita: storyPage, metode: methodPage };
  scrollTo(0, 0);
  Promise.resolve((pages[page] || homePage)(...args))
    .then(() => stagger(view))
    .catch(() => view.replaceChildren(el(`<p>${t("no_data")}</p>`)));
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
    if (q) for (const lens of await lenses) for (const [w, i] of lens.index) if (w.startsWith(q) && lens.isEntry(i)) seen.add(w);
    const hits = [...seen].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 8);
    list.innerHTML = hits.map((w) => `<li>${link(w)}</li>`).join("");
    list.hidden = !hits.length;
  });
  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault();
    go(query.value.trim().toLowerCase());
  });
  addEventListener("hashchange", () => go(""));
}

document.getElementById("language").addEventListener("click", () => {
  language = language === "id" ? "en" : "id";
  localStorage.setItem("language", language);
  route();
});
addEventListener("hashchange", route);
search();
route();
