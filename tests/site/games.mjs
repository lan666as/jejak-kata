// node tests/site/games.mjs [write]   The games deal fairly, and play.
// Without a browser (site/deal.js on site/data/quiz.json and Kompas's stick.json): site/data/quiz.json is what the data
// says (`write` writes it anew); many games of each kind are dealt, and it fails on a repeat or a near-duplicate within a
// game (a topic, a word or a name, twice), a replay that repeats a question before its deck is spent, a question whose
// answer is not among its choices or with two equal choices, a question under its margin (each margin checked again
// here from the raw numbers, not from deal.js's verdict), a mark against the difficulty rule (hard over a ratio of 2,
// easy with a little-known name; a year hard over words more than twice above its neighbours), marks that fall, "which peaked first" between two of unlike sorts or without a real
// peak, what was dealt not kept across page loads, a word shown wrongly (shown()), an Indonesian word with no English
// gloss, a string missing in either language, the points or ranks not as given, and a "guess the number" that one
// fixed guess would win.
// Then one browser pass per game at 390 and 1440 that plays a whole game (the quiz by keyboard alone at 1440, by taps at
// 390): the first action on screen without scrolling, the evidence drawn after each answer, focus on the control that
// goes on, that control in the same place every round, the plate saved, no console errors; and on every toy, its first
// control on the first screen, its result (figure, list, table) beginning in the first 560px of a 390x844 phone, and no
// information only a hover shows.
import { readFileSync, writeFileSync } from "node:fs";
import { quizData, clueRules } from "./quiz-data.mjs";
import { pools, decks, deal, guessPool, guessDecks, guessDeal, points, nearness, close, seeded, STOPS, along, stopAt, shownIn, capOf, sortOf, marker, keep, kept, guessRank, shown, isName, MARGIN, FAME, KINDS, ROUNDS, GUESS_ROUNDS, SENSITIVE, ACCUSING, LAW_ACTS, OUTLET_NAMES, POINTED, PEOPLE, BODIES, ROOM_WORDS, oneThing, fragment } from "../../site/deal.js";
import { TEXT, GLOSS } from "../../site/text.js";
import { GAME_GLOSS, NAME_GLOSS, IN_ENGLISH, AS_NAME } from "../../site/glossary.js";

const FILE = new URL("../../site/data/quiz.json", import.meta.url).pathname, started = Date.now();
let failures = 0;
const log = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); if (!ok) failures++; };
const fresh = JSON.stringify(quizData());
if (process.argv[2] === "write") { writeFileSync(FILE, fresh); console.log(`wrote ${FILE} (${fresh.length} bytes)`); process.exit(0); }
log("site/data/quiz.json is what the data says", readFileSync(FILE, "utf8") === fresh, "else: node tests/site/games.mjs write");

const Q = JSON.parse(fresh), P = Q.periods, W = Q.words, pages = (w, p) => W[w].share[p] * Q.units[p], pool = pools(Q);
console.log(`     distinct questions: ${KINDS.map((k) => `${k} ${pool[k].length}`).join(", ")}`);
log("every kind can be dealt", KINDS.every((k) => pool[k].length >= 10), KINDS.filter((k) => pool[k].length < 10).join(", "));
// A clue list names each thing once and only by a whole name: no word twice, no two entries for one thing (one a part
// of the other, one Wikipedia article, initials, one the other in English, two forms of one word: deal.js oneThing), no
// bare first name or fragment (fragment); a "who" list never a word of accusation or of a case (SENSITIVE, ACCUSING) and,
// beside a person, nothing the law does to someone (LAW_ACTS): Anas Urbaningrum's never "terlibat" or "menerima".
{ const { bare, article, gloss } = clueRules(), bad = [];
  for (const y of Q.years) {
    y.clue.forEach((a, i) => { if ((W[a]?.share || []).reduce((t, v, q) => t + v * Q.units[q], 0) < FAME.clue) bad.push(`${P[y.p]}: “${a}” is on under ${FAME.clue} Kompas pages in all`); if (fragment(a, bare)) bad.push(`${P[y.p]}: “${a}” is a fragment`); y.clue.slice(i + 1).forEach((b) => oneThing(a, b, article, gloss) && bad.push(`${P[y.p]}: “${a}” and “${b}” are one thing`)); });
  }
  for (const [n, { said }] of Object.entries(Q.who)) for (const [p, list] of Object.entries(said)) {
    if (new Set(list).size !== list.length) bad.push(`${n} ${P[p]}: a word twice`);
    const odd = list.filter((w) => SENSITIVE.includes(w) || ACCUSING.includes(w) || (PEOPLE.includes(n) && LAW_ACTS.includes(w)));
    if (odd.length) bad.push(`${n} ${P[p]}: ${odd.join(", ")}`);
  }
  const anas = Object.values(Q.who["anas urbaningrum"]?.said || {}).flat();
  log("every clue list names each thing once, by a whole name, of words on at least " + FAME.clue + " Kompas pages in all (a body and its head, a place and its event are one thing), and no “who” list accuses", !bad.length && oneThing("menteri pendidikan nasional", "kementerian pendidikan nasional") && oneThing("stadion kanjuruhan", "tragedi kanjuruhan") && !oneThing("menteri pendidikan", "kementerian keuangan") && anas.length && !anas.some((w) => ["terlibat", "menerima", "diduga"].includes(w)), bad.slice(0, 6).join("; ") || `Anas Urbaningrum: ${[...new Set(anas)].join(", ")}`); }

