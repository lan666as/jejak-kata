"""How far each word's company moved between every two periods of a lens.

    python -m idhist.measure id-books

A word's *profile* in a sample of text says, for every context word, whether the
two share a unit more often or less often than they would by chance:

    sqrt(units where both occur) - sqrt(units expected if they were unrelated)

The square root makes the noise of every entry about the same (1/2) whatever the
counts, so common and rare contexts weigh equally and nothing needs a cut-off.
Profiles from different periods live in the same space (the context words), so
they can be compared directly, by cosine distance; no alignment.

The distance between two profiles is never zero, even for two samples of the
same period, and it is larger for rarer words. So every period is cut into two
random halves, many times over, and the distance from period A to period B is
always taken from one half of A to the other half of B. Taking A for both gives
the distance between two halves of the same period: the word's noise floor.

Writes data/measures/<lens>.npz:

    distance  [period, period, word]  mean over splits; the diagonal is the noise floor
    support   [period, word]          fewest units containing the word in any half

Three numbers are derived from these for a pair of periods (see `Measures`):

    excess    distance(a, b) minus the mean noise floor of a and b
    scored    whether the word is frequent enough in both periods to say anything
    shift     excess, in units of its spread among words of similar frequency;
              corpora drift as a whole, so even a stable word has some excess,
              and what matters is how far a word stands out from its peers
"""

import argparse
from dataclasses import dataclass
from itertools import combinations
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from scipy.ndimage import median_filter

from idhist import WORKERS
from idhist.counts import FOLDS, Counts
from idhist.lenses import LENSES, Lens

ROOT = Path("data/measures")
MIN_UNITS = 40  # a word needs this many units in every half to be scored
PEERS = 501  # words of nearest frequency a word's excess is judged against
FLAG = 4.0  # shift from which a word is flagged as moved; set by the planted-change test

# Balanced splits of the folds into two halves; fixing fold 0 avoids mirror images.
SPLITS = [
    (list(half), [f for f in range(FOLDS) if f not in half])
    for half in combinations(range(FOLDS), FOLDS // 2)
    if 0 in half
]


def profiles(cooc: np.ndarray, df_words: np.ndarray, df_contexts: np.ndarray, units: np.ndarray, own: np.ndarray):
    """The profile of every word, scaled to unit length.

    cooc [..., word, context], df_words [..., word], df_contexts [..., context],
    units [...]; `own` is each word's own context column, or -1.
    """
    with np.errstate(divide="ignore", invalid="ignore"):
        expected = df_words[..., :, None] * (df_contexts / units[..., None])[..., None, :]
    profile = np.sqrt(cooc, dtype=np.float32) - np.sqrt(expected, dtype=np.float32)
    np.nan_to_num(profile, copy=False)  # a sample with no units says nothing
    is_context = np.flatnonzero(own >= 0)
    profile[..., is_context, own[is_context]] = 0  # a word is not its own context
    norm = np.linalg.norm(profile, axis=-1, keepdims=True)
    return np.divide(profile, norm, out=profile, where=norm > 0)


def distances(cooc: np.ndarray, df_words: np.ndarray, df_contexts: np.ndarray, units: np.ndarray, own: np.ndarray):
    """(distance [period, period, word], support [period, word]) from fold counts.

    cooc [period, fold, word, context], df_words [period, fold, word],
    df_contexts [period, fold, context], units [period, fold].
    """
    total, support = 0, np.inf
    for split in SPLITS:
        one, two = (
            profiles(
                cooc[:, half].sum(1, dtype=np.float32),
                df_words[:, half].sum(1),
                df_contexts[:, half].sum(1),
                units[:, half].sum(1),
                own,
            ).swapaxes(0, 1)  # word, period, context
            for half in split
        )
        similarity = one @ two.swapaxes(1, 2)  # word, period of `one`, period of `two`
        total += 1 - (similarity + similarity.swapaxes(1, 2)) / 2
        support = np.minimum(support, np.minimum(*(df_words[:, half].sum(1) for half in split)))
    return np.moveaxis(total / len(SPLITS), 0, 2).astype(np.float32), support.astype(np.int64)


def whole(counts: Counts, period: int) -> np.ndarray:
    """Profile of every word from all the text of one period: [word, context]."""
    df, units = counts.df[period].sum(0), counts.units[period].sum()
    return np.concatenate(
        [
            profiles(
                counts.cooc(rows, [period])[0].sum(0, dtype=np.float32),
                df[rows],
                df[counts.columns],
                units,
                counts.own[rows],
            )
            for rows in counts.chunks()
        ]
    )


def _chunk(job: tuple[Lens, slice]) -> tuple[np.ndarray, np.ndarray]:
    lens, rows = job
    counts = Counts(lens)
    return distances(
        counts.cooc(rows), counts.df[:, :, rows], counts.df[:, :, counts.columns], counts.units, counts.own[rows]
    )


def measure(lens: Lens) -> None:
    jobs = [(lens, rows) for rows in Counts(lens).chunks()]
    with Pool(WORKERS) as pool:
        distance, support = zip(*pool.imap(_chunk, jobs))
    ROOT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        ROOT / f"{lens.name}.npz", distance=np.concatenate(distance, axis=2), support=np.concatenate(support, axis=1)
    )


@dataclass
class Measures:
    """The measurements of one lens, and the scores derived from them."""

    distance: np.ndarray  # period x period x word
    support: np.ndarray  # period x word

    @classmethod
    def load(cls, lens: Lens) -> "Measures":
        z = np.load(ROOT / f"{lens.name}.npz")
        return cls(z["distance"], z["support"])

    def scored(self, a: int, b: int) -> np.ndarray:
        return np.minimum(self.support[a], self.support[b]) >= MIN_UNITS

    def excess(self, a: int, b: int) -> np.ndarray:
        return self.distance[a, b] - (self.distance[a, a] + self.distance[b, b]) / 2

    def shift(self, a: int, b: int) -> np.ndarray:
        """Excess relative to words of similar frequency; NaN where not scored."""
        scored = self.scored(a, b)
        out = np.full(scored.shape, np.nan, dtype=np.float32)
        out[scored] = standardise(self.excess(a, b)[scored], np.minimum(self.support[a], self.support[b])[scored])
        return out


def standardise(value: np.ndarray, frequency: np.ndarray) -> np.ndarray:
    """Robust z-score of each value among the PEERS values of nearest frequency."""
    order = np.argsort(frequency, kind="stable")
    v = value[order]
    peers = min(PEERS, len(v))
    centre = median_filter(v, peers, mode="reflect")
    spread = 1.4826 * median_filter(np.abs(v - centre), peers, mode="reflect")
    z = np.empty_like(v)
    z[order] = (v - centre) / spread
    return z


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    measure(LENSES[parser.parse_args().lens])
