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
blue, green, violet, red, each with its own light and dark step, checked for colour-blind separation of neighbours on
each mode's paper. Their names on a plate are set in ink beside a dot of their colour, never in the colour itself.

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
down) is simply there: content never waits on an entrance. A section that waits for its data says "Memuat…" in its place. Controls answer a press in one way (`--d-press`, down a
pixel); a large story card leans a few degrees towards a mouse with a glint crossing its number. On a plate the marks
travel one after another (a series or row 45 ms after the one before), its lines draw in when the stage first shows
it.

## Components

- **Header** (56px, `--deep`, sticky everywhere, opaque): wordmark; from 900px the five links inline, search field,
  language. Below 900px: wordmark, search button, menu button; the menu is a full-screen sheet on `--deep` with the
  five links set in display type, the search field and the language switch. The current page is marked in `--route`.
  Inside a story a 2px route-coloured line along the header's lower edge shows how far through the story one is.
- **Buttons**: primary (route fill, on-route text), secondary (hairline, ink), quiet (text only). Height 44px on touch.
  Chips are pills. One focus ring: 2px `--route`, 2px offset, on everything focusable.
- **Field**: 44px, `--chart-2`, hairline; on the deep, `--deep-2` with no border.
- **Page head** (the shore): kicker (meta, uppercase is not used; a short plain label), h1, lede, on a band of the
  deep that runs edge to edge, with the night sea held still behind it (one frame; darker under the text) and the
  **tide line** under it, where the page's paper begins. The pattern is the same on every page; the sea is each
  family's own, seen from higher than the hero (a short band shows more of the chart) and framed in the water beside
  the text (above it on a phone): the stories index sails the newest three stories' words; findings and the pages
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
  paper in the page's inks; title is a sentence with the number in it. The
  numbers a step's caption names (its `focus`) stand on the beacon: a pill of `--beacon` behind the value, the text in
  `--deep`. The tools under a figure save it as an image and download the numbers it draws as CSV (from what the
  figure loaded: a row per period, or per row and state).
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
   else. The
   graticule stands in where there is no WebGL2. **Passages** (scroll-driven, native scroll): leaving the cover, its
   words drift up and fade while the sea sinks away; the first stage's figure surfaces as its stage comes up; at the
   landing the tide line swells and settles as the paper comes in.
2. **Scenes.** Each scene is a **stage**: the figure holds the screen and the caption sits in a fixed place beside
   it (from 900px: a column at the right, the stage on the page's 1120px grid like the header; from 1100px the figure
   owns the stage: the stage takes the wide grid, the caption a column of 26 to 30rem at its right, and the plate is
   shown up to 1.5 times its drawn size, with larger marks and type, a strip's rows at most 72px apart so that a strip
   of few rows is not stretched; below 900px: a band under the figure), the chart's graticule faint behind the figure. "Part 1 of 2" is said only where there are parts. Captions do not scroll past as boxes:
   the stage stays, the caption turns (`--d-turn`), the figure's marks travel (`--d-leg`). Scroll, swipe, the arrow
   keys, space, or the next/previous controls all move one step; scrolling settles on a step (scroll snap,
   proximity). Step 0 of a scene opens it: the scene's title and text, so the reader knows the figure before it
   moves. The caption shows its head, the text, and "3 / 6"; a row of ticks shows the steps and takes a tap.
   Nothing is ever cut: on a phone the stage shares its height by need (`--fig`): the caption band keeps room for its
   tallest step or, for a long one, six lines (the rest scrolls inside it), and the figure gets the rest, at least half.
   A strip of more rows than that room keeps 26px apart (`stripLeast` in plate.js) is drawn at the height that does, in
   a window of that room, and **slides** through the window as the page scrolls through the scene: at each step to the
   rows the step brings forward (at the opening to its top; where a step names none, as far down as the step is
   through the scene), between two steps between their places; the window's edges fade where the strip goes on. No
   nested scrolling: a swipe always moves the story. No text on a plate is under 12px: a line's name and value too
   long for the column wrap onto a second line. Under each sticky stage lies a run of invisible beats, one per step,
   that the scroll snaps to; the scroll position chooses the step.
3. **Landing**, on the chart: "What this data cannot say" as a bordered panel, the tools (save image, share, copy
   link, check for yourself), how to cite the story (folded: a line and BibTeX, each to copy), and the next story as a
   card.

Every caption stays in the document, in its beat, for screen readers and find-in-page; the visible caption is an
`aria-live="polite"` region. With reduced motion the stage stays, steps cut instead of travelling and nothing snaps.
A story keeps its place by step (not by pixels) across a language switch and the back button.

## Addresses and sharing

