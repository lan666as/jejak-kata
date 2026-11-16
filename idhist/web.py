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

Web text also has what book pages (which reach us as bags of words) cannot
give: word order. So here, and only here, words that belong together are
counted as one: `ibu kota`, `tol laut`, `joko widodo` (see `phrases.py`).
"""

import hashlib
import re
from collections import Counter
from collections.abc import Iterable, Iterator

import numpy as np

from idhist import phrases, text

REPEATS = 20  # a line in this many pages of one publisher is furniture

LABEL_WORDS = 15  # a label line is at most this long

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
    """The distinct lines of a page, by an id that is the same for the same line of the same publisher."""
    prefix = source.encode()
    found = {line.strip() for line in page.split("\n")}
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
