// The games' questions: which may be asked, how they are dealt, and when an answer is clear enough to ask. No DOM
// here: the quiz page (app.js) and tests/site/games.mjs deal from the same code and the same data, site/data/quiz.json
// (what the counting found, gathered by `node tests/site/games.mjs write`) and, for "guess the number", the Kompas
// stick.json the page already reads.

/** Every margin a question must clear to be dealt, in one place. Where the data cannot say the answer clearly, the
 *  question is not asked: a game that is unfair once is not trusted again. */
export const MARGIN = {
  ratio: 1.5,      // two shares compared (which is more frequent, official word or loanword, which newsroom, up or down): the larger at least 1.5 times the smaller
  same: 1.15,      // "about the same": the two within 15% of each other (between 1.15 and 1.5 nothing is asked: neither answer is clear)
  pages: 40,       // a share compared stands on at least this many pages (of the year, or of the pages naming the name)
  least: 10,       // ... and the smaller of two on at least this many, so that "more often" is not "once against never"
  peakNear: 0.85,  // a word's peak is every year within 85% of its highest share ...
  peakGap: 2,      // ... and "which peaked first" is asked only where all of one's peak years are this many years before all of the other's
  peakStand: 2.5,  // ... and each peak stands at least this many times the word's median year (a word with no peak has no "first")
  roomPages: 300,  // which newsroom: each of the three names the name on at least this many pages (stick.json's own rule, app.js STUCK_PAGES)
  whoPages: 150,   // who: the name is on at least this many pages of the year whose verbs are shown
  whoShared: 3,    // who: no other choice shares more than this many of the eleven words shown in that year (else two answers fit)
  yearRatio: 1.5,  // which year: in every other year offered, the ten words together stand at most 1/1.5 of their year's share
  guessPages: 1500,// guess the number: the name is on at least this many pages of 2020-2024, so that "of 100" is a real hundred
  guessHits: 30,   // ... and at least this many of them hold the word (a count of 3 is not a share)
};

/** Names a general reader would know. The data names hundreds of people and bodies, many by a fragment ("setiawan",
 *  "sp") or known only to a reporter; a game asks only about these (a filter, not a source: a name here that the data
 *  does not count well enough is simply not asked). One spelling per person, so that a name never comes back under
 *  another ("jokowi", not also "joko widodo"). */
export const PEOPLE = ["jokowi", "prabowo", "ahok", "anies baswedan", "megawati", "sby", "ganjar pranowo", "sri mulyani", "luhut", "ridwan kamil", "mahfud md", "erick thohir",
  "setya novanto", "gibran", "sandiaga uno", "airlangga hartarto", "puan", "jusuf kalla", "tito karnavian", "agus harimurti", "rizieq shihab", "nadiem makarim", "tri rismaharini",
  "khofifah", "muhaimin iskandar", "zulkifli hasan", "firli", "wiranto", "moeldoko", "susi pudjiastuti", "boediono", "hatta rajasa", "fadli zon", "surya paloh", "hasto kristiyanto",
  "listyo sigit prabowo", "andika perkasa", "hadi tjahjanto", "budi gunadi sadikin", "basuki hadimuljono", "soekarno", "soeharto", "djarot saiful hidayat", "ferdy sambo",
  "raffi ahmad", "trump", "biden", "putin", "obama", "kim jong un", "gatot nurmantyo", "anas urbaningrum", "dahlan iskan", "bambang soesatyo", "novel baswedan", "abraham samad",
  "yasonna laoly", "retno marsudi", "kaesang pangarep", "bobby nasution", "dedi mulyadi", "gus dur", "habibie"];
