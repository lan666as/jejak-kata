// node tests/site/shift.mjs   Layout shift while a page loads and is scrolled once, at 360x740 and 1440x900 (must stay under 0.05).
import { base, browser, done } from "./serve.mjs";
let failures = 0;
for (const [width, height] of [[360, 740], [1440, 900]]) for (const hash of ["#/", "#/cerita", "#/cerita/diamankan", "#/kata/kpk"]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => { window.__shift = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (__shift += e.value))).observe({ type: "layout-shift", buffered: true }); });
  await page.goto(base + hash); await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 1200); await page.waitForTimeout(1500);
  const shift = await page.evaluate(() => __shift);
  failures += shift >= 0.05;
  console.log(`${shift < 0.05 ? "ok  " : "FAIL"} ${hash} @${width}px: layout shift ${shift.toFixed(3)}`);
  await page.close();
}
await done(failures);
