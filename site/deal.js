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
  yearNear: 3,     // ... and the years offered lie within three of it where the data allows (never all on one side of it where both sides have one)
  roomHits: 10,    // which newsroom: in each of the three, at least this many pages hold the word beside the name (no newsroom at nothing)
  guessPages: 1500,// guess the number: the name is on at least this many pages of 2020-2024, so that "of 100" is a real hundred
  guessHits: 30,   // ... and at least this many of them hold the word (a count of 3 is not a share)
  spreadTop: 8,   // ... and the word is asked only where names differ on it: the name with the most of it has at least 8 in 100 ...
  spreadRatio: 3,  // ... and at least three times the share of the name with the least ("janji", 1 to 5 in 100 for every name, is not a game on a 0-100 scale)
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
/** The words "guess the number" asks about: words that say something about how the news writes about someone (a case,
 *  a stir, a reproach, a promise, a poll), never an everyday word ("anak", "video", "keluarga" are on a page for any
 *  reason, and a share of them says nothing). */
export const POINTED = ["tersangka", "korupsi", "suap", "ditangkap", "diperiksa", "saksi", "divonis", "terdakwa", "mundur", "maaf", "viral", "kritik", "mengkritik", "demo",
  "hoaks", "janji", "utang", "etik", "oknum", "survei", "elektabilitas", "tegas", "marah", "gagal", "sukses", "rakyat", "sidang", "dilaporkan", "membantah", "klarifikasi"];
export const OUTLET_NAMES = ["Kompas", "Tempo", "Tribunnews"];

/** A name as a name, wherever a game shows one: a person, a body or a place (PEOPLE, BODIES, or a kind the data gives)
 *  with capitals, an abbreviation in upper case ("KPK", "Mahfud MD"), a brand as it writes itself; every other word as
 *  counted, in lower case. The data keeps every word in lower case: this is how it is shown, not what is counted. */
const UPPER = new Set(["kpk", "dpr", "sby", "pdip", "tni", "kpu", "pks", "pkb", "mui", "fpi", "pbb", "ojk", "bmkg", "pln", "asean", "fifa", "isis", "nato", "mpr", "dpd", "unesco", "bpjs", "pt", "kai", "md", "ham", "pp", "ri", "dki", "ppp", "psi", "kpai", "bnn", "bnpb", "bpk", "lps", "ui", "itb", "ugm"]);
const SPELT = { tiktok: "TikTok", youtube: "YouTube", whatsapp: "WhatsApp", nasdem: "NasDem" };
export const shown = (word, kind) => (PEOPLE.includes(word) || BODIES.includes(word) || ["person", "organisation", "place"].includes(kind)
  ? word.split(" ").map((p) => SPELT[p] || (UPPER.has(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))).join(" ") : word);

/** The quiz: ten rounds, three easy, four middling, three hard; the kinds in a rhythm, never the same twice running,
 *  none more than twice in a game and "official word or loanword" once at most (CAP). */
export const ROUNDS = 10;
export const TIERS = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
export const KINDS = ["year", "who", "freq", "peak", "resmi", "room", "trend"];
export const CAP = { resmi: 1 };
export const capOf = (kind) => CAP[kind] ?? 2;
/** Guess the number: six rounds over low, middle and high true values, so that no one guess always pays. */
export const GUESS_ROUNDS = 6;
export const GUESS_BINS = [[1, 4], [5, 14], [15, 100]];  // most true values are small (half are 1 or 2 in 100): the bins are cut where the data has enough of each

/**
 * How hard a question is, in one place: 0 (a giveaway) to 1 (as hard as the margins allow), from the data alone.
 * - two or three shares compared (which is more frequent, official word or loanword, which newsroom, up or down): by
 *   their ratio, hard at the margin (1.5) and easy from twelve times (1.5 x 8);
 * - "about the same": middling to hard, harder the nearer the two are to the 15% the margin allows;
 * - which peaked first: by the years between the two peaks, hard at two and easy from eight;
 * - who: by how many pages name the name in that year, hard at 150 (the margin) and easy from 6,000 (x 40);
 * - which year: by how distinctive its words are, their share in that year over their highest share in any year
 *   within three of it, hard at the margin (1.5) and easy from 30 times (x 20).
 * Its tier: under a third easy, under two thirds middling, the rest hard.
 */
