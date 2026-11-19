# Jejak Kata (`idhist`)

How Indonesian words changed the company they keep, measured on dated text and
shown with its uncertainty. The model is [HistWords](https://nlp.stanford.edu/projects/histwords/);
the difference is that every number here comes with a noise floor and a test of
what it can and cannot detect.

**Site: <https://zidan.dev/jejak-kata/>** (Indonesian first, English second): look up a word or a name, compare two, read the stories.
Data: <https://huggingface.co/datasets/lan666as/jejak-kata>.

| Lens | Text | Units |
|---|---|---|
| `id-books` | Indonesian books (HathiTrust), 1950–2019, five-year periods | 8.51M pages |
| `id-web-news` | news pages of the open web (HPLT 3.0), 2010–2024, by year | 37.0M pages |
| `id-web-news-kompas` | the same, Kompas only, 2011–2024 | 1.07M |
| `id-web-eras-kompas`, `-tempo`, `-tribun` | the same by presidential term (2010–14, 2015–19, 2020–24), one publisher each | 1.07M, 0.37M, 2.50M |
| `id-web-blogs` | blog posts of the open web, 2007–2024, two-year periods | 8.61M pages |
| `id-abstracts` | Indonesian academic abstracts (OpenAlex), 2000–2026, ten periods | 2.61M abstracts |
| `jv-books`, `su-books` | Javanese and Sundanese books (HathiTrust), 1910–2019, four long periods | 127k, 82k pages |

In web text a publisher's copies of one story (1.2% of pages; 5% for Kompas) are left out: only the earliest stays.
Nine more publishers of the news lens are counted year by year for the stories, without scores (`COUNTED` in `idhist/lenses.py`).

The site shows all of them. A short report is in [`docs/WRITEUP.md`](docs/WRITEUP.md).

## The idea in five sentences

1. Text is cut into **units** (a book page, a news article, a web page, an
   abstract), and two words co-occur when they share a unit.
2. Each dated, genre-stable series of text is a **lens**; lenses are never
   merged, and change is only ever measured between two periods of one lens.
3. In each period a word gets a **profile**: for every one of 4,000 context
   words, whether the two share a unit more or less often than chance.
4. The distance between a word's profiles in two periods is compared with the
   distance between two random halves of the *same* period (its noise floor),
   and what is left over is compared with the 500 words of nearest frequency.
   That last number is the **shift**; 4 or more is flagged.
5. The method is tested twice: on changes we plant ourselves
   (`idhist/planted.py`) and on lists of expected changes written down before
   the results were looked at (`validation/`).

In web text, where word order survives, words that together form the title of
an Indonesian Wikipedia article count as one word (`ibu kota`, `tol laut`,
`joko widodo`; see `idhist/phrases.py`). A name, meaning a word that is nearly
always capitalised, gets an entry only if Wikipedia has an article for it.

## What the tests say

**Test 1: planted changes.** In the later of two real periods, a share of a
word's occurrences is replaced by those of an unrelated word. The table gives
the share of such words that reach the flag (shift of 4 or more), and how many
untouched words reach it too.

| Lens (periods tested) | 20% replaced | 40% replaced | 80% replaced | untouched words flagged |
|---|---|---|---|---|
| `id-books` (2000–04 → 2005–09) | 13% | 63% | 95% | 3.5% |
| `id-web-news` (2018 → 2019) | 17% | 36% | 90% | 4.9% |
| `id-web-news-kompas` | 7% | 30% | 87% | 2.3% |
| `id-web-eras-kompas` (2015–19 → 2020–24) | 8% | 28% | 81% | 3.6% |
| `id-web-eras-tempo` | 6% | 23% | 81% | 3.5% |
| `id-web-eras-tribun` | 8% | 27% | 83% | 4.5% |
| `id-web-blogs` (2013–14 → 2015–16) | 28% | 59% | 95% | 7.1% |
| `id-abstracts` (2017–18 → 2019–20) | 15% | 56% | 94% | 3.5% |
| `jv-books` (1970–89 → 1990–2019) | 6% | 14% | 45% | 3.4% |
| `su-books` (1980–89 → 1990–2019) | 0% | 0% | 12% | 0.3% |

So: a word whose usage is mostly replaced is found four times in five or better
in every Indonesian lens; a new sense that takes a fifth of a word's usage is
mostly missed everywhere. Javanese is weak and Sundanese too small for change
scores; both still show a word's company in each period. Blogs flag twice as
many untouched words as the other lenses, so a flag there is worth less. The
site prints these figures next to every lens.

**Test 2: expected changes, registered beforehand** (`validation/`). Words
expected to change in a stated window, and 93 words expected to stay put (43 of
them for the news and web lenses).

| Lens | AUC, change vs stable | expected changes flagged | stable words flagged | too rare to score |
|---|---|---|---|---|
| `id-books` | 0.97 | 11 of 33 | 2% | 5 |
| `id-web-news` | 0.92 | 28 of 41 | 3% | 5 |
| `id-web-news-kompas` | 0.98 | 23 of 30 | 0% | 16 |
| `id-web-eras-kompas` | 0.94 | 7 of 26 | 0% | 18 |
| `id-web-eras-tempo` | 0.94 | 7 of 23 | 0% | 21 |
| `id-web-eras-tribun` | 0.94 | 4 of 23 | 0% | 21 |

The expected words rank above the stable ones nearly always. In books two
thirds of them still stay under the flag: *artis*, *aplikasi*, *radikal*,
*preman*, *seksi*, *virus* and others gained a sense without losing the old
one, which is the kind of change test 1 says is missed. The news words are
mostly the vocabulary of 2020, where the change was wholesale.

**A lens that failed, and why it matters.** All publishers together, cut by
presidential term, scored an AUC of 0.37 on the 44 expectations about the
Jokowi years: the everyday words expected to stay put scored higher than
the political ones expected to move. Between
2010–14 and 2020–24 the open web's news changes from a few national sites to
thousands of local ones, and that change of publishers moves every word. That
lens was dropped. The same pages taken one publisher at a time pass (the three
`id-web-eras-*` rows), and it is on those that anything said here about the
Jokowi years rests. The yearly all-publisher lens survives because neighbouring
years differ less, but its shifts between distant years should not be trusted.

**The Jokowi years** (2010–14 against 2015–19 or 2020–24, each word in the
window registered for it before measuring; the site's page shows 2010–14
against 2020–24 for all of them, so a few numbers differ). Flagged in at least two of the three publishers: *jokowi*, *joko widodo*,
*ahok*, *positif*, *masker*. Flagged in one: *anies*, *protokol*, *ibu kota*
(Kompas), *nusantara*, *kalimantan timur*, *konten* (Tempo), *relawan*
(Tribunnews). Not flagged anywhere: *kpk*, *prabowo*, *blusukan*, *ojek*,
*mitra*, *subsidi*, *kartu*, *alumni*, *mudik*, *baterai*. Eighteen or more of
the 44, among them *gibran*, *hoax*, *buzzer*, *dinasti*, *oligarki*,
*hilirisasi* and *moderasi*, were too rare in one publisher's 2010–14 pages to
be scored at all: the words most typical of the decade are the ones a
before-and-after comparison cannot see, because they had no before. What all
three publishers flag between 2015–19 and 2020–24 (141 words and names) is the
pandemic and the people in the news: *penyebaran, positif, karantina, isolasi,
kerumunan, masker, daring, vaksin*; *tito karnavian, sandiaga uno, teten
masduki, edhy prabowo, lukas enembe*.

**What the rankings are worth.** A list of "most shifted" words from one lens
is mostly not meaning change: spelling conventions and abbreviations in books
(*yg*, *diatas*), page furniture in news. What holds up is agreement between
independent lenses, and the site puts words flagged in several lenses first.
Even that is not proof: *editor*, *baca* and *selengkapnya* are flagged in all
three publishers, because all three changed how they sign and link their pages
and the furniture rules (`idhist/web.py`) do not catch every form of it.

**Some words.** *transparan* in books: with *warna, cahaya, sketsa, lukisan*
in 1980–84, with *publik, akuntabel, kinerja, korupsi* in 2010–14 (shift 11.9).
*mantan* arrives in 1985–89 (19.5), *lengser* in 1995–99 (24.5), *situs* turns
from archaeology to the web by 2000–04 (22.9).

## What needs the text

The counts know which words share a page. Some questions need more: a phrase, a word only where two
others stand, a count by month. For those the text of ten publishers of the news lens is kept
(`KEPT` in `idhist/sources/hplt.py`), privately: it is not ours to publish, and only counts leave the
machine. `site/pages.json` holds the questions asked of it and `idhist/pages.py` answers them. A count
of pages says that two things share a page, not that one is said of the other, so each story built on
it states a precision: places are drawn at random (`python -m idhist.pages read ...`) and read, and the
story says how many of them mean what it claims.

## What the site shows

For any word or name, in each lens that has it:

- **its path**: the words most like it in the first and the last period are laid out on a plane and stay
  put, and the word is drawn where it stands among them in each period (after the figure in Hamilton,
  Leskovec and Jurafsky, 2016; here no alignment is needed, because every period uses the same contexts);
- **its company**, period by period, with what arrived and what left;
- **the numbers**: frequency, the shift between every two periods, two periods side by side;
- for a name, **the verbs and adjectives** that keep it company, from two hand-made lists that hold
  praise and blame alike (`manifests/`). They say how the news wrote, not what someone is.

The stories and games on the site rest on plainer numbers still, all of them counts of pages
(`idhist/together.py`): of the pages that contain one word, the share that also contain another, so that a
sentence like "of the pages naming him in 2021, 43% also say *menteri pertahanan*" can be checked against
the counts; the same for every person and organisation of the three single-publisher lenses against a
fixed list of words; a word's share of each publisher's pages year by year (the counts keep years even
where a lens has five-year periods; what they do not keep per year is which words share a page, so
year-by-year company exists only for the yearly Kompas lens); and the words that fell or rose between
two periods in all three publishers at once, ranked by the smallest change among them. Every share comes with a 95% range, found by leaving out one
sixth of the days at a time, so that the pages of one day stand or fall together; a ranked list uses the
low end of that range. Three cautions
are written on the site wherever these are shown: sharing a page is not being accused; a phrase with a
Wikipedia title of its own is a word of its own and is not counted under its parts; and a one-word name
that is the first word of someone else's longer name is left out of tables of people.

And across words: each period in its own words (those that belong to it more than to any other, counted
and not chosen), the most shifted, names by kind, two words compared, and stories built from these
pieces. The path, the company and each period's own words measure no change and need no test; only the
shift is a claim about change.

### What a story is allowed to show

A story's figure shows a list made by a stated rule, never a handful picked for the argument. The rule is written in
the story's own "what this data cannot say" panel, with what was left out and why:

| Story | The rule |
|---|---|
| `kata-korupsi` | every party with DPR seats in 2009–2024 (ten); parties without seats wherever an outlet has 80 pages naming them; names that mean two things are measured (`demokrat`, `pan`) or counted by their full name |
| `viral-polisi` | 22 words for state offices and institutions, street-level and high; what is more viral outside the state is stated |
| `dilupakan` | every holder of seven offices who left in 2012–2023, acting holders excluded; a dot needs 80 pages in the last year in office |
| `kata-resmi` | 19 foreign words and their recommended Indonesian replacement, both in the Kompas vocabulary and with one meaning; four names for Papua's armed groups across nine publishers, the state's own sites included |
| `umur-slogan` | 19 central-government slogans and programmes that are in the Kompas vocabulary |
| `oknum` | the words that most often stand right after "oknum", found by counting in a third of the text, then counted in all of it |
| `penyesuaian`, `oknum`, `diamankan` | every publisher whose text is kept |
| `berhenti-dibicarakan` | the lists come from `stopped.json`, ranked by rule |

`tests/site/captions.mjs [<data>]` holds every number a story writes to what its figure shows at that step (the same
code works the figures out for the site and for the check: `site/scenes.js`), and lists each one that differs with what
the data has; run it on new data before it replaces the old. A number no figure can give (a tally read by hand, a page
count) is explained, one line each, in `tests/site/captions-allowed.tsv`.

## Layout

```
idhist/
  text.py               what a word is; old spelling -> current spelling
  phrases.py            which words count as one (Wikipedia titles)
  web.py                what web pages need: page furniture out, phrases in
  units.py              the one format every source is converted to
  sources/hathitrust.py books: HathiTrust Extracted Features, by rsync
  sources/hplt.py       the open web: HPLT 3.0, dated pages only, news and blogs
  sources/openalex.py   abstracts: the OpenAlex snapshot, Indonesian works only
  sources/wikipedia.py  titles of Indonesian Wikipedia, and what kind of thing each is
  lenses.py             the lenses: which units, which periods
  counts.py             units -> co-occurrence counts per period and fold
  measure.py            counts -> distance between every two periods, per word
  planted.py            test 1: can it find changes we planted?
  expected.py           test 2: do the pre-registered words stand out?
  export.py             the entries of the site: frequency, shift, company
  highlights.py         the chart, routes, each period's own words, arrivals, successions, verbs
  together.py           of the pages with one word, the share with another: the stories' numbers
  pages.py              counts that need the text (a phrase, a word where two others stand, by month),
                        and places drawn at random to be read by a person: a story's precision
  lexicon.py            candidates for the lists of adjectives and verbs, found in the text by rule
site/                   the static site (no build step, no dependencies)
validation/             the pre-registered word lists and their protocol
manifests/              which HathiTrust volumes (pinned: the catalogue dump changes monthly);
                        the adjectives and verbs looked for around names
tests/                  the whole path on a toy corpus with one planted change; tests/site uses the site
                        like a reader in a real browser, and `./run.sh deploy` runs it first; publish.mjs
                        writes the published site's own pages, share images, sitemap and feeds
docs/                   the report, and how the measure was chosen (instrument.md)
run.sh                  rebuild everything, in order
```

Everything generated lives under `data/` and `site/data/`, which are not in
git. Each stage reads only the previous stage's files:

```
sources -> data/raw -> data/units -> data/counts -> data/measures -> data/evaluation
                                                                  -> site/data
```

## Rebuilding

```
python -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'
pytest                      # seconds; the whole path on a toy corpus
./run.sh                    # everything, from the sources
./run.sh measure export     # or only some stages
python -m http.server -d site   # then open http://localhost:8000
```

The full rebuild is sized for a rented many-core machine with about 128 GB of
memory and 300 GB of disk. Reading the web release (256 GB, streamed, not
stored) takes about an hour, cutting 66 million pages into 46 million units
another hour on 58 processes, and everything after that under an hour.
`IDHIST_WORKERS` sets the number of processes (default: all cores); every
process is single-threaded. The largest job of the counts stage peaks at
3.4 GB, so on a machine with less memory per core lower the worker count. The
stages after `counts` also run on a small machine: with one worker, `measure`
takes 7 minutes for a news lens and 16 for books.

Two things are not bit-for-bit reproducible, both upstream: HathiTrust
re-derives Extracted Features files in place (two fetches a day apart differed
in 1 volume of 59,237, 5 pages of 7.4 million), and the catalogue dump is
replaced monthly (hence `manifests/`).

### Checking the site

`tests/site` uses the site like a reader, in a real browser (`cd tests/site && npm install` once); each check is
`node tests/site/<name>.mjs` and fails with a non-zero exit. `./run.sh look` runs the first six, and `./run.sh deploy`
runs `look` first.

| Check | What it reads |
|---|---|
| `captions.mjs [<data>]` | every number in every caption, plate title and story card, in both languages, against the values its figure shows at that step (no browser): the rows the step brings forward, at its moment, rounded as the site rounds; ranges exactly the lowest and highest of what they cover; the same numbers in the same order in Indonesian and English; anything else explained in `captions-allowed.tsv` |
| `stories.mjs` | every story, step by step, by key and by scroll, at 1280px and 360px and with reduced motion: the stage stuck, the caption, the figure on screen (no text under 12px, a strip's rows apart, a tall strip's named rows in its window), the band showing its step |
| `pages.mjs` | language switch, back button, shared links, a slow line, the menu, search, the map, the games, a saved image |
| `hero.mjs` | the home hero with WebGL, without, and with reduced motion; the dive; the quality ladder only stepping down and settling |
| `sound.mjs` | the sound layer: on by default, the toggle pressed from the start; heard at once where the browser allows it (a Chromium with `--autoplay-policy=no-user-gesture-required`), else waiting for the first press, key or tap (not a scroll), the first page saying so with the toggle beside it; turned off with one press, kept off, and nothing of it made on the next visit; the toggle in both languages, by keyboard and in the phone's menu; silent in a hidden tab and in an embed unless turned on there; no errors with storage refused or without Web Audio; then, rendered offline and measured: the gong ageng's energy under 120 Hz and its beating at 1-3 Hz, the bronze partials at their inharmonic ratios, the paired tones' beating, successive steps on different pitches, slendro above water and pelog under it; and the bed of each family, every sound, a whole story, the dive and 40 s of the first page, each peak under -6 dBFS and nothing NaN (`SOUND_WAV=<dir>` writes them as WAV files to listen to) |
| `webkit.mjs` | the same pages in WebKit (Safari's engine), with and without WebGL, and as an older Safari; skips where WebKit cannot run |
| `seas.mjs` | the map by mouse, keys, buttons and touch (one finger, pinch, twist, tilt, tap), the hero by touch, the held seas |
| `shift.mjs` | layout shift while pages load and scroll (under 0.05) |
| `cold.mjs` | the home page cold on slow 4G and 4G: text and an answering chart within 2 s |
| `fails.mjs` | no dead pages: a data file each family of pages needs fails twice; a skeleton while it waits, one retry, then a line and "Try again", which brings the part without reloading |
| `meta.mjs [<built>]` | the published site as link previews and search engines read it (below): every generated page fetched with no script, its tags, JSON-LD, share image, canonical and language twins, the sitemap and the feeds; then each page opened, taken over by the app at its route |
| `frames.mjs`, `capture.mjs`, `look.mjs`, `shot.mjs`, `sheet.mjs` | frame times, and screenshots to look at |
| `stages.mjs <dir> [slug ...]` | every story's first and densest scene at 1440x900 and 1920x1080, light and dark: a screenshot each, and fails on a figure or caption past its stage, text under 12px or a page wider than the screen |
| `gpu.mjs <url> <dir>`, `film.mjs <url> <dir>` | on a rented machine with a GPU: frame times and recordings of the live site; `film.mjs` presents it as to a jury (arrival, a word sailed, the dive, a story, the map, a word, the share sheet) with eased pointer moves, at 1440x900 and 390x844, as Playwright videos |
| `film.mjs <url> <dir> [desktop\|phone] --frames [--seconds N]` | the same film at 60 frames a second, frame by frame: Chromium's headless shell with begin-frame control and virtual time (each frame the page's clock moves 1/60 s, so the result does not depend on the machine's speed), 1440x900 at 2x and 390x844 at 3x, encoded by ffmpeg as H.264, CRF 16, yuv420p (`<dir>/film-desktop.mp4`, `film-phone.mp4`). On the GPU machine: `npx playwright install chromium-headless-shell`, then `node tests/site/film.mjs https://zidan.dev/jejak-kata/ film --frames`; to check the setup first, add `--seconds 5`. ffmpeg from `$FFMPEG`, the PATH or `~/.cache/ffmpeg-static`; without it the frames are written as PNG with the command to encode them |

### One generation step: addresses of their own

The app is one page, and a route used to live only after `#`, which no link preview and no search engine reads: every
link to the site looked like the first page. So `./run.sh deploy` runs one generation step,
`node tests/site/publish.mjs <tree>`, on the copy of `site/` it publishes. For each story, each main page and play page,
and each word the first page shows, in Indonesian and in English (under `en/`), it writes a page at a real path
(`cerita/oknum/`, `en/cerita/oknum/`): the app's own `index.html` with that page's title, description, canonical
address, language twins, Open Graph and X card tags, JSON-LD (Article, BreadcrumbList, Dataset), and the page's text
in plain HTML for readers that run no script; the app takes the page over where scripts run. Beside it a share image,
`og.jpg` (1200x630, under 300 kB): a story's key number and title on its own night sea, drawn by the app in the test
browser. Each story also gets `<story>/embed/`, the frame of one of its figures for other sites (`#/<scene>/<step>`
after it): the story's own page, canonical to the story and kept out of the sitemap. Every title is 50 to 60
characters and every description 120 to 160, unique per language. It also writes `404.html` (GitHub Pages serves it for any other path, and the app reads the path), `sitemap.xml`
and the stories as feeds (`feed.xml`, Atom; `feed.json`, JSON Feed), and then `meta.mjs` checks all of it. Nothing it
writes is kept in git: it is made from `site/` (`text.js`, `story.js`, `address.js` and the data) every time the site
is published, so a published page cannot carry an old title, number or image. `address.js` says which routes have a
page and how a route is written; addresses without a page (`#/kata/batik`) work as before, and so does every old
`#/...` link. `node tests/site/publish.mjs <dir> --no-images` writes the pages alone in a second;
`node tests/site/publish.mjs icons` remakes the installed app's icons (`site/icon-*.png`).

WebKit on Linux needs system libraries a server often lacks (`npx playwright-core install webkit` lists them). Without
root they can be unpacked from the distribution's packages (`apt-get download`, `dpkg-deb -x`) into a folder whose
`root/usr/lib/x86_64-linux-gnu` is linked into WebKit's own `minibrowser-wpe/sys/lib`; `WEBKIT_LIBS` names the folder
(default `~/.cache/ms-playwright/webkit-libs`), whose EGL vendor file `webkit.mjs` hands to WebKit.

## Data and licences

| Source | What is used | Terms |
|---|---|---|
| [HathiTrust Extracted Features 2.5](https://analytics.hathitrust.org/datasets) | per-page word counts of 59,237 volumes catalogued as Indonesian, 2,004 as Javanese and 788 as Sundanese | CC BY 4.0; fetched by HTRC's rsync service |
| [HPLT 3.0](https://hplt-project.org/datasets/v3.0) monolingual Indonesian (Common Crawl and Internet Archive crawls of 2012–2024) | of 176 million documents, the 66 million distinct pages that carry a date and are not machine translation; 46 million of them are news or blog pages long enough to use | packaging CC0; the text is the publishers' |
| [OpenAlex](https://docs.openalex.org/download-all-data/openalex-snapshot) snapshot of 2026-10-14 | abstracts of 3.6 million works labelled Indonesian, of which 2.6 million pass our own language check | CC0; abstracts come as word-position indexes |
| [Indonesian Wikipedia](https://dumps.wikimedia.org/idwiki/) dump of 2026-10-01 and [Wikidata](https://www.wikidata.org/) | 1.17 million titles with their redirects; for the articles that names lead to, whether Wikidata calls it a person, a place or an organisation | CC BY-SA 4.0 and CC0 |

Only statistics over words leave this pipeline: counts, distances and lists of
co-occurring words. No article or page text is stored beyond `data/raw`, and
none is published. A word that is mostly capitalised is treated as a name, and
a name gets an entry on the site only if Indonesian Wikipedia has an article
for it (see `idhist/export.py`).

## Known limits

- **It sees large changes only.** See the planted-change table above.
- **Events move words as much as meaning does.** *tsunami* after 2004 and
  *positif* in 2020 keep new company; whether that is a change of meaning is
  for the reader, and the site says so.
- **A change of publishers looks like a change of language.** This is the
  failed lens above. Single-publisher lenses exist to check it; where there is
  none (books, blogs, abstracts) the check is missing.
- **Web pages are dated by themselves.** A date in the address, else the first
  date in the opening lines (for news only, where the two agree on the year 97%
  of the time). 57% of pages have neither and are left out, among them most
  pages of publishers whose addresses carry no date. Pages captured years
  after they were written carry a little of the later web with them: *covid*
  occurs in none of the pre-2019 news pages captured before 2020 and in 0.2% to
  0.9% of those captured after.
- **A unit is a page or an article**, so "company" is topical, not
  grammatical. Books give no sentences at all.
- **The books are what American research libraries collected and scanned**,
  not what Indonesians read.
- **Words are surface forms.** *mengunggah* and *unggahan* are separate
  entries; nothing is stemmed. Phrases exist only in the web lenses, and only
  where Wikipedia has a title for them; a few titles are songs made of ordinary
  words (*lebih baik*).
- **Names.** Showing only names that have a Wikipedia article keeps private
  people out, but also hides capitalised words that are not names of anything
  in particular (*kapolres*, *pemkab*). The kind of an entity comes from three
  rules over Wikidata and is sometimes wrong (a university can come out as a
  place).

## Not done, and why

- **Mining Common Crawl directly.** Tried first: in November 2026 about half
  of all partial requests to its public archive were refused (`503 Slow Down`),
  index and pages alike, and its operators say partial downloads cannot be
  retried around that. HPLT had already read the same crawls; what is lost is
  the page metadata that would have dated the 57% left out.
- **Anything after 2024.** HPLT 3.0 ends there. Abstracts reach 2026.
- **Regional languages on the web.** The same release holds Javanese and
  Sundanese, but half of it is machine translation; what is left and dated is
  about 20,000 pages each, mostly blogs, and smaller still for Minangkabau,
  Banjar, Balinese, Acehnese and Buginese. The Javanese and Sundanese lenses
  remain the books HathiTrust happens to hold.
- **Text before 1950 and news before 2010.** Sources exist but need permission
  or are closed.
- **Human judgement.** A blind sample for a native speaker is prepared
  (`idhist/judge.py`); no ratings are in yet.

## Licence

Code: MIT (`LICENSE`). The published counts, measures and site data: CC BY 4.0,
with the attributions in "Data and licences" above.
