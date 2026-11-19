// node tests/site/publish.mjs <out> [--no-images]   What makes every story and main page an address of its own, to be
// shared and found: the site's own pages are one page (index.html) and its routes lived after "#", which no link
// preview and no search engine reads. Into <out> (`./run.sh deploy` copies site/ there first) it writes, for each
// route that has a page (address.js) and in each language (English under en/):
//   <address>/index.html  the app's own shell (site/index.html) with the page's title, description, canonical address,
//                         language twins, Open Graph and X card, JSON-LD, and the page's text in plain HTML for readers
//                         that run no script (crawlers, link previews); the app takes the page over where scripts run
//   <address>/og.jpg      its share image, 1200x630: a story's key number and title on its own night sea
// and index.html (the first page), mainan/ and cara/ (the menu's names for main/ and metode/, address.js ALIASES),
// 404.html (GitHub Pages serves it for any other path; the app reads the path),
// sitemap.xml, and the stories as feeds (feed.xml Atom, feed.json JSON Feed) in each language. Each story also has a
// frame for other sites, <story>/embed/ (address.js, EMBED): the story's own page, whose canonical address it is, kept
// out of the sitemap, so that it is never found twice. The images are drawn
// by the app itself in the test browser, from site/ and its data. Deploy runs this every time, so a published page
// never carries an old title, number or image.
// A word's page is made for every word the site names by itself (wordsNamed below); their list is site/words.js, so
// that the app writes the same addresses: `node tests/site/publish.mjs words` writes it from the data, and meta.mjs
// fails a deploy where it is not what the data says. A word's share image is its own for the words the first page
// shows, and one for all the others (kata/og.jpg): drawing 3,000 seas would take an hour and 500 MB.
// node tests/site/publish.mjs icons   Remakes site/icon-*.png (the installed app's icons) from the favicon.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { TEXT, SITE, SHOWCASE } from "../../site/text.js";
import { STORIES } from "../../site/story.js";
import { address, named, cut, EMBED, PLAY, WORDS, ALIASES, QUIZ_NAMES, GUESS_WORDS } from "../../site/address.js";
import { PAGED } from "../../site/words.js";
import { lensFrom, sceneWords } from "../../site/scenes.js";

const REPO = new URL("../../", import.meta.url).pathname, SRC = join(REPO, "site");
const ROOT = new URL(SITE.url).pathname, LANGUAGES = ["id", "en"], LOCALE = { id: "id_ID", en: "en_GB" };
const W = 1200, H = 630, MOST = 290_000;  // a share image: its size, and its most bytes (WhatsApp shows none past 300 kB)
const MAIN = "id-web-news-kompas";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const plain = (html) => String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const dash = (label) => String(label).replace("-", "–");
/** A route's address: whole (as shared), as a path on the host, as a file in <out>. */
const whole = (parts, lang) => SITE.url + address(parts, lang);
const path = (parts, lang) => ROOT + address(parts, lang);
const file = (out, parts, lang, name = "index.html") => join(out, decodeURIComponent(address(parts, lang)), name);
const a = (parts, lang, text) => `<a href="${path(parts, lang)}">${text}</a>`;

/** Every route with a page of its own. */
export const ROUTES = [[], ["cerita"], ...STORIES.map((s) => ["cerita", s.slug]), ["main"], ...PLAY.map((p) => [p]), ["peta"], ["temuan"], ["metode"], ...PAGED.map((w) => ["kata", w])];
const storyOf = ([page, slug]) => page === "cerita" && STORIES.find((s) => s.slug === slug);

// ---- facts: dates from git, a word's company from the data ------------------------------------------------------

const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
/** The day a story's text (its card in text.js, its body in story.js) last changed in a commit, or `published`. */
function modified(story) {
  const days = [[`/^  "${story.slug}": {/,/^  },/`, "site/story.js"], [`/slug: "${story.slug}"/,/^  },/`, "site/text.js"]]
    .map(([range, source]) => { try { return git("log", "-1", "--format=%cs", "-L", `${range}:${source}`).split("\n")[0]; } catch { return ""; } });
  return [story.published, ...days].filter((d) => /^\d{4}-\d\d-\d\d$/.test(d)).sort().at(-1);
}
const read = new Map();
const json = (p) => read.get(p) || read.set(p, readFile(join(SRC, "data", p), "utf8").then(JSON.parse)).get(p);
/** What the data says of a word on the first page's lens: its company in the first and last period it has, and its
 *  largest shift. Nothing where the word is not an entry there. */
