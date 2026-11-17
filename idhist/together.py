"""Plain page counts for the stories and games of the site: nothing here is a score.

    python -m idhist.together      # what site/together.json asks for

Four small tables, each a count anyone can check against data/counts:

together.json   of the pages that contain one word, the share that also contain another, per period
                "<lens>/<word>": {"periods", "pages": [...], "with": {"<other>": [share, null below MIN_PAGES]},
                                  "off": {"<other>": [half-width of the share's 95% interval]},
                                  "all": {"<other>": [its share of all pages]}}
                The interval comes from the six folds the counts are kept in (each day of a publisher falls in
                one): the share is recomputed with each fold left out, so pages of one day stand or fall together.
<lens>/stick.json   the same for every person and organisation of a lens against a fixed list of words
                {"words", "names", "kinds", "pages": [name][period], "share": {word: [name][period] in per mille},
                 "beside": [name][period] -> [[other name, per mille of this name's pages], ...]}
years.json      year by year, the share of a publisher's pages that contain a word (the counts keep years
                even where a lens has longer periods): {"years", "pages": {lens: [...]}, "share": {word: {lens: [...]}}}
                and "tide": per lens, the names that were on the most pages in their best year
stopped.json    words (names left out) that fell or rose between two periods in every lens asked, ranked by
                the least the change is likely to be ("least": the low end of its 95% interval) in the lens
                where it is smallest: no single publisher, and no handful of pages, can make the list

The second word of a pair has to be one of the lens's context words; one that is not is left out.
"""

import json
from functools import partial
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

from idhist.counts import ROOT, Counts
from idhist.lenses import LENSES

ASKED = Path("site/together.json")
SITE = Path("site/data")
MIN_PAGES = 80  # with fewer pages than this in a period, a share is not given
STICK_PAGES = 300  # a name is in stick.json if some period has this many pages naming it
MIN_SHARE = 0.002  # a word can be said to have fallen only from at least this share of pages, in every lens
LISTED = 30  # words per list in stopped.json
TIDE = 60  # names per lens and kind in the tide table
BESIDE = 8  # other names kept per name and period
CHUNK = 200  # names whose company is read at a time
T95 = 2.571  # Student's t for 95% with five degrees of freedom: six folds, one left out at a time


def interval(part: np.ndarray, whole: np.ndarray, least: int = MIN_PAGES) -> tuple[np.ndarray, np.ndarray]:
    """`part` as a share of `whole`, both counted per fold along the last axis, and how far that share may be off
    (the half-width of a 95% interval): it is worked out again with each fold of days left out in turn, so that
    pages of one day stand or fall together. NaN where `whole` has fewer than `least` pages."""
    n, k = whole.sum(-1), whole.shape[-1]
    with np.errstate(invalid="ignore", divide="ignore"):
        share = np.where(n >= least, part.sum(-1) / n, np.nan)
        left = (part.sum(-1, keepdims=True) - part) / (n[..., None] - whole)
        spread = np.sqrt((k - 1) / k * ((left - left.mean(-1, keepdims=True)) ** 2).sum(-1))
    return share, np.where(np.isnan(share), np.nan, T95 * spread)