export const BODIES = ["kpk", "dpr", "polri", "tni", "kpu", "bawaslu", "pdip", "golkar", "gerindra", "demokrat", "pks", "nasdem", "pkb", "perindo", "pertamina", "pln",
  "bank indonesia", "ojk", "bmkg", "bpjs kesehatan", "garuda indonesia", "mui", "muhammadiyah", "nahdlatul ulama", "fpi", "pbb", "asean", "fifa", "isis", "gojek", "tokopedia",
  "shopee", "telkom", "jasa marga", "pt kai", "badan pusat statistik", "mpr", "dpd", "bulog", "lion air", "unesco", "uni eropa", "nato", "hamas", "taliban", "google", "apple",
  "samsung", "twitter", "instagram", "youtube", "whatsapp", "mahkamah konstitusi", "kejaksaan agung", "komnas ham", "tiktok", "facebook"];
/** Words that read as an accusation or a judgement when set beside a name. "Which newsroom puts W beside N" never asks
 *  about these: beside a name they are asked only as "guess the number" asks (of 100 pages naming N, how many also
 *  hold W), with its caution in sight. */
export const SENSITIVE = ["tersangka", "korupsi", "suap", "ditangkap", "ditahan", "diperiksa", "saksi", "divonis", "penjara", "terdakwa", "mundur", "maaf", "hoaks", "utang",
  "tambang", "kekerasan", "ham", "etik", "oknum", "marah", "gagal", "polisi", "pengadilan", "sidang", "dilaporkan", "membantah", "klarifikasi",
  // (and, never among the words that tell "who" who it is: the verbs of a case at law)
  "bersalah", "dijerat", "menjerat", "ditetapkan", "dipenjara", "dituntut", "didakwa", "tertangkap", "diadili", "terjerat", "dicopot", "dipecat"];
export const OUTLET_NAMES = ["Kompas", "Tempo", "Tribunnews"];

/** The quiz: ten rounds, three easy, four middling, three hard; the kinds in a rhythm, never the same twice running. */
export const ROUNDS = 10;
export const TIERS = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
export const KINDS = ["year", "who", "freq", "peak", "resmi", "room", "trend"];
/** Guess the number: six rounds, two each of a low, a middle and a high true value, so that no one guess always pays. */
export const GUESS_ROUNDS = 6;
export const GUESS_BINS = [[1, 4], [5, 14], [15, 100]];  // most true values are small (half are 1 or 2 in 100): the bins are cut where the data has enough of each

// ---- chance --------------------------------------------------------------------------------------------------------
/** A seeded generator (mulberry32), so that the checks can deal thousands of games and say which one failed. */
export const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const shuffle = (list, rng) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const tierOf = (ratio) => (ratio >= 3 ? 0 : ratio >= 2 ? 1 : 2);
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// ---- the questions -------------------------------------------------------------------------------------------------
/**
 * Every question each kind can ask, from quiz.json: {kind: [group]}. A group is one question as a reader would know it
 * again (a pair of words, a name, a year): its `key`, the `topics` no other question of the same game may touch, and
 * its `variants` (the same pair in another year, the same name in another year), of which one is asked, each with its
 * tier (0 easy, 1 middling, 2 hard), answer and evidence. Choices drawn at the deal (the years and names offered) are
 * made by `finish`.
 */
