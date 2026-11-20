# Jejak Kata: design system

One idea: **a sea chart of the language**. Words are islands, a word's history is a route sailed across them,
a story is a voyage. Two surfaces carry everything: **the deep** (night sea: where things are shown) and
**the chart** (paper: where things are read). Magenta is the route and nothing else. Amber is the beacon: the one
number a figure wants you to see.

No framework and no build step: the system is this file's tokens in `site/style.css`, used by every rule.
A rule that needs a size, a gap, a colour or a duration takes it from a token; a raw value is a bug.

## Tokens

Colour roles (light / dark). Names used by the figures (`--sea --shoal --paper --line --ink --ink-2 --ink-3 --route
--route-2 --route-soft --link --person --organisation --place --other --seq-0..5`) stay and are redefined from these.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--chart` | `#f3f5ef` | `#0a1622` | page background (reading) |
| `--chart-2` | `#fbfcf8` | `#102030` | cards, fields, figure paper |
| `--deep` | `#0a1f36` | `#06121f` | header, hero, story stage, footer |
| `--deep-2` | `#13324f` | `#0e2338` | raised things on the deep |
| `--on-deep` | `#eef4f2` | `#e8eff0` | text on the deep |
| `--on-deep-2` | `#a8bccb` | `#93a8b8` | secondary text on the deep |
| `--ink` | `#0c1d2e` | `#e8eff0` | text |
| `--ink-2` | `#3d4f60` | `#b3c3cc` | secondary text |
| `--ink-3` | `#667784` | `#8497a3` | meta, axes |
| `--line` | `#cdd8d4` | `#24394d` | hairlines, borders |
| `--route` | `#cf1b7e` | `#ea5aa6` | the route, the active thing, focus |
| `--beacon` | `#f0ae2c` | `#f2b84a` | the key number; highlights on the deep |
| `--link` | `#0f5c8c` | `#7fc0ea` | links in running text |

A figure's series take `--cat-1..8` in that order (plate.js): magenta (`--route`), orange (`--route-2`), aqua, yellow,
blue, green, violet, plum, each with its own light and dark step, defined once in style.css (the night steps as
`--cat-N-night`, which the dark scheme and a story's stage both take). Seven publishers share one strip, so every two of
the first seven, not only neighbours, are held apart (`tests/site/stories.mjs`): by 14 in OKLab (x100) for normal
vision and by 6 under protanopia, deuteranopia and tritanopia, and each at least 3:1 on the ground it is read on. By
night they are apart in lightness as well as hue (a pale yellow, a light aqua and a lilac over a mid blue and a dark
green); by day all must be dark enough for the paper, so the yellow is an olive gold, `#7a6500`, and the green a deep
one. Their names on a plate are set in ink beside a dot of their colour, never in the colour itself.

At night (the home hero) the islands take `--light-0..5`, dim to bright by how far a word moved; control edges on
the deep use `--line-deep-2` (3:1 against `--deep`).

Text on `--chart` and on `--deep` must pass WCAG AA (4.5:1 body, 3:1 large). The header and the stage are
always opaque.

Type: one family, Bricolage Grotesque (variable, self-hosted). Display is condensed (stretch 75%, weight 800),
headings stretch 80% weight 700, text stretch 100% weight 400/600.

| Token | Size | Line | Use |
|---|---|---|---|
| `--t-meta` | 0.8125rem | 1.4 | labels, axes, footers |
| `--t-small` | 0.9375rem | 1.5 | secondary text, controls |
| `--t-body` | 1.0625rem | 1.55 | running text |
| `--t-lede` | 1.25rem | 1.45 | decks, intros |
| `--t-h3` | 1.5rem | 1.15 | card titles, caption heads |
| `--t-h2` | clamp(1.75rem, 4vw, 2.5rem) | 1.08 | section titles |
| `--t-h1` | clamp(2.5rem, 7vw, 4.25rem) | 0.98 | page titles |
| `--t-display` | clamp(3.25rem, 12vw, 8rem) | 0.9 | hero, story covers, a word's own page |
| `--t-key` | clamp(2.75rem, 21cqi, 5rem) | 0.9 | the key number on a large story card (sized by its card) |
| `--t-caption` | clamp(1.375rem, 1rem + .9vw, 1.875rem) | 1.38 | a story caption beside its figure, from 900px |

Space: `--s1 4px, --s2 8px, --s3 12px, --s4 16px, --s5 24px, --s6 32px, --s7 48px, --s8 72px, --s9 112px`.
Gutter 16px on phones, 32px from 900px. Content width 1120px; wide 1600px (a story's stage from 1100px); reading
measure 38rem.
Radius: `--r1 6px` (controls), `--r2 14px` (cards, stage, sheets), pill for chips. No drop shadows on the chart;
one soft shadow (`--lift`) for things that float (menu, suggestions, tip).

Motion: one curve, `--sail: cubic-bezier(.45,.05,.25,1)`. Three durations: `--d-press 140ms` (state of a control),
`--d-turn 320ms` (something appears, a caption changes), `--d-leg 900ms` (something travels: a dot, a route, a word).
Things that carry data travel; chrome only turns. Unprompted, only the home hero moves, and only in three ways: the
swell of the night sea (slow, ambient, never moving anything that carries data: no light, label or route moves with
it); once per visit, the arrival (the words come on as their data arrives, then the first route is drawn once); and
the ship sailing that route. Every other sea is still: held as one frame, or (the map) drawn only while the reader
moves it. Everything else answers the reader: the pointer or the tilt of a phone nudges the camera a few degrees, the
scroll dives, a chosen word sails, a page turn brings its page in. The scroll is never taken over: the dive and the
story's passages are positions, not animations (native scroll, CSS scroll-driven animations where the browser has
them, nothing where it has not). `prefers-reduced-motion` turns travel into a cut, holds every sea as one still frame,
removes the dive and the passages, and shows titles and figures in place.

What answers a page turn, once: the old page lifts away (`--d-turn`) and the new one surfaces (`--d-leg`) while the
header stays (View Transitions where the browser has them); the title is carried over from the old title, or from the
card that was chosen (a story card's title becomes the cover's title); the page's own entrances wait until the turn
is done, then play. Arriving at a page without a turn (the first page of a visit), its title rises word by word
(letter by letter on a word's own page) and the kicker, lede and notes surface after it. What answers the scroll: a figure draws
itself in once as it first comes near the screen (lines along their length, then areas and points; bars grow from
their axis; cells come up column by column, in the order of the periods they stand for; cards and small charts
surface one after another); key numbers settle in once. Whether a figure has come near is looked at on every scroll,
resize and change of the page, never left to an observer, and a figure reached by a jump (a fast wheel, a link lower
down) is simply there: content never waits on an entrance. A part that waits for its data shows a quiet skeleton of itself in its place, as tall as it will be (a page, its head on the deep; a story's stage, its figure's panel), so nothing moves when it lands; a file that fails is asked for once more after 800 ms, and where it still fails the part says so in a line with "Coba lagi" / "Try again", which brings it without reloading the page (`awaited` in app.js, the one place for this). Controls answer a press in one way (`--d-press`, down a
pixel); a large story card leans a few degrees towards a mouse with a glint crossing its number. On a plate the marks
travel one after another (a series or row 45 ms after the one before), its lines draw in when the stage first shows
it.

## Components

- **Header** (56px, `--deep`, sticky everywhere, opaque): wordmark; where the bar is at least 52em wide inside its padding, in its own type (a 900px screen at 16px; a container query, so that larger text folds it as a narrower screen does) the five links inline, search field,
  sound (a speaker, below), language. Below 900px: wordmark, search button, menu button; the menu is a full-screen
  sheet on `--deep` with the five links set in display type, the search field, the sound toggle with its name, and the
  language switch. The current page is marked in `--route`. Inside a story a 2px route-coloured line along the
  header's lower edge shows how far through the story one is.
- **Buttons**: primary (route fill, on-route text), secondary (hairline, ink), quiet (text only). Height 44px on touch.
  Chips are pills. One focus ring: 2px `--route`, 2px offset, on everything focusable.
- **Field**: 44px, `--chart-2`, hairline; on the deep, `--deep-2` with no border.
- **Page head** (the shore): kicker (meta, uppercase is not used; a short plain label), h1, lede, on a band of the
  deep that runs edge to edge, with the night sea held still behind it (one frame; darker under the text) and the
  **tide line** under it, where the page's paper begins. The pattern is the same on every page; the sea is each
  family's own, seen from higher than the hero (a short band shows more of the chart) and framed in the water beside
  the text (above it on a phone, where the head leaves the water room above its kicker and writes no name under the
  text): the stories index sails the newest three stories' words; findings and the pages
  about change, the words that moved most; the play pages, the names or words their game asks about; a word's page,
  its own route; the method, the whole chart from above with its graticule; the 404, no route. Names on a held sea
  stay in its open water and never touch each other or a ship's pill (each takes a box; a pill moves a line up or
  down, tied to its point, rather than cover another). The tide line is the curve along which
  the home hero's dive turns the night into paper (the shader's `edge()`), drawn across the width with a thread of
  foam; it is the one boundary between the deep and the chart everywhere: under every head, where a story comes
  ashore at its landing, under the map's band, and over the footer.