def _shares(counts: Counts, words: list[int], columns: list[int]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Pages per (word, period); the share of them that hold each column's word, (word, period, column); and how
    far that share may be off."""
    pages = counts.df[:, :, words].transpose(2, 0, 1).astype(float)  # word, period, fold
    both = np.concatenate(
        [counts.cooc(words[i : i + CHUNK])[:, :, :, columns] for i in range(0, len(words), CHUNK)], 2
    ).transpose(2, 0, 3, 1)  # word, period, column, fold
    share, off = interval(both, pages[:, :, None, :])
    return pages.sum(2).astype(int), share, off


def _listed(x: np.ndarray, digits: int = 4) -> list:
    return [None if np.isnan(v) else round(float(v), digits) for v in x]


def together(asked: list[dict]) -> None:
    found = {}
    for ask in asked:
        counts = Counts(LENSES[ask["lens"]])
        if ask["word"] not in counts.row:
            continue
        others = [w for w in ask["with"] if w in counts.contexts]
        pages, share, off = _shares(counts, [counts.row[ask["word"]]], [counts.contexts.index(w) for w in others])
        everywhere = (
            counts.df.sum(1) / counts.units.sum(1)[:, None]
        )  # of all pages of a period, the share with each word
        found[f"{ask['lens']}/{ask['word']}"] = {
            "periods": [str(a) if a == b else f"{a}-{b}" for a, b in counts.lens.periods],
            "pages": pages[0].tolist(),
            "with": {w: _listed(share[0, :, k]) for k, w in enumerate(others)},
            "off": {w: _listed(off[0, :, k]) for k, w in enumerate(others)},
            "all": {w: _listed(everywhere[:, counts.row[w]]) for w in others},
        }
    (SITE / "together.json").write_text(json.dumps(found, separators=(",", ":")))
    print(f"{len(found)} words with their company counted")


def _fragments(meta: dict) -> set[int]:
    """One-word names that are the first word of somebody else's longer name ("hatta" beside "hatta rajasa", when
    Wikipedia files the two under different people). The news calls people by that first word, so such a word
    counts pages about someone other than its own article: it is left out of tables of people."""
    people = {int(i): meta["entities"][i] for i, kind in meta["kinds"].items() if kind == "person"}
    first_of = {}
    for i, article in people.items():
        tokens = meta["words"][i].split()
        if len(tokens) > 1:
            first_of.setdefault(tokens[0], set()).add(article)
    return {i for i, article in people.items() if first_of.get(meta["words"][i], set()) - {article}}


def _first_spellings(row: np.ndarray, others: list[int], article: list[str]) -> list[list[int]]:
    """The BESIDE other names on the largest share of a name's pages, each person or body under one spelling only."""
    kept, seen = [], set()
    for c in np.argsort(-np.nan_to_num(row)):
        if len(kept) == BESIDE or not row[c] > 0:
            break
        if article[others[c]] not in seen:
            seen.add(article[others[c]])
            kept.append([others[c], round(1000 * float(row[c]))])
    return kept


def stick(lenses: list[str], words: list[str]) -> None:
    for name in lenses:
        counts, meta = Counts(LENSES[name]), json.loads((SITE / name / "meta.json").read_text())
        fragments = _fragments(meta)
        kinds = {int(i): k for i, k in meta["kinds"].items() if k != "place" and int(i) not in fragments}
        names = [i for i in sorted(kinds) if counts.df.sum(1)[:, i].max() >= STICK_PAGES]
        kept = [w for w in words if w in counts.contexts]
        pages, share, _ = _shares(counts, names, [counts.contexts.index(w) for w in kept])
        # Who shares a page with whom: for each name and period, the BESIDE other names on the largest share of its pages.
        others = [k for k, i in enumerate(names) if counts.own[i] >= 0]
        _, among, _ = _shares(counts, names, [int(counts.own[names[k]]) for k in others])
        article = [meta["entities"].get(str(i)) for i in names]
        for k, c in ((k, c) for k in range(len(names)) for c, o in enumerate(others) if article[k] == article[o]):
            among[k, :, c] = np.nan  # not itself, under this name or another ("jokowi", "joko widodo")
        beside = [[_first_spellings(row, others, article) for row in name] for name in among]
        (SITE / name / "stick.json").write_text(json.dumps({
            "words": kept, "names": [counts.words[i] for i in names], "kinds": [kinds[i][0] for i in names], "pages": pages.tolist(), "beside": beside,
            "share": {w: [[None if np.isnan(v) else round(1000 * float(v)) for v in row] for row in share[:, :, k]] for k, w in enumerate(kept)},
        }, separators=(",", ":")))  # fmt: skip
        print(f"{name}: {len(names)} names against {len(kept)} words")


def _yearly(name: str) -> tuple[dict[int, int], dict[str, dict[int, int]]]:
    """Pages per year of a lens, and per word the pages per year that contain it."""
    total, by = {}, {}
    for row in pq.read_table(ROOT / name / "freq.parquet").to_pylist():
        if row["word"]:
            by.setdefault(row["word"], {})[row["year"]] = row["units"]
        else:
            total[row["year"]] = row["units"]
    return total, by


def _series(total: dict, by: dict, span: list[int], word: str) -> list[float | None]:
    return [round(by.get(word, {}).get(y, 0) / total[y], 5) if total.get(y) else None for y in span]


