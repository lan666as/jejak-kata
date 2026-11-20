// What the games read, gathered from site/data: site/data/quiz.json. Written by `node tests/site/games.mjs write`;
// tests/site/games.mjs fails where the file is not what the data says. Only what the counting found is gathered here
// (shares, verbs, pages); which questions may be asked, and with what margin, is site/deal.js's.
import { readFileSync } from "node:fs";
import { STORIES } from "../../site/story.js";
import { GUESS_WORDS } from "../../site/address.js";
import { FEATURED, SHOWCASE, GLOSS } from "../../site/text.js";
import { GAME_GLOSS, NAME_GLOSS, IN_ENGLISH } from "../../site/glossary.js";
import { PEOPLE, BODIES, SENSITIVE, ACCUSING, LAW_ACTS, MARGIN, marker, fragment, bareSet, oneThing, isName } from "../../site/deal.js";
import { OUTLETS } from "../../site/scenes.js";

const DATA = new URL("../../site/data/", import.meta.url).pathname, MAIN = "id-web-news-kompas", ERA = 2;
const read = (path) => JSON.parse(readFileSync(DATA + path, "utf8"));
const round = (x) => (x === null || x === undefined ? 0 : +x.toPrecision(3));

/** What the data says of a word, for the clue lists (deal.js, `fragment`, `oneThing`): the bare first names and fragments
 *  every source names, a word's Wikipedia article in the first page's source, and its meaning in English. */
export function clueRules() {
  const meta = read(`${MAIN}/meta.json`), index = new Map(meta.words.map((w, i) => [w, i]));
  const bare = bareSet(read("lenses.json").map((l) => { const m = read(`${l}/meta.json`); return Object.entries(m.entities).map(([i, article]) => [m.words[i], m.kinds[i], article]); }));
  return { bare, article: (w) => meta.entities[index.get(w)] || "", gloss: (w) => GLOSS[w]?.en || GAME_GLOSS[w] || "" };
}

