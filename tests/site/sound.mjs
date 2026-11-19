// node tests/site/sound.mjs   Sound (site/sound.js) as a reader meets it: on by default, the toggle pressed from the
// start; where the browser lets sound start at once it is heard at once, else it waits for the reader's first press, key
// or tap (a browser that asks for a gesture is emulated: the context stays suspended until one), the first page saying so
// with the toggle beside it; turned off, it is remembered and nothing of it is made on later visits; the toggle named in
// both languages, by keyboard and in the phone's menu; silent in a hidden tab; an embed silent unless turned on there;
// nothing broken where storage is refused or Web Audio is missing. Then the sound itself, rendered offline: every
// family's bed, every sound alone and 40 s of the first page (the bed, the arrival, two routes, the dive, a story's
// steps), each peak under CEILING and no sample NaN.
// SOUND_WAV=<dir> also writes those renders as WAV files, to listen to.
import { base, browser, done } from "./serve.mjs";
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const CEILING = 0.7; // -3 dBFS: no sound may come near full scale
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
// Every AudioContext the page makes, counted.
const COUNT = () => {
  window.__contexts = [];
  const A = window.AudioContext;
  if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__contexts.push(this); } };
};
/** A browser that lets sound start only after a gesture (as Chrome and Safari do on a first visit): every AudioContext
 *  says "suspended" and resumes only while the page has the reader's activation. */
const GESTURE = () => {
  const A = window.AudioContext;
  window.AudioContext = class extends A {
    constructor(...a) { super(...a); this.locked = true; }
    get state() { return this.locked ? "suspended" : super.state; }
    resume() { if (this.locked && !navigator.userActivation.isActive) return new Promise(() => {}); if (this.locked) (this.locked = false), this.dispatchEvent(new Event("statechange")); return super.resume(); }
  };
};
const fresh = async ({ init = [], width = 1440, height = 900, using = browser } = {}) => {
  const p = await using.newPage({ viewport: { width, height } });
  p.errors = [];
  p.fetched = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && p.errors.push(m.text()));
  p.on("request", (r) => p.fetched.push(r.url()));
  for (const f of [...init, COUNT]) await p.addInitScript(f);
  return p;
};
const look = (p) => p.evaluate(() => {
  const b = document.getElementById("sound");
  return { shown: !!b && !b.hidden && b.getClientRects().length > 0, pressed: b?.getAttribute("aria-pressed"), contexts: window.__contexts.length,
    state: window.__contexts.at(-1)?.state || "none", ask: document.querySelector(".sound-ask:not(.gone) > span:last-child")?.textContent.trim() || null, kept: (() => { try { return localStorage.getItem("sound"); } catch { return "refused"; } })() };
});
const sounded = (p) => p.fetched.some((u) => u.endsWith("/sound.js"));
const hide = (p, hidden) => p.evaluate((h) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);