export function pools(Q) {
  const P = Q.periods, units = Q.units, W = Q.words, pages = (w, p) => W[w].share[p] * units[p];
  const group = (w) => (W[w].clueOnly ? null : PEOPLE.includes(w) ? "person" : BODIES.includes(w) ? "body" : W[w].kind === "person" || W[w].kind === "organisation" ? null : "word");
  const words = Object.keys(W).filter((w) => group(w));
  const out = Object.fromEntries(KINDS.map((k) => [k, []]));
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);

  // Which year, from its ten most characteristic words (highlights.json's peaks).
  for (const { p, clue } of Q.years) {
    const sum = (q) => clue.reduce((s, w) => s + (W[w]?.share[q] || 0), 0), own = sum(p);
    const others = P.map((_, q) => q).filter((q) => Math.abs(q - p) >= 2 && sum(q) * MARGIN.yearRatio <= own);
    if (others.length >= 3) out.year.push({ key: `year:${P[p]}`, topics: [`year:${P[p]}`, ...clue], variants: [{ tier: null, p, clue, others, answer: P[p],
      ev: { type: "line", series: [{ label: clue[0], share: W[clue[0]]?.share }], marks: [p] } }] });
  }

  // Who, from the verbs and adjectives that kept the name company in one year.
  const who = Object.keys(Q.who).filter((n) => PEOPLE.includes(n) || BODIES.includes(n));
  for (const n of who) {
    const variants = Object.entries(Q.who[n].said).map(([p, said]) => ({ p: +p, said })).filter(({ p, said }) => said.length >= 5 && W[n] && pages(n, p) >= MARGIN.whoPages)
      .map(({ p, said }) => {
        const shared = (m) => (Q.who[m].said[p] || []).filter((x) => said.includes(x)).length, others = who.filter((m) => m !== n && shared(m) <= MARGIN.whoShared);
        return { tier: null, p, said, others, near: others.filter((m) => shared(m) >= 2), kind: PEOPLE.includes(n) ? "person" : "body", answer: n, ev: { type: "line", series: [{ label: n, share: W[n].share }], marks: [p] } };
      }).filter((v) => v.others.length >= 3);
    if (variants.length) out.who.push({ key: `who:${n}`, topics: [n], variants });
  }

  // Which is more frequent in year Y, A or B: only pairs that trade places (each leads clearly in some year), so that
  // the year matters, and of the same sort (two people, two bodies, two words).
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
    const [a, b] = [words[i], words[j]];
    if (group(a) !== group(b)) continue;
    const variants = P.map((_, p) => p).filter((p) => Math.max(pages(a, p), pages(b, p)) >= MARGIN.pages && Math.min(pages(a, p), pages(b, p)) >= MARGIN.least && ratio(W[a].share[p], W[b].share[p]) >= MARGIN.ratio)
      .map((p) => { const r = ratio(W[a].share[p], W[b].share[p]), win = W[a].share[p] > W[b].share[p] ? a : b;
        return { tier: tierOf(r), p, choices: [a, b], answer: win, ev: { type: "marks", period: P[p], items: [a, b].map((w) => ({ label: w, v: W[w].share[p] })) } }; });
    if (variants.some((v) => v.answer === a) && variants.some((v) => v.answer === b)) out.freq.push({ key: `freq:${a}|${b}`, topics: [a, b], variants });
  }

  // Which peaked first: every year of A's peak before every year of B's, by at least two years; both peaks clear.
  const peak = (w) => {
    const v = W[w].share, top = Math.max(...v), at = v.map((x, p) => (x >= MARGIN.peakNear * top ? p : -1)).filter((p) => p >= 0);
    return top >= MARGIN.peakStand * median(v) && pages(w, v.indexOf(top)) >= MARGIN.pages ? { at, top: v.indexOf(top) } : null;
  };
  const peaked = Object.fromEntries(words.map((w) => [w, peak(w)]).filter(([, x]) => x));
  const peakers = Object.keys(peaked);
  for (let i = 0; i < peakers.length; i++) for (let j = i + 1; j < peakers.length; j++) {
    const [a, b] = [peakers[i], peakers[j]], [A, B] = [peaked[a], peaked[b]];
    const after = Math.min(...B.at) - Math.max(...A.at), before = Math.min(...A.at) - Math.max(...B.at), gap = Math.max(after, before);
    if (gap < MARGIN.peakGap) continue;
    const first = after > before ? a : b;
    out.peak.push({ key: `peak:${a}|${b}`, topics: [a, b], variants: [{ tier: gap >= 6 ? 0 : gap >= 4 ? 1 : 2, choices: [a, b], answer: first,
      ev: { type: "line", series: [a, b].map((w) => ({ label: w, share: W[w].share })), marks: [A.top, B.top] } }] });
  }

  // Official word or loanword, Kompas 2024 (the pairs of the story "kata-resmi").
  const last = P.length - 1;
  for (const [loan, coin] of Q.resmi) {
    if (!W[loan] || !W[coin]) continue;
    const [a, b] = [pages(loan, last), pages(coin, last)];
    if (Math.max(a, b) < MARGIN.pages || Math.min(a, b) < MARGIN.least || ratio(a, b) < MARGIN.ratio) continue;
    out.resmi.push({ key: `resmi:${coin}`, topics: [loan, coin], variants: [{ tier: tierOf(ratio(a, b)), choices: [coin, loan], answer: a > b ? loan : coin,
      ev: { type: "marks", period: P[last], items: [coin, loan].map((w) => ({ label: w, v: W[w].share[last] })) } }] });
  }

  // Which newsroom most often puts W beside N, 2020-2024: never a word of SENSITIVE.
  for (const [w, n, v, pg] of Q.rooms.rows) {
    if (SENSITIVE.includes(w) || !(PEOPLE.includes(n) || BODIES.includes(n)) || pg.some((x) => x < MARGIN.roomPages)) continue;
    const order = v.map((x, k) => k).sort((x, y) => v[y] - v[x]), [top, second] = order;
    if ((v[top] * pg[top]) / 1000 < MARGIN.pages || (v[second] * pg[second]) / 1000 < MARGIN.least || v[top] < MARGIN.ratio * v[second]) continue;
    out.room.push({ key: `room:${w}|${n}`, topics: [w, n], answer: OUTLET_NAMES[top], variants: [{ tier: tierOf(v[top] / v[second]), choices: OUTLET_NAMES, answer: OUTLET_NAMES[top], w, n,
      ev: { type: "marks", period: Q.rooms.era, outlets: true, items: OUTLET_NAMES.map((o, k) => ({ label: o, v: v[k] / 1000, pages: pg[k] })) } }] });
  }

  // Up, down or about the same: a word from one year to another at least three years on.
  for (const w of words) {
    const variants = [];
    for (let p = 0; p < P.length; p++) for (let q = p + 3; q < P.length; q++) {
      const [a, b] = [W[w].share[p], W[w].share[q]];
      if (Math.min(pages(w, p), pages(w, q)) < MARGIN.pages) continue;
      const r = b / a, answer = r >= MARGIN.ratio ? "up" : r <= 1 / MARGIN.ratio ? "down" : Math.max(r, 1 / r) <= MARGIN.same ? "same" : null;
      if (answer) variants.push({ tier: answer === "same" ? 1 : tierOf(Math.max(r, 1 / r)), p, q, answer, choices: ["up", "down", "same"], ev: { type: "line", series: [{ label: w, share: W[w].share }], marks: [p, q] } });
    }
    if (variants.length) out.trend.push({ key: `trend:${w}`, topics: [w], variants });
  }
  for (const k of KINDS) for (const g of out[k]) g.tiers = [...new Set(g.variants.map((v) => v.tier))];
  return out;
}

