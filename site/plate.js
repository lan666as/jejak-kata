// Plates: figures that can stand alone as an image. The title says the finding, every mark is named, the number
// of pages behind it and the site are written on it. Two kinds: `plate` (lines over periods, a marker that
// travels) and `strip` (rows on one scale, dots that travel from one state to the next). Nothing is redrawn
// when the moment changes: the marks move.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Up to nine series (the ninth in ink), each its own hue in light and dark (style.css, --cat-1..8: magenta first, then orange).
const COLOURS = ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6", "--cat-7", "--cat-8", "--cat-9"];
const SITE = "Jejak Kata · zidan.dev/jejak-kata";
// Marks travel on the site's curve, one after another (--k: the series or row they belong to), as a leg (--d-leg).
const MOVE = "transition:transform var(--d-leg) var(--sail) calc(var(--k, 0) * 45ms),opacity var(--d-turn) var(--sail)";
const percent = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: 2 }) + "%";
const points = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: v < 0.0095 ? 1 : 2 });  // percentage points
const at = (node, x, y) => (node.style.transform = `translate(${x}px,${y}px)`);
const ink = document.createElement("canvas").getContext("2d");
/** How wide a text is in the site's typeface, bold, at `size` px. */
const wide = (text, size) => ((ink.font = `700 ${size}px ${css("--type")}`), ink.measureText(text).width);
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

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
  const marks = series.map((name) => {
    const width = 22 + name.length * 7;
    if (x > 12 && x + width - 8 > W - 12 - (narrow || line ? 0 : 130)) (x = 12), line++;
    const mark = { name, x, line };
    x += width;
    return mark;
  });
  // On a phone the moment shown stands on the legend's line when that line is short enough (else under it).
  return { marks, lines: line + 1, beside: narrow && !line && x + 130 < W - 12, end: x };
}
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
  node.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title.replace(/"/g, "")}" style="font-family:${css("--type").replace(/"/g, "'")}">
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <text y="${size + 6}" style="font-size:${size}px;font-weight:800;fill:${ink}">${lines.map((l, k) => `<tspan x="12" dy="${k ? size * 1.14 : 0}">${l}</tspan>`).join("")}</text>
    ${body({ W, H, narrow, top, ink, soft, paper, line: css("--line") })}
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
  return { node, svg: node.firstElementChild, W, H, narrow, top, note };
}

/**
 * Lines. `spec`: {title, note, periods: [labels], series: [{label, values: [share | null], off}], pages: (i) => text};
 * `off[i]` is how far value i may be off either way: drawn as a band, and written after the value.
 * Returns {node, labels, show(i, focus)}: the marker travels to period i; series not named in `focus` fade.
 */