export const HARD = { ratio: 8, peak: 4, who: 40, year: 20 };
const ease = (x, span) => Math.max(0, Math.min(1, Math.log(Math.max(1, x)) / Math.log(span)));
export const DIFFICULTY = {
  ratio: (r) => 1 - ease(r / MARGIN.ratio, HARD.ratio),
  same: (r) => 0.5 + 0.5 * ease(r, MARGIN.same),
  peak: (gap) => 1 - ease(gap / MARGIN.peakGap, HARD.peak),
  who: (pages) => 1 - ease(pages / MARGIN.whoPages, HARD.who),
  year: (distinct) => 1 - ease(distinct / MARGIN.yearRatio, HARD.year),
};
export const tierOf = (d) => (d < 1 / 3 ? 0 : d < 2 / 3 ? 1 : 2);

/** The bodies by kind, so that "who" offers an institution among institutions, a party among parties. */
export const BODY_KIND = {
  party: ["pdip", "golkar", "gerindra", "demokrat", "pks", "nasdem", "pkb", "perindo"],
  state: ["kpk", "dpr", "polri", "tni", "kpu", "bawaslu", "bank indonesia", "ojk", "bmkg", "bpjs kesehatan", "mpr", "dpd", "bulog", "badan pusat statistik", "mahkamah konstitusi", "kejaksaan agung", "komnas ham"],
  company: ["pertamina", "pln", "garuda indonesia", "gojek", "tokopedia", "shopee", "telkom", "jasa marga", "pt kai", "lion air", "google", "apple", "samsung", "twitter", "instagram", "youtube", "whatsapp", "tiktok", "facebook"],
  faith: ["mui", "muhammadiyah", "nahdlatul ulama", "fpi"],
  world: ["pbb", "asean", "fifa", "isis", "unesco", "uni eropa", "nato", "hamas", "taliban"],
};
/** ... and a person among people of their own time and country: those who died before or early in the years counted
 *  are offered only beside each other (Soekarno is on 400 pages of 2020, as history, not as news), and so are leaders
 *  abroad. */
export const PERSON_KIND = { past: ["soekarno", "soeharto", "gus dur", "habibie"], abroad: ["trump", "biden", "putin", "obama", "kim jong un"] };
export const sortOf = (n) => Object.keys(PERSON_KIND).find((k) => PERSON_KIND[k].includes(n)) || (PEOPLE.includes(n) ? "person" : Object.keys(BODY_KIND).find((k) => BODY_KIND[k].includes(n)) || "body");
/** "Which newsroom": only words about public life (a protest, a promise, a poll, a criticism, the people, students,
 *  workers, a stir online), never a word of family or private life ("istri", "anak", "keluarga"), faith ("doa",
 *  "tuhan") or one that says nothing ("video", "sukses"). */
export const ROOM_WORDS = ["kritik", "demo", "mahasiswa", "buruh", "janji", "survei", "rakyat", "viral"];
/** A word of a year's clue that names its year by itself is left out of the clue: one with a number in it ("covid-19",
 *  "pemilu 2024") or a pairing of two names with a hyphen ("prabowo-gibran"; not a doubled word, "anak-anak"). */
export const marker = (w) => /\d/.test(w) || (w.includes("-") && new Set(w.split(/\s*-\s*/)).size > 1);

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
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// ---- the questions -------------------------------------------------------------------------------------------------
/**
 * Every question each kind can ask, from quiz.json: {kind: [group]}. A group is one question as a reader would know it
 * again (a pair of words, a name, a year): its `key`, the `topics` no other question of the same game may touch, and
 * its `variants` (the same pair in another year, the same name in another year), of which one is asked, each with its
 * difficulty `d` and tier (DIFFICULTY), answer and evidence. Choices drawn at the deal (the years and names offered)
 * are made by `finish`.
 */
