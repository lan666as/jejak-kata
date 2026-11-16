// A plate: one line chart that can stand alone as an image. Its title says the finding, every line is named
// at its end with its value, and the source is written on it. Used by the stories.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLOURS = ["--route", "--route-2", "--ink", "--link", "--ink-3", "--organisation"];
const SITE = "Jejak Kata · zidan.dev/jejak-kata";

/**
 * `spec`: {title, note, periods: [labels], series: [{label, values: [number | null]}], source}
 * Values are shares (0..1). Returns {node, labels, show(i, focus)}: `show` puts the marker on period i and,
 * when `focus` names some series, fades the others.
 */
export function plate(spec, width) {
  const W = Math.max(300, Math.min(760, width)), H = Math.round(Math.max(300, W * 0.62)), narrow = W < 480, L = 40, R = narrow ? W * 0.45 : 180, T = narrow ? 96 : 74, B = 62;
  const n = spec.periods.length;
  const top = Math.max(...spec.series.flatMap((s) => s.values.map((v) => v || 0))) * 1.08 || 1;
  const x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1), y = (v) => H - B - ((H - T - B) * v) / top;
  const pct = (v) => (v * 100).toLocaleString(document.documentElement.lang, { maximumSignificantDigits: 2 }) + "%";
  const ink = css("--ink"), soft = css("--ink-2"), line = css("--line"), paper = css("--paper"), font = css("--type");
  const node = document.createElement("div");
  node.className = "plate";
  const every = Math.ceil(n / ((W - L - R) / 46));
  const wrap = (text, size, max) => {
    // Break a title into lines of at most `max` characters, at spaces.
    const lines = [""];
    for (const word of text.split(" ")) (lines.at(-1) + " " + word).trim().length > max ? lines.push(word) : (lines[lines.length - 1] = (lines.at(-1) + " " + word).trim());
    return lines.slice(0, 3).map((l, k) => `<tspan x="12" dy="${k ? size * 1.12 : 0}">${l}</tspan>`).join("");
  };
  const titleSize = W < 480 ? 17 : 22;
  node.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title.replace(/"/g, "")}" style="font-family:${font.replace(/"/g, "'")}">
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <text y="${titleSize + 8}" style="font-size:${titleSize}px;font-weight:800;fill:${ink}">${wrap(spec.title, titleSize, Math.floor((W - 24) / (titleSize * 0.5)))}</text>
    ${[0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}" stroke="${line}"/><text x="${L - 5}" y="${y(top * f) + 4}" text-anchor="end" style="font-size:11px;fill:${soft}">${pct(top * f)}</text>`).join("")}
    ${spec.periods.map((p, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - B + 16}" text-anchor="middle" style="font-size:11px;fill:${soft}">${p}</text>`)).join("")}
    <line class="marker" y1="${T - 6}" y2="${H - B}" stroke="${ink}" stroke-dasharray="3 3"/>
    ${spec.series.map((s, k) => {
      const colour = css(COLOURS[k % COLOURS.length]);
      const points = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`));
      const runs = points.reduce((acc, p) => (p ? (acc.at(-1).push(p), acc) : (acc.push([]), acc)), [[]]).filter((r) => r.length);
      return `<g class="series" data-k="${k}">${runs.map((r) => `<polyline points="${r.join(" ")}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
        <circle r="5" fill="${colour}" stroke="${paper}" stroke-width="2"/><text style="font-size:${narrow ? 11.5 : 13}px;font-weight:700;fill:${colour}"></text></g>`;
    }).join("")}
    <text x="12" y="${H - 24}" style="font-size:11px;fill:${soft}">${spec.note || ""}</text>
    <text x="12" y="${H - 8}" style="font-size:11px;font-weight:700;fill:${ink}">${SITE}</text>
  </svg>`;
  const svg = node.firstElementChild, marker = svg.querySelector(".marker"), groups = [...svg.querySelectorAll(".series")];
  const show = (i, focus) => {
    marker.setAttribute("x1", x(i));
    marker.setAttribute("x2", x(i));
    // Names stand at the right edge, at the height of their value at the marker, pushed apart where they would touch.
    const rows = spec.series.map((s, k) => ({ k, v: s.values[i], at: s.values[i] === null ? null : y(s.values[i]) })).filter((r) => r.at !== null).sort((a, b) => a.at - b.at);
    rows.forEach((r, j) => (r.label = j && r.at - rows[j - 1].label < 15 ? rows[j - 1].label + 15 : r.at));
    groups.forEach((g, k) => {
      const row = rows.find((r) => r.k === k), [dot, text] = [g.querySelector("circle"), g.querySelector("text")];
      g.style.opacity = !row ? 0.25 : focus && !focus.includes(spec.series[k].label) ? 0.22 : 1;
      dot.setAttribute("visibility", row ? "visible" : "hidden");
      text.textContent = row ? `${spec.series[k].label} ${pct(row.v)}` : spec.series[k].label;
      if (row) (dot.setAttribute("cx", x(i)), dot.setAttribute("cy", row.at));
      text.setAttribute("x", W - R + 8);
      text.setAttribute("y", (row ? row.label : T + 15 * k) + 4);
    });
  };
  show(n - 1);
  return { node, labels: spec.periods, show };
}

/** Several plates of which one is shown: `labels[i]` names plate i. */
export function plates(labels, make) {
  const node = document.createElement("div");
  const show = (i) => node.replaceChildren(make(i).node);
  show(0);
  return { node, labels, show };
}

/** The plate under `node` as a PNG file, twice its size on screen. */
export async function savePlate(node, name) {
  const svg = node.querySelector("svg"), image = new Image();
  const [w, h] = [svg.width.baseVal.value, svg.height.baseVal.value];
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await image.decode();
  const canvas = Object.assign(document.createElement("canvas"), { width: 2 * w, height: 2 * h });
  canvas.getContext("2d").drawImage(image, 0, 0, 2 * w, 2 * h);
  Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: `${name}.png` }).click();
}