/** A question's margin, from the raw numbers: what is wrong with it, or "". */
function margin(q) {
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b), e = q.ev;
  if (q.kind === "freq" || q.kind === "resmi") {
    const p = P.indexOf(e.period), [a, b] = q.choices, [va, vb] = [W[a].share[p], W[b].share[p]];
    if (ratio(va, vb) < MARGIN.ratio) return `ratio ${ratio(va, vb).toFixed(2)}`;
    if (q.kind === "freq" && Q.resmi.some((pair) => pair.includes(a) && pair.includes(b))) return "an official word and its loanword asked as “which is more frequent”";
    if (Math.max(pages(a, p), pages(b, p)) < MARGIN.pages || Math.min(pages(a, p), pages(b, p)) < MARGIN.least) return "too few pages";
    if ((va > vb ? a : b) !== q.answer) return "answer is not the larger";
  }
  if (q.kind === "room") {
    if (SENSITIVE.includes(q.w)) return `sensitive word ${q.w} beside ${q.n}`;
    if (!ROOM_WORDS.includes(q.w)) return `“${q.w}” is not a word of public life (ROOM_WORDS)`;
    if (e.items.some((i) => (i.v * 1000 * i.pages) / 1000 < MARGIN.roomHits)) return `a newsroom with under ${MARGIN.roomHits} pages of “${q.w}” beside ${q.n}`;
    const v = e.items.map((i) => i.v), s = [...v].sort((a, b) => b - a);
    if (s[0] < MARGIN.ratio * s[1] - 1e-9) return `newsrooms ${v.join("/")}`;  // (per mille as counted: 36 against 24 is 1.5)
    if (e.items.some((i) => i.pages < MARGIN.roomPages)) return "too few pages";
    if (OUTLET_NAMES[v.indexOf(s[0])] !== q.answer) return "answer is not the largest";
  }
  if (q.kind === "trend") {
    const [p, r] = e.marks, w = e.series[0].label, x = W[w].share[r] / W[w].share[p];
    const want = x >= MARGIN.ratio ? "up" : x <= 1 / MARGIN.ratio ? "down" : Math.max(x, 1 / x) <= MARGIN.same ? "same" : null;
    if (want !== q.answer) return `${w} ${P[p]}→${P[r]} x${x.toFixed(2)} said ${q.answer}`;
    if (Math.min(pages(w, p), pages(w, r)) < (q.answer === "same" ? MARGIN.samePages : MARGIN.trendPages)) return `too few pages for “${q.answer}” (${Math.round(Math.min(pages(w, p), pages(w, r)))})`;
  }
  if (q.kind === "peak") {
    const at = (w) => { const v = W[w].share, top = Math.max(...v); return v.map((x, p) => (x >= MARGIN.peakNear * top ? p : -1)).filter((p) => p >= 0); };
    const [a, b] = q.choices, other = a === q.answer ? b : a, A = at(q.answer), B = at(other);
    if (Math.min(...B) - Math.max(...A) < MARGIN.peakGap) return `${q.answer} ${A} before ${other} ${B}?`;
    // (two of the same sort: two people, two bodies, two common words; never a place)
    const sort = (w) => (PEOPLE.includes(w) ? "person" : BODIES.includes(w) ? "body" : W[w].kind === "word" && !(w in AS_NAME) ? "word" : W[w].kind);
    if (sort(a) !== sort(b) || !["person", "body", "word"].includes(sort(a))) return `${a} (${sort(a)}) against ${b} (${sort(b)})`;
    // (each a real peak: its highest year at least peakStand times the median of the years on each side of its run of
    // years at least half as high, two or more years each side)
    for (const w of [a, b]) {
      const v = W[w].share, top = Math.max(...v), p = v.indexOf(top), med = (l) => [...l].sort((x, y) => x - y)[Math.floor(l.length / 2)];
      let lo = p, hi = p; while (lo > 0 && v[lo - 1] >= top / 2) lo--; while (hi < v.length - 1 && v[hi + 1] >= top / 2) hi++;
      if (lo < MARGIN.peakSides || v.length - 1 - hi < MARGIN.peakSides || top < MARGIN.peakStand * Math.max(med(v.slice(0, lo)), med(v.slice(hi + 1)))) return `“${w}” has no real peak`;
    }
  }
  if (q.kind === "year") {
    const clue = q.clue, sum = (p) => clue.reduce((s, w) => s + (W[w]?.share[p] || 0), 0), p = P.indexOf(q.answer);
    const close = q.choices.filter((c) => c !== q.answer).find((c) => sum(P.indexOf(c)) * MARGIN.yearRatio > sum(p));
    if (close) return `year ${close} too near ${q.answer}`;
    if (clue.some(marker)) return `a clue word names its year (${clue.filter(marker)})`;
    if (P.some((_, r) => r !== p && sum(r) >= sum(p))) return `the clue stands higher in another year than ${q.answer}`;
    // (the years offered near it: within MARGIN.yearNear where three such years may be offered, and on both sides of it
    // where both sides have one within twice that)
    const may = P.map((_, r) => r).filter((r) => r !== p && sum(r) * MARGIN.yearRatio <= sum(p)), offered = q.choices.filter((c) => c !== q.answer).map((c) => P.indexOf(c));
    if (may.filter((r) => Math.abs(r - p) <= MARGIN.yearNear).length >= 3 && offered.some((r) => Math.abs(r - p) > MARGIN.yearNear) && !(may.some((r) => r < p && p - r <= 2 * MARGIN.yearNear) && may.some((r) => r > p && r - p <= 2 * MARGIN.yearNear))) return `years offered far from ${q.answer}: ${q.choices}`;
    for (const side of [-1, 1]) if (may.some((r) => Math.sign(r - p) === side && Math.abs(r - p) <= 2 * MARGIN.yearNear) && !offered.some((r) => Math.sign(r - p) === side)) return `every year offered on one side of ${q.answer}: ${q.choices}`;
  }
  if (q.kind === "who") {
    const p = P.indexOf(q.ask[1]), clash = q.choices.filter((c) => c !== q.answer).find((c) => (Q.who[c]?.said[p] || []).filter((x) => q.clue.includes(x)).length > Math.floor(MARGIN.whoShared * q.clue.length + 1e-9));
    if (clash) return `${clash} shares the clue of ${q.answer}`;
    if (pages(q.answer, p) < MARGIN.whoPages) return "too few pages";
    // (every name offered in the news that year, and of the answer's own sort: a person among people of their time, a
    // body among bodies, of its kind where three are there)
    const out = q.choices.find((c) => !W[c] || pages(c, p) < MARGIN.whoPages);
    if (out) return `${out} is on too few pages in ${q.ask[1]} to be offered`;
    const odd = q.choices.find((c) => PEOPLE.includes(c) !== PEOPLE.includes(q.answer) || (PEOPLE.includes(c) && sortOf(c) !== sortOf(q.answer)));
    if (odd) return `${odd} offered beside ${q.answer}`;
    // (every name offered shares at least one of the words: the evidence shows a real number for each; and where none
    // shares more than one, only the answer fits, and the question is marked easy unless a little-known name is offered)
    const none = q.choices.find((c) => c !== q.answer && !(Q.who[c]?.said[p] || []).some((x) => q.clue.includes(x)));
    if (none) return `${none} shares none of the words`;
    if (q.choices.every((c) => c === q.answer || (Q.who[c]?.said[p] || []).filter((x) => q.clue.includes(x)).length <= 1) && q.tier > 0 && q.choices.every((c) => fameOf(c) >= FAME.known)) return "only the answer fits the words, yet not marked easy";
    const shown = q.ev.items.map((i) => i.label).join() === q.choices.join() && q.ev.items.every((i) => i.v === (i.label === q.answer ? q.clue.length : (Q.who[i.label]?.said[p] || []).filter((x) => q.clue.includes(x)).length));
    if (!shown) return "the evidence does not count the words shown beside each name offered";
  }
  return "";
}

/** A question's mark against the rule (deal.js, DIFFICULTY), from the raw numbers: none marked hard compares two shares
 *  more than twice apart, and none marked easy names a person or body on fewer than FAME.known pages a year. */
const fameOf = (w) => (W[w] ? P.reduce((s, _, p) => s + pages(w, p), 0) / P.length : Infinity);
function hardness(q) {
  const e = q.ev, ratio = (v) => { const s = [...v].sort((a, b) => b - a); return s[0] / s[1]; };
  const r = q.kind === "freq" || q.kind === "resmi" || q.kind === "room" ? ratio(e.items.map((i) => i.v)) : q.kind === "trend" && q.answer !== "same" ? ratio(e.marks.map((p) => e.series[0].share[p])) : null;
  if (q.tier === 2 && r !== null && r > 2) return `marked hard at a ratio of ${r.toFixed(2)}`;
  // (a year: the ten words' share in it over their highest in a year within three of it, read as any ratio is: none marked
  // hard stands more than twice above its neighbours, none marked easy less than four times: "IKN, Rafah, Gibran, Gaza,
  // makan siang gratis" is not hard)
  if (q.kind === "year") {
    const sum = (r) => q.clue.reduce((a, w) => a + (W[w]?.share[r] || 0), 0), p = P.indexOf(q.answer), rest = P.map((_, r) => r).filter((r) => r !== p && sum(r) * MARGIN.yearRatio <= sum(p));
    const near = [...rest].sort((a, b) => Math.abs(a - p) - Math.abs(b - p)), within = near.filter((r) => Math.abs(r - p) <= MARGIN.yearNear), rivals = within.length >= 3 ? within : near.slice(0, 3), r = sum(p) / Math.max(...rivals.map(sum));
    if (q.tier === 2 && r > 2) return `year ${q.answer} marked hard, its words ${r.toFixed(1)} times above the nearest year`;
    if (q.tier === 0 && r < 4) return `year ${q.answer} marked easy, its words ${r.toFixed(1)} times above the nearest year`;
  }
  const names = [...new Set([...q.topics, ...q.choices.map(String), ...(q.clue || []), ...(q.n ? [q.n] : [])])].filter((w) => PEOPLE.includes(w) || BODIES.includes(w) || ["person", "organisation"].includes(W[w]?.kind));
  // (who: easy only where no name offered shares more than one of the words shown: "memeriksa, mengusut, menindak" fits the KPK
  // and the police alike)
  if (q.kind === "who" && q.tier === 0) {
    const p = P.indexOf(q.ask[1]), likes = q.choices.filter((c) => c !== q.answer).map((c) => [c, (Q.who[c]?.said[p] || []).filter((x) => q.clue.includes(x)).length]).filter(([, n]) => n >= 2);
    if (likes.length) return `marked easy, but ${likes.map(([c, n]) => `${c} shares ${n} of its ${q.clue.length} words`).join(", ")}`;
  }
  const little = names.filter((w) => fameOf(w) < FAME.known);
  if (q.tier === 0 && little.length) return `marked easy with ${little.map((w) => `${w} (${Math.round(fameOf(w))} pages a year)`).join(", ")}`;
  return "";
}

