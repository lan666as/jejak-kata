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
from collections import defaultdict
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import scipy.sparse as sp
import zarr
import zstandard

from idhist import parallel, units
from idhist.lenses import LENSES, Lens

ROOT = Path("data/counts")
FOLDS = 6
ROWS = 512  # words per chunk of the co-occurrence array
RUN = 4  # consecutive shards per job, at least; shards are in time order, so a run touches few periods
JOBS = 128  # and at most about this many jobs: every job leaves a file per period and fold, tens of megabytes each
SUM_EVERY = 5_000_000  # words a job of the frequency step holds before it sums them
FREQ = ["word", "year", "units", "count", "caps"]
FREQ_SCHEMA = pa.schema([("word", pa.string()), ("year", pa.int16()), *((c, pa.int64()) for c in FREQ[2:])])
PART = ["cooc", "indices", "indptr", "df", "units"]  # the arrays of a part file, in the order they are written

# One process is one worker: parallelism comes from the pools below, not from zarr's threads.
zarr.config.set({"threading.max_workers": 1, "async.concurrency": 1})


def fold_of(group: str) -> int:
    return zlib.crc32(group.encode()) % FOLDS


def read_words(path: Path) -> list[str]:
    return path.read_text().splitlines()  # a phrase has spaces in it


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
#
# Shards are read as columns, and words are looked up, counted and summed inside Arrow and numpy. Going through
# one Python object per unit instead takes ten times as long and several times the memory.


def _taken(lens: Lens, shard: Path) -> tuple[pa.Table, np.ndarray]:
    """The units of a shard that the lens takes, and the period of each."""
    table = pq.read_table(shard)
    periods = [lens.period_of(*unit) for unit in zip(table["year"].to_pylist(), table["source"].to_pylist())]
    taken = np.array([period is not None for period in periods], dtype=bool)
    return table.filter(pa.array(taken)).combine_chunks(), np.array(
        [p for p in periods if p is not None], dtype=np.int64
    )


def _summed(tables: list[pa.Table]) -> pa.Table:
    """One row per word and year."""
    if not tables:
        return FREQ_SCHEMA.empty_table()
    summed = pa.concat_tables(tables).group_by(["word", "year"]).aggregate([(c, "sum") for c in FREQ[2:]])
    summed = summed.select(["word", "year", *(f"{c}_sum" for c in FREQ[2:])]).rename_columns(FREQ)
    return summed.combine_chunks()  # in slices, it is pickled with a copy of the whole buffer for each


def _frequencies(job: tuple[Lens, list[Path]]) -> pa.Table:
    """word x year for a run of shards: units containing the word, occurrences, capitalised. Word "" is every unit."""
    lens, shards = job
    tables, rows = [], 0
    for shard in shards:
        table, _ = _taken(lens, shard)
        if not table.num_rows:
            continue
        words, year = table["words"].chunk(0), table["year"].to_numpy()
        per_word = np.repeat(year, pc.list_value_length(words).to_numpy())
        flat = [words.flatten(), per_word, np.ones(len(per_word), np.int64)]
        flat += [pc.cast(table[c].chunk(0).flatten(), pa.int64()) for c in ("counts", "caps")]
        years, n = np.unique(year, return_counts=True)
        totals = [[""] * len(years), years, n, np.zeros(len(years), np.int64), np.zeros(len(years), np.int64)]
        tables += [pa.table(dict(zip(FREQ, columns)), schema=FREQ_SCHEMA) for columns in (flat, totals)]
        rows += len(per_word)
        if rows > SUM_EVERY:
            tables, rows = [_summed(tables)], 0
    return _summed(tables)


def build_frequencies(lens: Lens, out: Path) -> None:
    freq = _summed(list(parallel(_frequencies, [(lens, run) for run in _runs(lens)])))

    # Rank words by their mean share of units across periods, so that no period
    # decides the vocabulary just by being large.
    period = np.array([lens.period_of(year) for year in freq["year"].to_pylist()])
    is_total = pc.equal(freq["word"], "").to_numpy(zero_copy_only=False)
    period_units = np.bincount(period[is_total], freq["units"].to_numpy()[is_total], len(lens.periods))
    share = freq["units"].to_numpy() / period_units[period] / len(lens.periods)
    words = (
        pa.table({"word": freq["word"], "share": share})
        .filter(~is_total)
        .group_by("word")
        .aggregate([("share", "sum")])
    )
    ranked = words.sort_by([("share_sum", "descending"), ("word", "ascending")])["word"][: lens.vocab].to_pylist()
    (out / "vocab.txt").write_text("\n".join(ranked) + "\n")
    (out / "contexts.txt").write_text("\n".join(ranked[lens.skip : lens.skip + lens.contexts]) + "\n")

    kept = freq.filter(pc.is_in(freq["word"], pa.array([*ranked, ""])))
    pq.write_table(
        kept.sort_by([("word", "ascending"), ("year", "ascending")]), out / "freq.parquet", compression="zstd"
    )
    print(f"{lens.name}: {int(period_units.sum())} units, {words.num_rows} distinct words, kept {len(ranked)}")


# ---- step 2: co-occurrence of each run of shards -----------------------------


