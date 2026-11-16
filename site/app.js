// Jejak Kata: a static reader for the files written by `python -m idhist.export`.
// No build step and no dependencies. Routes: #/  #/kata/<word>  #/bergeser  #/metode

import { TEXT, LENS_TEXT, NOTES, FEATURED } from "./text.js";

const DATA = "data";
const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the colour steps
const view = document.getElementById("view");
const tip = document.getElementById("tip");

let language = localStorage.getItem("language") || "id";
const t = (key, ...args) => {
  const s = TEXT[language][key] ?? TEXT.id[key] ?? key;
  return typeof s === "function" ? s(...args) : s;
};

// ---- data ---------------------------------------------------------------

const cache = new Map();
const json = (path) => {
  if (!cache.has(path)) cache.set(path, fetch(`${DATA}/${path}`).then((r) => (r.ok ? r.json() : Promise.reject(path))));
  return cache.get(path);
};

/** Every lens with its meta and a word -> index map. */
const lenses = json("lenses.json").then((names) =>
  Promise.all(
    names.map(async (name) => {
      const meta = await json(`${name}/meta.json`);
      const names_ = new Set(meta.names);
      const index = new Map(meta.words.map((w, i) => [w, i]));
      return { ...meta, index, isEntry: (i) => i !== undefined && !names_.has(i) };
    }),
  ),
);

const entry = async (lens, i) => (await json(`${lens.lens}/words/${Math.floor(i / lens.bucket)}.json`)).find((e) => e.word === i);

// ---- small helpers --------------------------------------------------------

const el = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};
const link = (word) => `<a href="#/kata/${word}">${word}</a>`;
const number = (x, digits = 1) => x.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (share) => (share * 100).toLocaleString(language, { maximumSignificantDigits: 2 }) + "%";
const step = (shift) => STEPS.filter((s) => shift >= s).length;
const pairIndex = (lens, a, b) => lens.pairs.findIndex(([x, y]) => x === a && y === b);

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

// ---- charts ---------------------------------------------------------------

