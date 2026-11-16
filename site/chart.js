// The sea chart: every entry of a lens as an island on one plane, and the routes of chosen words across it.
// Drag to pan, buttons or ctrl+wheel or pinch-free zoom, hover for a name, click to choose a word.

const STEPS = [2, 4, 7, 12, 20]; // shift boundaries, as in app.js
const LEG = 900; // milliseconds a ship takes from one period to the next

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * `chart`: {words, x, y, moved} as written by idhist.highlights; `name(id)`: the word; `pick(id)`: called on a click.
 * Returns the node and: `routes(list)` with list of {id, color, route: [[x, y] | null per period]};
 * `time(p)` sails every ship to period p; `frame(ids)` brings these words and their routes into view; `mark(id)`.
 */
export function seaChart({ chart, name, pick, periods, tip }) {
  const node = document.createElement("div");
  node.className = "chart";
  node.innerHTML = `<canvas></canvas><div class="when"></div><div class="zoom"><button type="button" aria-label="+">+</button><button type="button" aria-label="−">−</button><button type="button" aria-label="⤢">⤢</button></div>`;
  const canvas = node.firstChild, ctx = canvas.getContext("2d"), when = node.children[1];
  const n = chart.words.length;
  const place = new Map(chart.words.map((w, k) => [w, k]));
  const level = chart.moved.map((m) => (m === null ? 0 : STEPS.filter((s) => m >= s).length));
  let W = 0, H = 0, scale = 1, ox = 0, oy = 0, base = 1; // screen = chart * scale + offset
  let routes = [], now = 0, marked = null, hovered = -1, frameRequest = 0, wanted = null;

  const sx = (x) => x * scale + ox, sy = (y) => y * scale + oy;
  const redraw = () => (frameRequest ||= requestAnimationFrame(draw));

  function size() {
    const box = node.getBoundingClientRect(), ratio = devicePixelRatio || 1;
    if (!box.width || (box.width === W && box.height === H)) return;
    const first = !W;
    [W, H] = [box.width, box.height];
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    base = Math.min(W, H) / 2150;
    if (first) [scale, ox, oy] = [base, W / 2, H / 2];
    if (wanted) api.frame(wanted, 0); // asked for before the chart had a size
    redraw();
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
    const ink = css("--ink"), paper = css("--paper"), seq = [0, 1, 2, 3, 4, 5].map((i) => css(`--seq-${i}`));
    ctx.clearRect(0, 0, W, H);
    const zoom = scale / base, quiet = routes.length ? 0.45 : 1;
    // Islands, the least moved first so that the most moved lie on top.
    for (let pass = 0; pass <= 5; pass++) {
      ctx.fillStyle = pass ? seq[pass] : css("--ink-3");
      ctx.globalAlpha = (pass ? 1 : 0.3) * quiet;
      for (let k = 0; k < n; k++) {
        if (level[k] !== pass) continue;
        const x = sx(chart.x[k]), y = sy(chart.y[k]);
        if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        const r = (k < 400 ? 3 : k < 4000 ? 2.1 : 1.5) * Math.min(3, Math.sqrt(zoom));
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    ctx.globalAlpha = 1;
    // Names: the most frequent islands in view, as many as fit without touching.
    ctx.font = `12px ${css("--type")}`;
    ctx.textBaseline = "middle";
    const taken = new Set(), cell = (x, y) => `${Math.floor(x / 84)},${Math.floor(y / 17)}`;
    const claim = (x, y, width) => {
      const cells = [cell(x, y), cell(x + width, y), cell(x + width / 2, y)];
      if (cells.some((c) => taken.has(c))) return false;
      cells.forEach((c) => taken.add(c));
      return true;
    };
    const chosen = new Set(routes.map((r) => place.get(r.id)));
    let written = 0;
    for (let k = 0; k < n && written < 90; k++) {
      const x = sx(chart.x[k]), y = sy(chart.y[k]);
      if (x < 0 || y < 8 || x > W - 30 || y > H - 8 || chosen.has(k)) continue;
      const text = name(chart.words[k]);
      if (!claim(x + 5, y, ctx.measureText(text).width)) continue;
      ctx.fillStyle = ink;
      ctx.globalAlpha = routes.length ? 0.5 : 0.82;
      ctx.fillText(text, x + 5, y);
      written++;
    }
    ctx.globalAlpha = 1;
    // Routes: sailed part solid over a paper casing, the part ahead dashed; the ship with its name.
    for (const r of routes) {
      const steps = legs(r.route);
      if (!steps.length) continue;
      const here = ship(steps, now), color = css(r.color);
      const trace = (from, to) => {
        ctx.beginPath();
        steps.slice(from, to + 1).forEach((s, k) => (k ? ctx.lineTo(sx(s.x), sy(s.y)) : ctx.moveTo(sx(s.x), sy(s.y))));
      };
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      trace(0, steps.length - 1);
      ctx.stroke();
      ctx.setLineDash([]);
      const behind = Math.floor(here.done);
      for (const [style, width] of [[paper, 8], [color, 3.5]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        trace(0, behind);
        ctx.lineTo(sx(here.x), sy(here.y));
        ctx.stroke();
      }
      steps.forEach((s, k) => {
        ctx.beginPath();
        ctx.arc(sx(s.x), sy(s.y), 3, 0, 7);
        ctx.fillStyle = k <= behind ? color : paper;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(sx(here.x), sy(here.y), 8, 0, 7);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = paper;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = `800 15px ${css("--type")}`;
      const text = name(r.id), width = ctx.measureText(text).width;
      ctx.fillStyle = paper;
      ctx.fillRect(sx(here.x) + 11, sy(here.y) - 11, width + 8, 22);
      ctx.fillStyle = color;
      ctx.fillText(text, sx(here.x) + 15, sy(here.y));
      ctx.font = `700 11px ${css("--type")}`;
      ctx.fillStyle = color;
      ctx.fillText(periods[steps[0].p], sx(steps[0].x) + 7, sy(steps[0].y) - 10);
    }
    // The island under the pointer, or the one marked.
    for (const k of [marked, hovered]) {
      if (k === null || k < 0) continue;
      ctx.beginPath();
      ctx.arc(sx(chart.x[k]), sy(chart.y[k]), 6, 0, 7);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    when.textContent = routes.length ? periods[Math.round(now)] : "";
    node.style.touchAction = scale > base * 1.05 ? "none" : "pan-y"; // a finger scrolls the page until the chart is zoomed in
  }

  /** Glide a number of values from where they are to where they should be. */
  function glide(read, write, target, ms) {
    const from = read(), started = performance.now();
    const tick = (t) => {
      const f = Math.min(1, (t - started) / ms), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      write(from.map((v, i) => v + (target[i] - v) * e));
      draw();
      if (f < 1 && node.isConnected) requestAnimationFrame(tick);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return (write(target), redraw());
    requestAnimationFrame(tick);
  }
  const view = (to, ms = 700) => glide(() => [scale, ox, oy], (v) => ([scale, ox, oy] = v), to, ms);
  const zoomBy = (factor, cx = W / 2, cy = H / 2) => {
    const next = Math.max(base * 0.8, Math.min(base * 40, scale * factor));
    view([next, cx - ((cx - ox) * next) / scale, cy - ((cy - oy) * next) / scale], 250);
  };

  function nearest(px, py) {
    let best = -1, distance = 14 * 14;
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
  const [plus, minus, whole] = node.querySelectorAll(".zoom button");
  plus.addEventListener("click", () => zoomBy(1.7));
  minus.addEventListener("click", () => zoomBy(1 / 1.7));
  whole.addEventListener("click", () => view([base, W / 2, H / 2]));
  new ResizeObserver(size).observe(node);

  const api = {
    node,
    has: (id) => place.has(id),
    routes(list) {
      routes = list.filter((r) => r.route.some(Boolean));
      redraw();
    },
    time(p, ms = LEG) {
      glide(() => [now], ([t]) => (now = t), [p], ms);
    },
    mark(id) {
      marked = place.get(id) ?? null;
      redraw();
    },
    /** Bring these words, and the routes drawn, into view with some sea around them. */
    frame(ids, ms = 900) {
      size();
      const points = [...ids.filter((id) => place.has(id)).map((id) => [chart.x[place.get(id)], chart.y[place.get(id)]]), ...routes.flatMap((r) => r.route.filter(Boolean))];
      wanted = W ? null : ids;
      if (!points.length || !W) return;
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const next = Math.max(base, Math.min(base * 14, 0.55 * Math.min(W / (x1 - x0 + 60), H / (y1 - y0 + 60))));
      view([next, W / 2 - ((x0 + x1) / 2) * next, H / 2 - ((y0 + y1) / 2) * next], ms);
    },
  };
  return api;
}
