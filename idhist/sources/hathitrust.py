"""HathiTrust Extracted Features: per-page word counts for dated volumes.

    python -m idhist.sources.hathitrust fetch      # rsync the word counts of the manifest's volumes
    python -m idhist.sources.hathitrust units      # convert them to units, for every lens
    python -m idhist.sources.hathitrust units jv-books su-books    # or for some

Which volumes is fixed by manifests/hathitrust.tsv, which is part of the
repository because HathiTrust replaces its catalogue dump (the "Hathifile")
every month. To refresh it from a newer dump:

    python -m idhist.sources.hathitrust manifest hathi_full_YYYYMMDD.txt.gz

Extracted Features are CC BY 4.0 and are fetched through HTRC's documented
rsync service, never over HTTP (the data host's robots.txt disallows crawling).
"""

import argparse
import bz2
import csv
import gzip
import json
import subprocess
import sys
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

from idhist import WORKERS, text
from idhist.units import Unit, clear, write_shard

ROOT = Path("data/raw/hathitrust")
MANIFEST = Path("manifests/hathitrust.tsv")  # built from hathi_full_20261101.txt.gz
EF_DIR = ROOT / "ef"
RSYNC_MODULE = "data.analytics.hathitrust.org::features/"

# MARC language code of a volume -> (lens, language its pages must be in).
# The language of a page is decided here, from its words (`text.language`):
# HTRC's own page labels do not know Javanese or Sundanese, and leave about a
# seventh of the Indonesian text unlabelled.
LENSES = {"ind": ("id-books", "id"), "jav": ("jv-books", "jv"), "sun": ("su-books", "su")}
MIN_WORDS = 50  # pages with fewer words are title pages, tables and debris
SHARD_VOLUMES = 500
STREAMS = 6  # parallel rsync connections
YEARS = range(1800, 2026)

# Hathifile columns (https://www.hathitrust.org/member-libraries/resources-for-librarians/data-resources/hathifiles/hathifiles-description/)
COL = {"htid": 0, "access": 1, "bib": 3, "title": 11, "year": 16, "lang": 18, "fmt": 19}
FIELDS = ["htid", "lang", "year", "fmt", "access", "bib", "title"]


def ef_path(htid: str) -> str:
    """Path of a volume inside the rsync module ("stubbytree" layout)."""
    lib, local = htid.split(".", 1)
    clean = local.replace(":", "+").replace("/", "=").replace(".", ",")
    return f"{lib}/{clean[::3]}/{lib}.{clean}.json.bz2"


def build_manifest(hathifile: str) -> None:
    n = 0
    with (
        gzip.open(hathifile, "rt", encoding="utf-8", newline="") as src,
        open(MANIFEST, "w", encoding="utf-8", newline="") as dst,
    ):
        out = csv.writer(dst, delimiter="\t", quoting=csv.QUOTE_NONE, escapechar="\\")
        out.writerow(FIELDS)
        for line in src:
            row = line.rstrip("\n").split("\t")
            if row[COL["lang"]] not in LENSES or not row[COL["year"]].isdigit():
                continue
            if int(row[COL["year"]]) not in YEARS:
                continue
            out.writerow([row[COL[f]] for f in FIELDS])
            n += 1
    print(f"{MANIFEST}: {n} volumes")


def read_manifest() -> list[dict]:
    with open(MANIFEST, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE, escapechar="\\"))


def fetch() -> None:
    """Fetch every manifest volume not yet on disk. Safe to re-run."""
    EF_DIR.mkdir(parents=True, exist_ok=True)
    paths = [ef_path(r["htid"]) for r in read_manifest()]
    todo = [p for p in paths if not (EF_DIR / p).exists()]
    print(f"{len(paths) - len(todo)} present, {len(todo)} to fetch", flush=True)
    # Exit code 23 means some volumes are absent from the EF release; that is expected.
    jobs = []
    for i in range(STREAMS):
        listing = ROOT / f"fetch-list-{i}.txt"
        listing.write_text("\n".join(todo[i::STREAMS]) + "\n")
        jobs.append(
            subprocess.Popen(
                ["rsync", "-a", "--files-from", str(listing), RSYNC_MODULE, str(EF_DIR)],
                stderr=subprocess.DEVNULL,
            )
        )
    code = max(job.wait() for job in jobs)
    have = sum((EF_DIR / p).exists() for p in paths)
    print(f"rsync exit {code}; {have} of {len(paths)} manifest volumes on disk")
    if code not in (0, 23):
        sys.exit(code)


def volume_units(row: dict) -> list[Unit]:
    """Pages of one volume that are in the lens language, spelling modernised."""
    path = EF_DIR / ef_path(row["htid"])
    if not path.exists():
        return []
    wanted = LENSES[row["lang"]][1]
    try:
        with bz2.open(path) as f:
            volume = json.load(f)
    except (EOFError, OSError, ValueError) as e:
        raise RuntimeError(f"unreadable {path}: delete it and run the fetch step again") from e
    pages = []
    for page in volume["features"]["pages"]:
        counts, caps = Counter(), Counter()
        for token, by_pos in ((page.get("body") or {}).get("tokenPosCount") or {}).items():
            word = text.normalise(token)
            if word:
                n = sum(by_pos.values())
                counts[word] += n
                if token[0].isupper():
                    caps[word] += n
        if counts.total() >= MIN_WORDS and text.language(counts) == wanted:
            pages.append((counts, caps))
    if not pages:
        return []
    volume_counts = Counter()
    for counts, _ in pages:
        volume_counts.update(counts)
    old, oe = text.orthography(volume_counts)
    if old:
        pages = [(_respell(c, old, oe), _respell(k, old, oe)) for c, k in pages]
    return [Unit(row["htid"], row["fmt"], int(row["year"]), c, k) for c, k in pages]


def _respell(counts: Counter, old: bool, oe: bool) -> Counter:
    out = Counter()
    for word, n in counts.items():
        out[text.modernise(word, old, oe)] += n
    return out


def _write(job: tuple[str, str, list[dict]]) -> int:
    lens, shard, rows = job
    return write_shard(lens, shard, (u for row in rows for u in volume_units(row)))


def build_units(lenses: list[str]) -> None:
    jobs = []
    for lang, (lens, _) in LENSES.items():
        if lenses and lens not in lenses:
            continue
        clear(lens)
        rows = sorted((r for r in read_manifest() if r["lang"] == lang), key=lambda r: (r["year"], r["htid"]))
        jobs += [
            (lens, f"{i // SHARD_VOLUMES:04d}", rows[i : i + SHARD_VOLUMES]) for i in range(0, len(rows), SHARD_VOLUMES)
        ]
    with Pool(WORKERS) as pool:
        n = sum(pool.imap_unordered(_write, jobs))
    print(f"{n} units in {len(jobs)} shards")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["manifest", "fetch", "units"])
    parser.add_argument("arguments", nargs="*", help="manifest: the Hathifile; units: lenses (default: all)")
    args = parser.parse_args()
    steps = {
        "manifest": lambda: build_manifest(*args.arguments),
        "fetch": fetch,
        "units": lambda: build_units(args.arguments),
    }
    steps[args.step]()