export function pools(Q) {
  const P = Q.periods, units = Q.units, W = Q.words, pages = (w, p) => W[w].share[p] * units[p];
  const group = (w) => (W[w].clueOnly ? null : PEOPLE.includes(w) ? "person" : BODIES.includes(w) ? "body" : W[w].kind === "person" || W[w].kind === "organisation" ? null : "word");
  const words = Object.keys(W).filter((w) => group(w));
  const out = Object.fromEntries(KINDS.map((k) => [k, []]));
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);
  const at = (d, rest) => ({ d: +d.toFixed(3), tier: tierOf(d), ...rest });
  const resmi = new Set(Q.resmi.map((pair) => [...pair].sort().join("|")));

  // Which year, from its ten most characteristic words (highlights.json's peaks), less those that name the year by
  // themselves (`marker`); asked only where those words together stand highest in that year (the evidence shows it),
  // offered with years where they stand at most 1/1.5 of it.
  for (const { p, clue: all } of Q.years) {
    const clue = all.filter((w) => !marker(w));
    if (clue.length < 8) continue;
    const sum = (q) => clue.reduce((s, w) => s + (W[w]?.share[q] || 0), 0), own = sum(p), line = P.map((_, q) => +sum(q).toPrecision(3));
    if (line.some((v, q) => q !== p && v >= line[p])) continue;
    const others = P.map((_, q) => q).filter((q) => q !== p && sum(q) * MARGIN.yearRatio <= own);
    if (others.length < 3) continue;
    const near = [...others].sort((a, b) => Math.abs(a - p) - Math.abs(b - p)), within = near.filter((q) => Math.abs(q - p) <= MARGIN.yearNear);
    const rivals = within.length >= 3 ? within : near.slice(0, 3), distinct = own / Math.max(...rivals.map(sum));
    out.year.push({ key: `year:${P[p]}`, topics: [`year:${P[p]}`, ...clue], variants: [at(DIFFICULTY.year(distinct), { p, clue, others, answer: P[p],
      ev: { type: "line", series: [{ label: "", share: line }], marks: [p] } })] });
  }

  // Who, from the verbs and adjectives that kept the name company in one year; the other names offered are of its own
  // sort (a person among people, a party among parties: BODY_KIND) and on enough pages that year to be in the news
  // (quiz.json has a name's words in a year only where it has MARGIN.whoPages).
  const who = Object.keys(Q.who).filter((n) => PEOPLE.includes(n) || BODIES.includes(n));
  for (const n of who) {
    const variants = Object.entries(Q.who[n].said).map(([p, said]) => ({ p: +p, said })).filter(({ p, said }) => said.length >= 5 && W[n] && pages(n, p) >= MARGIN.whoPages)
      .map(({ p, said }) => {
        const shared = (m) => (Q.who[m].said[p] || []).filter((x) => said.includes(x)).length;
        const news = who.filter((m) => m !== n && Q.who[m].said[p] && W[m] && pages(m, p) >= MARGIN.whoPages && shared(m) <= MARGIN.whoShared);
        const same = news.filter((m) => sortOf(m) === sortOf(n)), others = same.length >= 3 || PEOPLE.includes(n) ? same : news.filter((m) => BODIES.includes(m));
        return at(DIFFICULTY.who(pages(n, p)), { p, said, others, near: others.filter((m) => shared(m) >= 2), answer: n,
          counts: Object.fromEntries([n, ...others].map((m) => [m, m === n ? said.length : shared(m)])) });
      }).filter((v) => v.others.length >= 3);
    if (variants.length) out.who.push({ key: `who:${n}`, topics: [n], variants });
  }

  // Which is more frequent in year Y, A or B: only pairs that trade places (each leads clearly in some year), so that
  // the year matters, and of the same sort (two people, two bodies, two words); not a pair of an official word and its
  // loanword (that is the question "resmi", asked once a game).
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
    const [a, b] = [words[i], words[j]];
    if (group(a) !== group(b) || (group(a) !== "word" && sortOf(a) !== sortOf(b)) || resmi.has([a, b].sort().join("|"))) continue;
    const variants = P.map((_, p) => p).filter((p) => Math.max(pages(a, p), pages(b, p)) >= MARGIN.pages && Math.min(pages(a, p), pages(b, p)) >= MARGIN.least && ratio(W[a].share[p], W[b].share[p]) >= MARGIN.ratio)
      .map((p) => { const r = ratio(W[a].share[p], W[b].share[p]), win = W[a].share[p] > W[b].share[p] ? a : b;
        return at(DIFFICULTY.ratio(r), { p, choices: [a, b], answer: win, ev: { type: "marks", period: P[p], items: [a, b].map((w) => ({ label: w, v: W[w].share[p] })) } }); });
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
    out.peak.push({ key: `peak:${a}|${b}`, topics: [a, b], variants: [at(DIFFICULTY.peak(gap), { choices: [a, b], answer: first,
      ev: { type: "line", series: [a, b].map((w) => ({ label: w, share: W[w].share })), marks: [A.top, B.top] } })] });
  }

  // Official word or loanword, Kompas 2024 (the pairs of the story "kata-resmi").
  const last = P.length - 1;
  for (const [loan, coin] of Q.resmi) {
    if (!W[loan] || !W[coin]) continue;
    const [a, b] = [pages(loan, last), pages(coin, last)];
    if (Math.max(a, b) < MARGIN.pages || Math.min(a, b) < MARGIN.least || ratio(a, b) < MARGIN.ratio) continue;
    out.resmi.push({ key: `resmi:${coin}`, topics: [loan, coin], variants: [at(DIFFICULTY.ratio(ratio(a, b)), { choices: [coin, loan], answer: a > b ? loan : coin,
      ev: { type: "marks", period: P[last], items: [coin, loan].map((w) => ({ label: w, v: W[w].share[last] })) } })] });
  }

  // Which newsroom most often puts W beside N, 2020-2024: only a word of ROOM_WORDS, and a count in every newsroom
  // (MARGIN.roomHits pages holding the word beside the name), so that no newsroom stands at nothing.
  for (const [w, n, v, pg] of Q.rooms.rows) {
    if (!ROOM_WORDS.includes(w) || SENSITIVE.includes(w) || !(PEOPLE.includes(n) || BODIES.includes(n)) || pg.some((x) => x < MARGIN.roomPages)) continue;
    const order = v.map((x, k) => k).sort((x, y) => v[y] - v[x]), [top, second] = order, hits = v.map((x, k) => (x * pg[k]) / 1000);
    if (hits[top] < MARGIN.pages || hits.some((h) => h < MARGIN.roomHits) || v[top] < MARGIN.ratio * v[second]) continue;
    out.room.push({ key: `room:${w}|${n}`, topics: [w, n], answer: OUTLET_NAMES[top], variants: [at(DIFFICULTY.ratio(v[top] / v[second]), { choices: OUTLET_NAMES, answer: OUTLET_NAMES[top], w, n,
      ev: { type: "marks", period: Q.rooms.era, outlets: true, items: OUTLET_NAMES.map((o, k) => ({ label: o, v: v[k] / 1000, pages: pg[k] })) } })] });
  }

  // Up, down or about the same: a word from one year to another at least three years on.
  for (const w of words) {
    const variants = [];
    for (let p = 0; p < P.length; p++) for (let q = p + 3; q < P.length; q++) {
      const [a, b] = [W[w].share[p], W[w].share[q]];
      if (Math.min(pages(w, p), pages(w, q)) < MARGIN.pages) continue;
      const r = b / a, answer = r >= MARGIN.ratio ? "up" : r <= 1 / MARGIN.ratio ? "down" : Math.max(r, 1 / r) <= MARGIN.same ? "same" : null;
      if (answer) variants.push(at(answer === "same" ? DIFFICULTY.same(Math.max(r, 1 / r)) : DIFFICULTY.ratio(Math.max(r, 1 / r)), { p, q, answer, choices: ["up", "down", "same"], ev: { type: "line", series: [{ label: w, share: W[w].share }], marks: [p, q] } }));
    }
    if (variants.length) out.trend.push({ key: `trend:${w}`, topics: [w], variants });
  }
  for (const k of KINDS) for (const g of out[k]) g.tiers = [...new Set(g.variants.map((v) => v.tier))];
  return out;
}

