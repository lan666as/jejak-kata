"""Everything the site shows about a lens, as small static files.

    python -m idhist.export id-books
    python -m idhist.export id-books highlights    # only that file: minutes, where the rest takes much longer

Writes site/data/<lens>/:

    meta.json          periods, sizes, the vocabulary, which words are entries, and
                       what the planted-change test found this lens can see
                       (and site/data/lenses.json, the lenses exported so far)
    words/<n>.json     entries n*BUCKET .. (n+1)*BUCKET-1 of the vocabulary
    movers.json        the entries that shifted most between neighbouring periods
    highlights.json    per period, the words that belong to it more than to any other
                       (`peaks`); and per name, the adjectives that keep it company (`traits`)
    paths/<n>.json     for the entries of words/<n>.json: the words most like the entry in the first
                       and the last period, laid out on a plane, and where the entry stands among
                       them in each period

An entry holds, per period, the word's share of units, its strongest collocates
(`with`) and the words whose company is most like its own (`like`); and, per
pair of periods, its shift. Words are referred to by their vocabulary index.

A word that is mostly written with a capital is a name, and a name that makes
the top 30,000 of a news corpus is not always a public figure. So a name is an
entry only if Indonesian Wikipedia has an article for it: `jokowi`, `kpk`,
`jakarta`. Such entries are the *entities*; each is listed with its article and,
where Wikidata tells, its kind (person, place, organisation). Several entries
can share an article (`jokowi`, `joko widodo`). Other names are left
out, but still appear as collocates: those come from the 4,000 most common
context words only.
"""

import argparse
import json
import shutil
from itertools import combinations
from pathlib import Path

import numpy as np
import pyarrow.compute as pc
import pyarrow.parquet as pq

from idhist import parallel
from idhist.counts import Counts
from idhist.lenses import LENSES, Lens
from idhist.measure import FLAG, MIN_UNITS, Measures, whole
from idhist.sources import wikipedia

ROOT = Path("site/data")
BUCKET = 64  # entries per file
WITH = 10  # collocates listed per period
LIKE = 8  # similar words listed per period
MOVERS = 300  # flagged words listed per pair of periods, at most
MOVER_LETTERS = 3  # shorter tokens are abbreviations and scanning debris; they keep their entries
NAME = 0.9  # share of capitalised occurrences from which a word is taken for a name
ROWS = 2_000  # words compared with the whole vocabulary at a time
PEAKS = 30  # words listed as belonging to a period
PEAK_SHARE = 0.0005  # of which each is in at least this share of the period's units
TRAITS = 8  # adjectives listed per name and period
NEAR = 8  # neighbours a path is drawn among, from each end of it
SKETCH = 64  # numbers a profile is squeezed to for drawing
ADJECTIVES = Path("manifests/adjectives-id.txt")


def names(counts: Counts) -> np.ndarray:
    """Which vocabulary words are mostly capitalised."""
    freq = pq.read_table(counts.dir / "freq.parquet").group_by("word").aggregate([("count", "sum"), ("caps", "sum")])
    share = dict(
        zip(freq["word"].to_pylist(), pc.divide(pc.cast(freq["caps_sum"], "float64"), freq["count_sum"]).to_pylist())
    )
    return np.array([share[w] >= NAME for w in counts.words])


def public(counts: Counts) -> tuple[dict[int, str], np.ndarray]:
    """The names that are entries (word -> Wikipedia article), and which words are names that are not."""
    is_name = names(counts)
    titles = wikipedia.titles()
    entities = {w: titles[counts.words[w]] for w in np.flatnonzero(is_name).tolist() if counts.words[w] in titles}
    hidden = is_name.copy()
    hidden[list(entities)] = False
    return entities, hidden


