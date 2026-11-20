// Plates: figures that can stand alone as an image. The title says the finding, every mark is named, the number
// of pages behind it and the site are written on it. Two kinds: `plate` (lines over periods, a marker that
// travels) and `strip` (rows on one scale, dots that travel from one state to the next). Nothing is redrawn
// when the moment changes: the marks move.

import { board } from "./labels.js";

// A plate takes its inks from the page, or from the node it is drawn for (`inks`): a story's stage is the deep in both
// schemes, and a plate on it is drawn in the night's inks on the stage itself (style.css, .stage-figure). Saved as an
// image it is paper again, in the page's own inks (plateImage).
let scope = document.documentElement;
const css = (name, from = scope) => getComputedStyle(from).getPropertyValue(name).trim();
const drawnOn = new WeakMap();  // a plate's svg -> the node whose inks it was drawn in, where that is not the page
/** The plates made from now on take the inks of `node` (until it is called again with none). */
export const inks = (node = document.documentElement) => (scope = node);
// Up to nine series (the ninth in ink), each its own hue in light and dark (style.css, --cat-1..8: magenta first, then orange).
const COLOURS = ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6", "--cat-7", "--cat-8", "--cat-9"];
const SITE = "Jejak Kata · zidan.dev/jejak-kata";
// Marks travel on the site's curve, one after another (--k: the series or row they belong to), as a leg (--d-leg).
/** What a step does not name stays as context: its text at GHOST (4.5:1 on a story's panel), its marks at GHOST × FAINT. */
const GHOST = 0.55, FAINT = 0.64;
const MOVE = "transition:transform var(--d-leg) var(--sail) calc(var(--k, 0) * 45ms),opacity var(--d-turn) var(--sail)";
const percent = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: 2 }) + "%";
const points = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: v < 0.0095 ? 1 : 2 });  // percentage points
const at = (node, x, y) => (node.style.transform = `translate(${x}px,${y}px)`);
const ink = document.createElement("canvas").getContext("2d");
/** How wide a text is in the site's typeface, bold, at `size` px. */
const wide = (text, size) => ((ink.font = `700 ${size}px ${css("--type")}`), ink.measureText(text).width);
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Round ticks from 0 to `top` or just past it: a step of 1, 2, 2.5 or 5 times a power of ten, at most five steps. */
const ticks = (top) => {
  const raw = top / 4, p = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999);
  return [...Array(Math.ceil(top / step - 1e-9) + 1)].map((_, i) => i * step);
};
/** The scale's lines: one per tick, and where the values are a part of a base (`base`, 1: 100%), its line stronger. */
const rules = (tick, base, line, soft, draw) => tick.map((v) => draw(v, Math.abs(v - base) < 1e-9 ? soft : line, Math.abs(v - base) < 1e-9 ? 1.5 : 1)).join("");

/** A plate's width, and its title broken into lines at that width: how much room the title takes (`top`). */
function heading(title, width) {
  const W = Math.round(Math.max(300, Math.min(760, width))), narrow = W < 480;
  const size = narrow ? 16 : 21, room = Math.floor((W - 24) / (size * 0.57)), lines = [""];
  for (const word of title.split(" ")) (lines.at(-1) + " " + word).trim().length > room ? lines.push(word) : (lines[lines.length - 1] = (lines.at(-1) + " " + word).trim());
  return { W, narrow, size, lines, top: 14 + lines.length * size * 1.14 };
}
/** A strip's legend, a dot and a name per series, wrapped into as many lines as the plate's width needs (on a wide
 *  plate the moment shown keeps the end of the first line). */
