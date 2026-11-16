"""Indonesian news from Common Crawl's CC-NEWS, as extracted in acul3/KoPI-CC_News.

    python -m idhist.sources.ccnews fetch
    python -m idhist.sources.ccnews furniture    # find the lines that are not text
    python -m idhist.sources.ccnews units

CC-NEWS follows news feeds, so an article is crawled close to when it appears:
of the 2019 articles whose URL carries a date, 92.5% were crawled within a week
of it. The URL date is used when present, otherwise the crawl date.

Page furniture is removed as described in `idhist/web.py`.
"""

import argparse
import io
import json
import re
from collections.abc import Iterator
from datetime import date
from functools import cache
from pathlib import Path

import numpy as np
import zstandard
from huggingface_hub import snapshot_download

from idhist import parallel, web
from idhist.units import Unit, clear, write_shard

LENS = "id-news"
REPO = "acul3/KoPI-CC_News"
ROOT = Path("data/raw/kopi_ccnews")
FURNITURE = ROOT / "furniture.npy"  # sorted ids of the lines found to be furniture
MIN_WORDS = 50
SHARD_ARTICLES = 10_000

_URL_DATE = re.compile(r"/(20\d\d)/(\d\d)/(\d\d)/")


def published(url: str, crawled: date) -> date:
    m = _URL_DATE.search(url)
    if m:
        try:
            d = date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return crawled
        if d <= crawled:
            return d
    return crawled


def _read(path: Path) -> Iterator[str]:
    with open(path, "rb") as raw:
        yield from io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(raw), encoding="utf-8")


def _batches() -> Iterator[tuple[str, list[dict]]]:
    """Every article once, in batches that become shards."""
    for path in sorted(ROOT.glob("data/*.zst")):
        seen, batch, part = set(), [], 0
        for line in _read(path):
            doc = json.loads(line)
            keys = {doc["url"], hash(doc["text"])}  # the same article is often crawled, or posted, more than once
            if keys & seen:
                continue
            seen |= keys
            batch.append({k: doc[k] for k in ("url", "timestamp", "text")})
            if len(batch) == SHARD_ARTICLES:
                yield f"{path.name[:12]}-{part:03d}", batch
                batch, part = [], part + 1
        yield f"{path.name[:12]}-{part:03d}", batch


def _line_ids(job: tuple[str, list[dict]]) -> np.ndarray:
    return np.array([i for doc in job[1] for i in web.lines(web.publisher(doc["url"]), doc["text"])], dtype=np.uint64)


def find_furniture() -> None:
    np.save(FURNITURE, web.repeated(parallel(_line_ids, _batches())))


@cache
def furniture() -> frozenset[int]:
    return frozenset(np.load(FURNITURE).tolist())


def _unit(doc: dict) -> Unit | None:
    source = web.publisher(doc["url"])
    counts, caps = web.bag(web.body(source, doc["text"], furniture()))
    if counts.total() < MIN_WORDS:
        return None
    day = published(doc["url"], date.fromisoformat(doc["timestamp"][:10]))
    return Unit(f"{source}/{day}", source, day.year, counts, caps)


def _write(job: tuple[str, list[dict]]) -> int:
    shard, docs = job
    return write_shard(LENS, shard, filter(None, map(_unit, docs)))


def fetch() -> None:
    snapshot_download(REPO, repo_type="dataset", local_dir=ROOT, allow_patterns=["data/*.zst", "README.md"])


def build_units() -> None:
    clear(LENS)
    print(sum(parallel(_write, _batches())), "units")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "furniture", "units"])
    {"fetch": fetch, "furniture": find_furniture, "units": build_units}[parser.parse_args().step]()
