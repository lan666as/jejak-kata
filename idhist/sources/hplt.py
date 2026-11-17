"""Dated Indonesian web pages from HPLT 3.0: Common Crawl and Internet Archive crawls of
2012-2024, already cut into documents, with the language and the register of each.

    python -m idhist.sources.hplt fetch       # stream the release, keep the dated pages
    python -m idhist.sources.hplt census      # what was kept, by register, year and publisher
    python -m idhist.sources.hplt furniture   # find the lines that are not text
    python -m idhist.sources.hplt copies      # find the pages that repeat an earlier page of the same publisher
    python -m idhist.sources.hplt phrases     # find the Wikipedia titles that occur often enough to count as one word
    python -m idhist.sources.hplt units
    python -m idhist.sources.hplt text        # keep the text of the publishers read one at a time

HPLT (https://hplt-project.org/datasets/v3.0) did the expensive part: reading
7 PB of crawls, extracting the text of each page and identifying its language.
What it does not give is when a page was written. A crawl date says only that
the page existed by then, so a page is dated by what it says about itself: a
date in its address (`/2015/03/02/`), or else the first date printed in its
opening lines. Pages with neither are left out (57% of them), and so are
machine-translated pages.

Two lenses come out of it, by the register HPLT assigns to each page:

* `id-web-news`: news reports. Where the address has no date the date in the
  opening lines is used; where a news page has both, they fall in the same
  year 97% of the time.
* `id-web-blogs`: narrative and opinion blogs, and everything on the blog
  platforms, whatever its register (in 2008-2011 most pages labelled as news
  were blog posts). Dated by address only: here the two dates agree less (92%).

The release is read as a stream and never stored; what is kept is a private
working copy of the dated pages, cut into BUCKETS by address so that every
capture of one page ends up in the same bucket.

A publisher prints one story at several addresses; of such copies only the
earliest is a unit (`web.signature`, `web.copies`). How many were left out, by
publisher and year, is in data/raw/hplt/census/copies.parquet.

The text of the publishers in KEPT (cleared of furniture and copies) is also
kept, privately, under data/raw/hplt/text: what needs word order (a phrase, a
sentence, a headline) can then be counted without reading the release again.
It is not ours to publish and is never published; only counts are.

Indonesian only. The same release has Javanese and Sundanese, but half of it is
machine translation, and what is left and dated is about 20,000 pages each.
"""

import argparse
import ast
import hashlib
import io
import json
import re
import time
import zlib
from collections import Counter, defaultdict
from collections.abc import Iterator
from datetime import date
from functools import cache
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import requests
import urllib3
import zstandard

from idhist import parallel, phrases, web
from idhist.sources import wikipedia
from idhist.units import Unit, clear, write_shard

ROOT = Path("data/raw/hplt")
RELEASE = "https://data.hplt-project.org/three/sorted"
LANGUAGE = "ind_Latn"  # HPLT's name for Indonesian
PAGES = ROOT / LANGUAGE  # the working copy
PHRASES = PAGES / "phrases.txt"
FURNITURE = PAGES / "furniture.npy"
COPIES = PAGES / "copies.npy"  # sorted ids of the pages that repeat an earlier one
TEXT = ROOT / "text"
# Publishers with news pages in nearly every year of 2010-2024, read one at a time; and two bodies of the state
# that publish their own news (the police and the armed forces).
KEPT = frozenset(
    {
        *("kompas.com", "tempo.co", "tribunnews.com", "bisnis.com", "okezone.com", "detik.com", "liputan6.com"),
        *("viva.co.id", "polri.go.id", "mil.id"),
    }
)
NEWS, BLOGS = "id-web-news", "id-web-blogs"
BLOG_PLATFORMS = frozenset({"blogspot.com", "blogspot.co.id", "wordpress.com"})
BUCKETS = 256
FLUSH = 200_000  # pages held in memory before they are written
FLUSH_UNITS = 20_000  # and units
SURE = 0.5  # a language or register label counts from this probability
OPENING = 600  # characters in which a page's own date is looked for
FIRST_YEAR = 1995
TRIES = 12  # reconnections before a download is given up
MIN_WORDS = 50
LATE = 6  # the census counts captures this many years after a page's date, or more, together
LEARN_FROM = 20  # phrases are learned from one page in this many