async function company(word) {
  const meta = await json(`${MAIN}/meta.json`), i = meta.words.indexOf(word);
  if (i < 0 || meta.names.includes(i)) return null;
  const e = (await json(`${MAIN}/words/${Math.floor(i / meta.bucket)}.json`)).find((x) => x.word === i);
  const known = e?.with.map((w, p) => (w.length ? p : -1)).filter((p) => p >= 0) || [];
  if (known.length < 2) return null;
  const names = (p) => e.with[p].slice(0, 3).map((j) => meta.words[j]), [first, last] = [known[0], known.at(-1)];
  const shifts = e.shift.filter((s) => s !== null);
  return { first: meta.periods[first], last: meta.periods[last], early: names(first), late: names(last), shift: shifts.length ? Math.max(...shifts) : null, flag: meta.flag };
}
const list = (lang, words, quote = (w) => `“${w}”`) => new Intl.ListFormat(lang, { type: "conjunction" }).format(words.map(quote));

// ---- the words with a page of their own ----------------------------------------------------------------------------

/** The words the games name on their own pages, as their pages open (app.js: the quiz's names, the guesses' words,
 *  and the word or name each of the others opens on). */
const GAMES = { kuis: QUIZ_NAMES, entitas: QUIZ_NAMES, tebak: GUESS_WORDS, menempel: ["tersangka"], redaksi: ["pdip"], lingkaran: ["prabowo"] };
const FREQUENT = 200;
/** Every word the site names by itself, by where: the first page's (address.js WORDS), each story's (the words its
 *  scenes draw and ask to check), the games', the findings' (every source's own ranking, folded ones too); then one
 *  hop on, the company each of those words is named with on its page (company(): three in its first and three in its
 *  last year), and the FREQUENT most frequent words of the first page's source. Only words that are an entry of some
 *  source, so that a word's page has something to show. `all`: the words with a page, in order. */
export async function wordsNamed() {
  const lenses = await Promise.all((await json("lenses.json")).map(async (l) => lensFrom(await json(`${l}/meta.json`))));
  const entry = (w) => lenses.some((l) => l.isEntry(l.index.get(w))), only = (words) => [...new Set(words)].filter(entry);
  const story = Object.fromEntries(STORIES.map((s) => [s.slug, only(s.scenes.flatMap(sceneWords))]));
  const games = Object.fromEntries(Object.entries(GAMES).map(([g, words]) => [g, only(words)]));
  const findings = { swaps: [], went: [], stayed: [] };
  for (const l of lenses) {
    const h = await json(`${l.lens}/highlights.json`).catch(() => ({}));
    findings.swaps.push(...(h.swaps || []).flatMap(([fell, rose]) => [l.words[rose], l.words[fell]]));
    for (const kind of ["went", "stayed"]) findings[kind].push(...(h.arrivals?.[kind] || []).map(([w]) => l.words[w]));
  }
  for (const kind in findings) findings[kind] = only(findings[kind]);
  const seeds = only([...WORDS, ...Object.values(story).flat(), ...Object.values(games).flat(), ...Object.values(findings).flat()]);
  const hop = only((await Promise.all(seeds.map(company))).flatMap((c) => (c ? [...c.early, ...c.late] : [])));
  const main = lenses.find((l) => l.lens === MAIN), frequent = main.words.filter((w, i) => main.isEntry(i)).slice(0, FREQUENT);
  const all = [...new Set([...seeds, ...hop, ...frequent])].sort((a, b) => a.localeCompare(b, "id"));
  return { shown: WORDS, story, games, findings, frequent, all };
}
/** site/words.js as it should be. */
export const wordsModule = (all) => `// The words with a page of their own (address.js), from the data: written by \`node tests/site/publish.mjs words\`
// (wordsNamed there says which), checked by tests/site/meta.mjs. Not to be edited by hand.
export const PAGED = ${JSON.stringify(all)};
`;
/** The years the data covers, from every lens's periods. */
async function covered() {
  const years = (await Promise.all((await json("lenses.json")).map((l) => json(`${l}/meta.json`)))).flatMap((m) => m.periods.join(" ").match(/\d{4}/g) || []).map(Number);
  return `${Math.min(...years)}/${Math.max(...years)}`;
}