// The quiz: 300 games in one visit (decks kept between them, as the page keeps them), from three seeds.
const games = { bad: [], dealt: Object.fromEntries(KINDS.map((k) => [k, 0])), short: 0, kinds: new Set() }, band = [[], [], []];
for (const seed of [1, 2, 3]) {
  const rng = seeded(seed), d = decks(pool, rng), seen = Object.fromEntries(KINDS.map((k) => [k, []]));
  for (let g = 0; g < 100; g++) {
    const game = deal(d, rng, P), topics = new Set(), keys = new Set();
    if (game.length !== ROUNDS) games.short++;
    [...game].sort((a, b) => a.turn - b.turn).forEach((q) => !q.early && seen[q.kind].push(q.key));  // (in the order the decks dealt them; not a card dealt early, rather than a game a round short)
    game.forEach((q, i) => {
      const where = `seed ${seed} game ${g} round ${i} ${q.key}`;
      games.dealt[q.kind]++;
      if (i && game[i - 1].kind === q.kind) games.bad.push(`${where}: the same kind twice running`);
      if (game.filter((x) => x.kind === q.kind).length > capOf(q.kind)) games.bad.push(`${where}: ${game.filter((x) => x.kind === q.kind).length} questions of the kind ${q.kind} (at most ${capOf(q.kind)})`);
      band[i < 3 ? 0 : i < 7 ? 1 : 2].push(q.d);
      if (keys.has(q.key)) games.bad.push(`${where}: asked twice`);
      keys.add(q.key);
      for (const t of new Set([...q.topics, ...shownIn(q)])) { if (topics.has(t)) games.bad.push(`${where}: “${t}” again in one game`); topics.add(t); }
      if (!q.choices.includes(q.answer)) games.bad.push(`${where}: answer ${q.answer} not among ${q.choices}`);
      if (new Set(q.choices).size !== q.choices.length || q.choices.length < 2) games.bad.push(`${where}: choices ${q.choices}`);
      const m = margin(q);
      if (m) games.bad.push(`${where}: under its margin (${m})`);
      const h = hardness(q);
      if (h) games.bad.push(`${where}: ${h}`);
      if (i && game[i - 1].tier > q.tier) games.bad.push(`${where}: marked ${q.tier} after ${game[i - 1].tier} (the marks must rise)`);
    });
  }
  // A replay never repeats a question before its deck is spent: each run of `size` deals of a kind is all different.
  for (const k of KINDS) {
    const size = pool[k].length, list = seen[k];
    for (let a = 0; a < list.length; a += size) {
      const chunk = list.slice(a, a + size);
      if (new Set(chunk).size !== chunk.length) games.bad.push(`seed ${seed}: ${k} repeats before its deck of ${size} is spent`);
    }
  }
}
log(`300 quizzes: no repeat, no near-duplicate, every answer among its choices, every question over its margin, no kind over its cap (which newsroom and the loanword once), marks that rise, none marked hard over a ratio of 2 and none marked easy naming a person or body on under ${FAME.known} pages a year`, !games.bad.length && !games.short, games.bad.slice(0, 5).join("; ") || `${games.short} short`);
log("each kind dealt at least 150 times", KINDS.every((k) => games.dealt[k] >= 150), KINDS.map((k) => `${k} ${games.dealt[k]}`).join(", "));
// Harder as they go: the average difficulty (deal.js, DIFFICULTY) of rounds 1-3, 4-7 and 8-10 rises, over these games
// and over 200 games of 200 fresh visits (a first game, the one most readers play).
{ const firsts = [[], [], []];
  for (let v = 0; v < 200; v++) { const rng = seeded(100 + v); deal(decks(pool, rng), rng, P).forEach((q, i) => firsts[i < 3 ? 0 : i < 7 ? 1 : 2].push(q.d)); }
  const mean = (list) => list.reduce((a, x) => a + x, 0) / list.length, rises = (b) => mean(b[0]) + 0.15 < mean(b[1]) && mean(b[1]) + 0.15 < mean(b[2]);
  log("harder as they go: the mean difficulty of rounds 1-3, 4-7 and 8-10 rises by at least 0.15 each time", rises(band) && rises(firsts), `300 games ${band.map((b) => mean(b).toFixed(2)).join(" < ")}; 200 first games ${firsts.map((b) => mean(b).toFixed(2)).join(" < ")}`); }
// The names and words of a game go to the back for the visit's next games: over 50 visits of five games, how many a
// game shows that an earlier game of its visit showed.
{ let again = 0, all = 0;
  for (let v = 0; v < 50; v++) { const rng = seeded(500 + v), d = decks(pool, rng), before = new Set();
    for (let g = 0; g < 5; g++) { const shown = new Set(deal(d, rng, P).flatMap(shownIn)); all += shown.size; shown.forEach((w) => (again += before.has(w), before.add(w))); } }
  // (1.5 in 100: a "who" offers only names that share its words, which leaves fewer names to choose from)
  log("the names and words of a visit's earlier games come back in at most 1.5 in 100 of those its next four games show", again <= (1.5 * all) / 100, `${again} of ${all}`); }
// Within a visit, a question of a kind smaller than the games played (the years, the official words) comes back only
// after the whole deck: checked above. Across a visit's first game and its second, no question at all repeats:
{ const rng = seeded(9), d = decks(pool, rng), a = deal(d, rng, P).map((q) => q.key), b = deal(d, rng, P).map((q) => q.key);
  log("a second game in the same visit asks nothing the first asked", !a.some((k) => b.includes(k)), a.filter((k) => b.includes(k)).join(", ")); }
// Kept from page load to page load (deal.js, keep and kept, as the page keeps them in localStorage): every game on a
// fresh page load (new decks, a new shuffle, then what was kept). Over 250 games so loaded, a question comes back only
// once its deck is spent, and a spent kind sits out the next game wherever the other kinds can fill it; over 50 visits
// of five games so loaded, a game's names and words come back as rarely as within one page.
const reload = (st, seed) => kept(decks(pool, seeded(seed)), st && JSON.parse(JSON.stringify(st)));
{ let st = null, size = 0, rested = 0, spentAt = 0;
  const asked = Object.fromEntries(KINDS.map((k) => [k, []])), repeats = [];
  for (let g = 0; g < 250; g++) {
    const d = reload(st, 7000 + g), rng = seeded(9000 + g), spent = Object.keys(d).filter((k) => !d[k].fresh.length && d[k].rest === null);
    const room = Object.keys(d).filter((k) => !spent.includes(k) && d[k].fresh.length).reduce((s, k) => s + Math.min(capOf(k), d[k].fresh.length), 0);
    const game = deal(d, rng, P);
    // (where the others have room for the game; now and then a round they cannot fill, its names all taken, brings the
    // spent kind back rather than leave the game short: at most one time in ten)
    if (spent.length && room >= ROUNDS) (spentAt++, game.some((q) => spent.includes(q.kind)) || rested++);
    st = keep(d);
    size = Math.max(size, JSON.stringify(st).length);
    [...game].sort((a, b) => a.turn - b.turn).forEach((q) => !q.early && asked[q.kind].push(q.key));
  }
  for (const k of KINDS) { const n = pool[k].length; for (let a = 0; a < asked[k].length; a += n) { const part = asked[k].slice(a, a + n); if (new Set(part).size !== part.length) repeats.push(`${k} within ${n}`); } }
  let again = 0, all = 0;
  for (let v = 0; v < 50; v++) { let kept_ = null; const before = new Set();
    for (let g = 0; g < 5; g++) { const d = reload(kept_, 300 + 7 * v + g), shownNow = new Set(deal(d, seeded(800 + 7 * v + g), P).flatMap(shownIn)); kept_ = keep(d); all += shownNow.size; shownNow.forEach((w) => (again += before.has(w), before.add(w))); } }
  log("kept across page loads: no question again before its deck is spent, a spent kind sits out the next game where the others fill it (9 times in 10 at least), a visit's names go to the back, under 60 kB kept",
    !repeats.length && again <= all / 100 && rested >= 0.9 * spentAt && spentAt >= 10 && size < 60000, `${repeats.slice(0, 3).join(", ") || "no early repeat"}; ${rested} of ${spentAt} spent kinds sat out; ${again} of ${all} names and words again within a visit of five; ${size} characters kept`); }
