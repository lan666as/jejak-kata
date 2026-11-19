// node tests/site/captions.mjs [<data dir>] [slug ...]   Holds every number a story writes to what its figure shows.
// For each step of each scene, in Indonesian and in English, the figure is worked out from the data the way the site
// draws it (site/scenes.js, the same code): the plate the step shows, at its moment, the rows it brings forward. Then:
// - every percentage, ratio and ± in the caption is one of those values, rounded as the site rounds (two significant
//   digits; a number of times to one decimal) or more coarsely; a sentence that names another moment or another plate
//   (its label, e.g. "2015" or "Kompas") may also take its values from there;
// - a value bound to a name (a row, an outlet, a publisher: "15% di Kompas", "Tempo: 3,3%") is that row's or that
//   outlet's; numbers in a row ("6,9%, 6,3%, 11,6%") follow the figure's order (one row's outlets, or one outlet's rows);
// - a range ("2–10%") is exactly the lowest and highest of what it covers: one row, one outlet, or everything the step
//   shows, less the rows the sentence gives numbers of its own;
// - a plate's title is reproducible from all it draws, and, as it is read at every step, from what the plate shows at
//   that step (its moment, or one the title names by its label: "2010–2014", "+1"); a card's teaser and key number
//   from all its figure(s) draw;
// - the Indonesian and English texts carry the same numbers in the same order;
// - any other number (a count read by hand, a number of pages) is explained in captions-allowed.tsv, one line each.
// A number the figure does not show is reported with what the data has (and where), never corrected here.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { STORIES } from "../../site/story.js";
import { figureOf, focused, lensFrom, dash } from "../../site/scenes.js";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), dir = args[0] && !STORIES.some((s) => s.slug === args[0]) ? args.shift() : join(here, "../../site/data");
const slugs = args.length ? args : STORIES.map((s) => s.slug);
const cache = new Map(), json = (path) => (cache.has(path) || cache.set(path, JSON.parse(readFileSync(join(dir, path), "utf8"))), cache.get(path));
const data = {
  json: async (path) => json(path),
  lens: async (name) => lensFrom(json(`${name}/meta.json`)),
  entry: async (l, word) => { const i = l.index.get(word); return l.isEntry(i) ? json(`${l.lens}/words/${Math.floor(i / l.bucket)}.json`).find((e) => e.word === i) : null; },
};
const ALLOWED = readFileSync(join(here, "captions-allowed.tsv"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
const used = new Set();

// ---- numbers as the texts write them ---------------------------------------------------------------------------
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const NUMBER = { id: /(?<![\p{L}\d.,])(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?![\p{L}\d])/gu, en: /(?<![\p{L}\d.,])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\p{L}\d])/gu };
const value = (s, lang) => +(lang === "id" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
const decimals = (s, lang) => (s.split(lang === "id" ? "," : ".")[1] || "").length * (lang === "en" && /,\d{3}/.test(s) && !s.includes(".") ? 0 : 1);
const WORDS = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const WORD = Object.keys(WORDS).join("|");
const RATIO_WORDS = new RegExp(`\\b(${WORD})(?:\\s+(?:sampai|to)\\s+(${WORD}))?\\s+(?:kali|times)\\b`, "gi");
/** The numbers of a text, in order: {at, text, lo, hi?, d (decimals), unit: "%" | "x" | "±" | "" , word}. */
function numbers(text, lang) {
  const found = [...text.matchAll(NUMBER[lang])].map((m) => ({ at: m.index, end: m.index + m[0].length, text: m[0], lo: value(m[0], lang), d: decimals(m[0], lang) }));
  const out = [], per = /(dari tiap|in every) 100\b/.test(text);  // "96 in every 100": numbers per hundred
  for (let i = 0; i < found.length; i++) {
    const n = found[i], next = found[i + 1];
    if (next && /^\s*[–-]\s*$/.test(text.slice(n.end, next.at)) && !/^\d{4}$/.test(n.text)) (n.hi = next.lo), (n.dh = next.d), (n.text += "–" + next.text), (n.end = next.end), i++;
    const after = text.slice(n.end, n.end + 20), before = text.slice(Math.max(0, n.at - 1), n.at), hundred = after.match(/^ (dari tiap|in every) 100/);
    n.unit = after.startsWith("%") || hundred || (per && !/^\d{4}$/.test(n.text)) ? "%" : /^(\s*(kali|times)\b|×|:1\b)/.test(after) ? "x" : before === "±" ? "±" : "";
    if (after.startsWith(":1")) n.end += 2, found.splice(i + 1, 1);
    if (hundred) found.splice(i + 1, 1);
    out.push(n);
  }
  for (const m of text.matchAll(RATIO_WORDS)) out.push({ at: m.index, end: m.index + m[0].length, text: m[0], lo: WORDS[m[1].toLowerCase()], hi: m[2] && WORDS[m[2].toLowerCase()], d: 0, dh: 0, unit: "x", word: true });
  return out.sort((a, b) => a.at - b.at);
}
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
/** Rounded to `d` decimals, is v what the text says? (v in the text's unit: percent points or times) */
const near = (v, shown, d) => v !== null && v !== undefined && Math.abs(v - shown) <= 0.5 * 10 ** -d + 1e-9;
const sig = (v) => (v >= 9.95 ? 0 : v >= 0.995 ? 1 : v >= 0.0995 ? 2 : 3);  // decimals the site shows a share with (two significant digits)
const show = (v, times) => (times ? v.toFixed(1) : v.toFixed(Math.min(3, sig(v))));

// ---- what a figure shows -------------------------------------------------------------------------------------------
/** Every value a figure draws: {v (in percent, or times), row, series, plate, state, labels}. */
function cells(f, { plates = f.plates.map((_, i) => i), states = null, rows = null, fig = 0 } = {}) {
  const out = [];
  for (const pi of plates) {
    const p = f.plates[pi];
    p.rows.forEach((r) => {
      if (rows && !rows.includes(r.label)) return;
      p.states.forEach((state, si) => {
        if (states && !states.includes(si)) return;
        r.values[si].forEach((v, k) => v !== null && v !== undefined && Number.isFinite(v) && out.push({ v: f.times ? v : v * 100, off: r.off?.[si]?.[k] != null ? r.off[si][k] * 100 : null,
          row: r.label, series: p.series[k] || p.name || "", plate: p.name, state, k, ri: p.rows.indexOf(r), pi, si, fig, all: r.key === "*", times: !!f.times }));
      });
    });
  }
  return out;
}
const where = (c) => `${c.row}${c.series ? ` / ${c.series}` : ""}${c.plate && c.plate !== c.series ? ` (${c.plate})` : ""} @ ${c.state}`;
const lower = (s) => s.toLowerCase();
const mentions = (text, label) => label && new RegExp(`(^|[^\\p{L}\\d])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\d])`, "iu").test(text);
/** The names a piece of text binds a number to: rows, series and plates of the figure it mentions. */
const names = (text, all) => all.filter((n) => mentions(text, n));

const MOST = /(tidak (pernah )?(ada yang )?melewati|paling (tinggi|banyak)|tertinggi|never pass(es)?|nothing passes|at most|peaks? at|the highest)\s*$/i;
const UNDER = /(di bawah|under|below)\s*$/i;
/** The names a number is bound to: in a parenthesis right after it ("7,3% (Kompas)"), in the few words after "di", "in",
 *  "of", "halaman" ("15% di Kompas", "2.0% of Kompas pages"), or since the last comma before it ("Tempo: 3,3%"). */
const bind = (before, after, all) => {
  after = after.replace(/^\s*(%|kali\b|times\b|×)/, "");
  const paren = after.match(/^\s*\(([^()]{1,40})\)/), near = after.match(/^\s*(?:(?:halaman|pages?|of|di|in|dari)\s+)+([^\s,;.:()]+(?:\s[^\s,;.:()]+){0,2})/);
  const next = names(paren ? paren[1] : near ? near[1] : "", all);
  return next.length ? next : names(before.split(/[,;]/).at(-1), all);
};
/** Groups a range may cover: the cells by `keys` ("row", "series", "si" ... joined), each also without the all-pages row. */
const groupsOf = (list, ...keys) => keys.flatMap((key) => Object.values(Object.groupBy(list, (c) => `${c.fig}/${c.pi}/` + key.split("+").map((k) => c[k]).join("/"))));

/**
 * Checks the numbers of one text against `pool` (the cells it may take its values from). `all`: every label of the
 * figure, to bind numbers to; `wide`: the same plates and rows at every moment (for "never passes", "at most");
 * `counts`: page counts it may give; `broad`: everything the data has, to say where a number is from.
 */
function check(text, lang, pool, all, { counts = [], broad = [], wide = pool, loose = false, undrawn = [] } = {}) {
  all = [...all, ...undrawn];
  const problems = [];
  for (const sentence of sentences(text)) {
    const tokens = numbers(sentence, lang).filter((n) => n.unit || (!/^\d{4}$/.test(n.text) && sentence[n.at - 1] !== "+")), said = names(sentence, all);
    tokens.forEach((n, i) => {
      n.gap = i ? sentence.slice(tokens[i - 1].end, n.at) : null;
      n.lead = sentence.slice(i ? tokens[i - 1].end : 0, n.at);
      n.bound = loose ? [] : bind(n.lead, sentence.slice(n.end, tokens[i + 1]?.at ?? sentence.length), all);
    });
    const ownedSeries = new Set(tokens.flatMap((n) => n.bound));
    for (const n of tokens) {
      const fits = (c) => !n.bound.length || n.bound.some((b) => [c.row, c.series, c.plate].some((x) => x && lower(x) === lower(b)));
      const mine = pool.filter(fits);
      // What the rest of the sentence does not name: the rows and series other numbers of it are given for.
      const rest = mine.filter((c) => (!said.includes(c.row) || n.bound.includes(c.row)) && (!ownedSeries.has(c.series) || n.bound.includes(c.series)));
      const groups = (list) => [list, list.filter((c) => !c.all), ...groupsOf(list, "row", "series", "si", "row+series", "si+series", "si+row"), ...groupsOf(list.filter((c) => !c.all), "si", "si+series")];
      const span = (g, lo, dlo, hi, dhi) => g.length > 1 && near(Math.min(...g.map((c) => c.v)), lo, dlo) && near(Math.max(...g.map((c) => c.v)), hi, dhi);
      const ok = (() => {
        if (n.unit === "%" && n.hi === undefined && MOST.test(n.lead)) {
          const top = wide.filter(fits), named = top.filter((c) => said.includes(c.row));
          return [...groups(top), ...groups(named)].some((g) => g.length && near(Math.max(...g.map((c) => c.v)), n.lo, n.d)) ? [true] : [];
        }
        if (n.unit === "%" && n.hi === undefined && UNDER.test(n.lead)) {
          // "under 2%": every value of the rows it names, or of some row, is below it.
          const named = mine.filter((c) => said.includes(c.row));
          return (named.length ? [named] : groupsOf(mine, "row")).some((g) => g.every((c) => c.v < n.lo)) ? [true] : [];
        }
        if (n.unit === "%" && n.hi === undefined) return mine.filter((c) => near(c.v, n.lo, n.d));
        if (n.unit === "±") return mine.filter((c) => near(c.off, n.lo, n.d));
        if (n.unit === "%" || (n.unit === "x" && n.hi !== undefined && !n.word && pool[0]?.times)) {
          // A range: the lowest and highest of one row, one series, one moment, or of all, less what the sentence names otherwise.
          const hit = [...groups(mine), ...groups(rest), ...groups(pool.filter((c) => said.includes(c.row)))].find((g) => span(g, n.lo, n.d, n.hi, n.dh));
          return hit ? [hit] : [];
        }
        if (n.unit === "x") {
          if (pool[0]?.times) return mine.filter((c) => near(c.v, n.lo, n.d));
          // A number of times: one value over another, in the same row or the same series, at one moment.
          const ratios = [];
          for (const a of pool) for (const b of pool) if (a !== b && b.v > 0 && a.fig === b.fig && a.si === b.si && a.pi === b.pi && (a.row === b.row || a.series === b.series)) ratios.push(a.v / b.v);
          const at = (x, d) => ratios.some((r) => near(r, x, d));
          return at(n.lo, n.d) && (n.hi === undefined || at(n.hi, n.dh)) ? [true] : [];
        }
        return counts.some((c) => c === n.lo) ? [true] : [];
      })();
      n.cells = ok;
      if (n.bound.length && n.bound.every((b) => undrawn.includes(b))) problems.push({ token: n.text + n.unit, why: `bound to “${n.bound.join(", ")}”, which the data has but this figure does not draw` });
      else if (!ok.length) problems.push({ token: n.text + (n.word ? "" : n.unit === "x" ? " ×" : n.unit), why: explain(n, pool, broad) });
    }
    // Numbers in a row, unbound but the first: one row's series in order, or one series' rows in order.
    for (let i = 0; i < tokens.length; i++) {
      let j = i;
      while (tokens[j + 1] && tokens[j + 1].unit === "%" && tokens[j + 1].hi === undefined && !tokens[j + 1].bound.length && /^\s*(,|dan|and|lawan|against)?\s*$/.test(tokens[j + 1].gap)) j++;
      const run = tokens.slice(i, j + 1);
      if (run.length < 2 || run[0].unit !== "%" || run[0].hi !== undefined || run.some((n) => !n.cells.length || n.cells[0] === true)) { i = j; continue; }
      const ordered = (key, by) => {
        const go = (k, last, fixed) => k === run.length || run[k].cells.some((c) => (fixed === undefined || c[key] === fixed) && c[by] > last && go(k + 1, c[by], c[key]));
        return go(0, -1);
      };
      if (!ordered("row", "k") && !ordered("k", "ri") && !ordered("row", "si")) problems.push({ token: run.map((n) => n.text).join(", "), why: "not in the figure's order (one row's outlets in turn, or one outlet's rows)" });
      i = j;
    }
  }
  return problems;
}
/** Why a number fails: what the figure has closest to it, and whether the data has it elsewhere (not shown here). */
function explain(n, pool, broad) {
  const target = n.unit === "±" ? "off" : "v", list = (cs) => cs.filter((c) => c[target] != null);
  const closest = (cs, x) => list(cs).sort((a, b) => Math.abs(a[target] - x) - Math.abs(b[target] - x))[0];
  if (n.hi !== undefined && n.unit !== "x") {
    const mine = list(pool).filter((c) => !n.bound.length || n.bound.some((b) => [c.row, c.series, c.plate].some((x) => x && lower(x) === lower(b))));
    const lo = mine.reduce((a, c) => (c.v < a.v ? c : a), mine[0]), hi = mine.reduce((a, c) => (c.v > a.v ? c : a), mine[0]);
    return mine.length ? `range: what it shows${n.bound.length ? ` for ${n.bound.join(", ")}` : ""} runs ${show(lo.v)} (${where(lo)}) to ${show(hi.v)} (${where(hi)})` : "range: nothing shown";
  }
  if (n.unit === "x" && !pool[0]?.times) return "no ratio of two values shown at this moment gives it";
  if (!n.unit) return "a count the figure does not give: explain it in captions-allowed.tsv";
  const c = closest(pool, n.lo), elsewhere = broad.filter((b) => near(b[target], n.lo, n.d));
  return `${c ? `closest shown: ${show(c[target], c.times)} (${where(c)})` : "nothing shown"}${elsewhere.length ? `; the data has it at ${elsewhere.slice(0, 3).map(where).join("; ")}, not shown at this step` : ""}`;
}

// ---- every story ---------------------------------------------------------------------------------------------------
const failures = [];
const fail = (story, place, lang, text, problem) => {
  // A plate's title is read at every step: what is allowed of it (<scene>.plate) is allowed at each (<scene>.<step>.plate).
  const allowed = ALLOWED.find(([slug, at, number]) => slug === story.slug && (at === place || at === place.replace(/\.\d+\.plate$/, ".plate")) && (number === problem.token || number === "*"));
  if (allowed) return used.add(allowed.join("\t"));
  failures.push({ story: story.slug, place, lang, text, ...problem });
};
const digits = (text, lang) => numbers(text, lang).filter((n) => !n.word).map((n) => `${n.lo}${n.hi !== undefined ? "–" + n.hi : ""}`);
const same = (story, place, id, en) => {
  const [a, b] = [digits(plain(id), "id"), digits(plain(en), "en")];
  if (a.join(" ") !== b.join(" ")) failures.push({ story: story.slug, place, lang: "id/en", text: plain(en), token: `${a.join(" ")} | ${b.join(" ")}`, why: "the two languages do not carry the same numbers in the same order" });
};
/** The title of plate i of a scene, as the site writes it (app.js, plateTitle). */
const titleOf = (scene, lang, f, i) => { const t = scene[lang].plate; return typeof t === "function" ? t(...(scene.type === "pairs" ? scene.pairs[i] : [f.plates[i].name])) : Array.isArray(t) ? t[i] : t; };
const labelsOf = (f) => [...new Set(f.plates.flatMap((p) => [p.name, ...p.series, ...p.rows.map((r) => r.label)]).filter(Boolean))];
/** Page counts a caption may give: those the figure's notes give at that moment. */
const countsOf = (scene, f, si) => {
  const s = f.source;
  if (scene.type === "together") return [s.pages[si]];
  if (scene.type === "yearly") return Object.values(s.pages).map((list) => list[si]);
  if (scene.type === "stuck") return s.pages(si);
  return [];
};
let checked = 0;
for (const story of STORIES.filter((s) => slugs.includes(s.slug))) {
  const whole = { id: [], en: [] };
  for (const [k, scene] of story.scenes.entries()) {
    for (const lang of ["id", "en"]) {
      const f = await figureOf(scene, data, lang, { wide: false }), all = labelsOf(f), every = cells(f, { fig: k });
      // Everything the data has: every period, and for counts from the text every share it holds (named by its last part).
      const wider = scene.type === "asked" ? { ...scene, periods: undefined, shares: Object.keys(json(`pages/${scene.name}.json`).share).map((key) => scene.shares.find(([x]) => x === key) || [key, key.split("|").at(-1)]) } : scene;
      const fb = await figureOf(wider, data, lang, { wide: true }), broad = cells(fb, { fig: k }), undrawn = labelsOf(fb).filter((x) => !all.includes(x));
      whole[lang].push(...broad);
      // The titles of its plates, against everything they draw (the image saved).
      f.plates.forEach((p, i) => {
        const title = titleOf(scene, lang, f, i);
        if (!title) return;
        for (const problem of check(plain(title), lang, cells(f, { plates: [i] }), all, { broad, undrawn })) fail(story, `${k}.plate${f.plates.length > 1 ? i : ""}`, lang, plain(title), problem);
        if (lang === "id") same(story, `${k}.plate`, title, titleOf(scene, "en", f, i));
      });
      // Each step: the plate it shows, at its moment, the rows it brings forward.
      scene.steps.forEach((step, j) => {
        const named = f.plates[0].name !== null, pi = named ? f.plates.findIndex((p) => p.name === step.at) : 0, p = f.plates[pi];
        const si = named ? (step.mark === undefined ? p.states.length - 1 : p.states.indexOf(step.mark)) : p.states.indexOf(dash(step.at)) >= 0 ? p.states.indexOf(dash(step.at)) : p.states.indexOf(step.at);
        if (pi < 0 || si < 0) return failures.push({ story: story.slug, place: `${k}.${j + 1}`, lang, text: step[lang], token: step.at, why: "the step's moment is not on its figure" });
        // The caption, about the rows the step brings forward; and the plate's title above it, which is read at every
        // step beside the values the plate shows then: its numbers too must be at the step's moment, or at one it names.
        const text = plain(step[lang]), title = plain(titleOf(scene, lang, f, pi) || "");
        for (const [place, said, rows] of [[`${k}.${j + 1}`, text, step.focus ? focused(p, step.focus) : null], [`${k}.${j + 1}.plate`, title, null]]) for (const sentence of sentences(said)) {
          const plates = [pi, ...f.plates.map((q, i) => (i !== pi && mentions(sentence, q.name) ? i : -1)).filter((i) => i >= 0)];
          const states = [si, ...p.states.map((s, i) => (i !== si && mentions(sentence, String(s)) ? i : -1)).filter((i) => i >= 0)];
          for (const problem of check(sentence, lang, cells(f, { plates, states, rows }), all, { counts: countsOf(scene, f, si), broad, wide: cells(f, { plates, rows }), undrawn })) fail(story, place, lang, sentence, problem);
        }
        if (lang === "id") same(story, `${k}.${j + 1}`, step.id, step.en);
        checked++;
      });
    }
  }
  // The card: its teaser and its key number, from everything the story's data holds.
  for (const lang of ["id", "en"]) {
    const all = [...new Set(whole[lang].flatMap((c) => [c.row, c.series, c.plate]).filter(Boolean))];
    for (const [place, text] of [["teaser", story[lang].teaser], ["key", `${story.key.number[lang] || story.key.number} ${story.key[lang]}`]])
      for (const problem of check(plain(text), lang, whole[lang], all, { broad: whole[lang], loose: true })) fail(story, place, lang, plain(text), problem);
  }
  same(story, "teaser", story.id.teaser, story.en.teaser);
  same(story, "key", `${story.key.number.id || story.key.number} ${story.key.id}`, `${story.key.number.en || story.key.number} ${story.key.en}`);
}

for (const line of ALLOWED.map((l) => l.join("\t"))) if (!used.has(line) && slugs.includes(line.split("\t")[0])) failures.push({ story: line.split("\t")[0], place: line.split("\t")[1], lang: "", text: line, token: "", why: "an allowed number no text writes any more: remove the line" });
for (const f of failures) console.log(`${f.story} ${f.place} ${f.lang}  ${f.token}: ${f.why}\n    “${f.text.slice(0, 220)}”`);
console.log(failures.length ? `${failures.length} numbers to correct or explain (${checked} steps read)` : `every number is what its figure shows (${checked} steps read)`);
process.exit(failures.length ? 1 : 0);