export function quizData() {
  const meta = read(`${MAIN}/meta.json`), hidden = new Set(meta.names), index = new Map(meta.words.map((w, i) => [w, i]));
  const isEntry = (w) => index.has(w) && !hidden.has(index.get(w));
  // (what the games can say in English: a name, or a word with its gloss)
  const explained = (w) => isName(w, meta.kinds[index.get(w)]) || GLOSS[w]?.en || GAME_GLOSS[w] || NAME_GLOSS[w] || IN_ENGLISH.includes(w);
  const buckets = new Map(), of = (folder, i) => {
    const file = `${MAIN}/${folder}/${Math.floor(i / meta.bucket)}.json`;
    if (!buckets.has(file)) buckets.set(file, read(file));
    return buckets.get(file).find((e) => e.word === i);
  };
  const years = read("years.json"), stick = OUTLETS.map((o) => read(`${o}/stick.json`)), peaks = read(`${MAIN}/highlights.json`).peaks;
  // The official words and loanwords: the pairs of the story "kata-resmi" (its "split" scene).
  const resmi = STORIES.find((s) => s.slug === "kata-resmi").scenes.find((sc) => sc.type === "split").pairs;
  // A year's clue: its ten most characteristic words (highlights.json's peaks, in order), each thing once (deal.js,
  // `oneThing`: "foke" and "fauzi bowo", "psbb" and its full name, "pengampunan pajak" and "tax amnesty", "ebola" and
  // "virus ebola": the longer of a word and its part), never a bare first name or a fragment (`fragment`: "uno",
  // "salihin"). A word of one part that, that year, mostly comes as a part of one longer name or term ("gugus" in
  // "gugus tugas", "rajasa" in "hatta rajasa") is given as that whole.
  const { bare, article, gloss } = clueRules(), share = (w, p) => (isEntry(w) ? of("words", index.get(w))?.share[p] || 0 : 0);
  const wholes = new Map();
  for (const w of meta.words) if (w.includes(" ") && !hidden.has(index.get(w))) for (const part of w.split(" ")) (wholes.get(part) || wholes.set(part, []).get(part)).push(w);
  const whole = (w, p) => { if (w.includes(" ")) return w; const best = (wholes.get(w) || []).map((x) => [x, share(x, p)]).sort((a, b) => b[1] - a[1])[0]; return best && best[1] >= 0.5 * share(w, p) ? best[0] : w; };
  // (a word put in, a whole for its part or a word from past the first ten, only where the games can say what it is in
  // English, and not a name they ask about elsewhere, so that a year's clue does not take a name from the other kinds)
  const welcome = (w) => explained(w) && !PEOPLE.includes(w) && !BODIES.includes(w);
  // (nor one another year's clue has: each year's own words, so that a game's two years do not share one)
  const filled = new Set(), elsewhere = (w, p) => filled.has(w) || peaks.some((list, q) => q !== p && list.slice(0, 10).some((i) => meta.words[i] === w || whole(meta.words[i], q) === w));
  const clues = peaks.map((list, p) => {
    const clue = [];
    for (const [k, i] of list.entries()) {
      let w = whole(meta.words[i], p);
      if (w !== meta.words[i] && (PEOPLE.includes(w) || BODIES.includes(w))) continue;  // ("rajasa", of "hatta rajasa": a part of a name asked elsewhere)
      if (w !== meta.words[i] && !welcome(w)) w = meta.words[i];
      if (marker(w) || fragment(w, bare) || !isEntry(w) || (k >= 10 && (!welcome(w) || elsewhere(w, p)))) continue;
      const at = clue.findIndex((x) => oneThing(x, w, article, gloss));
      if (at < 0) (clue.push(w), k >= 10 && filled.add(w));
      else if (w.split(" ").length > clue[at].split(" ").length && w.includes(clue[at])) clue[at] = w;  // (the whole for its part: "virus ebola" for "ebola")
      if (clue.length === 10) break;
    }
    return { p, clue };
  }).filter((y) => y.clue.length >= 8);
  // The words the games compare: those the site already names (the stories' words, the first page's, the games'), the
  // words stick.json counts beside names, the known names; not the peaks of a year (those are the year's clue only:
  // many are fragments of names, "rajasa", "raka", or of the source's own furniture, "diwartakan").
  const named = [...Object.keys(years.share), ...stick[0].words, ...GUESS_WORDS, ...FEATURED, ...SHOWCASE, ...resmi.flat(), ...PEOPLE, ...BODIES,
    ...STORIES.flatMap((s) => s.scenes.flatMap((sc) => [...(sc.check || []), ...(sc.words || [])]))];
  const words = {};
  for (const w of [...new Set([...named, ...clues.flatMap((y) => y.clue)])].filter(isEntry).sort()) {
    const i = index.get(w), e = of("words", i);
    if (e) words[w] = { kind: meta.kinds[i] || "word", share: e.share.map(round), ...(named.includes(w) ? {} : { clueOnly: 1 }) };
  }
  const who = {};
  for (const n of [...PEOPLE, ...BODIES].filter(isEntry)) {
    const path = of("paths", index.get(n));
    if (!path?.verbs) continue;
    const said = {};
    path.verbs.forEach((verbs, p) => {
      if (verbs.length < 5 || !words[n] || words[n].share[p] * meta.units[p] < MARGIN.whoPages) return;  // (deal.js would not ask it)
      // (not a word of SENSITIVE or ACCUSING: the clue says who it is, never what a court said of them; and each word
      // once, though a word may be counted as a verb and as an adjective)
      // (beside a person, not what the law does to someone either: LAW_ACTS; a body that enforces the law keeps them)
      const fair = (list) => list.map(([j]) => meta.words[j]).filter((w) => !SENSITIVE.includes(w) && !ACCUSING.includes(w) && !(PEOPLE.includes(n) && LAW_ACTS.includes(w)) && explained(w));
      const verbsOf = fair(verbs).slice(0, 7);
      said[p] = [...verbsOf, ...fair(path.adjectives?.[p] || []).filter((w) => !verbsOf.includes(w)).slice(0, 4)];
    });
    if (Object.keys(said).length) who[n] = { said };
  }
  // Each word stick.json counts beside each known name in all three newsrooms, 2020-2024: per mille and pages.
  const rows = [];
  // (Not the words of SENSITIVE, and not a name any of them counts on fewer pages than deal.js asks: never asked.)
  for (const w of stick[0].words.filter((w) => !SENSITIVE.includes(w))) for (const n of [...PEOPLE, ...BODIES]) {
    const at = stick.map((s) => s.names.indexOf(n));
    if (at.some((i, k) => i < 0 || stick[k].pages[i][ERA] < MARGIN.roomPages) || stick.some((s, k) => !s.share[w] || s.share[w][at[k]][ERA] === null)) continue;
    rows.push([w, n, stick.map((s, k) => s.share[w][at[k]][ERA]), stick.map((s, k) => s.pages[at[k]][ERA])]);
  }
  return { periods: meta.periods, units: meta.units, years: clues, words, who, resmi, rooms: { era: "2020–2024", rows } };
}
