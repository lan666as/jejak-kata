// The night sea: the chart of words in WebGL2, seen across the water at a low angle (the home page's hero).
// Every point of light is a word of the chart, where the chart puts it. A word floats as high above the water as it
// moved (its shift, the number that also makes it brighter), and is as large as it is common; under it lies its
// reflection. The graticule is the chart's own, every 125 units, lying on the water. A chosen word's route is a ribbon
// on the water, sailed by a ship light. As the reader scrolls out of the hero (`dive`), the camera pitches down to a
// chart seen from above, the lights settle onto the water and the night turns into the paper of the page below.
// Same interface as the night chart of chart.js (routes, time, frame, inset, more, drawn, tilt), which stands in for
// it where WebGL2 is not there. Colours, the curve and the leg come from the page's tokens.
// Three ways to be on a page: the home hero (the swell, the arrival, the dive), held (one frame, drawn again only when
// something changes: behind a page head, a story's cover, the footer) and `explore` (the map: dragged, turned, tilted
// and zoomed by the reader, up to four routes, and drawn only while something moves).

const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the six levels, as in app.js
const NEAR = 1500; // the most frequent words are lit and can be named; the rest are the faint tail
const RISE = 0.0042; // height above the water per unit of shift (the chart is about 2 units across)
const GRID = 0.125; // the graticule: a line every 125 chart units, as the 2D chart draws it
// The quality ladder. A sea that moves starts on the top rung; each rung below gives up one more thing, the least seen
// first: a quarter of the pixels, then the reflections, then more pixels and the faint tail of words past the lit ones
// (`tail`: the part of it kept), then the swell (the sea then holds still between the reader's moves). The rung is set
// by the time frames take while the sea is drawn every frame, judged a quarter of a second at a time: one rung down
// while the median frame takes longer than BUDGET, and never back up. So it settles within about a second, four
// quarters at most, and never goes back and forth. The device pixel ratio is capped at 1.5 on every rung.
const LADDER = [
  { scale: 1, reflections: true, tail: 1, swell: true },
  { scale: 0.75, reflections: true, tail: 1, swell: true },
  { scale: 0.75, reflections: false, tail: 1, swell: true },
  { scale: 0.6, reflections: false, tail: 0.35, swell: true },
  { scale: 0.5, reflections: false, tail: 0.35, swell: false },
];
const BUDGET = 24; // ms: slower than about 40 frames a second

const root = () => getComputedStyle(document.documentElement);
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ink = document.createElement("canvas").getContext("2d");
/** A colour token as [r, g, b] in 0..1, whatever form the stylesheet gives it in. */
const rgb = (name) => {
  ink.fillStyle = "#000";
  ink.fillStyle = root().getPropertyValue(name).trim() || "#000";
  const c = ink.fillStyle;
  return c[0] === "#" ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : c.match(/[\d.]+/g).slice(0, 3).map((v) => v / 255);
};
/** The site's one curve (--sail), as a function of time 0..1. */
function curve() {
  const [x1, y1, x2, y2] = (root().getPropertyValue("--sail").match(/[\d.]+/g) || [0.45, 0.05, 0.25, 1]).map(Number);
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) t -= (at(x1, x2, t) - x) / (3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t || 1);
    return at(y1, y2, Math.min(1, Math.max(0, t)));
  };
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// A route's colour at night, from its colour by day (as chart.js draws routes on the deep).
const ON_DEEP = { "--route": "--route-on-deep", "--ink": "--on-deep", "--ink-3": "--on-deep-2" };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- shaders ----------------------------------------------------------------------------------------------------
// One camera for every program, without matrices: eye, its right, up and forward, and the lens (1/tan per axis and
// the screen point the camera looks at, in clip units, so that the route can sit beside the hero's text). `settle`
// is how far the dive has gone (the lights sink onto the water); `tide`, how far the paper has risen up the screen:
// `dayAt` is 1 below the tide line, where the night has become the chart, and 0 above it.
const CAMERA = `uniform vec3 eye, R, U, F; uniform vec4 lens; uniform float tide, settle, dpr;
vec4 clip(vec3 w) { vec3 d = w - eye; float z = dot(d, F); return vec4(dot(d, R) * lens.x + lens.z * z, dot(d, U) * lens.y + lens.w * z, 0., z); }
float edge(float x) { return mix(-1.3, 1.3, tide) + .035 * sin(x * 4.1 + 1.3) + .018 * sin(x * 9.7); }
float dayAt(vec2 p) { return 1. - smoothstep(edge(p.x) - .025, edge(p.x) + .025, p.y); }`;
const WATER = [`#version 300 es
in vec2 a; out vec2 v; void main() { v = a; gl_Position = vec4(a, 0., 1.); }`, `#version 300 es
precision highp float;
${CAMERA}
uniform float time, fogNear, fogFar;
uniform vec3 deep, deep2, haze, grid, paper, paperGrid;
in vec2 v; out vec4 o;
void main() {
  vec3 ray = normalize(F + R * ((v.x - lens.z) / lens.x) + U * ((v.y - lens.w) / lens.y));
  float below = step(ray.y, -1e-5), t = below > .5 ? min(-eye.y / ray.y, 1e3) : 1e3;
  vec2 q = eye.xz + ray.xz * t;
  // The swell: a few long waves; their slope tilts the surface towards the sky's glow at grazing angles.
  vec2 k1 = vec2(19., 7.), k2 = vec2(-9., 27.), k3 = vec2(41., 33.);
  vec2 slope = k1 * cos(dot(q, k1) + time * .55) * .010 + k2 * cos(dot(q, k2) - time * .7) * .006 + k3 * cos(dot(q, k3) + time * 1.2) * .0018;
  vec3 n = normalize(vec3(-slope.x, 1., -slope.y));
  float fresnel = pow(1. - max(dot(-ray, n), 0.), 4.);
  vec3 sea = mix(deep, deep2, .35 + .65 * fresnel) + haze * pow(max(dot(reflect(ray, n), normalize(vec3(0., .16, -1.))), 0.), 24.) * .22;
  // The graticule, in the chart's units, softened where its lines get thinner than a pixel.
  vec2 g = q / ${GRID.toFixed(3)}, w = fwidth(g), l = abs(fract(g - .5) - .5) / max(w, 1e-4);
  float line = (1. - min(min(l.x, l.y), 1.)) * (1. - smoothstep(.25, .7, max(w.x, w.y))) * below;
  sea = mix(sea, grid, line * .6);
  vec3 sky = mix(haze, deep, smoothstep(0., .4, ray.y));
  vec3 night = mix(mix(sea, haze, smoothstep(fogNear, fogFar, t)), sky, 1. - below);
  // Above the tide line the night; below it the paper; on the line a thin light, like foam.
  float foam = exp(-pow((v.y - edge(v.x) - .03) / .006, 2.)) * .3 * step(.001, tide) * step(tide, .999);
  o = vec4(mix(mix(night, mix(paper, paperGrid, line * .5), dayAt(v)), paper, foam), 1.);
}`];
// A word: its light (mirror 1) or its reflection on the water (mirror -1).
const LIGHTS = [`#version 300 es
${CAMERA}
in vec4 word; // x, z, shift (-1 when not measured), rank by frequency
uniform float mirror, ref, rise, quiet, fogNear, fogFar, time, maxSize, reach, head, tailIn;
uniform vec2 origin;
uniform vec3 lights[6], dots[6];
out vec3 colour; out float alpha, glow;
void main() {
  float shift = max(word.z, 0.), level = step(2., shift) + step(4., shift) + step(7., shift) + step(12., shift) + step(20., shift);
  float h = word.z < 0. ? 0. : shift * rise * (1. - settle);
  gl_Position = clip(vec3(word.x, mirror * h, word.y));
  float day = dayAt(gl_Position.xy / gl_Position.w);
  bool lit = word.w < ${NEAR}.;
  float night = lit ? (word.w < 300. ? 13. : word.w < 800. ? 10. : 8.) * (.75 + .22 * level) : 3.2;
  float paper = word.w < 400. ? 6. : word.w < 4000. ? 4.2 : 3.;
  float size = mix(night * clamp(ref / max(gl_Position.w, 1e-3), .35, 2.2), paper, day) * dpr;
  if (mirror < 0.) size *= 1.9;
  gl_PointSize = clamp(size, 1., maxSize);
  int i = int(level);
  colour = mix(lights[i], dots[i], day);
  float fog = 1. - smoothstep(fogNear, fogFar, gl_Position.w);
  alpha = mix((lit ? .45 + .11 * level : .3 + .12 * level) * quiet * fog, level < .5 ? .3 : 1., day);
  glow = 1. - day;
  // The arrival: a word is lit once the front, spreading from the first route's word, has passed it, with a brief
  // flare as it does; the words that came after the first batch (head) fade in as they come.
  float d = distance(word.xy, origin), on = smoothstep(reach, reach - .06, d), flare = exp(-pow((reach - d) / .05, 2.)) * (1. - day);
  if (word.w >= head) on *= tailIn;
  alpha = (alpha + flare * .5) * on;
  gl_PointSize = clamp(gl_PointSize * (1. + flare * .6), 1., maxSize);
  if (mirror < 0.) alpha *= .22 * (1. - day) * (1. - settle) * (.7 + .3 * sin(time * 1.7 + word.w * .37 + word.x * 13.));
}`, `#version 300 es
precision highp float;
uniform float mirror;
in vec3 colour; in float alpha, glow; out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2. - 1.;
  float r = length(c), a;
  if (mirror < 0.) a = exp(-c.x * c.x * 42.) * exp(-pow(c.y * 1.6, 2.));  // a short streak on the water
  else a = mix(smoothstep(1., .7, r), smoothstep(.3, .18, r) + .45 * exp(-r * r * 5.), glow);  // a dot on paper, a light at night
  a *= alpha;
  o = vec4(colour * a, a * (1. - glow));  // premultiplied: added to the night, laid over the paper
}`];
// The route: a ribbon on the water, its width kept in pixels; drawn as far as the ship has sailed.
const RIBBON = [`#version 300 es
${CAMERA}
in vec4 at; in vec2 side; // at: x, z and the next point's x, z; side: -1 or 1, and the distance along the route
uniform vec2 view; uniform float width;
out float s, along, day;
void main() {
  vec4 p = clip(vec3(at.x, .0015, at.y)), q = clip(vec3(at.z, .0015, at.w));
  vec2 d = (q.xy / q.w - p.xy / p.w) * view, n = normalize(vec2(-d.y, d.x) + 1e-6);
  day = dayAt(p.xy / p.w);
  p.xy += n * side.x * mix(width, 4.5, day) * dpr / view * p.w;
  gl_Position = p; s = side.x; along = side.y;
}`, `#version 300 es
precision highp float;
uniform float sailed; uniform vec3 colour, colourDay, paper;
in float s, along, day; out vec4 o;
void main() {
  if (along > sailed) discard;
  // At night a line of light with its glow; by day a line in the route's colour, cased in paper (as chart.js draws it).
  float x = abs(s), a = mix(smoothstep(.24, .12, x) + .5 * exp(-x * x * 7.), smoothstep(1., .8, x), day);
  o = vec4(mix(colour, mix(colourDay, paper, smoothstep(.4, .5, x)), day) * a, a * day);
}`];
// The ship and the ports it has passed: a light (by day a dot ringed in paper), the ports as small dots.
const MARKS = [`#version 300 es
${CAMERA}
in vec4 mark; // x, z, size in pixels, kind (0 a port, 1 the ship, 2 the ship's reflection)
uniform float maxSize; out float kind, day;
void main() {
  gl_Position = clip(vec3(mark.x, mark.w > 1.5 ? -.004 : .002, mark.y));
  day = dayAt(gl_Position.xy / gl_Position.w);
  gl_PointSize = clamp(mark.z * dpr * (mark.w > 1.5 ? 2.2 : mark.w > .5 ? mix(1., .6, day) : 1.), 1., maxSize);
  kind = mark.w;
}`, `#version 300 es
precision highp float;
uniform vec3 colour, colourDay, light, paper; in float kind, day; out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2. - 1.; float r = length(c);
  vec3 col = mix(colour, colourDay, day); float a;
  if (kind > 1.5) a = exp(-c.x * c.x * 30.) * exp(-c.y * c.y * 1.8) * .5 * (1. - day);
  else if (kind > .5) {
    a = mix(smoothstep(.36, .3, r) + .7 * exp(-r * r * 6.), smoothstep(1., .9, r), day);
    col = mix(mix(col, light, smoothstep(.2, 0., r)), mix(col, paper, smoothstep(.6, .7, r)), day);
  }
  else a = smoothstep(1., .75, r);
  o = vec4(col * a, a * day);
}`];

