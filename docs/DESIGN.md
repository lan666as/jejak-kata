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
Gutter 16px on phones, 32px from 900px. Content width 1120px; reading measure 38rem.
Radius: `--r1 6px` (controls), `--r2 14px` (cards, stage, sheets), pill for chips. No drop shadows on the chart;
one soft shadow (`--lift`) for things that float (menu, suggestions, tip).

Motion: one curve, `--sail: cubic-bezier(.45,.05,.25,1)`. Three durations: `--d-press 140ms` (state of a control),
`--d-turn 320ms` (something appears, a caption changes), `--d-leg 900ms` (something travels: a dot, a route, a word).
Things that carry data travel; chrome only turns. Unprompted, only the home hero moves, and only in three ways: the
swell of the night sea (slow, ambient, never moving anything that carries data: no light, label or route moves with
it); once per visit, the arrival (the words come on as their data arrives, then the first route is drawn once); and
the ship sailing that route. Everything else answers the reader: the pointer or the tilt of a phone nudges the camera
a few degrees, the scroll dives, a chosen word sails. The scroll is never taken over: the dive is a position, not an
animation. `prefers-reduced-motion` turns travel into a cut, holds the sea as one still frame and removes the dive.
Controls answer a press in one way (`--d-press`, down a pixel); key numbers settle in once as they first come into
view; a large story card leans a few degrees towards a mouse with a glint crossing its number.

## Components

- **Header** (56px, `--deep`, sticky everywhere, opaque): wordmark; from 900px the five links inline, search field,
  language. Below 900px: wordmark, search button, menu button; the menu is a full-screen sheet on `--deep` with the
  five links set in display type, the search field and the language switch. The current page is marked in `--route`.
  Inside a story a 2px route-coloured line along the header's lower edge shows how far through the story one is.
- **Buttons**: primary (route fill, on-route text), secondary (hairline, ink), quiet (text only). Height 44px on touch.
  Chips are pills. One focus ring: 2px `--route`, 2px offset, on everything focusable.
- **Field**: 44px, `--chart-2`, hairline; on the deep, `--deep-2` with no border.
- **Page head**: kicker (meta, uppercase is not used; a short plain label), h1, lede. Same on every page.
- **Card**: `--chart-2`, hairline, `--r2`, padding `--s5`; a story card leads with its key number in display type
  and a one-line label (`key` in `site/text.js`). The large story card (the three newest, on home and on the
  stories index) is on `--deep` with the number in `--beacon`; a route-coloured line draws across its top on hover,
  and with a fine pointer it leans towards it (at most 2.5 degrees) while a lighter band of the beacon crosses the number.
  A play card leads with a small drawn mark of its figure, the moving part in `--route`.
- **Figure plate**: paper `--chart-2` on the chart, and on the stage; title is a sentence with the number in it.
- **Footer**: on `--deep`: what the data is, licence, links; quiet.

## The story

A story is a voyage in three parts.

1. **Cover**, one screen on the deep: kicker ("Cerita" and reading time), the title in display type, the deck
   (teaser), and a "Mulai" control. The chart's graticule faintly behind.
2. **Scenes.** Each scene is a **stage**: the figure holds the screen and the caption sits in a fixed place beside
   it (from 900px: a column at the right; below: a band under the figure). Captions do not scroll past as boxes:
   the stage stays, the caption turns (`--d-turn`), the figure's marks travel (`--d-leg`). Scroll, swipe, the arrow
   keys, space, or the next/previous controls all move one step; scrolling settles on a step (scroll snap,
   proximity). Step 0 of a scene opens it: the scene's title and text, so the reader knows the figure before it
   moves. The caption shows its head, the text, and "3 / 6"; a row of ticks shows the steps and takes a tap.
   Nothing is ever cut: on a phone the figure takes half the height under the header and the caption band the
   rest, and a long caption scrolls inside its band. Under each sticky stage lies a run of invisible beats, one
   per step, that the scroll snaps to; the scroll position chooses the step.
3. **Landing**, on the chart: "What this data cannot say" as a bordered panel, the tools (save image, copy link,
   check for yourself), and the next story as a card.

Every caption stays in the document, in its beat, for screen readers and find-in-page; the visible caption is an
`aria-live="polite"` region. With reduced motion the stage stays, steps cut instead of travelling and nothing snaps.
A story keeps its place by step (not by pixels) across a language switch and the back button.

## Pages

- **Home**: hero on the deep, full height: the map of words as a night sea with one route sailed (below); headline
  in display type; one field ("Ketik kata, lihat rutenya") and a few chips. Then, on the chart: three featured stories
  with their key numbers; things to play with; how it is measured (sources, pages counted, what the tests say), in
  three short columns, every number read from the data.
- **States**: an unknown address is a 404 on the deep with the ways back, the night sea held still behind it, with no
  route on it. A word not on the chart, data that did not load and a search with no match each say what happened
  and what to do.
- **Stories index**: page head, then cards led by the key number; the newest three large.
- **Story on a phone**: the cover holds kicker, title, deck and "Mulai"; the intro opens the first scene's caption.
- **Word, portrait, map, findings, method, play pages**: the page head pattern, the same cards, fields, chips and
  tables; figures on plates.

## The night sea (`site/sea.js`)

The home hero is the chart of words in WebGL2, seen across the water at a low angle toward a horizon. Raw WebGL2 in
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
  only the swell moves and not at all once all is paper; the device pixel ratio is capped at 1.5 and drops by steps
  while frames take longer than 28 ms; small or few-core devices carry 7,000 words instead of 20,000.
- **Fallbacks**: without WebGL2 the flat night chart of `chart.js`, one screen tall; with reduced motion one still
  frame, no dive, no arrival. The canvas is `role="img"` with a text alternative that names the route; the status
  line under the field says what sails.
- Story covers keep the faint SVG graticule: a second GPU scene on the page that is read longest bought less than it
  cost, and the cover's title needs the quiet.

## Quality bar

Phone first (360px), then 1440px. Light and dark. Keyboard reaches everything. AA contrast. No layout shift above
0.05. First screen interactive under 2 s on a cold load. `tests/site` holds the checks and `./run.sh deploy` runs them.
