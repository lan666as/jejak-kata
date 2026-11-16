# Jejak Kata (`idhist`)

How Indonesian words changed the company they keep, measured on dated text and
shown with its uncertainty. The model is [HistWords](https://nlp.stanford.edu/projects/histwords/);
the difference is that every number here comes with a noise floor and a test of
what it can and cannot detect.

**Site: <https://zidan.dev/jejak-kata/>** (Indonesian first, English second).
Data: <https://huggingface.co/datasets/lan666as/jejak-kata>.

| Lens | Text | Units | State |
|---|---|---|---|
| `id-books` | Indonesian books, 1950–2019, five-year periods | 8.51M pages | built, both tests |
| `id-news` | Indonesian online news, 2017–2022, yearly | 4.80M articles | built, both tests |
| `id-news-tribun`, `id-news-okezone` | the same, one publisher each | 2.19M, 0.73M | built, both tests |
| `id-abstracts` | Indonesian academic abstracts, 2000–2026 | 2.61M abstracts | built, planted test |
| `jv-books` | Javanese books, 1910–2019, four long periods | 127k pages | built, planted test: weak |
| `su-books` | Sundanese books, 1910–2019, four long periods | 82k pages | built, planted test: nearly blind |

The site shows all seven. A short report is in [`docs/WRITEUP.md`](docs/WRITEUP.md).

## The idea in five sentences

1. Text is cut into **units** (a book page, a news article), and two words
   co-occur when they share a unit.
2. Each dated, genre-stable series of text is a **lens**; lenses are never
   merged, and change is only ever measured between two periods of one lens.
3. In each period a word gets a **profile**: for every one of 4,000 context
   words, whether the two share a unit more or less often than chance.
4. The distance between a word's profiles in two periods is compared with the
   distance between two random halves of the *same* period (its noise floor),
   and what is left over is compared with the 500 words of nearest frequency.
   That last number is the **shift**; 4 or more is flagged.
5. The method is tested twice: on changes we plant ourselves
   (`idhist/planted.py`) and on a list of expected changes written down before
   the results were looked at (`validation/`).

## What the tests say

**Test 1: planted changes.** In the later of two real periods, a share of a
word's occurrences is replaced by those of an unrelated word. The table gives
the share of such words that reach the flag (shift of 4 or more), and how many
untouched words reach it too.

| Lens (periods tested) | 20% replaced | 40% replaced | 80% replaced | untouched words flagged |
|---|---|---|---|---|
| `id-books` (2000–04 → 2005–09) | 13% | 63% | 95% | 3.5% |
| `id-abstracts` (2017–18 → 2019–20) | 15% | 56% | 94% | 3.5% |
| `id-news` (2018 → 2019) | 7% | 24% | 76% | 3.1% |
| `id-news-tribun` | 7% | 26% | 81% | 2.7% |
| `id-news-okezone` | 5% | 22% | 82% | 1.4% |
| `jv-books` (1970–89 → 1990–2019) | 6% | 14% | 45% | 3.4% |
| `su-books` (1980–89 → 1990–2019) | 0% | 0% | 12% | 0.3% |

So: a word whose usage is mostly replaced is found almost always in Indonesian
books and abstracts and four times in five in news; a new sense that takes a
fifth of a word's usage is mostly missed everywhere. Javanese is weak and
Sundanese too small for change scores; both still show a word's company in each
period. The site prints these figures next to every lens.

**Test 2: expected changes, registered beforehand** (`validation/`). 84 words
expected to change in a stated window, 93 expected to stay put.

| Lens | AUC, change vs stable | expected changes flagged | stable words flagged | too rare to score |
|---|---|---|---|---|
| `id-books` | 0.97 | 11 of 33 | 2% | 5 |
| `id-news` | 0.98 | 29 of 39 | 4% | 7 |
| `id-news-tribun` | 0.97 | 31 of 36 | 5% | 10 |
| `id-news-okezone` | 0.97 | 17 of 27 | 0% | 19 |

The expected words do rank above the stable ones nearly always. But in books
two thirds of them stay under the flag: *artis*, *aplikasi*, *radikal*,
*preman*, *seksi*, *virus* and others gained a sense without losing the old
one, which is the kind of change test 1 says is missed. The news words are
mostly the vocabulary of 2020, where the change was wholesale. Per-word results
are in `data/evaluation/<lens>/expected.json` after a rebuild.

**What the rankings are worth.** A list of "most shifted" words from one lens
is mostly not meaning change: spelling conventions and abbreviations in books
(*yg*, *diatas*), page furniture in news. What holds up is agreement between
independent lenses. Of the 560 words flagged in all-publisher news between 2019
and 2020, 82 are also flagged in both Tribunnews and Okezone taken alone, and
those read as the events of that year: *positif, jarak, kerumunan, zona, kontak,
karantina, mandiri*. For 2021 → 2022 the 20 that replicate include *kuku* and
*mulut* (foot-and-mouth disease), *goreng*, *minyak*, *larangan* (the cooking-oil
export ban), *nusantara* and *booster*. The site puts replicated words first.
Between books and abstracts, where periods only roughly line up, agreement is
weak (rank correlation 0.1–0.2; six words flagged in both where two to five
would be by chance), among them *kementerian*, *digital* and *serentak*.

**Some words.** *transparan* in books: with *warna, cahaya, sketsa, lukisan*
in 1980–84, with *publik, akuntabel, kinerja, korupsi* in 2010–14 (shift 11.9).
*mantan* arrives in 1985–89 (19.5), *lengser* in 1995–99 (24.5), *situs* turns
from archaeology to the web by 2000–04 (22.9). *positif* in news, 2019 → 2020:
22.5, 17.4 and 16.5 in the three news lenses.

## Layout

```
idhist/
  text.py               what a word is; old spelling -> current spelling
  units.py              the one format every source is converted to
  sources/hathitrust.py books: HathiTrust Extracted Features, by rsync
  sources/ccnews.py     news: CC-NEWS via acul3/KoPI-CC_News, furniture removed
  sources/openalex.py   abstracts: the OpenAlex snapshot, Indonesian works only
  lenses.py             the lenses: which units, which periods
  counts.py             units -> co-occurrence counts per period and fold
  measure.py            counts -> distance between every two periods, per word
  planted.py            test 1: can it find changes we planted?
  expected.py           test 2: do the pre-registered words stand out?
  export.py             everything the site shows, as small static files
site/                   the static site (no build step, no dependencies)
validation/             the pre-registered word list and its protocol
manifests/              which HathiTrust volumes (pinned: the catalogue dump changes monthly)
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

The full rebuild needs about 60 GB of disk and is sized for a rented many-core
machine: on 40 workers of a 64-core machine, everything after the downloads took 54 minutes for six lenses. `IDHIST_WORKERS` sets the number of processes
(default: all cores); every process is single-threaded. The stages after
`counts` also run on a small machine: with one worker, `measure` takes 7
minutes for a news lens and 16 for books.

Two things are not bit-for-bit reproducible, both upstream: HathiTrust
re-derives Extracted Features files in place (two fetches a day apart differed
in 1 volume of 59,237, 5 pages of 7.4 million), and the catalogue dump is
replaced monthly (hence `manifests/`).

## Data and licences

| Source | What is used | Terms |
|---|---|---|
| [HathiTrust Extracted Features 2.5](https://analytics.hathitrust.org/datasets) | per-page word counts of 59,237 volumes catalogued as Indonesian, 2,004 as Javanese and 788 as Sundanese | CC BY 4.0; fetched by HTRC's rsync service |
| [CC-NEWS](https://commoncrawl.org/news-crawl), via [acul3/KoPI-CC_News](https://huggingface.co/datasets/acul3/KoPI-CC_News) | 4.8 million articles, 2017–2022 | Common Crawl terms of use; the article text is the publishers' |
| [OpenAlex](https://docs.openalex.org/download-all-data/openalex-snapshot) snapshot of 2026-10-14 | abstracts of 3.6 million works labelled Indonesian, of which 2.6 million pass our own language check | CC0; abstracts come as word-position indexes |

Only statistics over words leave this pipeline: counts, distances and lists of
co-occurring words. No article or page text is stored beyond `data/raw`, and
none is published. Words that are mostly capitalised are treated as names and
get no entry on the site (see `idhist/export.py`).

## Known limits

- **It sees large changes only.** See the planted-change table above.
- **Events move words as much as meaning does.** *tsunami* after 2004 and
  *positif* in 2020 keep new company; whether that is a change of meaning is
  for the reader, and the site says so.
- **A unit is a page or an article**, so "company" is topical, not
  grammatical. Books give no sentences at all.
- **The books are what American research libraries collected and scanned**,
  not what Indonesians read.
- **All-publisher news changes its mix every year**, and website furniture
  survives the filter in places; the single-publisher lenses exist to check it.
- **Words are surface forms.** *mengunggah* and *unggahan* are separate
  entries; nothing is stemmed.

## Not done, and why

- **Regional languages beyond a first look.** The Javanese and Sundanese
  lenses are what HathiTrust happens to hold: about 40 and 27 million words.
  Spelling is only normalised for the 1972 reform, and the collections change
  genre between periods (Bible translation, chronicles in verse, novels). No
  other dated corpus of a regional language was found.
- **Text before 1950 and news before 2017.** Sources exist but need permission
  or are closed.
- **Human judgement.** No native speaker has rated any of this yet.
- **Names.** Words that are 90% or more capitalised get no entry, which also
  hides *indonesia*, *jakarta*, *islam* and the months. A reviewed allow-list
  would bring those back.

## Licence

Code: MIT (`LICENSE`). The published counts, measures and site data: CC BY 4.0,
with the attributions in "Data and licences" above.
