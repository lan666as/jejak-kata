// The night sea, heard: a quiet bed and a few short sounds for what the site does, all made here with the Web Audio
// API (no files, no samples). Fetched only once the reader turns sound on (app.js), and handed the AudioContext made
// in that press. The bed is waves of filtered noise on a slow swell whose period never repeats, a low drone and, now
// and then, a far bell buoy, all under one lowpass (the water) that the hero's dive closes: above water to under it.
// Each family of pages hears its own sea by a few numbers (BEDS), as each has its own sea scene. Every pitch is a
// note of one scale, slendro (five near-equal steps to the octave, the scale of a gamelan), so the bed, the bells and
// every sound are in tune with each other. Everything goes through one gain (on, off, a hidden tab: fades) and a
// compressor, and stays far below full scale: tests/site/sound.mjs renders it offline and checks its peaks.

const ROOT = 146.83; // D3
/** Degree k of the scale (0 is the root; 5 an octave up). */
const note = (k) => ROOT * 2 ** (k / 5);
const LOUD = 0.5; // the whole layer's gain after the compressor
// Each family's sea: how high the waves run (waves) and how bright they break (bright), the drone's root (in degrees
// from the scale's), how many seconds pass between bells on average (bells), and how wide the waves stand (wide).
const BEDS = {
  home: { waves: 1, bright: 1, drone: 0, bells: 16, wide: 0.7 },  // the hero: open water, a bell now and then
  story: { waves: 0.55, bright: 0.6, drone: -1, bells: 34, wide: 0.35 },  // the stage: further off, lower, sparer
  map: { waves: 0.75, bright: 0.85, drone: 1, bells: 11, wide: 0.9 },  // the map: wide, and more lights heard
  word: { waves: 0.65, bright: 0.75, drone: 1, bells: 24, wide: 0.5 },
  rest: { waves: 0.5, bright: 0.65, drone: 0, bells: 40, wide: 0.4 },
};
const RATIOS = [1, 2, 2.76]; // a bell's partials: the note, its octave, and the one that makes it a bell
const rand = (a, b) => a + Math.random() * (b - a);

