// node tests/site/games.mjs [write]   The games deal fairly, and play.
// Without a browser (site/deal.js on site/data/quiz.json and Kompas's stick.json): site/data/quiz.json is what the data
// says (`write` writes it anew); many games of each kind are dealt, and it fails on a repeat or a near-duplicate within a
// game (a topic, a word or a name, twice), a replay that repeats a question before its deck is spent, a question whose
// answer is not among its choices or with two equal choices, a question under its margin (each margin checked again
// here from the raw numbers, not from deal.js's verdict), a string missing in either language, and a "guess the number"
// that one fixed guess would win.
// Then one browser pass per game at 390 and 1440 that plays a whole game (the quiz by keyboard alone at 1440, by taps at
// 390): the first action on screen without scrolling, the evidence drawn after each answer, focus on the control that
// goes on, that control in the same place every round, the plate saved, no console errors; and on every toy, no
// information only a hover shows.
import { readFileSync, writeFileSync } from "node:fs";
import { quizData } from "./quiz-data.mjs";
import { pools, decks, deal, guessPool, guessDecks, guessDeal, points, seeded, MARGIN, KINDS, ROUNDS, GUESS_ROUNDS, SENSITIVE, OUTLET_NAMES, POINTED, PEOPLE, BODIES } from "../../site/deal.js";
import { TEXT } from "../../site/text.js";

const FILE = new URL("../../site/data/quiz.json", import.meta.url).pathname, started = Date.now();
let failures = 0;
const log = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); if (!ok) failures++; };
const fresh = JSON.stringify(quizData());
if (process.argv[2] === "write") { writeFileSync(FILE, fresh); console.log(`wrote ${FILE} (${fresh.length} bytes)`); process.exit(0); }
log("site/data/quiz.json is what the data says", readFileSync(FILE, "utf8") === fresh, "else: node tests/site/games.mjs write");

const Q = JSON.parse(fresh), P = Q.periods, W = Q.words, pages = (w, p) => W[w].share[p] * Q.units[p], pool = pools(Q);
console.log(`     distinct questions: ${KINDS.map((k) => `${k} ${pool[k].length}`).join(", ")}`);
log("every kind can be dealt", KINDS.every((k) => pool[k].length >= 10), KINDS.filter((k) => pool[k].length < 10).join(", "));

/** A question's margin, from the raw numbers: what is wrong with it, or "". */
function margin(q) {
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b), e = q.ev;
  if (q.kind === "freq" || q.kind === "resmi") {
    const p = P.indexOf(e.period), [a, b] = q.choices, [va, vb] = [W[a].share[p], W[b].share[p]];
    if (ratio(va, vb) < MARGIN.ratio) return `ratio ${ratio(va, vb).toFixed(2)}`;
    if (Math.max(pages(a, p), pages(b, p)) < MARGIN.pages || Math.min(pages(a, p), pages(b, p)) < MARGIN.least) return "too few pages";
    if ((va > vb ? a : b) !== q.answer) return "answer is not the larger";
  }
  if (q.kind === "room") {
    if (SENSITIVE.includes(q.w)) return `sensitive word ${q.w} beside ${q.n}`;
    const v = e.items.map((i) => i.v), s = [...v].sort((a, b) => b - a);
    if (s[0] < MARGIN.ratio * s[1]) return `newsrooms ${v.join("/")}`;
    if (e.items.some((i) => i.pages < MARGIN.roomPages)) return "too few pages";
    if (OUTLET_NAMES[v.indexOf(s[0])] !== q.answer) return "answer is not the largest";
  }
  if (q.kind === "trend") {
    const [p, r] = e.marks, w = e.series[0].label, x = W[w].share[r] / W[w].share[p];
    const want = x >= MARGIN.ratio ? "up" : x <= 1 / MARGIN.ratio ? "down" : Math.max(x, 1 / x) <= MARGIN.same ? "same" : null;
    if (want !== q.answer) return `${w} ${P[p]}→${P[r]} x${x.toFixed(2)} said ${q.answer}`;
    if (Math.min(pages(w, p), pages(w, r)) < MARGIN.pages) return "too few pages";
  }
  if (q.kind === "peak") {
    const at = (w) => { const v = W[w].share, top = Math.max(...v); return v.map((x, p) => (x >= MARGIN.peakNear * top ? p : -1)).filter((p) => p >= 0); };
    const [a, b] = q.choices, other = a === q.answer ? b : a, A = at(q.answer), B = at(other);
    if (Math.min(...B) - Math.max(...A) < MARGIN.peakGap) return `${q.answer} ${A} before ${other} ${B}?`;
  }
  if (q.kind === "year") {
    const clue = q.clue, sum = (p) => clue.reduce((s, w) => s + (W[w]?.share[p] || 0), 0), p = P.indexOf(q.answer);
    const close = q.choices.filter((c) => c !== q.answer).find((c) => sum(P.indexOf(c)) * MARGIN.yearRatio > sum(p) || Math.abs(P.indexOf(c) - p) < 2);
    if (close) return `year ${close} too near ${q.answer}`;
  }
  if (q.kind === "who") {
    const p = P.indexOf(q.ask[1]), clash = q.choices.filter((c) => c !== q.answer).find((c) => (Q.who[c]?.said[p] || []).filter((x) => q.clue.includes(x)).length > MARGIN.whoShared);
    if (clash) return `${clash} shares the clue of ${q.answer}`;
    if (pages(q.answer, p) < MARGIN.whoPages) return "too few pages";
  }
  return "";
}