SCHEMA = pa.schema(
    [
        ("url", pa.string()),
        ("crawled", pa.date32()),
        ("address_date", pa.date32()),  # from the address; day 1 when it gives only a month
        ("text_date", pa.date32()),  # the first date in the opening lines
        ("registers", pa.list_(pa.string())),  # https://turkunlp.org/register-annotation-docs/
        ("text", pa.string()),
    ]
)

_MONTHS = (
    "januari februari maret april mei juni juli agustus september oktober november desember",
    "january february march april may june july august september october november december",
    "jan feb mar apr mei jun jul agu sep okt nov des",
    "- - - - may - - aug sept oct nop dec",
    "- peb - - - - - agt - - - -",
    "- - - - - - - ags - - - -",
)
_MONTH = {name: i + 1 for names in _MONTHS for i, name in enumerate(names.split()) if name != "-"}
_ADDRESS_DATE = re.compile(r"/((?:19|20)\d\d)[/-]?(0[1-9]|1[0-2])(?:[/-]?(0[1-9]|[12]\d|3[01])(?:\d{6})?)?(?=[/-])")
_TEXT_DATE = re.compile(
    r"\b(?P<d1>\d{1,2})[ /-](?P<name>[A-Za-z]{3,9})[ /-](?P<y1>(?:19|20)\d\d)\b"  # 2 Maret 2015
    r"|\b(?P<d2>\d{1,2})/(?P<m2>\d{1,2})/(?P<y2>(?:19|20)\d\d)\b"  # 02/03/2015
    r"|\b(?P<y3>(?:19|20)\d\d)-(?P<m3>\d\d)-(?P<d3>\d\d)\b"  # 2015-03-02
)


def _date(year: str, month: str | int, day: str | None, latest: date) -> date | None:
    """A date if it is a real one that a page crawled on `latest` could carry."""
    try:
        found = date(int(year), int(month), int(day or 1))
    except ValueError:
        return None
    return found if FIRST_YEAR <= found.year and found.replace(day=1) <= latest else None


def address_date(url: str, crawled: date) -> date | None:
    path = url.split("//", 1)[-1].partition("/")[2]
    m = _ADDRESS_DATE.search("/" + path)
    return _date(m[1], m[2], m[3], crawled) if m else None


def text_date(text: str, crawled: date) -> date | None:
    for m in _TEXT_DATE.finditer(text[:OPENING]):
        if m["name"]:
            month = _MONTH.get(m["name"].lower())
            found = _date(m["y1"], month, m["d1"], crawled) if month else None
        elif m["m2"]:
            found = _date(m["y2"], m["m2"], m["d2"], crawled)
        else:
            found = _date(m["y3"], m["m3"], m["d3"], crawled)
        if found:
            return found
    return None


def key(url: str) -> str:
    """What two captures of one page have in common: the address without scheme, `www.`, query or final slash."""
    address = url.split("//", 1)[-1].split("?", 1)[0].split("#", 1)[0].lower()
    return address.removeprefix("www.").removeprefix("m.").rstrip("/")


def bucket(url: str) -> int:
    return zlib.crc32(key(url).encode()) % BUCKETS


def _parsed(value):
    """HPLT writes lists and dicts as Python literals inside JSON strings."""
    return ast.literal_eval(value) if isinstance(value, str) else value


def keep(doc: dict) -> tuple[dict | None, str]:
    """The row to keep for one HPLT document, or None and the reason it is dropped."""
    if doc["filter"] != "keep":
        return None, "filtered by HPLT"
    if _parsed(doc["lang"])[0] != LANGUAGE or float(_parsed(doc["prob"])[0]) < SURE:
        return None, "language unsure"
    registers = sorted(label for label, p in _parsed(doc.get("web-register", {})).items() if p >= SURE)
    if "MT" in registers:
        return None, "machine translated"
    crawled = date.fromisoformat(doc["ts"][:10])
    row = {
        "url": doc["u"],
        "crawled": crawled,
        "address_date": address_date(doc["u"], crawled),
        "text_date": text_date(doc["text"], crawled),
        "registers": registers,
        "text": doc["text"],
    }
    return (row, "kept") if row["address_date"] or row["text_date"] else (None, "undated")


