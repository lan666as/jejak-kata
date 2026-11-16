"""From units to counts: how often each word occurs, and with which others.

    python -m idhist.counts id-books            # all steps: freq parts merge
    python -m idhist.counts id-books merge      # or just some

Writes, under data/counts/<lens>/:

    freq.parquet    word x year: units containing it, occurrences, capitalised
    vocab.txt       target words, one per line (the word axis)
    contexts.txt    context words (the context axis)
    cooc.zarr       cooc   [period, fold, word, context]  units where both occur
                    df     [period, fold, word]           units where the word occurs
                    units  [period, fold]                 units

Every group (volume, publisher-day) falls in one of FOLDS folds by a hash of its
id. Counts are additive, so any resample of a period is a sum over folds; that
is what makes the noise floor in `measure` cheap. The array is chunked along the
word axis, so everything about a range of words, in all periods, is one read.
"""

import argparse
import shutil
import zlib
from collections import Counter, defaultdict
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import scipy.sparse as sp
import zarr

from idhist import WORKERS, units
from idhist.lenses import LENSES, Lens

ROOT = Path("data/counts")
FOLDS = 6
ROWS = 512  # words per chunk of the co-occurrence array
CHUNK = 5_000  # units multiplied at a time
RUN = 4  # consecutive shards per job; shards are in time order, so a run touches few periods

# One process is one worker: parallelism comes from the pools below, not from zarr's threads.
zarr.config.set({"threading.max_workers": 1, "async.concurrency": 1})


def fold_of(group: str) -> int:
    return zlib.crc32(group.encode()) % FOLDS


def read_words(path: Path) -> list[str]:
    return path.read_text().split()


class Counts:
    """Read access to the counts of one lens."""

    def __init__(self, lens: Lens):
        self.lens = lens
        self.dir = ROOT / lens.name
        self.words = read_words(self.dir / "vocab.txt")
        self.row = {w: i for i, w in enumerate(self.words)}
        self.contexts = read_words(self.dir / "contexts.txt")
        self.columns = np.array([self.row[w] for w in self.contexts])
        self.own = np.full(len(self.words), -1)  # each word's own context column, if it is one
        self.own[self.columns] = np.arange(len(self.columns))
        store = zarr.open_group(self.dir / "cooc.zarr", mode="r")
        self._cooc = store["cooc"]
        self.df = store["df"][:]
        self.units = store["units"][:]

    def cooc(self, words: slice | list[int], periods: slice | list[int] = slice(None)) -> np.ndarray:
        """[period, fold, word, context] for a range or a list of words."""
        return self._cooc.oindex[periods, :, words]

    def chunks(self) -> list[slice]:
        return [slice(i, min(i + ROWS, len(self.words))) for i in range(0, len(self.words), ROWS)]


# ---- step 1: frequencies and vocabulary ------------------------------------


def _frequencies(job: tuple[Lens, Path]) -> tuple[dict, Counter]:
    lens, shard = job
    stats = defaultdict(lambda: np.zeros(3, dtype=np.int64))  # (word, year) -> df, count, caps
    n_units = Counter()
    for unit in units.read_shard(shard):
        if lens.period_of(unit.year, unit.source) is None:
            continue
        n_units[unit.year] += 1
        for word, n in unit.counts.items():
            stats[word, unit.year] += (1, n, unit.caps[word])
    return dict(stats), n_units


def build_frequencies(lens: Lens, out: Path) -> None:
    stats = defaultdict(lambda: np.zeros(3, dtype=np.int64))
    n_units = Counter()
    with Pool(WORKERS) as pool:
        for part, n in pool.imap_unordered(_frequencies, [(lens, s) for s in units.shards(lens.units)]):
            n_units.update(n)
            for key, value in part.items():
                stats[key] += value

    # Rank words by their mean share of units across periods, so that no period
    # decides the vocabulary just by being large.
    period_units = Counter()
    for year, n in n_units.items():
        period_units[lens.period_of(year)] += n
    share = Counter()
    for (word, year), (df, _, _) in stats.items():
        share[word] += df / period_units[lens.period_of(year)] / len(lens.periods)
    ranked = [w for w, _ in share.most_common(lens.vocab)]
    (out / "vocab.txt").write_text("\n".join(ranked) + "\n")
    (out / "contexts.txt").write_text("\n".join(ranked[lens.skip : lens.skip + lens.contexts]) + "\n")

    keep = set(ranked)
    rows = [(w, y, *map(int, v)) for (w, y), v in stats.items() if w in keep]
    rows += [("", y, n, 0, 0) for y, n in n_units.items()]  # word "" carries the unit totals
    table = pa.table(dict(zip(["word", "year", "units", "count", "caps"], zip(*sorted(rows)))))
    pq.write_table(table, out / "freq.parquet", compression="zstd")
    print(f"{lens.name}: {sum(n_units.values())} units, {len(share)} distinct words, kept {len(ranked)}")


