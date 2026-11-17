// Plates: figures that can stand alone as an image. The title says the finding, every mark is named, the number
// of pages behind it and the site are written on it. Two kinds: `plate` (lines over periods, a marker that
// travels) and `strip` (rows on one scale, dots that travel from one state to the next). Nothing is redrawn
// when the moment changes: the marks move.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLOURS = ["--route", "--route-2", "--link", "--ink", "--ink-3", "--organisation"];
const SITE = "Jejak Kata · zidan.dev/jejak-kata";
const MOVE = "transition:transform .6s cubic-bezier(.45,.05,.25,1),opacity .3s";
const percent = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: 2 }) + "%";
const points = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: v < 0.0095 ? 1 : 2 });  // percentage points
const at = (node, x, y) => (node.style.transform = `translate(${x}px,${y}px)`);

/** The paper, the title broken into lines, the note and the site's name; `body(top)` draws between them. */
function sheet(spec, width, height, body) {
  const W = Math.round(Math.max(300, Math.min(760, width))), H = Math.round(Math.max(250, height || W * 0.62)), narrow = W < 480;
  const size = narrow ? 16 : 21, room = Math.floor((W - 24) / (size * 0.57)), lines = [""];
  for (const word of spec.title.split(" ")) (lines.at(-1) + " " + word).trim().length > room ? lines.push(word) : (lines[lines.length - 1] = (lines.at(-1) + " " + word).trim());
  const top = 14 + lines.length * size * 1.14;
  const ink = css("--ink"), soft = css("--ink-2"), paper = css("--paper");
  const node = document.createElement("div");
  node.className = "plate";
  node.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title.replace(/"/g, "")}" style="font-family:${css("--type").replace(/"/g, "'")}">
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <text y="${size + 6}" style="font-size:${size}px;font-weight:800;fill:${ink}">${lines.map((l, k) => `<tspan x="12" dy="${k ? size * 1.14 : 0}">${l}</tspan>`).join("")}</text>
    ${body({ W, H, narrow, top, ink, soft, paper, line: css("--line") })}
    <text class="note" y="${H - 34}" style="font-size:10.5px;fill:${soft}"></text>
    <text x="12" y="${H - 8}" style="font-size:10.5px;font-weight:700;fill:${ink}">${SITE}</text>
  </svg>`;
  // The note says what was counted and over how many pages; it takes two lines when it has to.
  const note = (text) => {
    const words = text.split(" "), half = Math.floor((W - 24) / 5.2), rows = [""];
    for (const word of words) (rows.at(-1) + " " + word).length > half && rows.length < 2 ? rows.push(word) : (rows[rows.length - 1] = (rows.at(-1) + " " + word).trim());
    node.querySelector(".note").innerHTML = rows.map((row, k) => `<tspan x="12" dy="${k ? 12 : rows.length > 1 ? 0 : 12}">${row.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`).join("");
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
  const n = spec.periods.length, B = 70, L = 40;
  const most = Math.max(...spec.series.flatMap((s) => s.values.map((v, i) => (v || 0) + (s.off?.[i] || 0)))) * 1.08 || 1;
  let x, y, R, T;
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line }) => {
    [R, T] = [narrow ? W * 0.43 : 190, top + 22];
    x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1);
    y = (v) => H - B - ((H - T - B) * v) / most;
    const every = Math.ceil(n / ((W - L - R) / 44));
    return `${[0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(most * f)}" y2="${y(most * f)}" stroke="${line}"/><text x="${L - 5}" y="${y(most * f) + 4}" text-anchor="end" style="font-size:10.5px;fill:${soft}">${percent(most * f)}</text>`).join("")}
    ${spec.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - B + 15}" text-anchor="middle" style="font-size:10.5px;fill:${soft}">${p}</text>`)).join("")}
    <g class="marker" style="${MOVE}"><line y1="${T - 4}" y2="${H - B}" stroke="${ink}" stroke-dasharray="3 3"/><text y="${T - 9}" text-anchor="middle" style="font-size:12px;font-weight:800;fill:${ink}"></text></g>
    ${spec.series.map((s, k) => {
      const colour = css(COLOURS[k % COLOURS.length]);
      const runs = s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(`${x(i)},${y(v)}`), acc), [[]]).filter((r) => r.length);
      // Where a series says how far each value may be off, a band of that width lies under its line.
      const band = !s.off ? [] : s.values.reduce((acc, v, i) => (v === null ? acc.push([]) : acc.at(-1).push(i), acc), [[]]).filter((r) => r.length > 1)
        .map((r) => [...r.map((i) => `${x(i)},${y(s.values[i] + s.off[i])}`), ...r.reverse().map((i) => `${x(i)},${y(Math.max(0, s.values[i] - s.off[i]))}`)].join(" "));
      return `<g class="series" style="transition:opacity .3s">${band.map((b) => `<polygon points="${b}" fill="${colour}" opacity="0.16"/>`).join("")}${runs.map((r) => `<polyline points="${r.join(" ")}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
        <circle r="5" fill="${colour}" stroke="${paper}" stroke-width="2" style="${MOVE}"/><text x="${W - R + 9}" style="font-size:${narrow ? 11.5 : 13}px;font-weight:700;fill:${colour};${MOVE}"></text></g>`;
    }).join("")}`;
  });
  const marker = made.svg.querySelector(".marker"), groups = [...made.svg.querySelectorAll(".series")];
  const show = (i, focus) => {
    at(marker, x(i), 0);
    marker.lastElementChild.textContent = spec.periods[i];
    if (spec.pages) made.note(spec.pages(i));
    // Names stand at the right, at the height of their value at the marker, pushed apart where they would touch.
    const rows = spec.series.map((s, k) => ({ k, v: s.values[i] })).filter((r) => r.v !== null && r.v !== undefined).sort((a, b) => b.v - a.v);
    rows.forEach((r, j) => (r.at = j ? Math.max(y(r.v), rows[j - 1].at + 15) : y(r.v)));
    groups.forEach((g, k) => {
      const row = rows.find((r) => r.k === k), [dot, text] = [g.querySelector("circle"), g.querySelector("text")];
      g.style.opacity = !row ? 0.25 : focus && !focus.includes(spec.series[k].label) ? 0.2 : 1;
      dot.style.opacity = row ? 1 : 0;
      text.textContent = row ? `${spec.series[k].label} ${percent(row.v)}${spec.series[k].off?.[i] ? " ±" + points(spec.series[k].off[i]) : ""}` : spec.series[k].label;
      if (row) at(dot, x(i), y(row.v));
      at(text, 0, (row ? row.at : T + 15 * k) + 4);
    });
  };
  show(n - 1);
  return { node: made.node, labels: spec.periods, show };
}

