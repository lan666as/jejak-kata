// node tests/site/numbers.mjs <old data dir> <new data dir>   Which numbers in the stories' captions does the new data
// not give, among the series the caption points at? Run before new data replaces old: each line is a caption to reread.
import { readFileSync } from "node:fs";
import { STORIES } from "../../site/text.js";
const [oldDir, newDir] = process.argv.slice(2), read = (dir, file) => JSON.parse(readFileSync(`${dir}/${file}`));
const OUTLETS = ["id-web-eras-kompas", "id-web-eras-tempo", "id-web-eras-tribun"];
/** Every value the series a caption points at can show, as percentages (or times, for the lists of words that fell). */
function values(scene, dir, focus) {
  const together = read(dir, "together.json"), years = read(dir, "years.json"), stopped = read(dir, "stopped.json");
  const flat = (x) => (Array.isArray(x) ? x.flatMap(flat) : x === null || x === undefined ? [] : [100 * x]);
  const named = (list) => (focus?.length ? list.filter((x) => focus.includes(x)) : list);
  if (scene.type === "together") { const e = together[`${scene.lens}/${scene.word}`]; return [...named(Object.keys(e.with)).flatMap((x) => flat(e.with[x])), ...flat(Object.values(e.all)), ...e.pages]; }
  if (scene.type === "stuck") return [...named(scene.rows).flatMap((name) => OUTLETS.flatMap((o) => flat(together[`${o}/${name}`]?.with[scene.word]))), ...OUTLETS.flatMap((o) => flat(together[`${o}/${scene.rows[0]}`].all[scene.word]))];
  if (scene.type === "yearly") return [...(scene.by === "outlet" || scene.outlet !== undefined ? named(scene.words) : scene.words).flatMap((w) => flat(Object.values(years.share[w]))), ...Object.values(years.pages).flat()];
  if (scene.type === "fell") return [...Object.values(stopped.fell).flat().filter((r) => !focus?.length || focus.includes(r.word)).map((r) => r.times), ...stopped.pages.flat()];
  return null;
}
let flagged = 0;
for (const story of STORIES) for (const scene of story.scenes) {
  if (!values(scene, newDir)) continue;
  for (const step of scene.steps) {
    const before = values(scene, oldDir, step.focus), after = values(scene, newDir, step.focus);
    for (const [, digits] of step.id.matchAll(/(\d[\d.]*(?:,\d+)?)(?=%| kali| ribu| halaman)/g)) {
      const shown = Number(digits.replace(/\./g, "").replace(",", ".")), slack = 0.5 * 10 ** -(digits.split(",")[1]?.length || 0) + 1e-9;
      const near = (list) => list.some((v) => Math.abs(v - shown) <= slack || Math.abs(v / 1000 - shown) <= slack);
      if (near(after)) continue;
      flagged++;
      const nearest = after.reduce((best, v) => (Math.abs(v - shown) < Math.abs(best - shown) ? v : best), Infinity);
      console.log(`${story.slug} [${scene.type} ${step.at}] "${digits}" ${near(before) ? "was right, now nearest" : "matched nothing before either; nearest"} ${nearest.toFixed(2)} | ${step.id.replace(/<[^>]+>/g, "").slice(0, 100)}`);
    }
  }
}
console.log(flagged ? `${flagged} numbers to reread` : "the new data gives every number in the captions");