// A name does not come round in "which peaked first" again and again: 32 names make its 134 pairs (each name in up to 13), so
// over 50 visits of five games, each loaded afresh as the page loads, a name of one game's peak questions is in another game
// of its visit's in at most 2 in 100 of those shown.
{ let all = 0, again = 0, per = {};
  for (let v = 0; v < 50; v++) { let kept_ = null; const before = new Set();
    for (let g = 0; g < 5; g++) { const d = reload(kept_, 1300 + 7 * v + g), names = deal(d, seeded(1800 + 7 * v + g), P).filter((q) => q.kind === "peak").flatMap((q) => q.topics); kept_ = keep(d); all += names.length; names.forEach((n) => (before.has(n) && (again++, (per[n] = (per[n] || 0) + 1)), before.add(n))); } }
  log("a name comes back in “which peaked first” within a visit at most 2 in 100 times", again <= all / 50, `${again} of ${all} names shown${again ? `: ${Object.entries(per).map(([n, c]) => `${n} ${c}`).join(", ")}` : ""}`); }
{ // (a version of other data is let go: the page compares deal.js's version of the questions; here, what a deck does with
  // keys it does not know: nothing)
  const rng = seeded(11), d = kept(decks(pool, rng), { games: 3, seen: [["x", 1]], decks: { year: { dealt: ["year:1999", 7], given: 5 } } });
  log("what was kept is read with care (unknown keys and bad values let go)", d.year.dealt.length === 0 && d.year.fresh.length === pool.year.length && deal(d, rng, P).length === ROUNDS, `${d.year.fresh.length} of ${pool.year.length} years fresh`); }

// Shown as the games show it: abbreviations in upper case whether or not names, names with capitals, words as counted.
{ const cases = [["ikn", "IKN"], ["kkb", "KKB"], ["ppkm", "PPKM"], ["psbb", "PSBB"], ["ott", "OTT"], ["kpk", "KPK"], ["mahfud md", "Mahfud MD"], ["erick thohir", "Erick Thohir"], ["korupsi", "korupsi"], ["ppkm darurat", "PPKM darurat"], ["whatsapp", "WhatsApp"], ["tribunnews", "tribunnews"]];
  const bad = cases.filter(([w, want]) => shown(w, W[w]?.kind) !== want);
  log("shown(): abbreviations upper case, names capitalised, common words lower case", !bad.length, bad.map(([w, want]) => `${w} → ${shown(w, W[w]?.kind)} (not ${want})`).join(", ")); }
// In English every Indonesian word a quiz can show as a clue, a choice or an answer has its gloss (text.js GLOSS,
// glossary.js), unless it is a name (shown as one) or English as it stands.
{ const loan = new Set(Q.resmi.map(([, c]) => c)), words = new Set();
  for (const k of KINDS) for (const g of pool[k]) for (const v of g.variants) { (v.clue || []).forEach((w) => words.add(w)); (v.said || []).forEach((w) => words.add(w)); (v.choices || []).forEach((w) => words.add(w)); (v.others || []).forEach((w) => words.add(w)); if (v.w) words.add(v.w); }
  for (const g of pool.trend) words.add(g.key.slice(6));
  POINTED.forEach((w) => words.add(w));
  const bare = [...words].filter((w) => typeof w === "string" && !["up", "down", "same", ...OUTLET_NAMES].includes(w) && !isName(w, W[w]?.kind) && !GLOSS[w]?.en && !GAME_GLOSS[w] && !NAME_GLOSS[w] && !loan.has(w) && !IN_ENGLISH.includes(w));
  log("in English every Indonesian word a game can show has its gloss", !bare.length, `${bare.length} without: ${bare.slice(0, 12).join(", ")}`); }

// A gloss is put in brackets by the games ("dilaporkan (reported to the police)"): none holds brackets of its own, or they nest.
{ const nested = [...Object.entries(GAME_GLOSS), ...Object.entries(NAME_GLOSS), ...Object.entries(GLOSS).map(([k, v]) => [k, v.en])].filter(([, g]) => /[()]/.test(g)).map(([k, g]) => `${k}: ${g}`);
  log("no gloss holds brackets of its own (the games bracket it: one level only)", !nested.length, nested.slice(0, 6).join("; ")); }

// Guess the number: 300 games in one visit.
const stick = JSON.parse(readFileSync(new URL("../../site/data/id-web-eras-kompas/stick.json", import.meta.url)));
const gpool = guessPool(stick), gbad = [];
let constant = Array(101).fill(0), played = 0;
const bins = [0, 0, 0], places = {}, sameAgain = [0, 0];
let earlyNames = 0, deals = 0, wordAgain = 0, wordCould = 0, highAgain = 0, highDeals = 0, keyAgain = [0, 0];
{ const rng = seeded(4), d = guessDecks(gpool, rng), seen = [[], [], []], cycle = [new Set(), new Set(), new Set()], names = [0, 1, 2].map((b) => new Set(gpool.filter((q) => q.bin === b).map((q) => q.name)));
  let before = [], lastNames = new Set();
  for (let g = 0; g < 300; g++) {
    const game = guessDeal(d, rng), topics = new Set();
    // (a word of the last game again in this one, where the 17 words left others free: six a game, so always)
    { const last = new Set(before), all = new Set(gpool.map((q) => q.w)); if (all.size - last.size >= GUESS_ROUNDS) { wordCould++; wordAgain += game.filter((q) => last.has(q.w)).length; } }
    game.forEach((q, i) => ((places[q.w] ||= Array(GUESS_ROUNDS).fill(0))[i]++, before[i] && (sameAgain[0] += before[i] === q.w, sameAgain[1]++)));
    before = game.map((q) => q.w);
    const theseNames = new Set(game.map((q) => q.name));
    if (game.length !== GUESS_ROUNDS) gbad.push(`game ${g}: ${game.length} rounds`);
    for (const q of [...game].sort((a, b) => a.turn - b.turn)) {
      seen[q.bin].push([q.key, g]);
      // (a name comes back in its bin only after every other name of the bin has been dealt)
      // (allowed only at the end of a round of names, once 85% of them have been dealt: the few left may all be in the
      // game already, or have no card whose word is free)
      // (the high bin is small, three a game: there a name of the last game counts instead)
      if (q.bin < 2) { if (cycle[q.bin].has(q.name) && cycle[q.bin].size < 0.85 * names[q.bin].size) earlyNames++; deals++; }
      else { highDeals++; if (lastNames.has(q.name)) highAgain++; }
      cycle[q.bin].add(q.name);
      if ([...names[q.bin]].every((n) => cycle[q.bin].has(n))) cycle[q.bin].clear();
      for (const t of q.topics) { if (topics.has(t)) gbad.push(`game ${g}: “${t}” twice`); topics.add(t); }
      // Only a name a reader knows as one person or body (deal.js's list: no bare first name, no common word), and only
      // a word with a point (POINTED: not "anak", "video").
      if (!PEOPLE.includes(q.name) && !BODIES.includes(q.name)) gbad.push(`game ${g}: “${q.name}” is not a name a reader knows`);
      if (!POINTED.includes(q.w)) gbad.push(`game ${g}: “${q.w}” is an everyday word`);
      const i = stick.names.indexOf(q.name);
      if (stick.pages[i][2] < MARGIN.guessPages || (stick.share[q.w][i][2] * stick.pages[i][2]) / 1000 < MARGIN.guessHits) gbad.push(`game ${g}: ${q.key} on too few pages`);
      if (Math.round(stick.share[q.w][i][2] / 10) !== q.v) gbad.push(`game ${g}: ${q.key} is not ${q.v}`);
      // Only a word on which names differ: the most of it at least MARGIN.spreadTop in 100, and at least three times the least
      // (computed here from the raw numbers over every known name on enough pages).
      const among = stick.names.map((_, k) => k).filter((k) => (PEOPLE.includes(stick.names[k]) || BODIES.includes(stick.names[k])) && stick.pages[k][2] >= MARGIN.guessPages && stick.share[q.w][k][2] !== null && (stick.share[q.w][k][2] * stick.pages[k][2]) / 1000 >= MARGIN.guessHits).map((k) => stick.share[q.w][k][2]);
      if (Math.max(...among) < 10 * MARGIN.spreadTop || Math.max(...among) < MARGIN.spreadRatio * Math.min(...among)) gbad.push(`game ${g}: “${q.w}” has no spread across names (${(Math.min(...among) / 10).toFixed(1)}–${(Math.max(...among) / 10).toFixed(1)} in 100)`);
      bins[q.bin]++;
    }
    lastNames = theseNames;
    if (new Set(game.map((q) => q.bin)).size < 3) gbad.push(`game ${g}: its values are not low, middle and high (${game.map((q) => q.v).join(", ")})`);
    for (const c of STOPS) constant[c] += game.reduce((s, q) => s + points(c, q.v), 0) / (game.length * 100);
    played++;
  }
  // (the same question, a word and a name, not again within four games: the rule on names, above, comes first, and a bin's
  // deck, where a name holds several of its cards, cannot also be dealt whole before any card comes again)
  // (in the high bin, at most 1 deal in 50: it gives way before a word of the last game would come again)
  const last = {};
  seen.forEach((list, b) => list.forEach(([key, g]) => { if (last[key] !== undefined && g - last[key] < 5) { if (b < 2) gbad.push(`${key} again after ${g - last[key]} games`); else keyAgain[0]++; } if (b === 2) keyAgain[1]++; last[key] = g; }));
}
const best = Math.max(...constant) / played, at = constant.indexOf(Math.max(...constant));
console.log(`     guess the number: ${gpool.length} distinct questions (${["low", "middle", "high"].map((name, b) => `${gpool.filter((q) => q.bin === b).length} ${name}`).join(", ")}), ${new Set(gpool.map((q) => q.w)).size} words, ${new Set(gpool.map((q) => q.name)).size} names`);
log(`300 guess games: six rounds, no word or name twice, every value as counted, only words with a spread across names, low, middle and high in every game (${bins.join(", ")} dealt), no word of the last game again; a name back in a low or middle bin only once 85% of the bin's names have been dealt (at most 1 deal in 100 sooner, to keep a word of the last game out), and in the high bin a name of the last game in at most 1 deal in 10, the same word and name within four games at most 1 in 50`,
  !gbad.length && bins.every((n) => n >= 280) && !wordAgain && wordCould >= 290 && earlyNames <= deals / 100 && highAgain <= highDeals / 10 && keyAgain[0] <= keyAgain[1] / 50, gbad.slice(0, 5).join("; ") || `${wordAgain} words of the last game again in ${wordCould} games; ${earlyNames} names back early in the low and middle bins; high bin: ${highAgain} of ${highDeals} a name of the last game, ${keyAgain[0]} the same question within four games`);