/** The sound layer on `ctx` (an AudioContext, or an OfflineAudioContext for the checks). */
export function sound(ctx) {
  const live = !(window.OfflineAudioContext && ctx instanceof OfflineAudioContext);
  const level = ctx.createGain(), squeeze = ctx.createDynamicsCompressor(), out = ctx.createGain(), fx = ctx.createGain();
  level.gain.value = 0;
  Object.entries({ threshold: -10, knee: 6, ratio: 12, attack: 0.003, release: 0.25 }).forEach(([k, v]) => (squeeze[k].value = v));
  out.gain.value = LOUD;
  fx.gain.value = 2.5;  // what the site does stands a little over the sea
  fx.connect(level).connect(squeeze).connect(out).connect(ctx.destination);
  // Seven seconds of white noise, the stuff of waves and of every hiss (a loop of white noise has no seam to hear).
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 7.3), ctx.sampleRate), white = noise.getChannelData(0);
  for (let i = 0; i < white.length; i++) white[i] = Math.random() * 2 - 1;

  // ---- voices: a ringing tone and a hiss -----------------------------------------------------------------------
  /** A tone at f from time t: struck (attack), held (hold), dying away (decay, the time constant), with a bell's
   *  partials (each higher one dying sooner), gliding to f * glide as it dies, placed left to right (pan). */
  const ring = (f, t, { gain = 0.05, attack = 0.005, hold = 0, decay = 1, glide = 1, pan = 0, partials = [1, 0.25, 0.08], to = fx } = {}) => {
    const env = ctx.createGain(), place = ctx.createStereoPanner(), end = t + attack + hold + decay * 6;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.setTargetAtTime(0, t + attack + hold, decay);
    place.pan.value = pan;
    env.connect(place).connect(to);
    partials.forEach((a, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f * RATIOS[i], t);
      if (glide !== 1) o.frequency.exponentialRampToValueAtTime(f * RATIOS[i] * glide, t + attack + hold + decay);
      g.gain.setValueAtTime(a, t);
      g.gain.setTargetAtTime(0, t + attack + hold, decay / (1 + 2 * i));
      o.connect(g).connect(env);
      o.start(t);
      o.stop(end);
    });
  };
  /** A breath of noise through a band that moves from f to f2 over dur: a click when short, a swish when long. */
  const hiss = (t, { dur = 0.02, f = 2500, f2 = f, q = 1.2, gain = 0.05, pan = 0 } = {}) => {
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), env = ctx.createGain(), place = ctx.createStereoPanner();
    src.buffer = noise;
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.setValueAtTime(f, t);
    band.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    env.gain.setTargetAtTime(0, t + dur * 0.35, dur * 0.25);
    place.pan.value = pan;
    src.connect(band).connect(env).connect(place).connect(fx);
    src.start(t, rand(0, 6));
    src.stop(t + dur * 2.5 + 0.02);
  };

  // ---- the bed -------------------------------------------------------------------------------------------------
  // The water: one lowpass over all of the bed, opened above water and closed under it (dive).
  const water = ctx.createBiquadFilter(), bed = ctx.createGain();
  water.type = "lowpass";
  water.frequency.value = 3500;
  water.Q.value = 0.5;
  bed.gain.value = 0;
  water.connect(bed).connect(level);
  // Two lines of waves, one to each side, each its own noise through a lowpass that opens as the wave rises.
  const layers = [-1, 1].map((side, i) => {
    const src = ctx.createBufferSource(), tone = ctx.createBiquadFilter(), swell = ctx.createGain(), place = ctx.createStereoPanner();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = i ? 1.03 : 0.97;
    tone.type = "lowpass";
    tone.frequency.value = 300;
    tone.Q.value = 0.3;
    swell.gain.value = 0.02;
    src.connect(tone).connect(swell).connect(place).connect(water);
    src.start(0, i * 3.1);
    return { src, tone, swell, place, side, rate: src.playbackRate.value, next: ctx.currentTime + i * rand(1.5, 3.5) };
  });
  // The drone: the root two octaves down, the note a near fifth above it, and the root, faint and a little apart (it
  // beats slowly); it breathes on a slow wave of its own.
  const hum = ctx.createBiquadFilter(), drone = ctx.createGain(), breath = ctx.createOscillator(), breadth = ctx.createGain();
  hum.type = "lowpass";
  hum.frequency.value = 420;
  drone.gain.value = 0.012;
  hum.connect(drone).connect(water);
  const voices = [[-5, "sine", 1, 0], [-2, "sine", 0.55, 0], [0, "triangle", 0.22, 4]].map(([k, type, g, cents]) => {
    const o = ctx.createOscillator(), a = ctx.createGain();
    Object.assign(o, { type });
    o.frequency.value = note(k);
    o.detune.value = cents;
    a.gain.value = g;
    o.connect(a).connect(hum);
    o.start();
    return { o, k, cents };
  });
  breath.frequency.value = 0.043;
  breadth.gain.value = 0.004;
  breath.connect(breadth).connect(drone.gain);
  breath.start();

  let family = null, depth = 0, bell = ctx.currentTime + rand(4, 9);
  /** The waves and bells from now until `to` (seconds on the context's clock), each wave of its own height and length. */
  const ahead = (to = ctx.currentTime + 4) => {
    const b = BEDS[family] || BEDS.rest;
    for (const w of layers) for (w.next = Math.max(w.next, ctx.currentTime); w.next < to; ) {
      const t = w.next, period = rand(5.5, 12), crest = t + period * rand(0.3, 0.45), height = rand(0.35, 1) * b.waves;
      w.swell.gain.setTargetAtTime(0.035 + 0.3 * height, t, (crest - t) / 2.5);
      w.swell.gain.setTargetAtTime(0.03, crest, (t + period - crest) / 3);
      w.tone.frequency.setTargetAtTime((350 + 1500 * height) * b.bright, t, (crest - t) / 2);
      w.tone.frequency.setTargetAtTime(260 * b.bright + 40, crest, (t + period - crest) / 3);
      w.place.pan.setTargetAtTime(w.side * b.wide * rand(0.4, 1), t, period / 3);
      w.next = t + period * rand(0.75, 1);  // the next comes in before this one has quite gone
    }
    // A bell buoy, far off: struck by a wave, and often again as it rocks back, softer.
    for (bell = Math.max(bell, ctx.currentTime); bell < to; bell += Math.max(6, -Math.log(1 - Math.random()) * b.bells)) {
      const f = note(5 + Math.floor(rand(0, 6))), pan = rand(-0.8, 0.8), g = rand(0.5, 1);
      ring(f, bell, { gain: 0.02 * g, decay: 1.4, pan, to: water });
      if (Math.random() < 0.6) ring(f, bell + rand(1.1, 2), { gain: 0.011 * g, decay: 1.2, pan, to: water });
    }
  };

  // ---- what the site does ---------------------------------------------------------------------------------------
  const FX = {
    on: (t) => ring(note(5), t, { gain: 0.04, decay: 0.9 }),
    hover: (t) => hiss(t, { dur: 0.008, f: 5000, q: 3, gain: 0.02 }),
    press: (t) => (hiss(t, { dur: 0.02, f: 1800, q: 1.5, gain: 0.05 }), ring(note(0), t, { gain: 0.02, decay: 0.04, partials: [1] })),
    tick: (t) => (hiss(t, { dur: 0.015, f: 3500, q: 2, gain: 0.035 }), ring(note(15), t, { gain: 0.012, decay: 0.06, partials: [1] })),
    light: (t) => (ring(note(12), t, { gain: 0.035, decay: 0.8, partials: [1, 0.4, 0.2] }), ring(note(17), t + 0.07, { gain: 0.012, decay: 0.6 })),
    sheet: (t) => (hiss(t, { dur: 0.25, f: 600, f2: 2000, q: 0.9, gain: 0.07 }), ring(note(9), t + 0.12, { gain: 0.015, decay: 0.3 })),
    right: (t) => (ring(note(7), t, { gain: 0.04, decay: 0.5 }), ring(note(10), t + 0.13, { gain: 0.04, decay: 0.8 })),
    wrong: (t) => (ring(note(3), t, { gain: 0.035, decay: 0.4, partials: [1, 0.1] }), ring(note(2), t + 0.16, { gain: 0.03, decay: 0.5, partials: [1, 0.1] })),
    // The words come on: a slow chord from below, and a few lights pinging on across the sea.
    arrive: (t) => {
      [0, 3, 5].forEach((k, i) => ring(note(k - 5), t + i * 0.35, { gain: 0.018, attack: 1.2, hold: 0.8, decay: 0.8, partials: [1, 0.2] }));
      for (let i = 0; i < 7; i++) ring(note(10 + Math.floor(rand(0, 5))), t + rand(0.2, 2.4), { gain: 0.01, decay: 0.3, pan: rand(-0.9, 0.9) });
    },
    // A route sailed: a low tone rising under it, and a pluck at each port (year), from left to right, rising.
    route: (t, ports = 14, ms = 1800) => {
      const s = ms / 1000, n = Math.max(1, ports);
      if (!s) return ring(note(10), t, { gain: 0.035, decay: 0.6 });
      ring(note(-2), t, { gain: 0.016, attack: Math.min(0.4, s / 3), hold: s, decay: 0.4, glide: 2 ** (7 / 5), partials: [1, 0.15] });
      for (let i = 0; i < n; i++) ring(note(3 + Math.round((i * 7) / Math.max(1, n - 1))), t + (i * s) / Math.max(1, n - 1), { gain: 0.03, decay: 0.18, pan: n > 1 ? -0.5 + i / (n - 1) : 0 });
    },
    // A story's step: a page turning (up the band going on, down coming back); then its numbers, low to high (the
    // ones the caption names, on the beacon), the lowest named lowest; where it names none, one tone.
    step: (t, back = false, values = []) => {
      hiss(t, { dur: 0.18, f: back ? 2200 : 900, f2: back ? 900 : 2200, q: 0.8, gain: 0.05 });
      const v = (values || []).filter(Number.isFinite).sort((a, b) => a - b).slice(0, 5), lo = v[0], hi = v.at(-1);
      if (!v.length) return ring(note(back ? 5 : 7), t + 0.06, { gain: 0.03, decay: 0.35 });
      v.forEach((x, i) => ring(note(hi > lo ? 4 + Math.round(((x - lo) / (hi - lo)) * 6) : 7), t + 0.08 + i * 0.12, { gain: 0.03, decay: 0.3 }));
    },
    open: (t) => (hiss(t, { dur: 0.35, f: 500, f2: 1800, q: 0.7, gain: 0.05 }), [0, 2, 4, 5].forEach((k, i) => ring(note(k + 5), t + 0.1 + i * 0.12, { gain: 0.032, decay: 0.6 }))),
    // Ashore: a wave on the beach and a low gong.
    land: (t) => (hiss(t, { dur: 1.2, f: 700, f2: 300, q: 0.6, gain: 0.04 }), ring(note(-5), t, { gain: 0.06, decay: 1.6, partials: [1, 0.5, 0.25] }), ring(note(0), t + 0.15, { gain: 0.025, decay: 1.2 })),
    // Under: the water closes over (a sweep down) and bubbles rise; back up: the sweep the other way.
    under: (t) => {
      hiss(t, { dur: 0.7, f: 1800, f2: 250, q: 0.7, gain: 0.06 });
      for (let i = 0, at = t + 0.15; i < 7; i++, at += rand(0.04, 0.14)) ring(note(8 + Math.floor(rand(0, 6))), at, { gain: 0.018, decay: 0.05, glide: 1.7, partials: [1], pan: rand(-0.5, 0.5) });
    },
    surface: (t) => hiss(t, { dur: 0.6, f: 250, f2: 1800, q: 0.7, gain: 0.09 }),
  };

  let wanted = false, rest = 0;
  const heard = {};
  /** The whole layer up or down over about `s` seconds; once down, the context sleeps. */
  const fade = (to, s) => {
    const t = ctx.currentTime;
    level.gain.cancelScheduledValues(t);
    level.gain.setValueAtTime(level.gain.value, t);
    level.gain.setTargetAtTime(to, t, s / 3);
    clearTimeout(rest);
    if (to) return live && ctx.resume();
    if (live) rest = setTimeout(() => ctx.suspend(), s * 1000 + 100);
  };
  if (live) {
    setInterval(() => wanted && !document.hidden && ahead(), 1000);
    document.addEventListener("visibilitychange", () => wanted && (document.hidden ? fade(0, 0.4) : (fade(1, 1.5), ahead())));
  }
  const api = {
    on(s = 1.5) {
      wanted = true;
      fade(1, s);
      ahead();
    },
    off(s = 1.5) {
      wanted = false;
      fade(0, s);
    },
    /** The sea of a family of pages (BEDS), or none (null); its waves change as they come in. */
    bed(name) {
      const t = ctx.currentTime, b = BEDS[name];
      family = name;
      bed.gain.setTargetAtTime(b ? 1 : 0, t, 0.5);
      if (b) voices.forEach((v) => v.o.frequency.setTargetAtTime(note(v.k + b.drone), t, 0.8));
      api.dive(0, true);
    },
    /** How far the hero's dive has gone (0 above water, 1 the chart from above): the water closes, the sea sinks. */
    dive(p, quiet = false) {
      const t = ctx.currentTime;
      water.frequency.setTargetAtTime(3500 * (220 / 3500) ** p, t, 0.08);  // an octave closed every quarter of the way
      water.Q.setTargetAtTime(0.5 + 2.5 * p, t, 0.1);
      voices.forEach((v) => v.o.detune.setTargetAtTime(v.cents - 240 * p, t, 0.15));
      layers.forEach((w) => w.src.playbackRate.setTargetAtTime(w.rate * (1 - 0.3 * p), t, 0.15));
      if (!quiet && (depth < 0.5) !== (p < 0.5)) api.play(p >= 0.5 ? "under" : "surface");
      depth = p;
    },
    /** One of the sounds above; the same sound twice within 60 ms is heard once. */
    play(name, ...args) {
      const t = ctx.currentTime + 0.01;
      if (!FX[name] || t - (heard[name] ?? -1) < 0.06) return;
      heard[name] = t;
      FX[name](t, ...args);
    },
    ahead,
    names: Object.keys(FX),
  };
  return api;
}
