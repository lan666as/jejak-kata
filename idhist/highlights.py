"""What the site shows that is not a measurement of change: the chart, the routes, and what stands out.

    python -m idhist.highlights id-books      # after idhist.export, whose entries it reads

Writes site/data/<lens>/:

    highlights.json    peaks      per period, the words that belong to it more than to any other
                       arrivals   words that came and went, and words that came and stayed
                       swaps      pairs where one word took over the company the other used to keep
    chart.json         every entry on one plane, with how far it moved at most
    paths/<n>.json     for the entries of words/<n>.json: where the entry stood on the chart in each
                       period (`route`), its path among its own first and last neighbours, and for a
                       name the adjectives and the verbs that keep it company, each with how strongly

None of this is a claim about change of meaning; only the shift is. A chart flattens 4,000
measurements to two, so it shows neighbourhoods, not distances.
"""

import argparse
import json
import shutil
import warnings
from pathlib import Path

import numpy as np
from sklearn.manifold import TSNE

from idhist import parallel
from idhist.counts import Counts
from idhist.export import MOVER_LETTERS, ROOT, public
from idhist.lenses import LENSES, Lens
from idhist.measure import MIN_UNITS, Measures, whole

PEAKS = 30  # words listed as belonging to a period
PEAK_SHARE = 0.0005  # a word has to be in this share of a period's units to be listed for anything
TRAITS = 10  # adjectives or verbs listed per name and period
NEAR = 8  # neighbours a path is drawn among, from each end of it
SKETCH = 64  # numbers a profile is squeezed to for drawing
LISTED = 40  # arrivals of each kind, and swaps, listed
SERIES = 6  # periods a lens needs before its arrivals and swaps are looked for
BORN, GONE, STAYED = (
    0.05,
    0.15,
    0.5,
)  # of a word's peak share: at most this at the start; at the end, for a word that went, that stayed
ROSE, ALIKE = 3.0, 0.5  # a swap needs both words to change by this factor, and their company to be this alike
SAME, LINE = 0.9, 5  # words that are this alike, this many together, are a repeated line (see _lines)
LANDMARKS, CLOSEST = 6_000, 8  # a route is placed among the closest of the most frequent entries
CHART = 1_000  # the chart runs from -CHART to CHART
LEXICONS = {"adjectives": Path("manifests/adjectives-id.txt"), "verbs": Path("manifests/verbs-id.txt")}


def _period(job: tuple[Lens, int, list[int], dict[str, np.ndarray]]) -> tuple[dict[str, tuple], np.ndarray]:
    """From one period's profiles: per lexicon, the words of it that most keep each of `names` company, with their
    strength (-1 pads); and every word's profile squeezed to SKETCH numbers by a fixed random projection, which
    keeps angles well enough to draw with."""
    lens, period, names, lexicons = job
    counts = Counts(lens)
    profile = whole(counts, period)
    traits = {}
    for name, columns in lexicons.items():
        near = profile[np.ix_(names, columns)]
        top = np.argsort(-near, axis=1)[:, :TRAITS]
        strength = np.take_along_axis(near, top, 1)
        traits[name] = (np.where(strength > 0, counts.columns[columns][top], -1), np.round(strength * 1000).astype(int))
    projection = np.random.default_rng(0).standard_normal((profile.shape[1], SKETCH), dtype=np.float32)
    return traits, profile @ projection


