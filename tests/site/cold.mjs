// node tests/site/cold.mjs   The home page opened cold on a phone (360x740) over a 4G-like line, three times per line:
// when the hero's text is on screen, when the sea (or the flat chart) is on screen and answers the reader, when the first
// route sets out (on a first visit, after the sea's arrival),
// and how much the layout shifted. Lines as Lighthouse and Chrome's tools set them; the files gzipped, as a static host
// sends them. The first screen must have its text and an answering chart within 2 s.
import { base, browser, done } from "./serve.mjs";
const LINES = { "slow 4G (1.6 Mbit/s, 150 ms)": { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 },
  "4G (9 Mbit/s, 60 ms)": { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 } };
let failures = 0;
for (const [line, conditions] of Object.entries(LINES)) {
  const runs = [];
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 }), page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...conditions });
    await page.addInitScript(() => {
      window.__t = {}; window.__shift = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (__shift += e.value))).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (__t.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
      const look = () => {
        // A moment counts at the frame after it is in the page: the text painted; the chart's canvas in the page and drawn.
        if (!__t.text && document.querySelector(".hero h1")) __t.text = performance.now();
        if (!__t.chart && document.querySelector(".hero .chart > canvas")) __t.chart = performance.now();
        if (!__t.route && document.querySelector(".hero .chart[data-route]")) __t.route = performance.now();
        if (!__t.route) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.goto(base + "#/", { waitUntil: "commit" });
    await page.waitForFunction(() => __t.route, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Interactive: a word chosen among the chips is answered in the next frames (it starts to sail).
    const answered = await page.evaluate(async () => { const b = document.querySelectorAll(".hero-try button")[1], t0 = performance.now();
      b.click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0; });
    runs.push({ ...(await page.evaluate(() => ({ ...__t, shift: __shift }))), answered });
    await context.close();
  }
  const r = (k) => runs.map((x) => (x[k] === undefined ? "-" : Math.round(x[k]))).join(" / ");
  const worst = Math.max(...runs.map((x) => Math.max(x.text ?? 1e9, x.chart ?? 1e9))), shift = Math.max(...runs.map((x) => x.shift));
  const bad = worst > 2000 || shift > 0.05;
  failures += bad;
  console.log(`${bad ? "FAIL" : "ok  "} ${line}: hero text ${r("text")} ms (largest paint ${r("lcp")}); chart on screen and answering ${r("chart")} ms (a chip answered in ${r("answered")} ms); first route sets out ${r("route")} ms; layout shift ${runs.map((x) => x.shift.toFixed(3)).join(" / ")}`);
}
await done(failures);
