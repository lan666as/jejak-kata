// The night sea: the chart of words in WebGL2, seen across the water at a low angle (the home page's hero).
// Every point of light is a word of the chart, where the chart puts it. A word floats as high above the water as it
// moved (its shift, the number that also makes it brighter), and is as large as it is common; under it lies its
// reflection. The graticule is the chart's own, every 125 units, lying on the water. A chosen word's route is a ribbon
// on the water, sailed by a ship light. As the reader scrolls out of the hero (`dive`), the camera pitches down to a
// chart seen from above, the lights settle onto the water and the night turns into the paper of the page below.
// Same interface as the night chart of chart.js (routes, time, frame, inset, more, drawn, tilt), which stands in for
// it where WebGL2 is not there. Colours, the curve and the leg come from the page's tokens.

const STEPS = [2, 4, 7, 12, 20]; // shift boundaries of the six levels, as in app.js
const NEAR = 1500; // the most frequent words are lit and can be named; the rest are the faint tail
const RISE = 0.0042; // height above the water per unit of shift (the chart is about 2 units across)
const GRID = 0.125; // the graticule: a line every 125 chart units, as the 2D chart draws it

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
 * frame and hold it), `describe(text)` (the canvas's text alternative).
 */
export function nightSea({ chart, name, pick, periods, tip, label = "" }) {
  const node = document.createElement("div");
  node.className = "chart night gl";
  node.innerHTML = `<canvas role="img" aria-label="${label}"></canvas><canvas aria-hidden="true"></canvas><div class="when" aria-hidden="true"></div><div class="tally" aria-hidden="true" hidden></div>`;
  const [canvas, names, when, tally] = node.children;
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
  const words = buffer(lights, [["word", 4]]), wake = buffer(ribbon, [["at", 4], ["side", 2]]), ports = buffer(marks, [["mark", 4]]);
  const maxSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

  // The words: as many as the device can carry, the most frequent first (the chart is in that order).
  const most = innerWidth < 600 || (navigator.hardwareConcurrency || 4) <= 4 ? 7000 : 20000;
  let n = 0, level = [], wakeLength = 0, wakeVertices = 0, legs = [], route = null, now = 0, head = 0, tailAt = -1e9;
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
    route: rgb("--route-on-deep"), routeDay: rgb("--route"), light: rgb("--on-deep"),
    css: Object.fromEntries(["--on-deep", "--on-deep-2", "--deep-2", "--ink", "--ink-3", "--chart-2", "--route", "--route-on-deep", "--type"].map((k) => [k, root().getPropertyValue(k).trim()])),
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ((colours = null), ask()));

  let W = 0, H = 0, ratio = 1, quality = 1, wanted = null, pad = [0, 0, 0, 0], depth = 0, ready = false, waiting = [], held = still();
  // Where the camera looks (aim), as it glides there (from, to, start, ms), the ship it follows, and the nudge.
  const aim = { x: 0, z: 0, dist: 1.6, yaw: 0 }, glide = { from: null, to: null, start: 0, ms: 0 }, follow = { x: 0, z: 0 }, nudge = { x: 0, y: 0, to: [0, 0] };
  const cam = { eye: [0, 0, 0], R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1], lens: [1, 1, 0, 0], pitch: 0, ref: 1, fog: [1, 8] };
  const wide = () => W >= 900;
  /** The camera for the hero as it now stands, the dive and the nudge taken into account. */
  function place() {
    const e = ease(depth), tall = H > W, fov = (tall ? 52 : 38) * Math.PI / 180, t = Math.tan(fov / 2), asp = W / H;
    // The open part of the hero, beside or above the text: the camera looks at its middle; the horizon lies above it.
    const [top, right, bottom, left] = pad, cx = ((left + (W - right)) / W - 1) * (1 - e), cy = (1 - (top + (H - bottom)) / H) * (1 - e);
    const horizon = wide() ? 0.5 : 0.86, pitch = mix(Math.max(0.15, Math.min(0.38, Math.atan((horizon - cy) * t))), Math.PI / 2 - 1e-3, e) - nudge.y * 0.035 * (1 - e);
    const yaw = mix(aim.yaw, 0, e) + nudge.x * 0.07 * (1 - e);
    // From above: the whole chart, as wide as the screen allows.
    const over = 1.05 / t / Math.min(1, asp), tx = mix(aim.x + follow.x, -0.04, e), tz = mix(aim.z + follow.z, -0.03, e), dist = mix(aim.dist, over, e);
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
  /** The ribbon along the ports, through a smooth curve; each port's distance along it is kept for the ship. */
  function lay() {
    legs = route ? portsOf(route.route) : [];
    const points = [];
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
      const next = points[i + 1] || { x: 2 * p.x - points[i - 1].x, z: 2 * p.z - points[i - 1].z };
      for (const side of [-1, 1]) data.push(p.x, p.z, next.x, next.z, side, along);
    });
    legs.points = points;
    wakeLength = along;
    wakeVertices = points.length > 1 ? points.length * 2 : 0;
    wake.fill(new Float32Array(data));
  }
  /** Where the ship is at time t (a period, possibly between two): on the curve, and how far along it. */
  function ship(t) {
    const pts = legs.points;
    if (!pts?.length) return null;
    const k = Math.max(0, legs.findLastIndex((s) => s.p <= t)), next = legs[k + 1], f = next ? Math.max(0, Math.min(1, (t - legs[k].p) / (next.p - legs[k].p))) : 0;
    const i = Math.min(pts.length - 1, Math.round((k + f) * 12)), p = pts[i];
    return { x: p.x, z: p.z, along: p.along, done: k + f };
  }

  // ---- drawing --------------------------------------------------------------------------------------------------
  function size() {
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    [W, H, ratio] = [box.width, box.height, Math.min(1.5, devicePixelRatio || 1) * quality];
    const [w, h] = [Math.round(W * ratio), Math.round(H * ratio)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    const r = Math.min(2, devicePixelRatio || 1);
    if (names.width !== Math.round(W * r) || names.height !== Math.round(H * r)) [names.width, names.height] = [Math.round(W * r), Math.round(H * r)];
    ctx.setTransform(r, 0, 0, r, 0, 0);
    if (wanted) api.frame(...wanted);  // asked for before the sea had a size
    else if (!glide.to && !route) frameAll();
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
    const c = palette(), seconds = held ? 12 : (time - started) / 1000;
    place();
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
    gl.uniform1f(lights.u("ref"), cam.ref); gl.uniform1f(lights.u("rise"), RISE); gl.uniform1f(lights.u("quiet"), route ? 0.75 : 1);
    gl.uniform1f(lights.u("fogNear"), cam.fog[0]); gl.uniform1f(lights.u("fogFar"), cam.fog[1]); gl.uniform1f(lights.u("time"), seconds); gl.uniform1f(lights.u("maxSize"), maxSize);
    gl.uniform3fv(lights.u("lights"), c.lights); gl.uniform3fv(lights.u("dots"), c.dots);
    gl.uniform2fv(lights.u("origin"), arrival.origin); gl.uniform1f(lights.u("reach"), arrival.reach); gl.uniform1f(lights.u("head"), head);
    gl.uniform1f(lights.u("tailIn"), held ? 1 : Math.min(1, (time - tailAt) / 600));
    gl.bindVertexArray(words.vao);
    if (settle() < 0.99 && tide() < 0.99) (gl.uniform1f(lights.u("mirror"), -1), gl.drawArrays(gl.POINTS, 0, Math.min(n, NEAR)));
    const here = !arrival.on && route && ship(now);
    if (here && wakeVertices) {
      camera(ribbon);
      gl.uniform2f(ribbon.u("view"), canvas.width / 2, canvas.height / 2);
      gl.uniform1f(ribbon.u("width"), 13); gl.uniform1f(ribbon.u("sailed"), here.along + 1e-4);
      gl.uniform3fv(ribbon.u("colour"), c.route); gl.uniform3fv(ribbon.u("colourDay"), c.routeDay); gl.uniform3fv(ribbon.u("paper"), c.paper);
      gl.bindVertexArray(wake.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, wakeVertices);
    }
    camera(lights);
    gl.uniform1f(lights.u("mirror"), 1);
    gl.bindVertexArray(words.vao);
    gl.drawArrays(gl.POINTS, 0, n);
    if (here) {
      const list = legs.filter((s, k) => k <= Math.floor(here.done)).flatMap((s) => [s.x, s.z, 7, 0]);
      list.push(here.x, here.z, 26, 2, here.x, here.z, 30, 1);
      camera(marks);
      gl.uniform1f(marks.u("maxSize"), maxSize);
      for (const [k, v] of [["colour", c.route], ["colourDay", c.routeDay], ["light", c.light], ["paper", c.paper]]) gl.uniform3fv(marks.u(k), v);
      ports.fill(new Float32Array(list), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(ports.vao);
      gl.drawArrays(gl.POINTS, 0, list.length / 4);
    }
    // The names, on their own canvas: drawn again only when the camera, the tide or the ship has moved.
    const key = [...cam.eye, cam.pitch, now, n, W, H, tide(), hovered, arrival.reach, colours === c].map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join();
    if (key !== labelsAt) ((labelsAt = key), label(here));
    const shown = route ? periods[Math.round(now)] : "";
    if (when.textContent !== shown) when.textContent = shown;
    if (!ready) (ready = true), waiting.splice(0).forEach((done) => done());
  }
  /** The ship's name and its first port's year; then the names of the words that moved most among the frequent
   *  ones, as many as fit around them. Each in the colours of the night or of the paper, by the side of the tide. */
  function label(here) {
    const { css } = palette(), fade = (w) => 1 - smooth(cam.fog[0], cam.fog[1], w), lift = RISE * (1 - settle());
    const taken = new Set(), cell = (x, y) => `${Math.floor(x / 84)},${Math.floor(y / 17)}`, claim = (x, y, width) => {
      const cells = [cell(x, y), cell(x + width, y), cell(x + width / 2, y)];
      if (cells.some((c) => taken.has(c))) return false;
      cells.forEach((c) => taken.add(c));
      return true;
    };
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    const at = here && project(here.x, 0, here.z), start = here && legs.length > 1 && project(legs[0].x, 0, legs[0].z);
    if (at) {
      const text = name(route.id), paper = dayAt(...at) > 0.5;
      ctx.font = `800 15px ${css["--type"]}`;
      const width = ctx.measureText(text).width;
      claim(at[0] + 14, at[1] - 8, width + 14);
      claim(at[0] + 14, at[1] + 8, width + 14);
      ctx.fillStyle = paper ? css["--chart-2"] : css["--deep-2"];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(at[0] + 14, at[1] - 12, width + 14, 24, 12) : ctx.rect(at[0] + 14, at[1] - 12, width + 14, 24);
      ctx.fill();
      ctx.fillStyle = paper ? css["--route"] : css["--on-deep"];
      ctx.fillText(text, at[0] + 21, at[1] + 1);
    }
    if (start) {
      ctx.font = `700 12px ${css["--type"]}`;
      const text = periods[legs[0].p];
      claim(start[0] + 9, start[1] - 12, ctx.measureText(text).width);
      ctx.fillStyle = dayAt(...start) > 0.5 ? css["--route"] : css["--route-on-deep"];
      ctx.fillText(text, start[0] + 9, start[1] - 12);
    }
    ctx.font = `500 12px ${css["--type"]}`;
    let written = 0;
    for (let k = 0; k < Math.min(n, NEAR) && written < (W < 600 ? 14 : 30); k++) {
      if (level[k] < 2 || chart.words[k] === route?.id || Math.hypot(chart.x[k] / 1000 - arrival.origin[0], chart.y[k] / 1000 - arrival.origin[1]) > arrival.reach - 0.03) continue;
      const p = project(chart.x[k] / 1000, Math.max(0, chart.moved[k]) * lift, chart.y[k] / 1000);
      if (!p || p[0] < 0 || p[1] < 8 || p[0] > W - 40 || p[1] > H - 8 || fade(p[2]) < 0.3) continue;
      const text = name(chart.words[k]);
      if (!text || !claim(p[0] + 8, p[1], ctx.measureText(text).width)) continue;
      const paper = dayAt(...p) > 0.5;
      ctx.fillStyle = paper ? css["--ink-3"] : css["--on-deep-2"];
      ctx.globalAlpha = paper ? 1 : (route ? 0.6 : 0.82) * fade(p[2]);
      ctx.fillText(text, p[0] + 8, p[1]);
      written++;
    }
    ctx.globalAlpha = 1;
    const p = hovered >= 0 && project(chart.x[hovered] / 1000, Math.max(0, chart.moved[hovered]) * lift, chart.y[hovered] / 1000);
    if (p) (ctx.beginPath(), ctx.arc(p[0], p[1], 8, 0, 7), (ctx.strokeStyle = dayAt(...p) > 0.5 ? css["--ink"] : css["--on-deep"]), (ctx.lineWidth = 2), ctx.stroke());
  }

  // ---- the loop: running while the hero is on screen and the tab is shown; idle frames at half the rate --------
  let frame = 0, last = 0, busyUntil = 0, seen = true, slow = 0, times = [];
  const ask = (ms = 50) => {
    busyUntil = Math.max(busyUntil, performance.now() + ms);
    if (!frame && seen && !document.hidden) frame = requestAnimationFrame(loop);
  };
  function loop(t) {
    frame = 0;
    if (!node.isConnected) return ready && end();
    if (!W && !size()) return;
    const busy = t < busyUntil || glide.to || moving() || arrival.on || t - tailAt < 700;
    if (!held) frame = requestAnimationFrame(loop);
    if (!busy && ready && !held && (t - last < 30 || tide() >= 1)) return;  // the swell alone: about 30 frames a second, and none once all is paper
    if (glide.to) {
      const f = Math.min(1, (t - glide.start) / glide.ms), e = ease(f);
      for (const k of ["x", "z", "dist", "yaw"]) aim[k] = mix(glide.from[k], glide.to[k], e);
      if (f >= 1) glide.to = null;
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
    // The screen keeps up or the sea gets coarser: a quarter fewer pixels while frames take longer than 28 ms.
    if (last && !held) times.push(t - last);
    if (times.length >= 24) {
      const mean = times.reduce((a, b) => a + b) / times.length;
      times = [];
      if (mean > 28 && quality > 0.5) ((quality = Math.max(0.5, quality * 0.8)), size(), slow++);
    }
    last = t;
    render(t);
  }
  /** The nudge follows the pointer (or the tilt of the device), a little behind; the camera follows the ship. */
  const moving = () => Math.abs(nudge.to[0] - nudge.x) + Math.abs(nudge.to[1] - nudge.y) > 0.002;
  function steer() {
    nudge.x += (nudge.to[0] - nudge.x) * 0.08;
    nudge.y += (nudge.to[1] - nudge.y) * 0.08;
    const here = route && ship(now);
    if (here && !held) {
      follow.x += ((here.x - aim.x) * 0.35 - follow.x) * 0.05;
      follow.z += ((here.z - aim.z) * 0.35 - follow.z) * 0.05;
    }
  }
  function end() {
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
    if (e.pointerType !== "mouse") return;
    const box = canvas.getBoundingClientRect(), k = nearest(e.clientX - box.left, e.clientY - box.top);
    canvas.style.cursor = k >= 0 ? "pointer" : "";
    if (k !== hovered) ((hovered = k), (labelsAt = ""), ask(), held && render(performance.now()));
    tip(k < 0 ? null : `${name(chart.words[k])}${chart.moved[k] === null ? "" : " · " + chart.moved[k]}`, e);
  });
  canvas.addEventListener("pointerleave", () => ((hovered = -1), (labelsAt = ""), tip(null), ask()));
  canvas.addEventListener("click", (e) => {
    const box = canvas.getBoundingClientRect(), k = nearest(e.clientX - box.left, e.clientY - box.top, e.pointerType === "mouse" ? 16 : 24);
    if (k >= 0) pick(chart.words[k]);
  });

  const redraw = () => (held ? W && render(performance.now()) : ask());
  /** The whole chart in view, before any route is chosen. */
  const frameAll = () => Object.assign(aim, { x: -0.04, z: 0.1, dist: 2.4, yaw: 0 });
  const api = {
    node,
    has: (id) => chart.words.indexOf(id) >= 0,
    more(next) {
      take(next);
      labelsAt = "";
      redraw();
    },
    routes(list) {
      route = list.find((r) => r.route.some(Boolean)) || null;
      lay();
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
      const ps = [...(legs.length ? legs : []), ...ids.map((id) => chart.words.indexOf(id)).filter((k) => k >= 0).map((k) => ({ x: chart.x[k] / 1000, z: chart.y[k] / 1000 }))];
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
      const t = Math.tan(((H > W ? 52 : 38) * Math.PI) / 360), dist = Math.max(0.32, Math.min(2.2, (spread * 2.4 + 0.12) / (2 * t * (W / H) * open)));
      const to = { x: mx, z: mz, dist, yaw };
      follow.x = follow.z = 0;
      if (!ms || held || !ready) return Object.assign(aim, to), redraw();
      Object.assign(glide, { from: { ...aim }, to, start: performance.now(), ms: ms * 1.4 });
      ask();
    },
    inset(list) {
      pad = list;
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
      const k = route ? chart.words.indexOf(route.id) : -1;
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
    /** How the sea is being drawn, for the checks: frames held still, coarser for a slow screen. */
    state: () => ({ held, quality: +quality.toFixed(2), coarser: slow, points: n, pixels: [canvas.width, canvas.height], depth }),
  };
  node.sea = api;  // for the checks (tests/site): how the sea is being drawn
  return api;
}