def _runs(lens: Lens) -> list[list[Path]]:
    """The shards in runs of consecutive ones, one run per job."""
    shards = units.shards(lens.units)
    run = max(RUN, -(-len(shards) // JOBS))
    return [shards[i : i + run] for i in range(0, len(shards), run)]


def _write_part(path: Path, arrays: list[np.ndarray]) -> None:
    with zstandard.open(path, "wb") as f:
        for array in arrays:
            np.lib.format.write_array(f, np.asarray(array))


def _read_part(path: Path) -> list[np.ndarray]:
    with zstandard.open(path, "rb") as f:
        return [np.lib.format.read_array(f) for _ in PART]


def _cooccurrence(job: tuple[Lens, list[Path], Path]) -> int:
    """Co-occurrence of a run of shards, one part file per (period, fold) it touches."""
    lens, shards, out = job
    vocab = read_words(out / "vocab.txt")
    row_of = {w: i for i, w in enumerate(vocab)}
    columns = np.array([row_of[w] for w in read_words(out / "contexts.txt")])
    known = pa.array(vocab)

    cells, lengths, ids = [], [], []  # per unit: its (period, fold) and how many known words; and those words' ids
    for shard in shards:
        table, periods = _taken(lens, shard)
        if not table.num_rows:
            continue
        words = table["words"].chunk(0)
        found = pc.index_in(words.flatten(), value_set=known)
        is_known = found.is_valid().to_numpy(zero_copy_only=False)
        unit_of_word = np.repeat(np.arange(table.num_rows), pc.list_value_length(words).to_numpy())
        cells.append(periods * FOLDS + [fold_of(group) for group in table["group"].to_pylist()])
        lengths.append(np.bincount(unit_of_word[is_known], minlength=table.num_rows))
        ids.append(found.fill_null(0).to_numpy()[is_known].astype(np.min_scalar_type(len(vocab))))
    if not cells:
        return 0
    cells, lengths, ids = map(np.concatenate, (cells, lengths, ids))

    touched = np.unique(cells)
    for cell in touched:
        units_here = cells == cell
        words_here = ids[np.repeat(units_here, lengths)].astype(np.int32)
        indptr = np.concatenate([[0], np.cumsum(lengths[units_here])])
        x = sp.csr_matrix(
            (np.ones(len(words_here), np.uint32), words_here, indptr), shape=(len(indptr) - 1, len(vocab))
        )
        cooc = (x.T @ x[:, columns]).tocsr()
        part = {
            "cooc": cooc.data,
            "indices": cooc.indices.astype(np.min_scalar_type(len(columns))),
            "indptr": cooc.indptr,
            "df": np.bincount(words_here, minlength=len(vocab)),
            "units": x.shape[0],
        }
        _write_part(
            out / "parts" / f"{cell // FOLDS}__{cell % FOLDS}__{shards[0].stem}.part", [part[name] for name in PART]
        )
    return len(touched)


def build_parts(lens: Lens, out: Path) -> None:
    shutil.rmtree(out / "parts", ignore_errors=True)  # never add to the parts of an interrupted run
    (out / "parts").mkdir()
    print(f"{lens.name}: {sum(parallel(_cooccurrence, [(lens, run, out) for run in _runs(lens)]))} parts", flush=True)


# ---- step 3: sum the parts into the array -----------------------------------


def _merge(job: tuple[Path, int, int, list[Path]]) -> tuple[int, int, np.ndarray, int]:
    """Sum the parts of one (period, fold), write that slice of the array, and remove the parts."""
    out, period, fold, paths = job
    array = zarr.open_group(out / "cooc.zarr", mode="r+")["cooc"]
    total, df, n = np.zeros(array.shape[2:], dtype=np.uint32), 0, 0
    for path in paths:
        cooc, indices, indptr, part_df, part_units = _read_part(path)
        total += sp.csr_matrix((cooc, indices.astype(np.int32), indptr), shape=total.shape).toarray()
        df, n = df + part_df, n + int(part_units)
    array[period, fold] = total
    for path in paths:  # now, not at the end: the parts of a large lens are several times the size of the array
        path.unlink()
    return period, fold, df, n


def merge_parts(lens: Lens, out: Path) -> None:
    n_words, n_contexts = len(read_words(out / "vocab.txt")), len(read_words(out / "contexts.txt"))
    shape = (len(lens.periods), FOLDS, n_words)
    store = zarr.create_group(out / "cooc.zarr", overwrite=True)
    store.create_array("cooc", shape=(*shape, n_contexts), chunks=(1, 1, ROWS, n_contexts), dtype="uint32")
    df, n_units = np.zeros(shape, dtype=np.int64), np.zeros(shape[:2], dtype=np.int64)

    by_cell = defaultdict(list)
    for path in sorted((out / "parts").glob("*.part")):
        period, fold, _ = path.stem.split("__")
        by_cell[int(period), int(fold)].append(path)
    for period, fold, cell_df, n in parallel(_merge, [(out, *c, p) for c, p in by_cell.items()]):
        df[period, fold], n_units[period, fold] = cell_df, n
        print(f"{lens.name} {lens.labels[period]} fold {fold}: {n} units", flush=True)
    store.create_array("df", data=df)
    store.create_array("units", data=n_units)
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
