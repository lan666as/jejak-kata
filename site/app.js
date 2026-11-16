// Jejak Kata: a static reader for the files written by `python -m idhist.export`.
// No build step and no dependencies.
// Routes: #/  #/kata/<word>  #/banding/<word>/<word>  #/bergeser  #/entitas  #/cerita/<id>  #/metode

import { TEXT, LENS_TEXT, NOTES, FEATURED, STORIES } from "./text.js";

const DATA = "data";
const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the colour steps
const WIKIPEDIA = "https://id.wikipedia.org/wiki/";
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

const entry = async (lens, i) => (await json(`${lens.lens}/words/${Math.floor(i / lens.bucket)}.json`)).find((e) => e.word === i);
const entryOf = (lens, word) => (lens.isEntry(lens.index.get(word)) ? entry(lens, lens.index.get(word)) : null);

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

// ---- charts ---------------------------------------------------------------

/** Share of units containing each word, per period. `series` is one entry, or two when words are compared. */
function frequencyChart(lens, series, chosen = []) {
  const W = Math.max(280, Math.min(640, view.clientWidth - 32)), H = 170, L = 44, R = 12, T = 10, B = 26; // drawn at its real size, so text stays legible
  const n = lens.periods.length;
  const top = Math.max(...series.flatMap((e) => e.share)) * 1.1 || 1;
  const x = (i) => L + ((W - L - R) * i) / (n - 1);
  const y = (v) => H - B - ((H - T - B) * v) / top;
  const every = Math.ceil(n / (W / 90));
  const svg = el(`<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${t("frequency")}">
    ${[0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}"/>
      <text x="${L - 6}" y="${y(top * f) + 4}" text-anchor="end">${percent(top * f)}</text>`).join("")}
    ${lens.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p}</text>`)).join("")}
    ${chosen.map((i) => `<line class="mark" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/>`).join("")}
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    ${series.map((e, k) => `<polyline class="line k${k}" points="${e.share.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>
      ${e.share.map((v, i) => `<circle class="dot k${k}" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("")}`).join("")}
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

function lensSection(lens, e) {
  const section = el(`<section><p class="sub">${lensText(lens).about}
    ${lens.sensitivity ? t("sensitivity", lens.sensitivity, percent) : ""}</p><div></div></section>`);
  const body = section.lastElementChild;
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
  return section;
}

/** One lens at a time: a tab per lens, labelled with what `label(lens, i)` returns, showing `section(lens, i)`. */
async function perLens(found, label, section) {
  const holder = el("<div></div>");
  const labels = await Promise.all(found.map(label));
  view.append(tabs(labels, async (i) => holder.replaceChildren(await section(found[i])), 0), holder);
}

// ---- pages ----------------------------------------------------------------

async function wordPage(word) {
  const all = await lenses;
  const found = all.filter((lens) => lens.isEntry(lens.index.get(word)));
  view.replaceChildren(el(`<h1>${escape(word)}</h1>`));
  if (!found.length) return view.append(el(`<p>${t(all.some((lens) => lens.index.has(word)) ? "is_name" : "not_found")}</p>`));

  const article = found.map((lens) => lens.articles.get(lens.index.get(word))).find(Boolean);
  if (article) {
    const same = new Set(found.flatMap((lens) => [...lens.articles].filter(([i, a]) => a === article && lens.isEntry(i)).map(([i]) => lens.words[i])));
    same.delete(word);
    view.append(el(`<p class="note">${t("entity", `<a href="${WIKIPEDIA}${encodeURIComponent(article.replaceAll(" ", "_"))}">${escape(article)}</a>`)}
      ${same.size ? t("also_written", [...same].map(link).join(", ")) : ""}</p>`));
  }
  if (NOTES[word]) view.append(el(`<p class="note">${NOTES[word][language]}</p>`));

  const entries = new Map(await Promise.all(found.map(async (lens) => [lens, await entryOf(lens, word)])));
  await perLens(
    found,
    (lens) => `${lensText(lens).title} <b>${Number.isFinite(largest(entries.get(lens).shift)) ? number(largest(entries.get(lens).shift)) : "–"}</b>`,
    (lens) => lensSection(lens, entries.get(lens)),
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
        .map((r) => `<li title="${r.also.map((o) => lensText(o.lens).title).join("; ")}">${link(r.word)} <span>${number(r.s)}${"●".repeat(r.also.length)}</span></li>`)
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
  view.replaceChildren(el(`<h1>${t("nav_entities")}</h1>`), el(`<p class="note">${t("entities_about")}</p>`));
  await perLens(found, (lens) => lensText(lens).title, (lens) => {
    const section = el(`<section><div class="controls">
      <label>${t("show")} <select>${["person", "organisation", "place", "other"].map((k) => `<option value="${k}">${t("kind_" + k)}</option>`).join("")}</select></label>
      <label>${t("filter")} <input type="search"></label></div><ul class="movers"></ul></section>`);
    const [kind, input] = section.querySelectorAll("select, input");
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const byArticle = new Map();
      for (const [i, article] of [...lens.articles].sort((x, y) => x[0] - y[0]))
        if (lens.kind(i) === kind.value) byArticle.set(article, [...(byArticle.get(article) || []), lens.words[i]]);
      section.querySelector("ul").innerHTML = [...byArticle.values()]
        .filter((names) => !q || names.some((name) => name.includes(q)))
        .slice(0, 300)
        .map((names) => `<li>${names.map(link).join(" · ")}</li>`)
        .join("");
    };
    kind.addEventListener("change", draw);
    input.addEventListener("input", draw);
    draw();
    return section;
  });
}