/** A dealt question: its kind, key and topics; `ask` (the text's key and arguments), the clue (words) where there is
 *  one, the choices in the order shown, the answer (one of them), the tier and the evidence. */
export function finish(kind, g, tier, rng, P) {
  const fit = g.variants.filter((v) => v.tier === null || v.tier === tier), v = (fit.length ? fit : g.variants)[Math.floor(rng() * (fit.length ? fit : g.variants).length)];
  const base = { kind, key: g.key, topics: g.topics, tier, answer: v.answer, ev: v.ev };
  if (kind === "year") {
    // Easy: three years far from it; hard: the nearest years the margin allows.
    const sorted = [...v.others].sort((a, b) => Math.abs(b - v.p) - Math.abs(a - v.p)), take = tier === 0 ? sorted.slice(0, 6) : tier === 2 ? sorted.slice(-4) : sorted;
    const picked = shuffle(take, rng).slice(0, 3);
    return { ...base, ask: ["quiz_year_ask"], clue: v.clue, choices: [v.p, ...picked].sort((a, b) => a - b).map((p) => P[p]) };
  }
  if (kind === "who") {
    // Others of its own sort (a person among people); easy: any of them, hard: those whose words that year are nearest.
    const own = v.others.filter((m) => PEOPLE.includes(m) === (v.kind === "person")), pool = own.length >= 3 ? own : v.others;
    const near = tier === 2 && v.near ? pool.filter((m) => v.near.includes(m)) : [], picked = near.length >= 3 ? shuffle(near, rng).slice(0, 3) : shuffle(pool, rng).slice(0, 3);
    return { ...base, ask: ["quiz_who_ask", P[v.p]], clue: v.said, choices: shuffle([v.answer, ...picked], rng) };
  }
  if (kind === "freq") return { ...base, ask: ["ask_freq", P[v.p]], choices: shuffle(v.choices, rng) };
  if (kind === "peak") return { ...base, ask: ["ask_peak"], choices: shuffle(v.choices, rng) };
  if (kind === "resmi") return { ...base, ask: ["ask_resmi"], choices: shuffle(v.choices, rng) };
  if (kind === "room") return { ...base, ask: ["ask_room", v.w, v.n], choices: v.choices, w: v.w, n: v.n };
  return { ...base, ask: ["ask_trend", g.key.slice(6), P[v.p], P[v.q]], choices: v.choices };
}