/** Share of units containing the word, per period. One series, so no legend. */
function frequencyChart(lens, e, chosen) {
  const W = Math.max(280, Math.min(640, view.clientWidth - 32)), H = 170, L = 44, R = 12, T = 10, B = 26;  // drawn at its real size, so text stays legible
  const n = lens.periods.length;
  const top = Math.max(...e.share) * 1.1 || 1;
  const x = (i) => L + ((W - L - R) * i) / (n - 1);
  const y = (v) => H - B - ((H - T - B) * v) / top;
  const every = Math.ceil(n / (W / 90));
  const svg = el(`<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("frequency")}">
    ${[0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}"/>
      <text x="${L - 6}" y="${y(top * f) + 4}" text-anchor="end">${percent(top * f)}</text>`).join("")}
    ${lens.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p}</text>`)).join("")}
    ${chosen.map((i) => `<line class="mark" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/>`).join("")}
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <polyline class="line" points="${e.share.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>
    ${e.share.map((v, i) => `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("")}
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
    return `${lens.periods[i]}: ${percent(e.share[i])} ${t("of_units", lens)}`;
  });
  plot.addEventListener("pointerleave", () => cross.setAttribute("visibility", "hidden"));
  return svg;
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
      x="${L + size * (b - 1) + 1}" y="${T + size * a + 1}" width="${size - 2}" height="${size - 2}" rx="3"/></svg>`).firstElementChild;
    hover(cell, `${lens.periods[a]} → ${lens.periods[b]}: ${s === null ? t("too_rare") : number(s)}`);
    if (s !== null) cell.addEventListener("click", () => choose(a, b));
    svg.append(cell);
  });
  return svg;
}

const legend = () => `<div class="legend">${[0, 1, 2, 3, 4, 5]
  .map((i) => `<span><i class="s${i}"></i>${i === 0 ? `< ${STEPS[0]}` : i === 5 ? `≥ ${STEPS[4]}` : `${STEPS[i - 1]}–${STEPS[i]}`}</span>`)
  .join("")}<span><i class="rare"></i>${t("too_rare")}</span></div>`;

// ---- pages ----------------------------------------------------------------

function words(lens, ids, before) {
  if (!ids.length) return `<p class="sub">${t("too_rare")}</p>`;
  const old = before && new Set(before);
  return `<ul class="words">${ids
    .map((i) => `<li class="${old && !old.has(i) ? "new" : ""}">${lens.isEntry(i) ? link(lens.words[i]) : lens.words[i]}</li>`)
    .join("")}</ul>`;
}

function lensSection(lens, e) {
  const section = el(`<section><h2>${LENS_TEXT[lens.lens][language].title}</h2><p class="sub">${LENS_TEXT[lens.lens][language].about}</p>
    ${lens.sensitivity ? `<p class="sub">${t("sensitivity", lens.sensitivity, percent)}</p>` : ""}<div></div></section>`);
  const body = section.lastElementChild;
  const scored = e.shift.map((s, k) => [s, k]).filter(([s]) => s !== null);
  const largest = scored.length ? lens.pairs[scored.reduce((m, c) => (c[0] > m[0] ? c : m))[1]] : [0, lens.periods.length - 1];

  const draw = (a, b) => {
    const s = e.shift[pairIndex(lens, a, b)];
    const options = (selected, from, to) =>
      lens.periods.map((p, i) => (i < from || i > to ? "" : `<option value="${i}" ${i === selected ? "selected" : ""}>${p}</option>`)).join("");
    body.replaceChildren(
      el(`<h3>${t("frequency")}</h3>`),
      el(`<p class="sub">${t("frequency_about", lens)}</p>`),
      frequencyChart(lens, e, [a, b]),
      el(`<h3>${t("matrix")}</h3>`),
      el(`<p class="sub">${t("matrix_about", lens.flag)}</p>`),
      shiftMatrix(lens, e, [a, b], draw),
      el(legend()),
      el(`<div class="controls"><label>${t("compare")} <select data-side="a">${options(a, 0, b - 1)}</select></label>
        <label>${t("with_period")} <select data-side="b">${options(b, a + 1, lens.periods.length - 1)}</select></label></div>`),
      el(`<p class="headline">${s === null ? t("too_rare_pair") : t("verdict", number(s), s >= lens.flag)}</p>`),
      el(`<div class="pair">${[a, b]
        .map((p, side) => `<div><h3>${lens.periods[p]}</h3>
          <p class="sub">${t("with")}</p>${words(lens, e.with[p], side ? e.with[a] : null)}
          <p class="sub">${t("like")}</p>${words(lens, e.like[p], side ? e.like[a] : null)}</div>`)
        .join("")}</div>`),
      el(`<details><summary>${t("all_periods")}</summary><table>
        <tr><th>${t("period")}</th><th class="n">${t("share")}</th><th>${t("with")}</th><th>${t("like")}</th></tr>
        ${lens.periods.map((p, i) => `<tr><td>${p}</td><td class="n">${percent(e.share[i])}</td>
          <td>${e.with[i].map((w) => lens.words[w]).join(", ")}</td><td>${e.like[i].map((w) => lens.words[w]).join(", ")}</td></tr>`).join("")}
      </table></details>`),
    );
    body.querySelectorAll("select").forEach((select) =>
      select.addEventListener("change", () => {
        const [na, nb] = [...body.querySelectorAll("select")].map((s) => +s.value);
        draw(na, nb);
      }),
    );
  };
  draw(...largest);
  return section;
}

async function wordPage(word) {
  const all = await lenses;
  const found = all.filter((lens) => lens.isEntry(lens.index.get(word)));
  view.replaceChildren(el(`<h1>${word}</h1>`));
  if (NOTES[word]) view.append(el(`<p class="note">${NOTES[word][language]}</p>`));
  if (!found.length) {
    const isName = all.some((lens) => lens.index.has(word));
    return view.append(el(`<p>${t(isName ? "is_name" : "not_found")}</p>`));
  }
  // One line per lens first: the largest shift there, and a jump to its section.
  const summary = el(`<ul class="featured"></ul>`);
  view.append(summary);
  for (const lens of found) {
    const e = await entry(lens, lens.index.get(word));
    const section = lensSection(lens, e);
    const largest = Math.max(...e.shift.filter((s) => s !== null));
    const jump = el(`<li><button type="button">${LENS_TEXT[lens.lens][language].title}: <b>${Number.isFinite(largest) ? number(largest) : "–"}</b></button></li>`);
    jump.firstElementChild.addEventListener("click", () => section.scrollIntoView({ behavior: "smooth" }));
    summary.append(jump);
    view.append(section);
  }
}

/** Lists per lens; a word also flagged between the same periods in another lens is marked. */
async function moversPage() {
  view.replaceChildren(el(`<h1>${t("nav_movers")}</h1>`), el(`<p class="note">${t("movers_about")}</p>`));
  const all = await Promise.all((await lenses).map(async (lens) => ({ lens, movers: await json(`${lens.lens}/movers.json`) })));
  const key = (lens, m) => `${lens.periods[m.a]}>${lens.periods[m.b]}`;
  const elsewhere = (lens, m, word) =>
    all.filter((o) => o.lens !== lens && o.movers.some((x) => key(o.lens, x) === key(lens, m) && x.words.some(([w]) => o.lens.words[w] === word)));
  for (const { lens, movers } of all) {
    const section = el(`<section><h2>${LENS_TEXT[lens.lens][language].title}</h2>
      <div class="controls"><label>${t("between")} <select>${movers
        .map((m, i) => `<option value="${i}">${lens.periods[m.a]} → ${lens.periods[m.b]}</option>`)
        .join("")}</select></label></div><p class="sub"></p><ul class="movers"></ul></section>`);
    const select = section.querySelector("select");
    const draw = () => {
      const m = movers[select.value];
      const rows = m.words.map(([w, s]) => ({ word: lens.words[w], s, also: elsewhere(lens, m, lens.words[w]) }));
      rows.sort((x, y) => y.also.length - x.also.length || y.s - x.s);
      section.querySelector("p").textContent = t("flagged", m.flagged, m.scored, lens.flag) + (rows.some((r) => r.also.length) ? " " + t("replicated") : "");
      section.querySelector("ul").innerHTML = rows
        .slice(0, 90)
        .map((r) => `<li title="${r.also.map((o) => LENS_TEXT[o.lens.lens][language].title).join("; ")}">${link(r.word)} <span>${number(r.s)}${"●".repeat(r.also.length)}</span></li>`)
        .join("");
    };
    select.value = movers.length - 1;
    select.addEventListener("change", draw);
    draw();
    view.append(section);
  }
}

async function homePage() {
  view.replaceChildren(
    el(`<h1>${t("title")}</h1>`),
    el(`<p>${t("intro")}</p>`),
    el(`<ul class="featured">${FEATURED.map((w) => `<li>${link(w)}</li>`).join("")}</ul>`),
    el(`<div>${t("caveats")}</div>`),
  );
}

const methodPage = () => view.replaceChildren(el(`<article>${t("method")}</article>`));

// ---- shell ----------------------------------------------------------------

function route() {
  tip.hidden = true;
  const [, page, argument] = decodeURIComponent(location.hash).split("/");
  document.documentElement.lang = language;
  document.querySelectorAll("[data-t]").forEach((node) => (node.innerHTML = t(node.dataset.t)));
  document.getElementById("language").textContent = language === "id" ? "English" : "Bahasa Indonesia";
  document.getElementById("query").placeholder = t("search");
  const pages = { kata: () => wordPage(argument), bergeser: moversPage, metode: methodPage };
  Promise.resolve((pages[page] || homePage)()).catch(() => view.replaceChildren(el(`<p>${t("no_data")}</p>`)));
}

function search() {
  const query = document.getElementById("query");
  const list = document.getElementById("suggestions");
  const go = (word) => {
    list.hidden = true;
    query.value = "";
    if (word) location.hash = `#/kata/${word}`;
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
    if (query.value.trim()) go(query.value.trim().toLowerCase());
  });
  addEventListener("hashchange", () => go(location.hash.split("/")[2] || ""));
}

document.getElementById("language").addEventListener("click", () => {
  language = language === "id" ? "en" : "id";
  localStorage.setItem("language", language);
  route();
});
addEventListener("hashchange", route);
search();
route();