def years(lenses: list[str], words: list[str], span: list[int]) -> None:
    span = list(range(span[0], span[1] + 1))
    out = {"years": span, "pages": {}, "share": {w: {} for w in words}, "tide": {}}
    for name in lenses:
        total, by = _yearly(name)
        series = partial(_series, total, by, span)
        out["pages"][name] = [total.get(y, 0) for y in span]
        for w in words:
            out["share"][w][name] = series(w)
        meta = json.loads((SITE / name / "meta.json").read_text())
        fragments = _fragments(meta)
        best, seen = [], set()  # the best year of each name, one spelling per Wikipedia article: the most frequent
        peaks = ((max(v for v in series(meta["words"][int(i)]) if v is not None), i) for i in meta["kinds"])
        for _, i in sorted(peaks, reverse=True):
            if meta["entities"][i] not in seen and int(i) not in fragments:
                seen.add(meta["entities"][i])
                best.append((meta["words"][int(i)], meta["kinds"][i]))
        out["tide"][name] = {
            kind: [{"word": w, "share": series(w)} for w, k in best if k == kind][:TIDE]
            for kind in ("person", "organisation", "place")
        }
    (SITE / "years.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(words)} words year by year in {len(lenses)} lenses")


def _times_at_least(c: Counts, words: list[int], old: int, new: int) -> tuple[np.ndarray, np.ndarray]:
    """How many times larger a word's share of pages is in period `old` than in `new`, and the least that ratio
    is likely to be (the low end of its 95% interval, from leaving out each fold of days in turn)."""
    df, units = c.df[:, :, words].astype(float), c.units.astype(float)[:, :, None]  # period, fold, word

    def log_ratio(df: np.ndarray, units: np.ndarray) -> np.ndarray:  # half a page added, so that none is not zero
        share = (df + 0.5) / (units + 1)
        return np.log(share[old] / share[new])

    whole = log_ratio(df.sum(1), units.sum(1))
    left = log_ratio(df.sum(1, keepdims=True) - df, units.sum(1, keepdims=True) - units)  # fold, word
    k = left.shape[0]
    spread = np.sqrt((k - 1) / k * ((left - left.mean(0)) ** 2).sum(0))
    return np.exp(whole), np.exp(whole - T95 * spread)


def stopped(lenses: list[str]) -> None:
    counts = [Counts(LENSES[name]) for name in lenses]
    metas = [json.loads((SITE / name / "meta.json").read_text()) for name in lenses]
    names = {m["words"][int(i)] for m in metas for i in [*m["names"], *m["entities"]]}
    common = sorted(set.intersection(*(set(c.words) for c in counts)) - names)
    rows = [[c.row[w] for w in common] for c in counts]
    share = np.stack(
        [(c.df.sum(1) / c.units.sum(1)[:, None])[:, r] for c, r in zip(counts, rows)]
    )  # lens, period, word
    out = {
        "lenses": lenses,
        "periods": metas[0]["periods"],
        "pages": [c.units.sum(1).tolist() for c in counts],
        "fell": {},
        "rose": {},
    }
    for a, b in [(0, 1), (1, 2), (0, 2)]:
        for key, (old, new) in {"fell": (a, b), "rose": (b, a)}.items():
            times, least = (np.stack(x) for x in zip(*(_times_at_least(c, r, old, new) for c, r in zip(counts, rows))))
            # Ranked by the least the change is likely to be in the lens where it is smallest: a word cannot
            # top the list on one publisher, nor on a ratio that a few pages more or fewer would undo.
            rank = np.where((share[:, old] >= MIN_SHARE).all(0), least.min(0), 0)
            out[key][f"{a}-{b}"] = [
                {
                    "word": common[i],
                    "times": round(float(times[:, i].min()), 1),
                    "least": round(float(rank[i]), 1),
                    "share": [
                        [round(float(share[k, a, i]), 5), round(float(share[k, b, i]), 5)] for k in range(len(lenses))
                    ],
                }
                for i in np.argsort(-rank)[:LISTED]
                if rank[i] >= 1.5
            ]
    (SITE / "stopped.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(common)} words compared across {len(lenses)} lenses")


if __name__ == "__main__":
    asked = json.loads(ASKED.read_text())
    together(asked["together"])
    stick(asked["stick"]["lenses"], asked["stick"]["words"])
    years(asked["years"]["lenses"], asked["years"]["words"], asked["years"]["span"])
    stopped(asked["stick"]["lenses"])