function key(series, W, narrow) {
  let x = 12, line = 0;
  const room = (l) => W - 12 - (narrow || l ? 0 : 130), width = (text) => 24 + wide(text, 12);  // (measured bold: a little wider than the 12px set, which keeps names apart)
  const marks = series.map((name) => {
    // A name longer than a whole line takes as many lines as it needs, broken at spaces, on lines of its own.
    const parts = [""];
    for (const word of name.split(" ")) width((parts.at(-1) + " " + word).trim()) > room(1) - 12 && parts.at(-1) ? parts.push(word) : (parts[parts.length - 1] = (parts.at(-1) + " " + word).trim());
    const w = Math.max(...parts.map(width));
    if (x > 12 && (x + w - 8 > room(line) || parts.length > 1)) (x = 12), line++;
    const mark = { name, parts, x, line };
    if (parts.length > 1) (line += parts.length - 1), (x = W);
    else x += w;
    return mark;
  });
  // On a phone the moment shown stands on the legend's line when that line is short enough (else under it).
  return { marks, lines: line + 1, beside: narrow && !line && x + 130 < W - 12, end: x };
}
/** A legend's name beside its mark, on the lines key() broke it into. */
const legendName = (m, top, soft) => `<text x="${m.x + 14}" y="${top + 14 + m.line * 16}" style="font-size:12px;fill:${soft}">${m.parts.map((p, i) => `<tspan x="${m.x + 14}" dy="${i ? 16 : 0}">${escape(p)}</tspan>`).join("")}</text>`;
// A strip's rows stand this far apart where they can (a name too long for its column then takes two lines), and never
// closer than the floor (the name then a little smaller instead); above and below them, the strip's own margins.
const PITCH = { narrow: 26, wide: 22, floor: 18 };
const stripRoom = (top, narrow, { lines, beside }) => top + (narrow && !beside ? 50 : 34) + (lines - 1) * 16 + 76;
/** How tall a strip of `rows` rows, titled `title` with these `series`, must be at `width`: `pitch` px apart. */
export const stripLeast = (title, rows, width, series = [], pitch = null) => {
  const { W, top, narrow } = heading(title, width);
  return Math.ceil(stripRoom(top, narrow, key(series, W, narrow)) + rows * (pitch || PITCH[narrow ? "narrow" : "wide"]));
};

/** The paper, the title broken into lines, the note and the site's name; `body(top)` draws between them. At least
 *  `least` tall. */