export function plate(spec, width, height) {
  const n = spec.periods.length, B = 84, L = 40;
  const most = Math.max(...spec.series.flatMap((s) => s.values.map((v, i) => (v || 0) + (s.off?.[i] || 0)))) * 1.08 || 1;
  let x, y, R, T, tag;
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line }) => {
    // The names at the right are as wide as the longest name with its value needs: on a phone up to half the plate;
    // a name and value longer than that go on two lines (show), never smaller than 12px.
    const long = Math.max(...spec.series.map((s) => s.label.length + (s.off ? 12 : 8)));
    [R, T] = [narrow ? Math.min(W * 0.5, Math.max(W * 0.36, 20 + 6.6 * long)) : Math.min(260, Math.max(190, 22 + 7.2 * long)), top + 22];
    tag = narrow ? 12 : 13;
    x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1);
    y = (v) => H - B - ((H - T - B) * v) / most;
    const every = Math.ceil(n / ((W - L - R) / 44));
    return `${[0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(most * f)}" y2="${y(most * f)}" stroke="${line}"/><text x="${L - 5}" y="${y(most * f) + 4}" text-anchor="end" style="font-size:12px;fill:${soft}">${percent(most * f)}</text>`).join("")}
    ${spec.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - B + 15}" text-anchor="middle" style="font-size:12px;fill:${soft}">${p}</text>`)).join("")}
    <g class="marker" style="${MOVE}"><line y1="${T - 4}" y2="${H - B}" stroke="${ink}" stroke-dasharray="3 3"/><text y="${T - 9}" text-anchor="middle" style="font-size:12px;font-weight:800;fill:${ink}"></text></g>
    ${spec.series.map((s, k) => {
      const colour = css(COLOURS[k % COLOURS.length]);
      const runs = s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(`${x(i)},${y(v)}`), acc), [[]]).filter((r) => r.length);
      // Where a series says how far each value may be off, a band of that width lies under its line.
      const band = !s.off ? [] : s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(i), acc), [[]]).filter((r) => r.length > 1)
        .map((r) => [...r.map((i) => `${x(i)},${y(s.values[i] + s.off[i])}`), ...r.reverse().map((i) => `${x(i)},${y(Math.max(0, s.values[i] - s.off[i]))}`)].join(" "));
      return `<g class="series" style="--k:${k};transition:opacity var(--d-turn) var(--sail)">${band.map((b) => `<polygon class="band" points="${b}" fill="${colour}" opacity="0.16"/>`).join("")}${runs.map((r) => `<polyline class="draw" pathLength="1" points="${r.join(" ")}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
        <circle r="5" fill="${colour}" stroke="${paper}" stroke-width="2" style="${MOVE}"/><text x="${W - R + 9}" style="font-size:${tag}px;font-weight:700;fill:${ink};${MOVE}"></text></g>`;
    }).join("")}`;
  });
  const marker = made.svg.querySelector(".marker"), groups = [...made.svg.querySelectorAll(".series")], { W } = made;
  /** A series' name (and value) after its dot, broken at spaces into as many lines as the column needs. */
  const name = (k, said) => {
    const dot = wide("● ", tag), room = R - 12 - dot, lines = [""];
    for (const word of said.split(" ")) wide((lines.at(-1) + " " + word).trim(), tag) > room && lines.at(-1) ? lines.push(word) : (lines[lines.length - 1] = (lines.at(-1) + " " + word).trim());
    groups[k].querySelector("text").innerHTML = `<tspan fill="${css(COLOURS[k % COLOURS.length])}">● </tspan>` + lines.map((l, j) => `<tspan${j ? ` x="${W - R + 9 + dot}" dy="${tag + 2}"` : ""}>${escape(l)}</tspan>`).join("");
    return 15 + (tag + 2) * (lines.length - 1);  // the height it takes
  };
  const show = (i, focus) => {
    at(marker, x(i), 0);
    marker.lastElementChild.textContent = spec.periods[i];
    if (spec.pages) made.note(spec.pages(i));
    // Names stand at the right, at the height of their value at the marker, pushed apart where they would touch.
    const rows = spec.series.map((s, k) => ({ k, v: s.values[i] })).filter((r) => r.v !== null && r.v !== undefined).sort((a, b) => b.v - a.v);
    for (const r of rows) r.h = name(r.k, `${spec.series[r.k].label} ${percent(r.v)}${spec.series[r.k].off?.[i] ? " ±" + points(spec.series[r.k].off[i]) : ""}`);
    rows.forEach((r, j) => (r.at = j ? Math.max(y(r.v), rows[j - 1].at + rows[j - 1].h) : y(r.v)));
    // ... and, where they ran past the foot of the plot, pushed back up together.
    for (let j = rows.length - 1; j >= 0; j--) rows[j].at = Math.min(rows[j].at, j < rows.length - 1 ? rows[j + 1].at - rows[j].h : y(0) + 15 - rows[j].h);
    groups.forEach((g, k) => {
      const row = rows.find((r) => r.k === k), [dot, text] = [g.querySelector("circle"), g.querySelector("text")];
      g.style.opacity = !row ? 0.25 : focus && !focus.includes(spec.series[k].label) ? 0.2 : 1;
      dot.style.opacity = row ? 1 : 0;
      if (!row) name(k, spec.series[k].label);
      if (row) at(dot, x(i), y(row.v));
      at(text, 0, (row ? row.at : T + 15 * k) + 4);
    });
  };
  show(n - 1);
  return { node: made.node, labels: spec.periods, show };
}