{ // on by default, waiting for a gesture; heard from the first press; silent in a hidden tab; turned off, kept off and nothing made
  const p = await fresh({ init: [GESTURE] });
  await p.goto(base); await p.waitForTimeout(2500);
  const first = await look(p), name = await p.getByRole("button", { name: "Suara", exact: true }).count();
  log("on by default, waiting for a gesture", first.shown && first.pressed === "true" && first.contexts === 1 && first.state === "suspended" && first.ask === "Suara menyala: ketuk di mana saja untuk mendengar" && name >= 1 && first.kept === null,
    `toggle ${first.shown ? "shown" : "missing"}, named "Suara" ${name}x, pressed ${first.pressed}; ${first.contexts} AudioContext, ${first.state}; sound.js ${sounded(p) ? "fetched" : "not fetched"}; note "${first.ask}"; kept ${first.kept}`);
  await p.mouse.wheel(0, 300); await p.waitForTimeout(400);
  const scrolled = await look(p);
  await p.evaluate(() => scrollTo(0, 0)); await p.click("h1"); await p.waitForTimeout(1200);
  const on = await look(p);
  log("a scroll does not start it; the first press does", scrolled.state === "suspended" && on.pressed === "true" && on.contexts === 1 && on.state === "running" && sounded(p) && on.ask === null,
    `after a scroll ${scrolled.state}; after a press ${on.state}, ${on.contexts} AudioContext; sound.js ${sounded(p) ? "fetched" : "not fetched"}; note ${on.ask ? "still there" : "gone"}`);
  await hide(p, true); await p.waitForTimeout(1200);
  const hidden = await look(p);
  await hide(p, false); await p.waitForTimeout(600);
  const back = await look(p);
  log("silent while hidden", hidden.state === "suspended" && back.state === "running", `hidden: ${hidden.state}; shown again: ${back.state}`);
  await p.click("#sound"); await p.waitForTimeout(2000);
  const off = await look(p);
  p.fetched = [];
  await p.reload(); await p.waitForTimeout(2500); await p.click("h1"); await p.keyboard.press("a"); await p.waitForTimeout(800);
  const stays = await look(p);
  log("off with one press, kept off, nothing made on the next visit", off.pressed === "false" && off.state === "suspended" && off.kept === "off" && stays.pressed === "false" && stays.contexts === 0 && !sounded(p) && stays.ask === null,
    `pressed ${off.pressed}, ${off.state}, kept "${off.kept}"; after reload and a press pressed ${stays.pressed}, ${stays.contexts} AudioContext, sound.js ${sounded(p) ? "fetched" : "not fetched"}, note ${stays.ask ? "shown" : "none"}`);
  log("no errors (Indonesian, 1440px, a gesture asked for)", !p.errors.length, p.errors.join(" | ") || "none");
  await p.close();
}
// Where the browser lets sound start at once: a Chromium launched with the policy that says so.
for (const [name, using] of [["--autoplay-policy=no-user-gesture-required", await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })]]) {
  const p = await fresh({ using });
  await p.goto(base);
  let s;  // the sound is set up at an idle moment after the first paint: on a busy machine that can be seconds
  for (let t = 0; t < 30 && !((s = await look(p)).state === "running" && s.ask === null && sounded(p)); t++) await p.waitForTimeout(500);
  log(`heard at once where allowed (${name})`, s.pressed === "true" && s.contexts === 1 && s.state === "running" && s.ask === null && sounded(p) && !p.errors.length,
    `pressed ${s.pressed}; ${s.contexts} AudioContext, ${s.state}, no press; note ${s.ask ? "shown" : "none"}; errors ${p.errors.length} ${p.errors[0] || ""}`);
  await p.close();
  if (using !== browser) await using.close();
}
{ // English (opened in English: pressing the language button is a gesture, and starts the sound), and the keyboard
  const p = await fresh({ init: [GESTURE, () => { try { localStorage.setItem("language", "en"); } catch {} }] });
  await p.goto(base); await p.waitForTimeout(2000);
  const en = await look(p), name = await p.getByRole("button", { name: "Sound", exact: true }).count();
  let tabs = 0;
  while (tabs < 40 && !(await p.evaluate(() => document.activeElement?.id === "sound"))) (await p.keyboard.press("Tab"), tabs++);
  await p.keyboard.press("Enter"); await p.waitForTimeout(800);
  const entered = await look(p);
  await p.keyboard.press("Space"); await p.waitForTimeout(800);
  const spaced = await look(p);
  log("English labels", name >= 1 && en.ask === "Sound is on: tap anywhere to hear it", `"Sound" ${name}x, note "${en.ask}"`);
  log("by keyboard", tabs < 40 && entered.pressed === "false" && spaced.pressed === "true" && spaced.state === "running",
    `reached in ${tabs} tabs; Enter: pressed ${entered.pressed}; Space: pressed ${spaced.pressed}, ${spaced.state}`);
  log("no errors (English, keyboard)", !p.errors.length, p.errors.join(" | ") || "none");
  await p.close();
}
{ // a phone: in the menu, its name written beside it; the note's own toggle turns it off
  const p = await fresh({ width: 390, height: 780, init: [GESTURE] });
  await p.goto(base); await p.waitForTimeout(2000);
  const closed = await look(p);
  await p.click(".sound-ask .sound-toggle"); await p.waitForTimeout(300);
  const declined = await look(p);
  await p.click("#menu-button"); await p.waitForTimeout(500);
  const open = await look(p), label = await p.evaluate(() => document.querySelector("#sound span").getBoundingClientRect().width);
  log("phone: in the menu, named; the note's toggle turns it off", !closed.shown && open.shown && label > 20 && closed.ask && declined.ask === null && declined.kept === "off" && declined.pressed === "false" && open.pressed === "false",
    `menu closed: ${closed.shown ? "shown" : "not shown"}; open: ${open.shown ? "shown" : "not shown"}, its name ${Math.round(label)}px wide; the note's toggle: kept "${declined.kept}", pressed ${declined.pressed}, note ${declined.ask ? "still there" : "gone"}`);
  await p.close();
}
{ // an embed is silent, by default and though sound was left on elsewhere, unless turned on there
  for (const left of [null, "on"]) {
    const p = await fresh({ init: [GESTURE, ...(left ? [() => { try { localStorage.setItem("sound", "on"); } catch {} }] : [])] });
    await p.goto(base + "#/cerita/oknum/embed/0/0"); await p.waitForTimeout(3000);
    const toggle = await p.evaluate(() => document.querySelector(".embed-foot .sound-toggle")?.getAttribute("aria-pressed"));
    await p.click(".embed-foot .on"); await p.waitForTimeout(500);
    const quiet = await look(p);
    await p.click(".embed-foot .sound-toggle"); await p.waitForTimeout(800);
    const on = await look(p);
    log(`embed (${left ? "left on elsewhere" : "by default"}): silent unless turned on there`, toggle === "false" && quiet.contexts === 0 && !quiet.kept === !left && on.contexts === 1 && on.state === "running" && !p.errors.length,
      `its toggle pressed ${toggle}; after a step ${quiet.contexts} AudioContext; turned on there: ${on.contexts}, ${on.state}; errors ${p.errors.length}`);
    await p.close();
  }
}
{ // storage refused (Safari with cookies blocked): on at each visit, heard from the first press, nothing thrown
  const p = await fresh({ init: [GESTURE, () => { for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, { get() { throw new DOMException("refused", "SecurityError"); } }); }] });
  await p.goto(base); await p.waitForTimeout(2500);
  const before = await look(p);
  await p.click("h1"); await p.waitForTimeout(800);
  const s = await look(p);
  log("storage refused", before.pressed === "true" && s.state === "running" && !p.errors.length, `pressed ${before.pressed}, ${before.state} -> ${s.state} after a press; errors ${p.errors.length}${p.errors.length ? " " + p.errors[0] : ""}`);
  await p.close();
}
{ // no Web Audio: no toggle, no note, nothing thrown
  const p = await fresh({ init: [() => { delete window.AudioContext; delete window.webkitAudioContext; }] });
  await p.goto(base); await p.waitForTimeout(2500);
  const s = await p.evaluate(() => ({ hidden: document.getElementById("sound").hidden, ask: !!document.querySelector(".sound-ask:not(.gone)") }));
  log("no Web Audio: no toggle", s.hidden && !s.ask && !p.errors.length, `toggle hidden ${s.hidden}, note ${s.ask}; errors ${p.errors.length}`);
  await p.close();
}

