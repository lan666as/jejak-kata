import { AS_NAME } from "./glossary.js";

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
  peakStand: 2.5,  // ... and a word has a peak only where its highest year stands at least this many times its own level on each side of
                   // the peak (the median of the years before the peak's run, and of those after: a run of years at least half the
                   // highest, at most peakRun long), with at least peakSides years on each side (a word always in the news, high
                   // at an end or on a long plateau, has no "first")
  peakRun: 3,
  peakSides: 2,
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

/** How a word is shown, in the games and on their plates (one function): an abbreviation in upper case, a name or not
 *  ("KPK", "PPKM", "IKN", "Mahfud MD"): every part of a word that is all consonants, and the hand list ABBR; a name
 *  (PEOPLE, BODIES, a person, body or place as the data gives it, or AS_NAME for a name the data counts as a word)
 *  with capitals, a brand as it writes itself; every other word as counted, in lower case. The data keeps every word in
 *  lower case: this is how it is shown, not what is counted. */
export const ABBR = new Set(["kpk", "dpr", "sby", "pdip", "tni", "kpu", "pks", "pkb", "mui", "fpi", "pbb", "ojk", "bmkg", "pln", "asean", "fifa", "isis", "nato", "mpr", "dpd", "unesco", "bpjs",
  "pt", "kai", "md", "ham", "pp", "ri", "dki", "ppp", "psi", "kpai", "bnn", "bnpb", "bpk", "lps", "ui", "itb", "ugm", "ikn", "ott", "bbm", "blt", "ktp", "uu", "ite", "apbn", "apbd",
  "umkm", "bumn", "ihsg", "tki", "opm", "esg", "jis", "rkuhp", "kuhp", "asn", "pns", "ppkm", "psbb", "kkb", "blsm"]);
const CONSONANTS = /^[bcdfghjklmnpqrstvwxz]{2,}$/;
export const isAbbr = (part) => ABBR.has(part) || CONSONANTS.test(part);
const SPELT = { tiktok: "TikTok", youtube: "YouTube", whatsapp: "WhatsApp", nasdem: "NasDem", polri: "Polri" };
export const isName = (word, kind) => PEOPLE.includes(word) || BODIES.includes(word) || ["person", "organisation", "place"].includes(kind) || word in AS_NAME;
export const shown = (word, kind) => {
  word = String(word);
  if (AS_NAME[word]) return AS_NAME[word];
  const name = isName(word, kind);
  return word.split(" ").map((p) => p.split("-").map((q) => SPELT[q] || (isAbbr(q) ? q.toUpperCase() : name ? q.charAt(0).toUpperCase() + q.slice(1) : q)).join("-")).join(" ");
};

/** The quiz: ten rounds, three easy, four middling, three hard; the kinds in a rhythm, never the same twice running,
 *  none more than twice in a game, "official word or loanword" and "which newsroom" once at most (CAP). */
export const ROUNDS = 10;
export const TIERS = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
export const KINDS = ["year", "who", "freq", "peak", "resmi", "room", "trend"];
export const CAP = { resmi: 1, room: 1 };
export const capOf = (kind) => CAP[kind] ?? 2;
/** Guess the number: six rounds over low, middle and high true values, so that no one guess always pays. */
export const GUESS_ROUNDS = 6;
export const GUESS_BINS = [[1, 4], [5, 12], [13, 100]];  // most true values are small (half are 1 or 2 in 100): the bins are cut where the data has enough of each
/** ... and how many of each a game deals: two low, one middle, three high. Each step off costs 10 points for a small
 *  number, so a game of mostly small values would pay one fixed small guess (5 would average 73%): with three high
 *  values no fixed guess averages 65% (games.mjs). */
export const GUESS_DEAL = [2, 2, 2, 1, 0, 0];

