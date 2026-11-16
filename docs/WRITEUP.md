# Watching Indonesian words change company: second report

16 November 2026. Numbers are from the build described in `README.md`. This
replaces the first report of the same day; what changed is the web.

## What was built

Ten dated series of text ("lenses"), each measured on its own:

| Lens | Span | Size |
|---|---|---|
| Indonesian books (HathiTrust) | 1950–2019, five-year periods | 8.5 million pages |
| News pages of the open web (HPLT 3.0), and Kompas alone | 2010–2024, by year | 37.3 million pages; Kompas 1.1 million |
| Kompas, Tempo and Tribunnews by presidential term | 2010–14, 2015–19, 2020–24 | 1.1, 0.4 and 2.6 million pages |
| Blog posts of the open web (HPLT 3.0) | 2007–2024, two-year periods | 8.8 million pages |
| Indonesian academic abstracts (OpenAlex) | 2000–2026, ten periods | 2.6 million abstracts |
| Javanese and Sundanese books (HathiTrust) | 1910–2019, four periods | 127,000 and 82,000 pages |

For every word and every pair of periods in a lens there is one number, the
*shift*: how far the words it shares a page or an article with have changed,
after subtracting the word's own sampling noise and comparing with 500 words of
similar frequency. A static site shows, for any word, its frequency, its shift
between every two periods, and the company it gained and lost.

New in this round, besides the web text:

- **Phrases.** In web text, words that together form the title of an
  Indonesian Wikipedia article count as one: *ibu kota*, *tol laut*, *joko
  widodo*. 33,927 such phrases occur often enough to be used.
- **Names.** A word that is nearly always capitalised used to be hidden. Now
  it has an entry if Wikipedia has an article for it, and stays hidden if not.
  That brings in people, institutions and places (*jokowi*, *kpk*, *jakarta*)
  and keeps out people who are merely in the news. The main web lens has about
  5,700 such entries.

## Where the web text comes from, and what was tried first

The plan was to mine Common Crawl directly. On the day, about half of all
partial requests to its public archive were refused, and its operators state
that partial downloads cannot be retried around that. HPLT 3.0 had already read
the same crawls (and the Internet Archive's) and published the text of every
page with its language and register, so that was used instead.

What HPLT does not give is when a page was written. A page is dated by the
date in its address, or else, for news, by the first date in its opening
lines; on news pages that have both, the two fall in the same year 97% of the
time. Of 176 million Indonesian documents, 11 million are machine translation
and 94 million carry no date; 66 million distinct pages remain, of which 46
million are news or blog pages long enough to use.

Two checks were made before trusting this:

- **Late captures.** Most pages dated 2010–2014 were captured years later. If
  they carried the later web with them, old periods would look modern. *covid*
  occurs in none of the pre-2019 news pages captured before 2020 and in 0.2% to
  0.9% of those captured after. That is small, and it is not zero.
- **Blogs in the news.** In 2008–2011 most pages labelled as news were posts
  on blog platforms. Those went to the blog lens, and the news lens starts in
  2010.

## How we know what the number is worth

**Planted changes.** In real data, a known share of a word's occurrences was
swapped for those of an unrelated word. When 80% is swapped the word is flagged
77% to 96% of the time in every Indonesian lens, 45% in Javanese and 12% in
Sundanese. When 40% is swapped: 56% to 65% in books, abstracts and blogs, 21%
to 35% in news. When 20% is swapped it is mostly missed everywhere. Up to 5% of
untouched words are flagged as well, and 7% in blogs.

**Expected changes.** Before results were looked at, words were written down
with the window in which they were expected to change, beside words expected to
stay put. In every Indonesian lens that was kept, the expected words rank above
the stable ones (AUC 0.92 to 0.99). Of the 2020 vocabulary registered for the
news pages, Kompas alone flags 23 of 31 and none of the stable words.

**One lens failed this test and was dropped.** All publishers together, by
presidential term, gave an AUC of 0.37 on the expectations about the Jokowi
years: the everyday words expected to stay put scored higher than the
political ones expected to move. Between 2010–14 and
2020–24 the web's news changes from a few national sites to thousands of local
ones, and that moves every word. Taken one publisher at a time, the same pages
pass (AUC 0.94 for each of Kompas, Tempo and Tribunnews). This is the most
useful thing the round found about the method: a change in who is writing
looks exactly like a change in the language, and only a fixed publisher, or a
test registered beforehand, tells them apart.

## The Jokowi years

Forty-four expectations about 2010–14 against 2015–19 or 2020–24 were
registered before the web lenses were counted.

- **Flagged in at least two of three publishers:** *jokowi*, *joko widodo*,
  *ahok*, *positif*, *masker*. The names changed office; the last two are the
  pandemic.
- **Flagged in one:** *anies*, *protokol*, *ibu kota* (Kompas); *nusantara*,
  *kalimantan timur*, *konten* (Tempo); *relawan* (Tribunnews).
- **Not flagged anywhere:** *kpk*, *prabowo*, *blusukan*, *ojek*, *mitra*,
  *subsidi*, *kartu*, *alumni*, *mudik*, *baterai*. Some of these guesses were
  simply wrong; others are added senses, which this measure misses.
- **Could not be scored:** 18 to 21 of the 44 in each publisher, among them
  *gibran*, *hoax*, *buzzer*, *dinasti*, *oligarki*, *hilirisasi*, *moderasi*,
  *cebong*, *kampret*. They were too rare in 2010–14. The words most typical of
  the decade are the ones a before-and-after comparison cannot see, because
  they had no before. Their frequency curves on the site show the arrival.

Between 2015–19 and 2020–24, where all three publishers have plenty of text,
141 words and names are flagged in all three. They are the pandemic
(*penyebaran, positif, karantina, isolasi, kerumunan, masker, daring, vaksin*)
and the people whose role changed (*tito karnavian, sandiaga uno, teten
masduki, edhy prabowo, lukas enembe*).

## What it shows, as before

- **Wholesale changes are plain to see.** *transparan* moves from paintings and
  light (1980–84) to public administration (2010–14); *situs* from excavations
  to the web; *mantan* and *lengser* arrive in 1985–89 and 1995–99.
- **Added senses mostly are not.** *artis*, *virus*, *aplikasi*, *seksi* and
  *preman* stayed under the flag in books.
- **Events and meaning cannot be told apart by the number.** The site shows
  the company, so that a reader can judge.
- **Agreement between sources is the best ranking there is, and it is not
  proof.** *editor*, *baca* and *selengkapnya* are flagged in all three
  publishers: all three changed how they sign and link their pages, and the
  rules that remove such furniture do not catch every form.

## Regional languages

Still only a start. The web was the hope, and it does not deliver: after
machine translation is removed (half of the Javanese and Sundanese web in this
release), about 20,000 dated pages remain for each, mostly blogs, and fewer for
Minangkabau, Banjar, Balinese, Acehnese and Buginese, where Wikipedia, Bible
sites and dictionaries dominate. The Javanese and Sundanese lenses remain the
books HathiTrust holds; their change scores are weak and nearly blind.

## What it does not show

Speech, social media, anything after 2024 except abstracts, anything before
1950, and what Indonesians read as opposed to what libraries scanned and
crawlers reached. More than half of dated-looking web pages could not be dated
and are absent, among them most pages of publishers whose addresses carry no
date. A unit is a page or an article, so "company" means topic, not grammar.
No native speaker has judged the output yet; a blind sample is waiting.

Everything can be rebuilt from public sources with `./run.sh`.
