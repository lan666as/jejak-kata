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
| `--t-display` | clamp(3.25rem, 12vw, 8rem) | 0.9 | hero, story covers, key numbers |

Space: `--s1 4px, --s2 8px, --s3 12px, --s4 16px, --s5 24px, --s6 32px, --s7 48px, --s8 72px, --s9 112px`.
Gutter 16px on phones, 32px from 900px. Content width 1120px; reading measure 38rem.
Radius: `--r1 6px` (controls), `--r2 14px` (cards, stage, sheets), pill for chips. No drop shadows on the chart;
one soft shadow (`--lift`) for things that float (menu, suggestions, tip).

Motion: one curve, `--sail: cubic-bezier(.45,.05,.25,1)`. Three durations: `--d-press 140ms` (state of a control),
`--d-turn 320ms` (something appears, a caption changes), `--d-leg 900ms` (something travels: a dot, a route, a word).
Things that carry data travel; chrome only turns. The one unprompted motion on the site is the route drawn once in
the home hero; everything else answers the reader. `prefers-reduced-motion` turns travel into a cut.

## Components

- **Header** (56px, `--deep`, sticky everywhere, opaque): wordmark; from 900px the five links inline, search field,
  language. Below 900px: wordmark, search button, menu button; the menu is a full-screen sheet on `--deep` with the
  five links set in display type, the search field and the language switch. The current page is marked in `--route`.
  Inside a story a 2px route-coloured line along the header's lower edge shows how far through the story one is.
- **Buttons**: primary (route fill, on-route text), secondary (hairline, ink), quiet (text only). Height 44px on touch.
  Chips are pills. One focus ring: 2px `--route`, 2px offset, on everything focusable.
- **Field**: 44px, `--chart-2`, hairline; on the deep, `--deep-2` with no border.
- **Page head**: kicker (meta, uppercase is not used; a short plain label), h1, lede. Same on every page.
- **Card**: `--chart-2`, hairline, `--r2`, padding `--s5`; a story card leads with its key number in display type.
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

- **Home**: hero on the deep, full height: the map of words as a night chart with one route drawn; headline in
  display type; one field ("Ketik kata, lihat rutenya") and a few chips. Then, on the chart: three featured stories
  with their key numbers; things to play with; how it is measured (sources, pages counted, what the tests say), in
  three short columns.
- **Stories index**: page head, then cards led by the key number; the newest three large.
- **Word, portrait, map, findings, method, play pages**: the page head pattern, the same cards, fields, chips and
  tables; figures on plates.

## Quality bar

Phone first (360px), then 1440px. Light and dark. Keyboard reaches everything. AA contrast. No layout shift above
0.05. First screen interactive under 2 s on a cold load. `tests/site` holds the checks and `./run.sh deploy` runs them.