# ---- step 2: co-occurrence of each run of shards -----------------------------


def _cooccurrence(job: tuple[Lens, list[Path], Path]) -> int:
    """Co-occurrence of a run of shards, one part file per (period, fold) it touches."""
    lens, shards, out = job
    row_of = {w: i for i, w in enumerate(read_words(out / "vocab.txt"))}
    columns = np.array([row_of[w] for w in read_words(out / "contexts.txt")])

    members = defaultdict(list)  # (period, fold) -> word-id arrays, one per unit
    for shard in shards:
        for unit in units.read_shard(shard):
            period = lens.period_of(unit.year, unit.source)
            if period is not None:
                ids = [row_of[w] for w in unit.counts if w in row_of]
                members[period, fold_of(unit.group)].append(np.array(ids, dtype=np.int32))

    for (period, fold), bags in members.items():
        cooc = np.zeros((len(row_of), len(columns)), dtype=np.uint32)
        df = np.zeros(len(row_of), dtype=np.int64)
        for start in range(0, len(bags), CHUNK):
            chunk = bags[start : start + CHUNK]
            indptr = np.cumsum([0] + [len(b) for b in chunk])
            x = sp.csr_matrix(
                (np.ones(indptr[-1], dtype=np.uint32), np.concatenate(chunk), indptr),
                shape=(len(chunk), len(row_of)),
            )
            cooc += (x.T @ x[:, columns]).toarray()
            df += np.asarray(x.sum(axis=0), dtype=np.int64).ravel()
        m = sp.csr_matrix(cooc)
        np.savez_compressed(
            out / "parts" / f"{period}__{fold}__{shards[0].stem}.npz",
            cooc=m.data,
            indices=m.indices,
            indptr=m.indptr,
            df=df,
            units=len(bags),
        )
    return len(members)


def build_parts(lens: Lens, out: Path) -> None:
    shutil.rmtree(out / "parts", ignore_errors=True)  # never add to the parts of an interrupted run
    (out / "parts").mkdir()
    shards = units.shards(lens.units)
    jobs = [(lens, shards[i : i + RUN], out) for i in range(0, len(shards), RUN)]
    with Pool(WORKERS) as pool:
        print(f"{lens.name}: {sum(pool.imap_unordered(_cooccurrence, jobs))} parts", flush=True)


# ---- step 3: sum the parts into the array -----------------------------------


def _merge(job: tuple[Path, int, int, list[Path]]) -> tuple[int, int, np.ndarray, int]:
    """Sum the parts of one (period, fold) and write that slice of the array."""
    out, period, fold, paths = job
    cooc = zarr.open_group(out / "cooc.zarr", mode="r+")["cooc"]
    total, df, n = np.zeros(cooc.shape[2:], dtype=np.uint32), 0, 0
    for path in paths:
        z = np.load(path)
        total += sp.csr_matrix((z["cooc"], z["indices"], z["indptr"]), shape=total.shape).toarray().astype(np.uint32)
        df, n = df + z["df"], n + int(z["units"])
    cooc[period, fold] = total
    return period, fold, df, n


def merge_parts(lens: Lens, out: Path) -> None:
    n_words, n_contexts = len(read_words(out / "vocab.txt")), len(read_words(out / "contexts.txt"))
    shape = (len(lens.periods), FOLDS, n_words)
    store = zarr.create_group(out / "cooc.zarr", overwrite=True)
    store.create_array("cooc", shape=(*shape, n_contexts), chunks=(1, 1, ROWS, n_contexts), dtype="uint32")
    df, n_units = np.zeros(shape, dtype=np.int64), np.zeros(shape[:2], dtype=np.int64)

    by_cell = defaultdict(list)
    for path in sorted((out / "parts").glob("*.npz")):
        period, fold, _ = path.stem.split("__")
        by_cell[int(period), int(fold)].append(path)
    with Pool(WORKERS) as pool:
        for period, fold, cell_df, n in pool.imap_unordered(_merge, [(out, *c, p) for c, p in by_cell.items()]):
            df[period, fold], n_units[period, fold] = cell_df, n
            print(f"{lens.name} {lens.labels[period]} fold {fold}: {n} units", flush=True)
    store.create_array("df", data=df)
    store.create_array("units", data=n_units)
    for paths in by_cell.values():
        for path in paths:
            path.unlink()
    (out / "parts").rmdir()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    parser.add_argument("steps", nargs="*", default=["freq", "parts", "merge"])
    args = parser.parse_args()
    lens, out = LENSES[args.lens], ROOT / args.lens
    out.mkdir(parents=True, exist_ok=True)
    steps = {"freq": build_frequencies, "parts": build_parts, "merge": merge_parts}
    for step in args.steps:
        steps[step](lens, out)
