"""Abstracts of Indonesian-language scholarly works, from the OpenAlex snapshot.

    python -m idhist.sources.openalex fetch    # keep the Indonesian works with an abstract
    python -m idhist.sources.openalex units

OpenAlex publishes its whole catalogue (about 465 million works) as Parquet in a
public bucket, replaced about monthly; the date of the snapshot read is kept in
data/raw/openalex/manifest.json. Only the columns needed are read. OpenAlex data
is CC0; an abstract comes as an inverted index (word -> positions), which is
already the bag of words a unit needs.

A unit is one abstract. Its group, for resampling, is one year of the journal
or repository it appeared in: abstracts from one venue share a field and a
house style.
"""

import argparse
import json
from collections import Counter
from itertools import count, islice
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.fs
import pyarrow.parquet as pq

from idhist import parallel, text
from idhist.units import Unit, clear, write_shard

LENS = "id-abstracts"
ROOT = Path("data/raw/openalex")
BUCKET = "openalex/data/parquet/works"
LANGUAGE = "id"  # OpenAlex's label is a guess, and abstracts are often printed in two languages: checked again per unit
COLUMNS = ["id", "publication_year", "type", "language", "abstract_inverted_index", "primary_location.source.id"]
MIN_WORDS = 50
SHARD_ABSTRACTS = 20_000


def _bucket() -> pa.fs.S3FileSystem:
    return pa.fs.S3FileSystem(anonymous=True, region="us-east-1")


def _fetch(key: str) -> int:
    """Keep the Indonesian works with an abstract from one file of the snapshot."""
    out = ROOT / (key.removeprefix(f"{BUCKET}/").replace("/", "__"))
    if out.exists():
        return pq.ParquetFile(out).metadata.num_rows
    kept = []
    for batch in pq.ParquetFile(_bucket().open_input_file(key)).iter_batches(batch_size=20_000, columns=COLUMNS):
        wanted = pc.and_(pc.equal(batch["language"], LANGUAGE), pc.is_valid(batch["abstract_inverted_index"]))
        batch = batch.filter(pc.fill_null(wanted, False))
        kept.append(
            pa.table(
                {
                    "id": batch["id"],
                    "year": batch["publication_year"],
                    "type": batch["type"],
                    "venue": pc.struct_field(batch["primary_location"], ["source", "id"]),
                    "abstract": batch["abstract_inverted_index"],
                }
            )
        )
    table = pa.concat_tables(kept)
    tmp = out.with_suffix(".tmp")
    pq.write_table(table, tmp, compression="zstd")
    tmp.rename(out)
    return table.num_rows


def fetch() -> None:
    """Safe to re-run: files already filtered are skipped."""
    ROOT.mkdir(parents=True, exist_ok=True)
    with _bucket().open_input_stream(f"{BUCKET}/manifest.json") as f:
        manifest = json.load(f)
    (ROOT / "manifest.json").write_text(json.dumps({k: v for k, v in manifest.items() if k != "files"}))
    keys = [entry["url"].removeprefix("s3://") for entry in manifest["files"]]
    n = sum(parallel(_fetch, keys))
    print(f"snapshot {manifest['date']}: kept {n} of {manifest['record_count']} works")


def unit(row: dict) -> Unit | None:
    counts, caps = Counter(), Counter()
    for token, positions in json.loads(row["abstract"]).items():
        word = text.normalise(token.strip(".,;:()[]\"'"))
        if word:
            counts[word] += len(positions)
            if token[0].isupper():
                caps[word] += len(positions)
    if counts.total() < MIN_WORDS or text.language(counts) != LANGUAGE:
        return None
    venue = row["venue"] or row["id"]
    return Unit(f"{venue}/{row['year']}", venue, row["year"], counts, caps)


def _year(year: int) -> int:
    """All abstracts of one year, as shards named so that they sort in time order."""
    rows = (
        row
        for path in sorted(ROOT.glob("*.parquet"))
        for row in pq.read_table(path, filters=[("year", "=", year)]).to_pylist()
    )
    units = filter(None, map(unit, rows))
    written = 0
    for part in count():
        batch = list(islice(units, SHARD_ABSTRACTS))
        if not batch:
            return written
        written += write_shard(LENS, f"{year}-{part:03d}", batch)


def build_units() -> None:
    clear(LENS)
    years = set()
    for path in ROOT.glob("*.parquet"):
        years.update(pq.read_table(path, columns=["year"])["year"].drop_null().unique().to_pylist())
    print(sum(parallel(_year, sorted(years))), "units")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "units"])
    {"fetch": fetch, "units": build_units}[parser.parse_args().step]()