def _files() -> list[str]:
    return requests.get(f"{RELEASE}/{LANGUAGE}.map", timeout=60).text.split()


class _Download(io.RawIOBase):
    """A remote file read front to back, picking up where it was when the connection drops."""

    def __init__(self, url: str):
        self.url, self.at, self.size, self.response = url, 0, 0, None

    def readable(self) -> bool:
        return True

    def readinto(self, buffer) -> int:
        for attempt in range(TRIES):
            try:
                if self.response is None:
                    headers = {"Range": f"bytes={self.at}-"}
                    self.response = requests.get(self.url, stream=True, timeout=(30, 300), headers=headers)
                    self.response.raise_for_status()
                    self.size = self.at + int(self.response.headers["Content-Length"])
                n = self.response.raw.readinto(buffer)
                if n == 0 and self.at < self.size:
                    raise OSError("the stream ended early")
                self.at += n
                return n
            except (requests.RequestException, urllib3.exceptions.HTTPError, OSError):
                self.response = None
                time.sleep(min(60, 2**attempt))
        raise OSError(f"gave up on {self.url} at byte {self.at}")


def _documents(url: str) -> Iterator[dict]:
    reader = zstandard.ZstdDecompressor().stream_reader(_Download(url))
    for line in io.TextIOWrapper(reader, encoding="utf-8"):
        yield json.loads(line)


def _fetch_file(url: str) -> Counter:
    """Stream one file of the release into the buckets; resumable file by file."""
    name = url.rsplit("/", 1)[1].removesuffix(".jsonl.zst")
    done = PAGES / f"{name}.done"
    if done.exists():
        return Counter(json.loads(done.read_text()))
    for stale in PAGES.glob(f"*/{name}-*.parquet"):
        stale.unlink()
    outcome, held, part = Counter(), [[] for _ in range(BUCKETS)], 0

    def flush() -> None:
        nonlocal part
        for b, rows in enumerate(held):
            if rows:
                path = PAGES / f"{b:03d}" / f"{name}-{part:04d}.parquet"
                path.parent.mkdir(parents=True, exist_ok=True)
                pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), path, compression="zstd")
                rows.clear()
        part += 1

    for doc in _documents(url):
        row, why = keep(doc)
        outcome[why] += 1
        if row:
            held[bucket(row["url"])].append(row)
            if outcome["kept"] % FLUSH == 0:
                flush()
    flush()
    done.write_text(json.dumps(outcome))
    print(name, dict(outcome), flush=True)
    return outcome


def fetch() -> None:
    PAGES.mkdir(parents=True, exist_ok=True)
    print(dict(sum(parallel(_fetch_file, _files()), Counter())))


def buckets() -> list[int]:
    return [b for b in range(BUCKETS) if (PAGES / f"{b:03d}").exists()]


def pages(b: int, columns: list[str] | None = None) -> Iterator[dict]:
    """One bucket's pages, each address once: its earliest capture, which is the closest to when it was written.

    The addresses are read first and the pages after, one file at a time: a bucket of text is gigabytes.
    """
    files = sorted((PAGES / f"{b:03d}").glob("*.parquet"))
    first: dict[str, tuple[date, int, int]] = {}  # key -> (crawled, file, row) of its earliest capture
    for f, path in enumerate(files):
        table = pq.read_table(path, columns=["url", "crawled"])
        for r, (url, crawled) in enumerate(zip(table["url"].to_pylist(), table["crawled"].to_pylist())):
            if (k := key(url)) not in first or crawled < first[k][0]:
                first[k] = (crawled, f, r)
    chosen = {(f, r) for _, f, r in first.values()}
    for f, path in enumerate(files):
        rows = pq.read_table(path, columns=columns and sorted({*columns, "url", "crawled"})).to_pylist()
        yield from (row for r, row in enumerate(rows) if (f, r) in chosen)