log("no one fixed guess wins: the best (always guessing " + at + ") scores under 65% on average, and a guess within 2 of the truth always scores at least 80", best < 0.65 && STOPS.every((v) => v > 0 ? [-2, -1, 0, 1, 2].every((e) => points(Math.max(0, v + e), v) >= 80) : true), `${Math.round(best * 100)}%`);
// The order of a game is its own shuffle: a word met often stands at every place of a game, at none in more than a
// third of its games, and the next game puts a word at the same place no more often than chance would.
{ const often = Object.entries(places).filter(([, c]) => c.reduce((a, b) => a + b, 0) >= 60), lop = often.filter(([, c]) => c.some((x) => !x) || Math.max(...c) > c.reduce((a, b) => a + b, 0) / 3);
  log("a word's round varies from game to game", often.length >= 3 && !lop.length && sameAgain[0] / sameAgain[1] < 0.2, `${often.length} words met 60 times or more; ${lop.map(([w, c]) => `${w} ${c}`).join("; ") || "each at every place"}; the same word at the same place in the next game ${(100 * sameAgain[0] / sameAgain[1]).toFixed(1)}% of rounds`); }
// The scale: one mapping, 0-20 over two thirds of the track by ones, 20-100 over the rest by fives; and the line said
// follows the points (no "close" for a guess that scored nothing).
log("the scale gives 0-20 two thirds of the track, and every stop maps back to itself", Math.abs(along(20) - 2 / 3) < 1e-9 && along(100) === 1 && STOPS.every((v) => stopAt(along(v)) === v) && STOPS.length === 37,
  `along(20) ${along(20).toFixed(3)}, ${STOPS.length} stops`);
log("points as given (round(100 x max(0, 1 - |guess - truth| / max(10, 1.5 x truth)))), the line after a guess follows them, the rank by the share of points",
  [[8, 3], [8, 5], [3, 3], [20, 23], [60, 30]].every(([g, v]) => { const won = points(g, v), n = nearness(won); return (won >= 90) === (n === 0) && (won < 25) === (n === 3) && close(won) === (won >= 60); })
  && points(3, 3) === 100 && points(8, 5) === 70 && points(2, 6) === 60 && points(12, 6) === 40 && points(13, 2) === 0 && points(12, 2) === 0 && points(40, 50) === 87 && points(1, 2) === 90 && guessRank(0, 600) === 3 && guessRank(167, 600) === 3 && guessRank(180, 600) === 2 && guessRank(330, 600) === 1 && guessRank(480, 600) === 0,
  [[8, 5], [2, 6], [5, 1], [6, 2]].map(([g, v]) => `guess ${g}, truth ${v}: ${points(g, v)} points`).join("; "));

// Every string the games use, in both languages.
const KEYS = ["said_right", "said_right_memory", "said_right_hard", "said_close", "said_wrong", "said_wrong_memory", "said_streak", "said_near", "said_exact", "guess_second", "said_far_above", "said_far_below", "said_rank", "quiz_tier", "ask_room", "quiz_who_ask", "guess_numbers", "guess_counted", "guess_least", "guess_top", "guess_next", "guess_break", "guess_unset", "guess_less", "guess_more_one", "guess_of", "ask_freq", "ask_peak", "ask_resmi", "ask_room", "ask_trend", "trend_up", "trend_down", "trend_same",
  "room_era", "ev_freq", "ev_peak", "ev_room", "ev_trend", "ev_year", "ev_who", "caveat", "quiz_status", "quiz_streak", "quiz_keys", "quiz_plate_all", "guess_context", "next_toy",
  "played_best", "played_once", "quiz_year_ask", "quiz_who_ask", "quiz_tally", "quiz_save", "quiz_log", "quiz_next", "quiz_share", "guess_ask", "guess_lock", "guess_score",
  "guess_more", "guess_done", "guess_rule", "try_label", "guess_share", "copy_score", "copied", "again", "next", "nav_quiz", "play_tebak", "play_kuis", "quiz_lede", "guess_lede", "guess_yours"];
