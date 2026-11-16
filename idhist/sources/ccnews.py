"""Indonesian news from Common Crawl's CC-NEWS, as extracted in acul3/KoPI-CC_News.

    python -m idhist.sources.ccnews fetch
    python -m idhist.sources.ccnews furniture    # find the lines that are not text
    python -m idhist.sources.ccnews units

CC-NEWS follows news feeds, so an article is crawled close to when it appears:
of the 2019 articles whose URL carries a date, 92.5% were crawled within a week
of it. The URL date is used when present, otherwise the crawl date.

A crawled page carries more than its article: section menus, "read also"
teasers for other stories, share prompts, bylines. Left in, this furniture
makes every word of a publisher keep company with its menu, and a redesign
looks like language change. Two rules remove it: a line that occurs in REPEATS
or more articles of the same publisher is furniture, and so is a teaser line.
"""

import argparse
import hashlib
import io
import json
import re
from collections import Counter
from collections.abc import Iterator
from datetime import date
from functools import cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import zstandard
from huggingface_hub import snapshot_download

from idhist import WORKERS, text
from idhist.units import Unit, clear, write_shard

LENS = "id-news"
REPO = "acul3/KoPI-CC_News"
ROOT = Path("data/raw/kopi_ccnews")
FURNITURE = ROOT / "furniture.npy"  # sorted ids of the lines found to be furniture
MIN_WORDS = 50
SHARD_ARTICLES = 10_000
REPEATS = 20  # a line in this many articles of one publisher is furniture

_TEASER = re.compile(r"(?i)^(baca|simak|lihat|tonton)\b[^:]{0,20}:")

_TOKEN = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)?[2²]?")
_ADDRESS = re.compile(r"\S+://\S+|\b[\w.-]+\.(?:com|co|id|net|org)\b\S*")  # web addresses are not words
_URL_DATE = re.compile(r"/(20\d\d)/(\d\d)/(\d\d)/")
_TWO_LEVEL = re.compile(r"\.(co|or|go|ac|sch|web|my|net)\.id$")


def publisher(url: str) -> str:
    """Registered domain: `pontianak.tribunnews.com` -> `tribunnews.com`."""
    host = url.split("/")[2].lower() if "//" in url else ""
    labels = host.split(".")
    return ".".join(labels[-3:] if _TWO_LEVEL.search(host) else labels[-2:])


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


def bag(body: str) -> tuple[Counter, Counter]:
    counts, caps = Counter(), Counter()
    for token in _TOKEN.findall(_ADDRESS.sub(" ", body)):
        word = text.normalise(token)
        if word:
            counts[word] += 1
            if token[0].isupper():
                caps[word] += 1
    return counts, caps


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


def _lines(doc: dict) -> dict[int, str]:
    """The distinct lines of an article, by an id that is the same for the same line of the same publisher."""
    source = publisher(doc["url"]).encode()
    lines = {line.strip() for line in doc["text"].split("\n")}
    return {
        int.from_bytes(hashlib.blake2b(source + line.encode(), digest_size=8).digest()): line for line in lines if line
    }


def _line_ids(job: tuple[str, list[dict]]) -> np.ndarray:
    return np.array([i for doc in job[1] for i in _lines(doc)], dtype=np.uint64)


def find_furniture() -> None:
    with Pool(WORKERS) as pool:
        ids, seen_in = np.unique(np.concatenate(list(pool.imap_unordered(_line_ids, _batches()))), return_counts=True)
    np.save(FURNITURE, ids[seen_in >= REPEATS])
    print(f"{(seen_in >= REPEATS).sum()} of {len(ids)} distinct lines are furniture")


@cache
def furniture() -> frozenset[int]:
    return frozenset(np.load(FURNITURE).tolist())


def body(doc: dict) -> str:
    """The article without its furniture."""
    return "\n".join(line for i, line in _lines(doc).items() if i not in furniture() and not _TEASER.match(line))


def _unit(doc: dict) -> Unit | None:
    counts, caps = bag(body(doc))
    if counts.total() < MIN_WORDS:
        return None
    day = published(doc["url"], date.fromisoformat(doc["timestamp"][:10]))
    source = publisher(doc["url"])
    return Unit(f"{source}/{day}", source, day.year, counts, caps)


def _write(job: tuple[str, list[dict]]) -> int:
    shard, docs = job
    return write_shard(LENS, shard, filter(None, map(_unit, docs)))


def fetch() -> None:
    snapshot_download(REPO, repo_type="dataset", local_dir=ROOT, allow_patterns=["data/*.zst", "README.md"])


def build_units() -> None:
    clear(LENS)
    with Pool(WORKERS) as pool:
        print(sum(pool.imap_unordered(_write, _batches())), "units")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "furniture", "units"])
    {"fetch": fetch, "furniture": find_furniture, "units": build_units}[parser.parse_args().step]()