/**
 * Rows on one scale. `spec`: {title, note, states: [labels], series: [names], rows: [{label, values: [state][series]}],
 * format: (v) => text, pages: (i) => text, most: the value at the right edge (else just past the largest)}. One dot per series in every row; `show(i, focus)` moves the dots to
 * state i and leaves a ring where they were at the first state; rows not named in `focus` fade.
 */
export function strip(spec, width, height) {
  const format = spec.format || percent, rows = spec.rows.length;
  const most = spec.most || Math.max(...spec.rows.flatMap((r) => r.values.flat().map((v) => v || 0))) * 1.05 || 1;
  let x, y;
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line }) => {
    const longest = Math.max(...spec.rows.map((r) => r.label.length)), L = narrow ? Math.min(W * 0.45, 16 + 7 * longest) : 178, R = narrow ? 80 : 84;
    const legend = key(spec.series, W, narrow), extra = (legend.lines - 1) * 16;
    legend.beside &&= legend.end + 9 * Math.max(...spec.states.map((s) => s.length)) < W - 12;
    const below = narrow && !legend.beside, T = top + (below ? 50 : 34) + extra, B = 76, gap = (H - T - B) / rows;  // the margins stripRoom counts
    x = (v) => L + ((W - L - R) * v) / most;
    y = (k) => T + gap * (k + 0.5);
    const size = Math.max(12, Math.min(13, gap * 0.9)), fits = Math.floor((L - 14) / (size * 0.53));
    // A name too long for its column: on two lines where the rows are far enough apart, else a little smaller.
    const name = (label, k) => {
      if (label.length <= fits) return `<text x="${L - 9}" y="${y(k) + size * 0.35}" text-anchor="end" style="font-size:${size}px;font-weight:600;fill:${ink}">${label}</text>`;
      // Two lines broken at the space that leaves the longer line shortest, then as large as that line allows.
      const cut = [...label].map((c, i) => (c === " " ? i : -1)).filter((i) => i > 0).sort((a, b) => Math.max(a, label.length - a) - Math.max(b, label.length - b))[0];
      const parts = cut && gap >= size * 1.9 ? [label.slice(0, cut), label.slice(cut + 1)] : [label];
      const small = Math.max(10, Math.min(size, (L - 14) / Math.max(...parts.map((p) => p.length)) / 0.53));
      return `<text x="${L - 9}" y="${y(k) + small * 0.35 - (parts.length - 1) * small * 0.55}" text-anchor="end" style="font-size:${small}px;font-weight:600;fill:${ink}">${parts.map((part, i) => `<tspan x="${L - 9}" dy="${i ? small * 1.1 : 0}">${part}</tspan>`).join("")}</text>`;
    };
    return `${legend.marks.map((m, k) => `<circle cx="${m.x + 5}" cy="${top + 10 + m.line * 16}" r="4.5" fill="${css(COLOURS[k])}"/><text x="${m.x + 14}" y="${top + 14 + m.line * 16}" style="font-size:12px;fill:${soft}">${m.name}</text>`).join("")}
    <text class="state" x="${below ? 12 : W - 12}" y="${top + (below ? 32 + extra : 15)}" text-anchor="${below ? "start" : "end"}" style="font-size:14px;font-weight:800;fill:${ink}"></text>
    ${[0, 0.5, 1].map((f) => `<line x1="${x(most * f)}" x2="${x(most * f)}" y1="${T - 4}" y2="${H - B + 2}" stroke="${line}"/><text x="${x(most * f)}" y="${H - B + 14}" text-anchor="middle" style="font-size:12px;fill:${soft}">${format(most * f)}</text>`).join("")}
    ${spec.rows.map((row, k) => `<g class="row" style="--k:${k};transition:opacity var(--d-turn) var(--sail)">${name(row.label, k)}
      <line x1="${L}" x2="${W - R}" y1="${y(k)}" y2="${y(k)}" stroke="${line}" stroke-dasharray="1 3"/>
      ${spec.series.map((_, j) => (row.values[0][j] === null || spec.states.length < 2 ? "" : `<circle cx="${x(row.values[0][j])}" cy="${y(k)}" r="4" fill="none" stroke="${css(COLOURS[j])}" stroke-width="1.2" opacity=".65"/>`)).join("")}
      ${spec.series.map((_, j) => `<circle class="dot" r="${Math.min(5.5, gap * 0.36)}" fill="${css(COLOURS[j])}" stroke="${paper}" stroke-width="1.5" style="${MOVE}"/>`).join("")}
      <text class="value" x="${W - R + 8}" y="${y(k) + size * 0.35}" style="font-size:12px;font-weight:700;fill:${ink}"></text></g>`).join("")}`;
  }, stripLeast(spec.title, rows, width, spec.series, PITCH.floor));
  const groups = [...made.svg.querySelectorAll(".row")], state = made.svg.querySelector(".state");
  const show = (i, focus) => {
    state.textContent = spec.states[i];
    if (spec.pages) made.note(spec.pages(i));
    groups.forEach((g, k) => {
      const values = spec.rows[k].values[i], known = values.filter((v) => v !== null);
      g.style.opacity = focus && !focus.includes(spec.rows[k].label) ? 0.28 : 1;
      g.querySelectorAll(".dot").forEach((dot, j) => ((dot.style.opacity = values[j] === null ? 0 : 1), values[j] !== null && at(dot, x(values[j]), y(k))));
      const [low, high] = [format(Math.min(...known)), format(Math.max(...known))];
      g.querySelector(".value").textContent = !known.length ? "" : low === high ? low : `${low.replace("%", "")}–${high.replace(/^[^0-9]+/, "")}`;
    });
  };
  show(spec.states.length - 1);
  return { node: made.node, labels: spec.states, show };
}

