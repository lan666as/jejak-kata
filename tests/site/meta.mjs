// node tests/site/meta.mjs [<built>]   The site as link previews and search engines see it. Serves the published site
// (publish.mjs's output over site/; built into a temporary folder when none is given) under /jejak-kata/ as GitHub
// Pages does (a folder without its slash is sent to it; any other missing path gets 404.html, with status 404), then:
// fetches every generated page with no script, as a crawler does, and checks its tags (a title of 50 to 60 characters
// and a description of 120 to 160, each unique), its JSON-LD (the properties
// Google requires of Article, BreadcrumbList and Dataset), its share image (JPEG, 1200x630, under 300 kB), canonical
// and language twins that answer each other, unique titles and descriptions, its text, that every page is reached by
// following links from the first; parses the sitemap and the feeds; and opens every page in the browser, where the
// app must take it over at the right route and language without the page moving.
import { createServer } from "node:http";
import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright-core";
import { SITE, TEXT } from "../../site/text.js";
import { address, named, TITLE, DESCRIPTION } from "../../site/address.js";
import { publish, ROUTES } from "./publish.mjs";

const SRC = new URL("../../site/", import.meta.url).pathname, ROOT = new URL(SITE.url).pathname, LANGUAGES = ["id", "en"];
let built = process.argv[2], temporary = false;
if (!built) (built = await mkdtemp(join(tmpdir(), "jejak-kata-")), (temporary = true), await publish(built));

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png",
  ".xml": "application/xml", ".webmanifest": "application/manifest+json" };
const found = async (p) => { for (const dir of [built, SRC]) { const s = await stat(join(dir, p)).catch(() => null); if (s) return { at: join(dir, p), folder: s.isDirectory() }; } return null; };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), p = decodeURIComponent(url.pathname);
  if (!p.startsWith(ROOT)) return res.writeHead(404).end();
  const hit = await found(p.slice(ROOT.length));
  if (hit?.folder && !p.endsWith("/")) return res.writeHead(301, { location: url.pathname + "/" }).end();
  const at = hit?.folder ? (await found(join(p.slice(ROOT.length), "index.html")))?.at : hit?.at;
  if (!at) return res.writeHead(404, { "content-type": types[".html"] }).end(await readFile(join(built, "404.html")));
  res.writeHead(200, { "content-type": types[extname(at)] || "text/plain" }).end(await readFile(at));
}).listen(0);
const host = `http://localhost:${server.address().port}`, local = (url) => url.replace(SITE.url, host + ROOT);

let failures = 0;
const problems = [];
const check = (ok, what) => ok || (failures++, problems.push(what));

// ---- as a crawler sees it: one GET, no script ----------------------------------------------------------------------

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const metas = (html) => {
  const out = {};
  for (const tag of html.match(/<meta [^>]*>/g) || []) { const key = attr(tag, "property") || attr(tag, "name"); if (key) (out[key] ||= []).push(attr(tag, "content")); }
  return out;
};
const links = (html, rel) => (html.match(/<link [^>]*>/g) || []).filter((t) => attr(t, "rel") === rel);
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
/** The width and height a JPEG says it is. */
const jpegSize = (b) => {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i < b.length;) { const marker = b[i + 1], length = b.readUInt16BE(i + 2); if (marker >= 0xc0 && marker <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + length; }
  return null;
};
const absolute = (url) => /^https:\/\/[^/]+\//.test(url || "");
const isDate = (d) => /^\d{4}-\d\d-\d\d(T[\d:]+(Z|[+-][\d:]+))?$/.test(d || "");