// ---- the sound itself, offline -----------------------------------------------------------------------------------
// Nobody can listen here, so what can be measured is: every render's peak and NaNs, and from spectra and envelopes
// the things the design claims (docs/DESIGN.md, "Sound"): (a) the gong ageng's energy lies low (under 120 Hz) and beats
// (its ombak) at 1 to 3 Hz, and it never reaches the compressor's knee; (b) bronze partials are inharmonic, at the
// ratios chosen; (c) paired tones beat at the rate intended; (d) successive steps differ in pitch; (e) under water every
// note is of pelog, above it of slendro. The expected numbers are written here, not taken from sound.js.
const SLENDRO = [0, 240, 480, 720, 960], PELOG = [0, 119, 255, 672, 784], ROOT = 146.83;  // cents over D3
const BAR = [2.76, 5.4, 8.93], KNOB = [2.02, 2.97];  // partial ratios over the fundamental
const KNEE = 1.4 * 10 ** (-13 / 20);  // the compressor (threshold -10 dB, knee 6 dB) after a gain of 1.4 (LOUD): -10 dBFS out
const p = await fresh();
await p.goto(base); await p.waitForTimeout(1000);
const { renders, m } = await p.evaluate(async ({ wav, SLENDRO, PELOG, ROOT, BAR, KNOB }) => {
  const { sound } = await import("./sound.js");
  const RATE = 44100, QUANTUM = 128 / RATE;
  /** `seconds` of sound; `events` [time, (s) => ...] are played at their time (the context paused there). */
  const make = async (seconds, events) => {
    const ctx = new OfflineAudioContext(2, RATE * seconds, RATE), s = sound(ctx), at = new Map();
    for (const [t, f] of events) { const q = Math.round(t / QUANTUM) * QUANTUM; at.set(q, [...(at.get(q) || []), f]); }
    for (const [t, fs] of at) if (t > 0) ctx.suspend(t).then(() => (fs.forEach((f) => f(s)), ctx.resume()));
    s.on(0.01);
    (at.get(0) || []).forEach((f) => f(s));
    const b = await ctx.startRendering(), L = b.getChannelData(0), R = b.getChannelData(1), mono = new Float32Array(b.length);
    for (let i = 0; i < b.length; i++) mono[i] = (L[i] + R[i]) / 2;
    return { channels: [L, R], mono, length: b.length };
  };
  const stats = (b) => {
    let peak = 0, nan = 0, sum = 0;
    for (const d of b.channels) for (const v of d) (Number.isFinite(v) ? ((peak = Math.max(peak, Math.abs(v))), (sum += v * v)) : nan++);
    const out = { peak, nan, rms: Math.sqrt(sum / (2 * b.length)) };
    if (!wav) return out;
    const bytes = new DataView(new ArrayBuffer(44 + b.length * 4)), text = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
    text(0, "RIFF"); bytes.setUint32(4, 36 + b.length * 4, true); text(8, "WAVEfmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); text(36, "data"); bytes.setUint32(40, b.length * 4, true);
    for (let i = 0; i < b.length; i++) for (const c of [0, 1]) bytes.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, b.channels[c][i])) * 32767, true);
    let s = "";
    const u8 = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { ...out, wav: btoa(s) };
  };
  const render = async (seconds, events) => stats(await make(seconds, events));
  // ---- measuring -------------------------------------------------------------------------------------------------
  const fft = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) ([re[i], re[j]] = [re[j], re[i]], [im[i], im[j]] = [im[j], im[i]]);
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len / 2;
      for (let i = 0; i < n; i += len) for (let k = 0, cr = 1, ci = 0; k < h; k++) {
        const xr = re[i + k + h] * cr - im[i + k + h] * ci, xi = re[i + k + h] * ci + im[i + k + h] * cr;
        re[i + k + h] = re[i + k] - xr; im[i + k + h] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  };
  /** The magnitude spectrum of the mono mix from `from` seconds, `size` samples (a power of two), Hann-windowed. */
  const spectrum = (b, from, size) => {
    const re = new Float64Array(size), im = new Float64Array(size), o = Math.round(from * RATE);
    for (let i = 0; i < size; i++) re[i] = (b.mono[o + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    fft(re, im);
    const mag = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    return { mag, bin: RATE / size };
  };
  /** The strongest frequency between lo and hi Hz (a parabola through its bin and their neighbours), and its strength. */
  const strongest = ({ mag, bin }, lo, hi) => {
    let k = Math.ceil(lo / bin);
    for (let i = k; i <= Math.floor(hi / bin); i++) if (mag[i] > mag[k]) k = i;
    const [a, b, c] = [mag[k - 1], mag[k], mag[k + 1]].map((v) => Math.log(v + 1e-12)), d = (0.5 * (a - c)) / (a - 2 * b + c || 1);
    return { hz: (k + d) * bin, mag: mag[k] };
  };
  /** The peaks between lo and hi Hz no more than `floor` dB under the strongest there, one per `near` Hz. */
  const peaks = (s, lo, hi, floor = 26, near = 8) => {
    const top = strongest(s, lo, hi).mag, found = [];
    for (let i = Math.ceil(lo / s.bin) + 1; i < hi / s.bin; i++) if (s.mag[i] > s.mag[i - 1] && s.mag[i] >= s.mag[i + 1] && s.mag[i] > top * 10 ** (-floor / 20)) {
      const f = strongest(s, (i - 1) * s.bin, (i + 1) * s.bin), last = found.at(-1);
      if (last && f.hz - last.hz < near) { if (f.mag > last.mag) found[found.length - 1] = f; } else found.push(f);
    }
    return found;
  };
  /** The rate (Hz) at which the loudness beats between `from` and `to` seconds: the envelope (rms of 10 ms) in dB, less
   *  its own one-second average (the decay), then the strongest of its frequencies from lo to hi Hz. */
  const beating = (b, from, to, lo = 0.5, hi = 10) => {
    const step = RATE / 100, env = [];
    for (let i = Math.round(from * RATE); i + step <= to * RATE; i += step) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += b.mono[i + j] ** 2;
      env.push(10 * Math.log10(sum / step + 1e-20));
    }
    const r = env.map((v, i) => { const w = env.slice(Math.max(0, i - 50), i + 50); return v - w.reduce((a, x) => a + x, 0) / w.length; }).slice(50, -50);
    let best = { hz: 0, power: 0 };
    for (let f = lo; f <= hi; f += 0.02) {
      let c = 0, s = 0;
      r.forEach((v, i) => ((c += v * Math.cos((2 * Math.PI * f * i) / 100)), (s += v * Math.sin((2 * Math.PI * f * i) / 100))));
      if (c * c + s * s > best.power) best = { hz: f, power: c * c + s * s };
    }
    return +best.hz.toFixed(2);
  };
  const cents = (a, b) => 1200 * Math.log2(a / b);
  /** How far f lies from the nearest note of a scale (in any octave), in cents. */
  const off = (f, scale) => Math.min(...scale.map((c) => { const x = (((cents(f, ROOT) - c) % 1200) + 1200) % 1200; return Math.min(x, 1200 - x); }));
  const m = {};
  // (a) the gong ageng, alone (the landing): where its energy lies, its ombak, its peak
  const gong = await make(10, [[0.05, (s) => s.play("land")]]), gs = spectrum(gong, 0.1, 131072);
  let low = 0, all = 0;
  gs.mag.forEach((v, i) => ((all += v * v), i * gs.bin < 120 && (low += v * v)));
  m.gong = { hz: strongest(gs, 20, 4000).hz, low: low / all, ombak: beating(gong, 2, 9), peak: stats(gong).peak };
  // (b) partials: a bar (the "on" tone, one gender note) and a knobbed gong (a kenong: the first step)
  const bar = await make(4, [[0.05, (s) => s.play("on")]]), bs = spectrum(bar, 0.06, 65536), f0 = strongest(bs, 150, 600);
  m.bar = { f: f0.hz, ratios: BAR.map((r) => +(strongest(bs, f0.hz * r * 0.97, f0.hz * r * 1.03).hz / f0.hz).toFixed(4)),
    harmonics: [2, 3].map((h) => +(20 * Math.log10(strongest(bs, f0.hz * h * 0.995, f0.hz * h * 1.005).mag / f0.mag)).toFixed(1)), beat: beating(bar, 0.3, 3.5) };
  const kenong = await make(4, [[0.05, (s) => s.play("step", false, [], 1)]]), ks = spectrum(kenong, 0.06, 65536), k0 = strongest(ks, 150, 600);
  m.knob = { f: k0.hz, ratios: KNOB.map((r) => +(strongest(ks, k0.hz * r * 0.99, k0.hz * r * 1.01).hz / k0.hz).toFixed(4)), beat: beating(kenong, 0.3, 3.5) };
  // (c) a kempul (the second step) and its pair
  m.kempul = { beat: beating(await make(5, [[0.05, (s) => s.play("step", false, [], 2)]]), 0.3, 4.5) };
  // (d) six steps forward, each one's pitch
  const six = await make(10, [1, 2, 3, 4, 5, 6].map((j) => [0.05 + (j - 1) * 1.6, (s) => s.play("step", false, [], j)]));
  m.steps = [0, 1, 2, 3, 4, 5].map((i) => +strongest(spectrum(six, 0.1 + i * 1.6, 32768), 60, 1000).hz.toFixed(1));
  // (e) a step's numbers above water and under it: every peak a note of the scale (or a partial of the step's kenong)
  const heard = async (under) => {
    const b = await make(3, [[0, (s) => under && s.dive(1, true)], [0.05, (s) => s.play("step", false, [0, 1, 2, 3, 4], 1)]]);
    return peaks(spectrum(b, 0.32, 65536), 420, 1230);
  };
  const kenongPartials = KNOB.map((r) => ROOT * 2 * r);  // the kenong of step 1 is degree 5, D4, in both scales
  for (const [name, scale, other] of [["above", SLENDRO, PELOG], ["under", PELOG, SLENDRO]]) {
    const found = (await heard(name === "under")).filter((f) => Math.min(...kenongPartials.map((k) => Math.abs(cents(f.hz, k)))) > 12);
    m[name] = { notes: found.map((f) => +f.hz.toFixed(1)), in: found.filter((f) => off(f.hz, scale) < 12).length, other: found.filter((f) => off(f.hz, other) < 12).length };
  }
  // ---- the renders, to listen to -------------------------------------------------------------------------------
  const planned = (seconds) => [...Array(Math.ceil(seconds / 2))].map((_, i) => [i * 2, (s) => s.ahead(i * 2 + 4)]);  // as the live layer plans, every 2 s, 4 s ahead
  const flown = (t) => [[t, (s) => s.dive(0.15, true)], [t + 0.6, (s) => s.dive(0, true)]];  // the story's sea flies on each step
  const renders = {};
  for (const family of ["home", "story", "map", "word", "rest"]) renders[`bed-${family}`] = await render(30, [[0, (s) => s.bed(family)], ...planned(30)]);
  const args = { route: [14, 1800], "route-slow": [14, 6760], step: [false, [0.12, 0.3, 0.45], 1], "step-back": [true, [], 2], scene: [1, false] };
  for (const name of ["on", "hover", "press", "tick", "light", "sheet", "right", "wrong", "arrive", "route", "route-slow", "step", "step-back", "scene", "open", "land", "under", "surface"])
    renders[name] = await render(name.startsWith("route") ? 9 : name === "land" ? 10 : 4, [[0.05, (s) => s.play(name.replace(/-.*/, ""), ...(args[name] || []))]]);
  // The first page, then a story: the bed comes in, the words arrive, the first route sails, a chip sails another, the
  // reader dives into the chart and comes back up a little, then opens a story and steps through it to its landing.
  const dive = [...Array(61)].map((_, i) => [16 + i * 0.1, (s) => s.dive(i / 60)]), rise = [...Array(11)].map((_, i) => [23.5 + i * 0.1, (s) => s.dive(1 - i / 20)]);
  renders.home = await render(40, [[0, (s) => (s.bed("home"), s.play("on"))], ...planned(40), [0.6, (s) => s.play("arrive")], [3.2, (s) => s.play("route", 14, 1800)],
    [7, (s) => (s.play("hover"), s.play("press"))], [7.9, (s) => s.play("route", 14, 6760)], ...dive, [22.5, (s) => s.play("hover")], ...rise,
    [26.5, (s) => (s.play("press"), s.bed("story"))], [28, (s) => s.play("open")], [29, (s) => s.play("scene", 0)], [30, (s) => s.play("step", false, [], 1)], [32.2, (s) => s.play("step", false, [0.21, 0.08], 2)],
    [34.4, (s) => s.play("step", false, [0.05, 0.11, 0.32], 3)], [35.6, (s) => s.play("sheet")], [36.8, (s) => s.play("step", true, [0.21, 0.08], 2)], [38.4, (s) => s.play("land")]]);
  // A whole story, one gong cycle: the cover opens, scene one's gong, three steps, scene two's gong, three steps (and one
  // back and on again), the landing's gong ageng.
  const story = [[1, (s) => s.play("open")], [2.2, (s) => s.play("scene", 0)], [4.6, (s) => s.play("step", false, [0.21, 0.08], 1)], [7, (s) => s.play("step", false, [], 2)],
    [9.4, (s) => s.play("step", false, [0.05, 0.11, 0.32], 3)], [12.4, (s) => s.play("scene", 1)], [14.8, (s) => s.play("step", false, [], 1)], [17.2, (s) => s.play("step", false, [0.4, 0.62], 2)],
    [19.6, (s) => s.play("step", true, [], 1)], [21.2, (s) => s.play("step", false, [0.4, 0.62], 2)], [23.6, (s) => s.play("step", false, [0.3, 0.12, 0.55, 0.2], 3)], [27, (s) => s.play("land")]];
  renders.story = await render(38, [[0, (s) => (s.bed("story"), s.play("on"))], ...planned(38), ...story, ...story.slice(1, -1).flatMap(([t]) => flown(t))]);
  // The dive: a few notes above (slendro), down under the water, the same notes there (pelog), and back up.
  const notes = (t) => [[t, (s) => s.play("right")], [t + 1.6, (s) => s.play("light")], [t + 3, (s) => s.play("step", false, [0, 1, 2, 3, 4], 1)]];
  renders.dive = await render(30, [[0, (s) => s.bed("home")], ...planned(30), ...notes(1), ...[...Array(41)].map((_, i) => [6 + i * 0.1, (s) => s.dive(i / 40)]),
    ...notes(11), ...[...Array(41)].map((_, i) => [17 + i * 0.1, (s) => s.dive(1 - i / 40)]), ...notes(22)]);
  return { renders, m };
}, { wav: !!process.env.SOUND_WAV, SLENDRO, PELOG, ROOT, BAR, KNOB });
const db = (v) => (v > 0 ? `${(20 * Math.log10(v)).toFixed(1)} dBFS` : "silent");
const near = (a, b, tol) => Math.abs(a - b) <= tol;
log("(a) gong ageng: low, its ombak 1-3 Hz, under the knee", m.gong.hz < 120 && m.gong.low > 0.5 && m.gong.ombak >= 1 && m.gong.ombak <= 3 && m.gong.peak < KNEE,
  `strongest at ${m.gong.hz.toFixed(1)} Hz, ${(m.gong.low * 100).toFixed(0)}% of its energy under 120 Hz; beats at ${m.gong.ombak} Hz; peak ${db(m.gong.peak)} (knee at ${db(KNEE)})`);