/** A dealt question: its kind, key and topics; `ask` (the text's key and arguments), the clue (words) where there is
 *  one, the choices in the order shown, the answer (one of them), its difficulty and tier, and the evidence. `fresh(w)`
 *  says how welcome a name is as a choice drawn here (0 not at all; higher, more: see `deal`). */
export function finish(kind, g, tier, rng, P, fresh = () => 1) {
  const fit = g.variants.filter((v) => v.tier === tier), from = fit.length ? fit : g.variants, v = from[Math.floor(rng() * from.length)];
  const base = { kind, key: g.key, topics: g.topics, tier: v.tier, d: v.d, answer: v.answer, ev: v.ev };
  // (of a list, the n most welcome, at random among equals)
  const pick = (list, n) => shuffle(list, rng).map((x) => [x, fresh(x)]).filter(([, f]) => f > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([x]) => x);
  if (kind === "year") {
    // The years nearest it (within MARGIN.yearNear where the data has three there), at random among them; never all
    // on one side of it where both sides have one.
    const near = [...v.others].sort((a, b) => Math.abs(a - v.p) - Math.abs(b - v.p) || rng() - 0.5), within = near.filter((q) => Math.abs(q - v.p) <= MARGIN.yearNear);
    const picked = within.length >= 3 ? shuffle(within, rng).slice(0, 3) : near.slice(0, 3);
    const both = near.filter((q) => Math.abs(q - v.p) <= 2 * MARGIN.yearNear), sides = [both.filter((q) => q < v.p), both.filter((q) => q > v.p)];
    for (const [side, other] of [[0, 1], [1, 0]]) if (sides[side].length && !picked.some((q) => sides[side].includes(q))) {
      const drop = picked.filter((q) => sides[other].includes(q)).sort((a, b) => Math.abs(b - v.p) - Math.abs(a - v.p))[0];
      picked.splice(picked.indexOf(drop), 1, sides[side][0]);
    }
    return { ...base, ask: ["quiz_year_ask"], clue: v.clue, choices: [v.p, ...picked].sort((a, b) => a - b).map((p) => P[p]) };
  }
  if (kind === "who") {
    // Hard: the names whose words that year are nearest, where three of them are welcome; else any of its sort.
    const near = tier === 2 ? pick(v.near, 3) : [], picked = near.length >= 3 ? near : pick(v.others, 3);
    if (picked.length < 3) return null;
    const choices = shuffle([v.answer, ...picked], rng);
    return { ...base, ask: ["quiz_who_ask", P[v.p]], clue: v.said, choices,
      ev: { type: "marks", unit: "count", of: v.said.length, period: P[v.p], items: choices.map((m) => ({ label: m, v: v.counts[m] })) } };
  }
  if (kind === "freq") return { ...base, ask: ["ask_freq", P[v.p]], choices: shuffle(v.choices, rng) };
  if (kind === "peak") return { ...base, ask: ["ask_peak"], choices: shuffle(v.choices, rng) };
  if (kind === "resmi") return { ...base, ask: ["ask_resmi"], choices: shuffle(v.choices, rng) };
  if (kind === "room") return { ...base, ask: ["ask_room", v.w, v.n], choices: v.choices, w: v.w, n: v.n };
  return { ...base, ask: ["ask_trend", g.key.slice(6), P[v.p], P[v.q]], choices: v.choices };
}
/** The names and words a dealt question shows: its topics, and the names offered beside the answer. */
export const shownIn = (q) => [...q.topics, ...(q.kind === "who" ? q.choices : [])].filter((t) => !t.startsWith("year:"));