// ---- what a page says without a script ---------------------------------------------------------------------------

function content(parts, lang, facts) {
  const T = TEXT[lang], [page, arg] = parts, story = storyOf(parts), other = lang === "id" ? "en" : "id";
  const twin = `<p><a href="${path(parts, other)}" hreflang="${other}" lang="${other}">${other === "en" ? "English" : "Bahasa Indonesia"}</a></p>`;
  const storyList = (list) => `<ul>${list.map((s) => `<li>${a(["cerita", s.slug], lang, s[lang].title)}: ${s.key.number[lang] || s.key.number} ${s.key[lang]}. ${s[lang].teaser}</li>`).join("")}</ul>`;
  const games = `<ul>${PLAY.map((p) => `<li>${a([p], lang, T[`play_${p}`])}: ${T[`play_${p}_about`]}</li>`).join("")}</ul>`;
  const words = (list) => `<ul>${list.map((w) => `<li>${a(["kata", w], lang, w)}</li>`).join("")}</ul>`, named = facts.named;
  const nav = `<nav><ul><li>${a(["cerita"], lang, T.nav_stories)}</li><li>${a(["main"], lang, T.nav_play)}</li><li>${a(["peta"], lang, T.nav_chart)}</li><li>${a(["temuan"], lang, T.nav_findings)}</li><li>${a(["metode"], lang, T.nav_method)}</li></ul></nav>`;
  let body;
  if (story) {
    const w = story[lang], scenes = story.scenes.map((part) => {
      const s = part[lang], plates = [].concat(s.plate).filter((x) => typeof x === "string");
      const steps = part.steps.map((step) => `<li><b>${esc(dash(step.head ?? step.mark ?? step.at))}.</b> ${step[lang]}</li>`).join("");
      return `<section><h2>${s.title}</h2>${s.text ? `<p>${s.text}</p>` : ""}<figure><figcaption>${plates.join(" / ")}</figcaption><ol>${steps}</ol></figure></section>`;
    }).join("");
    const next = STORIES[(STORIES.indexOf(story) + 1) % STORIES.length];
    body = `<article><p>${a(["cerita"], lang, T.nav_stories)} · <time datetime="${story.published}">${story.published}</time></p><h1>${w.title}</h1><p>${w.teaser}</p>
      <p><b>${story.key.number[lang] || story.key.number}</b> ${story.key[lang]}</p><p>${w.intro}</p>${scenes}
      <section><h2>${T.story_words}</h2>${words(named.story[story.slug])}</section>
      <section><h2>${T.limits_title}</h2>${w.limits}</section>
      <p>${T.cite}: ${esc(`${SITE.author} (${story.published.slice(0, 4)}). ${w.title}. ${SITE.name}. ${whole(parts, lang)}`)}</p>
      <p>${T.next_story}: ${a(["cerita", next.slug], lang, next[lang].title)}</p></article>`;
  } else if (page === "kata") {
    const c = facts.company[arg];
    const linked = (list_) => list(lang, list_, (w) => `“${a(["kata", w], lang, esc(w))}”`);
    body = `<article><h1>${esc(arg)}</h1><p>${T.desc_word(arg)}</p>${c ? `<p>${T.word_company(arg, c.first, linked(c.early), c.last, linked(c.late))}</p>` : ""}
      ${c?.shift != null ? `<p>${T.word_shift(c.shift.toLocaleString(lang, { maximumFractionDigits: 1 }), c.shift >= c.flag)}</p>` : ""}
      <h2>${T.word_more}</h2>${words(SHOWCASE.filter((w) => w !== arg))}</article>`;
  } else if (page === "cerita") body = `<h1>${T.nav_stories}</h1><p>${T.stories_lede}</p>${storyList(STORIES)}`;
  else if (page === "main") body = `<h1>${T.nav_play}</h1><p>${T.play_lede}</p>${games}`;
  else if (PLAY.includes(page)) body = `<h1>${T[`play_${page}`]}</h1><p>${T[`play_${page}_about`]}</p>${named.games[page]?.length ? words(named.games[page]) : ""}<p>${a(["main"], lang, T.all_play_n(PLAY.length))}</p>`;
  else if (page === "peta") body = `<h1>${T.nav_chart}</h1><p>${T.desc_chart}</p><p>${T.hero_lede}</p>${words(WORDS)}<h2>${T.frequent_words}</h2>${words(named.frequent)}`;
  else if (page === "temuan") body = `<h1>${T.nav_findings}</h1><p>${T.findings_lede}</p>${["swaps", "went", "stayed"].map((k) => `<h2>${T[`${k}_title`]}</h2>${words(named.findings[k])}`).join("")}`;
  else if (page === "metode") body = `<h1>${T.method_title}</h1><p>${T.method_kicker}</p>${T.method}${T.caveats}`;
  else body = `<h1>${T.title}</h1><p>${T.hero_lede}</p><h2>${T.nav_stories}</h2>${storyList(STORIES)}<h2>${T.nav_play}</h2>${games}<h2>${T.word_more}</h2>${words(WORDS)}`;
  return `<div class="prerender">${body}${nav}${twin}${T.footer.replace(/href="#\/([a-z]+)"/g, (_, to) => `href="${path([to], lang)}"`)}</div>`;
}

