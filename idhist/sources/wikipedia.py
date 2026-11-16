"""The titles of Indonesian Wikipedia, and the article each one leads to.

    python -m idhist.sources.wikipedia fetch
    python -m idhist.sources.wikipedia titles

Wikipedia is used here as a public inventory of things that have a name. It
answers two questions that the texts themselves cannot: which words belong
together (`ibu kota`, `tol laut`, `Joko Widodo` are titles), and which names
are public (a person with an article is a public figure; a name that occurs
only in news reports is not shown).

Redirects are kept with their target, so that `Presiden Joko Widodo` is known
to be another way of saying `Joko Widodo`.

What kind of thing an article is about comes from Wikidata, by three plain
rules: an instance of human is a person; otherwise something with a
headquarters is an organisation; otherwise something with coordinates is a
place. Everything else has no kind. Wikidata is asked only about the articles
that the export shows as names, and every answer is kept (`kinds`).
"""

import argparse
import gzip
import re
import time
from collections.abc import Iterable
from functools import cache
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import requests

ROOT = Path("data/raw/wikipedia")
DUMP = "20261001"
TITLES = ROOT / f"idwiki-{DUMP}-titles.parquet"
KINDS = ROOT / f"idwiki-{DUMP}-kinds.parquet"
WIKIDATA = "https://www.wikidata.org/w/api.php"
AGENT = {"User-Agent": "idhist/0.1"}  # Wikimedia refuses clients that do not name themselves
BATCH = 50  # titles per request, the most the API takes
TRIES = 20

_PAGE = re.compile(rb"\((\d+),0,'((?:[^'\\]|\\.)*)',")  # id, namespace 0, title
_REDIRECT = re.compile(rb"\((\d+),0,'((?:[^'\\]|\\.)*)',")  # from id, namespace 0, target title


def _table(name: str) -> Path:
    return ROOT / f"idwiki-{DUMP}-{name}.sql.gz"


def fetch() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name in ("page", "redirect"):
        url = f"https://dumps.wikimedia.org/idwiki/{DUMP}/{_table(name).name}"
        with requests.get(url, stream=True, timeout=60, headers=AGENT) as r:
            r.raise_for_status()
            with open(_table(name), "wb") as out:
                out.writelines(r.iter_content(1 << 20))


def _rows(name: str, pattern: re.Pattern) -> dict[int, str]:
    found = {}
    with gzip.open(_table(name)) as lines:
        for line in lines:
            for m in pattern.finditer(line):  # rows come one per line or many, depending on the dump
                title = re.sub(rb"\\(.)", rb"\1", m[2]).decode("utf-8", "replace")
                found[int(m[1])] = title.replace("_", " ")
    return found


def build_titles() -> None:
    """Write every title in lower case with the title of the article it leads to."""
    pages, redirects = _rows("page", _PAGE), _rows("redirect", _REDIRECT)
    leads_to = {title.lower(): redirects.get(page, title) for page, title in pages.items()}
    table = pa.table({"title": list(leads_to), "article": list(leads_to.values())})
    pq.write_table(table, TITLES, compression="zstd")
    print(f"{len(leads_to):,} titles, {len(redirects):,} of them redirects")


@cache
def titles() -> dict[str, str]:
    """Lower-cased title -> the article it leads to."""
    table = pq.read_table(TITLES)
    return dict(zip(table["title"].to_pylist(), table["article"].to_pylist()))


def _kind(claims: dict) -> str | None:
    instance_of = {c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in claims.get("P31", [])}
    if "Q5" in instance_of:
        return "person"
    return "organisation" if "P159" in claims else "place" if "P625" in claims else None


def _ask(query: dict) -> dict:
    """One answer from Wikidata, waiting as long as it says when it says to slow down."""
    for _ in range(TRIES):
        response = requests.get(WIKIDATA, params=query, headers=AGENT, timeout=120)
        if response.status_code != 429:
            response.raise_for_status()
            return response.json()
        time.sleep(int(response.headers.get("Retry-After", 30)))
    raise OSError("Wikidata kept asking to slow down")


def kinds(articles: Iterable[str]) -> dict[str, str]:
    """`person`, `place` or `organisation` for those of the articles that are one. Each article is asked about once."""
    known = {}
    if KINDS.exists():
        table = pq.read_table(KINDS)
        known = dict(zip(table["article"].to_pylist(), table["kind"].to_pylist()))
    new = sorted(set(articles) - known.keys())
    for start in range(0, len(new), BATCH):
        asked = new[start : start + BATCH]
        query = {"action": "wbgetentities", "sites": "idwiki", "titles": "|".join(asked)}
        query |= {"props": "claims|sitelinks", "sitefilter": "idwiki", "format": "json"}
        answers = _ask(query)["entities"].values()
        found = {e["sitelinks"]["idwiki"]["title"]: _kind(e["claims"]) or "" for e in answers if "claims" in e}
        known |= dict.fromkeys(asked, "") | found
    if new:
        pq.write_table(pa.table({"article": list(known), "kind": list(known.values())}), KINDS)
    return {article: known[article] for article in articles if known[article]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "titles"])
    {"fetch": fetch, "titles": build_titles}[parser.parse_args().step]()
