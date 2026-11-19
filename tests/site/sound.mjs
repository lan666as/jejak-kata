// node tests/site/sound.mjs   Sound (site/sound.js) as a reader meets it: off by default, and nothing of it made (no
// AudioContext, sound.js not fetched) until the toggle is pressed; the toggle in the header (in the menu on a phone), named
// in both languages and pressed by keyboard; the choice kept across a reload and heard from the first press; silent in a
// hidden tab and once turned off; an embed silent unless turned on there; nothing broken where storage is refused or Web
// Audio is missing. Then the sound itself, rendered offline: every family's bed, every sound alone and 40 s of the first
// page (the bed, the arrival, two routes, the dive, a story's steps), each peak under CEILING and no sample NaN.
// SOUND_WAV=<dir> also writes those renders as WAV files, to listen to.
import { base, browser, done } from "./serve.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const CEILING = 0.5; // -6 dBFS: no sound may come near full scale
let failures = 0;
const log = (name, ok, detail) => { failures += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
// Every AudioContext the page makes, counted.
const COUNT = () => {
  window.__contexts = [];
  const A = window.AudioContext;
  if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__contexts.push(this); } };
};
const fresh = async ({ init = [], width = 1440, height = 900 } = {}) => {
  const p = await browser.newPage({ viewport: { width, height } });
  p.errors = [];
  p.fetched = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && p.errors.push(m.text()));
  p.on("request", (r) => p.fetched.push(r.url()));
  for (const f of [COUNT, ...init]) await p.addInitScript(f);
  return p;
};
const look = (p) => p.evaluate(() => {
  const b = document.getElementById("sound");
  return { shown: !!b && !b.hidden && b.getClientRects().length > 0, pressed: b?.getAttribute("aria-pressed"), contexts: window.__contexts.length,
    state: window.__contexts.at(-1)?.state || "none", ask: document.querySelector(".sound-ask .yes")?.textContent.trim() || null, kept: (() => { try { return localStorage.getItem("sound"); } catch { return "refused"; } })() };
});
const sounded = (p) => p.fetched.some((u) => u.endsWith("/sound.js"));
const hide = (p, hidden) => p.evaluate((h) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);