/**
 * How hard a question is, in one place: 0 (a giveaway) to 1 (as hard as the margins allow), from the data alone, and
 * its mark: under a third "mudah", under two thirds "sedang", the rest "sulit". The mark shown is the question's own,
 * and a game asks its questions in the order of it (`deal`), so the marks rise because the questions do.
 * - two or three shares compared (which is more frequent, official word or loanword, which newsroom, up or down): by
 *   the ratio of the larger to the next: hard from the margin (1.5) to 2, middling to 4, easy from 4 (none harder
 *   than a giveaway from 8). So no question marked hard compares two shares more than twice apart;
 * - "about the same": middling to hard, harder the nearer the two are to the 15% the margin allows;
 * - which peaked first: by the years between the two peaks, hard at two or three, middling at four or five, easy only
 *   from six years and only where both words are widely known (FAME.wide): else at least middling;
 * - who: by how many pages name the name in that year, hard at 150 (the margin) and easy from 6,000;
 * - which year: by how distinctive its words are, their share in that year over their highest share in any year
 *   within three of it, hard at the margin (1.5) and easy from 30 times;
 * - and fame, for every kind that names a person or a body (as answer, choice or clue): where the least known of them
 *   is named on fewer than FAME.known Kompas pages a year (2011-2024 on average), the question is at least middling.
 */