def _unit(vectors: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore"):
        return vectors / np.linalg.norm(vectors, axis=-1, keepdims=True)


def _mean(sketch: np.ndarray, known: np.ndarray, periods: slice = slice(None)) -> np.ndarray:
    """Every word's direction over the periods in which it is frequent enough; nan where there is none."""
    seen = known[periods]
    with np.errstate(invalid="ignore"):
        return _unit((sketch[periods] * seen[:, :, None]).sum(0) / seen.sum(0)[:, None])


def _lines(sketch: np.ndarray, words: list[int], is_name: np.ndarray) -> set[int]:
    """Of the given words, those that are one repeated line rather than vocabulary.

    A line pasted on thousands of pages (an invitation to install an app, say) makes its words keep exactly
    the same company. So: LINE or more words whose company in a period is one and the same (alike by SAME),
    fewer than half of them names. Names are what tells a line from a case: the words of a trial are as
    alike as that, and most of them are names.
    """
    alike = np.nan_to_num(_unit(sketch[words]) @ _unit(sketch[words]).T) >= SAME
    out, seen = set(), set()
    for start in range(len(words)):
        group, todo = [], [start]
        while todo:
            k = todo.pop()
            if k not in seen:
                seen.add(k)
                group.append(k)
                todo += np.flatnonzero(alike[k]).tolist()
        if len(group) >= LINE and 2 * sum(is_name[words[k]] for k in group) < len(group):
            out |= {words[k] for k in group}
    return out


def _peaks(
    share: np.ndarray, sketch: np.ndarray, listable: np.ndarray, is_name: np.ndarray
) -> tuple[list[list[int]], set[int]]:
    """Per period, the words that belong to it more than to any other; and the words dropped as repeated lines."""
    peaks, lines = [], set()
    for p in range(len(share)):
        elsewhere = np.delete(share, p, axis=0).mean(0)
        score = np.where(listable & (share[p] >= PEAK_SHARE), share[p] / (elsewhere + PEAK_SHARE), 0)
        top = [int(w) for w in np.argsort(-score)[: 3 * PEAKS] if score[w] > 1]
        line = _lines(sketch[p], top, is_name)
        lines |= line
        peaks.append([w for w in top if w not in line][:PEAKS])
    return peaks, lines


def _arrivals(share: np.ndarray, listable: np.ndarray) -> dict[str, list[list[int]]]:
    """Words that were not there at the start: those that went again, and those that stayed. [word, peak period]."""
    top, peak = share.max(0), share.argmax(0)
    born = listable & (top >= 2 * PEAK_SHARE) & (share[0] <= BORN * top)
    went = born & (share[-1] <= GONE * top) & (peak < len(share) - 2)
    stayed = born & (share[-1] >= STAYED * top)
    rank = lambda which: [[int(w), int(peak[w])] for w in np.argsort(-np.where(which, top, 0))[:LISTED] if which[w]]
    return {"went": rank(went), "stayed": rank(stayed)}


def _swaps(share: np.ndarray, sketch: np.ndarray, known: np.ndarray, listable: np.ndarray) -> list[list[int]]:
    """Pairs [falling, rising]: the rising word keeps, late, the company the falling word kept early."""
    third = max(1, len(share) // 3)
    early, late = slice(0, third), slice(len(share) - third, len(share))
    before, after = share[early].mean(0), share[late].mean(0)
    rising = np.flatnonzero(listable & (after >= PEAK_SHARE) & (after >= ROSE * before))
    falling = np.flatnonzero(listable & (before >= PEAK_SHARE) & (before >= ROSE * after))
    alike = np.nan_to_num(_mean(sketch, known, early)[falling] @ _mean(sketch, known, late)[rising].T)
    swaps, used = [], set()
    for flat in np.argsort(-alike, axis=None)[: 50 * LISTED]:
        f, r = np.unravel_index(flat, alike.shape)
        if alike[f, r] < ALIKE or len(swaps) == LISTED:
            break
        if not {int(falling[f]), int(rising[r])} & used:
            swaps.append([int(falling[f]), int(rising[r])])
            used |= {int(falling[f]), int(rising[r])}
    return swaps


def _chart(
    sketch: np.ndarray, known: np.ndarray, entries: np.ndarray, kept: np.ndarray | None
) -> tuple[np.ndarray, np.ndarray]:
    """Where every entry lies on the chart (by its average direction), and where it stood in each period.

    The lay-out is t-SNE, which keeps neighbours together and promises nothing about distances. A route is
    not laid out again: in each period a word is put among the CLOSEST of the LANDMARKS it is then most like,
    nearer to those it is more like. Entries are in order of frequency, so the first are the landmarks.
    """
    home = np.nan_to_num(_mean(sketch, known)[entries])
    flat = kept  # the lay-out of an earlier run is kept while the entries are the same, so places stay where they were
    if flat is None:
        flat = TSNE(n_components=2, init="pca", perplexity=30, random_state=0, n_jobs=1).fit_transform(home)
        flat = np.round((flat - flat.mean(0)) / np.abs(flat - flat.mean(0)).max() * CHART).astype(int)
    marks, at = home[:LANDMARKS], flat[:LANDMARKS].astype(np.float32)
    routes = np.zeros((len(sketch), len(entries), 2), dtype=int)
    for p in range(len(sketch)):
        for start in range(0, len(entries), 2_000):
            rows = slice(start, start + 2_000)
            alike = np.nan_to_num(_unit(sketch[p, entries[rows]])) @ marks.T
            closest = np.argpartition(-alike, CLOSEST, axis=1)[:, :CLOSEST]
            weight = np.maximum(np.take_along_axis(alike, closest, 1), 1e-6) ** 4
            routes[p, rows] = np.round((at[closest] * weight[:, :, None]).sum(1) / weight.sum(1, keepdims=True))
    return flat, routes


def _path(sketch: np.ndarray, known: np.ndarray, word: int, near: list[int]) -> dict | None:
    """A word's way through its own neighbours, flattened to a plane.

    The neighbours stay put, each where it is on average; the plane is the one that spreads them most. The word
    is then placed in that plane once for every period in which it is frequent enough. Coordinates are in
    hundredths of the largest distance from the middle.
    """
    landmarks, own = _mean(sketch[:, near], known[:, near]), _unit(sketch[:, word])
    middle = landmarks.mean(0)
    plane = np.linalg.svd(landmarks - middle, full_matrices=False)[2][:2].T
    points, steps = (landmarks - middle) @ plane, (own - middle) @ plane
    reach = np.abs(np.concatenate([points, steps[known[:, word]]])).max()
    if not reach > 0:
        return None
    scaled = lambda xy: [round(float(v) * 100 / reach) for v in xy]
    return {
        "near": near,
        "at": [scaled(xy) for xy in points],
        "path": [scaled(xy) if here else None for xy, here in zip(steps, known[:, word])],
    }


def highlights(lens: Lens) -> None:
    counts = Counts(lens)
    entities, hidden = public(counts)
    periods = range(len(lens.periods))
    share = counts.df.sum(1) / counts.units.sum(1)[:, None]  # period x word
    known = counts.df.sum(1) >= 2 * MIN_UNITS  # period x word
    listable = ~hidden & np.array([len(w) >= MOVER_LETTERS for w in counts.words])
    out = ROOT / lens.name

    lexicons = {}
    for name, path in LEXICONS.items():
        words = {w for line in path.read_text().splitlines() if not line.startswith("#") for w in line.split()}
        lexicons[name] = np.array([i for i, w in enumerate(counts.contexts) if w in words], dtype=int)
    names = sorted(entities)
    found, sketch = zip(*parallel(_period, [(lens, p, names, lexicons) for p in periods], ordered=True))
    sketch = np.array(sketch)  # period x word x SKETCH
    traits = {lexicon: {} for lexicon in lexicons}
    for lexicon in lexicons:  # found[period][lexicon] = (ids [name, TRAITS], strength [name, TRAITS])
        for k, w in enumerate(names):
            traits[lexicon][w] = [
                [[int(i), int(s)] for i, s in zip(found[p][lexicon][0][k], found[p][lexicon][1][k]) if i >= 0]
                if known[p, w]
                else []
                for p in periods
            ]
    series = len(lens.periods) >= SERIES
    is_name = np.zeros(len(counts.words), dtype=bool)
    is_name[names] = True
    peaks, lines = _peaks(share, sketch, listable, is_name)
    listable[list(lines)] = False  # a repeated line did not come and go, and replaced nothing
    summary = {
        "peaks": peaks,
        "arrivals": _arrivals(share, listable) if series else {"went": [], "stayed": []},
        "swaps": _swaps(share, sketch, known, listable) if series else [],
    }
    (out / "highlights.json").write_text(json.dumps(summary, separators=(",", ":")))

    entries = np.flatnonzero(~hidden & known.any(0))
    drawn = json.loads((out / "chart.json").read_text()) if (out / "chart.json").exists() else {}
    kept = np.array([drawn["x"], drawn["y"]]).T if drawn.get("words") == entries.tolist() else None
    flat, routes = _chart(sketch, known, entries, kept)
    measures = Measures.load(lens)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # an entry scored in no pair of periods has moved nan
        moved = np.nanmax([measures.shift(a, b)[entries] for a in periods for b in periods if a < b], axis=0)
    chart = {"words": entries.tolist(), "x": flat[:, 0].tolist(), "y": flat[:, 1].tolist()}
    chart["moved"] = [None if np.isnan(m) else round(float(m), 1) for m in moved]
    (out / "chart.json").write_text(json.dumps(chart, separators=(",", ":")))
    place = {int(w): k for k, w in enumerate(entries)}

    shutil.rmtree(out / "paths", ignore_errors=True)
    (out / "paths").mkdir()
    for bucket in sorted((out / "words").glob("*.json")):
        paths = []
        for entry in json.loads(bucket.read_text()):
            word, times = entry["word"], np.flatnonzero(known[:, entry["word"]])
            if word not in place:
                continue
            route = [routes[p, place[word]].tolist() if known[p, word] else None for p in periods]
            first, last = entry["like"][times[0]][:NEAR], entry["like"][times[-1]][:NEAR]
            near = list(dict.fromkeys(first + last))
            path = _path(sketch, known, word, near) if len(times) >= 2 and len(near) >= 3 else None
            said = {lexicon: traits[lexicon][word] for lexicon in traits if word in traits[lexicon]}
            paths.append({"word": word, "route": route} | (path | {"early": len(first)} if path else {}) | said)
        (out / "paths" / bucket.name).write_text(json.dumps(paths, separators=(",", ":")))
    print(
        f"{lens.name}: {len(entries)} entries charted; {len(summary['swaps'])} swaps; {len(lines)} words of repeated lines left out"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    highlights(LENSES[parser.parse_args().lens])
