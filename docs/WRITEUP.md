# Watching Indonesian words change company: a first report

16 November 2026. Numbers are from the build described in `README.md`.

## What was built

Seven dated series of text ("lenses"), each measured on its own:

| Lens | Span | Size |
|---|---|---|
| Indonesian books (HathiTrust) | 1950–2019, five-year periods | 8.5 million pages, 59,237 volumes |
| Indonesian online news (CC-NEWS) | 2017–2022, yearly | 4.8 million articles |
| The same news, Tribunnews only and Okezone only | 2017–2022 | 2.2 and 0.7 million articles |
| Indonesian academic abstracts (OpenAlex) | 2000–2026, ten periods | 2.6 million abstracts |
| Javanese books (HathiTrust) | 1910–2019, four periods | 127,000 pages |
| Sundanese books (HathiTrust) | 1910–2019, four periods | 82,000 pages |

For every word and every pair of periods in a lens there is one number, the
*shift*: how far the words it shares a page or an article with have changed,
after subtracting the word's own sampling noise and comparing with 500 words of
similar frequency. A static site shows, for any word, its frequency, its shift
between every two periods, and its company in each period.

## How we know what the number is worth

No list of changed Indonesian words exists to score against, so two tests were
made.

**Planted changes.** In real data, a known share of a word's occurrences was
swapped for those of an unrelated word. When 80% is swapped, the word is flagged
95% of the time in books, 94% in abstracts, about 80% in news, 45% in Javanese
and 12% in Sundanese. When 40% is swapped: 63%, 56%, about 25%, 14% and 0%. When
20% is swapped it is mostly missed everywhere. About 3% of untouched words are
flagged as well.

**Expected changes.** Before the results were looked at, 84 words were written
down with the window in which they were expected to change, and 93 words
expected to stay put. In every Indonesian lens the expected words rank above the
stable ones (AUC 0.97 to 0.98). In news, 29 of 39 cross the flag against 4% of
stable words; in books only 11 of 33 do, against 2%.

Thirteen ways of building the word profile were compared on the planted test.
They differ by a few points; the one kept is the simplest that was never beaten.
Reducing and aligning the profiles as embedding methods do gave no gain.

## What it shows

- **Wholesale changes are plain to see.** *transparan* moves from paintings and
  light (1980–84) to public administration (2010–14); *situs* from excavations
  to the web; *mantan* and *lengser* arrive in 1985–89 and 1995–99. In news,
  the vocabulary of 2020 (*positif, zona, kontak, mandiri, jarak*) is flagged
  in all three news lenses at once.
- **Added senses mostly are not.** *artis*, *virus*, *aplikasi*, *seksi* and
  *preman* each gained a sense that the books surely record, and stayed under
  the flag. This agrees with the planted test: a new sense that takes a
  minority of a word's usage is invisible to this kind of measure.
- **A "most changed" list from one source is mostly not meaning change.** In
  books it is led by abbreviations and spelling conventions, in news by the
  furniture of web pages, even after filtering. What survives is agreement
  between independent sources: of 560 words flagged in news for 2019 → 2020,
  the 82 also flagged in two single publishers separately read as that year's
  events. Between books and abstracts agreement is weak.
- **Events and meaning cannot be told apart by the number.** *tsunami*,
  *goreng* in 2022 and *positif* in 2020 changed company, not sense. The site
  says so and shows the company, so that a reader can judge.
- **Regional languages: a start, not a result.** HathiTrust holds about 40
  million words of Javanese and 27 million of Sundanese in Latin script.
  The Javanese lens shows believable
  company (*sepur* with *numpak, Sala, Jakarta, Surabaya*; *negara* moving from
  *walanda* to *indonesia, rakyat*), but its change scores are weak, and the
  Sundanese ones should not be trusted at all.

## What it does not show

Speech, social media, anything before 1950 in Indonesian, news before 2017,
and what Indonesians read as opposed to what American libraries scanned. A unit
is a page or an article, so "company" means topic, not grammar. Words are
surface forms; nothing is stemmed. No native speaker has judged the output yet.

Everything can be rebuilt from public sources with `./run.sh`.