def _census_bucket(b: int) -> tuple[Counter, Counter]:
    registers, publishers = Counter(), Counter()
    for row in pages(b, ["address_date", "text_date", "registers"]):
        a, t = row["address_date"], row["text_date"]
        year = (a or t).year
        late = min(row["crawled"].year - year, LATE)  # years between the page's date and its capture
        agree = "" if not (a and t) else "same year" if a.year == t.year else "other year"
        for register in row["registers"] or ["none"]:
            registers[register, year, "address" if a else "text", agree, late] += 1
        publishers[web.publisher(row["url"]), year, "ne" in (row["registers"] or ())] += 1
    return registers, publishers


def _table(counts: Counter, names: list[str]) -> pa.Table:
    return pa.Table.from_pylist([dict(zip(names, (*k, n))) for k, n in counts.items()])


def census() -> None:
    """Count the kept pages by register, year and how they were dated, and by publisher: what the lenses rest on."""
    registers, publishers = Counter(), Counter()
    for r, p in parallel(_census_bucket, buckets()):
        registers += r
        publishers += p
    out = ROOT / "census"
    out.mkdir(exist_ok=True)
    pq.write_table(
        _table(registers, ["register", "year", "dated_by", "dates", "late", "pages"]), out / "registers.parquet"
    )
    pq.write_table(_table(publishers, ["publisher", "year", "news", "pages"]), out / "publishers.parquet")
    print(f"{publishers.total():,} pages")


def lens_of(row: dict) -> tuple[str, date] | None:
    """The lens a page belongs to and the day it is dated to, if it has both."""
    labels = set(row["registers"] or ())
    blog = web.publisher(row["url"]) in BLOG_PLATFORMS
    if "ne" in labels and not blog:
        return NEWS, row["address_date"] or row["text_date"]
    if (blog or labels & {"nb", "ob"}) and row["address_date"]:
        return BLOGS, row["address_date"]
    return None


def _line_ids(b: int) -> np.ndarray:
    rows = pages(b, ["registers", "address_date", "text_date", "text"])
    return np.array(
        [i for row in rows if lens_of(row) for i in web.lines(web.publisher(row["url"]), row["text"])], np.uint64
    )


def find_furniture() -> None:
    np.save(FURNITURE, web.repeated(parallel(_line_ids, buckets())))


@cache
def _furniture() -> frozenset[int]:
    return frozenset(np.load(FURNITURE).tolist())


def page_id(url: str) -> int:
    return int.from_bytes(hashlib.blake2b(key(url).encode(), digest_size=8).digest())


@cache
def _copies() -> np.ndarray:
    return np.load(COPIES)


def _is_copy(url: str) -> bool:
    at = np.searchsorted(_copies(), np.uint64(page_id(url)))
    return at < len(_copies()) and int(_copies()[at]) == page_id(url)


def _bodies(b: int, with_copies: bool = False) -> Iterator[tuple[dict, str, date, str]]:
    """The pages of one bucket that belong to a lens: (page, lens, day, text cleared of furniture). Pages that
    repeat an earlier page of their publisher are left out, unless asked for."""
    for row in pages(b):
        if (found := lens_of(row)) and (with_copies or not _is_copy(row["url"])):
            yield row, *found, web.body(web.publisher(row["url"]), row["text"], _furniture())


def _signatures(b: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict[int, tuple[str, int]]]:
    """For every lens page of a bucket: its id, the day it is dated to, its keys, and a number for its publisher
    and year, with what those numbers stand for."""
    ids, days, keys, spots, names = [], [], [], [], {}
    for row, _, day, body in _bodies(b, with_copies=True):
        source = web.publisher(row["url"])
        ids.append(page_id(row["url"]))
        days.append(day.toordinal())
        keys.append(web.signature(source, [word for run in web.runs(body) for word, _ in run]))
        spots.append(zlib.crc32(source.encode()) * 10_000 + day.year)
        names[spots[-1]] = (source, day.year)
    keys = np.array(keys, np.uint64).reshape(-1, web.BANDS + 1)
    return np.array(ids, np.uint64), np.array(days, np.int64), keys, np.array(spots, np.int64), names