export const FAME = { known: 400, wide: 1000 };
// (a measure read through its knots, [value, difficulty], in log steps for a ratio or a count, straight for years)
const through = (x, knots, log = true) => {
  const f = (v) => (log ? Math.log(v) : v), k = knots.findIndex(([v]) => x <= v);
  if (k === 0) return knots[0][1];
  if (k < 0) return knots.at(-1)[1];
  const [[a, da], [b, db]] = [knots[k - 1], knots[k]];
  return da + ((db - da) * (f(x) - f(a))) / (f(b) - f(a));
};
export const DIFFICULTY = {
  ratio: (r) => through(r, [[MARGIN.ratio, 1], [2, 2 / 3], [4, 1 / 3 - 1e-9], [8, 0]]),
  same: (r) => through(r, [[1, 0.5], [MARGIN.same, 1]]),
  peak: (gap, both) => Math.max(through(gap, [[MARGIN.peakGap, 1], [3, 2 / 3 + 1e-9], [4, 2 / 3 - 1e-9], [6, 1 / 3 - 1e-9], [8, 0]], false), both >= FAME.wide ? 0 : 0.5),
  who: (pages) => through(pages, [[MARGIN.whoPages, 1], [6000, 0]]),
  year: (distinct) => through(distinct, [[MARGIN.yearRatio, 1], [30, 0]]),
  /** ... and the fame floor: `fames`, the pages a year of each person or body the question names. */
  rated: (d, fames = []) => (fames.length && Math.min(...fames) < FAME.known ? Math.max(d, 0.5) : d),
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
  // (a common word is a word the data counts as a word: not a place, nor a name it counts as a word, AS_NAME)
  const group = (w) => (W[w].clueOnly ? null : PEOPLE.includes(w) ? "person" : BODIES.includes(w) ? "body" : W[w].kind === "word" && !(w in AS_NAME) ? "word" : null);
  // Fame: the Kompas pages a year that name a person or body, 2011-2024 on average (DIFFICULTY.rated); a word's, the
  // same count for the word.
  const fame = (w) => (W[w] ? P.reduce((s, _, p) => s + pages(w, p), 0) / P.length : 0), named = (w) => PEOPLE.includes(w) || BODIES.includes(w) || ["person", "organisation"].includes(W[w]?.kind);
  const fames = (list) => list.filter(named).map(fame);
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
    out.year.push({ key: `year:${P[p]}`, topics: [`year:${P[p]}`, ...clue], variants: [at(DIFFICULTY.rated(DIFFICULTY.year(distinct), fames(clue)), { p, clue, others, answer: P[p],
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
        // (its difficulty is rated again when its choices are drawn, by the least known of them: finish)
        return at(DIFFICULTY.rated(DIFFICULTY.who(pages(n, p)), fames([n])), { p, said, others, near: others.filter((m) => shared(m) >= 2), answer: n, m: DIFFICULTY.who(pages(n, p)), fame: Object.fromEntries([n, ...others].map((m) => [m, fame(m)])),
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
        return at(DIFFICULTY.rated(DIFFICULTY.ratio(r), fames([a, b])), { p, choices: [a, b], answer: win, ev: { type: "marks", period: P[p], items: [a, b].map((w) => ({ label: w, v: W[w].share[p] })) } }); });
    if (variants.some((v) => v.answer === a) && variants.some((v) => v.answer === b)) out.freq.push({ key: `freq:${a}|${b}`, topics: [a, b], variants });
  }

  // Which peaked first: only between two of the same sort (two people, two bodies, two common words), and only for
  // words with a real peak (MARGIN.peakStand: the highest year stands clearly above the word's own level on both sides
  // of its run); every year of A's peak before every year of B's, by at least two years.
  const peak = (w) => {
    const v = W[w].share, top = Math.max(...v), p = v.indexOf(top), at = v.map((x, q) => (x >= MARGIN.peakNear * top ? q : -1)).filter((q) => q >= 0);
    let a = p, b = p;
    while (a > 0 && v[a - 1] >= top / 2) a--;
    while (b < v.length - 1 && v[b + 1] >= top / 2) b++;
    const [before, after] = [v.slice(0, a), v.slice(b + 1)];
    if (b - a + 1 > MARGIN.peakRun || before.length < MARGIN.peakSides || after.length < MARGIN.peakSides || at.some((q) => q < a || q > b)) return null;
    return top >= MARGIN.peakStand * Math.max(median(before), median(after)) && pages(w, p) >= MARGIN.pages ? { at, top: p } : null;
  };
  const peaked = Object.fromEntries(words.map((w) => [w, peak(w)]).filter(([, x]) => x));
  const peakers = Object.keys(peaked);
  for (let i = 0; i < peakers.length; i++) for (let j = i + 1; j < peakers.length; j++) {
    const [a, b] = [peakers[i], peakers[j]], [A, B] = [peaked[a], peaked[b]];
    if (group(a) !== group(b)) continue;
    const after = Math.min(...B.at) - Math.max(...A.at), before = Math.min(...A.at) - Math.max(...B.at), gap = Math.max(after, before);
    if (gap < MARGIN.peakGap) continue;
    const first = after > before ? a : b;
    out.peak.push({ key: `peak:${a}|${b}`, topics: [a, b], variants: [at(DIFFICULTY.rated(DIFFICULTY.peak(gap, Math.min(fame(a), fame(b))), fames([a, b])), { choices: [a, b], answer: first,
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
    out.room.push({ key: `room:${w}|${n}`, topics: [w, n], answer: OUTLET_NAMES[top], variants: [at(DIFFICULTY.rated(DIFFICULTY.ratio(v[top] / v[second]), [W[n] ? fame(n) : pg[0] / 5]), { choices: OUTLET_NAMES, answer: OUTLET_NAMES[top], w, n,
      ev: { type: "marks", period: Q.rooms.era, outlets: true, items: OUTLET_NAMES.map((o, k) => ({ label: o, v: v[k] / 1000, pages: pg[k] })) } })] });
  }

  // Up, down or about the same: a word from one year to another at least three years on.
  for (const w of words) {
    const variants = [];
    for (let p = 0; p < P.length; p++) for (let q = p + 3; q < P.length; q++) {
      const [a, b] = [W[w].share[p], W[w].share[q]];
      if (Math.min(pages(w, p), pages(w, q)) < MARGIN.pages) continue;
      const r = b / a, answer = r >= MARGIN.ratio ? "up" : r <= 1 / MARGIN.ratio ? "down" : Math.max(r, 1 / r) <= MARGIN.same ? "same" : null;
      if (answer) variants.push(at(DIFFICULTY.rated(answer === "same" ? DIFFICULTY.same(Math.max(r, 1 / r)) : DIFFICULTY.ratio(Math.max(r, 1 / r)), fames([w])), { p, q, answer, choices: ["up", "down", "same"], ev: { type: "line", series: [{ label: w, share: W[w].share }], marks: [p, q] } }));
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
    // (for an easy round, names a reader knows where three are there: a name little known makes it middling)
    const known = v.others.filter((m) => v.fame[m] >= FAME.known), near = tier === 2 ? pick(v.near, 3) : [];
    const picked = near.length >= 3 ? near : (tier === 0 && pick(known, 3).length >= 3 ? pick(known, 3) : pick(v.others, 3));
    if (picked.length < 3) return null;
    const choices = shuffle([v.answer, ...picked], rng), d = DIFFICULTY.rated(v.m, choices.map((m) => v.fame[m]));
    return { ...base, d: +d.toFixed(3), tier: tierOf(d), ask: ["quiz_who_ask", P[v.p]], clue: v.said, choices,
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
 * A deck per kind, kept for a visit and, where the browser keeps it, from visit to visit (`kept`, `keep`): its groups
 * are dealt in a shuffled order and none comes again until all have been dealt. `take(ok, tier, strict)` gives the
 * first undealt group that `ok` accepts, of the tier asked (with `strict`, only of that tier), else of the nearest;
 * null where none is left that `ok` accepts. A spent deck is not shuffled anew at once: `refill` does it (`deal`: a
 * spent kind sits out a game first, where the other kinds can fill it).
 */
export class Deck {
  constructor(groups, rng) { this.rng = rng; this.size = groups.length; this.fresh = shuffle(groups, rng); this.dealt = []; this.cycle = 0; this.given = {}; this.rest = null; }
  refill() { this.fresh = shuffle([...this.fresh, ...this.dealt], this.rng); this.dealt = []; this.cycle++; this.rest = null; }
  take(ok, tier, strict = false) {
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
  /** Where nothing undealt fits: the dealt group longest ago that `ok` accepts, dealt again (one early, not the deck). */
  early(ok) {
    const i = this.dealt.findIndex(ok);
    if (i < 0) return null;
    const [g] = this.dealt.splice(i, 1);
    this.dealt.push(g);
    return g;
  }
  /** A group taken but not asked (its choices could not be drawn) goes back where it was. */
  undo(g) { this.dealt.splice(this.dealt.indexOf(g), 1); this.fresh.unshift(g); if (g.answer) this.given[g.answer]--; }
  /** What is kept of it: the keys dealt this round of the deck (the latest `most`), the answers given, its rest. */
  state(most = 1500) { return { dealt: this.dealt.slice(-most).map((g) => g.key), given: this.given, cycle: this.cycle, rest: this.rest }; }
  restore(st) {
    const by = new Map(this.fresh.map((g) => [g.key, g])), dealt = (st?.dealt || []).map((k) => by.get(k)).filter(Boolean), out = new Set(dealt);
    this.dealt = dealt;
    this.fresh = this.fresh.filter((g) => !out.has(g));
    this.given = st?.given && typeof st.given === "object" ? st.given : {};
    this.cycle = +st?.cycle || 0;
    this.rest = Number.isFinite(st?.rest) ? st.rest : null;
  }
}
/** The visit's decks, a deck per kind; and, kept with them (not a kind), which game last showed each name and word
 *  (`seen`) and how many games were dealt. */
export const decks = (pool, rng) => {
  const d = Object.fromEntries(KINDS.filter((k) => pool[k].length).map((k) => [k, new Deck(pool[k], rng)]));
  return Object.defineProperties(d, { seen: { value: new Map() }, games: { value: 0, writable: true } });
};
/** A version of the questions (a hash of every key): what was kept under another version is let go. */
export const version = (lists) => {
  let h = 5381;
  for (const key of lists.flat().map((g) => g.key).join("\n")) h = ((h << 5) + h + key.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};
/** What is kept of a visit's decks between page loads (the page writes it to localStorage, where it may): every
 *  deck's dealt keys, how many games, and the names and words shown with the game that last showed them (the latest
 *  `most`). Under a size cap: the oldest let go first. */
export const keep = (d, most = 600) => {
  const seen = [...d.seen].sort((a, b) => b[1] - a[1]).slice(0, most);
  const st = { games: d.games, seen, decks: Object.fromEntries(Object.entries(d).map(([k, deck]) => [k, deck.state()])), named: d.named?.map((s) => [...s]) };
  return JSON.stringify(st).length < 60000 ? st : { ...st, seen: seen.slice(0, 200), decks: Object.fromEntries(Object.entries(d).map(([k, deck]) => [k, deck.state(200)])) };
};
export const kept = (d, st) => {
  if (!st || typeof st !== "object") return d;
  d.games = +st.games || 0;
  for (const [w, n] of Array.isArray(st.seen) ? st.seen : []) if (typeof w === "string" && Number.isFinite(n)) d.seen.set(w, n);
  for (const [k, deck] of Object.entries(d)) deck.restore(st.decks?.[k]);
  if (d.named && Array.isArray(st.named)) st.named.forEach((list, b) => Array.isArray(list) && list.forEach((n) => d.named[b]?.add(n)));
  return d;
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
 * One quiz game from the visit's decks: ten questions, no name, word or pair twice, no kind more than twice (CAP). The
 * names and words of the visit's earlier games go to the back: a round first looks among questions none of whose names
 * and words any game of this visit has shown (as an answer, a choice or in a clue), then among those not shown in the
 * last three games, then not in the last one; only then does it give up its tier, and the same again. A kind whose
 * deck is spent sits out the next game (rather than start over at once) where the other kinds can fill it. Dealt by
 * TIERS (three easy, four middling, three hard where the decks allow), the game is then asked in the order of each
 * question's own difficulty (`ordered`).
 */
export function deal(d, rng, P) {
  const n = ++d.games, all = Object.keys(d);
  for (const k of all) if (!d[k].fresh.length) { if (d[k].rest === null) d[k].rest = n; else if (n > d[k].rest) d[k].refill(); }
  const open = all.filter((k) => d[k].fresh.length), room = (list) => list.reduce((s, k) => s + Math.min(capOf(k), d[k].fresh.length), 0);
  // (where the kinds left cannot fill a game, the kind resting longest comes back)
  for (const k of all.filter((x) => !open.includes(x)).sort((a, b) => d[a].rest - d[b].rest)) if (room(open) < ROUNDS) (d[k].refill(), open.push(k));
  const kinds = open, order = rhythm(kinds, rng), used = new Set(), game = [], count = {};
  const age = (w) => (d.seen.has(w) ? n - d.seen.get(w) : Infinity);  // games since a name or word was last shown
  const LEVELS = [Infinity, 4, 2, 1];
  // (the hard rounds dealt first: few kinds have hard questions, and they need names still free; the easy ones last)
  for (const k of [...TIERS.keys()].sort((a, b) => TIERS[b] - TIERS[a] || a - b)) {
    const tier = TIERS[k];
    let q = null;
    for (const spent of [false, true]) {
      // (a round no kind left can fill: a spent deck comes round again, rather than a game a round short)
      if (spent) { if (q) break; for (const x of all) if (!d[x].fresh.length) d[x].refill(); }
      const which = [order[k], ...shuffle((spent ? all : kinds).filter((x) => x !== order[k]), rng)].filter((x) => x && (count[x] || 0) < capOf(x));
      // (its own tier first, then the next; only a tier that leaves the game an order of rising marks with no kind
      // twice running)
      for (const off of [0, 1, 2]) for (const level of LEVELS) for (const kind of which) for (const at of [tier - off, tier + off].filter((x, i, l) => x >= 0 && x <= 2 && l.indexOf(x) === i)) {
        if (q || !ordered([...game, { kind, tier: at, d: 0 }])) continue;
        const welcome = (w) => !used.has(w) && age(w) >= level;
        const g = d[kind].take((g) => g.topics.every(welcome), at, true);
        if (!g) continue;
        q = finish(kind, g, at, rng, P, (w) => (welcome(w) ? Math.min(age(w), 99) : 0));
        if (q && !ordered([...game, q])) q = null;
        if (!q) d[kind].undo(g);
      }
    }
    if (!q) continue;
    shownIn(q).forEach((w) => used.add(w));
    q.topics.forEach((t) => used.add(t));
    count[q.kind] = (count[q.kind] || 0) + 1;
    game.push(q);
  }
  for (const q of game) for (const w of shownIn(q)) d.seen.set(w, n);
  return ordered(game) || [...game].sort((a, b) => a.tier - b.tier || a.d - b.d);
}
/** A game in the order of its questions' difficulty: by mark (easy, middling, hard: never a lower mark after a higher),
 *  within a mark by difficulty, and never one kind twice running (the nearest order that keeps both); null where there
 *  is none. */
export function ordered(game) {
  const sorted = [...game].sort((a, b) => a.tier - b.tier || a.d - b.d), out = [];
  const place = (left) => {
    if (!left.length) return true;
    const low = Math.min(...left.map((q) => q.tier));
    for (const q of left.filter((x) => x.tier === low)) {
      if (out.length && out.at(-1).kind === q.kind) continue;
      out.push(q);
      if (place(left.filter((x) => x !== q))) return true;
      out.pop();
    }
    return false;
  };
  return place(sorted) ? out : null;
}

// ---- guess the number ----------------------------------------------------------------------------------------------
/** The questions of "guess the number", from Kompas's stick.json in 2020-2024: every word with a spread across names
 *  (MARGIN.spreadTop, spreadRatio) with every known name that is on enough pages, its true value (of 100 pages) and a
 *  line of context: who has the most, the next after it, and the least of it. */
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
        bin: GUESS_BINS.findIndex(([a, b]) => v >= a && v <= b), context: { of: known.length, hi: [s.names[hi], Math.round(s.share[w][hi][era] / 10)], next: [s.names[by[1]], Math.round(s.share[w][by[1]][era] / 10)], lo: [s.names[lo], Math.round(s.share[w][lo][era] / 10)] } });
    }
  }
  return out;
}
/** A deck per bin of the true value, kept for a visit (and from visit to visit, as the quiz's: `keep`, `kept`); with
 *  them which game last showed each name and word (`seen`), and per bin the names dealt since the bin last went round
 *  them all (`named`). */
export const guessDecks = (pool, rng) => {
  const d = GUESS_BINS.map((_, b) => new Deck(pool.filter((q) => q.bin === b), rng));
  return Object.defineProperties(d, { seen: { value: new Map() }, games: { value: 0, writable: true }, named: { value: GUESS_BINS.map(() => new Set()) },
    names: { value: GUESS_BINS.map((_, b) => new Set(pool.filter((q) => q.bin === b).map((q) => q.name))) } });
};
/** One game of six: three high values, one middle and two low (GUESS_DEAL), no word and no name
 *  twice. No word of the last game; within a visit a name comes back in its bin only after every other name of the bin
 *  has been dealt (in the high bin, now and then sooner), and the names and words of the visit's earlier games go to
 *  the back (as in the quiz). The order of the rounds is a shuffle of
 *  its own, so that where a word comes in a game says nothing. */
export function guessDeal(d, rng) {
  const used = new Set(), game = [], n = ++d.games, age = (w) => (d.seen.has(w) ? n - d.seen.get(w) : Infinity);
  // A bin's card, of those whose word and name are free in this game, by three rules in the order they give way: no
  // word the last game showed (17 words, six a game: there is always another); not the same word and name within four
  // games (`old`); a name the bin has not dealt this time round (`due`). Each from the cards left, else a dealt card
  // again. Among those a rule lets through, one whose word and name were shown longest ago, then one whose word has the
  // most cards left (so that the deck's last cards are not all of one word). A spent deck goes round again. (The high
  // bin is small, 43 cards of 25 names, and three a game: there the last two rules give way now and then.)
  const draw = (x) => {
    const deck = d[x];
    if (!deck.fresh.length) deck.refill();
    const left = {};
    for (const q of deck.fresh) left[q.w] = (left[q.w] || 0) + 1;
    const free = (q) => q.topics.every((t) => !used.has(t)), level = (q) => Math.min(4, ...q.topics.map(age)), due = (q) => free(q) && !d.named[x].has(q.name);
    const rested = (q) => age(q.w) > 1, due2 = (q) => due(q) && rested(q), free2 = (q) => free(q) && rested(q);
    const key = (q) => [-Math.min(3, age(q.w)), -level(q), -left[q.w]], first = (list) => list.sort((a, b) => { const [p, r] = [key(a), key(b)]; return p[0] - r[0] || p[1] - r[1] || p[2] - r[2]; })[0];
    const old = (q) => Math.max(age(q.w), age(q.name)) > 4, both = (ok) => (q) => ok(q) && old(q);
    let best = null;
    for (const ok of [both(due2), both(free2), due2, free2, both(due), both(free), due, free]) if ((best = first(deck.fresh.filter(ok)) || deck.early(ok))) break;
    if (!best) return deck.early(free);
    if (!deck.fresh.includes(best)) return best;
    deck.fresh.splice(deck.fresh.indexOf(best), 1);
    deck.dealt.push(best);
    return best;
  };
  // The scarcest bin (the high values) is dealt first, while every word and name is still free.
  for (const b of GUESS_DEAL) {
    const x = [b, ...[0, 1, 2].filter((y) => y !== b).sort((y, z) => Math.abs(y - b) - Math.abs(z - b))].find((y) => d[y].size), q = x === undefined ? null : draw(x);
    if (!q) continue;
    q.topics.forEach((t) => used.add(t));
    d.named[q.bin].add(q.name);
    if ([...d.names[q.bin]].every((m) => d.named[q.bin].has(m))) d.named[q.bin].clear();
    q.turn = game.length;  // (the order it was dealt in, before the shuffle: the checks follow the names in it)
    game.push(q);
  }
  for (const q of game) q.topics.forEach((t) => d.seen.set(t, n));
  return shuffle(game, rng);
}
/** The scale a guess is set on: 0 to 20 in steps of 1 over two thirds of the track (most true values are small), 20
 *  to 100 in steps of 5 over the rest. One mapping for the track, its ticks, the keys and the marks of the answer. */
export const STOPS = [...Array(21).keys(), ...Array.from({ length: 16 }, (_, k) => 25 + 5 * k)];
export const SPLIT = 2 / 3;
export const along = (v) => (v <= 20 ? (v / 20) * SPLIT : SPLIT + ((v - 20) / 80) * (1 - SPLIT));
export const stopAt = (f) => { const v = f <= SPLIT ? (f / SPLIT) * 20 : 20 + ((f - SPLIT) / (1 - SPLIT)) * 80; return STOPS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)); };
/** Points for a guess: 100 for the truth, and each step off costs 10 for a small number, less for a large one:
 *  round(100 x max(0, 1 - |guess - truth| / max(10, 1.5 x truth))). A guess within 2 always scores at least 80. */
export const points = (guess, truth) => Math.round(100 * Math.max(0, 1 - Math.abs(guess - truth) / Math.max(10, 1.5 * truth)));
/** The line said after a guess follows its points: 90 or more, 60 or more, 25 or more, less. "Right" (a filled port):
 *  60 or more. */
export const nearness = (won) => (won >= 90 ? 0 : won >= 60 ? 1 : won >= 25 ? 2 : 3);
export const close = (won) => won >= 60;
/** The rank at the end of the quiz, by the share of rounds right: all, three quarters, half, less. */
export const rank = (right, total) => (right === total ? 0 : right >= 0.75 * total ? 1 : right >= 0.5 * total ? 2 : 3);
/** ... and of "guess the number", by its share of the points: 80% and more, 55%, 30%, less. */
export const guessRank = (score, most) => (score >= 0.8 * most ? 0 : score >= 0.55 * most ? 1 : score >= 0.3 * most ? 2 : 3);
/** The words beside which a game says that sharing a page is not being accused: the words of the law and of accusation.
 *  Beside any other word ("viral", "survei") it would read as an accusation nobody made. */
export const CAVEAT = ["tersangka", "korupsi", "suap", "terdakwa", "ditangkap", "diperiksa", "divonis", "dilaporkan", "saksi", "sidang", "etik"];
