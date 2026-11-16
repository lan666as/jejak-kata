"""The one format every source is converted to, and everything else reads.

A *unit* is a stretch of text of roughly a page: a book page or a news article.
Two words co-occur when they share a unit. A *group* is what gets resampled to
estimate noise (a volume, or one publisher's output on one day), because units
inside a group are not independent.

    data/units/<lens>/<shard>.parquet     one row per unit

Adding a source means writing one function that yields `Unit`s.
"""

from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path("data/units")

SCHEMA = pa.schema(
    [
        ("group", pa.string()),  # resampling unit
        ("source", pa.string()),  # series within the lens, e.g. a publisher
        ("year", pa.int16()),
        ("words", pa.list_(pa.string())),
        ("counts", pa.list_(pa.int32())),  # occurrences of each word
        ("caps", pa.list_(pa.int32())),  # of which capitalised (names show up here)
    ]
)


@dataclass
class Unit:
    group: str
    source: str
    year: int
    counts: Counter  # word -> occurrences
    caps: Counter  # word -> capitalised occurrences


def write_shard(lens: str, shard: str, units: Iterable[Unit]) -> int:
    """Write one shard atomically; returns the number of units."""
    rows = [
        {
            "group": u.group,
            "source": u.source,
            "year": u.year,
            "words": list(u.counts),
            "counts": list(u.counts.values()),
            "caps": [u.caps[w] for w in u.counts],
        }
        for u in units
    ]
    path = ROOT / lens / f"{shard}.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), tmp, compression="zstd")
    tmp.rename(path)
    return len(rows)


def clear(lens: str) -> None:
    """Remove a lens's shards, so that a rebuild cannot leave old ones behind."""
    for path in (ROOT / lens).glob("*.*"):
        path.unlink()


def shards(lens: str) -> list[Path]:
    found = sorted((ROOT / lens).glob("*.parquet"))
    if not found:
        raise FileNotFoundError(f"no units for lens {lens!r} under {ROOT}")
    return found


def read_shard(path: Path) -> Iterator[Unit]:
    for row in pq.read_table(path).to_pylist():
        yield Unit(
            row["group"],
            row["source"],
            row["year"],
            Counter(dict(zip(row["words"], row["counts"]))),
            Counter(dict(zip(row["words"], row["caps"]))),
        )
