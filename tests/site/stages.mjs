// node tests/site/stages.mjs <out dir> [slug ...]   Every story's first scene and its densest (the most rows) at 1440x900
// and 1920x1080, light and dark: a screenshot of each at its first step, and what is wrong with it (the figure or the
// caption past the stage, text on the figure under 12px, the page wider than the screen).
import { STORIES } from "../../site/story.js";
import { base, browser, done } from "./serve.mjs";
const [out, ...only] = process.argv.slice(2);
const rows = (p) => ({ stuck: p.rows?.length + 1, asked: p.rows === "shares" ? p.shares?.length : p.publishers?.length, fell: 14, left: p.names?.length, split: p.pairs?.length,
  lines: p.words?.length, together: p.with?.length, yearly: p.words?.length, forget: p.names?.length, pairs: 2 })[p.type] || 0;
let wrong = 0;
for (const [width, height] of [[1440, 900], [1920, 1080]]) for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  for (const story of STORIES.filter((s) => !only.length || only.includes(s.slug))) {
    const dense = story.scenes.map(rows).reduce((best, n, k, all) => (n > all[best] ? k : best), 0);
    for (const k of [...new Set([0, dense])]) {
      await page.goto(`${base}#/cerita/${story.slug}/${k}/1`);
      await page.waitForFunction((k) => document.querySelector(`#scene-${k} .plate svg`), k, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const s = await page.evaluate((k) => {
        const stage = document.querySelector(`#scene-${k} .stage`), svg = stage.querySelector(".plate:not(.off) svg"), side = stage.querySelector(".stage-side").getBoundingClientRect();
        const box = stage.getBoundingClientRect(), fig = svg.getBoundingClientRect(), scale = fig.width / svg.viewBox.baseVal.width;
        const texts = [...svg.querySelectorAll("text, tspan")].filter((t) => t.textContent.trim()).map((t) => parseFloat(getComputedStyle(t).fontSize) * scale);
        return { fig: [fig.left, fig.top, fig.right, fig.bottom].map(Math.round), side: [side.left, side.top, side.right, side.bottom].map(Math.round), stage: [box.left, box.top, box.right, box.bottom].map(Math.round),
          smallest: Math.min(...texts), wide: document.documentElement.scrollWidth > innerWidth, head: document.querySelector(".masthead").getBoundingClientRect().bottom };
      }, k);
      const problems = [];
      if (s.fig[0] < s.stage[0] || s.fig[2] > s.side[0] || s.fig[1] < s.head - 1 || s.fig[3] > s.stage[3] + 1) problems.push(`figure ${s.fig} outside its room (stage ${s.stage}, caption from ${s.side[0]})`);
      if (s.side[2] > width || s.side[3] > height) problems.push(`caption ${s.side} past the screen`);
      if (s.smallest < 11.9) problems.push(`text ${s.smallest.toFixed(1)}px`);
      if (s.wide) problems.push("the page is wider than the screen");
      wrong += problems.length;
      console.log(`${problems.length ? "FAIL" : "ok  "} ${story.slug} scene ${k} ${width}x${height} ${scheme}: figure ${s.fig[2] - s.fig[0]}x${s.fig[3] - s.fig[1]} at ${s.fig[0]}, caption ${s.side[0]}–${s.side[2]}, smallest text ${s.smallest.toFixed(1)}px ${problems.join("; ")}`);
      await page.screenshot({ path: `${out}/${story.slug}-${k}-${width}-${scheme}.png` });
    }
  }
  await page.close();
}
await done(wrong);
