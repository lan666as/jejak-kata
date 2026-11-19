// What a story's figure draws, as numbers: for a scene of story.js, its plates, each a grid of rows over states, a
// value per series (`values[state][series]`, a share or, for words that fell, a number of times). app.js draws them
// (plate.js); tests/site/captions.mjs holds every caption to them. No DOM here: `data` gives what to read
// ({json(path), lens(name), entry(lens, word): its entry or null}), so the browser and the checks read the same numbers the same way.
import { TEXT } from "./text.js";

export const OUTLETS = ["id-web-eras-kompas", "id-web-eras-tempo", "id-web-eras-tribun"]; // one publisher each, the same three periods
export const OUTLET = ["Kompas", "Tempo", "Tribunnews"];
/** The publishers whose text is counted (idhist/pages.py), as the site calls them. */
export const PUBLISHER = { "kompas.com": "Kompas", "tempo.co": "Tempo", "tribunnews.com": "Tribunnews", "bisnis.com": "Bisnis", "okezone.com": "Okezone", "detik.com": "Detik", "liputan6.com": "Liputan6",
  "polri.go.id": { id: "Situs Polri", en: "Police's site" }, "mil.id": { id: "Situs TNI", en: "Army's site" } };
export const said = (label, language) => label[language] || label;
export const dash = (label) => String(label).replace("-", "–");
/** How many words a "fell" plate lists: fewer on a phone. */
export const FELL = (wide) => (wide ? 14 : 11);

/** A lens from its meta: a word -> index map and which indices are entries. */
export const lensFrom = (meta) => {
  const hidden = new Set(meta.names);
  return { ...meta, index: new Map(meta.words.map((w, i) => [w, i])), isEntry: (i) => i !== undefined && !hidden.has(i) };
};

const one = (values) => values.map((v) => [v ?? null]);  // a line's values as a strip's: one series per state
const lines = (states, rows) => ({ states, series: [""], rows: rows.map((r) => ({ ...r, values: one(r.values), off: r.off && one(r.off) })) });

/**
 * The figure of `scene`: {draw: "plate" (lines) | "strip" (rows), plates: [{name, states, series, rows: [{label, key,
 * values, off?}], most?}], times (values are numbers of times, not shares), source (what was read, for the notes)}.
 * A row's `key` is how a step's `focus` names it. `wide`: drawn on a wide screen (a "fell" plate lists more).
 */
