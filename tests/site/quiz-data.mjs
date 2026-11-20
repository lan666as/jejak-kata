// What the games read, gathered from site/data: site/data/quiz.json. Written by `node tests/site/games.mjs write`;
// tests/site/games.mjs fails where the file is not what the data says. Only what the counting found is gathered here
// (shares, verbs, pages); which questions may be asked, and with what margin, is site/deal.js's.
import { readFileSync } from "node:fs";
import { STORIES } from "../../site/story.js";
import { GUESS_WORDS } from "../../site/address.js";
import { FEATURED, SHOWCASE } from "../../site/text.js";
import { PEOPLE, BODIES, SENSITIVE, MARGIN } from "../../site/deal.js";
import { OUTLETS } from "../../site/scenes.js";

const DATA = new URL("../../site/data/", import.meta.url).pathname, MAIN = "id-web-news-kompas", ERA = 2;
const read = (path) => JSON.parse(readFileSync(DATA + path, "utf8"));
const round = (x) => (x === null || x === undefined ? 0 : +x.toPrecision(3));

export function quizData() {
  const meta = read(`${MAIN}/meta.json`), hidden = new Set(meta.names), index = new Map(meta.words.map((w, i) => [w, i]));
  const isEntry = (w) => index.has(w) && !hidden.has(index.get(w));
  const buckets = new Map(), of = (folder, i) => {
    const file = `${MAIN}/${folder}/${Math.floor(i / meta.bucket)}.json`;
    if (!buckets.has(file)) buckets.set(file, read(file));
    return buckets.get(file).find((e) => e.word === i);
  };
  const years = read("years.json"), stick = OUTLETS.map((o) => read(`${o}/stick.json`)), peaks = read(`${MAIN}/highlights.json`).peaks;
  // The official words and loanwords: the pairs of the story "kata-resmi" (its "split" scene).
  const resmi = STORIES.find((s) => s.slug === "kata-resmi").scenes.find((sc) => sc.type === "split").pairs;
  const clues = peaks.map((list, p) => ({ p, clue: list.slice(0, 10).map((i) => meta.words[i]) })).filter((y) => y.clue.length >= 8);
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
      // (not a word of SENSITIVE: the clue says who it is, never what a court said of them)
      const fair = (list) => list.map(([j]) => meta.words[j]).filter((w) => !SENSITIVE.includes(w));
      said[p] = [...fair(verbs).slice(0, 7), ...fair(path.adjectives?.[p] || []).slice(0, 4)];
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