/**
 * A deck per kind, kept for a visit: its groups are dealt in a shuffled order and none comes again until all have been
 * dealt (then the deck is shuffled anew). `take(ok, tier, strict)` gives the first undealt group that `ok` accepts,
 * of the tier asked (with `strict`, only of that tier), else of the nearest; null where none is left that `ok` accepts.
 */
export class Deck {
  constructor(groups, rng) { this.rng = rng; this.size = groups.length; this.fresh = shuffle(groups, rng); this.dealt = []; this.cycle = 0; this.given = {}; }
  take(ok, tier, strict = false) {
    if (!this.fresh.length) { this.fresh = shuffle(this.dealt, this.rng); this.dealt = []; this.cycle++; }
    // Nearest tier first; then, where a kind has an answer of its own (which newsroom), the answer given least so far
    // this visit, so that always pressing the most common answer does not win.
    let best = -1, far = Infinity;
    for (let i = 0; i < this.fresh.length && far; i++) {
      const g = this.fresh[i], off = g.tiers.includes(null) ? 0 : Math.min(...g.tiers.map((t) => Math.abs(t - tier)));
      if ((strict && off) || !ok(g)) continue;
      const d = off * 1000 + (g.answer ? this.given[g.answer] || 0 : 0);
      if (d < far) [best, far] = [i, d];
    }
    if (best < 0) return null;
    const [g] = this.fresh.splice(best, 1);
    this.dealt.push(g);
    if (g.answer) this.given[g.answer] = (this.given[g.answer] || 0) + 1;
    return g;
  }
  /** A group taken but not asked (its choices could not be drawn) goes back where it was. */
  undo(g) { this.dealt.splice(this.dealt.indexOf(g), 1); this.fresh.unshift(g); if (g.answer) this.given[g.answer]--; }
}
/** The visit's decks, a deck per kind; and, kept with them (not a kind), which game of the visit last showed each name
 *  and word (`seen`) and how many games were dealt. */