export async function figureOf(scene, data, language, { wide = true } = {}) {
  const OUT = (fill) => OUTLETS.map((o, k) => fill(o, k));
  if (scene.type === "lines" || scene.type === "pairs") {
    const l = await data.lens(scene.lens), lists = scene.type === "lines" ? [scene.words] : scene.pairs;
    const found = await Promise.all(lists.map(async (list) => (await Promise.all(list.map((w) => data.entry(l, w)))).filter(Boolean)));
    return { draw: "plate", source: l, plates: lists.map((list, i) => ({ name: scene.type === "pairs" ? list.join(" / ") : null,
      ...lines(l.periods, found[i].map((e) => ({ label: l.words[e.word], key: l.words[e.word], values: e.share }))) })) };
  }
  if (scene.type === "together") {
    const found = (await data.json("together.json"))[`${scene.lens}/${scene.word}`];
    return { draw: "plate", source: found, plates: [{ name: null, ...lines(found.periods, scene.with.filter((x) => found.with[x]).map((x) => ({ label: x, key: x, values: found.with[x], off: found.off[x] }))) }] };
  }
  if (scene.type === "yearly") {
    const y = await data.json("years.json"), years = y.years.map(String);
    const outlet = (k, name) => ({ name, ...lines(years, scene.words.map((word) => ({ label: word, key: word, values: y.share[word][OUTLETS[k]] }))) });
    const plates = scene.by === "outlet" ? OUTLET.map((name, k) => outlet(k, name)) : scene.outlet !== undefined ? [outlet(scene.outlet, null)]
      : scene.words.map((word) => ({ name: word, ...lines(years, OUT((o, k) => ({ label: OUTLET[k], key: OUTLET[k], values: y.share[word][o] }))) }));
    return { draw: "plate", source: y, plates };
  }
  if (scene.type === "forget") {
    const y = await data.json("years.json"), span = [-3, -2, -1, 0, 1, 2, 3, 4, 5], states = span.map((d) => (d > 0 ? "+" + d : String(d).replace("-", "−")));
    return { draw: "plate", source: y, plates: OUTLET.map((name, k) => ({ name, ...lines(states, scene.names.map(([word, left]) => {
      const share = y.share[word][OUTLETS[k]], at = (d) => y.years.indexOf(left + d), base = share[at(0)];
      return { label: word, key: word, values: span.map((d) => (share[at(d)] === undefined ? null : share[at(d)] / base)) };
    })) })) };
  }
  if (scene.type === "left") {
    // What is left of a share of pages one, two and three years on, as a part of the last year in office; none where
    // that year has fewer than 80 pages with the name.
    const y = await data.json("years.json"), after = [1, 2, 3];
    return { draw: "strip", source: y, plates: [{ name: null, states: after.map((d) => "+" + d), series: OUTLET, rows: scene.names.map(([word, left]) => ({ label: word, key: word,
      values: after.map((d) => OUT((o) => { const share = y.share[word][o], i = y.years.indexOf(left); return share[i] * y.pages[o][i] >= 80 && share[i + d] != null ? share[i + d] / share[i] : null; })) })) }] };
  }
  if (scene.type === "split") {
    // Of the times either word is on a page, the part that is the second; none in a year with fewer than 30 pages.
    const l = await data.lens(scene.lens), found = await Promise.all(scene.pairs.map((pair) => Promise.all(pair.map((w) => data.entry(l, w))))), at = scene.periods.map((p) => l.periods.indexOf(p));
    return { draw: "strip", source: l, plates: [{ name: null, states: scene.periods, series: [scene[language].series], most: 1, at,
      rows: scene.pairs.map((pair, k) => ({ label: pair[1], key: pair[1], values: at.map((i) => { const [a, b] = found[k].map((e) => e?.share[i] || 0); return [(a + b) * l.units[i] >= 30 ? b / (a + b) : null]; }) })) }] };
  }
  if (scene.type === "stuck") {
    const found = await data.json("together.json"), of = (name, k) => found[`${OUTLETS[k]}/${name}`], periods = of(scene.rows[0], 0).periods;
    const rows = scene.rows.map((name) => ({ label: name, key: name, values: periods.map((_, p) => OUT((_, k) => of(name, k)?.with[scene.word]?.[p] ?? null)) }));
    if (scene.all) rows.push({ label: TEXT[language].all_pages, key: "*", values: periods.map((_, p) => OUT((_, k) => of(scene.rows[0], k).all[scene.word][p])) });
    return { draw: "strip", source: { periods, pages: (p) => OUT((_, k) => of(scene.rows[0], k).pages[p]) }, plates: [{ name: null, states: periods.map(dash), series: OUTLET, rows }] };
  }
  if (scene.type === "fell") {
    const s = await data.json("stopped.json");
    return { draw: "strip", times: true, source: s, plates: scene.spans.map((span) => {
      const [a, b] = span.split("-").map(Number);
      return { name: span, span: [a, b], states: [`${dash(s.periods[a])} → ${dash(s.periods[b])}`], series: OUTLET,
        rows: s.fell[span].slice(0, FELL(wide)).map((row) => ({ label: row.word, key: row.word, values: [row.share.map(([before, after]) => before / Math.max(after, 1e-6))] })) };
    }) };
  }
  if (scene.type === "asked") {
    // Counts from the text (idhist/pages.py): a row per publisher and a dot per share; or, with `rows: "shares"`, a row
    // per share and a dot per publisher.
    const d = await data.json(`pages/${scene.name}.json`), states = scene.periods || d.periods, column = states.map((p) => d.periods.indexOf(p));
    const value = (key, publisher, c) => d.share[key][d.publishers.indexOf(publisher)][c] ?? null, names = scene.publishers.map((p) => said(PUBLISHER[p], language));
    const rows = scene.rows === "shares"
      ? scene.shares.map(([key, label]) => ({ label: said(label, language), key, values: column.map((c) => scene.publishers.map((p) => value(key, p, c))) }))
      : scene.publishers.map((p, k) => ({ label: names[k], key: p, values: column.map((c) => scene.shares.map(([key]) => value(key, p, c))) }));
    return { draw: "strip", source: d, plates: [{ name: null, states: states.map(dash), series: scene.rows === "shares" ? names : scene.shares.map(([, label]) => said(label, language)), rows }] };
  }
  throw new Error(`no figure for ${scene.type}`);
}

/** The words a scene is about: its word, the words its figure draws, those it asks the reader to check. */
export const sceneWords = (part) => [part.word, ...[part.words, part.with, Array.isArray(part.rows) && part.rows, part.names?.map(([w]) => w), part.pairs?.flat(), part.check].flatMap((l) => l || [])].filter((w) => typeof w === "string");

/** The labels of the rows a step's `focus` names (by key: a word, "*" for all pages, a publisher's address, a share). */
export const focused = (plate, focus) => focus?.map((key) => plate.rows.find((r) => r.key === key)?.label ?? key);

/**
 * The words a step brings forward on the sea, its own first: the rows it names (a count from the text by the words of
 * its row's name, "kepala desa, lurah" both; a publisher is no word), the word its plate is named after, and the words
 * its caption sets in italics. The sea lights those its chart has (app.js, storySea); tests/site/stories.mjs reads the
 * same list.
 */
export const seaWords = (part, step) => {
  if (!step) return [];
  const row = (key) => (part.type === "asked" ? part.shares?.find(([k]) => k === key)?.[1] ?? "" : key);
  const rows = (step.focus || []).filter((key) => key !== "*").flatMap((key) => String(said(row(key), "id")).toLowerCase().split(", "));
  const italics = [...step.id.matchAll(/<i>([^<]+)<\/i>/g)].map((m) => m[1].toLowerCase());
  return [...new Set([...rows, ...(sceneWords(part).includes(step.at) ? [step.at] : []), ...italics].filter(Boolean))];
};