/**
 * A deck per kind, kept for a visit: its groups are dealt in a shuffled order and none comes again until all have been
 * dealt (then the deck is shuffled anew). `take(ok, tier)` gives the first undealt group that `ok` accepts, of the tier
 * asked where one is left, else of the nearest; null where none is left that `ok` accepts.
 */
export class Deck {
  constructor(groups, rng) { this.rng = rng; this.size = groups.length; this.fresh = shuffle(groups, rng); this.dealt = []; this.cycle = 0; this.given = {}; }
  take(ok, tier) {
    if (!this.fresh.length) { this.fresh = shuffle(this.dealt, this.rng); this.dealt = []; this.cycle++; }
    // Nearest tier first; then, where a kind has an answer of its own (which newsroom), the answer given least so far
    // this visit, so that always pressing the most common answer does not win.
    let best = -1, far = Infinity;
    for (let i = 0; i < this.fresh.length && far; i++) {
      const g = this.fresh[i];
      if (!ok(g)) continue;
      const d = (g.tiers.includes(null) ? 0 : Math.min(...g.tiers.map((t) => Math.abs(t - tier)))) * 1000 + (g.answer ? this.given[g.answer] || 0 : 0);
      if (d < far) [best, far] = [i, d];
    }
    if (best < 0) return null;
    const [g] = this.fresh.splice(best, 1);
    this.dealt.push(g);
    if (g.answer) this.given[g.answer] = (this.given[g.answer] || 0) + 1;
    return g;
  }
}
export const decks = (pool, rng) => Object.fromEntries(KINDS.filter((k) => pool[k].length).map((k) => [k, new Deck(pool[k], rng)]));

/** The kinds of a game in their rhythm: every kind once in a shuffled order, then the rest of the rounds from a second
 *  shuffle; never one kind twice running. */
export function rhythm(kinds, rng, rounds = ROUNDS) {
  const out = [];
  while (out.length < rounds) {
    const next = shuffle(kinds, rng);
    if (out.length && next[0] === out.at(-1)) next.push(next.shift());
    out.push(...next);
  }
  return out.slice(0, rounds);
}