function sheet(spec, width, height, body, least = 0) {
  const { W, narrow, size, lines, top } = heading(spec.title, width), H = Math.round(Math.max(250, least, height || W * 0.62));
  const ink = css("--ink"), soft = css("--ink-2"), paper = css("--paper");
  const node = document.createElement("div");
  node.className = "plate";
  const page = document.documentElement;
  node.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title.replace(/"/g, "")}" style="font-family:${css("--type").replace(/"/g, "'")}">
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <text class="title" y="${size + 6}" style="font-size:${size}px;font-weight:800;fill:${ink}">${lines.map((l, k) => `<tspan x="12" dy="${k ? size * 1.14 : 0}">${l}</tspan>`).join("")}</text>
    ${body({ W, H, narrow, top, ink, soft, paper, line: css("--line"), beacon: css("--beacon") })}
    <text class="note" y="${H - 23}" style="font-size:12px;fill:${soft}"></text>
    <text x="12" y="${H - 7}" style="font-size:12px;font-weight:700;fill:${ink}">${SITE}</text>
  </svg>`;
  // The note says what was counted and over how many pages, at 12px like all text on the site: up to three lines,
  // the last one just above the site's name.
  const note = (text) => {
    const words = text.split(" "), line = Math.floor((W - 24) / 6.3), rows = [""];
    for (const word of words) (rows.at(-1) + " " + word).length > line && rows.length < 3 ? rows.push(word) : (rows[rows.length - 1] = (rows.at(-1) + " " + word).trim());
    node.querySelector(".note").innerHTML = rows.map((row, k) => `<tspan x="12" dy="${k ? 13 : -13 * (rows.length - 1)}">${row.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`).join("");
  };
  note(spec.note || "");
  if (scope !== page) drawnOn.set(node.firstElementChild, scope);
  /** The title written again (a strip's title that follows its moment), in the room the longest took. */
  const title = (text) => {
    node.querySelector(".title").innerHTML = heading(text, width).lines.map((l, k) => `<tspan x="12" dy="${k ? size * 1.14 : 0}">${escape(l)}</tspan>`).join("");
    node.firstElementChild.setAttribute("aria-label", text.replace(/"/g, ""));
  };
  return { node, svg: node.firstElementChild, W, H, narrow, top, note, title, hue: COLOURS.map((c) => css(c)), deep: css("--deep") };
}

/**
 * Lines. `spec`: {title, note, periods: [labels], series: [{label, values: [share | null], off}], pages: (i) => text,
 * base: where the values are a part of a base, the base (1), whose line is drawn stronger};
 * `off[i]` is how far value i may be off either way: drawn as a band, and written after the value.
 * Returns {node, labels, show(i, focus)}: the marker travels to period i; series not named in `focus` fade.
 */
export function plate(spec, width, height) {
  const n = spec.periods.length, B = 84, L = 40;
  const tick = ticks(Math.max(...spec.series.flatMap((s) => s.values.map((v, i) => (v || 0) + (s.off?.[i] || 0)))) || 1), most = tick.at(-1);
  let x, y, R, T, tag;
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line, beacon }) => {
    // The names at the right are as wide as the longest name with its value needs: on a phone up to half the plate;
    // a name and value longer than that go on two lines (show), never smaller than 12px.
    const long = Math.max(...spec.series.map((s) => s.label.length + (s.off ? 12 : 8)));
    [R, T] = [narrow ? Math.min(W * 0.5, Math.max(W * 0.36, 20 + 6.6 * long)) : Math.min(260, Math.max(190, 22 + 7.2 * long)), top + 22];
    tag = narrow ? 12 : 14;
    x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1);
    y = (v) => H - B - ((H - T - B) * v) / most;
    const every = Math.ceil(n / ((W - L - R) / 44));
    return `${rules(tick, spec.base, line, soft, (v, stroke, width) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${stroke}" stroke-width="${width}"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" style="font-size:12px;fill:${soft}">${percent(v)}</text>`)}
    ${spec.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - B + 15}" text-anchor="middle" style="font-size:12px;fill:${soft}">${p}</text>`)).join("")}
    <g class="marker" style="${MOVE}"><line y1="${T - 4}" y2="${H - B}" stroke="${ink}" stroke-dasharray="3 3"/><text y="${T - 9}" text-anchor="middle" style="font-size:12px;font-weight:800;fill:${ink}"></text></g>
    ${spec.series.map((s, k) => {
      const colour = css(COLOURS[k % COLOURS.length]);
      const runs = s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(`${x(i)},${y(v)}`), acc), [[]]).filter((r) => r.length);
      // Where a series says how far each value may be off, a band of that width lies under its line.
      const band = !s.off ? [] : s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(i), acc), [[]]).filter((r) => r.length > 1)
        .map((r) => [...r.map((i) => `${x(i)},${y(s.values[i] + s.off[i])}`), ...r.reverse().map((i) => `${x(i)},${y(Math.max(0, s.values[i] - s.off[i]))}`)].join(" "));
      return `<g class="series" style="--k:${k};transition:opacity var(--d-turn) var(--sail)">${band.map((b) => `<polygon class="band" points="${b}" fill="${colour}" opacity="0.16"/>`).join("")}${runs.map((r) => `<polyline class="draw" pathLength="1" points="${r.join(" ")}" fill="none" stroke="${colour}" stroke-width="${narrow ? 2.5 : 3}" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
        <circle r="${narrow ? 5.5 : 6.5}" fill="${colour}" stroke="${paper}" stroke-width="2" style="${MOVE}"/><rect class="beacon" x="${W - R + 3}" rx="4" fill="${beacon}" opacity="0" style="${MOVE}"/><text x="${W - R + 9}" style="font-size:${tag}px;font-weight:700;fill:${ink};${MOVE}"></text></g>`;
    }).join("")}`;
  });
  const marker = made.svg.querySelector(".marker"), groups = [...made.svg.querySelectorAll(".series")], { W, hue } = made, inked = css("--ink");
  /** A series' name (and value) after its dot, broken at spaces into as many lines as the column needs. */
  const name = (k, said) => {
    const dot = wide("● ", tag), room = R - 12 - dot, lines = [""];
    for (const word of said.split(" ")) wide((lines.at(-1) + " " + word).trim(), tag) > room && lines.at(-1) ? lines.push(word) : (lines[lines.length - 1] = (lines.at(-1) + " " + word).trim());
    groups[k].querySelector("text").innerHTML = `<tspan fill="${hue[k % COLOURS.length]}">● </tspan>` + lines.map((l, j) => `<tspan${j ? ` x="${W - R + 9 + dot}" dy="${tag + 2}"` : ""}>${escape(l)}</tspan>`).join("");
    const pill = groups[k].querySelector(".beacon");
    pill.setAttribute("width", dot + Math.max(...lines.map((l) => wide(l, tag))) + 12);
    pill.setAttribute("height", (tag + 2) * lines.length + 6);
    pill.setAttribute("y", -tag - 2);
    return (tag > 12 ? tag + 4 : 15) + (tag + 2) * (lines.length - 1);  // the height it takes
  };
  const show = (i, focus) => {
    at(marker, x(i), 0);
    marker.lastElementChild.textContent = spec.periods[i];
    if (spec.pages) made.note(spec.pages(i));
    // Names stand at the right, at the height of their value at the marker, in the order of their values, pushed apart
    // where their pills would touch and, where they ran past the foot of the plot, pushed back up together; then each
    // takes its box on a board (labels.js, the one placement): one that has no room is left out, never drawn over
    // another. A line with no value here is named faintly where a name is free.
    const rows = spec.series.map((s, k) => ({ k, v: s.values[i], named: !!focus?.includes(s.label) })).map((r) => ({ ...r, known: r.v !== null && r.v !== undefined }));
    const B = board([W - R, T - tag - 10, W, y(0) + 21]), box = (r, a) => [W - R + 2, a + 1 - tag, W - R + 4 + r.wide, a + 1 - tag + r.tall];  // (a pill and 2px)
    for (const r of rows) {
      name(r.k, r.known ? `${spec.series[r.k].label} ${percent(r.v)}${spec.series[r.k].off?.[i] ? " ±" + points(spec.series[r.k].off[i]) : ""}` : spec.series[r.k].label);
      const pill = groups[r.k].querySelector(".beacon");
      [r.wide, r.tall] = [+pill.getAttribute("width"), +pill.getAttribute("height") + 2];
    }
    const stack = rows.filter((r) => r.known).sort((a, b) => b.v - a.v);
    stack.forEach((r, j) => (r.at = j ? Math.max(y(r.v), stack[j - 1].at + stack[j - 1].tall) : y(r.v)));
    for (let j = stack.length - 1; j >= 0; j--) stack[j].at = Math.min(stack[j].at, j < stack.length - 1 ? stack[j + 1].at - stack[j].tall : y(0) + 20 + tag - stack[j].tall);
    for (const r of [...stack.filter((r) => r.named), ...stack.filter((r) => !r.named)]) if (!B.place([box(r, r.at)], spec.series[r.k].label)) r.at = null;
    for (const r of rows.filter((r) => !r.known)) r.at = (B.place([0, 1, 2, 3, 4, 5, 6].map((d) => box(r, T + 15 * (r.k + d))), spec.series[r.k].label)?.[1] ?? NaN) - 1 + tag || null;
    groups.forEach((g, k) => {
      const row = rows[k], [dot, pill, text] = [g.querySelector("circle"), g.querySelector(".beacon"), g.querySelector("text")];
      const named = row.known && row.named, ghost = !!focus && !named;
      // A line the step does not name stays readable as context: its name and value at GHOST, its line fainter still.
      g.style.opacity = !row.known ? 0.25 : ghost ? GHOST : 1;
      g.querySelectorAll("polyline").forEach((l) => (l.style.opacity = ghost ? FAINT : 1));
      dot.style.opacity = row.known ? (ghost ? FAINT : 1) : 0;
      if (row.known) at(dot, x(i), y(row.v));
      text.style.opacity = row.at === null ? 0 : "";
      at(text, 0, (row.at ?? T) + 4);
      // The number the caption names stands on the beacon: amber is the one number a figure wants you to see.
      at(pill, 0, (row.at ?? T) + 4);
      pill.setAttribute("opacity", +(named && row.at !== null));
      text.style.fill = named ? made.deep : inked;
    });
  };
  show(n - 1);
  // The numbers behind it, a row per period: what "download the data" writes (app.js, tools).
  const table = () => [["period", ...spec.series.flatMap((x) => (x.off ? [x.label, `${x.label} ±`] : [x.label]))],
    ...spec.periods.map((p, i) => [p, ...spec.series.flatMap((x) => (x.off ? [x.values[i], x.off[i]] : [x.values[i]]))])];
  return { node: made.node, labels: spec.periods, show, table };
}