{ // off by default; on with a press; kept across a reload; silent in a hidden tab; off again
  const p = await fresh();
  await p.goto(base); await p.waitForTimeout(2500);
  const first = await look(p), name = await p.getByRole("button", { name: "Suara", exact: true }).count();
  log("off by default, nothing made", first.shown && first.pressed === "false" && first.contexts === 0 && !sounded(p) && first.ask === "Nyalakan suara" && name === 1,
    `toggle ${first.shown ? "shown" : "missing"}, named "Suara" ${name}x, pressed ${first.pressed}; ${first.contexts} AudioContext; sound.js ${sounded(p) ? "fetched" : "not fetched"}; invitation "${first.ask}"`);
  await p.click("#sound"); await p.waitForTimeout(1000);
  const on = await look(p);
  log("on with a press", on.pressed === "true" && on.contexts === 1 && on.state === "running" && sounded(p) && on.ask === null && on.kept === "on",
    `pressed ${on.pressed}; ${on.contexts} AudioContext, ${on.state}; sound.js ${sounded(p) ? "fetched" : "not fetched"}; invitation ${on.ask ? "still there" : "gone"}; kept "${on.kept}"`);
  await hide(p, true); await p.waitForTimeout(1200);
  const hidden = await look(p);
  await hide(p, false); await p.waitForTimeout(600);
  const back = await look(p);
  log("silent while hidden", hidden.state === "suspended" && back.state === "running", `hidden: ${hidden.state}; shown again: ${back.state}`);
  p.fetched = [];
  await p.reload(); await p.waitForTimeout(2500);
  const again = await look(p);
  await p.click("h1"); await p.waitForTimeout(1000);
  const woken = await look(p);
  log("kept after a reload, heard from the first press", again.pressed === "true" && again.contexts === 0 && !again.ask && woken.contexts === 1 && woken.state === "running",
    `after reload pressed ${again.pressed}, ${again.contexts} AudioContext; after a press on the page ${woken.contexts}, ${woken.state}`);
  await p.click("#sound"); await p.waitForTimeout(2000);
  const off = await look(p);
  await p.reload(); await p.waitForTimeout(2000); await p.click("h1"); await p.waitForTimeout(500);
  const stays = await look(p);
  log("off again, and kept off", off.pressed === "false" && off.state === "suspended" && off.kept === "off" && stays.pressed === "false" && stays.contexts === 0,
    `pressed ${off.pressed}, ${off.state}, kept "${off.kept}"; after reload pressed ${stays.pressed}, ${stays.contexts} AudioContext`);
  log("no errors (Indonesian, 1440px)", !p.errors.length, p.errors.join(" | ") || "none");
  await p.close();
}
{ // English, and the keyboard
  const p = await fresh();
  await p.goto(base); await p.waitForTimeout(2000);
  await p.click("#language"); await p.waitForTimeout(1500);
  const en = await look(p), name = await p.getByRole("button", { name: "Sound", exact: true }).count(), no = await p.getByRole("button", { name: "No sound", exact: true }).count();
  let tabs = 0;
  while (tabs < 40 && !(await p.evaluate(() => document.activeElement?.id === "sound"))) (await p.keyboard.press("Tab"), tabs++);
  await p.keyboard.press("Enter"); await p.waitForTimeout(800);
  const entered = await look(p);
  await p.keyboard.press("Space"); await p.waitForTimeout(400);
  const spaced = await look(p);
  log("English labels", name === 1 && no === 1 && en.ask === "Turn sound on", `"Sound" ${name}x, "No sound" ${no}x, invitation "${en.ask}"`);
  log("by keyboard", tabs < 40 && entered.pressed === "true" && entered.state === "running" && spaced.pressed === "false",
    `reached in ${tabs} tabs; Enter: pressed ${entered.pressed}, ${entered.state}; Space: pressed ${spaced.pressed}`);
  log("no errors (English, keyboard)", !p.errors.length, p.errors.join(" | ") || "none");
  await p.close();
}
{ // a phone: in the menu, its name written beside it; the invitation's "no" is a choice too
  const p = await fresh({ width: 390, height: 780 });
  await p.goto(base); await p.waitForTimeout(2000);
  const closed = await look(p);
  await p.click(".sound-ask .no"); await p.waitForTimeout(300);
  const declined = await look(p);
  await p.click("#menu-button"); await p.waitForTimeout(500);
  const open = await look(p), label = await p.evaluate(() => document.querySelector("#sound span").getBoundingClientRect().width);
  log("phone: in the menu, named", !closed.shown && open.shown && label > 20 && declined.ask === null && declined.kept === "off" && declined.contexts === 0,
    `menu closed: ${closed.shown ? "shown" : "not shown"}; open: ${open.shown ? "shown" : "not shown"}, its name ${Math.round(label)}px wide; "no" to the invitation: kept "${declined.kept}", ${declined.contexts} AudioContext`);
  await p.close();
}
{ // an embed is silent though sound was left on elsewhere, unless turned on there
  const p = await fresh({ init: [() => { try { localStorage.setItem("sound", "on"); } catch {} }] });
  await p.goto(base + "#/cerita/oknum/embed/0/0"); await p.waitForTimeout(3000);
  const toggle = await p.evaluate(() => document.querySelector(".embed-foot .sound-toggle")?.getAttribute("aria-pressed"));
  await p.click(".embed-foot .on"); await p.waitForTimeout(500);
  const quiet = await look(p);
  await p.click(".embed-foot .sound-toggle"); await p.waitForTimeout(800);
  const on = await look(p);
  log("embed: silent unless turned on there", toggle === "false" && quiet.contexts === 0 && on.contexts === 1 && on.state === "running" && !p.errors.length,
    `its toggle pressed ${toggle}; after a step ${quiet.contexts} AudioContext; turned on there: ${on.contexts}, ${on.state}; errors ${p.errors.length}`);
  await p.close();
}
{ // storage refused (Safari with cookies blocked): works, remembers nothing, throws nothing
  const p = await fresh({ init: [() => { for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, { get() { throw new DOMException("refused", "SecurityError"); } }); }] });
  await p.goto(base); await p.waitForTimeout(2500);
  await p.click("#sound"); await p.waitForTimeout(800);
  const s = await look(p);
  log("storage refused", s.pressed === "true" && s.state === "running" && !p.errors.length, `pressed ${s.pressed}, ${s.state}; errors ${p.errors.length}${p.errors.length ? " " + p.errors[0] : ""}`);
  await p.close();
}
{ // no Web Audio: no toggle, no invitation, nothing thrown
  const p = await fresh({ init: [() => { delete window.AudioContext; delete window.webkitAudioContext; }] });
  await p.goto(base); await p.waitForTimeout(2500);
  const s = await p.evaluate(() => ({ hidden: document.getElementById("sound").hidden, ask: !!document.querySelector(".sound-ask") }));
  log("no Web Audio: no toggle", s.hidden && !s.ask && !p.errors.length, `toggle hidden ${s.hidden}, invitation ${s.ask}; errors ${p.errors.length}`);
  await p.close();
}