// ---- what a page is called where it is shared and found ----------------------------------------------------------

/** The share image of a route: its text (the card), and where it is. */
function card(parts, lang, facts) {
  const T = TEXT[lang], [page, arg] = parts, story = storyOf(parts), c = page === "kata" && facts.company[arg];
  if (!page) return { home: true, alt: T.card_alt_home };
  if (story) return { kicker: T.story, key: story.key.number[lang] || story.key.number, label: story.key[lang], title: story[lang].title };
  if (page === "kata" && !WORDS.includes(arg)) return { kicker: T.word, title: T.title, line: T.hero_lede, shared: true };
  if (page === "kata") return { kicker: T.word, title: arg, line: c ? T.word_company(arg, c.first, list(lang, c.early), c.last, list(lang, c.late)) : T.desc_word(arg) };
  const title = { cerita: T.nav_stories, main: T.nav_play, peta: T.nav_chart, temuan: T.nav_findings, metode: T.method_title }[page] || T[`play_${page}`];
  return { kicker: PLAY.includes(page) ? T.nav_play : SITE.name, title, line: named(parts, lang).description };
}
/** Where a route's share image is, relative to the site's root: its own, or the one all words without their own share. */
const imageOf = (parts, lang) => (parts[0] === "kata" && !WORDS.includes(parts[1]) ? `${lang === "en" ? "en/" : ""}kata/og.jpg` : address(parts, lang) + "og.jpg");
const altOf = (c) => c.alt || cut([c.kicker, c.key && `${c.key} ${c.label}`, c.title, c.line].filter(Boolean).join(". ").replace(/\.\./g, "."), 400);

