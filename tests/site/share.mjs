// node tests/site/share.mjs   The share card (site/og.jpg, 1200x630): the home page's hero as it stands once the first
// route has been sailed, without the header. Run again when the hero changes.
import { base, browser, done } from "./serve.mjs";
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(base + "#/");
await page.addStyleTag({ content: ".masthead { display: none; } .hero-ask, .hero-try, .hero-foot { display: none; }" });
await page.evaluate(() => dispatchEvent(new Event("resize")));
await page.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: new URL("../../site/og.jpg", import.meta.url).pathname, type: "jpeg", quality: 86 });
await done(0);