- **Addresses.** Every story, main page, play page and word the first page shows has a real path (`cerita/oknum/`),
  English under `en/`; the rest of a route follows after `#/` (a story's step: `cerita/oknum/#/1/2`, which opens on
  that step). Routes without a page of their own stay `#/kata/batik`, and every old `#/...` link still works
  (`site/address.js`). The address bar always shows the address of what is on screen, in its language. Each page is
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
  Telegram, Facebook, LinkedIn, Bluesky and email in two columns, each a plain link (no script of those sites is ever
  loaded), "Salin tautan" across the bottom, and on a stage and the landing "Salin kode sematan" (the frame above as
  an iframe). A stage's sheet and the cover's open upward, over the figure or the deck, never past the edge below. It closes on Escape or a
  press elsewhere. Not printed.
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
  phone a row that scrolls and fades at its right edge). What the reader needs in the first ten seconds is on the
  sea: a legend of two glyphs (a light and its height, a route and its ports) in its sky; once the first route has
  sailed, two notes drawn like marginalia (from the light that moved most in the open water a line down to the water,
  "higher: moved more"; from the route's middle a leader, "jokowi, 2012–2024: a port each year"), which fade when
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
  then what we know about it (that it is a name and what it names, our note) stands under it in the head. The
  voyage among its neighbours is on paper like a plate: the route with its years along it (each port clear of the
  last one named), a legend in plain words ("its closest company in 2011", ringed; "in 2024", filled), and from 900px
  the two lists of neighbours beside it. Below the tide line the lens chips, then the
  figure tabs and the figure (on a 1440x900 screen the figure begins on the first screen), then what the lens is.
- **Map**: the head runs on into a band of the deep, edge to edge, that holds the sea itself (below), the lens, the
  words picked (up to four, in the route colours, as chips that match their routes), the player that sails every
  ship through the years, and the legend in the colours the sea shows (the lights by night, the dots by day); the
  tide line under it; on paper the tools and, for two words, the comparison. Opened with no word, the map shows the
  first page's word sailed as an example (said so under the field) until the reader picks one; a hint on the sea
  says how to move over it, and goes at the first touch. From 900px the title stands on its lede's last baseline; on
  a phone the head is a line and the sea comes first, what steers it under it, the buttons in a row at its top.
  Without WebGL2 the flat chart on paper.
- **Findings**: each list is the counting's own ranking, shown by a stated rule, never picked: of the pairs, only
  those whose lines cross clearly (the rising word starts below the falling one and ends at least twice as common:
  a drift of topic, where both words live on, does not pass), the top six as figures, the first leading
  (two columns and two rows from 900px, drawn larger) (both lines on one scale, each word named where its line is, the year they cross marked), the rest folded; of the words
  that came and went or came to stay, the top eight, the rest folded. The rule is written on the page beside a rule
  of `--beacon`. The page shows its first source as soon as that source has come, not after every source.
- **Play**: the first thing to play leads, on the deep, its picture large (two rows tall from 900px); the next two
  beside it, text and picture side by side; the rest under "more" in three columns, the tide table and the year posters
  two columns wide. The first page shows the same first three. A game is a board: the round on paper, and beside it the game's voyage so far (a port
  per round: filled where right, a ring where wrong, the ship on the round now); at the end the score as a plate
  to save as an image.
- **Method, stories index, other play pages**: the page head pattern, the same cards, fields, chips and tables;
  figures on plates.

## The night sea (`site/sea.js`)

One engine, three ways to be on a page: **the hero** (below: the swell, the arrival, the dive); **held** (one frame,
drawn again only when its size, the scheme or the hover changes: behind every page head, a story's cover, the 404 and
the footer; the chart's first screen of 2,500 words, made once the page has painted, its GPU let go when the page
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
  is the chart on paper, and the page comes up over it.
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
- **Fallbacks**: without WebGL2 the flat night chart of `chart.js`, one screen tall; with reduced motion one still
  frame, no dive, no arrival. The canvas is `role="img"` with a text alternative that names the route; the status
  line under the field says what sails.
- **Explore** (the map): the reader moves the camera: drag to move over the water, the right button or Shift to turn
  and tilt, Ctrl (or a trackpad's pinch) with the wheel to come nearer to the pointer, buttons for nearer, further,
  everything, a quarter turn, and **from above**: the hero's dive as a choice, the sea glides up into the chart on
  paper and back. The keys do the same (arrows move, Shift and arrows turn and tilt, plus and minus, zero), and the
  word nearest the middle is ringed and named: Enter chooses it. Up to four routes, each ribbon in its route's colour
  by night and by day, each ship named in a pill with a dot of its colour; the player sails all of them through the
  years. Nothing moves unless the reader moves it: no swell, and no frame drawn while nothing changes. A plain wheel
  scrolls the page. By touch, as on a map: one finger moves over the water, two fingers pinch to come nearer and twist
  to turn, two fingers moved up or down together tilt (up lays the sea flatter), and a tap chooses the nearest word
  (within 24px). The sea takes the finger; the page scrolls from the band around it. No name is drawn under the buttons
  or the year.
- **Touch on the hero**: a swipe up or down scrolls the page and a pinch zooms it, as anywhere; a finger moved sideways
  turns the view the few degrees a mouse does and lets it settle back; a tap sails the nearest word.
- Covers, heads and the footer hold one frame of a sea that is no larger than the chart's first screen: a quiet
  backdrop that still shows only data (the lights, and only the routes of words the page is about), named sparingly.

## Quality bar

Phone first (360px), then 1440px. Light and dark. Every WebGL scene has a fallback (the flat chart, the graticule)
and a reduced-motion still. Keyboard reaches everything. AA contrast. No layout shift above
0.05. First screen interactive under 2 s on a cold load. Safari (WebKit) as well as Chromium: every page complete and
usable without scroll-driven animations, View Transitions, the `scrollend` event or storage (refused when cookies
are blocked); what these add is a flourish, never the content (`tests/site/webkit.mjs`). `tests/site` holds the checks and `./run.sh deploy` runs them.