// ---- the sound itself, offline -----------------------------------------------------------------------------------
const p = await fresh();
await p.goto(base); await p.waitForTimeout(1000);
const renders = await p.evaluate(async (wav) => {
  const { sound } = await import("./sound.js");
  const RATE = 44100, QUANTUM = 128 / RATE;
  /** `seconds` of sound; `events` [time, (s) => ...] are played at their time (the context paused there). */
  const render = async (seconds, events) => {
    const ctx = new OfflineAudioContext(2, RATE * seconds, RATE), s = sound(ctx), at = new Map();
    for (const [t, f] of events) { const q = Math.round(t / QUANTUM) * QUANTUM; at.set(q, [...(at.get(q) || []), f]); }
    for (const [t, fs] of at) if (t > 0) ctx.suspend(t).then(() => (fs.forEach((f) => f(s)), ctx.resume()));
    s.on(0.01);
    (at.get(0) || []).forEach((f) => f(s));
    const buffer = await ctx.startRendering(), channels = [0, 1].map((c) => buffer.getChannelData(c));
    let peak = 0, nan = 0, sum = 0;
    for (const d of channels) for (const v of d) (Number.isFinite(v) ? ((peak = Math.max(peak, Math.abs(v))), (sum += v * v)) : nan++);
    const out = { peak, nan, rms: Math.sqrt(sum / (2 * buffer.length)) };
    if (!wav) return out;
    const bytes = new DataView(new ArrayBuffer(44 + buffer.length * 4)), text = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
    text(0, "RIFF"); bytes.setUint32(4, 36 + buffer.length * 4, true); text(8, "WAVEfmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); text(36, "data"); bytes.setUint32(40, buffer.length * 4, true);
    for (let i = 0; i < buffer.length; i++) for (const c of [0, 1]) bytes.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, channels[c][i])) * 32767, true);
    let b = "";
    const u8 = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) b += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { ...out, wav: btoa(b) };
  };
  const planned = (seconds) => [...Array(Math.ceil(seconds / 2))].map((_, i) => [i * 2, (s) => s.ahead(i * 2 + 4)]);  // as the live layer plans, every 2 s, 4 s ahead
  const results = {};
  for (const family of ["home", "story", "map", "word", "rest"]) results[`bed-${family}`] = await render(30, [[0, (s) => s.bed(family)], ...planned(30)]);
  const args = { route: [14, 1800], "route-slow": [14, 6760], step: [false, [0.12, 0.3, 0.45]], "step-back": [true, []] };
  for (const name of ["on", "hover", "press", "tick", "light", "sheet", "right", "wrong", "arrive", "route", "route-slow", "step", "step-back", "open", "land", "under", "surface"])
    results[name] = await render(name.startsWith("route") ? 9 : 4, [[0.05, (s) => s.play(name.replace(/-.*/, ""), ...(args[name] || []))]]);
  // The first page, then a story: the bed comes in, the words arrive, the first route sails, a chip sails another, the
  // reader dives into the chart and comes back up a little, then opens a story and steps through it to its landing.
  const dive = [...Array(61)].map((_, i) => [16 + i * 0.1, (s) => s.dive(i / 60)]), rise = [...Array(11)].map((_, i) => [23.5 + i * 0.1, (s) => s.dive(1 - i / 20)]);
  results.home = await render(40, [[0, (s) => (s.bed("home"), s.play("on"))], ...planned(40), [0.6, (s) => s.play("arrive")], [3.2, (s) => s.play("route", 14, 1800)],
    [7, (s) => (s.play("hover"), s.play("press"))], [7.9, (s) => s.play("route", 14, 6760)], ...dive, [22.5, (s) => s.play("hover")], ...rise,
    [26.5, (s) => (s.play("press"), s.bed("story"))], [28, (s) => s.play("open")], [30, (s) => s.play("step", false, [])], [32.2, (s) => s.play("step", false, [0.21, 0.08])],
    [34.4, (s) => s.play("step", false, [0.05, 0.11, 0.32])], [35.6, (s) => s.play("sheet")], [36.8, (s) => s.play("step", true, [0.21, 0.08])], [38.4, (s) => s.play("land")]]);
  return results;
}, !!process.env.SOUND_WAV);
const db = (v) => (v > 0 ? `${(20 * Math.log10(v)).toFixed(1)} dBFS` : "silent");
for (const [name, r] of Object.entries(renders)) {
  log(`offline: ${name}`, r.nan === 0 && r.peak < CEILING && r.peak > 0, `peak ${db(r.peak)}, rms ${db(r.rms)}${r.nan ? `, ${r.nan} samples NaN` : ""}`);
  if (process.env.SOUND_WAV) (mkdirSync(process.env.SOUND_WAV, { recursive: true }), writeFileSync(join(process.env.SOUND_WAV, `${name}.wav`), Buffer.from(r.wav, "base64")));
}
log("no errors (offline)", !p.errors.length, p.errors.join(" | ") || "none");
await p.close();
await done(failures);
