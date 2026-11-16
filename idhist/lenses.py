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


NEWS = bins(2017, 2022, 1)
ABSTRACTS = (*bins(2000, 2009, 5), (2010, 2012), *bins(2013, 2026, 2))
SMALL = {"vocab": 10_000, "contexts": 2_000, "skip": 50}

LENSES = {
    lens.name: lens
    for lens in [
        Lens("id-books", "id-books", bins(1950, 2019, 5)),
        # All of CC-NEWS: large, but its mix of publishers changes from year to year.
        Lens("id-news", "id-news", NEWS),
        # The two publishers present in every year, each on its own: smaller, but one voice throughout.
        Lens("id-news-tribun", "id-news", NEWS, sources=frozenset({"tribunnews.com"})),
        Lens("id-news-okezone", "id-news", NEWS, sources=frozenset({"okezone.com"})),
        # Abstracts grow from 4,000 a year to 240,000, so the periods shorten as they go.
        Lens("id-abstracts", "id-abstracts", ABSTRACTS),
        # Javanese and Sundanese books are few (about 40 and 27 million words), so: long periods, a small vocabulary.
        Lens("jv-books", "jv-books", ((1910, 1939), (1950, 1969), (1970, 1989), (1990, 2019)), **SMALL),
        Lens("su-books", "su-books", ((1910, 1939), (1960, 1979), (1980, 1989), (1990, 2019)), **SMALL),
    ]
}
