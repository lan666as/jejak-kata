"""Counts that need the text itself: a phrase, one word only where another stands, month by month.

    python -m idhist.pages            # every question in site/pages.json
    python -m idhist.pages oknum      # one of them
    python -m idhist.pages read oknum polisi+salah oknum 200    # 200 places to read: pages of the question "oknum"
                                      # that match "polisi" and "salah", shown around their first "oknum"

The counts under data/counts know which words share a page, for the words of a lens and by year. What they
cannot answer (a phrase that is not a Wikipedia title, three things on one page, a count by month) is counted
here, from the text kept of the publishers read one at a time (`idhist/sources/hplt.py`, KEPT).

A question in site/pages.json:

    {"name": "oknum", "publishers": ["kompas.com", "tempo.co"], "by": "year", "first": "2011-01", "last": "2024-12",
     "patterns": {"oknum": "\\\\boknum\\\\b", "polisi": "\\\\bpolisi\\\\b"},
     "shares": [["polisi", "oknum"], ["*", "oknum"]]}

Patterns are regular expressions on the page in lower case. Each share is, of the pages that match the first
name ("*" is every page; "a+b" pages that match both), the part that also matches the second. The answer,
site/data/pages/<name>.json: {"periods", "publishers", "pages": {of: [publisher][period]},
"share": {"of|with": [publisher][period]}, "off": the same shape}; `off` is the half-width of the share's 95%
interval, from the same six folds of days as everywhere else (`together.interval`).

A count of pages says two patterns share a page, not that one is said of the other. `read` draws places at
random (the same ones every time) into data/read/<name>.tsv, to be read by a person: what share of them mean
what the story says is the precision the story states.
"""

import json
import random
import re
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

from idhist import parallel
from idhist.counts import FOLDS, fold_of
from idhist.sources.hplt import TEXT
from idhist.together import interval

ASKED = Path("site/pages.json")
SITE = Path("site/data/pages")
MIN_PAGES = 50  # with fewer pages than this in a period, a share is not given
READ_FROM = 8  # places to read are drawn from one file of the kept text in this many
AROUND = 260  # characters shown before and after a place


def periods(first: str, last: str, by: str) -> list[str]:
    """The labels of the periods from `first` to `last`, both "YYYY-MM": years, months, or the whole span as one."""
    (y0, m0), (y1, m1) = (map(int, x.split("-")) for x in (first, last))
    if by == "span":
        return [f"{y0}–{y1}"]
    if by == "year":
        return [str(y) for y in range(y0, y1 + 1)]
    return [f"{y}-{m:02d}" for y in range(y0, y1 + 1) for m in range(1, 13) if (y0, m0) <= (y, m) <= (y1, m1)]


def _tally(job: tuple[Path, str, dict[str, str], list[str], str, str, str]) -> np.ndarray:
    """One file of one publisher: pages by [period, fold, which patterns match] (the last as bits)."""
    path, publisher, patterns, labels, by, first, last = job
    found, at = [re.compile(p) for p in patterns.values()], {label: i for i, label in enumerate(labels)}
    table = pq.read_table(path, columns=["day", "text"])
    tally = np.zeros((len(labels), FOLDS, 2 ** len(found)), np.int64)
    for day, text in zip(table["day"].to_pylist(), table["text"].to_pylist()):
        month = f"{day.year}-{day.month:02d}"
        period = 0 if by == "span" else at.get(str(day.year) if by == "year" else month)
        if period is not None and first <= month <= last:
            text = text.lower()
            match = sum(1 << i for i, pattern in enumerate(found) if pattern.search(text))
            tally[period, fold_of(f"{publisher}/{day}"), match] += 1
    return tally


def _matching(tally: np.ndarray, names: list[str], wanted: str) -> np.ndarray:
    """Pages [period, fold] that match every pattern named in `wanted` ("a+b"; "*" is every page)."""
    need = 0 if wanted == "*" else sum(1 << names.index(name) for name in wanted.split("+"))
    return tally[:, :, [m for m in range(tally.shape[2]) if m & need == need]].sum(2)


def answer(ask: dict) -> dict:
    labels, names = periods(ask["first"], ask["last"], ask["by"]), list(ask["patterns"])
    out = {"periods": labels, "publishers": ask["publishers"], "pages": {}, "share": {}, "off": {}}
    for publisher in ask["publishers"]:
        span = (ask["by"], ask["first"], ask["last"])
        jobs = [(path, publisher, ask["patterns"], labels, *span) for path in sorted((TEXT / publisher).glob("*"))]
        tally = sum(parallel(_tally, jobs))
        for of, part in ask["shares"]:
            whole = _matching(tally, names, of)
            both = _matching(tally, names, part if of == "*" else f"{of}+{part}")
            share, off = interval(both.astype(float), whole.astype(float), MIN_PAGES)
            if (
                len(out["pages"].setdefault(of, [])) < len(out["share"].get(f"{of}|{part}", [])) + 1
            ):  # once per publisher
                out["pages"][of].append(whole.sum(1).tolist())
            for kind, values in (("share", share), ("off", off)):
                listed = [None if np.isnan(v) else round(float(v), 4) for v in values]
                out[kind].setdefault(f"{of}|{part}", []).append(listed)
    return out


def read(ask: dict, of: str, show: str, n: int) -> list[str]:
    """`n` places, drawn evenly from the pages that match every pattern named in `of`: publisher, day, and the
    text around the first match of the pattern `show`."""
    need, shown = [re.compile(ask["patterns"][name]) for name in of.split("+")], re.compile(ask["patterns"][show])
    places, seen, rng = [], 0, random.Random(0)
    for publisher in ask["publishers"]:
        for path in sorted((TEXT / publisher).glob("*"))[::READ_FROM]:
            table = pq.read_table(path, columns=["day", "text"])
            for day, text in zip(table["day"].to_pylist(), table["text"].to_pylist()):
                low = text.lower()
                dated = ask["first"] <= f"{day.year}-{day.month:02d}" <= ask["last"]
                if dated and all(p.search(low) for p in need) and (at := shown.search(low)):
                    seen += 1
                    around = " ".join(text[max(0, at.start() - AROUND) : at.end() + AROUND].split())
                    if len(places) < n:
                        places.append(f"{publisher}\t{day}\t{around}")
                    elif (k := rng.randrange(seen)) < n:
                        places[k] = f"{publisher}\t{day}\t{around}"
    return places


if __name__ == "__main__":
    if sys.argv[1:2] == ["read"]:
        name, of, show, n = sys.argv[2:6]
        ask = next(ask for ask in json.loads(ASKED.read_text()) if ask["name"] == name)
        Path("data/read").mkdir(parents=True, exist_ok=True)
        Path(f"data/read/{name}.tsv").write_text("\n".join(read(ask, of, show, int(n))) + "\n")
        sys.exit()
    SITE.mkdir(parents=True, exist_ok=True)
    for ask in json.loads(ASKED.read_text()):
        if len(sys.argv) < 2 or ask["name"] in sys.argv[1:]:
            (SITE / f"{ask['name']}.json").write_text(json.dumps(answer(ask), separators=(",", ":")))
            print(f"{ask['name']}: {len(ask['shares'])} shares in {len(ask['publishers'])} publishers")
