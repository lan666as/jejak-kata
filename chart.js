// The sea chart: every entry of a lens as an island on one plane, and the routes of chosen words across it.
// Drag to pan, buttons or ctrl+wheel to zoom, hover for a name, click to choose a word. With the keyboard:
// arrows pan, + and - zoom, 0 shows everything, Enter chooses the island under the ring in the middle.
// The islands are painted once onto layers a little larger than the view, and a drag or a zoom only moves those
// layers (a transform, done by the compositor); what is drawn every frame is the route on a clear canvas above.
// At night (the home page's hero) the islands are points of light on two layers, the far one with the graticule,
// and the two can drift apart for depth.

const STEPS = [2, 4, 7, 12, 20]; // shift boundaries, as in app.js
const LEG = 900; // milliseconds a ship takes from one period to the next
const NEAR = 1500; // at night, the most frequent islands lie on the near layer and are lit; the rest lie on the far one
import { board } from "./labels.js";

const MARGIN = 140; // pixels of sea painted around the view on every side
const ON_DEEP = { "--route": "--route-on-deep", "--ink": "--on-deep", "--ink-3": "--on-deep-2" }; // a route's colour at night

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `chart`: {words, x, y, moved} as written by idhist.highlights; `name(id)`: the word; `pick(id)`: called on a click.
 * Returns the node and: `routes(list)` with list of {id, color, route: [[x, y] | null per period]};
 * `time(p, ms)` sails every ship to period p; `frame(ids, ms, most)` brings these words and their routes into view;
 * `inset([top, right, bottom, left])` keeps that much of the view clear when framing; `tilt(x, y)` and `lift(px)`
 * drift the far layer (at night) for depth; `mark(id)`.
 */