/**
 * Rows on one scale. `spec`: {title, note, states: [labels], series: [names], rows: [{label, values: [state][series]}],
 * format: (v) => text, pages: (i) => text}. One dot per series in every row; `show(i, focus)` moves the dots to
 * state i and leaves a ring where they were at the first state; rows not named in `focus` fade.
 */
export function strip(spec, width, height) {
  const format = spec.format || percent, rows = spec.rows.length;
  const most = Math.max(...spec.rows.flatMap((r) => r.values.flat().map((v) => v || 0))) * 1.05 || 1;
  let x, y;
  const made = sheet(spec, width, height, ({ W, H, narrow, top, ink, soft, paper, line }) => {
    const longest = Math.max(...spec.rows.map((r) => r.label.length)), L = narrow ? Math.min(W * 0.46, 16 + 6.9 * longest) : 178, R = narrow ? 66 : 84;
    const T = top + (narrow ? 50 : 34), B = 62, gap = (H - T - B) / rows;
    x = (v) => L + ((W - L - R) * v) / most;
    y = (k) => T + gap * (k + 0.5);
    const size = Math.min(narrow ? 11.5 : 13, gap * 0.9);
    let legend = 12;
    return `${spec.series.map((name, k) => {
      const here = legend;
      legend += 22 + name.length * 6.4;
      return `<circle cx="${here + 5}" cy="${top + 10}" r="4.5" fill="${css(COLOURS[k])}"/><text x="${here + 14}" y="${top + 14}" style="font-size:11px;fill:${soft}">${name}</text>`;
    }).join("")}
    <text class="state" x="${narrow ? 12 : W - 12}" y="${top + (narrow ? 32 : 15)}" text-anchor="${narrow ? "start" : "end"}" style="font-size:14px;font-weight:800;fill:${ink}"></text>
    ${[0, 0.5, 1].map((f) => `<line x1="${x(most * f)}" x2="${x(most * f)}" y1="${T - 4}" y2="${H - B + 2}" stroke="${line}"/><text x="${x(most * f)}" y="${H - B + 14}" text-anchor="middle" style="font-size:10.5px;fill:${soft}">${format(most * f)}</text>`).join("")}
    ${spec.rows.map((row, k) => `<g class="row" style="transition:opacity .3s"><text x="${L - 9}" y="${y(k) + size * 0.35}" text-anchor="end" style="font-size:${size}px;font-weight:600;fill:${ink}">${row.label}</text>
      <line x1="${L}" x2="${W - R}" y1="${y(k)}" y2="${y(k)}" stroke="${line}" stroke-dasharray="1 3"/>
      ${spec.series.map((_, j) => (row.values[0][j] === null || spec.states.length < 2 ? "" : `<circle cx="${x(row.values[0][j])}" cy="${y(k)}" r="4" fill="none" stroke="${css(COLOURS[j])}" stroke-width="1.2" opacity=".65"/>`)).join("")}
      ${spec.series.map((_, j) => `<circle class="dot" r="${Math.min(5.5, gap * 0.36)}" fill="${css(COLOURS[j])}" stroke="${paper}" stroke-width="1.5" style="${MOVE}"/>`).join("")}
      <text class="value" x="${W - R + 8}" y="${y(k) + size * 0.35}" style="font-size:${Math.min(size, 12)}px;font-weight:700;fill:${ink}"></text></g>`).join("")}`;
  });
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