/**
 * Several plates in one place, of which one is seen: `labels[i]` names plate i. All are made once and none is
 * made again. `show(i, focus, mark)` shows plate i at its moment `mark` (a label of its own; the last if not given).
 */
export function plates(labels, make) {
  const node = document.createElement("div"), made = labels.map((_, i) => make(i));
  node.className = "plates";
  node.append(...made.map((m) => m.node));
  const show = (i, focus, mark) => {
    made.forEach((m, k) => m.node.classList.toggle("off", k !== i));
    made[i].show(Math.max(0, mark === undefined ? made[i].labels.length - 1 : made[i].labels.indexOf(mark)), focus);
  };
  show(0);
  return { node, labels, show };
}

let typeface; // the site's typeface as a data address, fetched when an image is first saved

/** The plate seen under `node` as a PNG file, twice its size on screen, in the site's own typeface. */
export async function savePlate(node, name) {
  const svg = node.querySelector(".plate:not(.off) svg").cloneNode(true), image = new Image();
  typeface ||= fetch("bricolage.woff2").then((r) => r.blob()).then((blob) => new Promise((done) => Object.assign(new FileReader(), { onload: (e) => done(e.target.result) }).readAsDataURL(blob)));
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `@font-face{font-family:"Bricolage";src:url(${await typeface}) format("woff2");font-weight:200 800;font-stretch:75% 100%}`;
  svg.prepend(style);
  svg.querySelectorAll("[style]").forEach((n) => (n.style.transition = "none"));
  const [w, h] = [svg.width.baseVal.value, svg.height.baseVal.value];
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await image.decode();
  await document.fonts.ready;
  const canvas = Object.assign(document.createElement("canvas"), { width: 2 * w, height: 2 * h });
  canvas.getContext("2d").drawImage(image, 0, 0, 2 * w, 2 * h);
  Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: `${name}.png` }).click();
}