export const decks = (pool, rng) => {
  const d = Object.fromEntries(KINDS.filter((k) => pool[k].length).map((k) => [k, new Deck(pool[k], rng)]));
  return Object.defineProperties(d, { seen: { value: new Map() }, games: { value: 0, writable: true } });
};

/** The kinds of a game in their rhythm: every kind once in a shuffled order, then the rest of the rounds from a second
 *  shuffle of the kinds that may come twice (CAP); never one kind twice running. */
export function rhythm(kinds, rng, rounds = ROUNDS) {
  const out = [];
  while (out.length < rounds) {
    const next = shuffle(out.length ? kinds.filter((k) => out.filter((x) => x === k).length < capOf(k)) : kinds, rng);
    if (!next.length) break;
    if (out.length && next[0] === out.at(-1)) next.push(next.shift());
    out.push(...next);
  }
  return out.slice(0, rounds);
}

/**
 * One quiz game from the visit's decks: ten questions, harder as they go (TIERS), no name, word or pair twice, no kind
 * more than twice (CAP). The names and words of the visit's earlier games go to the back: a round first looks among
 * questions none of whose names and words any game of this visit has shown (as an answer, a choice or in a clue), then
 * among those not shown in the last three games, then not in the last one; only then does it give up its tier, and
 * the same again.
 */
export function deal(d, rng, P) {
  const kinds = Object.keys(d), order = rhythm(kinds, rng), used = new Set(), game = [], count = {}, n = ++d.games;
  const age = (w) => (d.seen.has(w) ? n - d.seen.get(w) : Infinity);  // games since a name or word was last shown
  const LEVELS = [Infinity, 4, 2, 1];
  for (let k = 0; k < ROUNDS; k++) {
    const tier = TIERS[k], prev = game.at(-1)?.kind;
    const which = [order[k], ...shuffle(kinds.filter((x) => x !== order[k]), rng)].filter((x) => x && x !== prev && (count[x] || 0) < capOf(x));
    let q = null;
    for (const strict of [true, false]) for (const level of LEVELS) for (const kind of which) {
      if (q) break;
      const welcome = (w) => !used.has(w) && age(w) >= level;
      const g = d[kind].take((g) => g.topics.every(welcome), tier, strict);
      if (!g) continue;
      q = finish(kind, g, tier, rng, P, (w) => (welcome(w) ? Math.min(age(w), 99) : 0));
      if (!q) d[kind].undo(g);
    }
    if (!q) continue;
    shownIn(q).forEach((w) => used.add(w));
    q.topics.forEach((t) => used.add(t));
    count[q.kind] = (count[q.kind] || 0) + 1;
    game.push(q);
  }
  for (const q of game) for (const w of shownIn(q)) d.seen.set(w, n);
  return game;
}

