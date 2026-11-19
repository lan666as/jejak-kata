// The night sea, heard: a quiet bed and a few short sounds for what the site does, all made here with the Web Audio
// API (no files, no samples). Fetched only once the reader turns sound on (app.js), and handed the AudioContext made
// in that press. It borrows from Javanese and Balinese gamelan (two of its tunings, the bronze of its metallophones and
// gongs, and its colotomic form, where gongs of different sizes mark the points of a cycle) and from the plucked
// strings of the sasando (Rote) and the kacapi (Sunda). It is a synthesised sound, not gamelan, and it speaks for no
// more of the archipelago than that. The bed is surf on a slow swell whose period never repeats, a low drone and, now
// and then, two or three far notes of a gender or a bonang, all under one lowpass (the water) that the hero's dive
// closes. Each family of pages hears its own sea by a few numbers (BEDS). A story is one gong cycle: each step a
// kenong or a kempul stroke, each new scene a gong suwukan, the landing the gong ageng. Above water every pitch is of
// slendro, under it of pelog. Everything goes through one gain (on, off, a hidden tab: fades) and a compressor, and
// stays far below full scale: tests/site/sound.mjs renders it offline and measures it.

const ROOT = 146.83; // D3
// Two scales on D, five notes each, in cents over the root. Slendro: five near-equal steps, idealised here as equal
// (240 cents). Pelog: tones 1 2 3 5 6 of the seven (those of pathet lima and nem), the average of the 20 pelog saron
// sets of Central Java measured by Surjodiningrat, Sudarjana and Susanto (1972). Each real gamelan has its own tuning.
const SLENDRO = [0, 240, 480, 720, 960], PELOG = [0, 119, 255, 672, 784];
// Partials of bronze, inharmonic, each [ratio, strength, how long it lasts against the fundamental]. A bar (gender,
// saron) rings like a free bar: 1, 2.76, 5.40, 8.93. A knobbed gong (bonang, kenong, kempul, gong) has a strong
// fundamental, partials a little off 2 and 3, and a high clang that is gone at once.
const BAR = [[1, 1, 1], [2.76, 0.3, 0.35], [5.4, 0.12, 0.18], [8.93, 0.05, 0.1]];
const KNOB = [[1, 1, 1], [2.02, 0.32, 0.55], [2.97, 0.18, 0.35], [4.37, 0.08, 0.08], [6.1, 0.04, 0.05]];
const SINE = [[1, 1, 1]];
const LOUD = 0.5; // the whole layer's gain after the compressor
// Each family's sea: how high the waves run (waves) and how bright they break (bright), the drone's root (in degrees
// from the scale's), how many seconds pass between far phrases on average (bells), and how wide the waves stand (wide).
const BEDS = {
  home: { waves: 1, bright: 1, drone: 0, bells: 16, wide: 0.7 },  // the hero: open water, a far phrase now and then
  story: { waves: 0.55, bright: 0.6, drone: -1, bells: 34, wide: 0.35 },  // the stage: further off, lower, sparer
  map: { waves: 0.75, bright: 0.85, drone: 1, bells: 11, wide: 0.9 },  // the map: wide, and more lights heard
  word: { waves: 0.65, bright: 0.75, drone: 1, bells: 24, wide: 0.5 },
  rest: { waves: 0.5, bright: 0.65, drone: 0, bells: 40, wide: 0.4 },
};
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
  let scale = SLENDRO;
  /** Degree k of the scale now heard (0 is the root; 5 an octave up). */
  const note = (k) => ROOT * 2 ** (Math.floor(k / 5) + scale[((k % 5) + 5) % 5] / 1200);

  // ---- voices: a struck tone, a plucked string, a hiss -----------------------------------------------------------
  /** A tone at f from time t: struck with a soft mallet (attack, no click), held (hold), each partial dying away on its
   *  own (decay, the fundamental's time constant), gliding to f * glide as it dies, placed left to right (pan). With
   *  `beat`, the fundamental is a pair of voices `beat` Hz apart, as the paired instruments of Balinese gamelan are
   *  (ngumbang and ngisep): their beating is the slow shimmer, on a gong the ombak (the wave). */
  const ring = (f, t, { gain = 0.05, attack = 0.008, hold = 0, decay = 1, glide = 1, pan = 0, partials = SINE, beat = 0, to = fx } = {}) => {
    const env = ctx.createGain(), place = ctx.createStereoPanner(), end = t + attack + hold + decay * 6;
    env.gain.value = 0;  // not 1 for the first frame (Chromium)
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    place.pan.value = pan;
    env.connect(place).connect(to);
    partials.forEach(([r, a, d], i) => (i || !beat ? [[f * r, a]] : [[f, a * 0.65], [f + beat, a * 0.35]]).forEach(([hz, a2]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(hz, t);
      if (glide !== 1) o.frequency.exponentialRampToValueAtTime(hz * glide, t + attack + hold + decay);
      g.gain.setValueAtTime(a2, t);
      g.gain.setTargetAtTime(0, t + attack + hold, decay * d);
      o.connect(g).connect(env);
      o.start(t);
      o.stop(end);
    }));
  };
  // A plucked string (Karplus-Strong): a burst of noise round a loop one period long, each pass averaged (the highs go
  // first) and a little lost, so it rings bright and dies within a second. The loop's fraction of a sample is read
  // between two (it tunes the string; a source played at another rate starts with a spike in Chromium). One per pitch.
  const strings = new Map();
  const pluck = (f, t, { gain = 0.03, pan = 0 } = {}) => {
    const rate = ctx.sampleRate, d = rate / f - 0.5, n = Math.floor(d), a = d - n, key = f.toFixed(2);
    if (!strings.has(key)) {
      const b = ctx.createBuffer(1, Math.round(rate * 0.9), rate), y = b.getChannelData(0), loss = 0.001 ** (d / (0.7 * rate));
      let mean = 0;
      for (let i = 0; i < n; i++) mean += (y[i] = Math.random() * 2 - 1) / n;
      for (let i = 0; i < n; i++) y[i] -= mean;
      for (let i = n; i < y.length; i++) y[i] = loss * 0.5 * ((1 - a) * y[i - n] + (y[i - n - 1] || 0) + a * (y[i - n - 2] || 0));
      strings.set(key, b);
    }
    const src = ctx.createBufferSource(), env = ctx.createGain(), place = ctx.createStereoPanner();
    src.buffer = strings.get(key);
    env.gain.value = 0;  // not 1 for the first frame (Chromium)
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.002);
    place.pan.value = pan;
    src.connect(env).connect(place).connect(fx);
    src.start(t);
    src.stop(t + 0.92);
  };
  /** A breath of noise through a band that moves from f to f2 over dur: a click when short, a swish when long. */
  const hiss = (t, { dur = 0.02, f = 2500, f2 = f, q = 1.2, gain = 0.05, pan = 0 } = {}) => {
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), env = ctx.createGain(), place = ctx.createStereoPanner();
    src.buffer = noise;
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.setValueAtTime(f, t);
    band.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env.gain.value = 0;  // not 1 for the first frame (Chromium)
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
  // Two lines of surf, one to each side and not alike: each a body of noise through a lowpass that opens as the wave
  // rises, and the foam, a brighter hiss that flares as the wave breaks at its crest and runs out after it.
  const layers = [-1, 1].map((side, i) => {
    const src = ctx.createBufferSource(), tone = ctx.createBiquadFilter(), swell = ctx.createGain(), place = ctx.createStereoPanner();
    const foam = ctx.createBufferSource(), fizz = ctx.createBiquadFilter(), spray = ctx.createGain();
    for (const s of [src, foam]) (s.buffer = noise), (s.loop = true);
    src.playbackRate.value = i ? 1.03 : 0.97;
    tone.type = "lowpass";
    tone.frequency.value = 300;
    tone.Q.value = 0.3;
    swell.gain.value = 0.02;
    fizz.type = "highpass";
    fizz.frequency.value = i ? 2900 : 2300;
    spray.gain.value = 0;
    src.connect(tone).connect(swell).connect(place).connect(water);
    foam.connect(fizz).connect(spray).connect(place);
    src.start(0, i * 3.1);
    foam.start(0, 1.7 + i * 2.3);
    return { src, tone, swell, spray, place, side, rate: src.playbackRate.value, next: ctx.currentTime + i * rand(1.5, 3.5) };
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
    return { o, k };
  });
  breath.frequency.value = 0.043;
  breadth.gain.value = 0.004;
  breath.connect(breadth).connect(drone.gain);
  breath.start();

  let family = null, depth = 0, bell = ctx.currentTime + rand(4, 9), count = 0;
  /** The drone on the scale now heard: under water a degree lower (it sinks). */
  const retune = () => voices.forEach((v) => v.o.frequency.setTargetAtTime(note(v.k + (BEDS[family]?.drone || 0) - (depth >= 0.5)), ctx.currentTime, 0.8));
  /** The waves and far phrases from now until `to` (seconds on the context's clock), each wave its own height and length. */
  const ahead = (to = ctx.currentTime + 4) => {
    const b = BEDS[family] || BEDS.rest;
    for (const w of layers) for (w.next = Math.max(w.next, ctx.currentTime); w.next < to; ) {
      const t = w.next, period = rand(5.5, 12), crest = t + period * rand(0.3, 0.45), height = rand(0.35, 1) * b.waves;
      w.swell.gain.setTargetAtTime(0.035 + 0.27 * height, t, (crest - t) / 2.5);
      w.swell.gain.setTargetAtTime(0.03, crest, (t + period - crest) / 3);
      w.tone.frequency.setTargetAtTime((350 + 1500 * height) * b.bright, t, (crest - t) / 2);
      w.tone.frequency.setTargetAtTime(260 * b.bright + 40, crest, (t + period - crest) / 3);
      w.spray.gain.setTargetAtTime(0.022 * height * b.bright, crest - 0.25, 0.1);  // it breaks
      w.spray.gain.setTargetAtTime(0, crest + 0.15, period * 0.09);  // and runs up the sand
      w.place.pan.setTargetAtTime(w.side * b.wide * rand(0.4, 1), t, period / 3);
      w.next = t + period * rand(0.75, 1);  // the next comes in before this one has quite gone
    }
    // Far off, two or three notes of a gender (bars) or a bonang (knobbed gongs), wandering: never the same phrase.
    for (bell = Math.max(bell, ctx.currentTime); bell < to; bell += Math.max(6, -Math.log(1 - Math.random()) * b.bells)) {
      const pan = rand(-0.8, 0.8), g = rand(0.5, 1), bonang = Math.random() < 0.4, n = Math.random() < 0.4 ? 3 : 2;
      for (let i = 0, k = 5 + Math.floor(rand(0, 6)), at = bell; i < n; i++, k += [-2, -1, 1, 2][Math.floor(rand(0, 4))], at += rand(0.35, 0.9))
        ring(note(k), at, { gain: 0.016 * g * (1 - 0.2 * i), decay: bonang ? 0.8 : 1.3, partials: bonang ? KNOB : BAR, beat: 4, pan, to: water });
    }
  };

  // ---- what the site does ---------------------------------------------------------------------------------------
  // A story is a gong cycle. Step j forward: odd steps a kenong (degrees 5, 6, 7 in turn), even ones a kempul
  // (degrees 1, 2, 3), so no two steps in a row are one pitch; back: the same stroke, soft and damped by the hand.
  const marker = (j) => note(j % 2 ? 5 + ((j >> 1) % 3) : 1 + (((j >> 1) + 2) % 3));
  const FX = {
    on: (t) => ring(note(5), t, { gain: 0.04, decay: 1.2, partials: BAR, beat: 4 }),
    hover: (t) => hiss(t, { dur: 0.008, f: 5000, q: 3, gain: 0.02 }),
    press: (t) => (hiss(t, { dur: 0.02, f: 1800, q: 1.5, gain: 0.05 }), ring(note(0), t, { gain: 0.02, attack: 0.003, decay: 0.04, partials: KNOB.slice(0, 2) })),
    tick: (t) => (hiss(t, { dur: 0.015, f: 3500, q: 2, gain: 0.035 }), ring(note(15), t, { gain: 0.012, attack: 0.003, decay: 0.06, partials: KNOB.slice(0, 2) })),
    light: (t) => (ring(note(12), t, { gain: 0.03, decay: 0.7, partials: KNOB, beat: 4 }), ring(note(17), t + 0.07, { gain: 0.01, decay: 0.5, partials: BAR })),
    sheet: (t) => (hiss(t, { dur: 0.25, f: 600, f2: 2000, q: 0.9, gain: 0.07 }), ring(note(9), t + 0.12, { gain: 0.015, decay: 0.3, partials: BAR })),
    right: (t) => (ring(note(7), t, { gain: 0.035, decay: 0.5, partials: BAR }), ring(note(10), t + 0.13, { gain: 0.035, decay: 0.9, partials: BAR, beat: 4 })),
    wrong: (t) => (ring(note(3), t, { gain: 0.03, decay: 0.25, partials: BAR.slice(0, 2) }), ring(note(2), t + 0.16, { gain: 0.028, decay: 0.3, partials: BAR.slice(0, 2) })),
    // The words come on: a soft low gong, and a few lights, plucked, coming on across the sea.
    arrive: (t) => {
      ring(note(-5), t, { gain: 0.03, attack: 0.03, decay: 2, partials: KNOB, beat: 2.5 });
      for (let i = 0; i < 7; i++) pluck(note(10 + Math.floor(rand(0, 5))), t + rand(0.4, 2.6), { gain: 0.014, pan: rand(-0.9, 0.9) });
    },
    // A route sailed: a low tone rising under it, and a plucked string at each port (year), from left to right, rising.
    route: (t, ports = 14, ms = 1800) => {
      const s = ms / 1000, n = Math.max(1, ports);
      if (!s) return pluck(note(10), t, { gain: 0.035 });
      ring(note(-2), t, { gain: 0.016, attack: Math.min(0.4, s / 3), hold: s, decay: 0.4, glide: 2 ** (7 / 5), partials: [[1, 1, 1], [2, 0.15, 1]] });
      for (let i = 0; i < n; i++) pluck(note(3 + Math.round((i * 7) / Math.max(1, n - 1))), t + (i * s) / Math.max(1, n - 1), { gain: 0.035, pan: n > 1 ? -0.5 + i / (n - 1) : 0 });
    },
    // A story's step j (app.js): its stroke; then its numbers on a gender, low to high (the ones the caption names, on
    // the beacon), each pitched by where it lies between the lowest and the highest.
    step: (t, back = false, values = [], j = back ? Math.max(0, --count) : ++count) => {
      count = j;
      if (back) ring(marker(j), t, { gain: 0.016, attack: 0.012, decay: 0.15, partials: KNOB.slice(0, 2) });
      else ring(marker(j), t, { gain: j % 2 ? 0.03 : 0.036, attack: 0.012, decay: j % 2 ? 0.9 : 1.6, partials: KNOB, beat: 3 });
      const v = (values || []).filter(Number.isFinite).sort((a, b) => a - b).slice(0, 5), lo = v[0], hi = v.at(-1);
      v.forEach((x, i) => ring(note(hi > lo ? 9 + Math.round(((x - lo) / (hi - lo)) * 6) : 12), t + 0.25 + i * 0.14, { gain: back ? 0.012 : 0.022, decay: 0.45, partials: BAR }));
    },
    // A new scene (k): a gong suwukan; back into the scene before: the same, damped.
    scene: (t, k = 0, back = false) => {
      count = 0;
      if (back) return ring(note(-3), t, { gain: 0.022, attack: 0.02, decay: 0.3, partials: KNOB.slice(0, 3) });
      ring(note(-3), t, { gain: 0.045, attack: 0.02, decay: 2.2, partials: KNOB, beat: 2.5 });
    },
    open: (t) => (hiss(t, { dur: 0.35, f: 500, f2: 1800, q: 0.7, gain: 0.04 }), [7, 10].forEach((k, i) => ring(note(k), t + 0.1 + i * 0.16, { gain: 0.022, decay: 0.6, partials: KNOB }))),
    // Ashore, the end of the cycle: a wave on the beach and the gong ageng, low and long, its ombak beating twice a second.
    land: (t) => (hiss(t, { dur: 1.2, f: 700, f2: 300, q: 0.6, gain: 0.03 }), ring(note(-7), t, { gain: 0.05, attack: 0.03, decay: 4, partials: KNOB, beat: 2 })),
    // Under: the water closes over (a sweep down) and bubbles rise; back up: the sweep the other way.
    under: (t) => {
      hiss(t, { dur: 0.7, f: 1800, f2: 250, q: 0.7, gain: 0.06 });
      for (let i = 0, at = t + 0.15; i < 7; i++, at += rand(0.04, 0.14)) ring(note(8 + Math.floor(rand(0, 6))), at, { gain: 0.018, attack: 0.005, decay: 0.05, glide: 1.7, pan: rand(-0.5, 0.5) });
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
      family = name;
      bed.gain.setTargetAtTime(BEDS[name] ? 1 : 0, ctx.currentTime, 0.5);
      api.dive(0, true);
      retune();
    },
    /** How far the hero's dive has gone (0 above water, 1 the chart from above): the water closes, the sea sinks, and
     *  from halfway down every note is of pelog, coming back up of slendro again. */
    dive(p, quiet = false) {
      const t = ctx.currentTime, crossed = (depth < 0.5) !== (p < 0.5);
      depth = p;
      scale = p >= 0.5 ? PELOG : SLENDRO;
      water.frequency.setTargetAtTime(3500 * (220 / 3500) ** p, t, 0.08);  // an octave closed every quarter of the way
      water.Q.setTargetAtTime(0.5 + 2.5 * p, t, 0.1);
      layers.forEach((w) => w.src.playbackRate.setTargetAtTime(w.rate * (1 - 0.3 * p), t, 0.15));
      if (crossed) retune();
      if (crossed && !quiet) api.play(p >= 0.5 ? "under" : "surface");
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