- **Card**: `--chart-2`, hairline, `--r2`, padding `--s5`; a story card leads with its key number in display type
  and a one-line label (`key` in `site/text.js`), and its text is the teaser's first sentence, whole (never cut inside
  a number). The large story card (the three newest, on home and on the stories index; the newest wider, its number
  larger) is on `--deep` with the number in `--beacon`; a route-coloured line draws across its top on hover,
  and with a fine pointer it leans towards it (at most 2.5 degrees) while a lighter band of the beacon crosses the number.
  A play card leads with a small picture of its own figure, drawn from its own data (`PICTURES` in app.js: Kompas's
  names by term, the yearly shares, the first page's chart) in the plate's inks, with a meta line saying what it shows;
  what the game asks about in `--route`.
- **Figure plate**: paper `--chart-2` on the chart; on a story's stage (the deep in both schemes) it is drawn on the
  stage itself in the night's inks (the dark scheme's values, `.stage-figure` in style.css), and saved as an image on
  paper in the page's inks. Its scale runs from 0 in round steps (1, 2, 2.5 or 5 times a power of ten, at most five)
  to the step at or past the largest value; where the values are a part of a base year, the 100% line is drawn stronger. Title is a sentence with the number in it. A
  title is read beside what the plate shows at every step: it names only that moment, or one the plate shows at every
  step (a line plate's periods; a strip's first moment, which stays on it as hollow rings, named in its legend:
  "lingkaran kosong: 2010–2014" / "hollow rings: 2010–2014", shown only at the moments where rings are drawn apart from
  the dots, not at the first); a strip whose finding spans its moments has a title for
  each moment it is stepped to (`plate` a function of the moment), all drawn in the room the longest needs, so nothing
  moves when it changes. The
  numbers a step's caption names (its `focus`) stand on the beacon: a pill of `--beacon` behind the value, the text in
  `--deep`. A row of a strip with no value at the state shown (fewer pages than the story's rule asks) has an open dash where its
  dots would start, and the first such row says so ("terlalu sedikit halaman" / "too few pages"). A line's name and
  value stand at its right at the height of its value, in the order of the values,
  pushed apart where their pills would touch, each then placed on the one board (`labels.js`). The tools under a figure save it as an image and download the numbers it draws as CSV (from what the
  figure loaded: a row per period, or per row and state).
- **A count read by hand** (a scene's `read`; plate.js, `units`): where a story writes what it found reading a sample of
  places one by one, the step that says so shows a plate of its own: one mark per place read, in a block per reading
  (named at the left, its count at the block's end), each mark in the colour of a second reading (named with its count
  above; the rest an open ring). Its marks come in one after another each time it is shown. The codes come from the
  reading itself (`python -m idhist.pages readings`); `captions.mjs` holds the caption's counts to them.
- **Footer** on a phone folds "Data" and "Licence and code" (a line each, opened by a tap); from 900px they stand open.
- **Menu sheet** (phone): the chart at night, its graticule faint behind the links.
- **Footer**: every page closes with the sea: the tide line (paper above, the deep below), a band of the night sea
  held still (made once, when the footer first comes near, and kept from page to page), then on `--deep` what the data
  is, licence, links; quiet.

## The story

A story is a voyage in three parts.

1. **Cover**, one screen on the deep (on a 1440x800 laptop too: the title's size follows the screen's height): kicker
   ("Cerita" and reading time), the title in display type, the deck (teaser, the cover's one paragraph; the intro
   opens the first scene's caption), and a "Mulai" control. Behind it, the night sea held still with the route of the story's own word (the
   first of the words the story asks the reader to check that is on the chart's first screen) sailed to its last
   port, named in its pill: to the right of the title from 900px, above it on a phone (the text then sits low).
   From 900px the story's key number stands over the water in `--beacon` beside the deck, with its line, and nothing
   else; as it surfaces its figures tick up from 0 to their value, once (a denominator, and a key with no figure,
   stand as they are; with reduced motion it is simply there). The
   graticule stands in where there is no WebGL2. **Passages** (scroll-driven, native scroll): leaving the cover, its
   words drift up and fade while the sea sinks away; the first stage's figure surfaces as its stage comes up; at the
   landing the tide line swells and settles as the paper comes in.
2. **Scenes.** Each scene is a **stage**: the figure holds the screen and the caption sits in a fixed place beside
   it (from 900px: a column at the right, the stage on the page's 1120px grid like the header; from 1100px the figure
   owns the stage: the stage takes the wide grid, the caption a column of 26 to 30rem at its right, and the plate is
   shown up to 1.5 times its drawn size, with larger marks and type, a strip's rows at most 72px apart so that a strip
   of few rows is not stretched; below 900px: a band under the figure). **The stages lie on the sea**: one held night
   sea under all of them (`storySea` in app.js), its camera flying (600 ms, `--sail`) to each step: to the words the step
   brings forward (`seaWords` in scenes.js: the rows its `focus` names, a count from the text by the words of its row's
   name; the word its plate is named after; the words its caption sets in italics), else the scene's words, each looked up on the
   first page's chart (the whole chart from 900px; on a phone its first screen and, from the rest, the story's own
   words; a word not on the chart is not lit), the step's ringed in `--beacon` and named, the scene's others ringed faintly; where the scene is about one
   word over time (`word`, else the one word a step brings forward), its route is sailed to the step's year (its `mark`'s,
   else its moment's). The view is framed in the water the stage leaves open (under the caption, beside the figure from
   900px), the camera looking at the lights' height; where not all the step's words fit there, clear of the caption, the
   first that do are framed and the rest stay lit where they fall. **At a new scene**
   (going on or back, and from the cover), in the frame its gong is heard, the sea takes the whole stage for a leg
   (`--d-leg`): the figure, the caption and its meta give way, the camera flies to the scene's words, they are lit and
   named, the route sails; then the card comes back over it and the sea glides into the open water. Between steps of a
   scene the 600 ms flight stays under the card. Above the controls a **key** says in a line what the sea shows,
   made from what the sea names ("Di peta: demokrat, golkar, pks dan 7 lagi · rute “korupsi” sampai 2014"; as many words
   as fit its room, the rest counted, the step's own first; where the route leaves no room to name one, the route
   is left to its pill): written from what is lit as the flight starts, and once the sea has landed from the names it
   placed, so it never lists a word the sea does not name; its room is kept from the first frame. With reduced motion no flight and no
   taking over, and the key. The figure stands on a panel of the deep (`--paper` at 92%)
   and a caption on a shade of it (88%): their text keeps 4.5:1 over the brightest the sea can be. The sea draws only
   while it flies, on the quality ladder from the rung the visit's moving sea settled on; with reduced motion a step
   crossfades through the deep; without WebGL2 the stage is the deep with the chart's graticule faint behind the
   figure. Where a story has several scenes, the scene's title stands above
   the caption as a label; the one count is the step's. Captions do not scroll past as boxes:
   the stage stays, the caption turns (`--d-turn`), the figure's marks travel (`--d-leg`). Scroll, swipe, the arrow
   keys, space, or the next/previous controls all move one step; scrolling settles on a step (scroll snap,
   proximity). Step 0 of a scene opens it: the scene's title and text, so the reader knows the figure before it
   moves. The caption shows its head, the text, and "3 / 6"; a row of ticks shows the steps and takes a tap.
   Nothing is ever cut: on a phone the stage shares its height by need (`--fig`): the caption band keeps room for its
   tallest step, the key's line and, where the stages lie on the sea, a band of the sea between them (`BAND`, 76px: a
   ring and its name in a pill, clear of the text and the controls), and the figure gets the rest, at least two fifths
   (a strip that slides, up to three fifths). A strip that would be seen whole, title to foot, if the sea's band gave
   way takes that room, and a strip that slides anyway keeps its window: the sea's band gives way first. On a step
   where the sea then names nothing, the caption's shade covers the band and the key is not shown (an empty band is
   worse than none); on a phone a step's own words come before the scene's route (the route is sailed only where the
   step brings no word of its own). Where the tallest step would not fit beside that, the stage's captions are set a
   size smaller (1rem, then `--t-small`). A hand count is given three fifths of the stage, and any stacked figure at
   least 240px and the rows its steps name. **Where a step still does not fit its band** (a short screen, large text,
   a long caption; the figure then keeps only its least and the captions are at the body's size), the caption shows
   its whole lines, as many as fit, and under the last one a labelled control, "Baca selengkapnya" / "Read on"
   (`clamp` in app.js). One press opens the caption as a sheet of the deep over the stage above the controls, opaque,
   with the whole text; a second press ("Tutup" / "Close"), Escape or the next step closes it. Only where the text is
   taller than the whole stage (very large type) does the sheet's text scroll, and its first screen still ends on a
   whole line. So at rest a caption is read to its end or ends on a whole line above its control: no line is ever cut,
   faded, or under the controls, the key or the figure, and nothing of another step shows through (the controls and
   the open sheet are opaque). The sea's key gives its line to the text before the text gives way: its line is the
   caption's too, and where the text needs it the key is not shown (`yields`). No caption ever scrolls inside its
   band. **Stacked or side by side** is one rule
   (`SIDE` in app.js, the same media query in style.css): side by side from 900px wide, and on any screen held sideways
   from 560px (a phone in landscape gets the figure beside its captions, not over them); the controls take two rows only
   from 900px wide and 640px tall. A screen turned or resized lays the story out again at the step it is on (a
   browser's bar coming and going does not: the stage is `100svh` tall). Ticks narrower than a 44px target are only a
   picture of the way through (`glance`); the step buttons step. From 900px a story's captions take at most two sizes: `--t-caption` where a
   step fits its column at it, and for every other step one size, the largest (`--t-lede`, the body's, `--t-small`) at
   which the story's longest caption fits, measured in the language and at the width shown; a step that does not fit
   even at the smallest reads on as on a phone. On a phone a short caption leaves the rest of the band to the sea (its
   shade is only as tall as its text).
   A strip of more rows than that room keeps 26px apart (`stripLeast` in plate.js) is drawn at the height that does, in
   a window of that room, under its own title and legend, which stand pinned at the window's top (a second view of the
   same plate, so they always read whole), and **slides** through the window as the page scrolls through the scene; at
   rest a whole number of rows shows under the pinned head and the window ends at its last whole row (unless the
   strip's foot has come in), never a row cut: at each step to the
   rows the step brings forward (at the opening to its top; where a step names none, as far down as the step is
   through the scene), between two steps between their places. Every row a step names is in the window at rest, at
   every size: where they lie further apart than the window holds (a row near the top and the row of all pages at the
   foot), the window **elides** the rows between: it shows the first run of named rows, then a gap marked by a row of
   three dots, then the next run (a third view of the plate, `elided`); and the window is given the rows that needs,
   its rows set closer where they must (26px on a phone, 22 beside a caption, down to 13 where a step names nine of
   seventeen rows on a 320px phone; `panning` in app.js). Beside the caption (a phone held sideways) a strip whose rows
   would stand closer than 18px in its room pans in the same way rather than be drawn smaller. No nested scrolling: a
   swipe always moves the story. No text on a plate is under 11px on screen (`fit.mjs` holds every size to it): a
   line's name and value too long for the column wrap onto a second line, a row's name onto two. Under each sticky stage lies a run of invisible beats, one per step,
   that the scroll snaps to; the scroll position chooses the step.
3. **Landing**, on the chart (its paper covers the sea, which ends at the tide line above it): "What this data cannot
   say" as a bordered panel, its paragraphs (the story's own, word for word) a list, each led in bold by its own first
   words (the lead it has, else its first sentence where that is 12 words or fewer), the tools (save image, share, copy
   link, check for yourself), how to cite the story (folded: a line and BibTeX, each to copy), and the next story as a
   card, its top on the panel's top, staying beside the panel while it is read (from 900px).

Every caption stays in the document, in its beat, for screen readers and find-in-page; the visible caption is an
`aria-live="polite"` region. With reduced motion the stage stays, steps cut instead of travelling and nothing snaps.
A story keeps its place by step (not by pixels) across a language switch and the back button; its address follows the step
on screen (`cerita/oknum/#/1/3`), as the map's and the race's follow their words (`rewrite` in app.js), so a switch of
language or a resize returns to what was shown.

## Addresses and sharing

- **Addresses.** Every story, main page and play page has a real path (`cerita/oknum/`), English under `en/`, and so
  has every word the site names by itself (the first page's, the stories', the games', the findings'), the company
  each of those is named with on its page, and the 200 most frequent (`site/words.js`, written from the data by
  `tests/site/publish.mjs words`; the deploy fails where it is stale); the rest of a route follows after `#/` (a
  story's step: `cerita/oknum/#/1/2`, which opens on that step). Any other word stays `#/kata/batik` on the first
  page's address, so no link leads to a missing page (the deploy crawls every generated page's links), and every old
  `#/...` link still works (`site/address.js`). A word's share image is its own where the first page shows it, else
  one for all words. A page's title in a link preview is its title without the site's name. The address bar always shows the address of what is on screen, in its language. Each page is
  called what a search engine shows whole: a title of 50 to 60 characters and a description of 120 to 160, unique,
  in each language (`address.js` picks the first of a few wordings that fits; `tests/site/meta.mjs` holds it to it).
- **A figure on another site**: `cerita/oknum/embed/#/1/2` frames the plate of scene 1 at step 2 for an iframe, with
  its caption, the steps to move through and a link to the story (`target="_top"`); no header, no footer. Its
  generated page is the story's own, canonical to it and not in the sitemap, so the story is never found twice.
- **Share control** ("Bagikan"): a secondary button, beside "Mulai" on a story's cover (on the deep: `--deep`,
  `--line-deep-2` edge), in the landing's tools, and on each stage as a 24px mark (an arrow out of a tray, in
  `--on-deep-2`) at the right of the count, which shares that step. Where the device has a share sheet it opens straight
  away, with the title, a line and the address, and on a stage the step's plate as a PNG where the sheet takes files.
  Elsewhere it unfolds a sheet of paper (`--chart-2`, hairline, `--r2`, `--lift`): "Bagikan ke", then WhatsApp, X,
  Telegram, Facebook, LinkedIn, Bluesky and email in two columns, each a plain link with a small mark of a few strokes
  (inline SVG; no script, image or font of those sites is ever loaded), then under a hairline "Salin tautan", and on a
  stage and the landing "Salin kode sematan" (the frame above as an iframe). It is the one way to copy the address
  where there is a share control (the landing's tools have no second "copy link"). From 900px a stage's sheet and the
  cover's open upward, over the figure or the deck, never past the edge below; on a phone the sheet rises from the
  screen's foot over a veil of the deep. It closes on Escape or a press elsewhere. Not printed.
- **Share images** (`og.jpg`, 1200x630, under 300 kB, made by `tests/site/publish.mjs` at deploy): a card on the
  night sea of the page itself (a story's cover sea with its own word's route, a word's head sea, else the first
  page's), shaded from `--deep` on the left: the mark and "Jejak Kata" at the top; at the bottom a kicker with its
  route-coloured rule, then for a story its key number in `--beacon` at display weight (800, stretch 75%) with its line
  in `--on-deep-2` and the title in heading type, for a word the word in display type and what its company was in the
  first and last year; the site's address bottom right. The first page's image is the hero itself, after its first
  route has sailed. Each in Indonesian and English.

## Pages

- **Home**: hero on the deep, full height: the map of words as a night sea with one route sailed (below); headline
  in display type; one field ("Ketik kata, lihat rutenya") and a few chips, their label above them from 900px (on a
  phone a row that scrolls and fades at its right edge, about 30px of the next chip peeking out under the fade). What the reader needs in the first ten seconds is on the
  sea: a legend of three glyphs (a light and its height, a route and its ports, a light ringed: "Klik atau ketuk sebuah
cahaya: katanya berlayar") in its sky, on a phone two (the route is named by its own note, so the ringed light takes
its line); once the first route has
  sailed, two notes drawn like marginalia (from the light that moved most in the open water a line down to the water,
  "higher: moved more"; from the route's middle a leader, "jokowi, 2012–2024: a port each year", on two lines where
  one would pass the gutter), which fade when
  the reader picks a word; the year as a marker that counts as the ship sails, over a line from the first year to the
  last; and at the foot of the first screen the dive signposted ("Scroll: the sea becomes the chart"). Under the field,
  the word sailing and what it is (`GLOSS` in text.js: the names in both languages, the common words in English); the
  chips carry the same in their label. The lede says what Kompas is. Then, on the chart: three featured stories
  with their key numbers; things to play with; how it is measured (sources, pages counted, what the tests say), in
  three short columns, every number read from the data.
- **States**: an unknown address is a 404, a head of the deep like every other page's and as tall as the screen
  allows, with the ways back, the night sea held still beside its text, with no route on it. A word not on the chart, data that did not load and a search with no match each say what happened
  and what to do.
- **Stories index**: page head, then cards led by the key number; the newest three large; the rest as an index, a
  row each under a rule of ink, the number beside the title from 900px (two columns of rows).
- **Story on a phone**: the cover holds kicker, title, deck and "Mulai"; the intro opens the first scene's caption.
- **Word and portrait**: the word in display type rises in, letter by letter; behind it the sea with the word's
  route on the first page's lens (Kompas, year by year) when it has one there; what the word is in one line (`GLOSS`),
  then what we know about it (that it is a name and what it names, our note) stands under it in the head. The head
  runs on into the deep under the source chips and the figure tabs and on into the route's band, so the first screen
  is one stage (where the figure chosen is on paper, the tide line comes under the tabs). The voyage among its
  neighbours takes the whole band, in the night's inks: the route with its years along it (each port clear of the last
  one named), fitted to the route and the islands near it, to the band's width and the screen's height; an island far out hangs on a dotted spur from the route's last port, its arrow pointing to where
  it lies; a legend in plain words ("its closest company in 2011", ringed; "in 2024", filled), and a column beside it from
  900px (under it on a phone): the year the ship is at, its closest company that year, and the two lists. A name that
  finds no clear spot on the plate is left out; the column names them all. Under it the player and a **year rail**: the years, each a stop, pressed and drawn
  along to scrub the route. Below the tide line the lens chips, then the figure tabs and the figure (on a 1440x900
  screen the figure begins on the first screen), then what the lens is, and what to do next as three cards (its
  portrait, the chart with other words, a race), each a title and a line of what it does.
- **Map**: the head runs on into a band of the deep, edge to edge, that holds the sea itself (below), the lens, the
  words picked (up to four, in the route colours, as chips that match their routes), the player that sails every
  ship through the years, and the legend in the colours the sea shows (the lights by night, the dots by day); the
  tide line under it; on paper the tools and, for two words, the comparison. Opened with no word, the map shows the
  first page's word sailed as an example (said so under the field) until the reader picks one; a hint on the sea
  says how to move over it, and goes at the first touch. From 900px the head is short (the title on its lede's last
  baseline), the sea fills the rest of the first screen, and what steers it (lens, field, chips, player) stands on the
  water at its upper left on a veil of the deep; on a phone the head is a line and the sea comes first, what steers it
  under it, the buttons in a row at its top.
  Without WebGL2 the flat chart on paper.
- **Findings**: each list is the counting's own ranking, shown by a stated rule, never picked: of the pairs, only
  those whose lines cross clearly (the rising word starts below the falling one and ends at least twice as common:
  a drift of topic, where both words live on, does not pass), the top six as figures (both lines on one scale, each
  word named by its line and clear of both, on the one board (`labels.js`), the year they cross marked), drawn at the size they are shown: the first leading across
  the page, large, the year they cross named; the next five under it, smaller (rows of three from 900px, a shorter last row as wide as the others), by how many
  times as common the rising word ends, each with only its first and last year; the rest folded; of the words
  that came and went or came to stay, the top eight, the rest folded. The rule is written on the page beside a rule
  of `--beacon` (from 900px beside what the pairs are, so that the lead pair begins on the first screen). A pair's two
  lines draw themselves together as the figure first comes near (once; at once with reduced motion or reached by a
  jump), and where they cross is marked as the lines reach it, the lead's named with its year. The page shows its first source as soon as that source has come, not after every source, and its pairs as soon as
  theirs have come: the two lists below the first screen are asked for only then, each a skeleton until it lands (each
  word is read from a bucket of 64, so the lists cost as much again as the pairs).
- **Play**: the first thing to play leads, on the deep, its picture large (two rows tall from 900px); the next two
  beside it, text and picture side by side; the rest under "more" in three columns, the tide table and the year posters
  two columns wide. The first page shows the same first three. A card the viewer has opened says so in a meta line
  under its text, a game's with the best score (localStorage; nothing where storage is refused). A toy's head is
  shorter on a phone (less sea above the kicker, the lede at the body's size), so that the toy begins on the first
  screen. Where a figure tells something on hover, a tap tells it too.
  A game shows a name as a name (`shown` in deal.js: "Sandiaga Uno", "KPK", "Mahfud MD"), a common word in lower case;
  the data keeps all in lower case. The quiz's card (the lead) pictures its own question: a year's words as chips,
  "Tahun berapa?", and four years as the game shows them, the right one ticked.
  A game is a board: the round on paper, and beside it the game's voyage so far (a port per round: filled where right,
  a ring where wrong, the ship on the round now; a run of three or more right ringed in `--beacon`, the streak), the
  tally and the one control that goes on (lock, next, play again), always in the same place: in the panel held beside
  the round from 900px, in a bar held at the screen's foot on a phone (the voyage without its labels, the tally, the
  control), where the thumb is. Keys: 1-4 choose, Enter goes on; after an answer focus is on that control, after
  "next" on the new question. A wrong answer is marked by a dashed edge and a cross, the right one filled with a tick,
  never by colour alone. At the end the score as a plate to save as an image, its rank in a line, one press to play
  again, and the toy that follows from it.
  **The quiz** ("Kuis") is one game of ten rounds dealt by `site/deal.js` from `site/data/quiz.json` (gathered from the
  data by `node tests/site/games.mjs write`): seven kinds of question (which year, from its ten most characteristic
  words, less any that names the year by itself, a number or a pairing of two names, `marker`; who, from the words that
  kept a name company in a year; which was more frequent in a year; which peaked first; official word or loanword in
  2024; which newsroom most often writes a word of public life, `ROOM_WORDS`, in stories about a name, with a count in
  each; up, down or about the same between two years), in a rhythm (every kind once, never one twice running, none
  more than twice and the loanword question once at most, `CAP`) and harder as they go: rounds 1-3 easy, 4-7
  middling, 8-10 hard, each question's difficulty read from the data in one place (`DIFFICULTY`: a comparison by its
  ratio, hard at the margin and easy from twelve times; who by the pages naming the name that year; which year by how
  far its words stand above the years near it; which peaked first by the years between the peaks) and shown in the
  round's line as three marks and a word ("mudah", "sedang", "sulit"). A question is dealt only where its answer
  clears its margin (`MARGIN` in deal.js, one place); the years offered beside the answer lie within three of it
  where the data allows and never all on one side; the names offered beside a "who" are of its own sort (a person
  among people of their own time and country, a party among parties: `PERSON_KIND`, `BODY_KIND`) and in the news that
  year. Within a game no word, name, pair or year is shown twice; a deck per kind, kept for the visit, deals every
  question once before any comes again, and every name and word a game showed (as answer, choice or clue) goes to the
  back for the visit's next games. After each answer a line is said (never the same one twice running; the owner's
  wording, in text.js: the praise of the last three rounds is its own, and a year missed by one is "Nyaris"), the
  answer written as it would start a sentence (a name as a name, a word in quotation marks, in English with what it
  means where the site says: "korupsi (corruption)"), and the evidence of exactly what was asked is drawn small in the
  plates' inks: the shares as marks on one scale (a row each; the three newsrooms in their colours; its labels at two
  significant digits, as few as keep them apart), for "who" how many of the words shown kept each name offered
  company, or a line over the years (a word's, or a year's words together) with the years asked about marked, drawn
  in along its length (a cut with reduced motion). On a phone a round and its answer, evidence included, fit one
  screen above the bar; the answers under the voyage on the score plate are shortened or left out where they would
  touch. A question that sets a name beside a word carries the caution "sharing a page is
  not being accused" in sight, and never asks it of a word that reads as an accusation (deal.js, `SENSITIVE`): those are
  asked only as "guess the number" asks them. In "guess the number" (six rounds, two each of a low, a middle and a high
  true value, so that no one guess always pays; only names a reader knows and words with a point, `POINTED`, on which
names differ: the name with the most of it has at least 15 in 100 and three times the least, `MARGIN.spreadTop` and
`spreadRatio`; points by
  how far off as a part of the truth, said in a line above the board before the first round) the answer is not simply
  shown: its mark sails (`--d-leg`) from the reader's guess to the truth along the scale, drawing its wake in the
  route, so how far off the guess was is a distance one sees travelled (a cut with reduced motion); then a line by how
  far off, how far in plain numbers, and one of context (who has the most and the least of that word). A tap on the scale sets the guess there;
  the arrows move it.