/** One quiz game from the visit's decks: ten questions, no topic twice. */
export function deal(d, rng, P) {
  const kinds = Object.keys(d), order = rhythm(kinds, rng), used = new Set(), game = [];
  for (let k = 0; k < ROUNDS; k++) {
    const tier = TIERS[k], prev = game.at(-1)?.kind;
    for (const kind of [order[k], ...shuffle(kinds.filter((x) => x !== order[k]), rng)].filter((x) => x !== prev)) {
      const g = d[kind].take((g) => g.topics.every((t) => !used.has(t)), tier);
      if (!g) continue;
      const q = finish(kind, g, tier, rng, P);
      q.topics.forEach((t) => used.add(t));
      game.push(q);
      break;
    }
  }
  return game;
}

// ---- guess the number ----------------------------------------------------------------------------------------------
/** The questions of "guess the number", from Kompas's stick.json in 2020-2024: every word with every known name
 *  that is on enough pages, its true value (of 100 pages) and a line of context: who has the most and the least of it. */
export function guessPool(s, era = 2) {
  const names = s.names.map((n, i) => i).filter((i) => (PEOPLE.includes(s.names[i]) || BODIES.includes(s.names[i])) && s.pages[i][era] >= MARGIN.guessPages);
  const out = [];
  for (const w of s.words) {
    const known = names.filter((i) => s.share[w][i][era] !== null && (s.share[w][i][era] * s.pages[i][era]) / 1000 >= MARGIN.guessHits);
    if (known.length < 3) continue;
    const by = [...known].sort((a, b) => s.share[w][b][era] - s.share[w][a][era]), [hi, lo] = [by[0], by.at(-1)];
    for (const i of known) {
      const v = Math.round(s.share[w][i][era] / 10);
      if (v < 1) continue;
      out.push({ key: `${w}|${s.names[i]}`, topics: [w, s.names[i]], w, name: s.names[i], v, pages: s.pages[i][era], tiers: [null],
        bin: GUESS_BINS.findIndex(([a, b]) => v >= a && v <= b), context: { of: known.length, hi: [s.names[hi], Math.round(s.share[w][hi][era] / 10)], lo: [s.names[lo], Math.round(s.share[w][lo][era] / 10)] } });
    }
  }
  return out;
}
/** A deck per bin of the true value, kept for a visit. */
export const guessDecks = (pool, rng) => GUESS_BINS.map((_, b) => new Deck(pool.filter((q) => q.bin === b), rng));
/** One game of six: two of each bin in a shuffled order, no word and no name twice. */
export function guessDeal(d, rng) {
  const used = new Set(), game = [];
  for (const b of shuffle([0, 0, 1, 1, 2, 2], rng)) {
    // (where its bin has nothing left this pass of the deck that fits, the nearest bin that has)
    const ok = (q) => q.topics.every((t) => !used.has(t)), q = [b, ...[0, 1, 2].filter((x) => x !== b).sort((x, y) => Math.abs(x - b) - Math.abs(y - b))].reduce((got, x) => got || d[x].take(ok, 0), null);
    if (!q) continue;
    q.topics.forEach((t) => used.add(t));
    game.push(q);
  }
  return game;
}
/** Points for a guess: 100 for the truth, less by how far off as a part of the truth (half the truth and five more off
 *  scores nothing), so that 6 against a true 2 costs as much as 30 against a true 50: most true values are small, and
 *  points by the plain distance would let one small guess, always, score well. "Right" (a filled port): within 3, or
 *  within a quarter of the truth where that is more. */
export const points = (guess, truth) => Math.max(0, Math.round(100 - (100 * Math.abs(truth - guess)) / (truth / 2 + 5)));
export const close = (guess, truth) => Math.abs(truth - guess) <= Math.max(3, truth / 4);
/** The line said after a guess, by how far off: at most 3, 10, 25, more. */
export const nearness = (guess, truth) => [3, 10, 25].filter((d) => Math.abs(truth - guess) > d).length;
/** The rank at the end, by the share of rounds right: all, three quarters, half, less. */
export const rank = (right, total) => (right === total ? 0 : right >= 0.75 * total ? 1 : right >= 0.5 * total ? 2 : 3);