const pages = new Map(), titles = new Map(), descriptions = new Map(), report = [];
for (const parts of ROUTES) for (const lang of LANGUAGES) {
  const url = SITE.url + address(parts, lang), name = `${lang} /${address(parts, lang)}`;
  const res = await fetch(local(url), { redirect: "manual" }), html = await res.text(), m = metas(html), one = (k) => m[k]?.[0];
  pages.set(url, html);
  check(res.status === 200 && /text\/html/.test(res.headers.get("content-type")), `${name}: status ${res.status}`);
  check(new RegExp(`<html lang="${lang}"`).test(html), `${name}: <html lang="${lang}">`);
  const title = html.match(/<title>([^<]*)<\/title>/g) || [];
  check(title.length === 1, `${name}: ${title.length} titles`);
  const t = attr(`<x a="${(title[0] || "").replace(/<\/?title>/g, "")}">`, "a"), d = one("description");
  // What a search engine shows whole (address.js): a title of 50 to 60 characters, a description of 120 to 160.
  check(t?.length >= TITLE[0] && t.length <= TITLE[1], `${name}: title "${t}" (${t?.length}, not ${TITLE.join("–")})`);
  check(d?.length >= DESCRIPTION[0] && d.length <= DESCRIPTION[1], `${name}: description (${d?.length}, not ${DESCRIPTION.join("–")})`);
  check(!html.includes("noindex"), `${name}: noindex`);
  (titles.get(t) || titles.set(t, []).get(t)).push(name);
  (descriptions.get(d) || descriptions.set(d, []).get(d)).push(name);
  // One canonical, itself; language twins that name each other and the Indonesian page as the default.
  const canonical = links(html, "canonical").map((l) => attr(l, "href"));
  check(canonical.length === 1 && canonical[0] === url, `${name}: canonical ${canonical}`);
  const twins = Object.fromEntries(links(html, "alternate").filter((l) => attr(l, "hreflang")).map((l) => [attr(l, "hreflang"), attr(l, "href")]));
  const expected = { id: SITE.url + address(parts, "id"), en: SITE.url + address(parts, "en"), "x-default": SITE.url + address(parts, "id") };
  check(JSON.stringify(twins) === JSON.stringify(expected), `${name}: hreflang ${JSON.stringify(twins)}`);
  // What a link preview reads.
  for (const k of ["og:type", "og:site_name", "og:title", "og:description", "og:url", "og:locale", "og:locale:alternate", "og:image", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"])
    check(one(k), `${name}: no ${k}`);
  check(one("og:url") === url && absolute(one("og:image")) && one("og:image") === one("twitter:image") && one("twitter:card") === "summary_large_image", `${name}: og:url, og:image or the card`);
  check(one("og:image:width") === "1200" && one("og:image:height") === "630" && one("og:image:type") === "image/jpeg", `${name}: image dimensions not stated`);
  check(one("og:image:alt").length <= 420, `${name}: image alt longer than X takes`);
  const image = await fetch(local(one("og:image"))), bytes = Buffer.from(await image.arrayBuffer()), size = jpegSize(bytes);
  check(image.ok && size?.[0] === 1200 && size?.[1] === 630 && bytes.length <= 300_000, `${name}: image ${image.status} ${size} ${bytes.length} bytes`);
  // Structured data: parsed, and what Google requires of each kind.
  const graph = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []).flatMap((s) => {
    try { return JSON.parse(s.replace(/<\/?script[^>]*>/g, ""))["@graph"]; } catch { check(false, `${name}: JSON-LD does not parse`); return []; } });
  const kinds = graph.map((g) => g["@type"]);
  check(kinds.includes("WebSite") && (!parts.length || kinds.includes("BreadcrumbList")), `${name}: JSON-LD ${kinds}`);
  for (const g of graph) {
    if (g["@type"] === "BreadcrumbList") check(g.itemListElement.length >= 2 && g.itemListElement.every((item, i) => item.position === i + 1 && item.name && absolute(item.item)) && g.itemListElement.at(-1).item === url, `${name}: breadcrumbs`);
    if (g["@type"] === "Article") check(g.headline?.length <= 110 && g.image?.every(absolute) && isDate(g.datePublished) && isDate(g.dateModified) && g.dateModified >= g.datePublished && g.author?.every((a) => a.name && a["@type"]), `${name}: Article ${JSON.stringify(g).slice(0, 200)}`);
    if (g["@type"] === "Dataset") check(g.name && g.description?.length >= 50 && g.description.length <= 5000 && absolute(g.license) && g.creator?.name && g.distribution?.every((x) => absolute(x.contentUrl) && x.encodingFormat), `${name}: Dataset`);
  }
  check(!parts.length || parts[0] !== "cerita" || !parts[1] || kinds.includes("Article"), `${name}: a story without an Article`);
  check(parts[0] !== "metode" || kinds.includes("Dataset"), `${name}: the method page without its Dataset`);
  // The page's own text, there without a script, headings in order.
  const pre = html.match(/<div class="prerender">([\s\S]*?)<\/main>/)?.[1] || "", headings = [...pre.matchAll(/<h(\d)/g)].map((x) => +x[1]);
  check(headings[0] === 1 && headings.filter((h) => h === 1).length === 1 && headings.every((h, i) => !i || h <= headings[i - 1] + 1), `${name}: headings ${headings}`);
  if (parts[0] === "cerita" && parts[1]) check(pre.includes(TEXT[lang].limits_title) && (pre.match(/<figure>/g) || []).length >= 1, `${name}: the story's text`);
  report.push({ name, title: t, description: d, text: Buffer.byteLength(textOf(html)), image: bytes.length });
}
for (const [t, where] of titles) check(where.length === 1, `title "${t}" on ${where.join(", ")}`);
for (const [d, where] of descriptions) check(where.length === 1, `description "${d?.slice(0, 50)}…" on ${where.join(", ")}`);

// Every page is reached by following links from the first page, in either language.
const reached = new Set([SITE.url]), queue = [SITE.url];
while (queue.length) for (const href of (pages.get(queue.shift()) || "").match(/<a [^>]*href="[^"#]+"/g) || []) {
  const to = new URL(attr(href, "href"), SITE.url).href.replace(/#.*/, "");
  if (to.startsWith(SITE.url) && pages.has(to) && !reached.has(to)) (reached.add(to), queue.push(to));
}
check(reached.size === pages.size, `${pages.size - reached.size} pages not reached by links: ${[...pages.keys()].filter((u) => !reached.has(u)).slice(0, 5)}`);

// The sitemap and the feeds parse, and say the same addresses.
const browser = await chromium.launch(), page = await browser.newPage();
const parse = (xml) => page.evaluate((x) => { const d = new DOMParser().parseFromString(x, "application/xml"); return d.querySelector("parsererror") ? null : d.documentElement.outerHTML; }, xml);
const sitemap = await (await fetch(`${host}${ROOT}sitemap.xml`)).text();
check(await parse(sitemap), "sitemap.xml does not parse");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1].replace(/&amp;/g, "&"));
check(locs.length === pages.size && locs.every((u) => pages.has(u)), `sitemap: ${locs.length} addresses for ${pages.size} pages`);
check((sitemap.match(/<url>/g) || []).length === (sitemap.match(/hreflang="x-default"/g) || []).length, "sitemap: an address without its language twins");
for (const lang of LANGUAGES) {
  const at = `${host}${ROOT}${lang === "en" ? "en/" : ""}`, atom = await (await fetch(at + "feed.xml")).text(), feed = await (await fetch(at + "feed.json")).json().catch(() => null);
  check(await parse(atom) && (atom.match(/<entry>/g) || []).length === ROUTES.filter((r) => r[0] === "cerita" && r[1]).length, `${lang} feed.xml`);
  check(feed?.version === "https://jsonfeed.org/version/1.1" && feed.items?.length && feed.items.every((i) => i.id && absolute(i.url) && i.title && isDate(i.date_published)), `${lang} feed.json`);
}
// A story's frame for other sites: there, canonical to the story itself, and not in the sitemap (never found twice).
const STORY_ROUTES = ROUTES.filter((r) => r[0] === "cerita" && r[1]);
for (const [, slug] of STORY_ROUTES) for (const lang of LANGUAGES) {
  const story = SITE.url + address(["cerita", slug], lang), url = SITE.url + address(["cerita", slug, "embed"], lang), res = await fetch(local(url)), html = await res.text();
  const canonical = links(html, "canonical").map((l) => attr(l, "href"));
  check(res.status === 200 && canonical.length === 1 && canonical[0] === story && !locs.includes(url), `${lang} embed of ${slug}: status ${res.status}, canonical ${canonical}`);
}
// Not found: a 404 that boots the app, and says not to index it.
const lost = await fetch(`${host}${ROOT}tidak/ada/`), lostHtml = await lost.text();
check(lost.status === 404 && lostHtml.includes("noindex") && lostHtml.includes("app.js"), `404: status ${lost.status}`);

// ---- as a reader sees it: the app takes each page over --------------------------------------------------------------

const opened = await browser.newContext({ viewport: { width: 1200, height: 800 } });
for (const parts of ROUTES) for (const lang of LANGUAGES) {
  const url = SITE.url + address(parts, lang), p = await opened.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => { window.__shift = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (__shift += e.value))).observe({ type: "layout-shift", buffered: true }); });
  await p.goto(local(url));
  const want = named(parts, lang).title;
  const ok = await p.waitForFunction(([t, l]) => document.title === t && document.documentElement.lang === l && !document.querySelector(".prerender") && document.querySelector("#view h1") && document.querySelector("link[rel=canonical]").href.startsWith(location.origin), [want, lang], { timeout: 20000 }).then(() => true, () => false);
  const seen = await p.evaluate(() => ({ at: location.pathname + location.hash, title: document.title, shift: __shift, canonical: document.querySelector("link[rel=canonical]").href }));
  check(ok && (seen.at + "#").startsWith(ROOT + address(parts, lang) + "#") && !errors.length && seen.shift < 0.05, `browser ${lang} /${address(parts, lang)}: ${JSON.stringify(seen)} ${errors[0] || ""}`);
  await p.close();
}
// Old addresses and other paths still lead to their route.
for (const [from, to, h1] of [[`#/cerita/oknum`, "cerita/oknum/", null], [`#/cerita/oknum/1`, "cerita/oknum/#/1", null], [`kata/batik/`, "#/kata/batik", "batik"], [`en/cerita/oknum/#/1/2`, "en/cerita/oknum/#/1/2", null]]) {
  const p = await opened.newPage();
  await p.goto(`${host}${ROOT}${from}`);
  await p.waitForSelector("#view h1", { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const seen = await p.evaluate(() => ({ at: location.pathname.replace(/^\/[^/]+\//, "") + location.hash, h1: document.querySelector("#view h1")?.textContent }));
  check(seen.at === to && (!h1 || seen.h1 === h1), `old address ${from}: ${JSON.stringify(seen)}`);
  await p.close();
}
// The frame opens on its step, with the plate and caption and no header.
const frame = await (await browser.newContext({ viewport: { width: 720, height: 620 } })).newPage(), frameErrors = [];
frame.on("pageerror", (e) => frameErrors.push(e.message));
await frame.goto(`${host}${ROOT}en/cerita/oknum/embed/#/1/2`);
await frame.waitForSelector(".embed-figure .plate svg", { timeout: 20000 }).catch(() => {});
const framed = await frame.evaluate(() => ({ plate: !!document.querySelector(".embed-figure .plate svg"), count: document.querySelector(".embed-foot .count")?.textContent, header: getComputedStyle(document.querySelector(".masthead")).display,
  wide: document.documentElement.scrollWidth > innerWidth + 1, canonical: document.querySelector("link[rel=canonical]").href, link: document.querySelector(".embed-open")?.getAttribute("target") }));
check(framed.plate && framed.count?.startsWith("2 /") && framed.header === "none" && !framed.wide && framed.canonical.endsWith("/en/cerita/oknum/") && framed.link === "_top" && !frameErrors.length, `embed in the browser: ${JSON.stringify(framed)} ${frameErrors[0] || ""}`);
await frame.close();
const step = await opened.newPage();
await step.goto(`${host}${ROOT}cerita/oknum/#/1/2`);
await step.waitForSelector(".stage .plate svg", { timeout: 20000 }).catch(() => {});
await step.waitForTimeout(1200);
const at = await step.evaluate(() => { const head = document.querySelector(".masthead").getBoundingClientRect().bottom; const s = [...document.querySelectorAll(".stage")].find((x) => Math.abs(x.getBoundingClientRect().top - head) < 4); return s && `${s.parentNode.id} ${s.dataset.step}`; });
check(at === "scene-1 2", `a step's address opens on that step: ${at}`);
await browser.close();
server.close();

// ---- what was found ---------------------------------------------------------------------------------------------------

const kb = report.map((r) => r.image / 1000), lengths = report.map((r) => r.title.length);
console.log(`${report.length} pages: titles ${Math.min(...lengths)}–${Math.max(...lengths)} characters, images ${Math.round(Math.min(...kb))}–${Math.round(Math.max(...kb))} kB, text ${Math.min(...report.map((r) => r.text))}–${Math.max(...report.map((r) => r.text))} bytes`);
for (const r of report.filter((r) => /^(id|en) \/((en\/)?|(en\/)?cerita\/oknum\/)$/.test(r.name))) console.log(`  ${r.name}: "${r.title}" | ${r.description} | text ${r.text} B, image ${Math.round(r.image / 1000)} kB`);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(failures ? `${failures} problems` : "ok   every page as crawlers and readers see it");
if (temporary) await rm(built, { recursive: true });
process.exit(failures ? 1 : 0);
