// Addresses: what a route ([page, ...args]) is called, and back. Shared by the app and by the pages generated for
// sharing and search (tests/site/publish.mjs), so the two never disagree.
//
// An address is relative to the site's root: "en/" for English, then as much of the route as has a page of its own
// as a path ("cerita/oknum/"), and the rest after "#/" ("cerita/oknum/#/1/2": scene 1, step 2). A route with no page
// of its own is all after "#/" ("#/kata/batik"), as every address was before the pages existed; those old addresses
// still lead to their route.
import { STORIES, SHOWCASE, FEATURED, TEXT } from "./text.js";

/** Every page of the app, as the first part of a route. */
export const PAGES = ["cerita", "kata", "potret", "peta", "balap", "main", "kuis", "tebak", "menempel", "pasang", "redaksi", "lingkaran", "tahun", "temuan", "bergeser", "entitas", "metode"];
/** The words that have a page of their own: those the first page shows. */
export const WORDS = [...new Set([...SHOWCASE, ...FEATURED])];

/** How many leading parts of a route have a page of their own: a story or a shown word 2, a page that needs no
 *  word 1, the first page 0, anything else none (-1). */
export const paged = ([page, arg]) =>
  !page ? 0 : page === "cerita" && STORIES.some((s) => s.slug === arg) ? 2 : page === "kata" ? (WORDS.includes(arg) ? 2 : -1) : page === "potret" ? -1 : PAGES.includes(page) ? 1 : -1;

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
  return { language, parts: PAGES.includes(more[0]) ? more : [...parts, ...more] };
}

/** Text cut to at most `most` characters: at the end of a sentence if one ends late enough, else at a word. */
export function cut(text, most = 160) {
  text = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= most) return text;
  const head = text.slice(0, most), end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "));
  return end > most * 0.6 ? head.slice(0, end + 1) : head.slice(0, head.lastIndexOf(" ", most - 1)).replace(/[,;:]$/, "") + "…";
}

/** The title and description a route is found and shared by, written for someone searching (the site's name last),
 *  in a language; undefined for a route that has none of its own. */
export function named([page, arg], language) {
  const T = TEXT[language], game = PLAY.includes(page);
  if (page === "cerita" && arg) {
    const story = STORIES.find((s) => s.slug === arg);
    if (!story) return undefined;
    const words = story[language], number = story.key.number[language] || story.key.number;
    return { title: T.seo_story(words.title), description: cut(words.teaser.includes(number) ? words.teaser : `${number} ${story.key[language]}. ${words.teaser}`) };
  }
  if (page === "kata" && arg) return { title: T.seo_word(arg), description: T.desc_word(arg) };
  if (game) return { title: T.seo_game(T[`play_${page}`]), description: cut(`${T[`play_${page}_about`]} ${T.desc_play}`) };
  const own = { "": ["seo_home", "desc_home"], cerita: ["seo_stories", "stories_lede"], main: ["seo_play", "desc_play"], peta: ["seo_chart", "desc_chart"], temuan: ["seo_findings", "desc_findings"], metode: ["seo_method", "desc_method"] }[page || ""];
  return own && { title: T[own[0]], description: cut(T[own[1]]) };
}

/** The pages to play with, in the order the play page shows them. */
export const PLAY = ["tebak", "kuis", "menempel", "lingkaran", "redaksi", "pasang", "balap", "tahun", "bergeser", "entitas"];
