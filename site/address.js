// Addresses: what a route ([page, ...args]) is called, and back. Shared by the app and by the pages generated for
// sharing and search (tests/site/publish.mjs), so the two never disagree.
//
// An address is relative to the site's root: "en/" for English, then as much of the route as has a page of its own
// as a path ("cerita/oknum/"), and the rest after "#/" ("cerita/oknum/#/1/2": scene 1, step 2). A route with no page
// of its own is all after "#/" ("#/kata/batik"), as every address was before the pages existed; those old addresses
// still lead to their route.
import { STORIES, SHOWCASE, FEATURED, TEXT } from "./text.js";
import { PAGED } from "./words.js";

/** Every page of the app, as the first part of a route. */
export const PAGES = ["cerita", "kata", "potret", "peta", "balap", "main", "kuis", "tebak", "menempel", "pasang", "redaksi", "lingkaran", "tahun", "temuan", "bergeser", "entitas", "metode"];
/** Other names a page is reached by, as the menu calls it ("Mainan", "Cara"): each leads to its page, whose address
 *  stays its own (the app writes it in the address bar; the generated page names it as canonical). */
export const ALIASES = { mainan: "main", cara: "metode" };
/** The words the first page shows. */
export const WORDS = [...new Set([...SHOWCASE, ...FEATURED])];
/** The names the play pages ask about, and the words "guess the number" asks about. */
export const QUIZ_NAMES = ["jokowi", "prabowo", "ahok", "anies baswedan", "gibran"];
export const GUESS_WORDS = ["tersangka", "korupsi", "viral", "kritik", "survei", "istri", "anak", "maaf", "mahasiswa", "video", "keluarga", "rakyat", "janji", "sidang"];
/** The words that have a page of their own: every word the site names by itself, its company one hop on, and the
 *  most frequent (site/words.js, written from the data by `node tests/site/publish.mjs words`, which says the rule). Any
 *  other word is reached at "#/kata/<word>" on the first page's address, so no link leads to a missing page. */
const HAS_PAGE = new Set(PAGED);

/** How many leading parts of a route have a page of their own: a story's frame for other sites 3 (`cerita/<slug>/embed`,
 *  its scene and step after "#/"), a story or a shown word 2, a page that needs no word 1, the first page 0, anything
 *  else none (-1). */
export const paged = ([page, arg, more]) =>
  !page ? 0 : page === "cerita" && STORIES.some((s) => s.slug === arg) ? (more === EMBED ? 3 : 2) : page === "kata" ? (HAS_PAGE.has(arg) ? 2 : -1) : page === "potret" ? -1 : PAGES.includes(page) ? 1 : -1;
/** The part of a story's address that frames one of its figures for another site; and the story's own route, which
 *  such a frame names as its canonical address. */
export const EMBED = "embed";
export const canonical = (parts) => (parts[0] === "cerita" && parts[2] === EMBED ? parts.slice(0, 2) : parts);

const join = (parts) => parts.map(encodeURIComponent).join("/");

/** The address of a route in a language, relative to the site's root. */
export function address(parts, language) {
  const n = Math.max(0, paged(parts));
  return (language === "en" ? "en/" : "") + (n ? join(parts.slice(0, n)) + "/" : "") + (parts.length > n ? "#/" + join(parts.slice(n)) : "");
}

/** The route and language of an address relative to the site's root. The language is null where the address does
 *  not say (the root, as old links have it); a fragment that names a page is the whole route. */
export function routeOf(relative) {
  const [path, fragment = ""] = relative.split("#"), split = (s) => s.split("/").filter(Boolean).map(decodeURIComponent);
  const parts = split(path.split("?")[0]), more = fragment.startsWith("/") ? split(fragment) : [];
  const language = parts[0] === "en" ? (parts.shift(), "en") : parts.length ? "id" : null;
  if (ALIASES[parts[0]]) parts[0] = ALIASES[parts[0]];
  return { language, parts: PAGES.includes(more[0]) ? more : [...parts, ...more] };
}

/** Text cut to at most `most` characters: at the end of a sentence if one ends late enough (at `least` or later), else
 *  at a word. */
export function cut(text, most = 160, least = most * 0.6) {
  text = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= most) return text;
  const head = text.slice(0, most), end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "));
  return end >= least ? head.slice(0, end + 1) : head.slice(0, head.lastIndexOf(" ", most - 1)).replace(/[,;:]$/, "") + "…";
}

/** What search engines show whole: a title of 50 to 60 characters, a description of 120 to 160 (tests/site/meta.mjs). */
export const TITLE = [50, 60], DESCRIPTION = [120, 160];
/** The first of some titles whose length is in TITLE, else the nearest to it. */
const fit = (titles) => [].concat(titles).map((x) => [x, x.length < TITLE[0] ? TITLE[0] - x.length : Math.max(0, x.length - TITLE[1])]).sort((a, b) => a[1] - b[1])[0][0];
/** A description from sentences: as many as it takes to reach DESCRIPTION's least, cut to its most. */
const describe = (...said) => cut(said.filter(Boolean).join(" "), DESCRIPTION[1], DESCRIPTION[0]);

/** The title and description a route is found and shared by, written for someone searching (the site's name last),
 *  in a language, and the title as a link preview shows it (`shared`: the same title without the site's name, which
 *  the preview names on its own line); undefined for a route that has none of its own. A story's title is its own
 *  title with words after it, never before, so the window and the preview begin alike. */
export function named(parts, language) {
  const own = words(parts, language);
  return own && { ...own, shared: own.title.replace(/ \| Jejak Kata$/, "") };
}
function words([page, arg], language) {
  const T = TEXT[language], game = PLAY.includes(page);
  if (page === "cerita" && arg) {
    const story = STORIES.find((s) => s.slug === arg);
    if (!story) return undefined;
    const words = story[language], number = story.key.number[language] || story.key.number;
    return { title: fit(T.seo_story(words.title)), description: describe(words.teaser.includes(number) ? "" : `${number} ${story.key[language]}.`, words.teaser, words.intro) };
  }
  if (page === "kata" && arg) return { title: fit(T.seo_word(arg)), description: describe(T.desc_word(arg)) };
  if (game) return { title: fit(T.seo_game(T[`play_${page}`])), description: describe(T[`play_${page}_about`], T.desc_play) };
  const own = { "": ["seo_home", "desc_home"], cerita: ["seo_stories", "stories_lede"], main: ["seo_play", "desc_play"], peta: ["seo_chart", "desc_chart"], temuan: ["seo_findings", "desc_findings"], metode: ["seo_method", "desc_method"] }[page || ""];
  return own && { title: fit(T[own[0]]), description: describe(T[own[1]]) };
}

/** The pages to play with, in the order the play page shows them. */
export const PLAY = ["tebak", "kuis", "menempel", "lingkaran", "redaksi", "pasang", "balap", "tahun", "bergeser", "entitas"];