/** A story: chosen words between two periods, each with its shift in every lens of the story and the company it gained and lost in the first. */
async function storyPage(id) {
  const story = STORIES.find((s) => s.slug === id);
  const all = await lenses;
  const chosen = story.lenses.map((name) => all.find((l) => l.lens === name));
  const [first] = chosen;
  const at = (lens) => pairIndex(lens, ...story.periods.map((p) => lens.periods.indexOf(p)));
  const score = (s) => (s === null || s === undefined ? "–" : `<span class="score"><i class="s${step(s)}"></i>${number(s)}</span>`);
  view.replaceChildren(
    el(`<h1>${story[language].title}</h1>`),
    el(`<div>${story[language].intro}</div>`),
    el(`<p class="sub">${story.periods.join(" → ")}. ${t("story_columns", lensText(first).title)} ${t("marks")}</p>`),
  );
  for (const group of story.groups) {
    const rows = await Promise.all(
      group.words.map(async (word) => {
        const entries = await Promise.all(chosen.map((lens) => entryOf(lens, word)));
        const shifts = entries.map((e, k) => `<td class="n">${score(e && e.shift[at(chosen[k])])}</td>`).join("");
        const [a, b] = story.periods.map((p) => first.periods.indexOf(p));
        return `<tr><td>${entries.some(Boolean) ? link(word) : word}</td>${shifts}<td class="turnover">${entries[0] ? turnover(first, entries[0], a, b) : ""}</td></tr>`;
      }),
    );
    view.append(el(`<section><h2>${group[language]}</h2>
      <table><tr><th>${t("word")}</th>${chosen.map((lens) => `<th class="n">${lensText(lens).short || t("shift")}</th>`).join("")}<th>${t("gained_lost")}</th></tr>${rows.join("")}</table></section>`));
  }
  if (story[language].outro) view.append(el(`<div>${story[language].outro}</div>`));
}

async function homePage() {
  view.replaceChildren(
    el(`<h1>${t("title")}</h1>`),
    el(`<p>${t("intro")}</p>`),
    el(`<h2>${t("stories")}</h2>`),
    el(`<ul class="featured">${STORIES.map((s) => `<li><a href="${href("cerita", s.slug)}">${s[language].title}</a></li>`).join("")}</ul>`),
    el(`<h2>${t("try")}</h2>`),
    el(`<ul class="featured">${FEATURED.map((w) => `<li>${link(w)}</li>`).join("")}</ul>`),
    el(`<div>${t("caveats")}</div>`),
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
  document.getElementById("language").textContent = language === "id" ? "English" : "Bahasa Indonesia";
  document.getElementById("query").placeholder = t("search");
  const pages = { kata: wordPage, banding: comparePage, bergeser: moversPage, entitas: entitiesPage, cerita: storyPage, metode: methodPage };
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