/**
 * `chart`: {words, x, y, moved} as written by idhist.highlights; `name(id)`: the word; `pick(id)`: called on a click.
 * Returns null where WebGL2 cannot be had. Otherwise the node and: `routes(list)`, `time(p, ms)`, `frame(ids, ms)`,
 * `inset([top, right, bottom, left])`, `more(chart)`, `drawn()`, `tilt(x, y)` (pointer or device, -1..1), `dive(p)`
 * (0 at the top of the hero, 1 when the reader has scrolled out of it: seen from above, on paper), `still()` (draw one
 * frame and hold it), `describe(text)` (the canvas's text alternative), `end()` (let the GPU go).
 * `hold`: one frame, drawn again only when asked. `most`: carry at most this many words; `names`: name at most this
 * many (a quiet backdrop names few); `pitch`: how steeply a held sea is seen (a short band shows more of the chart
 * from higher). `look(to)` sets the camera of a sea with no route. `explore` (the map): the
 * reader moves the camera, with `controls` {in, out, all, turn, above, level} naming its buttons.
 */
export function nightSea({ chart, name, pick, periods, tip, label: alt = "", hold = false, most: carry = Infinity, names: named = Infinity, explore = false, controls = {}, pitch: tilted = null }) {
  const node = document.createElement("div");
  node.className = `chart night gl${explore ? " explore" : ""}`;
  const button = (k, text) => `<button type="button" data-k="${k}" aria-label="${controls[k] || text}" title="${controls[k] || text}">${text}</button>`;
  node.innerHTML = `<canvas ${explore ? `tabindex="0" role="application"` : `role="img"`} aria-label="${alt}"></canvas><canvas aria-hidden="true"></canvas>`
    + `<div class="when" aria-hidden="true" hidden><b></b><span class="when-bar"><i></i></span><span class="when-ends"><span>${periods[0]}</span><span>${periods.at(-1)}</span></span></div><div class="tally" aria-hidden="true" hidden></div>`
    + (explore ? `<div class="zoom">${button("in", "+")}${button("out", "−")}${button("all", "⤢")}${button("turn", "↻")}<button type="button" data-k="above" aria-pressed="false">${controls.above || "⬒"}</button></div>` : "");
  const [canvas, names, when, tally] = node.children, year = when.firstElementChild;
  const gl = canvas.getContext("webgl2", { antialias: false, depth: false, powerPreference: "low-power" });  // with alpha: an opaque WebGL canvas in a sticky box leaves holes in Chromium once the box scrolls on
  if (!gl) return null;
  const ctx = names.getContext("2d"), ease = curve(), LEG = parseFloat(root().getPropertyValue("--d-leg")) || 900;

  const program = ([vs, fs]) => {
    const p = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const where = new Map();
    p.u = (name) => (where.has(name) ? where.get(name) : where.set(name, gl.getUniformLocation(p, name)).get(name));
    return p;
  };
  const water = program(WATER), lights = program(LIGHTS), ribbon = program(RIBBON), marks = program(MARKS);
  /** A buffer laid out as named vec attributes, filled from a Float32Array. */
  const buffer = (p, layout) => {
    const vao = gl.createVertexArray(), b = gl.createBuffer(), stride = layout.reduce((s, [, n]) => s + n, 0) * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    let offset = 0;
    for (const [attr, n] of layout) {
      const at = gl.getAttribLocation(p, attr);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, n, gl.FLOAT, false, stride, offset);
      offset += n * 4;
    }
    gl.bindVertexArray(null);
    return { vao, fill: (data, usage = gl.STATIC_DRAW) => (gl.bindBuffer(gl.ARRAY_BUFFER, b), gl.bufferData(gl.ARRAY_BUFFER, data, usage)) };
  };
  const screen = buffer(water, [["a", 2]]);
  screen.fill(new Float32Array([-1, -1, 3, -1, -1, 3]));
  const words = buffer(lights, [["word", 4]]), ports = buffer(marks, [["mark", 4]]);
  const maxSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

  // The words: as many as the device can carry, the most frequent first (the chart is in that order).
  const most = Math.min(carry, innerWidth < 600 || (navigator.hardwareConcurrency || 4) <= 4 ? 7000 : 20000);
  // Up to four routes, each with its own ribbon: {id, colour (a token), legs (its ports), points, vertices, wake}.
  let n = 0, level = [], routes = [], now = 0, head = 0, tailAt = -1e9;
  const wakes = [0, 1, 2, 3].map(() => buffer(ribbon, [["at", 4], ["side", 2]]));
  // The arrival (`arrive`): where the front starts, how far it has spread, and the words it has lit so far.
  const arrival = { origin: [0, 0], reach: 99, start: 0, on: false, done: null, say: null, far: [] };
  const take = (next) => {
    chart = next;
    if (head) tailAt = performance.now();
    head ||= chart.words.length;
    n = Math.min(most, chart.words.length);
    const data = new Float32Array(n * 4);
    level = [];
    for (let k = 0; k < n; k++) {
      const m = chart.moved[k];
      data.set([chart.x[k] / 1000, chart.y[k] / 1000, m === null ? -1 : m, k], 4 * k);
      level.push(m === null ? 0 : STEPS.filter((s) => m >= s).length);
    }
    words.fill(data);
    arrival.far = Float32Array.from({ length: n }, (_, k) => Math.hypot(chart.x[k] / 1000 - arrival.origin[0], chart.y[k] / 1000 - arrival.origin[1])).sort();
  };
  take(chart);

  // ---- colours, sizes, the camera -------------------------------------------------------------------------------
  let colours = null;
  const palette = () => (colours ||= {
    deep: rgb("--deep"), deep2: rgb("--deep-2"), grid: rgb("--line-deep"), paper: rgb("--chart"), paperGrid: rgb("--line"),
    haze: rgb("--deep-2").map((c, i) => mix(c, rgb("--light-0")[i], 0.22)),
    lights: [0, 1, 2, 3, 4, 5].flatMap((i) => rgb(`--light-${i}`)), dots: [rgb("--ink-3"), ...[1, 2, 3, 4, 5].map((i) => rgb(`--seq-${i}`))].flat(),
    light: rgb("--on-deep"), routes: {},
    css: Object.fromEntries(["--on-deep", "--on-deep-2", "--deep-2", "--ink", "--ink-3", "--chart-2", "--route", "--route-on-deep", "--type"].map((k) => [k, root().getPropertyValue(k).trim()])),
  });
  /** A route's colours, by its token: at night (as rgb and as CSS) and by day. */
  const tint = (token) => (palette().routes[token] ||= { night: rgb(ON_DEEP[token] || token), day: rgb(token), css: [ON_DEEP[token] || token, token].map((k) => root().getPropertyValue(k).trim()) });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ((colours = null), ask()));

  let W = 0, H = 0, ratio = 1, rung = 0, calm = 0, wanted = null, pad = [0, 0, 0, 0], depth = 0, ready = false, waiting = [], held = hold || still();
  // Exploring: the word ringed for the keyboard (keyed), whether the reader has moved the camera, the rise to above.
  let ringed = -1, keyed = false, moved = false;
  const rising = { from: 0, to: null, start: 0 };
  // Where the camera looks (aim), as it glides there (from, to, start, ms), the ship it follows, and the nudge.
  // `aim.pitch` is the reader's (explore); the hero works its pitch out from where its text leaves the sea open.
  const aim = { x: 0, z: 0, dist: 1.6, yaw: 0, pitch: 0.42 }, glide = { from: null, to: null, start: 0, ms: 0 }, follow = { x: 0, z: 0 }, nudge = { x: 0, y: 0, to: [0, 0] };
  const cam = { eye: [0, 0, 0], R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1], lens: [1, 1, 0, 0], pitch: 0, ref: 1, fog: [1, 8] };
  const wide = () => W >= 900, fovOf = () => ((H > W ? 52 : 38) * Math.PI) / 180;
  /** The camera as it now stands, the dive (or, exploring, the view from above) and the nudge taken into account. */
  function place() {
    const e = ease(depth), t = Math.tan(fovOf() / 2), asp = W / H;
    // The open part of the hero, beside or above the text: the camera looks at its middle; the horizon lies above it.
    const [top, right, bottom, left] = pad, cx = ((left + (W - right)) / W - 1) * (1 - e), cy = (1 - (top + (H - bottom)) / H) * (1 - e);
    const horizon = wide() ? 0.5 : 0.86, low = explore ? aim.pitch : tilted ?? Math.max(0.15, Math.min(0.38, Math.atan((horizon - cy) * t)));
    const pitch = mix(low, Math.PI / 2 - 1e-3, e) - nudge.y * 0.035 * (1 - e);
    const yaw = (explore ? aim.yaw : mix(aim.yaw, 0, e)) + nudge.x * 0.07 * (1 - e);
    // From above: the hero shows the whole chart, as wide as the screen allows; the map keeps the reader's place.
    const over = 1.05 / t / Math.min(1, asp), tx = explore ? aim.x : mix(aim.x + follow.x, -0.04, e), tz = explore ? aim.z : mix(aim.z + follow.z, -0.03, e), dist = explore ? aim.dist : mix(aim.dist, over, e);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy_ = Math.cos(yaw), sy = Math.sin(yaw);
    cam.eye = [tx + dist * sy * cp, dist * sp, tz + dist * cy_ * cp];
    cam.F = [-sy * cp, -sp, -cy_ * cp];
    cam.R = [cy_, 0, -sy];
    cam.U = [-sy * sp, cp, -cy_ * sp];  // right × forward
    cam.lens = [1 / (t * asp), 1 / t, cx, cy];
    cam.pitch = pitch;
    cam.ref = dist;
    cam.fog = [dist * mix(1.1, 50, e), dist * mix(9, 80, e)];
  }
  /** World to CSS pixels, with the distance from the eye; null behind it. */
  function project(x, y, z) {
    const d = [x - cam.eye[0], y - cam.eye[1], z - cam.eye[2]], dot = (v) => d[0] * v[0] + d[1] * v[1] + d[2] * v[2], w = dot(cam.F);
    if (w < 0.01) return null;
    return [((dot(cam.R) * cam.lens[0]) / w + cam.lens[2] + 1) * W / 2, (1 - ((dot(cam.U) * cam.lens[1]) / w + cam.lens[3])) * H / 2, w];
  }

  // ---- the route ----------------------------------------------------------------------------------------------
  /** The ports of a route; with many periods each is averaged with its two neighbours on either side (chart.js). */
  function portsOf(list) {
    const raw = list.map((xy, p) => xy && { p, x: xy[0] / 1000, z: xy[1] / 1000 }).filter(Boolean), weights = raw.length > 6 ? [1, 2, 3, 2, 1] : [0, 0, 1, 0, 0];
    return raw.map((r, k) => {
      let [x, z, total] = [0, 0, 0];
      weights.forEach((w, j) => { const o = raw[k + j - 2]; if (o && w) [x, z, total] = [x + w * o.x, z + w * o.z, total + w]; });
      return { p: r.p, x: x / total, z: z / total };
    });
  }
  /** A route's ribbon along its ports, through a smooth curve; each port's distance along it is kept for the ship. */
  function lay(route, slot) {
    const legs = portsOf(route.route), points = [];
    legs.forEach((s, k) => {
      if (!k) return points.push({ x: s.x, z: s.z, k: 0 });
      const [a, b, c, d] = [legs[k - 2] || legs[k - 1], legs[k - 1], s, legs[k + 1] || s];
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, t2 = t * t, t3 = t2 * t, f = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        points.push({ x: f(a.x, b.x, c.x, d.x), z: f(a.z, b.z, c.z, d.z), k: k - 1 + t });
      }
    });
    let along = 0;
    const data = [];
    points.forEach((p, i) => {
      if (i) along += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      p.along = along;
      const next = points[i + 1] || (i ? { x: 2 * p.x - points[i - 1].x, z: 2 * p.z - points[i - 1].z } : p);
      for (const side of [-1, 1]) data.push(p.x, p.z, next.x, next.z, side, along);
    });
    wakes[slot].fill(new Float32Array(data));
    return { id: route.id, colour: route.color || "--route", legs, points, vertices: points.length > 1 ? points.length * 2 : 0, wake: wakes[slot] };
  }
  /** Where a route's ship is at time t (a period, possibly between two): on the curve, and how far along it. */
  function ship({ legs, points: pts }, t) {
    if (!pts?.length) return null;
    const k = Math.max(0, legs.findLastIndex((s) => s.p <= t)), next = legs[k + 1], f = next ? Math.max(0, Math.min(1, (t - legs[k].p) / (next.p - legs[k].p))) : 0;
    const i = Math.min(pts.length - 1, Math.round((k + f) * 12)), p = pts[i];
    return { x: p.x, z: p.z, along: p.along, done: k + f };
  }

  // ---- drawing --------------------------------------------------------------------------------------------------
  function size() {
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    [W, H, ratio] = [box.width, box.height, Math.min(1.5, devicePixelRatio || 1) * LADDER[rung].scale];
    const [w, h] = [Math.round(W * ratio), Math.round(H * ratio)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    const r = Math.min(2, devicePixelRatio || 1);
    if (names.width !== Math.round(W * r) || names.height !== Math.round(H * r)) [names.width, names.height] = [Math.round(W * r), Math.round(H * r)];
    ctx.setTransform(r, 0, 0, r, 0, 0);
    if (wanted) api.frame(...wanted);  // asked for before the sea had a size
    else if (!glide.to && !routes.length && !moved) frameAll();
    return true;
  }
  const tide = () => smooth(0.5, 1, depth), settle = () => smooth(0, 0.6, depth);
  /** Below the tide line (as the shaders draw it), at a point of the screen in CSS pixels: 1 on paper, 0 at night. */
  const dayAt = (px, py) => {
    const x = (px / W) * 2 - 1, edge = mix(-1.3, 1.3, tide()) + 0.035 * Math.sin(x * 4.1 + 1.3) + 0.018 * Math.sin(x * 9.7);
    return 1 - smooth(edge - 0.025, edge + 0.025, 1 - (py / H) * 2);
  };
  const camera = (p) => {
    gl.useProgram(p);
    gl.uniform3fv(p.u("eye"), cam.eye); gl.uniform3fv(p.u("R"), cam.R); gl.uniform3fv(p.u("U"), cam.U); gl.uniform3fv(p.u("F"), cam.F);
    gl.uniform4fv(p.u("lens"), cam.lens);
    gl.uniform1f(p.u("tide"), tide());
    gl.uniform1f(p.u("settle"), settle());
    gl.uniform1f(p.u("dpr"), ratio);
  };
  let started = performance.now(), labelsAt = "";
  function render(time) {
    const { reflections, tail, swell } = LADDER[rung], drawn = tail < 1 ? Math.min(n, Math.max(NEAR, Math.round(n * tail))) : n;
    const c = palette(), seconds = held || explore ? 12 : swell ? (time - started) / 1000 : calm;  // only the hero's sea swells
    place();
    if (explore) ringed = keyed ? nearest(W / 2, H / 2, Math.min(W, H) / 3) : -1;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    camera(water);
    gl.uniform1f(water.u("time"), seconds);
    gl.uniform1f(water.u("fogNear"), cam.fog[0]); gl.uniform1f(water.u("fogFar"), cam.fog[1]);
    for (const k of ["deep", "deep2", "haze", "grid", "paper", "paperGrid"]) gl.uniform3fv(water.u(k), c[k]);
    gl.bindVertexArray(screen.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Reflections first, then the route on the water, the lights above it, the ports and the ship.
    camera(lights);
    gl.uniform1f(lights.u("ref"), cam.ref); gl.uniform1f(lights.u("rise"), RISE); gl.uniform1f(lights.u("quiet"), routes.length ? 0.75 : 1);
    gl.uniform1f(lights.u("fogNear"), cam.fog[0]); gl.uniform1f(lights.u("fogFar"), cam.fog[1]); gl.uniform1f(lights.u("time"), seconds); gl.uniform1f(lights.u("maxSize"), maxSize);
    gl.uniform3fv(lights.u("lights"), c.lights); gl.uniform3fv(lights.u("dots"), c.dots);
    gl.uniform2fv(lights.u("origin"), arrival.origin); gl.uniform1f(lights.u("reach"), arrival.reach); gl.uniform1f(lights.u("head"), head);
    gl.uniform1f(lights.u("tailIn"), held ? 1 : Math.min(1, (time - tailAt) / 600));
    gl.bindVertexArray(words.vao);
    if (reflections && settle() < 0.99 && tide() < 0.99) (gl.uniform1f(lights.u("mirror"), -1), gl.drawArrays(gl.POINTS, 0, Math.min(n, NEAR)));
    // Each route's ship, where it has sailed to; the last route is drawn first, so that the first lies on top.
    const sailing = arrival.on ? [] : routes.map((r) => ({ r, here: ship(r, now) })).filter((s) => s.here).reverse();
    for (const { r, here } of sailing) {
      if (!r.vertices) continue;
      const col = tint(r.colour);
      camera(ribbon);
      gl.uniform2f(ribbon.u("view"), canvas.width / 2, canvas.height / 2);
      gl.uniform1f(ribbon.u("width"), routes.length > 1 ? 10 : 13); gl.uniform1f(ribbon.u("sailed"), here.along + 1e-4);
      gl.uniform3fv(ribbon.u("colour"), col.night); gl.uniform3fv(ribbon.u("colourDay"), col.day); gl.uniform3fv(ribbon.u("paper"), c.paper);
      gl.bindVertexArray(r.wake.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, r.vertices);
    }
    camera(lights);
    gl.uniform1f(lights.u("mirror"), 1);
    gl.bindVertexArray(words.vao);
    gl.drawArrays(gl.POINTS, 0, drawn);
    for (const { r, here } of sailing) {
      const list = r.legs.filter((s, k) => k <= Math.floor(here.done)).flatMap((s) => [s.x, s.z, 7, 0]), col = tint(r.colour);
      list.push(here.x, here.z, 26, 2, here.x, here.z, 30, 1);
      camera(marks);
      gl.uniform1f(marks.u("maxSize"), maxSize);
      for (const [k, v] of [["colour", col.night], ["colourDay", col.day], ["light", c.light], ["paper", c.paper]]) gl.uniform3fv(marks.u(k), v);
      ports.fill(new Float32Array(list), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(ports.vao);
      gl.drawArrays(gl.POINTS, 0, list.length / 4);
    }
    // The names, on their own canvas: drawn again only when the camera, the tide or a ship has moved.
    const key = [...cam.eye, cam.pitch, now, n, W, H, tide(), hovered, ringed, arrival.reach, colours === c, noteAlpha().toFixed(2)].map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join();
    if (key !== labelsAt) ((labelsAt = key), label(sailing.reverse()));
    // The year the ships are at, and how far through the years: it counts as they sail.
    const shown = routes.length ? periods[Math.round(now)] : "";
    if (year.textContent !== shown) ((year.textContent = shown), (when.hidden = !shown));
    when.style.setProperty("--at", (now / Math.max(1, periods.length - 1)).toFixed(3));
    if (!ready) (ready = true), waiting.splice(0).forEach((done) => done());
  }
  /** Each ship's name, and the first route's first port's year; then the names of the words that moved most among
   *  the frequent ones, as many as fit around them. Each in the colours of the night or of the paper, by the side of
   *  the tide. With several routes a ship's name carries a dot of its route's colour. */
  function label(sailing) {
    const { css } = palette(), fade = (w) => 1 - smooth(cam.fog[0], cam.fog[1], w), lift = RISE * (1 - settle());
    // Every name takes a box (with a margin) and no box overlaps another: a name that would touch one already written
    // is left out. A held sea names only in its open water, clear of the page's text.
    const taken = [], overlaps = (l, t, r, b) => taken.some((k) => l < k[2] && r > k[0] && t < k[3] && b > k[1]);
    const claim = (x, y, width, height = 16) => {
      const k = [x - 3, y - height / 2 - 2, x + width + 3, y + height / 2 + 2];
      if (overlaps(...k)) return false;
      taken.push(k);
      return true;
    };
    // Nothing is named under what lies over the sea: its buttons, the year, a hint, with a margin around them; nor,
    // in a held sea, outside its open water.
    const box = canvas.getBoundingClientRect(), keep = [...node.querySelectorAll(".zoom, .when, .sea-hint")].map((n) => n.getBoundingClientRect()).filter((r) => r.width && r.height)
      .map((r) => [r.left - box.left - 8, r.top - box.top - 8, r.right - box.left + 8, r.bottom - box.top + 8]);
    const open = held && !explore ? [pad[3], pad[0], W - pad[1], H - pad[2]] : [-1e9, -1e9, 1e9, 1e9];
    const clear = (x, y, width, height = 18) => x >= open[0] && x + width <= open[2] && y - height / 2 >= open[1] && y + height / 2 <= open[3]
      && !keep.some(([l, t, r, b]) => x < r && x + width > l && y + height / 2 > t && y - height / 2 < b);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    /** A name in a pill beside a point, to its left where its right is not clear; `dot` is the colour of its route,
     *  when there are several. */
    // A pill goes to the right of its point, or to its left, or a line above or below, wherever it touches no pill or
    // name already there (a leader ties it to its point when it moved off its line).
    const pill = (at, text, strong, dot) => {
      const paper = dayAt(...at) > 0.5, inset = dot ? 14 : 0;
      ctx.font = `800 ${strong ? 15 : 13}px ${css["--type"]}`;
      const width = ctx.measureText(text).width + inset, box = (x, y) => [x - 3, y - 15, x + width + 17, y + 15];
      const spots = [[at[0] + 14, at[1]], [at[0] - 28 - width, at[1]], [at[0] + 14, at[1] - 28], [at[0] + 14, at[1] + 28], [at[0] - 28 - width, at[1] - 28], [at[0] - 28 - width, at[1] + 28]];
      const [x, y] = spots.find(([x, y]) => clear(x, y, width + 14, 24) && !overlaps(...box(x, y))) || spots[0];
      taken.push(box(x, y));
      if (y !== at[1]) (ctx.beginPath(), ctx.moveTo(at[0], at[1]), ctx.lineTo(x < at[0] ? x + width + 14 : x, y), (ctx.strokeStyle = paper ? css["--ink-3"] : css["--on-deep-2"]), (ctx.lineWidth = 1), ctx.stroke());
      ctx.fillStyle = paper ? css["--chart-2"] : css["--deep-2"];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y - 12, width + 14, 24, 12) : ctx.rect(x, y - 12, width + 14, 24);
      ctx.fill();
      if (dot) (ctx.beginPath(), ctx.arc(x + 11, y, 4.5, 0, 7), (ctx.fillStyle = dot[paper ? 1 : 0]), ctx.fill());
      ctx.fillStyle = paper ? css[strong ? "--route" : "--ink"] : css["--on-deep"];
      ctx.fillText(text, x + 7 + inset, y + 1);
    };
    for (const { r, here } of sailing) {
      const at = project(here.x, 0, here.z);
      if (at) pill(at, name(r.id), true, routes.length > 1 && tint(r.colour).css);
    }
    const first = sailing[0]?.r, start = first?.legs.length > 1 && project(first.legs[0].x, 0, first.legs[0].z);
    ctx.font = `700 12px ${css["--type"]}`;
    const year = start && periods[first.legs[0].p], wide = year && ctx.measureText(year).width;
    if (start && start[0] + 9 + wide < W - 4 && clear(start[0] + 9, start[1] - 12, wide) && claim(start[0] + 9, start[1] - 12, wide)) {
      ctx.fillStyle = dayAt(...start) > 0.5 ? css["--route"] : css["--route-on-deep"];
      ctx.fillText(year, start[0] + 9, start[1] - 12);
    }
    note(sailing[0], taken, css);
    // Exploring, the word nearest the middle of the screen is ringed and named: Enter chooses it.
    const ring = ringed >= 0 && project(chart.x[ringed] / 1000, Math.max(0, chart.moved[ringed] ?? 0) * lift, chart.y[ringed] / 1000);
    if (ring) {
      ctx.beginPath(); ctx.arc(ring[0], ring[1], 10, 0, 7); ctx.strokeStyle = dayAt(...ring) > 0.5 ? css["--ink"] : css["--on-deep"]; ctx.lineWidth = 2; ctx.stroke();
      pill([ring[0] + 2, ring[1] - 18], name(chart.words[ringed]), false);
    }
    ctx.font = `500 12px ${css["--type"]}`;
    let written = 0;
    const ids = new Set(routes.map((r) => r.id));
    for (let k = 0; k < Math.min(n, NEAR) && written < Math.min(named, W < 600 ? 14 : explore ? 44 : 30); k++) {
      if (level[k] < 2 || ids.has(chart.words[k]) || k === ringed || Math.hypot(chart.x[k] / 1000 - arrival.origin[0], chart.y[k] / 1000 - arrival.origin[1]) > arrival.reach - 0.03) continue;
      const p = project(chart.x[k] / 1000, Math.max(0, chart.moved[k]) * lift, chart.y[k] / 1000);
      if (!p || p[0] < 0 || p[1] < 8 || p[0] > W - 40 || p[1] > H - 8 || fade(p[2]) < 0.3) continue;
      const text = name(chart.words[k]), wide = text && ctx.measureText(text).width;
      if (!text || p[0] + 8 + wide > W - 4 || !clear(p[0] + 8, p[1], wide) || !claim(p[0] + 8, p[1], wide, 14)) continue;
      const paper = dayAt(...p) > 0.5;
      ctx.fillStyle = paper ? css["--ink-3"] : css["--on-deep-2"];
      ctx.globalAlpha = paper ? 1 : (routes.length ? 0.6 : 0.82) * fade(p[2]);
      ctx.fillText(text, p[0] + 8, p[1]);
      written++;
    }
    ctx.globalAlpha = 1;
    const p = hovered >= 0 && project(chart.x[hovered] / 1000, Math.max(0, chart.moved[hovered]) * lift, chart.y[hovered] / 1000);
    if (p) (ctx.beginPath(), ctx.arc(p[0], p[1], 8, 0, 7), (ctx.strokeStyle = dayAt(...p) > 0.5 ? css["--ink"] : css["--on-deep"]), (ctx.lineWidth = 2), ctx.stroke());
  }

  // The hero's two notes (`notes(said)`), drawn like marginalia on a chart once the first route has sailed, and fading
  // once the reader moves on (`notes(null)`): from the light that moved most in the open water, a line down to the
  // water ("higher: moved more"), and from the middle of the route, a leader to what the route is.
  const notes = { said: null, at: 0, gone: 0 };
  const noteAlpha = () => !notes.said || explore || depth > 0.02 ? 0 : held ? +!notes.gone
    : Math.min(1, (performance.now() - notes.at) / 600) * (notes.gone ? Math.max(0, 1 - (performance.now() - notes.gone) / 600) : 1);
  function note(first, taken, css) {
    const alpha = noteAlpha();
    if (!alpha) return;
    const free = (k) => k[0] > 4 && k[2] < W - 4 && k[1] > 4 && k[3] < H - 4 && !taken.some((o) => k[0] < o[2] && k[2] > o[0] && k[1] < o[3] && k[3] > o[1]);
    const inOpen = ([x, y]) => x > pad[3] + 8 && x < W - pad[1] - 8 && y > pad[0] && y < H - pad[2];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `600 12px ${css["--type"]}`;
    ctx.lineWidth = 1;
    ctx.strokeStyle = css["--on-deep-2"];
    /** A note's text with a halo of the deep under it, so that no light shows through it. */
    const write = (text, x, y) => {
      ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = css["--deep-2"]; ctx.strokeText(text, x, y);
      ctx.fillStyle = css["--on-deep"]; ctx.fillText(text, x, y); ctx.lineWidth = 1; ctx.strokeStyle = css["--on-deep-2"];
    };
    // The route: a leader from its middle port, down or up to where there is room.
    const r = first?.r, sailed = first && first.here.done >= r.legs.length - 1.01;
    if (r && sailed && r.legs.length > 2) {
      const mid = r.legs[Math.floor(r.legs.length / 2)], at = project(mid.x, 0, mid.z), text = notes.said.route(name(r.id), periods[r.legs[0].p], periods[r.legs.at(-1).p]), wide = ctx.measureText(text).width;
      for (const dy of [44, -44, 64, -64]) {
        const y = at && at[1] + dy, x = at && Math.min(W - wide - 12, at[0] + 18), k = at && [x - 4, y - 10, x + wide + 4, y + 10];
        if (!at || !inOpen(at) || !free(k)) continue;
        ctx.beginPath(); ctx.moveTo(at[0], at[1] + Math.sign(dy) * 6); ctx.lineTo(at[0], y); ctx.lineTo(x - 4, y); ctx.stroke();
        write(text, x, y + 1);
        taken.push(k, [at[0] - 3, Math.min(at[1], y), at[0] + 3, Math.max(at[1], y)]);
        break;
      }
    }
    // The light that moved most, among the lit words in the open water: its height drawn as a line down to the water.
    const lift = RISE * (1 - settle()), ids = new Set(routes.map((x) => x.id));
    let best = -1, top = null, foot = null;
    for (let k = 0; k < Math.min(n, NEAR); k++) {
      if (level[k] < 4 || ids.has(chart.words[k]) || (best >= 0 && chart.moved[k] <= chart.moved[best])) continue;
      const p = project(chart.x[k] / 1000, chart.moved[k] * lift, chart.y[k] / 1000), q = project(chart.x[k] / 1000, 0, chart.y[k] / 1000);
      if (p && q && inOpen(p) && inOpen(q) && q[1] - p[1] > 14 && free([p[0] - 6, p[1] - 6, p[0] + 140, q[1] + 6])) [best, top, foot] = [k, p, q];
    }
    if (best >= 0) {
      const text = notes.said.rise, y = (top[1] + foot[1]) / 2;
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(top[0], top[1] + 7); ctx.lineTo(foot[0], foot[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(foot[0] - 5, foot[1]); ctx.lineTo(foot[0] + 5, foot[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(top[0], top[1], 7, 0, 7); ctx.stroke();
      write(text, top[0] + 12, y + 1);
      taken.push([top[0] - 8, top[1] - 8, top[0] + 16 + ctx.measureText(text).width, foot[1] + 4]);
    }
    ctx.restore();
  }

  // ---- the loop: running while the hero is on screen and the tab is shown; idle frames at half the rate --------
  let frame = 0, last = 0, busyUntil = 0, seen = true, times = [], since = 0, wasBusy = false;
  const ask = (ms = 50) => {
    busyUntil = Math.max(busyUntil, performance.now() + ms);
    if (!frame && seen && !document.hidden && !ended) frame = requestAnimationFrame(loop);
  };
  function loop(t) {
    frame = 0;
    if (!node.isConnected) return ready && end();
    if (!W && !size()) return;
    const busy = t < busyUntil || glide.to || moving() || arrival.on || t - tailAt < 700 || rising.to !== null;
    // Exploring, or with the swell given up, nothing moves unless something is asked: the loop sleeps until then.
    const swell = !explore && LADDER[rung].swell;
    if (!held && (busy || swell)) frame = requestAnimationFrame(loop);
    if (!busy && ready && !held && (!swell || t - last < 30 || tide() >= 1)) return (wasBusy = false);  // the swell alone: about 30 frames a second, and none once all is paper
    if (glide.to) {
      const f = Math.min(1, (t - glide.start) / glide.ms), e = ease(f);
      for (const k of ["x", "z", "dist", "yaw", "pitch"]) aim[k] = mix(glide.from[k], glide.to[k], e);
      if (f >= 1) glide.to = null;
    }
    if (rising.to !== null) {
      const f = Math.min(1, (t - rising.start) / LEG);
      depth = mix(rising.from, rising.to, f);  // the dive's own curve (place) eases it
      if (f >= 1) rising.to = null;
    }
    steer();
    if (arrival.on) {
      // The front crosses the chart in about a second; the tally counts the words it has lit (a real count).
      arrival.start ||= t;
      const f = Math.min(1, (t - arrival.start) / 1100), far = arrival.far;
      arrival.reach = ease(f) * (far[far.length - 1] + 0.08);
      let lo = 0, hi = far.length;
      while (lo < hi) { const m = (lo + hi) >> 1; far[m] < arrival.reach ? (lo = m + 1) : (hi = m); }
      tally.textContent = arrival.say(lo);
      if (f >= 1) ((arrival.on = false), (arrival.reach = 99), (labelsAt = ""), arrival.done());
    }
    // The screen keeps up, or the sea steps down its ladder: only frames drawn one after another count (the swell
    // alone is drawn at half the rate, on purpose), judged a quarter of a second at a time.
    if (busy && wasBusy && !held) (times.push(t - last), (since ||= t));
    if (times.length >= 6 && t - since >= 250) {
      const median = times.sort((a, b) => a - b)[times.length >> 1];
      times = [];
      since = 0;
      if (median > BUDGET && rung < LADDER.length - 1) step(t);
    }
    wasBusy = busy;
    last = t;
    render(t);
  }
  /** One rung down the ladder, for good: fewer pixels at once, the rest at the next frame. */
  function step(t) {
    if (!LADDER[++rung].swell && LADDER[rung - 1].swell) calm = (t - started) / 1000;  // the swell stops where it is
    labelsAt = "";
    size();
    if (!hold) window.seaRung = rung;
  }
  /** The nudge follows the pointer (or the tilt of the device), a little behind; the camera follows the ship. */
  const moving = () => Math.abs(nudge.to[0] - nudge.x) + Math.abs(nudge.to[1] - nudge.y) > 0.002;
  function steer() {
    nudge.x += (nudge.to[0] - nudge.x) * 0.08;
    nudge.y += (nudge.to[1] - nudge.y) * 0.08;
    const here = routes.length && !explore && ship(routes[0], now);
    if (here && !held) {
      follow.x += ((here.x - aim.x) * 0.35 - follow.x) * 0.05;
      follow.z += ((here.z - aim.z) * 0.35 - follow.z) * 0.05;
    }
  }
  let ended = false;
  function end() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    io.disconnect();
    resize.disconnect();
    document.removeEventListener("visibilitychange", shown);
  }
  const io = new IntersectionObserver(([e]) => (!node.isConnected && ready ? end() : (seen = e.isIntersecting) && ask()));
  io.observe(node);
  const shown = () => (document.hidden ? null : ask());
  document.addEventListener("visibilitychange", shown);
  const resize = new ResizeObserver(() => size() && ask());
  resize.observe(node);
  canvas.addEventListener("webglcontextlost", (e) => (e.preventDefault(), (held = true), node.classList.add("lost")));

  // ---- the reader: hover names a word, a click sails it ---------------------------------------------------------
  let hovered = -1;
  function nearest(px, py, reach = 16) {
    let best = -1, d2 = reach * reach;
    const rise = RISE * (1 - settle());
    for (let k = 0; k < Math.min(n, 6000); k++) {
      const p = project(chart.x[k] / 1000, Math.max(0, chart.moved[k] ?? 0) * rise, chart.y[k] / 1000);
      if (!p || !name(chart.words[k])) continue;
      const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (d < d2) [best, d2] = [k, d];
    }
    return best;
  }
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || drag) return;
    const box = canvas.getBoundingClientRect(), k = nearest(e.clientX - box.left, e.clientY - box.top);
    canvas.style.cursor = k >= 0 ? "pointer" : "";
    if (k !== hovered) ((hovered = k), (labelsAt = ""), ask(), held && render(performance.now()));
    tip(k < 0 ? null : `${name(chart.words[k])}${chart.moved[k] === null ? "" : " · " + chart.moved[k]}`, e);
  });
  canvas.addEventListener("pointerleave", () => ((hovered = -1), (labelsAt = ""), tip(null), ask()));
  // A click or a tap chooses the nearest word, a finger's within a larger reach (Safari's click says not which it was).
  let finger = false;
  canvas.addEventListener("pointerdown", (e) => (finger = e.pointerType !== "mouse"));
  canvas.addEventListener("click", (e) => {
    if (dragged) return void (dragged = false);
    const box = canvas.getBoundingClientRect(), k = nearest(e.clientX - box.left, e.clientY - box.top, finger ? 24 : 16);
    if (k >= 0) pick(chart.words[k]);
  });

  const redraw = () => (held ? W && render(performance.now()) : ask());
  /** The whole chart in view, before any route is chosen. */
  const WHOLE = { x: 0, z: 0.05, dist: 2.3, yaw: 0, pitch: 0.5 };  // the hero's camera works its own pitch out
  const frameAll = () => Object.assign(aim, WHOLE);

  // ---- exploring (the map): drag to move over the sea, with the right button or Shift to turn and tilt, Ctrl and
  // the wheel (or a pinch on a trackpad) or the buttons to come nearer; the keys do the same; and fingers (below) --------
  let drag = null, dragged = false;
  /** Glide the camera to `to` (a part of aim), or cut there with reduced motion. */
  const move = (to, ms = LEG * 0.6) => {
    moved = true;
    to = { ...aim, ...to, dist: clamp(to.dist ?? aim.dist, 0.08, 3.2), pitch: clamp(to.pitch ?? aim.pitch, 0.1, 1.45), x: clamp(to.x ?? aim.x, -1.4, 1.4), z: clamp(to.z ?? aim.z, -1.4, 1.4) };
    labelsAt = "";
    if (!ms || held) return Object.assign(aim, to), place(), redraw();  // placed at once: the next move of a gesture starts from here
    Object.assign(glide, { from: { ...aim }, to, start: performance.now(), ms });
    ask();
  };
  /** The point of the water under a point of the screen (CSS pixels), or the camera's target if the ray misses it. */
  const ground = (px, py) => {
    const nx = (px / W) * 2 - 1, ny = 1 - (py / H) * 2, a = (nx - cam.lens[2]) / cam.lens[0], b = (ny - cam.lens[3]) / cam.lens[1];
    const ray = [0, 1, 2].map((i) => cam.F[i] + cam.R[i] * a + cam.U[i] * b);
    return ray[1] < -1e-3 ? { x: cam.eye[0] - (ray[0] * cam.eye[1]) / ray[1], z: cam.eye[2] - (ray[2] * cam.eye[1]) / ray[1] } : { x: aim.x, z: aim.z };
  };
  /** Move over the water by a number of pixels: across the screen and, foreshortened, into it. */
  const pan = (dx, dy, from = aim, ms = 0) => {
    const unit = (2 * from.dist * Math.tan(fovOf() / 2)) / H, into = unit / Math.max(0.25, Math.sin(cam.pitch)), [rx, rz] = [cam.R[0], cam.R[2]];
    move({ x: from.x - rx * dx * unit + rz * dy * into, z: from.z - rz * dx * unit - rx * dy * into }, ms);
  };
  const zoom = (f, at = [W / 2, H / 2], ms) => {
    const g = ground(...at);
    move({ dist: aim.dist * f, x: aim.x + (g.x - aim.x) * (1 - f), z: aim.z + (g.z - aim.z) * (1 - f) }, ms);
  };
  const turn = (dYaw, dPitch, from = aim, ms) => move({ yaw: from.yaw + dYaw, pitch: from.pitch + dPitch }, ms);
  /** From above, the sea becomes the chart on paper (the hero's dive, as a choice); and back down to the water. */
  const above = (on) => {
    if (on === depth > 0.5) return;
    const b = node.querySelector('[data-k="above"]');
    b.setAttribute("aria-pressed", on);
    node.classList.toggle("above", on);  // what the page's legend reads: the colours of the night or of the paper
    b.textContent = controls[on ? "level" : "above"] || (on ? "⬓" : "⬒");
    if (held) return (depth = on ? 1 : 0), redraw();
    Object.assign(rising, { from: depth, to: on ? 1 : 0, start: performance.now() });
    ask();
  };
  if (explore) {
    // The sea takes the finger: the page scrolls from the band around it (style.css leaves room for that on a phone).
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());  // the right button turns the sea
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      tip(null);
      if (!fingers.size && !drag) dragged = false;
      if (e.pointerType !== "mouse") return touch(e, true);
      drag = { x: e.clientX, y: e.clientY, from: { ...aim }, turning: e.button === 2 || e.shiftKey, moved: false };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return touch(e);
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 4;
      if (!drag.moved) return;
      canvas.style.cursor = drag.turning ? "move" : "grabbing";
      drag.turning ? turn(dx * 0.006, -dy * 0.004, drag.from, 0) : pan(dx, dy, drag.from, 0);
    });
    const release = (e) => {
      if (e.pointerType !== "mouse") return touch(e, false);
      dragged = !!drag?.moved;
      drag = null;
      canvas.style.cursor = "";
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    // Fingers, as on a map: one moves over the water; two pinch to come nearer and twist to turn, or, moved up or down
    // together, tilt (up lays the sea flatter, down looks from higher). Each move is taken from where the fingers were
    // a moment before, so a finger that joins or lifts never makes the sea jump; what two fingers do is settled once,
    // as they start to move. A tap is a click (above).
    const fingers = new Map();
    let hand = null;  // {last: the fingers' places at the last move, start: where this hold began, mode, moved}
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const middle = (ps) => [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2];
    const apart = (ps) => Math.hypot(ps[1][0] - ps[0][0], ps[1][1] - ps[0][1]), angle = (ps) => Math.atan2(ps[1][1] - ps[0][1], ps[1][0] - ps[0][0]);
    function touch(e, down) {
      if (down === true) fingers.set(e.pointerId, local(e));
      else if (down === false) fingers.delete(e.pointerId);
      else if (fingers.has(e.pointerId)) fingers.set(e.pointerId, local(e));
      else return;
      const now = [...fingers.values()].slice(0, 2);
      if (down !== undefined || !hand) {  // a finger came or went: hold again from here
        hand = now.length ? { last: now, start: now, mode: null, moved: hand?.moved || false } : null;
        if (!hand) canvas.style.cursor = "";
        return;
      }
      const { last, start } = hand;
      hand.last = now;
      hand.moved ||= now.some((p, i) => Math.hypot(p[0] - start[i][0], p[1] - start[i][1]) > 10);
      dragged ||= hand.moved;
      if (!hand.moved) return;
      if (now.length === 1) return pan(now[0][0] - last[0][0], now[0][1] - last[0][1], aim, 0);
      // Two fingers tilt when both went the same way up or down, mostly upright, and stayed as far apart; that is
      // settled once both have moved (or one alone far: a pinch).
      if (!hand.mode) {
        const d = now.map((p, i) => [p[0] - start[i][0], p[1] - start[i][1]]), far = d.map(([x, y]) => Math.hypot(x, y));
        if (Math.min(...far) < 8 && Math.max(...far) < 24) return;
        hand.mode = d[0][1] * d[1][1] > 0 && d.every(([x, y]) => Math.abs(y) > 2 * Math.abs(x)) && Math.abs(apart(now) - apart(start)) < 0.5 * Math.min(...d.map(([, y]) => Math.abs(y))) ? "tilt" : "pinch";
      }
      const [c, c0] = [middle(now), middle(last)];
      if (hand.mode === "tilt") return turn(0, (c[1] - c0[1]) * 0.005, aim, 0);
      zoom(apart(last) / Math.max(1, apart(now)), c0, 0);
      turn(angle(now) - angle(last), 0, aim, 0);  // the sea turns with the fingers (a larger yaw turns it clockwise)
      pan(c[0] - c0[0], c[1] - c0[1], aim, 0);
    }
    canvas.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;  // a plain wheel scrolls the page
      e.preventDefault();
      const box = canvas.getBoundingClientRect();
      zoom(Math.exp(clamp(e.deltaY, -60, 60) * 0.01), [e.clientX - box.left, e.clientY - box.top], 0);
    }, { passive: false });
    canvas.addEventListener("focus", () => ((keyed = canvas.matches(":focus-visible")), (labelsAt = ""), redraw()));
    canvas.addEventListener("blur", () => ((keyed = false), (ringed = -1), (labelsAt = ""), redraw()));
    canvas.addEventListener("keydown", (e) => {
      const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (arrow && e.shiftKey) turn(arrow[0] * 0.26, -arrow[1] * 0.12);
      else if (arrow) pan(-arrow[0] * W * 0.12, -arrow[1] * H * 0.12, aim, LEG * 0.3);
      else if (e.key === "+" || e.key === "=") zoom(1 / 1.5);
      else if (e.key === "-") zoom(1.5);
      else if (e.key === "0") move(WHOLE);
      else if (e.key === "Enter" && ringed >= 0) return pick(chart.words[ringed]);
      else return;
      e.preventDefault();
      keyed = true;
    });
    node.querySelector(".zoom").addEventListener("click", (e) => {
      const k = e.target.closest("button")?.dataset.k;
      if (k === "in") zoom(1 / 1.6);
      else if (k === "out") zoom(1.6);
      else if (k === "all") move(WHOLE);
      else if (k === "turn") turn(Math.PI / 4, 0);
      else if (k === "above") above(depth < 0.5);
    });
  } else if (!hold) {
    // The hero: a swipe up or down scrolls the page and two fingers zoom it, as anywhere else; a finger moved sideways
    // turns the view the few degrees a mouse does, and lets it settle back when it lifts. A tap sails the nearest word.
    canvas.style.touchAction = "pan-y pinch-zoom";
    let from = null;
    const go = () => from !== null && ((from = null), (nudge.to = [0, 0]), ask());
    canvas.addEventListener("pointerdown", (e) => e.pointerType !== "mouse" && (from = e.clientX));
    canvas.addEventListener("pointermove", (e) => from !== null && !held && ((nudge.to = [clamp((e.clientX - from) / (W / 2), -1, 1), 0]), ask()));
    canvas.addEventListener("pointerup", go);
    canvas.addEventListener("pointercancel", go);
  }
  const api = {
    node,
    has: (id) => chart.words.indexOf(id) >= 0,
    more(next) {
      take(next);
      labelsAt = "";
      redraw();
    },
    routes(list) {
      routes = list.filter((r) => r.route.some(Boolean)).slice(0, 4).map(lay);
      labelsAt = "";
      redraw();
    },
    time(p, ms = LEG) {
      const from = now, t0 = performance.now();
      if (!ms || held) return (now = p), redraw();
      const tick = (t) => {
        const f = Math.min(1, (t - t0) / ms);
        now = mix(from, p, ease(f));
        if (f < 1 && node.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      ask(ms + 100);
    },
    /** Bring these words and the route into view: the camera turns to see the route from its side, and backs off
     *  until it fits in the open part of the hero. */
    frame(ids, ms = LEG) {
      wanted = W || size() ? null : [ids, ms];
      if (wanted) return;
      const ps = [...routes.flatMap((r) => r.legs), ...ids.map((id) => chart.words.indexOf(id)).filter((k) => k >= 0).map((k) => ({ x: chart.x[k] / 1000, z: chart.y[k] / 1000 }))];
      if (!ps.length) return;
      const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length, mz = ps.reduce((s, p) => s + p.z, 0) / ps.length;
      // The route's main direction; the camera looks across it, turning no more than about 35 degrees.
      let [sxx, sxz, szz] = [0, 0, 0];
      for (const p of ps) [sxx, sxz, szz] = [sxx + (p.x - mx) ** 2, sxz + (p.x - mx) * (p.z - mz), szz + (p.z - mz) ** 2];
      const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz), across = [Math.cos(angle), Math.sin(angle)];
      let yaw = Math.atan2(across[1], across[0]);  // looking along -z needs the route along x: turn by its angle
      if (yaw > Math.PI / 2) yaw -= Math.PI;
      if (yaw < -Math.PI / 2) yaw += Math.PI;
      yaw = Math.max(-0.6, Math.min(0.6, -yaw));
      const spread = Math.max(...ps.map((p) => Math.abs((p.x - mx) * Math.cos(yaw) - (p.z - mz) * Math.sin(yaw)))), open = (W - pad[1] - pad[3]) / W;
      const t = Math.tan(((H > W ? 52 : 38) * Math.PI) / 360), dist = Math.max(held ? 0.2 : 0.32, Math.min(2.2, (spread * 2.4 + 0.12) / (2 * t * (W / H) * open)));
      const to = { ...aim, x: mx, z: mz, dist, yaw };  // the reader's tilt (exploring) stays as it is
      follow.x = follow.z = 0;
      // Seen at a low angle, the near end of a route comes out larger than its spread says: back off until every
      // port lies in the open water, with a margin.
      const fits = () => {
        const was = { ...aim };
        Object.assign(aim, to);
        place();
        const ok = ps.every((p) => { const q = project(p.x, 0, p.z); return q && q[0] > pad[3] + 24 && q[0] < W - pad[1] - 24 && q[1] > pad[0] + 24 && q[1] < H - pad[2] - 24; });
        Object.assign(aim, was);
        place();
        return ok;
      };
      for (let i = 0; i < 12 && !fits(); i++) to.dist = Math.min(3, to.dist * 1.15);
      if (!ms || held || !ready) return Object.assign(aim, to), redraw();
      Object.assign(glide, { from: { ...aim }, to, start: performance.now(), ms: ms * 1.4 });
      ask();
    },
    inset(list) {
      pad = list;
      redraw();
    },
    look(to) {
      moved = true;
      Object.assign(aim, WHOLE, to);
      redraw();
    },
    drawn: () => new Promise((done) => (ready ? done() : (waiting.push(done), ask()))),
    tilt(x, y) {
      if (held) return;
      nudge.to = [x, y];
      ask();
    },
    lift() {},
    /** The arrival: the sea starts dark and its words come on from the first route's word outwards, a tally beside
     *  the year counting them in words (say(n)); resolves once all that has come is lit. */
    arrive(say) {
      const k = routes.length ? chart.words.indexOf(routes[0].id) : -1;
      if (held) return Promise.resolve();
      arrival.origin = k >= 0 ? [chart.x[k] / 1000, chart.y[k] / 1000] : [aim.x, aim.z];
      take(chart);
      Object.assign(arrival, { on: true, reach: 0, start: 0, say });
      tally.hidden = false;
      ask();
      return new Promise((done) => (arrival.done = done));
    },
    /** The tally has said enough: it gives way. */
    tallied() {
      tally.textContent = arrival.say?.(n) ?? "";
      tally.classList.add("done");
    },
    dive(p) {
      if (p === depth) return;
      depth = p;
      redraw();
    },
    describe(text) {
      canvas.setAttribute("aria-label", text);
    },
    /** The hero's notes: {rise, route(word, from, to)} to draw them, null to let them fade. */
    notes(said) {
      if (said && !notes.said) Object.assign(notes, { said, at: performance.now(), gone: 0 });
      else if (!said && notes.said && !notes.gone) notes.gone = performance.now();
      labelsAt = "";
      ask(700);
      if (held) redraw();
    },
    end,
    /** The word nearest a point of the sea (by default its middle) and where it stands, in CSS pixels in the sea: for
     *  the checks, to tap it. */
    spot(x = W / 2, y = H / 2) {
      const k = nearest(x, y, Math.min(W, H) / 3), p = k >= 0 && project(chart.x[k] / 1000, Math.max(0, chart.moved[k] ?? 0) * RISE * (1 - settle()), chart.y[k] / 1000);
      return p ? { word: name(chart.words[k]), at: [p[0], p[1]] } : null;
    },
    /** How the sea is being drawn, for the checks: frames held still, the rung of the quality ladder, where the camera is. */
    state: () => ({ held, rung, points: n, pixels: [canvas.width, canvas.height], depth, routes: routes.length, ended,
      aim: Object.fromEntries(Object.entries(aim).map(([k, v]) => [k, +v.toFixed(3)])), ringed: ringed >= 0 ? name(chart.words[ringed]) : null }),
  };
  node.sea = api;  // for the checks (tests/site): how the sea is being drawn
  if (!held) window.seaRung = rung;  // the rung of the sea that moves (the hero, the map), for the checks
  return api;
}