def _company(job: tuple[Lens, int, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """(collocates [word, WITH], similar words [word, LIKE]) in one period; -1 pads."""
    lens, period, listable = job
    counts = Counts(lens)
    profile = whole(counts, period)
    known = counts.df[period].sum(0) >= 2 * MIN_UNITS

    top = np.argsort(-profile, axis=1)[:, :WITH]
    collocates = np.where(np.take_along_axis(profile, top, 1) > 0, counts.columns[top], -1)
    collocates[~known] = -1

    candidates = np.flatnonzero(known & listable)
    similar = np.full((len(profile), LIKE), -1)
    for start in range(0, len(profile), ROWS):
        rows = slice(start, start + ROWS)
        similarity = profile[rows] @ profile[candidates].T
        similarity[candidates[None, :] == np.arange(len(profile))[rows, None]] = -1  # not itself
        best = np.argsort(-similarity, axis=1)[:, :LIKE]
        similar[rows] = np.where(np.take_along_axis(similarity, best, 1) > 0, candidates[best], -1)
    similar[~known] = -1
    return collocates, similar


def export(lens: Lens) -> None:
    counts, measures = Counts(lens), Measures.load(lens)
    periods = range(len(lens.periods))
    pairs = list(combinations(periods, 2))
    entities, hidden = public(counts)
    kinds = wikipedia.kinds(entities.values())
    share = counts.df.sum(1) / counts.units.sum(1)[:, None]  # period x word
    shift = np.array([measures.shift(a, b) for a, b in pairs])  # pair x word

    collocates, similar = zip(*parallel(_company, [(lens, p, ~hidden) for p in periods], ordered=True))

    out = ROOT / lens.name
    (out / "words").mkdir(parents=True, exist_ok=True)

    def ids(row: np.ndarray) -> list[int]:
        return [int(i) for i in row if i >= 0]

    def entry(w: int) -> dict:
        return {
            "word": w,
            "share": [float(f"{s:.3g}") for s in share[:, w]],
            "shift": [None if np.isnan(s) else round(float(s), 1) for s in shift[:, w]],
            "with": [ids(collocates[p][w]) for p in periods],
            "like": [ids(similar[p][w]) for p in periods],
        }

    for start in range(0, len(counts.words), BUCKET):
        bucket = [entry(w) for w in range(start, min(start + BUCKET, len(counts.words))) if not hidden[w]]
        (out / "words" / f"{start // BUCKET}.json").write_text(json.dumps(bucket, separators=(",", ":")))

    short = np.array([len(w) < MOVER_LETTERS for w in counts.words])
    movers = []
    for i, (a, b) in enumerate(pairs):
        if b - a == 1 or (a, b) == (0, len(lens.periods) - 1):
            s = np.where(hidden | short, np.nan, shift[i])
            top = [int(w) for w in np.argsort(-np.nan_to_num(s, nan=-np.inf))[:MOVERS] if s[w] >= FLAG]
            movers.append(
                {
                    "a": a,
                    "b": b,
                    "scored": int((~np.isnan(s)).sum()),
                    "flagged": int((s >= FLAG).sum()),
                    "words": [[w, round(float(s[w]), 1)] for w in top],
                }
            )
    (out / "movers.json").write_text(json.dumps(movers, separators=(",", ":")))

    planted = Path("data/evaluation") / lens.name / "planted.json"  # how much this lens can see, if it was tested
    sensitivity = None
    if planted.exists():
        test = json.loads(planted.read_text())
        at = test["thresholds"].index(FLAG)
        sensitivity = {
            "a": test["a"],
            "b": test["b"],
            "found": {row["share"]: round(row["found"][at], 2) for row in test["by_share"]},
            "false_alarms": round(test["false_alarms"][at], 3),
        }

    meta = {
        "lens": lens.name,
        "periods": lens.labels,
        "units": counts.units.sum(1).tolist(),
        "pairs": pairs,
        "bucket": BUCKET,
        "flag": FLAG,
        "sensitivity": sensitivity,
        "words": counts.words,
        "names": np.flatnonzero(hidden).tolist(),
        "entities": entities,
        "kinds": {w: kinds[article] for w, article in entities.items() if article in kinds},
    }
    (out / "meta.json").write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False))
    (ROOT / "lenses.json").write_text(json.dumps([n for n in LENSES if (ROOT / n / "meta.json").exists()]))
    print(
        f"{lens.name}: {int((~hidden).sum())} entries, {len(entities)} of them entities; {int(hidden.sum())} names left out"
    )