export function seaChart({ chart, name, pick, periods, tip, label = "", night = false }) {
  const node = document.createElement("div");
  node.className = night ? "chart night" : "chart";
  node.innerHTML = `<div class="sea" aria-hidden="true"><canvas></canvas><canvas></canvas></div><canvas tabindex="0" role="application" aria-label="${label}"></canvas><div class="when" aria-hidden="true"></div><div class="zoom"><button type="button" aria-label="+">+</button><button type="button" aria-label="−">−</button><button type="button" aria-label="⤢">⤢</button></div>`;
  const [far, near] = node.firstChild.children, canvas = node.children[1], ctx = canvas.getContext("2d"), when = node.children[2];
  if (!night) far.hidden = true;
  for (const c of [far, near]) Object.assign(c.style, { left: -MARGIN + "px", top: -MARGIN + "px", transformOrigin: `${MARGIN}px ${MARGIN}px` });
  let n, place, level;
  const take = (next) => {
    chart = next;
    n = chart.words.length;
    place = new Map(chart.words.map((w, k) => [w, k]));
    level = chart.moved.map((m) => (m === null ? 0 : STEPS.filter((s) => m >= s).length));
  };
  take(chart);
  let W = 0, H = 0, ratio = 1, scale = 1, ox = 0, oy = 0, base = 1; // screen = chart * scale + offset
  let routes = [], now = 0, marked = null, hovered = -1, frameRequest = 0, wanted = null, keyed = false;
  let painted = null, colours = null, pad = [0, 0, 0, 0], gliding = false, waiting = [];
  const drift = { x: 0, y: 0, to: [0, 0], lift: 0, moving: 0 };

  const sx = (x) => x * scale + ox, sy = (y) => y * scale + oy;
  const redraw = () => (frameRequest ||= requestAnimationFrame(draw));
  const dirty = () => ((painted = null), redraw());
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ((colours = null), dirty()));

  function size() {
    const box = node.getBoundingClientRect();
    if (!box.width || (box.width === W && box.height === H)) return;
    const first = !W;
    [W, H, ratio] = [box.width, box.height, Math.min(2, devicePixelRatio || 1)];
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    base = Math.min(W, H) / 2150;
    if (first) [scale, ox, oy] = [base, W / 2, H / 2];
    painted = null;
    if (wanted) api.frame(...wanted); // asked for before the chart had a size
    redraw();
  }

  /** The colours, read from the page's tokens once and again when the scheme changes. */
  function palette() {
    if (colours) return colours;
    const read = (list) => list.map(css);
    colours = night
      ? { ink: css("--on-deep"), soft: css("--on-deep-2"), paper: css("--deep"), raised: css("--deep-2"), grid: css("--line-deep"), lights: read([0, 1, 2, 3, 4, 5].map((i) => `--light-${i}`)) }
      : { ink: css("--ink"), soft: css("--ink-3"), paper: css("--paper"), raised: css("--paper"), seq: read([0, 1, 2, 3, 4, 5].map((i) => `--seq-${i}`)) };
    if (night) colours.glows = colours.lights.map((c) => glow(c));
    colours.type = css("--type");
    colours.route = {};  // a route's colour by its token, read once
    return colours;
  }
  /** A point of light: a small canvas with a bright middle that fades out, drawn once per colour. */
  function glow(colour) {
    const c = document.createElement("canvas"), s = 48;
    c.width = c.height = s;
    const g = c.getContext("2d"), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, colour);
    grad.addColorStop(0.18, colour);
    grad.addColorStop(0.3, colour + "66");
    grad.addColorStop(1, colour + "00");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return c;
  }

  /** Paint the islands and their names onto the layers, around the view, as the view now stands. */
  function paint() {
    const { ink, soft, seq, lights, glows, grid } = palette(), w = W + 2 * MARGIN, h = H + 2 * MARGIN;
    const zoom = scale / base, quiet = routes.length ? (night ? 0.55 : 0.45) : 1;
    const layers = night ? [far, near] : [near];
    for (const c of layers) {
      const r = c === far ? 1 : ratio;  // the far layer is soft points and faint lines: its pixels need not be sharp
      if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) [c.width, c.height, c.style.width, c.style.height] = [Math.round(w * r), Math.round(h * r), w + "px", h + "px"];
      const g = c.getContext("2d");
      g.setTransform(r, 0, 0, r, MARGIN * r, MARGIN * r);
      g.clearRect(-MARGIN, -MARGIN, w, h);
    }
    const f = far.getContext("2d"), g = near.getContext("2d");
    const seen = (x, y) => x > -MARGIN - 8 && y > -MARGIN - 8 && x < W + MARGIN + 8 && y < H + MARGIN + 8;
    if (night) {
      // The graticule, in the chart's own units, so that it pans and zooms with the sea; a line every 120-240 pixels.
      let step = 125;
      while (step * scale < 120) step *= 2;
      while (step * scale > 240) step /= 2;
      const x0 = Math.floor((-MARGIN - ox) / scale / step) * step, x1 = (W + MARGIN - ox) / scale, y0 = Math.floor((-MARGIN - oy) / scale / step) * step, y1 = (H + MARGIN - oy) / scale;
      f.beginPath();
      for (let x = x0; x <= x1; x += step) (f.moveTo(Math.round(sx(x)) + 0.5, -MARGIN), f.lineTo(Math.round(sx(x)) + 0.5, H + MARGIN));
      for (let y = y0; y <= y1; y += step) (f.moveTo(-MARGIN, Math.round(sy(y)) + 0.5), f.lineTo(W + MARGIN, Math.round(sy(y)) + 0.5));
      f.strokeStyle = grid;
      f.lineWidth = 1;
      f.globalAlpha = 0.6;
      f.stroke();
      // Far: the long tail, small and dim. Near: the frequent words, lit, the more a word moved the brighter.
      const r = Math.min(2.6, 1.3 * Math.sqrt(zoom));
      for (let pass = 0; pass <= 5; pass++) {
        f.fillStyle = lights[pass];
        f.globalAlpha = (0.3 + 0.12 * pass) * quiet;
        for (let k = NEAR; k < n; k++) {
          if (level[k] !== pass) continue;
          const x = sx(chart.x[k]), y = sy(chart.y[k]);
          if (seen(x, y)) f.fillRect(x - r / 2, y - r / 2, r, r);
        }
      }
      f.globalAlpha = 1;
      for (let k = Math.min(NEAR, n) - 1; k >= 0; k--) {
        const x = sx(chart.x[k]), y = sy(chart.y[k]);
        if (!seen(x, y)) continue;
        const s = (k < 300 ? 13 : k < 800 ? 10 : 8) * (0.75 + 0.22 * level[k]) * Math.min(2, Math.sqrt(zoom));
        g.globalAlpha = (0.45 + 0.11 * level[k]) * quiet;
        g.drawImage(glows[level[k]], x - s / 2, y - s / 2, s, s);
      }
      g.globalAlpha = 1;
    } else {
      // Islands, the least moved first so that the most moved lie on top.
      for (let pass = 0; pass <= 5; pass++) {
        g.fillStyle = pass ? seq[pass] : soft;
        g.globalAlpha = (pass ? 1 : 0.3) * quiet;
        for (let k = 0; k < n; k++) {
          if (level[k] !== pass) continue;
          const x = sx(chart.x[k]), y = sy(chart.y[k]);
          if (!seen(x, y)) continue;
          const r = (k < 400 ? 3 : k < 4000 ? 2.1 : 1.5) * Math.min(3, Math.sqrt(zoom));
          g.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
      }
      g.globalAlpha = 1;
    }
    // Names: the most frequent islands in view, as many as fit without touching; fewer and quieter at night.
    g.font = `${night ? 500 : 400} 12px ${css("--type")}`;
    g.textBaseline = "middle";
    // On the one board (labels.js): clear of each other and of the buttons and the year over the chart.
    const box = node.getBoundingClientRect(), B = board([-MARGIN, -MARGIN, W + MARGIN, H + MARGIN]).reserve(...[...node.querySelectorAll(".zoom, .when")].map((n) => n.getBoundingClientRect())
      .filter((r) => r.width).map((r) => [r.left - box.left - 6, r.top - box.top - 6, r.right - box.left + 6, r.bottom - box.top + 6]));
    const claim = (x, y, width, text) => B.place([[x - 3, y - 9, x + width + 3, y + 9]], text);
    const chosen = new Set(routes.map((r) => place.get(r.id))), most = night ? 34 : 90;
    g.fillStyle = night ? soft : ink;
    g.globalAlpha = night ? (routes.length ? 0.55 : 0.8) : routes.length ? 0.5 : 0.82;
    let written = 0;
    for (let k = 0; k < n && written < most; k++) {
      const x = sx(chart.x[k]), y = sy(chart.y[k]);
      if (x < -MARGIN || y < 8 - MARGIN || x > W + MARGIN - 30 || y > H + MARGIN - 8 || chosen.has(k) || (night && level[k] < 2)) continue;  // at night only words that moved are named
      const text = name(chart.words[k]);
      if (!text || !claim(x + 7, y, g.measureText(text).width, text)) continue;
      g.fillText(text, x + 7, y);
      written++;
    }
    g.globalAlpha = 1;
    painted = { scale, ox, oy };
  }

  /** The steps of a route that exist. With many periods each is averaged with its two neighbours on either
   *  side: from year to year a word jitters across the chart far more than it travels. */
  function legs(route) {
    const raw = route.map((xy, p) => xy && { p, xy }).filter(Boolean);
    const weights = raw.length > 6 ? [1, 2, 3, 2, 1] : [0, 0, 1, 0, 0];
    return raw.map((r, k) => {
      let [x, y, total] = [0, 0, 0];
      weights.forEach((w, j) => {
        const near = raw[k + j - 2];
        if (near && w) [x, y, total] = [x + w * near.xy[0], y + w * near.xy[1], total + w];
      });
      return { p: r.p, x: x / total, y: y / total };
    });
  }

  /** Where a ship is at time `t` (a period, possibly between two), and how many legs lie behind it. */
  function ship(steps, t) {
    if (t <= steps[0].p) return { ...steps[0], done: 0 };
    for (let k = 1; k < steps.length; k++)
      if (t <= steps[k].p) {
        const f = (t - steps[k - 1].p) / (steps[k].p - steps[k - 1].p);
        return { x: steps[k - 1].x + f * (steps[k].x - steps[k - 1].x), y: steps[k - 1].y + f * (steps[k].y - steps[k - 1].y), done: k - 1 + f };
      }
    return { ...steps.at(-1), done: steps.length - 1 };
  }

  function draw() {
    frameRequest = 0;
    if (!W) return;
    // The layers as painted, scaled and moved to where the view now is; painted again when they no longer cover
    // the view, or when a zoom has come to rest (so that the islands are sharp at the new scale).
    let a = painted && scale / painted.scale;
    const covers = (a) => {
      const bx = ox - a * painted.ox, by = oy - a * painted.oy;
      return bx - a * MARGIN <= 0 && by - a * MARGIN <= 0 && bx + a * (W + MARGIN) >= W && by + a * (H + MARGIN) >= H && a > 0.6 && a < 1.7;
    };
    if (!painted || (a !== 1 && !gliding) || !covers(a)) (paint(), (a = 1));
    const bx = ox - a * painted.ox, by = oy - a * painted.oy, at = (x, y) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${a})`;
    if (night) far.style.transform = at(bx - drift.x * 12, by - drift.y * 9 + drift.lift * 0.22);
    near.style.transform = at(bx + drift.x * 3, by + drift.y * 3);
    const { ink, paper, raised, type, route: tint } = palette();
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (night) ctx.translate(drift.x * 3, drift.y * 3);
    // Routes: the sailed part solid, the part ahead dashed (by day; at night only the sailed part, glowing); the ship with its name.
    for (const r of routes) {
      const steps = legs(r.route);
      if (!steps.length) continue;
      const token = night ? ON_DEEP[r.color] || r.color : r.color, here = ship(steps, now), color = (tint[token] ||= css(token));
      const trace = (from, to) => {
        ctx.beginPath();
        steps.slice(from, to + 1).forEach((s, k) => (k ? ctx.lineTo(sx(s.x), sy(s.y)) : ctx.moveTo(sx(s.x), sy(s.y))));
      };
      const sailed = () => (trace(0, behind), ctx.lineTo(sx(here.x), sy(here.y)));
      const behind = Math.floor(here.done);
      ctx.lineJoin = ctx.lineCap = "round";
      if (!night) {
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        trace(0, steps.length - 1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const [style, width, alpha] of night ? [[color, 16, 0.1], [color, 7, 0.26], [color, 3, 1]] : [[paper, 8, 1], [color, 3.5, 1]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        sailed();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      steps.forEach((s, k) => {
        if (night && k > behind) return;
        ctx.beginPath();
        ctx.arc(sx(s.x), sy(s.y), 3, 0, 7);
        ctx.fillStyle = k <= behind ? color : paper;
        ctx.fill();
        ctx.strokeStyle = night ? paper : color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      if (night) {
        const halo = ctx.createRadialGradient(sx(here.x), sy(here.y), 0, sx(here.x), sy(here.y), 26);
        halo.addColorStop(0, color + "88");
        halo.addColorStop(1, color + "00");
        ctx.fillStyle = halo;
        ctx.fillRect(sx(here.x) - 26, sy(here.y) - 26, 52, 52);
      }
      ctx.beginPath();
      ctx.arc(sx(here.x), sy(here.y), night ? 7 : 8, 0, 7);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = paper;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = `800 15px ${type}`;
      ctx.textBaseline = "middle";
      const text = name(r.id), width = ctx.measureText(text).width;
      ctx.fillStyle = night ? raised : paper;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(sx(here.x) + 12, sy(here.y) - 12, width + 14, 24, 12);
      else ctx.rect(sx(here.x) + 12, sy(here.y) - 12, width + 14, 24);
      ctx.fill();
      ctx.fillStyle = night ? ink : color;
      ctx.fillText(text, sx(here.x) + 19, sy(here.y) + 1);
      ctx.font = `700 12px ${type}`;
      ctx.fillStyle = color;
      ctx.fillText(periods[steps[0].p], sx(steps[0].x) + 8, sy(steps[0].y) - 11);
    }
    // The island under the pointer, or the one marked.
    for (const k of [marked, hovered]) {
      if (k === null || k < 0) continue;
      ctx.beginPath();
      ctx.arc(sx(chart.x[k]), sy(chart.y[k]), 7, 0, 7);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (keyed && hovered >= 0) {
      ctx.font = `700 13px ${type}`;
      ctx.textBaseline = "middle";
      const text = name(chart.words[hovered]), x = sx(chart.x[hovered]) + 11, y = sy(chart.y[hovered]) - 15;
      ctx.fillStyle = ink;
      ctx.fillRect(x - 5, y - 11, ctx.measureText(text).width + 10, 22);
      ctx.fillStyle = paper;
      ctx.fillText(text, x, y + 1);
    }
    ctx.restore();
    waiting.splice(0).forEach((done) => done());
    const shown = routes.length ? periods[Math.round(now)] : "";
    if (when.textContent !== shown) when.textContent = shown;
    node.style.touchAction = scale > base * 1.05 ? "none" : "pan-y"; // a finger scrolls the page until the chart is zoomed in
  }

  /** Glide a number of values from where they are to where they should be. */
  function glide(read, write, target, ms) {
    const from = read(), started = performance.now();
    const tick = (t) => {
      const f = Math.min(1, (t - started) / ms), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      write(from.map((v, i) => v + (target[i] - v) * e));
      gliding = f < 1;
      draw();
      if (f < 1 && node.isConnected) requestAnimationFrame(tick);
    };
    if (!ms || still()) return (write(target), redraw());
    requestAnimationFrame(tick);
  }
  const view = (to, ms = 700) => glide(() => [scale, ox, oy], (v) => ([scale, ox, oy] = v), to, ms);
  const zoomBy = (factor, cx = W / 2, cy = H / 2) => {
    const next = Math.max(base * 0.8, Math.min(base * 40, scale * factor));
    view([next, cx - ((cx - ox) * next) / scale, cy - ((cy - oy) * next) / scale], 250);
  };
  /** The far layer drifts towards where the reader points, a little behind, until it is there. */
  function steer() {
    drift.x += (drift.to[0] - drift.x) * 0.14;
    drift.y += (drift.to[1] - drift.y) * 0.14;
    const done = Math.abs(drift.to[0] - drift.x) + Math.abs(drift.to[1] - drift.y) < 0.004;
    if (done) [drift.x, drift.y] = drift.to;
    redraw();
    drift.moving = done || !node.isConnected ? 0 : requestAnimationFrame(steer);
  }

  function nearest(px, py, reach = 14) {
    let best = -1, distance = reach * reach;
    for (let k = 0; k < n; k++) {
      const dx = sx(chart.x[k]) - px, dy = sy(chart.y[k]) - py, d = dx * dx + dy * dy;
      if (d < distance) [best, distance] = [k, d];
    }
    return best;
  }

  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, ox, oy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const box = canvas.getBoundingClientRect();
    if (drag && (e.pointerType === "mouse" || scale > base * 1.05)) {
      drag.moved ||= Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4;
      [ox, oy] = [drag.ox + e.clientX - drag.x, drag.oy + e.clientY - drag.y];
      return redraw();
    }
    const k = nearest(e.clientX - box.left, e.clientY - box.top);
    if (k !== hovered) ((hovered = k), redraw());
    tip(k < 0 ? null : `${name(chart.words[k])}${chart.moved[k] === null ? "" : " · " + chart.moved[k]}`, e);
  });
  canvas.addEventListener("pointerup", (e) => {
    const box = canvas.getBoundingClientRect(), k = nearest(e.clientX - box.left, e.clientY - box.top);
    if (drag && !drag.moved && k >= 0) pick(chart.words[k]);
    drag = null;
  });
  canvas.addEventListener("pointerleave", () => ((hovered = -1), tip(null), redraw()));
  canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // a plain wheel scrolls the page
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.3 : 1 / 1.3, e.clientX - box.left, e.clientY - box.top);
  }, { passive: false });
  // The keyboard steers by the middle of the chart: what is nearest to it is ringed and named, and Enter chooses it.
  const aim = () => ((hovered = keyed ? nearest(W / 2, H / 2, Math.min(W, H) / 3) : -1), redraw());
  canvas.addEventListener("focus", () => ((keyed = canvas.matches(":focus-visible")), aim()));
  canvas.addEventListener("blur", () => ((keyed = false), aim()));
  canvas.addEventListener("keydown", (e) => {
    const pan = { ArrowLeft: [70, 0], ArrowRight: [-70, 0], ArrowUp: [0, 70], ArrowDown: [0, -70] }[e.key];
    if (pan) [ox, oy] = [ox + pan[0], oy + pan[1]];
    else if (e.key === "+" || e.key === "=") zoomBy(1.5);
    else if (e.key === "-") zoomBy(1 / 1.5);
    else if (e.key === "0") view([base, W / 2, H / 2]);
    else if (e.key === "Enter" && hovered >= 0) return pick(chart.words[hovered]);
    else return;
    e.preventDefault();
    keyed = true;
    aim();
    setTimeout(aim, 280); // once a zoom has glided to its place
  });
  const [plus, minus, whole] = node.querySelectorAll(".zoom button");
  plus.addEventListener("click", () => zoomBy(1.7));
  minus.addEventListener("click", () => zoomBy(1 / 1.7));
  whole.addEventListener("click", () => view([base, W / 2, H / 2]));
  new ResizeObserver(size).observe(node);

  const api = {
    node,
    has: (id) => place.has(id),
    /** More islands for the same sea: the first screen starts with the most frequent and gets the rest later. */
    more(next) {
      take(next);
      dirty();
    },
    routes(list) {
      routes = list.filter((r) => r.route.some(Boolean));
      dirty();
    },
    time(p, ms = LEG) {
      glide(() => [now], ([t]) => (now = t), [p], ms);
    },
    mark(id) {
      marked = place.get(id) ?? null;
      redraw();
    },
    /** Resolves once the chart has been drawn on screen. */
    drawn: () => new Promise((done) => (W && painted ? done() : waiting.push(done))),
    inset(list) {
      pad = list;
    },
    tilt(x, y) {
      drift.to = [x, y];
      drift.moving ||= requestAnimationFrame(steer);
    },
    lift(px) {
      if (px === drift.lift) return;
      drift.lift = px;
      redraw();
    },
    /** Bring these words, and the routes drawn, into view with some sea around them, zoomed in at most `most` times. */
    frame(ids, ms = 900, most = 14) {
      size();
      const points = [...ids.filter((id) => place.has(id)).map((id) => [chart.x[place.get(id)], chart.y[place.get(id)]]), ...routes.flatMap((r) => r.route.filter(Boolean))];
      wanted = W ? null : [ids, ms, most];
      if (!points.length || !W) return;
      const [top, right, bottom, left] = pad, w = W - left - right, h = H - top - bottom;
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const next = Math.max(base, Math.min(base * most, 0.55 * Math.min(w / (x1 - x0 + 60), h / (y1 - y0 + 60))));
      view([next, left + w / 2 - ((x0 + x1) / 2) * next, top + h / 2 - ((y0 + y1) / 2) * next], ms);
    },
  };
  return api;
}
