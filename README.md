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
| `id-news` | Indonesian online news (CC-NEWS), 2017–2022, by year | 4.80M articles |
| `id-news-tribun`, `id-news-okezone` | the same, one publisher each | 2.19M, 0.73M |
| `id-web-news` | news pages of the open web (HPLT 3.0), 2010–2024, by year | 37.3M pages |
| `id-web-news-kompas` | the same, Kompas only, 2011–2024 | 1.13M |
| `id-web-eras-kompas`, `-tempo`, `-tribun` | the same by presidential term (2010–14, 2015–19, 2020–24), one publisher each | 1.13M, 0.37M, 2.57M |
| `id-web-blogs` | blog posts of the open web, 2007–2024, two-year periods | 8.81M pages |
| `id-abstracts` | Indonesian academic abstracts (OpenAlex), 2000–2026, ten periods | 2.61M abstracts |
| `jv-books`, `su-books` | Javanese and Sundanese books (HathiTrust), 1910–2019, four long periods | 127k, 82k pages |

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
| `id-news` (2018 → 2019) | 6% | 30% | 83% | 3.2% |
| `id-news-tribun` | 12% | 25% | 79% | 2.6% |
| `id-news-okezone` | 6% | 28% | 77% | 1.5% |
| `id-web-news` (2018 → 2019) | 15% | 35% | 92% | 5.0% |
| `id-web-news-kompas` | 10% | 30% | 89% | 2.3% |
| `id-web-eras-kompas` (2015–19 → 2020–24) | 3% | 21% | 81% | 3.5% |
| `id-web-eras-tempo` | 5% | 21% | 83% | 3.5% |
| `id-web-eras-tribun` | 12% | 31% | 91% | 4.4% |
| `id-web-blogs` (2013–14 → 2015–16) | 25% | 65% | 96% | 7.3% |
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
| `id-news` | 0.98 | 30 of 39 | 4% | 7 |
| `id-news-tribun` | 0.97 | 31 of 36 | 5% | 10 |
| `id-news-okezone` | 0.97 | 18 of 27 | 0% | 19 |
| `id-web-news` (replication) | 0.92 | 28 of 41 | 3% | 5 |
| `id-web-news-kompas` (replication) | 0.99 | 23 of 31 | 0% | 15 |
| `id-web-eras-kompas` | 0.94 | 7 of 26 | 0% | 18 |
| `id-web-eras-tempo` | 0.94 | 8 of 23 | 0% | 21 |
| `id-web-eras-tribun` | 0.94 | 4 of 23 | 0% | 21 |

The expected words rank above the stable ones nearly always. In books two
thirds of them still stay under the flag: *artis*, *aplikasi*, *radikal*,
*preman*, *seksi*, *virus* and others gained a sense without losing the old
one, which is the kind of change test 1 says is missed. The news words are
mostly the vocabulary of 2020, where the change was wholesale; the two
`id-web-news` rows ask the same words of independent text and find them again.

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

## What the site shows

For any word or name, in each lens that has it:

- **its path**: the words most like it in the first and the last period are laid out on a plane and stay
  put, and the word is drawn where it stands among them in each period (after the figure in Hamilton,
  Leskovec and Jurafsky, 2016; here no alignment is needed, because every period uses the same contexts);
- **its company**, period by period, with what arrived and what left;
- **the numbers**: frequency, the shift between every two periods, two periods side by side;
- for a name, **the adjectives** that keep it company, from a hand-made list without accusations.

And across words: each period in its own words (those that belong to it more than to any other, counted
and not chosen), the most shifted, names by kind, two words compared, and three stories built from these
pieces. The path, the company and each period's own words measure no change and need no test; only the
shift is a claim about change.

## Layout

```
idhist/
  text.py               what a word is; old spelling -> current spelling
  phrases.py            which words count as one (Wikipedia titles)
  web.py                what web pages need: page furniture out, phrases in
  units.py              the one format every source is converted to
  sources/hathitrust.py books: HathiTrust Extracted Features, by rsync
  sources/ccnews.py     news: CC-NEWS via acul3/KoPI-CC_News
  sources/hplt.py       the open web: HPLT 3.0, dated pages only, news and blogs
  sources/openalex.py   abstracts: the OpenAlex snapshot, Indonesian works only
  sources/wikipedia.py  titles of Indonesian Wikipedia, and what kind of thing each is
  lenses.py             the lenses: which units, which periods
  counts.py             units -> co-occurrence counts per period and fold
  measure.py            counts -> distance between every two periods, per word
  planted.py            test 1: can it find changes we planted?
  expected.py           test 2: do the pre-registered words stand out?
  export.py             everything the site shows, as small static files
site/                   the static site (no build step, no dependencies)
validation/             the pre-registered word lists and their protocol
manifests/              which HathiTrust volumes (pinned: the catalogue dump changes monthly);
                        the adjectives looked for around names
tests/                  the whole path on a toy corpus with one planted change
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

## Data and licences

| Source | What is used | Terms |
|---|---|---|
| [HathiTrust Extracted Features 2.5](https://analytics.hathitrust.org/datasets) | per-page word counts of 59,237 volumes catalogued as Indonesian, 2,004 as Javanese and 788 as Sundanese | CC BY 4.0; fetched by HTRC's rsync service |
| [CC-NEWS](https://commoncrawl.org/news-crawl), via [acul3/KoPI-CC_News](https://huggingface.co/datasets/acul3/KoPI-CC_News) | 4.8 million articles, 2017–2022 | Common Crawl terms of use; the article text is the publishers' |
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
- **Anything after 2024.** HPLT 3.0 ends there; CC-NEWS as packaged ends in
  mid-2022. Abstracts reach 2026.
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