def find_copies() -> None:
    """Of the pages of a publisher that say the same thing, all but the earliest are copies."""
    parts = list(zip(*parallel(_signatures, buckets())))
    ids, days, keys, spots = (np.concatenate(part) for part in parts[:4])
    names = {spot: name for part in parts[4] for spot, name in part.items()}
    rank = np.empty(len(ids), np.int64)
    rank[np.lexsort((ids, days))] = np.arange(len(ids))
    copy = web.copies(rank, keys)
    np.save(COPIES, np.sort(ids[copy]))
    seen, left_out = (dict(zip(*np.unique(found, return_counts=True))) for found in (spots, spots[copy]))
    rows = [
        {"publisher": names[s][0], "year": names[s][1], "pages": int(n), "copies": int(left_out.get(s, 0))}
        for s, n in seen.items()
    ]
    pq.write_table(pa.Table.from_pylist(rows), ROOT / "census" / "copies.parquet")
    print(f"{copy.sum():,} of {len(ids):,} pages repeat an earlier page of their publisher")
    for publisher in sorted(KEPT):
        mine = [r for r in rows if r["publisher"] == publisher]
        print(f"  {publisher}: {sum(r['copies'] for r in mine):,} of {sum(r['pages'] for r in mine):,}")


@cache
def _candidates() -> frozenset[str]:
    return phrases.candidates(wikipedia.titles())


def _phrase_counts(b: int) -> Counter:
    sample = (body for row, _, _, body in _bodies(b) if zlib.crc32(row["url"].encode()) % LEARN_FROM == 0)
    return phrases.count((run for body in sample for run in web.runs(body)), _candidates())


def find_phrases() -> None:
    """Learn the phrases from one page in LEARN_FROM."""
    found = phrases.learn(sum(parallel(_phrase_counts, buckets()), Counter()))
    PHRASES.write_text("".join(f"{phrase}\n" for phrase in sorted(found)))
    print(f"{len(found):,} phrases")


@cache
def _phrases() -> frozenset[str]:
    return frozenset(PHRASES.read_text().splitlines())


def _write(b: int) -> int:
    """One bucket's units, in shards named by lens and year: shards sorted by name are then in time order."""
    held: dict[tuple[str, int], list[Unit]] = defaultdict(list)
    written, part = 0, 0
    for row, lens, day, body in _bodies(b):
        counts, caps = web.bag(body, _phrases())
        if counts.total() >= MIN_WORDS:
            source = web.publisher(row["url"])
            held[lens, day.year].append(Unit(f"{source}/{day}", source, day.year, counts, caps))
        if sum(map(len, held.values())) == FLUSH_UNITS:
            written += sum(
                write_shard(lens, f"{year}-{b:03d}-{part:02d}", units) for (lens, year), units in held.items()
            )
            held.clear()
            part += 1
    return written + sum(write_shard(lens, f"{year}-{b:03d}-{part:02d}", units) for (lens, year), units in held.items())


def _keep_text(b: int) -> int:
    """The text of one bucket's pages of the publishers in KEPT, one file per publisher."""
    held: dict[str, list[dict]] = defaultdict(list)
    for row, lens, day, body in _bodies(b):
        if lens == NEWS and (source := web.publisher(row["url"])) in KEPT:
            held[source].append({"url": row["url"], "day": day, "text": body})
    for source, rows in held.items():
        path = TEXT / source / f"{b:03d}.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(pa.Table.from_pylist(rows), path, compression="zstd", compression_level=12)
    return sum(map(len, held.values()))


def keep_text() -> None:
    print(sum(parallel(_keep_text, buckets())), "pages kept as text")


def build_units() -> None:
    clear(NEWS)
    clear(BLOGS)
    print(sum(parallel(_write, buckets())), "units")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "census", "furniture", "phrases", "copies", "units", "text"])
    steps = {
        "fetch": fetch,
        "census": census,
        "furniture": find_furniture,
        "phrases": find_phrases,
        "copies": find_copies,
        "units": build_units,
        "text": keep_text,
    }
    steps[parser.parse_args().step]()
