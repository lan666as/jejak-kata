"""What text from web pages needs that book pages do not.

A crawled page carries more than its text: section menus, "read also" teasers
for other stories, share prompts, bylines. Left in, this furniture makes every
word of a publisher keep company with its menu, and a redesign looks like
language change. A line is furniture, and removed, when

* it occurs in REPEATS or more pages of the same publisher;
* it is a teaser for another story (`Baca juga: ...`);
* it is a label: a short line that opens with one to three words and a colon
  (`Penulis: A | Editor: B`, `Pilihan Editor: ...`, `Foto: ...`);
* it is the notice that a story first ran elsewhere (`Artikel ini telah tayang di ...`).

The last three cannot be found by counting, because the rest of the line differs every time.

A publisher also prints one story at several addresses (its regional editions, a corrected version, a
second part that repeats the first). Counted as separate pages they make a word look more common, and
make chance look smaller than it is. `signature` gives every page BANDS keys that two pages share when
most of their runs of SHINGLE words are the same; `copies` then keeps the earliest page of each such set.

Web text also has what book pages (which reach us as bags of words) cannot
give: word order. So here, and only here, words that belong together are
counted as one: `ibu kota`, `tol laut`, `joko widodo` (see `phrases.py`).
"""

import hashlib
import re
import zlib
from collections import Counter
from collections.abc import Iterable, Iterator

import numpy as np

from idhist import phrases, text

REPEATS = 20  # a line in this many pages of one publisher is furniture

LABEL_WORDS = 15  # a label line is at most this long
SHINGLE = 7  # words in a run that two copies of a story share
BANDS, ROWS = 4, 4  # a page has BANDS keys, each made of ROWS smallest values: pages with nine runs in ten in common
# share a key 99 times in 100, pages with half in common 23 times in 100
_MIX = np.random.default_rng(0).integers(1, 2**63, BANDS * ROWS, dtype=np.uint64) | np.uint64(1)
_POWERS = np.uint64(1_000_003) ** np.arange(SHINGLE, dtype=np.uint64)

_TEASER = re.compile(r"(?i)^(baca|simak|lihat|tonton)\b[^:]{0,20}:")
_LABEL = re.compile(r"^\W*(?:[^\W\d_]+\s+){0,2}[^\W\d_]+\s*:")
_NOTICE = re.compile(r"(?i)^\W*artikel ini (telah|sudah) (tayang|terbit|dimuat)\b")
_TOKEN = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)?[2²]?")
_ADDRESS = re.compile(r"\S+://\S+|\b[\w.-]+\.(?:com|co|id|net|org)\b\S*")  # web addresses are not words
_TWO_LEVEL = re.compile(r"\.(co|or|go|ac|sch|web|my|net)\.id$")


def publisher(url: str) -> str:
    """Registered domain: `pontianak.tribunnews.com` -> `tribunnews.com`."""
    host = url.split("/")[2].lower() if "//" in url else ""
    labels = host.split(".")
    return ".".join(labels[-3:] if _TWO_LEVEL.search(host) else labels[-2:])


def lines(source: str, page: str) -> dict[int, str]:
    """The distinct lines of a page in the order they come, by an id that is the same for the same line of the
    same publisher."""
    prefix = source.encode()
    found = dict.fromkeys(line.strip() for line in page.split("\n"))
    return {
        int.from_bytes(hashlib.blake2b(prefix + line.encode(), digest_size=8).digest()): line for line in found if line
    }


def repeated(ids: Iterable[np.ndarray]) -> np.ndarray:
    """The sorted ids of the lines that are furniture, given the line ids of every page."""
    found, seen_in = np.unique(np.concatenate(list(ids)), return_counts=True)
    print(f"{(seen_in >= REPEATS).sum()} of {len(found)} distinct lines are furniture")
    return found[seen_in >= REPEATS]


def body(source: str, page: str, furniture: frozenset[int]) -> str:
    """The page without its furniture."""
    return "\n".join(line for i, line in lines(source, page).items() if i not in furniture and not _marked(line))


def _marked(line: str) -> bool:
    """Furniture by its form: a teaser, a label or a notice."""
    label = _LABEL.match(line) and len(line.split()) <= LABEL_WORDS
    return bool(_TEASER.match(line) or label or _NOTICE.match(line))


def runs(page: str) -> Iterator[list[tuple[str, bool]]]:
    """Stretches of words with nothing but spaces between them, as (word, capitalised)."""
    page = _ADDRESS.sub("\n", page)
    run, end = [], 0
    for m in _TOKEN.finditer(page):
        word = text.normalise(m[0])
        if run and (word is None or page[end : m.start()].strip(" ")):
            yield run
            run = []
        if word:
            run.append((word, m[0][0].isupper()))
        end = m.end()
    if run:
        yield run


def bag(page: str, known: frozenset[str] = frozenset()) -> tuple[Counter, Counter]:
    """Occurrences of each word or phrase, and how many of them were capitalised."""
    counts, caps = Counter(), Counter()
    for run in runs(page):
        for word, capitalised in phrases.join(run, known):
            counts[word] += 1
            caps[word] += capitalised
    return counts, +caps


def signature(source: str, words: list[str]) -> np.ndarray:
    """BANDS keys of a page of one publisher, plus one that only a word-for-word copy shares (the last)."""
    salt = np.uint64(zlib.crc32(source.encode()))
    tokens = np.fromiter((zlib.crc32(w.encode()) for w in words), np.uint64, len(words))
    with np.errstate(over="ignore"):  # arithmetic modulo 2**64 is what is wanted
        exact = (tokens * _POWERS[1] ** np.arange(len(tokens), dtype=np.uint64)).sum() ^ salt
        if len(tokens) < SHINGLE:
            return np.full(BANDS + 1, exact, np.uint64)
        runs = sum(tokens[j : len(tokens) - SHINGLE + 1 + j] * _POWERS[j] for j in range(SHINGLE))
        least = (np.unique(runs)[:, None] * _MIX).min(0).reshape(BANDS, ROWS)
        bands = (least * _POWERS[:ROWS]).sum(1) ^ salt ^ np.arange(1, BANDS + 1, dtype=np.uint64)
    return np.append(bands, exact)


def copies(order: np.ndarray, keys: np.ndarray) -> np.ndarray:
    """Which pages are copies of an earlier one: True where a page shares a key, directly or through other
    pages, with a page that comes before it in `order` (its date, then anything that breaks ties)."""
    first = np.argsort(
        np.argsort(order, kind="stable"), kind="stable"
    )  # rank of each page; a set is named by its least
    while True:
        before = first.copy()
        for column in keys.T:
            by_key = np.argsort(column, kind="stable")
            starts = np.flatnonzero(np.r_[True, column[by_key][1:] != column[by_key][:-1]])
            least = np.minimum.reduceat(first[by_key], starts)
            first[by_key] = np.repeat(least, np.diff(np.r_[starts, len(column)]))
        if (first == before).all():
            return first != np.argsort(np.argsort(order, kind="stable"), kind="stable")