function head(parts, lang, facts) {
  const T = TEXT[lang], own = named(parts, lang), story = storyOf(parts), [page] = parts, url = whole(parts, lang);
  const image = { url: SITE.url + imageOf(parts, lang), alt: altOf(card(parts, lang, facts)) };
  const title = !page ? T.doc_title : own.shared;  // where the site's name is shown beside it
  const description = story ? cut(story[lang].teaser, 300) : own.description;
  const meta = (key, value, attr = "property") => `<meta ${attr}="${key}" content="${esc(value)}">`;
  const person = { "@type": "Person", name: SITE.author, url: SITE.authorUrl };
  const website = { "@type": "WebSite", "@id": `${SITE.url}#website`, url: SITE.url, name: SITE.name, description: TEXT.id.desc_home, inLanguage: LANGUAGES };
  const crumbs = [[SITE.name, whole([], lang)]];
  if (story) crumbs.push([T.nav_stories, whole(["cerita"], lang)], [story[lang].title, url]);
  else if (PLAY.includes(page)) crumbs.push([T.nav_play, whole(["main"], lang)], [T[`play_${page}`], url]);
  else if (page) crumbs.push([card(parts, lang, facts).title, url]);
  const graph = [website];
  if (page) graph.push({ "@type": "BreadcrumbList", itemListElement: crumbs.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name: plain(name), item })) });
  if (story) graph.push({ "@type": "Article", "@id": `${url}#article`, headline: plain(story[lang].title).slice(0, 110), description: plain(story[lang].teaser), image: [image.url],
    datePublished: story.published, dateModified: facts.modified[story.slug], inLanguage: lang, author: [person], isPartOf: { "@id": website["@id"] }, mainEntityOfPage: url, url,
    isAccessibleForFree: true, isBasedOn: SITE.dataset });
  if (page === "metode") graph.push({ "@type": "Dataset", name: T.dataset_name, description: `${TEXT[lang].desc_home} ${plain(T.dataset_about)}`, url, sameAs: SITE.dataset,
    license: "https://creativecommons.org/licenses/by/4.0/", isAccessibleForFree: true, creator: person, inLanguage: ["id", "jv", "su"], temporalCoverage: facts.years,
    keywords: T.dataset_keywords, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE.url}data/lenses.json` }] });
  const feed = (type, name) => `<link rel="alternate" type="${type}" href="${SITE.url}${lang === "en" ? "en/" : ""}${name}" title="${esc(`${SITE.name}: ${T.nav_stories}`)}">`;
  return [
    `<title>${esc(own.title)}</title>`, meta("description", own.description, "name"), `<link rel="canonical" href="${url}">`,
    ...LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l}" href="${whole(parts, l)}">`), `<link rel="alternate" hreflang="x-default" href="${whole(parts, "id")}">`,
    meta("og:type", story ? "article" : "website"), meta("og:site_name", SITE.name), meta("og:title", plain(title)), meta("og:description", plain(description)), meta("og:url", url),
    meta("og:locale", LOCALE[lang]), meta("og:locale:alternate", LOCALE[lang === "id" ? "en" : "id"]),
    meta("og:image", image.url), meta("og:image:type", "image/jpeg"), meta("og:image:width", W), meta("og:image:height", H), meta("og:image:alt", image.alt),
    ...(story ? [meta("article:published_time", story.published), meta("article:modified_time", facts.modified[story.slug])] : []),
    meta("twitter:card", "summary_large_image", "name"), meta("twitter:title", plain(title), "name"), meta("twitter:description", plain(description), "name"),
    meta("twitter:image", image.url, "name"), meta("twitter:image:alt", image.alt, "name"),
    feed("application/atom+xml", "feed.xml"), feed("application/feed+json", "feed.json"),
    `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`,
  ].join("\n");
}

