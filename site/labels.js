// Where names go over a picture: the one way labels are placed, on every picture that has them (the night sea of the
// hero, the held seas, a story's sea and the map, sea.js; the flat chart, chart.js; a word's route plate, app.js).
//
// A picture keeps a board of boxes [left, top, right, bottom] in its own pixels. What no name may touch is reserved on
// it first: the route (a box every few pixels along it), the figure card, titles, controls, the year. Names are then
// offered in the order of their priority, which the caller states (a ship's name, then the words a step is about,
// then the years along a route, then the rest): each takes the first of its spots that lies inside the picture (or
// the open water it is given) and touches no box already there, or is dropped. Nothing is drawn over anything.

/** The board of a picture. `bounds`: where a name may stand. */
export function board(bounds = [-Infinity, -Infinity, Infinity, Infinity]) {
  const taken = [], placed = [], reserved = [];
  const inside = (k, within) => k[0] >= within[0] && k[1] >= within[1] && k[2] <= within[2] && k[3] <= within[3];
  const free = (k, within = bounds) => inside(k, within) && !taken.some((o) => k[0] < o[2] && k[2] > o[0] && k[1] < o[3] && k[3] > o[1]);
  const me = {
    free,
    /** Boxes no name may touch. */
    reserve: (...boxes) => (boxes.filter(Boolean).forEach((k) => (taken.push(k), reserved.push(k))), me),
    /** A line through `points` ([x, y]), as boxes `r` pixels about a point every few pixels along it. */
    line: (points, r = 4) => {
      points.forEach(([x, y], i) => {
        const [px, py] = points[i - 1] || [x, y], n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / r));
        for (let j = i ? 1 : 0; j <= n; j++) me.reserve([px + ((x - px) * j) / n - r, py + ((y - py) * j) / n - r, px + ((x - px) * j) / n + r, py + ((y - py) * j) / n + r]);
      });
      return me;
    },
    /** The first of `spots` (boxes, in the order they are wanted) that is free within `within`, taken and returned;
     *  null where none is: the name is dropped. `text` is kept with the box, for the checks. */
    place: (spots, text = "", within = bounds) => {
      const k = spots.find((b) => free(b, within));
      if (!k) return null;
      taken.push(k);
      placed.push({ box: k, text });
      return k;
    },
    /** What was placed and what was reserved: tests/site/labels.mjs holds every picture to "no box touches another". */
    placed,
    reserved,
  };
  return me;
}

/** The width of `text` set in `font` (a CSS font shorthand), in pixels. */
let ruler = null;
export const measure = (text, font) => {
  ruler ||= document.createElement("canvas").getContext("2d");
  ruler.font = font;
  return ruler.measureText(text).width;
};