def _period(job: tuple[Lens, int, list[int], np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """From one period's profiles: the adjectives that most keep each of `words` company (-1 pads), and every
    word's profile squeezed to SKETCH numbers by a fixed random projection, which keeps angles well enough to draw."""
    lens, period, words, adjectives = job
    counts = Counts(lens)
    profile = whole(counts, period)
    near = profile[np.ix_(words, adjectives)]
    top = np.argsort(-near, axis=1)[:, :TRAITS]
    traits = np.where(np.take_along_axis(near, top, 1) > 0, counts.columns[adjectives][top], -1)
    projection = np.random.default_rng(0).standard_normal((profile.shape[1], SKETCH), dtype=np.float32)
    return traits, profile @ projection


def _path(sketch: np.ndarray, known: np.ndarray, word: int, near: list[int]) -> dict | None:
    """A word's way through its neighbours, flattened to a plane.

    The neighbours stay put, each where it is on average; the plane is the one that spreads them most. The word
    is then placed in that plane once for every period in which it is frequent enough. Coordinates are in
    hundredths of the largest distance from the middle.
    """
    seen = known[:, near]
    with np.errstate(invalid="ignore"):
        landmarks = (sketch[:, near] * seen[:, :, None]).sum(0) / seen.sum(0)[:, None]
        landmarks /= np.linalg.norm(landmarks, axis=1, keepdims=True)
        own = sketch[:, word] / np.linalg.norm(sketch[:, word], axis=1, keepdims=True)  # nan where it is unknown
    middle = landmarks.mean(0)
    plane = np.linalg.svd(landmarks - middle, full_matrices=False)[2][:2].T
    points, steps = (landmarks - middle) @ plane, (own - middle) @ plane
    reach = np.abs(np.concatenate([points, steps[known[:, word]]])).max()
    if not reach > 0:
        return None
    scaled = lambda xy: [round(float(v) * 100 / reach) for v in xy]
    return {
        "word": word,
        "near": near,
        "at": [scaled(xy) for xy in points],
        "path": [scaled(xy) if here else None for xy, here in zip(steps, known[:, word])],
    }


def highlights(lens: Lens) -> None:
    """What can be shown without measuring change: a period's own words, the adjectives around a name, and the
    path of every entry through its neighbours."""
    counts = Counts(lens)
    entities, hidden = public(counts)
    periods = range(len(lens.periods))
    share = counts.df.sum(1) / counts.units.sum(1)[:, None]  # period x word
    known = counts.df.sum(1) >= 2 * MIN_UNITS  # period x word
    listable = ~hidden & np.array([len(w) >= MOVER_LETTERS for w in counts.words])
    out = ROOT / lens.name

    peaks = []
    for p in periods:
        elsewhere = np.delete(share, p, axis=0).mean(0)
        score = np.where(listable & (share[p] >= PEAK_SHARE), share[p] / (elsewhere + PEAK_SHARE), 0)
        peaks.append([int(w) for w in np.argsort(-score)[:PEAKS] if score[w] > 1])

    lexicon = {w for line in ADJECTIVES.read_text().splitlines() if not line.startswith("#") for w in line.split()}
    adjectives = np.array([i for i, w in enumerate(counts.contexts) if w in lexicon], dtype=int)
    names_ = sorted(entities)
    found, sketch = zip(*parallel(_period, [(lens, p, names_, adjectives) for p in periods], ordered=True))
    sketch = np.array(sketch)  # period x word x SKETCH
    traits = {
        w: [[int(i) for i in row if i >= 0] if known[p, w] else [] for p, row in enumerate(per_period)]
        for w, per_period in zip(names_, zip(*found))
    }
    (out / "highlights.json").write_text(json.dumps({"peaks": peaks, "traits": traits}, separators=(",", ":")))

    # Paths: the neighbours are the words most like the entry in the first and the last period it is known in.
    shutil.rmtree(out / "paths", ignore_errors=True)
    (out / "paths").mkdir()
    drawn = 0
    for bucket in sorted((out / "words").glob("*.json")):
        paths = []
        for entry in json.loads(bucket.read_text()):
            times = np.flatnonzero(known[:, entry["word"]])
            if len(times) >= 2:
                first, last = entry["like"][times[0]][:NEAR], entry["like"][times[-1]][:NEAR]
                near = list(dict.fromkeys(first + last))
                if len(near) >= 3 and (path := _path(sketch, known, entry["word"], near)):
                    paths.append(path | {"early": len(first)})
        (out / "paths" / bucket.name).write_text(json.dumps(paths, separators=(",", ":")))
        drawn += len(paths)
    print(f"{lens.name}: highlights for {len(peaks)} periods and {len(traits)} names; {drawn} paths")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    parser.add_argument("only", nargs="?", choices=["highlights"])
    args = parser.parse_args()
    if not args.only:
        export(LENSES[args.lens])
    highlights(LENSES[args.lens])