/** The app's shell, as this route and language: its head, its header and footer in the language, its text. */
function page(template, parts, lang, facts, { lost = false } = {}) {
  const T = TEXT[lang];
  let html = template.replace('<html lang="id">', `<html lang="${lang}">`).replace('<base href="./">', `<base href="${ROOT}">`)
    .replace(/<!-- page:[\s\S]*?<!-- \/page -->/, lost ? `<title>${esc(T.lost_title)} | ${SITE.name}</title>\n<meta name="robots" content="noindex">` : head(parts, lang, facts))
    .replace(/href="[^"]*" data-to="([^"]*)"/g, (_, to) => `href="${path(to ? [to] : [], lang)}" data-to="${to}"`)
    .replace(/(data-t="(\w+)"[^>]*>)[^<]*(<\/)/g, (_, open, key, close) => `${open}${key === "footer" ? "" : T[key]}${close}`)  // the footer's text is in the page's text: it would stand where the page comes
    .replace(/href="#\/([a-z]+)"/g, (_, to) => `href="${path([to], lang)}"`)
    .replace('<p class="loading">Memuat peta kata…</p>', `<p class="loading">${lang === "id" ? "Memuat peta kata…" : T.loading}</p>`)
    .replace('<!-- content -->', lost ? "" : content(parts, lang, facts));
  if (lang === "en") html = html.replace('<button id="language" type="button">English</button>', '<button id="language" type="button" lang="id">Bahasa Indonesia</button>');
  return html;
}

// ---- feeds and the sitemap ----------------------------------------------------------------------------------------

function feeds(lang, facts) {
  const T = TEXT[lang], at = (d) => `${d}T00:00:00Z`, self = (name) => `${SITE.url}${lang === "en" ? "en/" : ""}${name}`;
  const items = [...STORIES].sort((x, y) => y.published.localeCompare(x.published));
  const updated = items.map((s) => facts.modified[s.slug]).sort().at(-1);
  const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
<title>${esc(`${SITE.name}: ${T.nav_stories}`)}</title><subtitle>${esc(T.stories_lede)}</subtitle>
<link rel="self" type="application/atom+xml" href="${self("feed.xml")}"/><link rel="alternate" type="text/html" href="${whole(["cerita"], lang)}"/>
<id>${self("feed.xml")}</id><updated>${at(updated)}</updated><author><name>${SITE.author}</name><uri>${SITE.authorUrl}</uri></author>
${items.map((s) => `<entry><title>${esc(plain(s[lang].title))}</title><link rel="alternate" type="text/html" href="${whole(["cerita", s.slug], lang)}"/><id>${whole(["cerita", s.slug], lang)}</id>
<published>${at(s.published)}</published><updated>${at(facts.modified[s.slug])}</updated><summary>${esc(plain(s[lang].teaser))}</summary></entry>`).join("\n")}
</feed>
`;
  const jsonFeed = { version: "https://jsonfeed.org/version/1.1", title: `${SITE.name}: ${T.nav_stories}`, description: T.stories_lede, home_page_url: whole(["cerita"], lang), feed_url: self("feed.json"), language: lang,
    authors: [{ name: SITE.author, url: SITE.authorUrl }],
    items: items.map((s) => ({ id: whole(["cerita", s.slug], lang), url: whole(["cerita", s.slug], lang), title: plain(s[lang].title), summary: plain(s[lang].teaser), content_text: plain(`${s[lang].teaser} ${s[lang].intro}`),
      image: `${whole(["cerita", s.slug], lang)}og.jpg`, date_published: at(s.published), date_modified: at(facts.modified[s.slug]), language: lang })) };
  return { atom, json: JSON.stringify(jsonFeed, null, 1) };
}

function sitemap(facts) {
  const last = (parts) => (storyOf(parts) ? facts.modified[parts[1]] : parts[0] === "cerita" ? Object.values(facts.modified).sort().at(-1) : null);
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${ROUTES.flatMap((parts) => LANGUAGES.map((lang) => `<url><loc>${esc(whole(parts, lang))}</loc>${last(parts) ? `<lastmod>${last(parts)}</lastmod>` : ""}${LANGUAGES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(whole(parts, l))}"/>`).join("")}<xhtml:link rel="alternate" hreflang="x-default" href="${esc(whole(parts, "id"))}"/></url>`)).join("\n")}
</urlset>
`;
}

// ---- share images, drawn by the app ---------------------------------------------------------------------------------

/** One card: the night sea behind, the text over its dark side (the site's type and colours, style.css). */
const cardPage = (c, background, lang) => `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>
@font-face { font-family: Bricolage; src: url(bricolage.woff2) format("woff2"); font-weight: 200 800; font-stretch: 75% 100%; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #0a1f36; }
.card { position: relative; width: ${W}px; height: ${H}px; background: url(${background}) right center / cover; font-family: Bricolage, sans-serif; color: #eef4f2; }
.card::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #0a1f36 0%, rgba(10,31,54,.94) 42%, rgba(10,31,54,.35) 68%, rgba(10,31,54,0) 85%); }
.text { position: absolute; left: 72px; top: 60px; bottom: 64px; width: 690px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 14px; margin: 0; font-size: 30px; font-weight: 700; font-stretch: 80%; }
.kicker { display: flex; align-items: center; gap: 14px; margin: auto 0 0; font-size: 24px; font-weight: 600; color: #a8bccb; }
.kicker::before { content: ""; width: 40px; height: 3px; background: #ea5aa6; }
.key { margin: 14px 0 0; font-size: ${c.key?.length > 9 ? 112 : 150}px; line-height: .92; font-weight: 800; font-stretch: 75%; color: #f2b84a; white-space: nowrap; }
.label { margin: 8px 0 0; font-size: 25px; line-height: 1.3; color: #a8bccb; }
h1 { margin: 22px 0 0; font-size: ${c.title.length > 46 ? 48 : c.title.length > 30 ? 56 : c.key ? 64 : 104}px; line-height: 1.02; font-weight: ${c.key ? 700 : 800}; font-stretch: ${c.key ? 80 : 75}%; }
.line { margin: 18px 0 0; font-size: 26px; line-height: 1.35; color: #a8bccb; }
.url { position: absolute; right: 56px; bottom: 40px; margin: 0; font-size: 22px; font-weight: 600; color: #a8bccb; }
</style><div class="card"><div class="text">
<p class="brand"><svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#13324f"/><path d="M6 25C11 25 10 13 16 13S21 8 25 7" fill="none" stroke="#ea5aa6" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="7" r="3.5" fill="#f2b84a"/></svg>${SITE.name}</p>
<p class="kicker">${esc(c.kicker)}</p>${c.key ? `<p class="key">${esc(c.key)}</p><p class="label">${esc(c.label)}</p>` : ""}<h1>${esc(c.title)}</h1>${c.line ? `<p class="line">${esc(cut(c.line, 170))}</p>` : ""}
</div><p class="url">${new URL(SITE.url).host}${ROOT.replace(/\/$/, "")}</p></div>`;

async function images(out, facts) {
  const { base, browser, server } = await import("./serve.mjs");
  const hide = ".masthead, .cover-text, .page-head > :not(.shore-sea), .hero-text, .site-foot { visibility: hidden !important; } .page-head { min-height: 100vh; }";
  /** The sea behind a route as the app draws it, with its text hidden: a story's cover, a word's head, the first page. */
  const seas = new Map();
  const sea = (hash, ready) => seas.get(hash) || seas.set(hash, (async () => {
    const p = await browser.newPage({ viewport: { width: W, height: H + 56 } });
    await p.addInitScript((css) => addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: css }))), hide);
    await p.goto(base + hash);
    await p.waitForSelector(ready, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const shot = await p.screenshot({ clip: { x: 0, y: 56, width: W, height: H } });
    await p.close();
    return "data:image/png;base64," + shot.toString("base64");
  })()).get(hash);
  const sizes = [];
  const save = async (to, shoot) => {
    await mkdir(dirname(to), { recursive: true });
    for (let quality = 84; ; quality -= 6) {
      const jpeg = await shoot(quality);
      if (jpeg.length <= MOST || quality < 50) return await writeFile(to, jpeg), sizes.push([to.slice(out.length), jpeg.length]);
    }
  };
  const drawn = new Set();
  for (const parts of ROUTES) for (const lang of LANGUAGES) {
    const c = card(parts, lang, facts), to = join(out, decodeURIComponent(imageOf(parts, lang)));
    if (drawn.has(to)) continue;
    drawn.add(to);
    if (c.home) {  // the first page's hero as it stands once its first route has sailed (the image people know)
      const p = await browser.newPage({ viewport: { width: W, height: H } });
      await p.addInitScript((l) => localStorage.setItem("language", l), lang);
      await p.goto(base + "#/");
      await p.addStyleTag({ content: ".masthead { display: none; } .hero-ask, .hero-try, .hero-foot { display: none; }" });
      await p.evaluate(() => dispatchEvent(new Event("resize")));
      await p.waitForFunction(() => document.querySelector(".hero .chart[data-route]"), null, { timeout: 30000 });
      await p.waitForTimeout(6000);
      await save(to, (quality) => p.screenshot({ type: "jpeg", quality }));
      await p.close();
      continue;
    }
    const background = await (storyOf(parts) ? sea(`#/cerita/${parts[1]}`, ".cover.lit") : parts[0] === "kata" && !c.shared ? sea(`#/kata/${encodeURIComponent(parts[1])}`, ".page-head.lit") : sea("#/", ".hero .chart[data-route]"));
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.route(base + "card.html", (r) => r.fulfill({ contentType: "text/html", body: cardPage(c, background, lang) }));
    await p.goto(base + "card.html");
    await p.evaluate(() => document.fonts.ready);
    await save(to, (quality) => p.screenshot({ type: "jpeg", quality }));
    await p.close();
  }
  await browser.close();
  server.close();
  return sizes;
}

// ---- the icons of the installed app ---------------------------------------------------------------------------------

async function icons() {
  const { browser, server } = await import("./serve.mjs");
  const mark = `<path d="M6 25C11 25 10 13 16 13S21 8 25 7" fill="none" stroke="#ea5aa6" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="7" r="3.5" fill="#f2b84a"/>`;
  // "any": the favicon itself; a full square (Apple rounds it) and a maskable one keep the mark inside the middle 70%.
  const svg = (shape) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${shape === "any" ? `<rect width="32" height="32" rx="7" fill="#0a1f36"/>${mark}` : `<rect width="32" height="32" fill="#0a1f36"/><g transform="translate(4.8 4.8) scale(.7)">${mark}</g>`}</svg>`;
  for (const [name, size, shape] of [["icon-192.png", 192, "any"], ["icon-512.png", 512, "any"], ["icon-maskable-512.png", 512, "full"], ["icon-180.png", 180, "full"]]) {
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(shape)}`);
    await p.screenshot({ path: join(SRC, name), omitBackground: shape === "any" });
    await p.close();
  }
  await browser.close();
  server.close();
}

// ---- all of it ------------------------------------------------------------------------------------------------------

export async function publish(out, { drawn = true } = {}) {
  const template = await readFile(join(SRC, "index.html"), "utf8");
  const facts = { modified: Object.fromEntries(STORIES.map((s) => [s.slug, modified(s)])), company: {}, years: await covered(), named: await wordsNamed() };
  if (facts.named.all.join("\n") !== PAGED.join("\n")) throw new Error("site/words.js is not what the data says: node tests/site/publish.mjs words");
  for (const w of PAGED) facts.company[w] = await company(w);
  const write = async (to, text) => (await mkdir(dirname(to), { recursive: true }), writeFile(to, text));
  for (const parts of ROUTES) for (const lang of LANGUAGES) await write(file(out, parts, lang), page(template, parts, lang, facts));
  for (const story of STORIES) for (const lang of LANGUAGES) await write(file(out, ["cerita", story.slug, EMBED], lang), page(template, ["cerita", story.slug], lang, facts));
  // The names the menu calls two pages by (address.js, ALIASES): the page itself, canonical to its own address.
  for (const [alias, to] of Object.entries(ALIASES)) for (const lang of LANGUAGES) await write(join(out, lang === "en" ? "en" : "", alias, "index.html"), page(template, [to], lang, facts));
  await write(join(out, "404.html"), page(template, ["404"], "id", facts, { lost: true }));
  await write(join(out, "sitemap.xml"), sitemap(facts));
  for (const lang of LANGUAGES) {
    const { atom, json } = feeds(lang, facts), dir = lang === "en" ? join(out, "en") : out;
    await write(join(dir, "feed.xml"), atom);
    await write(join(dir, "feed.json"), json);
  }
  return drawn ? images(out, facts) : [];
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [out, flag] = process.argv.slice(2);
  if (out === "icons") await icons();
  else if (out === "words") {
    const { all } = await wordsNamed();
    await writeFile(join(SRC, "words.js"), wordsModule(all));
    console.log(`${all.length} words with a page of their own in site/words.js`);
  }
  else if (!out) (console.error("node tests/site/publish.mjs <out> [--no-images] | icons"), process.exit(2));
  else {
    const sizes = await publish(out, { drawn: flag !== "--no-images" });
    const kb = sizes.map(([, n]) => n / 1000);
    console.log(`${ROUTES.length * 2} pages (${PAGED.length * 2} of words), ${sizes.length} images${sizes.length ? ` (${Math.round(Math.min(...kb))}–${Math.round(Math.max(...kb))} kB)` : ""} in ${out}`);
  }
  process.exit(0);
}