const missing = ["id", "en"].flatMap((l) => KEYS.filter((k) => TEXT[l][k] === undefined).map((k) => `${l}.${k}`));
const lengths = ["said_right", "said_right_memory", "said_right_hard", "said_wrong", "said_wrong_memory", "said_near", "said_far_above", "said_far_below", "said_rank", "quiz_tier"].filter((k) => TEXT.id[k]?.length !== TEXT.en[k]?.length);
log("every string of the games in both languages", !missing.length && !lengths.length, [...missing, ...lengths].join(", "));
// The owner's wording, exactly.
const OWN = {
  id: { said_right: ["Tepat.", "Betul.", "Kena."], said_right_memory: ["Ingatanmu bagus."], said_right_hard: ["Betul, dan tanpa menyontek.", "Benar. Redaktur pun belum tentu ingat."],
    said_wrong: ["Bukan. Jawabannya X.", "Meleset. Yang benar: X."], said_wrong_memory: ["Ingatan memang suka menipu. Jawabannya X."], said_close: ["Nyaris. X."],
    said_streak: ["Tiga beruntun. Jangan-jangan kamu wartawan."], quiz_who_ask: ["Kata-kata ini paling sering menemani satu nama di berita Kompas X. Nama yang mana?"],
    ask_room: ["Kompas, Tempo, atau Tribunnews: siapa paling sering menulis “X” di berita tentang X?"],
    said_near: ["Nyaris sempurna.", "Dekat.", "Lumayan, tapi meleset."],
    said_exact: ["Tepat."], said_far_above: ["Tebakanmu terlalu tinggi."],
    said_far_below: ["Tebakanmu terlalu rendah."],
    guess_rule: ["Tepat: 100 poin. Untuk angka sampai 6, tiap selisih satu angka memotong 10 poin; untuk angka lebih besar, kurang dari itu."],
    guess_top: ["Tak ada nama lain yang lebih sering sehalaman dengan “X”."] },
  en: { said_right: ["Spot on.", "Right.", "Got it."], said_right_memory: ["Good memory."], said_right_hard: ["Right, and no peeking.", "Correct. Not every editor would get that."],
    said_wrong: ["No. It was X.", "Missed. The answer: X."], said_wrong_memory: ["Memory plays tricks. It was X."], said_close: ["So close. X."],
    said_streak: ["Three in a row. Are you a reporter?"], quiz_who_ask: ["These words kept one name company in Kompas news in X. Which name?"],
    ask_room: ["Kompas, Tempo or Tribunnews: which writes “X” most often in stories about X?"],
    said_near: ["Almost exact.", "Close.", "Not bad, but off."],
    said_exact: ["Exact."], said_far_above: ["Your guess was too high."],
    said_far_below: ["Your guess was too low."],
    guess_rule: ["Exact: 100 points. For a number up to 6, each step off costs 10 points; for a larger one, fewer."],
    guess_top: ["No other name shares a page with “X” more often."] },
};
log("the rule line is true for every number: 10 a step up to 6, under 10 above, and an exact guess is said exact", [1, 2, 3, 4, 5, 6].every((v) => points(v + 1, v) === 90 && points(v + 3, v) === 70) && [12, 40, 100].every((v) => points(v + 1, v) > 90) && points(8, 7) >= 90 && points(7, 7) === 100 && TEXT.id.said_exact === "Tepat." && TEXT.en.said_exact === "Exact." && !TEXT.id.said_near.includes("Tepat.") && !TEXT.en.said_near.includes("Exact."));
const said = (v) => [].concat(v).map((x) => (typeof x === "function" ? x("X", "X") : x));
const off = Object.entries(OWN).flatMap(([l, keys]) => Object.entries(keys).filter(([k, list]) => JSON.stringify(said(TEXT[l][k])) !== JSON.stringify(list)).map(([k]) => `${l}.${k}`));
log("the reactions and asks are worded as given", !off.length && TEXT.en.ask_trend("w", 1, 2) === "“w”, from 1 to 2: up, down, or about the same?" && ["Arsip berjalan", "Baru bangun tidur"].every((x) => TEXT.id.said_rank.includes(x)) && !JSON.stringify(said(TEXT.id.said_wrong)).includes("Belum") && !JSON.stringify(said(TEXT.en.said_wrong)).includes("Not yet"), off.join(", "));
console.log(`     (without a browser: ${((Date.now() - started) / 1000).toFixed(1)} s)`);