- **Method, stories index, other play pages**: the page head pattern, the same cards, fields, chips and tables;
  figures on plates. The method opens with the method on one word the first page sails (`jokowi`, 2013 then 2014), in
  four steps stepped or played: the year's pages and the share that hold the word, the words it appears with most, its
  port on the chart among them, and a year on its new company, its new port and its shift; every number read from the
  first page's lens (meta.json, words/, paths/, first.json), none written by hand. The first three steps are one drawing: the page,
  ties from its marked line to the words it shares pages with, and at the chart step those words sail (`--d-leg`) from
  the list to their own ports and are named there (the ties go; a word with no port leaves with them). Above the
  sensitivity table, one line says what it shows, read from the same numbers (`verdict` in app.js): how many sources
  catch 80% or more of a large planted change and between what shares, the most any catches of a small one, and which
  catch less; on a rule of `--beacon`. A play page's head sea lights that
  game's own words: those its picture shows.

## The night sea (`site/sea.js`)

One engine, three ways to be on a page: **the hero** (below: the swell, the arrival, the dive); **held** (one frame,
drawn again only when its size, the scheme or the hover changes: behind every page head, a story's cover, the 404 and
the footer; under a story's stages it is held between steps and flies to each (`fly`); the chart's first screen of 2,500 words, made once the page has painted, its GPU let go when the page
turns); and **explore** (the map). The home hero is the chart of words in WebGL2, seen across the water at a low angle toward a horizon. Raw WebGL2 in
one module, no library: four small programs (water, lights, the route's ribbon, the ship and its ports), no matrices,
colours, the curve and the leg read from the tokens. It is fetched beside the data and made only after the hero's
text has been painted. What is on screen is the data and nothing else:

- **A light is a word** of the chart, where the chart puts it. Its **height above the water is how far it moved**
  (its shift; 0.0042 chart units per unit, so the words that moved most rise out of the sea), and the same number
  makes it brighter (`--light-0..5`); its **size is how common it is** (rank). Under each lit word, its reflection.
- **The graticule** is the chart's own, a line every 125 units, lying on the water; the water's swell and the haze
  toward the horizon are surface, not data. Labels name the words that moved most among the frequent ones, as many as
  fit; the route's word is named in a pill at the ship.
- **The route** is a ribbon on the water in `--route-on-deep`, as wide in pixels at any distance, drawn as far as the
  ship (a light with its own reflection) has sailed. Framing a route, the camera turns (at most about 35 degrees)
  to see it from its side and backs off until it fits beside the text (to its right from 900px, above it on a
  phone), then follows the ship a little.
- **The arrival**, once a session and never with reduced motion: the sea is dark when the hero's text paints; the
  words come on from the route's word outwards as the first screen's words reach the GPU, the rest fade in when they
  arrive, a tally under the year counts the words lit (a real count), and the route draws last (at most 2.6 s after
  the sea is on screen). Nothing waits on it: the field and chips work from the first frame.
- **The dive**: where the sea is 3D the hero runs on for three quarters of a screen past its text. The sea is held on
  screen (sticky) while the scroll position (`--dive`, 0..1) pitches the camera down to the whole chart seen from
  above; the lights sink onto the water; the text and its shade give way; from halfway a tide line rises up the
  screen, the night above it, the paper (`--chart`, `--line`, the day colours of the chart) below. At the end the sea
  is the chart on paper, and the page comes up over it; the paper of the page fades in over the sea's lower edge
  (`--s9`), so the chart never ends on a straight cut.
- **Cost**: rendering stops when the hero is off screen or the tab is hidden, runs at about 30 frames a second when
  only the swell moves and not at all once all is paper; the device pixel ratio is capped at 1.5; small or few-core
  devices carry 7,000 words instead of 20,000.
- **The quality ladder** (`LADDER` in sea.js): a sea that moves (the hero, the map) starts on rung 0 and gives up one
  thing per rung, the least seen first:

  | Rung | Pixels (of the capped ratio) | Reflections | Words past the 1,500 lit ones | Swell |
  |---|---|---|---|---|
  | 0 | 100% | yes | all | yes |
  | 1 | 75% | yes | all | yes |
  | 2 | 75% | no | all | yes |
  | 3 | 60% | no | 35% (the most frequent) | yes |
  | 4 | 50% | no | 35% | no: the sea holds still between moves, and no frame is drawn for it |

  Only frames drawn one after another count (the swell alone is drawn at half the rate on purpose, and is not a slow
  frame). They are judged a quarter of a second at a time: a rung down while the median frame takes longer than 24 ms
  (under about 40 frames a second), never a rung up. So the ladder settles within about a second (four quarters at
  most) and never goes back and forth; a slow phone settles on its rung during the arrival. The rung of the sea that
  moves is `window.seaRung` (and `rung` in a sea's `state()`); `tests/site/hero.mjs` checks that it only steps down
  and settles within 1.5 s of its first step.
- **Names** on every picture (the hero, the held seas, a story's sea, the map, the flat chart, a word's route plate)
  are placed by one function (`site/labels.js`): what no name may touch is reserved first (the routes as sailed, the
  rings, the figure card, the caption, titles, controls, the year), then names are offered by priority (the ships, the
  words a step is about, the first port's year, the hero's notes, the ringed word, the rest), each taking the first of
  its spots that is clear; one with none is left out, never drawn over anything, and a word already named (a ship, a
  ringed word, the light under the pointer) is not named again (`tests/site/labels.mjs`).
- **Fallbacks**: without WebGL2 the flat night chart of `chart.js`, one screen tall; with reduced motion one still
  frame, no dive, no arrival. The canvas is `role="img"` with a text alternative that names the route; the status
  line under the field says what sails.
- **Explore** (the map): the reader moves the camera: drag to move over the water, the right button or Shift to turn
  and tilt, Ctrl (or a trackpad's pinch) with the wheel to come nearer to the pointer, buttons for nearer, further,
  everything, a quarter turn, and **from above**: the hero's dive as a choice, the sea glides up into the chart on
  paper and back; from above it frames the words (their middle 98%, north up) in the water its controls, the year and the hint leave
  open (each cut off at the side that loses least), as far out as that needs, the pressed control in the route, with larger dots, the faint ones
  stronger and the names in a reader's ink, and coming down it returns to the reader's place. The keys do the same (arrows move, Shift and arrows turn and tilt, plus and minus, zero), and the
  word nearest the middle is ringed and named: Enter chooses it. Up to four routes, each ribbon in its route's colour
  by night and by day, each ship named in a pill with a dot of its colour; the player sails all of them through the
  years. Nothing moves unless the reader moves it: no swell, and no frame drawn while nothing changes. A plain wheel
  scrolls the page. By touch, as on a map: one finger moves over the water, two fingers pinch to come nearer and twist
  to turn, two fingers moved up or down together tilt (up lays the sea flatter), and a tap chooses the nearest word
  (within 24px). The sea takes the finger; the page scrolls from the band around it. No name is drawn under the buttons
  or the year; the names are what the reader reads here, so they stand at full strength (12px, on a halo of the deep),
  where a held sea names quietly.
- **Keys on the hero**: the sea is the first stop of Tab after the header (`keys` in sea.js). It takes the one focus
  ring, drawn inside its edge, and rings and names the light nearest the middle of its open water; the arrows move the
  ring to the nearest light that way, Enter sails it, Escape lets it go; the key's third line then says so in a fourth
  ("Di laut: panah memilih cahaya, Enter melayarkannya"), which is also what describes the sea to a screen reader.
- **Touch on the hero**: a swipe up or down scrolls the page and a pinch zooms it, as anywhere; a finger moved sideways
  turns the view the few degrees a mouse does and lets it settle back; a tap sails the nearest word.
- **The hand**, on every sea (the hero, the heads, a story's cover and stages, the footer, the map): it leans a few
  degrees to the pointer (by touch, to a finger moved sideways, and to the tilt of a phone where the browser gives it
  without asking, past a small dead band), and the light nearest the pointer on its open water (not under its text or
  controls) brightens, is ringed and is named on the board (`labels.js`; where its name finds no room, only ringed). A
  click on it chooses it: the hero sails it, the map adds it, every other sea opens its word's page; by touch a held
  sea names it at the first tap and opens it at the second. A held sea draws only while it leans; with reduced motion
  it does not lean, and the light is still named. A press or a drag on a sea's water starts no selection; the text
  over it is selected as any text is (`sea.js`, `host`).
- Covers, heads and the footer hold one frame of a sea that is no larger than the chart's first screen: a quiet
  backdrop that still shows only data (the lights, and only the routes of words the page is about), named sparingly.

## Sound (`site/sound.js`)

The night sea can be heard. Everything is made in the page with the Web Audio API: no files, no samples, no library.
It is a synthesised sound that borrows from Javanese and Balinese gamelan (two of its tunings, the bronze of its
metallophones and gongs, and its colotomic form) and, for one voice, from the plucked strings of the sasando (Rote) and
the kacapi (Sunda). It is not gamelan, it quotes no piece, and it does not stand for the music of the whole
archipelago. Nobody has yet judged it by ear: what is claimed below is measured offline (`tests/site/sound.mjs`), not
heard.

- **The bed**: the sea at night, quiet. Two lines of surf, one to each side and not alike: a body of white noise
  through a lowpass that opens as each wave rises, and foam, a brighter hiss (highpassed noise) that flares as the wave
  breaks at its crest and runs out after it; on a swell of 5.5 to 12 s whose every wave has its own height and length,
  so nothing repeats. A low drone (the root, the near fifth above it and the root again, faint and a few cents apart),
  breathing slowly. Now and then, far off and under the water's filter, two or three notes of a gender (bars) or a
  bonang (knobbed gongs), wandering by a step or two: never the same phrase. Each family of pages hears its own sea, as
  each has its own sea scene, by a few numbers (`BEDS`): the home hero open water, a story's stage further off and
  lower, the map wider with more far phrases, a word's page and the rest quieter.
- **Two scales on D, five notes each**: slendro above water (idealised as five equal steps of 240 cents; real sets are
  uneven) and pelog under it: tones 1 2 3 5 6 of the seven (those of pathet lima and nem) at 0, 119, 255, 672 and 784
  cents, the average of the 20 Central Javanese pelog saron sets measured by Surjodiningrat, Sudarjana and Susanto
  (1972). Every gamelan is tuned on its own; these are one choice. Every pitch, the bed's and every sound's, is of the
  scale now heard.
- **The dive** is the one to remember: one lowpass lies over the whole bed (the water). As the hero's dive goes, it
  closes an octave every quarter of the way and the waves slow, so the sea is heard from under the water; where the
  tide line rises (halfway) the water closes over with a sweep down and a few bubbles, the scale turns to pelog and the
  drone sinks a degree of it; coming back up, a sweep the other way and slendro again. A story's sea, flying from one
  step's view to the next, closes the water a little (15%) and opens it again; that never reaches pelog.
- **Bronze**: tones are struck with a soft mallet (an 8 to 30 ms rise, no click) and their partials are inharmonic, each
  dying on its own, higher ones sooner. A bar (gender, saron) rings as a free bar: 1, 2.76, 5.40, 8.93. A knobbed gong
  (bonang, kenong, kempul, gong) has a strong fundamental, partials a little off 2 and 3 (2.02, 2.97) and a high clang
  (4.37, 6.1) gone at once. Sustained tones are paired as Balinese instruments are (ngumbang and ngisep): the
  fundamental is two voices a few Hz apart, and their beating is a slow shimmer (4 Hz on bars, 3 on kenong and kempul,
  2.5 on the gong suwukan), on the gong ageng its ombak, the wave (2 Hz).
- **A story is a gong cycle** (the colotomic structure): each step forward a stroke, odd steps a kenong (degrees 5, 6,
  7 in turn), even ones a kempul (degrees 1, 2, 3), so no two steps in a row are one pitch; each new scene (and the
  first, coming from the cover) a gong suwukan (degree -3, about 97 Hz); the landing the gong ageng (degree -7, about
  56 Hz, low and long, with a wave on the beach). A step back is the same stroke, soft and damped by the hand; back
  into the scene before, the suwukan damped. After its stroke a step's numbers (the values on the beacon) are notes on
  a gender, lowest to highest, each pitched by where it lies between the lowest and the highest, so the chart can be
  heard. The cover opening is a swish and two bonang notes.
- **What else the site does**, short and soft: the arrival (a soft low gong and a few plucked lights coming on), a
  route sailed (a low tone rising under it and a plucked string, after the sasando or kacapi, at each port, left to
  right, rising), on the map a tick (a click and a damped knob) as a word is added or taken away and a bonang note as a
  light is chosen, a share sheet opening (a swish up), a quiz answer (two gender notes up when right; two damped notes
  down when wrong, never a buzzer), a press, and a barely heard tick as a control is pointed at with a mouse or reached
  by keyboard (never by touch).
- **Manners**: on by default, unless this viewer turned it off (the choice is kept per viewer in localStorage; where
  storage is refused it is on at each visit). A toggle in the header (in the menu on a phone; in an embed's foot): a
  speaker, its waves while on and a cross while off, named "Suara" / "Sound", `aria-pressed`, pressed from the first
  frame. A browser lets sound start only after the reader has done something on the page, so once the page has been
  painted (at its first idle moment, never holding up the first screen) the AudioContext is made: where the browser lets
  it run, the sea is heard at once; else it waits for the first press, key or tap anywhere (a scroll or a hover does not
  count, as browsers see it) and comes in over a second and a half. Until then the first page's hero says so plainly under its
  status line ("Suara menyala: ketuk di mana saja untuk mendengar" / "Sound is on: tap anywhere to hear it"), with the
  toggle beside it to turn it off; it fades once the sea is heard or turned off, keeping its room until the page changes
  (nothing moves). Never an overlay or a gate. `sound.js` is fetched once the context can run. Turned off (one press),
  it is remembered and nothing of it is made on later visits. Silent when the tab is hidden (a fade, then the context
  sleeps), once turned off (a 1.5 s fade), and in an embed unless turned on there: an embed sits on other people's
  pages. Reduced motion does not silence it. Without Web Audio there is no toggle.
- **Level**: low. The bed sits near -35 dBFS (rms), its peaks about -15; the sounds over it at -42 (the hover tick) to
  -20 dBFS (peak), all through a compressor that only catches peaks; the gong ageng stays under its knee (-19 dBFS out),
  so its low fundamental never makes it pump. `tests/site/sound.mjs` renders the beds, every sound, a whole story and
  the dive offline, fails above -6 dBFS, and measures the claims above: the gong's energy under 120 Hz and its 1-3 Hz
  ombak, the partial ratios, the pairs' beating, steps on different pitches, slendro above water and pelog under it.

## Quality bar

Phone first (360px), then 1440px. Light and dark. Every WebGL scene has a fallback (the flat chart, the graticule)
and a reduced-motion still. Keyboard reaches everything. AA contrast. No layout shift above
0.05. First screen interactive under 2 s on a cold load. Safari (WebKit) as well as Chromium: every page complete and
usable without scroll-driven animations, View Transitions, the `scrollend` event or storage (refused when cookies
are blocked); what these add is a flourish, never the content (`tests/site/webkit.mjs`). `tests/site` holds the checks and `./run.sh deploy` runs them.
