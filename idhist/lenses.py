"""The lenses: one dated, genre-stable series of text each. Never merged.

Change is only ever measured between two periods of the same lens.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Lens:
    name: str
    units: str  # directory under data/units
    periods: tuple[tuple[int, int], ...]  # inclusive year ranges
    sources: frozenset[str] | None = None  # restrict to these series, e.g. one publisher
    vocab: int = 30_000  # target words
    contexts: int = 4_000  # context words, taken after the most frequent `skip`
    skip: int = 100  # the most frequent words say little about any neighbour

    def period_of(self, year: int, source: str | None = None) -> int | None:
        """Index of the period a year falls in; None if the lens does not take it."""
        if self.sources is not None and source is not None and source not in self.sources:
            return None
        for i, (first, last) in enumerate(self.periods):
            if first <= year <= last:
                return i
        return None

    @property
    def labels(self) -> list[str]:
        return [label(*p) for p in self.periods]


def label(first: int, last: int) -> str:
    return str(first) if first == last else f"{first}-{last}"


def bins(first: int, last: int, width: int) -> tuple[tuple[int, int], ...]:
    return tuple((y, y + width - 1) for y in range(first, last + 1, width))


WEB = bins(2010, 2024, 1)
ERAS = ((2010, 2014), (2015, 2019), (2020, 2024))  # presidential terms: Yudhoyono's second, Joko Widodo's two
ABSTRACTS = (*bins(2000, 2009, 5), (2010, 2012), *bins(2013, 2026, 2))
SMALL = {"vocab": 10_000, "contexts": 2_000, "skip": 50}

LENSES = {
    lens.name: lens
    for lens in [
        Lens("id-books", "id-books", bins(1950, 2019, 5)),
        # News pages of the open web, with a mix of publishers that changes from year to year.
        # Kompas is the one publisher with pages from every year.
        Lens("id-web-news", "id-web-news", WEB),
        Lens("id-web-news-kompas", "id-web-news", WEB[1:], sources=frozenset({"kompas.com"})),
        # The same pages by presidential term, one publisher at a time. All publishers together fail the test of
        # expected changes over such a distance (AUC 0.37): the mix of publishers changes more than any word does.
        Lens("id-web-eras-kompas", "id-web-news", ERAS, sources=frozenset({"kompas.com"})),
        Lens("id-web-eras-tempo", "id-web-news", ERAS, sources=frozenset({"tempo.co"})),
        Lens("id-web-eras-tribun", "id-web-news", ERAS, sources=frozenset({"tribunnews.com"})),
        # Blogs: an informal register, largest around 2012 and thinning since.
        Lens("id-web-blogs", "id-web-blogs", bins(2007, 2024, 2)),
        # Abstracts grow from 4,000 a year to 240,000, so the periods shorten as they go.
        Lens("id-abstracts", "id-abstracts", ABSTRACTS),
        # Javanese and Sundanese books are few (about 40 and 27 million words), so: long periods, a small vocabulary.
        Lens("jv-books", "jv-books", ((1910, 1939), (1950, 1969), (1970, 1989), (1990, 2019)), **SMALL),
        Lens("su-books", "su-books", ((1910, 1939), (1960, 1979), (1980, 1989), (1990, 2019)), **SMALL),
    ]
}