/** A row's name, ending at `L - 9`, at height y: a name too long for its column on two lines where the rows are `gap`
 *  apart or more, else a little smaller, never under 11.5px (11px on screen where a 300px plate shows in 288px). */
function rowName(label, y, L, size, gap, ink) {
  if (label.length <= Math.floor((L - 14) / (size * 0.53))) return `<text x="${L - 9}" y="${y + size * 0.35}" text-anchor="end" style="font-size:${size}px;font-weight:600;fill:${ink}">${label}</text>`;
  // Two lines broken at the space that leaves the longer line shortest, then as large as that line allows.
  const cut = [...label].map((c, i) => (c === " " ? i : -1)).filter((i) => i > 0).sort((a, b) => Math.max(a, label.length - a) - Math.max(b, label.length - b))[0];
  const parts = cut && gap >= size * 1.9 ? [label.slice(0, cut), label.slice(cut + 1)] : [label];
  const small = Math.max(11.5, Math.min(size, (L - 14) / Math.max(...parts.map((p) => p.length)) / 0.53));
  return `<text x="${L - 9}" y="${y + small * 0.35 - (parts.length - 1) * small * 0.55}" text-anchor="end" style="font-size:${small}px;font-weight:600;fill:${ink}">${parts.map((part, i) => `<tspan x="${L - 9}" dy="${i ? small * 1.1 : 0}">${part}</tspan>`).join("")}</text>`;
}