log("(b) bar partials inharmonic, at 2.76 5.40 8.93", m.bar.ratios.every((r, i) => near(r, BAR[i], BAR[i] * 0.005)) && m.bar.harmonics.every((d) => d < -25),
  `fundamental ${m.bar.f.toFixed(1)} Hz; partials at ${m.bar.ratios.join(", ")} x; at 2x and 3x ${m.bar.harmonics.join(" and ")} dB`);
log("(b) knob partials a little off 2 and 3", m.knob.ratios.every((r, i) => near(r, KNOB[i], 0.004) && Math.abs(r - Math.round(r)) > 0.01),
  `fundamental ${m.knob.f.toFixed(1)} Hz; partials at ${m.knob.ratios.join(", ")} x`);
log("(c) paired tones beat as intended", near(m.bar.beat, 4, 0.25) && near(m.knob.beat, 3, 0.25) && near(m.kempul.beat, 3, 0.25),
  `gender ${m.bar.beat} Hz (4 intended), kenong ${m.knob.beat} Hz, kempul ${m.kempul.beat} Hz (3 intended)`);
log("(d) successive steps differ in pitch", m.steps.every((f, i) => !i || Math.abs(1200 * Math.log2(f / m.steps[i - 1])) > 50), `steps 1-6 at ${m.steps.join(", ")} Hz`);
log("(e) above water slendro, under water pelog", ["above", "under"].every((k) => m[k].notes.length >= 4 && m[k].in === m[k].notes.length && m[k].other <= m[k].notes.length - 3),
  ["above", "under"].map((k) => `${k}: ${m[k].notes.join(", ")} Hz, ${m[k].in}/${m[k].notes.length} in its scale, ${m[k].other} also in the other`).join("; "));
for (const [name, r] of Object.entries(renders)) {
  log(`(f) offline: ${name}`, r.nan === 0 && r.peak < CEILING && r.peak > 0, `peak ${db(r.peak)}, rms ${db(r.rms)}${r.nan ? `, ${r.nan} samples NaN` : ""}`);
  if (process.env.SOUND_WAV) (mkdirSync(process.env.SOUND_WAV, { recursive: true }), writeFileSync(join(process.env.SOUND_WAV, `${name}.wav`), Buffer.from(r.wav, "base64")));
}
log("no errors (offline)", !p.errors.length, p.errors.join(" | ") || "none");
await p.close();
await done(failures);