// The quiz: 300 games in one visit (decks kept between them, as the page keeps them), from three seeds.
const games = { bad: [], dealt: Object.fromEntries(KINDS.map((k) => [k, 0])), short: 0, kinds: new Set() };
for (const seed of [1, 2, 3]) {
  const rng = seeded(seed), d = decks(pool, rng), seen = Object.fromEntries(KINDS.map((k) => [k, []]));
  for (let g = 0; g < 100; g++) {
    const game = deal(d, rng, P), topics = new Set(), keys = new Set();
    if (game.length !== ROUNDS) games.short++;
    game.forEach((q, i) => {
      const where = `seed ${seed} game ${g} round ${i} ${q.key}`;
      games.dealt[q.kind]++;
      seen[q.kind].push(q.key);
      if (i && game[i - 1].kind === q.kind) games.bad.push(`${where}: the same kind twice running`);
      if (keys.has(q.key)) games.bad.push(`${where}: asked twice`);
      keys.add(q.key);
      for (const t of q.topics) { if (topics.has(t)) games.bad.push(`${where}: “${t}” again in one game`); topics.add(t); }
      if (!q.choices.includes(q.answer)) games.bad.push(`${where}: answer ${q.answer} not among ${q.choices}`);
      if (new Set(q.choices).size !== q.choices.length || q.choices.length < 2) games.bad.push(`${where}: choices ${q.choices}`);
      const m = margin(q);
      if (m) games.bad.push(`${where}: under its margin (${m})`);
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
log("300 quizzes: no repeat, no near-duplicate, every answer among its choices, every question over its margin", !games.bad.length && !games.short, games.bad.slice(0, 5).join("; ") || `${games.short} short`);
log("each kind dealt at least 200 times", KINDS.every((k) => games.dealt[k] >= 200), KINDS.map((k) => `${k} ${games.dealt[k]}`).join(", "));
// Within a visit, a question of a kind smaller than the games played (the years, the official words) comes back only
// after the whole deck: checked above. Across a visit's first game and its second, no question at all repeats:
{ const rng = seeded(9), d = decks(pool, rng), a = deal(d, rng, P).map((q) => q.key), b = deal(d, rng, P).map((q) => q.key);
  log("a second game in the same visit asks nothing the first asked", !a.some((k) => b.includes(k)), a.filter((k) => b.includes(k)).join(", ")); }

// Guess the number: 300 games in one visit.
const stick = JSON.parse(readFileSync(new URL("../../site/data/id-web-eras-kompas/stick.json", import.meta.url)));
const gpool = guessPool(stick), gbad = [];
let constant = Array(101).fill(0), played = 0;
{ const rng = seeded(4), d = guessDecks(gpool, rng), seen = [[], [], []];
  for (let g = 0; g < 300; g++) {
    const game = guessDeal(d, rng), topics = new Set();
    if (game.length !== GUESS_ROUNDS) gbad.push(`game ${g}: ${game.length} rounds`);
    for (const q of game) {
      seen[q.bin].push(q.key);
      for (const t of q.topics) { if (topics.has(t)) gbad.push(`game ${g}: “${t}” twice`); topics.add(t); }
      // Only a name a reader knows as one person or body (deal.js's list: no bare first name, no common word), and only
      // a word with a point (POINTED: not "anak", "video").
      if (!PEOPLE.includes(q.name) && !BODIES.includes(q.name)) gbad.push(`game ${g}: “${q.name}” is not a name a reader knows`);
      if (!POINTED.includes(q.w)) gbad.push(`game ${g}: “${q.w}” is an everyday word`);
      const i = stick.names.indexOf(q.name);
      if (stick.pages[i][2] < MARGIN.guessPages || (stick.share[q.w][i][2] * stick.pages[i][2]) / 1000 < MARGIN.guessHits) gbad.push(`game ${g}: ${q.key} on too few pages`);
      if (Math.round(stick.share[q.w][i][2] / 10) !== q.v) gbad.push(`game ${g}: ${q.key} is not ${q.v}`);
    }
    for (let c = 0; c <= 100; c++) constant[c] += game.reduce((s, q) => s + points(c, q.v), 0) / (game.length * 100);
    played++;
  }
  seen.forEach((list, b) => { const size = gpool.filter((q) => q.bin === b).length; for (let a = 0; a < list.length; a += size) if (new Set(list.slice(a, a + size)).size !== list.slice(a, a + size).length) gbad.push(`bin ${b} repeats before its deck is spent`); });
}
const best = Math.max(...constant) / played, at = constant.indexOf(Math.max(...constant));
console.log(`     guess the number: ${gpool.length} distinct questions (${["low", "middle", "high"].map((name, b) => `${gpool.filter((q) => q.bin === b).length} ${name}`).join(", ")}), ${new Set(gpool.map((q) => q.w)).size} words, ${new Set(gpool.map((q) => q.name)).size} names`);
log("300 guess games: six rounds, no word or name twice, every value as counted", !gbad.length, gbad.slice(0, 5).join("; "));
log("no one fixed guess wins: the best (always guessing " + at + ") scores under half on average", best < 0.5, `${Math.round(best * 100)}%`);

// Every string the games use, in both languages.
const KEYS = ["said_right", "said_wrong", "said_streak", "said_near", "said_rank", "ask_freq", "ask_peak", "ask_resmi", "ask_room", "ask_trend", "trend_up", "trend_down", "trend_same",
  "room_era", "ev_freq", "ev_peak", "ev_room", "ev_trend", "ev_year", "ev_who", "caveat", "quiz_status", "quiz_streak", "quiz_keys", "quiz_plate_all", "guess_context", "next_toy",
  "played_best", "played_once", "quiz_year_ask", "quiz_who_ask", "quiz_tally", "quiz_save", "quiz_log", "quiz_next", "quiz_share", "guess_ask", "guess_truth", "guess_lock", "guess_score",
  "guess_more", "guess_done", "guess_rule", "guess_off", "try_label", "guess_share", "copy_score", "copied", "again", "next", "nav_quiz", "play_tebak", "play_kuis", "quiz_lede", "guess_lede", "guess_yours"];
const missing = ["id", "en"].flatMap((l) => KEYS.filter((k) => TEXT[l][k] === undefined).map((k) => `${l}.${k}`));
const lengths = ["said_right", "said_wrong", "said_near", "said_rank"].filter((k) => TEXT.id[k]?.length !== TEXT.en[k]?.length);
log("every string of the games in both languages", !missing.length && !lengths.length, [...missing, ...lengths].join(", "));
// The owner's wording, exactly.
const OWN = { id: ["Tepat.", "Kena.", "Tiga beruntun. Jangan-jangan kamu wartawan.", "Arsip berjalan", "Baru bangun tidur"], en: ["Spot on.", "Got it.", "Three in a row. Are you a reporter?", "A walking archive", "Just woke up"] };
const flat = (l) => JSON.stringify([TEXT[l].said_right, TEXT[l].said_streak, TEXT[l].said_rank]);
log("the reactions are worded as given", Object.entries(OWN).every(([l, list]) => list.every((s) => flat(l).includes(s))) && TEXT.id.said_wrong[3]("X") === "Ingatan memang suka menipu: X." && TEXT.en.ask_trend("w", 1, 2) === "“w”, from 1 to 2: up, down, or about the same?");
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
  const quiz = { rounds: 0, figures: 0, focus: 0, places: new Set(), streakShown: false };
  for (let k = 0; k < 12 && (await p.locator(".quiz .choices button").count()); k++) {
    if (touch) await p.locator(".quiz .choices button").nth(k % 2).tap(); else await p.keyboard.press(String(1 + (k % 2)));
    await p.waitForTimeout(60);
    quiz.figures += await p.locator(".quiz .reveal svg :is(circle, path)").count() > 2 ? 1 : 0;
    quiz.focus += (await p.evaluate(() => document.activeElement?.classList.contains("quiz-go"))) ? 1 : 0;
    quiz.places.add(await goAt());
    if (touch) await p.locator(".quiz-go").tap(); else await p.keyboard.press("Enter");
    await p.waitForTimeout(60);
    quiz.rounds++;
  }
  const end = await p.evaluate(() => ({ score: document.querySelector(".quiz .score")?.textContent, rank: document.querySelector(".quiz .rank")?.textContent, plate: !!document.querySelector(".quiz .plate svg"), go: document.querySelector(".quiz-go").textContent }));
  const saved = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).then((d) => d.suggestedFilename()).catch(() => null), p.locator(".quiz .controls button").first().click()]).then(([f]) => f);
  log(`quiz at ${w}: the first answer on screen, ${ROUNDS} rounds ${touch ? "by taps" : "by keyboard alone"}, the evidence drawn and focus on “next” each time, “next” in one place, a plate saved`,
    first > 0 && quiz.rounds === ROUNDS && quiz.figures === ROUNDS && quiz.focus === ROUNDS && quiz.places.size === 1 && end.plate && end.rank && /\.png$/.test(saved || "") && !errors.length,
    `first answer ${first > 0 ? `ends at ${first}px` : `below the screen (${-first}px)`}; ${quiz.rounds} rounds; ${quiz.figures} figures; focus on next ${quiz.focus}×; next at ${[...quiz.places].join(" | ")}; ${end.score} “${end.rank}”; saved ${saved}; errors ${errors.slice(0, 2).join(" / ") || 0}`);
  // Play again: one tap, a new game, nothing of the last asked again.
  const before = await p.evaluate(() => document.querySelector(".quiz .ask")?.textContent);
  await p.locator(".quiz-go").click(); await p.waitForTimeout(100);
  log(`quiz at ${w}: “play again” starts a new game in place`, (await p.locator(".quiz .choices button").count()) > 1 && (await goAt()) === [...quiz.places][0], `go at ${await goAt()}; ask ${before?.slice(0, 30)} → ${(await p.evaluate(() => document.querySelector(".quiz .ask")?.textContent))?.slice(0, 30)}`);

  // Guess the number: by keyboard at 1440 (Tab to the slider, arrows, Enter), by taps at 390.
  errors.length = 0;
  await p.goto(base + "#/tebak"); await p.waitForSelector(".gauge input");
  const gfirst = await firstAction(".quiz-go");
  const guess = { rounds: 0, focus: 0, places: new Set(), verdicts: 0 };
  for (let k = 0; k < 8 && (await p.locator(".gauge input:not([disabled])").count()); k++) {
    if (touch) { const box = await p.locator(".gauge .scale").boundingBox(); await p.touchscreen.tap(box.x + box.width * 0.1, box.y + box.height / 2); await p.locator(".quiz-go").tap(); }
    else { await p.locator(".gauge input").focus(); for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Enter"); }
    await p.waitForTimeout(60);
    guess.verdicts += (await p.locator(".quiz .verdict .context").count());
    guess.focus += (await p.evaluate(() => document.activeElement?.classList.contains("quiz-go"))) ? 1 : 0;
    guess.places.add(await goAt());
    if (touch) await p.locator(".quiz-go").tap(); else await p.keyboard.press("Enter");
    await p.waitForTimeout(60);
    guess.rounds++;
  }
  const gend = await p.evaluate(() => ({ score: document.querySelector(".quiz .score")?.textContent, plate: !!document.querySelector(".quiz .plate svg"), rank: document.querySelector(".quiz .rank")?.textContent }));
  const gsaved = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).then((d) => d.suggestedFilename()).catch(() => null), p.locator(".quiz .controls button").first().click()]).then(([f]) => f);
  log(`guess at ${w}: the lock on screen, six rounds ${touch ? "by taps on the scale" : "by keyboard alone"}, a verdict with its context, focus on “next”, “next” in one place, a plate saved`,
    gfirst > 0 && guess.rounds === GUESS_ROUNDS && guess.verdicts === GUESS_ROUNDS && guess.focus === GUESS_ROUNDS && guess.places.size === 1 && gend.plate && /\.png$/.test(gsaved || "") && !errors.length,
    `lock ${gfirst > 0 ? `ends at ${gfirst}px` : `below the screen (${-gfirst}px)`}; ${guess.rounds} rounds; ${guess.verdicts} verdicts; focus ${guess.focus}×; next at ${[...guess.places].join(" | ")}; ${gend.score} “${gend.rank}”; saved ${gsaved}; errors ${errors.slice(0, 2).join(" / ") || 0}`);

  // The hub remembers what was played, and every toy shows its first control on the first screen; nothing only a hover shows.
  await p.goto(base + "#/main"); await p.waitForSelector(".play-card");
  const remembered = await p.evaluate(() => [...document.querySelectorAll(".play-card .played")].map((n) => n.textContent));
  log(`hub at ${w} remembers the games played and their best`, remembered.length >= 2, remembered.join(" | "));
  const toys = [];
  for (const toy of ["menempel", "lingkaran", "redaksi", "pasang", "balap", "tahun", "bergeser", "entitas"]) {
    await p.goto(base + "#/" + toy); await p.waitForTimeout(1500);
    const look = await p.evaluate(() => {
      const view = document.getElementById("view"), head = view.querySelector(".page-head");
      const controls = [...view.querySelectorAll("button, input, select, a[role=button], .chips a")].filter((n) => n.getClientRects().length && !head?.contains(n));
      const r = controls[0]?.getBoundingClientRect();
      // Hover-only: anything with a tip that answers neither a tap (click) nor a key.
      const hoverOnly = [...view.querySelectorAll("[data-tip]")].length && !view.querySelector("[data-tip-tap]") ? 1 : 0;
      return { first: r ? Math.round(r.bottom) : 9999, hoverOnly };
    });
    toys.push(`${toy} ${look.first}${look.hoverOnly ? " hover-only" : ""}`);
    if (look.first > h || look.hoverOnly) failures++, console.log(`FAIL ${toy} at ${w}: first control ends at ${look.first}px${look.hoverOnly ? "; a tip only a hover shows" : ""}`);
  }
  console.log(`     toys at ${w}, where the first control ends: ${toys.join(", ")}`);
  await ctx.close();
}
console.log(`     ${((Date.now() - started) / 1000).toFixed(1)} s`);
await done(failures);