// ---- guess the number ----------------------------------------------------------------------------------------------
/** The questions of "guess the number", from Kompas's stick.json in 2020-2024: every word with a spread across names
 *  (MARGIN.spreadTop, spreadRatio) with every known name that is on enough pages, its true value (of 100 pages) and a
 *  line of context: who has the most and the least of it. */
export function guessPool(s, era = 2) {
  const names = s.names.map((n, i) => i).filter((i) => (PEOPLE.includes(s.names[i]) || BODIES.includes(s.names[i])) && s.pages[i][era] >= MARGIN.guessPages);
  const out = [];
  for (const w of s.words.filter((w) => POINTED.includes(w))) {
    const known = names.filter((i) => s.share[w][i][era] !== null && (s.share[w][i][era] * s.pages[i][era]) / 1000 >= MARGIN.guessHits);
    if (known.length < 3) continue;
    const by = [...known].sort((a, b) => s.share[w][b][era] - s.share[w][a][era]), [hi, lo] = [by[0], by.at(-1)];
    if (s.share[w][hi][era] / 10 < MARGIN.spreadTop || s.share[w][hi][era] < MARGIN.spreadRatio * s.share[w][lo][era]) continue;  // (a word with no spread across names)
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
/** One game of six: one high value, three middle and two low (few values in the data are high), in a shuffled
 *  order, no word and no name twice. */
export function guessDeal(d, rng) {
  const used = new Set(), game = [];
  // The scarcest bin (the high values) is dealt first, while every word and name is still free; the game's order is
  // shuffled after.
  for (const b of [2, 1, 1, 1, 0, 0]) {
    const ok = (q) => q.topics.every((t) => !used.has(t));
    // (where what is left of its bin this pass does not fit, the bin's dealt cards come back early; only then the nearest bin)
    const again = (x) => d[x].take(ok, 0) || ((d[x].fresh.push(...d[x].dealt.splice(0))), d[x].take(ok, 0));
    const q = [b, ...[0, 1, 2].filter((x) => x !== b).sort((x, y) => Math.abs(x - b) - Math.abs(y - b))].reduce((got, x) => got || again(x), null);
    if (!q) continue;
    q.topics.forEach((t) => used.add(t));
    game.push(q);
  }
  return shuffle(game, rng);
}
/** Points for a guess: 100 for the truth, less by how far off as a part of the truth (half the truth and three more off
 *  scores nothing), so that 6 against a true 2 costs as much as 30 against a true 50: most true values are small, and
 *  points by the plain distance would let one small guess, always, score well. "Right" (a filled port): within 3, or
 *  within a quarter of the truth where that is more. */
export const points = (guess, truth) => Math.max(0, Math.round(100 - (100 * Math.abs(truth - guess)) / (truth / 2 + 3)));
export const close = (guess, truth) => Math.abs(truth - guess) <= Math.max(3, truth / 4);
/** The line said after a guess, by how far off: at most 3, 10, 25, more. */
export const nearness = (guess, truth) => [3, 10, 25].filter((d) => Math.abs(truth - guess) > d).length;
/** The rank at the end, by the share of rounds right: all, three quarters, half, less. */
export const rank = (right, total) => (right === total ? 0 : right >= 0.75 * total ? 1 : right >= 0.5 * total ? 2 : 3);