/** Where a strip's title follows its moment (`title(moment)`), of its titles the one that takes the most room at
 *  `width`: the room every one of them is drawn in. */
export const longestTitle = (title, states, width) => (typeof title !== "function" ? title
  : states.map(title).reduce((a, b) => (heading(b, width).lines.length > heading(a, width).lines.length ? b : a)));

/**
 * Rows on one scale. `spec`: {title (or, to follow the moment shown, title(moment)), note, states: [labels], series: [names], rows: [{label, values: [state][series]}],
 * format: (v) => text, pages: (i) => text, most: the value at the right edge (else the round tick at or past the largest),
 * base: as for lines, empty: what a row with no value at a state means (its rule: too few pages), floor: the least its
 * rows stand apart (18px; a story's stage may ask for less, app.js panning)}. A row with no
 * value at the state shown has an open dash where its dots would start, and the first such row says why (`empty`). One dot per series in every row; `show(i, focus)` moves the dots to
 * state i and leaves a ring where they were at the first state; rows not named in `focus` fade.
 */
export function strip(spec, width, height) {
  const titles = spec.states.map((s) => (typeof spec.title === "function" ? spec.title(s) : spec.title));
  spec = { ...spec, title: longestTitle(spec.title, spec.states, width) };
  const format = spec.format || percent, rows = spec.rows.length;
  const tick = ticks(spec.most || Math.max(...spec.rows.flatMap((r) => r.values.flat().map((v) => v || 0))) || 1).filter((v) => !spec.most || v <= spec.most + 1e-9), most = spec.most || tick.at(-1);
  let x, y, head = 0, pitch = 0;  // (where its rows begin, and how far apart they are: a window that pans it, app.js)
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line, beacon }) => {
    const longest = Math.max(...spec.rows.map((r) => r.label.length)), L = narrow ? Math.min(W * 0.45, 16 + 7 * longest) : 200, R = narrow ? 80 : 84;
    // The legend names the series, and where the first moment stays on the strip as rings, what they are (`rings`).
    const legend = key([...spec.series, ...(spec.rings ? [spec.rings] : [])], W, narrow), extra = (legend.lines - 1) * 16;
    legend.beside &&= legend.end + 9 * Math.max(...spec.states.map((s) => s.length)) < W - 12;
    const below = narrow && !legend.beside, T = top + (below ? 50 : 34) + extra, B = 76, gap = (H - T - B) / rows;  // the margins stripRoom counts
    [head, pitch] = [T, gap];
    x = (v) => L + ((W - L - R) * v) / most;
    y = (k) => T + gap * (k + 0.5);
    const size = Math.max(12, Math.min(narrow ? 13 : 14, gap * 0.9)), name = (label, k) => rowName(label, y(k), L, size, gap, ink);
    return `${legend.marks.map((m, k) => `<g${k < spec.series.length ? "" : ` class="rings-key"`}><circle cx="${m.x + 5}" cy="${top + 10 + m.line * 16}" ${k < spec.series.length ? `r="4.5" fill="${css(COLOURS[k])}"` : `r="4" fill="none" stroke="${soft}" stroke-width="1.2"`}/>${legendName(m, top, soft)}</g>`).join("")}
    <text class="state" x="${below ? 12 : W - 12}" y="${top + (below ? 32 + extra : 15)}" text-anchor="${below ? "start" : "end"}" style="font-size:14px;font-weight:800;fill:${ink}"></text>
    ${rules(tick, spec.base, line, soft, (v, stroke, width) => `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 4}" y2="${H - B + 2}" stroke="${stroke}" stroke-width="${width}"/><text x="${x(v)}" y="${H - B + 14}" text-anchor="middle" style="font-size:12px;fill:${soft}">${format(v)}</text>`)}
    ${spec.rows.map((row, k) => `<g class="row" style="--k:${k};transition:opacity var(--d-turn) var(--sail)">${name(row.label, k)}
      <line x1="${L}" x2="${W - R}" y1="${y(k)}" y2="${y(k)}" stroke="${line}" stroke-dasharray="1 3"/>
      ${spec.series.map((_, j) => (row.values[0][j] === null || spec.states.length < 2 ? "" : `<circle cx="${x(row.values[0][j])}" cy="${y(k)}" r="4" fill="none" stroke="${css(COLOURS[j])}" stroke-width="1.2" opacity=".65"/>`)).join("")}
      ${spec.series.map((_, j) => `<circle class="dot" r="${Math.min(narrow ? 7 : 9, gap * 0.42)}" fill="${css(COLOURS[j])}" stroke="${paper}" stroke-width="1.5" style="${MOVE}"/>`).join("")}
      ${spec.empty ? `<g class="empty" opacity="0"><rect x="${L + 6}" y="${y(k) - 3}" width="18" height="6" rx="3" fill="none" stroke="${soft}" stroke-width="1.2"/><text x="${L + 32}" y="${y(k) + 4}" style="font-size:12px;fill:${soft}"></text></g>` : ""}
      <rect class="beacon" x="${W - R + 3}" y="${y(k) - 10}" height="20" rx="4" fill="${beacon}" opacity="0"/>
      <text class="value" x="${W - R + 8}" y="${y(k) + size * 0.35}" style="font-size:12px;font-weight:700;fill:${ink}"></text></g>`).join("")}`;
  }, stripLeast(spec.title, rows, width, [...spec.series, ...(spec.rings ? [spec.rings] : [])], spec.floor || PITCH.floor));
  const groups = [...made.svg.querySelectorAll(".row")], state = made.svg.querySelector(".state"), inked = css("--ink"), ringsKey = made.svg.querySelector(".rings-key");
  Object.assign(made.svg.dataset, { head, pitch });
  const show = (i, focus) => {
    state.textContent = spec.states[i];
    made.title(titles[i]);
    ringsKey?.setAttribute("opacity", +(i > 0));  // (at the first moment the dots stand on the rings: no rings to name)
    if (spec.pages) made.note(spec.pages(i));
    let told = false;
    groups.forEach((g, k) => {
      const values = spec.rows[k].values[i], known = values.filter((v) => v !== null);
      const ghost = !!focus && !focus.includes(spec.rows[k].label);
      g.style.opacity = ghost ? GHOST : 1;  // a row the step does not name: its name and values readable, its dots fainter
      g.querySelectorAll(".dot").forEach((dot, j) => ((dot.style.opacity = values[j] === null ? 0 : ghost ? FAINT : 1), values[j] !== null && at(dot, x(values[j]), y(k))));
      const [low, high] = [format(Math.min(...known)), format(Math.max(...known))], value = g.querySelector(".value"), pill = g.querySelector(".beacon");
      value.textContent = !known.length ? "" : low === high ? low : `${low.replace("%", "")}–${high.replace(/^[^0-9]+/, "")}`;
      // The rows the caption names: their numbers stand on the beacon, their names in bold.
      const named = !!focus?.includes(spec.rows[k].label) && known.length > 0;
      pill.setAttribute("width", wide(value.textContent, 12) + 10);
      pill.setAttribute("opacity", +named);
      value.style.fill = named ? made.deep : inked;
      const empty = g.querySelector(".empty");
      if (empty) (empty.setAttribute("opacity", +!known.length), (empty.lastElementChild.textContent = !known.length && !told ? ((told = true), spec.empty) : ""));
    });
  };
  show(spec.states.length - 1);
  const table = () => [["row", "state", ...spec.series], ...spec.rows.flatMap((r) => spec.states.map((state, i) => [r.label, state, ...r.values[i]]))];
  return { node: made.node, labels: spec.states, show, table };
}

/**
 * A count read by hand, one mark per place read (a unit chart). `spec`: {title, note, rows: [{label, marks: [the fill
 * of each mark]}], fills: [{label, n}], rest: the last fill is what the reading did not sort (an open ring)}. Each
 * row's marks stand in a block after its name, ordered by fill, its count at the block's end; the fills are named with
 * their counts above. Its marks come in one after another each time it is shown (style.css, .tally).
 */
export function units(spec, width, height) {
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft }) => {
    const legend = key(spec.fills.map((f) => `${f.label} ${f.n}`), W, true), T = top + 34 + (legend.lines - 1) * 16, B = 52, size = narrow ? 13 : 14;
    const longest = Math.max(...spec.rows.map((r) => r.label.length)), L = narrow ? Math.min(W * 0.4, 16 + 7 * longest) : 200, room = W - L - 40;
    const two = (label) => label.length > Math.floor((L - 14) / (size * 0.53));  // (rowName: such a name takes two lines)
    // The largest pitch at which every block fits: a line of marks `pitch` tall, a block at least as tall as its name.
    const tall = (p) => spec.rows.map((r) => Math.max(Math.ceil(r.marks.length / Math.floor(room / p)) * p, two(r.label) ? size * 2.3 : size * 1.2));
    let pitch = narrow ? 18 : 26;
    while (pitch > 6 && tall(pitch).reduce((a, b) => a + b, pitch * 0.7 * (spec.rows.length - 1)) > H - T - B) pitch -= 0.5;
    const per = Math.floor(room / pitch), heights = tall(pitch), r = pitch * 0.36, mark = (f) => (spec.rest && f === spec.fills.length - 1 ? `fill="none" stroke="${soft}" stroke-width="1.2"` : `fill="${css(COLOURS[f])}"`);
    let y = T, k = 0;
    const blocks = spec.rows.map((row, g) => {
      const first = y + pitch / 2, lines = Math.ceil(row.marks.length / per), mid = first + ((lines - 1) * pitch) / 2;
      const marks = row.marks.map((f, i) => `<circle class="tally" style="--k:${k++}" cx="${L + (i % per) * pitch + pitch / 2}" cy="${first + Math.floor(i / per) * pitch}" r="${r}" ${mark(f)}/>`).join("");
      y += heights[g] + pitch * 0.7;
      return `<g class="group">${rowName(row.label, mid, L, size, heights[g] + pitch * 0.7, ink)}${marks}<text x="${L + Math.min(row.marks.length, per) * pitch + 5}" y="${mid + 4.5}" style="font-size:13px;font-weight:800;fill:${ink}">${row.marks.length}</text></g>`;
    });
    return `${legend.marks.map((m, f) => `<circle cx="${m.x + 5}" cy="${top + 10 + m.line * 16}" r="4.5" ${mark(f)}/>${legendName(m, top, soft)}`).join("")}${blocks.join("")}`;
  });
  const table = () => [["row", "fill", "places"], ...spec.rows.flatMap((r) => spec.fills.map((f, i) => [r.label, f.label, r.marks.filter((x) => x === i).length]))];
  return { node: made.node, labels: [String(spec.rows.reduce((n, r) => n + r.marks.length, 0))], show: () => {}, table };
}

/**
 * Several plates in one place, of which one is seen: `labels[i]` names plate i. All are made once and none is
 * made again. `show(i, focus, k)` shows plate i at its moment k (the last if not given).
 */
export function plates(labels, make) {
  const node = document.createElement("div"), made = labels.map((_, i) => make(i));
  let shown = 0;
  node.className = "plates";
  node.append(...made.map((m) => m.node));
  const show = (i, focus, k = made[i].labels.length - 1) => {
    shown = i;
    made.forEach((m, j) => m.node.classList.toggle("off", j !== i));
    made[i].show(k, focus);
  };
  show(0);
  return { node, labels, show, table: () => made[shown].table() };
}

/** A plate drawn in the inks of `from` (a stage), in the page's inks instead: each ink it was drawn in, as written
 *  (#hex, rgb() where a mark's style was set, transparent for the stage's paper), for the page's. */
const INKS = ["--paper", "--ink", "--ink-2", "--ink-3", "--line", "--beacon", "--deep", ...COLOURS];
function onPaper(text, from) {
  if (!from) return text;
  const swap = new Map();
  for (const name of INKS) {
    const night = css(name, from).toLowerCase(), day = css(name, document.documentElement);
    if (!night || night === day.toLowerCase()) continue;
    swap.set(night, day);
    if (/^#[0-9a-f]{6}$/.test(night)) swap.set(`rgb(${[1, 3, 5].map((i) => parseInt(night.slice(i, i + 2), 16)).join(", ")})`, day);
  }
  const words = [...swap.keys()].map((k) => k.replace(/[()]/g, "\\$&"));
  return words.length ? text.replace(new RegExp(words.join("|"), "gi"), (m) => swap.get(m.toLowerCase())) : text;
}

let typeface; // the site's typeface as a data address, fetched when an image is first saved

/** The plate seen under `node` saved as a PNG file. */
export async function savePlate(node, name) {
  const url = URL.createObjectURL(await plateImage(node));
  Object.assign(document.createElement("a"), { href: url, download: `${name}.png` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** The plate seen under `node` as a PNG image (a Blob), twice its size on screen, in the site's own typeface. */
export async function plateImage(node) {
  const shown = node.querySelector(".plate:not(.off) svg"), svg = shown.cloneNode(true), image = new Image();
  typeface ||= fetch("bricolage.woff2").then((r) => r.blob()).then((blob) => new Promise((done) => Object.assign(new FileReader(), { onload: (e) => done(e.target.result) }).readAsDataURL(blob)));
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `@font-face{font-family:"Bricolage";src:url(${await typeface}) format("woff2");font-weight:200 800;font-stretch:75% 100%}`;
  svg.prepend(style);
  svg.querySelectorAll("[style]").forEach((n) => (n.style.transition = "none"));
  const [w, h] = [svg.width.baseVal.value, svg.height.baseVal.value];
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(onPaper(new XMLSerializer().serializeToString(svg), drawnOn.get(shown)));
  await image.decode();
  await document.fonts.ready;
  const canvas = Object.assign(document.createElement("canvas"), { width: 2 * w, height: 2 * h });
  canvas.getContext("2d").drawImage(image, 0, 0, 2 * w, 2 * h);
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail()), "image/png"));
}