// ---- in a browser ----------------------------------------------------------------------------------------------------
if (process.env.GAMES_NO_BROWSER) process.exit(failures ? 1 : 0);
const { base, browser, done } = await import("./serve.mjs");
const SIZES = [[390, 844, true], [1440, 900, false]];
for (const [w, h, touch] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: "reduce", acceptDownloads: true });
  const p = await ctx.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  // Where the control that goes on stands: on a phone, on the screen (held at its foot); from 900px, in its panel, which
  // is held beside the round as the page scrolls.
  const goAt = () => p.evaluate(() => {
    const r = document.querySelector(".quiz-go").getBoundingClientRect(), log = document.querySelector(".quiz-log").getBoundingClientRect(), phone = innerWidth < 900;
    return `${Math.round(r.left - (phone ? 0 : log.left))},${Math.round(r.top - (phone ? 0 : log.top))}`;
  });
  // The first action on the first screen, clear of the bar held at a phone's foot.
  const firstAction = (sel) => p.evaluate((sel) => { const n = document.querySelector(sel); if (!n) return -1; const r = n.getBoundingClientRect(), bar = document.querySelector(".quiz-log").getBoundingClientRect();
    const limit = innerWidth < 900 && !bar.contains?.(n) && !document.querySelector(".quiz-log").contains(n) ? bar.top : innerHeight; return r.bottom <= limit ? Math.round(r.bottom) : -Math.round(r.bottom); }, sel);

  // The quiz: at 1440 by keyboard alone (1-4, then Enter), at 390 by taps.
  await p.goto(base + "#/kuis"); await p.waitForSelector(".quiz .choices button");
  const first = await firstAction(".quiz .choices button");
  const quiz = { rounds: 0, figures: 0, focus: 0, places: new Set(), streakShown: false, kinds: [], moved: [], below: 0 };
  for (let k = 0; k < 12 && (await p.locator(".quiz .choices button").count()); k++) {
    // (the kind of each round, as the live page deals it; and from 900px, where the card is before and after an answer)
    const was = await p.evaluate(() => ({ kind: document.querySelector(".quiz-card").dataset.kind, y: scrollY, top: Math.round(document.querySelector(".quiz-card").getBoundingClientRect().top), h: document.querySelector(".quiz-card").offsetHeight }));
    quiz.kinds.push(was.kind);
    (quiz.keys ||= []).push(await p.evaluate(() => document.querySelector(".quiz-card").dataset.key));
    if (touch) await p.locator(".quiz .choices button").nth(k % 2).tap(); else await p.keyboard.press(String(1 + (k % 2)));
    await p.waitForTimeout(60);
    if (!touch) { const now = await p.evaluate(() => ({ y: scrollY, top: Math.round(document.querySelector(".quiz-card").getBoundingClientRect().top), h: document.querySelector(".quiz-card").offsetHeight, foot: Math.round(document.querySelector(".quiz-board").getBoundingClientRect().bottom) }));
      if (now.y !== was.y || now.top !== was.top || Math.abs(now.h - was.h) > 1) quiz.moved.push(`round ${k + 1}: scroll ${was.y}→${now.y}, top ${was.top}→${now.top}, height ${was.h}→${now.h}`);
      if (k === 0 && now.foot > h) quiz.below = now.foot; }
    quiz.figures += await p.locator(".quiz .reveal svg :is(circle, path)").count() > 2 ? 1 : 0;
    quiz.focus += (await p.evaluate(() => document.activeElement?.classList.contains("quiz-go"))) ? 1 : 0;
    quiz.places.add(await goAt());
    if (touch) await p.locator(".quiz-go").tap(); else await p.keyboard.press("Enter");
    await p.waitForTimeout(60);
    quiz.rounds++;
  }
  const end = await p.evaluate(() => ({ score: document.querySelector(".quiz .score")?.textContent, rank: document.querySelector(".quiz .rank")?.textContent, plate: !!document.querySelector(".quiz .plate svg"), go: document.querySelector(".quiz-go").textContent }));
  const saved = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).then((d) => d.suggestedFilename()).catch(() => null), p.locator(".quiz .controls button").first().click()]).then(([f]) => f);
  // Every copy goes through one helper: where the clipboard is refused, the button says so and the text stands beside
  // it, selected; nothing thrown.
  { const before = errors.length;
    await p.evaluate(() => { try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("refused", "NotAllowedError")) } }); } catch {} });
    await p.locator(".quiz .controls button").nth(1).click(); await p.waitForTimeout(100);
    const said = await p.evaluate(() => { const b = document.querySelectorAll(".quiz .controls button")[1], f = document.querySelector(".quiz .copy-field"); return { text: b.textContent, field: !!f && f.value.length > 10 && document.activeElement === f && f.selectionEnd - f.selectionStart === f.value.length }; });
    log(`quiz at ${w}: a refused copy says so (“Tidak bisa menyalin”) and leaves the text selected to copy by hand`, said.text === "Tidak bisa menyalin" && said.field && errors.length === before, `“${said.text}”${said.field ? "" : ", no text selected beside it"}${errors.length > before ? `; ${errors.slice(before).join(" / ")}` : ""}`); }
  log(`quiz at ${w}: the first answer on screen, ${ROUNDS} rounds ${touch ? "by taps" : "by keyboard alone"}, the evidence drawn and focus on “next” each time, “next” in one place, a plate saved`,
    first > 0 && quiz.rounds === ROUNDS && quiz.figures === ROUNDS && quiz.focus === ROUNDS && quiz.places.size === 1 && end.plate && end.rank && /\.png$/.test(saved || "") && !errors.length,
    `first answer ${first > 0 ? `ends at ${first}px` : `below the screen (${-first}px)`}; ${quiz.rounds} rounds; ${quiz.figures} figures; focus on next ${quiz.focus}×; next at ${[...quiz.places].join(" | ")}; ${end.score} “${end.rank}”; saved ${saved}; errors ${errors.slice(0, 2).join(" / ") || 0}`);
  // The rules of the deal as the live page plays them: no kind more than twice, "which newsroom" and the loanword once.
  { const count = {}; quiz.kinds.forEach((k) => (count[k] = (count[k] || 0) + 1));
    const over = Object.entries(count).filter(([k, n]) => n > capOf(k));
    log(`quiz at ${w}, as dealt on the page: no kind more than twice, “which newsroom” and the loanword at most once${touch ? "" : "; an answer moves nothing (no scroll, the card where it was and as tall), and the first round with its answer ends on the first screen"}`,
      quiz.kinds.length === ROUNDS && !over.length && !quiz.moved.length && !quiz.below, `${quiz.kinds.join(" ")}${over.length ? `; over: ${over.map(([k, n]) => `${k} ${n}`).join(", ")}` : ""}${quiz.moved.length ? `; ${quiz.moved.slice(0, 2).join("; ")}` : ""}${quiz.below ? `; the board ends at ${quiz.below}px` : ""}`); }
  // Play again: one tap, a new game, nothing of the last asked again.
  const before = await p.evaluate(() => document.querySelector(".quiz .ask")?.textContent);
  await p.locator(".quiz-go").click(); await p.waitForTimeout(100);
  log(`quiz at ${w}: “play again” starts a new game in place`, (await p.locator(".quiz .choices button").count()) > 1 && (await goAt()) === [...quiz.places][0], `go at ${await goAt()}; ask ${before?.slice(0, 30)} → ${(await p.evaluate(() => document.querySelector(".quiz .ask")?.textContent))?.slice(0, 30)}`);

  // A page loaded again (the reviewer's case: each game on a fresh load) deals on from what was kept: its game asks
  // nothing the first game asked.
  { await p.goto(base + "#/kuis"); await p.waitForSelector(".quiz .choices button");
    const again = [];
    for (let k = 0; k < ROUNDS && (await p.locator(".quiz .choices button").count()); k++) {
      again.push(await p.evaluate(() => document.querySelector(".quiz-card").dataset.key));
      if (touch) await p.locator(".quiz .choices button").first().tap(); else await p.keyboard.press("1");
      await p.waitForTimeout(30);
      if (touch) await p.locator(".quiz-go").tap(); else await p.keyboard.press("Enter");
      await p.waitForTimeout(30);
    }
    const twice = again.filter((k) => quiz.keys.includes(k));
    log(`quiz at ${w}: a page loaded again asks nothing the last game asked (what was dealt is kept)`, again.length === ROUNDS && !twice.length, `${again.length} rounds; asked again: ${twice.join(", ") || "none"}`); }

  // Guess the number: by keyboard at 1440 (Tab to the slider, arrows, Enter), by taps at 390.
  errors.length = 0;
  await p.goto(base + "#/tebak"); await p.waitForSelector(".gauge .track");
  const gfirst = await firstAction(".quiz-go");
  // No guess is set for the reader: the lock waits until one is.
  const unset = await p.evaluate(() => document.querySelector(".gauge").classList.contains("unset") && document.querySelector(".quiz-go").disabled);
  const guess = { rounds: 0, focus: 0, places: new Set(), verdicts: 0, lines: 0 };
  for (let k = 0; k < 8 && (await p.locator(".gauge:not(.locked) .track").count()); k++) {
    (guess.keys ||= []).push(await p.evaluate(() => document.querySelector(".quiz-card").dataset.key));
    if (touch) { const box = await p.locator(".gauge .scale").boundingBox(); await p.touchscreen.tap(box.x + box.width * 0.1, box.y + box.height / 2); await p.locator(".gauge .more").tap(); await p.locator(".quiz-go").tap(); }
    else { await p.locator(".gauge .track").focus(); for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter"); }
    await p.waitForTimeout(60);
    guess.verdicts += (await p.locator(".quiz .verdict .context").count());
    // (the verdict, the numbers, the context and the link, each on a line of its own)
    guess.lines += await p.evaluate(() => { const v = [...document.querySelector(".quiz .verdict").children].map((n) => n.getBoundingClientRect()); return v.length === 4 && v.every((r, i) => !i || r.top >= v[i - 1].bottom - 1) ? 1 : 0; });
    guess.focus += (await p.evaluate(() => document.activeElement?.classList.contains("quiz-go"))) ? 1 : 0;
    guess.places.add(await goAt());
    if (touch) await p.locator(".quiz-go").tap(); else await p.keyboard.press("Enter");
    await p.waitForTimeout(60);
    guess.rounds++;
  }
  const gend = await p.evaluate(() => ({ score: document.querySelector(".quiz .score")?.textContent, plate: !!document.querySelector(".quiz .plate svg"), rank: document.querySelector(".quiz .rank")?.textContent, rule: !!document.querySelector(".game-rule")?.checkVisibility() }));
  const gsaved = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).then((d) => d.suggestedFilename()).catch(() => null), p.locator(".quiz .controls button").first().click()]).then(([f]) => f);
  log(`guess at ${w}: the lock on screen and waiting for a guess, six rounds ${touch ? "by taps on the scale" : "by keyboard alone"}, a verdict with its context, focus on “next”, “next” in one place, a plate saved`,
    gfirst > 0 && unset && guess.rounds === GUESS_ROUNDS && guess.verdicts === GUESS_ROUNDS && guess.lines === GUESS_ROUNDS && guess.focus === GUESS_ROUNDS && guess.places.size === 1 && gend.plate && !gend.rule && /\.png$/.test(gsaved || "") && !errors.length,
    `lock ${gfirst > 0 ? `ends at ${gfirst}px` : `below the screen (${-gfirst}px)`}${unset ? "" : ", a guess set before the reader set one"}; ${guess.rounds} rounds; ${guess.verdicts} verdicts, ${guess.lines} laid out a line each;${gend.rule ? " the rule shown at the end;" : ""} focus ${guess.focus}×; next at ${[...guess.places].join(" | ")}; ${gend.score} “${gend.rank}”; saved ${gsaved}; errors ${errors.slice(0, 2).join(" / ") || 0}`);

  // Guess the number loaded again deals on from what was kept, as the quiz does: no word of the last game, no question
  // of it again, and the games counted on.
  { const games = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem("dealt")).guess.st.games; } catch { return null; } });
    const was = await games();
    await p.goto(base + "#/tebak"); await p.waitForSelector(".gauge .track");
    const again = [];
    for (let k = 0; k < GUESS_ROUNDS && (await p.locator(".gauge:not(.locked) .track").count()); k++) {
      again.push(await p.evaluate(() => document.querySelector(".quiz-card").dataset.key));
      await p.locator(".gauge .more").click(); await p.locator(".quiz-go").click(); await p.waitForTimeout(30); await p.locator(".quiz-go").click(); await p.waitForTimeout(30);
    }
    const words = new Set((guess.keys || []).map((k) => k.split("|")[0])), back = again.filter((k) => words.has(k.split("|")[0]) || guess.keys.includes(k)), now = await games();
    log(`guess at ${w}: a page loaded again deals on from what was kept (no word or question of the last game again)`, again.length === GUESS_ROUNDS && !back.length && was >= 1 && now === was + 1, `${again.length} rounds; again: ${back.join(", ") || "none"}; games kept ${was} → ${now}`); }

  // The hub remembers what was played, and every toy shows its first control on the first screen; nothing only a hover shows.
  await p.goto(base + "#/main"); await p.waitForSelector(".play-card");
  const remembered = await p.evaluate(() => [...document.querySelectorAll(".play-card .played")].map((n) => n.textContent));
  log(`hub at ${w} remembers the games played and their best`, remembered.length >= 2, remembered.join(" | "));
  // (on a phone the head is short enough that the first game's card and its button are whole on the first screen; the
  // kicker says what there is)
  const hub = await p.evaluate(() => ({ card: Math.round(document.querySelector(".play-games .play-card").getBoundingClientRect().bottom), kicker: document.querySelector(".page-head .kicker")?.textContent }));
  log(`hub at ${w}: ${touch ? "the first game card whole on the first screen, " : ""}the kicker says what there is`, (!touch || hub.card <= h) && /^2 permainan, 7 penjelajah$/.test(hub.kicker), `card ends at ${hub.card}px of ${h}; “${hub.kicker}”`);
  const toys = [];
  for (const toy of ["menempel", "lingkaran", "redaksi", "pasang", "balap", "tahun", "bergeser", "entitas"]) {
    await p.goto(base + "#/" + toy); await p.waitForTimeout(1500);
    const look = await p.evaluate(({ touch, names }) => {
      const view = document.getElementById("view"), head = view.querySelector(".page-head");
      const controls = [...view.querySelectorAll("button, input, select, a[role=button], .chips a")].filter((n) => n.getClientRects().length && !head?.contains(n));
      const r = controls[0]?.getBoundingClientRect();
      // Hover-only: anything with a tip that answers neither a tap (click) nor a key.
      const hoverOnly = [...view.querySelectorAll("[data-tip]")].length && !view.querySelector("[data-tip-tap]") ? 1 : 0;
      // Where the toy's result (its figure, list or table) begins.
      const result = [...view.querySelectorAll(".plate, .movers-list, .tide, .race, .wall, .orbit")].find((n) => n.getClientRects().length && !head?.contains(n));
      // One behaviour for every row or label that stands for a word or a name: a link to its page (a portrait, else the
      // word's), reachable by keyboard, its name the word itself (app.js toWord).
      const links = [...view.querySelectorAll("a.to-word")].filter((n) => n.getClientRects().length);
      const odd = links.filter((n) => !/\/(kata|potret)\/|#\/(kata|potret)\//.test(n.getAttribute("href") || "") || n.tabIndex < 0 || !n.textContent.trim()).length;
      // A row that stands for a word or a name is one link across the whole row, its value inside it or covered by it
      // (app.js toWord; a table's row covered by its name's link; a plate's row by a rect as wide as the plate); on a
      // touch screen 44px tall, and every row of one list whose name takes one line as tall as the others. No link of a
      // row is only a part of it, and no second link stands in a row.
      const rows = links.filter((n) => n.matches(".row-link") || n.closest("tr.row-tr")), bad = [], heights = new Map();
      for (const n of rows) {
        const svg = n.closest("svg"), target = svg ? n.querySelector(".hit") : n.closest("tr.row-tr") || n, row = svg || n.closest("tr, li, .row, th") || n;
        // (the row's own width: inside its padding and border)
        const a = target.getBoundingClientRect(), cs = getComputedStyle(row), name = n.getAttribute("aria-label") || n.textContent.trim();
        const inner = svg ? svg.clientWidth : row.getBoundingClientRect().width - ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((sum, k) => sum + parseFloat(cs[k]), 0);
        if (touch && a.height < 43.5) bad.push(`“${name}” ${Math.round(a.height)}px tall`);
        if (a.width < inner - 1) bad.push(`“${name}” ${Math.round(a.width)} of its row's ${Math.round(inner)}px`);
        const line = n.querySelector(".row-name") || n, one = svg || line.getBoundingClientRect().height < 1.5 * parseFloat(getComputedStyle(line).lineHeight);
        const list = n.closest("ul, ol, table, svg, .race");
        if (one && list) heights.set(list, [...(heights.get(list) || []), Math.round(a.height)]);
        if ((n.closest("li, tr, .row")?.querySelectorAll("a").length || 1) > 1) bad.push(`“${name}” shares its row with another link`);
      }
      for (const [, list] of heights) if (Math.max(...list) - Math.min(...list) > 1) bad.push(`rows of one list ${Math.min(...list)} to ${Math.max(...list)}px tall`);
      bad.push(...links.filter((n) => !rows.includes(n) && n.closest("li, tr, .race .row")).map((n) => `“${n.textContent.trim()}” is a part of its row`));
      // (a name shown as a name: deal.js shown, never in lower case)
      if (names) bad.push(...links.map((n) => (n.getAttribute("aria-label") || n.textContent).trim()).filter((x) => /^\p{Ll}/u.test(x)).slice(0, 3).map((x) => `name “${x}” in lower case`));
      return { first: r ? Math.round(r.bottom) : 9999, hoverOnly, result: result ? Math.round(result.getBoundingClientRect().top) : 9999, links: links.length, odd, bad: [...new Set(bad)] };
    }, { touch, names: ["menempel", "lingkaran", "pasang", "entitas"].includes(toy) });
    if (look.bad.length) failures++, console.log(`FAIL ${toy} at ${w}: ${look.bad.slice(0, 4).join("; ")}`);
    toys.push(`${toy} ${look.first}/${look.result} ${look.links} links${look.hoverOnly ? " hover-only" : ""}`);
    if (!look.links || look.odd) failures++, console.log(`FAIL ${toy} at ${w}: ${look.links} rows or labels link to their page${look.odd ? `, ${look.odd} not as the rest` : ""}`);
    // (on a 390x844 phone the result begins in the first 560px: the toy is seen working before any scroll)
    const late = w === 390 && look.result > 560;
    if (look.first > h || look.hoverOnly || late) failures++, console.log(`FAIL ${toy} at ${w}: first control ends at ${look.first}px, the result begins at ${look.result}px${look.hoverOnly ? "; a tip only a hover shows" : ""}`);
  }
  console.log(`     toys at ${w}, where the first control ends / the result begins (under 560px at 390): ${toys.join(", ")}`);
  // What moved: the switch between words and names lists the other in place, the source, the pair of periods and the
  // scroll kept, the address following; the names come first whole (no bare first name or roman numeral leads), and the
  // count under the list in the site's figures (15.999, not 15999).
  { await p.goto(base + "#/bergeser"); await p.waitForSelector("ul.movers");
    await p.locator(".chips button, .chips [role=tab]").filter({ visible: true }).nth(1).click(); await p.waitForSelector("ul.movers"); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.querySelector("select[name=pair]"); s.value = "0"; s.dispatchEvent(new Event("change")); window.__kept = document.querySelector(".movers-list"); scrollTo(0, 500); });
    await p.waitForTimeout(200);
    const was = await p.evaluate(() => ({ y: scrollY, source: [...document.querySelectorAll(".chips [aria-selected=true], .chips [aria-pressed=true]")].map((n) => n.textContent).join(), pair: document.querySelector("select[name=pair]").value }));
    await p.evaluate(() => document.querySelectorAll(".switch a")[1].click()); await p.waitForTimeout(300);  // (a press where the list is read: a click would first scroll the switch into view)
    const now = await p.evaluate(() => ({ y: scrollY, source: [...document.querySelectorAll(".chips [aria-selected=true], .chips [aria-pressed=true]")].map((n) => n.textContent).join(), pair: document.querySelector("select[name=pair]").value, same: window.__kept === document.querySelector(".movers-list"), at: location.href,
      first: document.querySelector(".movers .row-name")?.textContent, head: document.querySelector(".movers-group")?.textContent, flagged: document.querySelector(".flagged")?.textContent, most: document.documentElement.scrollHeight - innerHeight }));
    log(`what moved at ${w}: “Nama” lists the names in place (address, source, pair of periods and scroll kept), led by a whole name, its counts with the site's separators`,
      now.same && /entitas/.test(now.at) && Math.abs(now.y - Math.min(was.y, now.most)) <= 2 && now.source === was.source && now.pair === was.pair && /^[\p{Lu}\d]/u.test(now.first || "") && !/\d{5}/.test(now.flagged || "x0000000"),
      `scroll ${was.y} → ${now.y}; source ${was.source} → ${now.source}; pair ${was.pair} → ${now.pair}; ${now.same ? "in place" : "drawn anew"}; ${now.at.split("#")[1] || now.at}; first “${now.first}” under “${now.head}”; “${now.flagged}”`); }
  await ctx.close();
}
console.log(`     ${((Date.now() - started) / 1000).toFixed(1)} s`);
await done(failures);
