"""Can the measurement find changes that we planted ourselves?

    python -m idhist.planted id-books 2000-2004 2005-2009

Nobody has labelled which Indonesian words changed meaning, so the test is made:
take two real periods and, in the later one, replace a known share of a word's
occurrences with occurrences of an unrelated word (its donor). The word keeps
its frequency and gains a new sense of known size. All other words keep whatever
real change and corpus drift they have; the question is whether the planted
words can be told from them.

This is done on the counts, not the text: the word's co-occurrences are thinned
to 1 - share and the donor's, thinned to match, are added. Units containing
both words are ignored, as is the change in the word's role as a context.

Scores compared, each as AUC (chance of ranking a planted word above another):

    distance   plain distance between the two periods
    excess     distance minus the word's noise floor
    shift      excess against words of similar frequency: what the site reports
    svd        whole-period profiles reduced by truncated SVD and aligned by
               orthogonal Procrustes, as embedding methods do
    svd shift  the same, against words of similar frequency

Writes data/evaluation/<lens>/planted.json.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.linalg import orthogonal_procrustes
from scipy.stats import rankdata

from idhist.counts import Counts
from idhist.lenses import LENSES, Lens
from idhist.measure import FLAG, Measures, distances, profiles, standardise, whole

ROOT = Path("data/evaluation")
SHARES = (0.05, 0.1, 0.2, 0.4, 0.8)  # of a word's occurrences replaced
TARGETS = 600
DIMENSIONS = 100
THRESHOLDS = (2, 3, FLAG, 5, 6)
SEED = 0


def auc(positive: np.ndarray, negative: np.ndarray) -> float:
    ranks = rankdata(np.concatenate([positive, negative]))
    return float((ranks[: len(positive)].mean() - (len(positive) + 1) / 2) / len(negative))


def embed(profile: np.ndarray) -> np.ndarray:
    """Left singular vectors scaled by singular values, for the top DIMENSIONS."""
    _, vectors = np.linalg.eigh(profile.T @ profile)
    return profile @ vectors[:, -DIMENSIONS:]


def aligned_distance(x: np.ndarray, y: np.ndarray, anchors: np.ndarray) -> np.ndarray:
    """Cosine distance per word after rotating `y` onto `x`."""
    rotation, _ = orthogonal_procrustes(y[anchors], x[anchors])
    y = y @ rotation
    with np.errstate(invalid="ignore"):
        return 1 - np.einsum("ij,ij->i", x, y) / (np.linalg.norm(x, axis=1) * np.linalg.norm(y, axis=1))


def evaluate(lens: Lens, a: int, b: int) -> dict:
    counts, real = Counts(lens), Measures.load(lens)
    rng = np.random.default_rng(SEED)
    scored = np.flatnonzero(real.scored(a, b))
    df_b = counts.df[b].sum(0)

    targets = np.sort(rng.choice(scored, min(TARGETS, len(scored) // 10), replace=False))
    share = rng.choice(SHARES, len(targets))
    donors = np.array(
        [rng.choice(scored[(df_b[scored] >= s * df_b[t]) & (scored != t)]) for t, s in zip(targets, share)]
    )
    rate = share * df_b[targets] / df_b[donors]

    # The planted counts: [period (a, b), fold, target, context].
    cooc = counts.cooc(targets, [a, b])
    cooc[1] = rng.binomial(cooc[1], 1 - share[:, None]) + rng.binomial(counts.cooc(donors, [b])[0], rate[:, None])
    df = counts.df[[a, b]][:, :, targets]
    df[1] = rng.binomial(df[1], 1 - share) + rng.binomial(counts.df[b][:, donors], rate)
    df_contexts, units = counts.df[[a, b]][:, :, counts.columns], counts.units[[a, b]]
    distance, support = distances(cooc, df, df_contexts, units, counts.own[targets])

    planted = Measures(real.distance[[a, b]][:, [a, b]].copy(), real.support[[a, b]].copy())
    planted.distance[:, :, targets], planted.support[:, targets] = distance, support
    frequency = planted.support.min(0)

    # Reduce and align, as embedding methods do, on the same counts.
    after = whole(counts, b)
    after[targets] = profiles(
        cooc[1].sum(0, dtype=np.float32), df[1].sum(0), df_contexts[1].sum(0), units[1].sum(), counts.own[targets]
    )
    svd = aligned_distance(embed(whole(counts, a)), embed(after), np.setdiff1d(scored, targets))

    keep = planted.scored(0, 1)
    scores = {
        "distance": planted.distance[0, 1],
        "excess": planted.excess(0, 1),
        "shift": planted.shift(0, 1),
        "svd": svd,
        "svd shift": np.full(len(svd), np.nan),
    }
    scores["svd shift"][keep] = standardise(svd[keep], frequency[keep])

    is_target = np.zeros(len(keep), dtype=bool)
    is_target[targets] = True
    others = keep & ~is_target
    band = np.searchsorted(np.quantile(frequency[keep], [1 / 3, 2 / 3]), frequency)  # 0 rare .. 2 frequent
    shift = scores["shift"]
    result = {
        "lens": lens.name,
        "a": lens.labels[a],
        "b": lens.labels[b],
        "scored": int(keep.sum()),
        "planted": int((keep & is_target).sum()),
        "thresholds": THRESHOLDS,
        "false_alarms": [float((shift[others] >= t).mean()) for t in THRESHOLDS],
        "by_share": [],
    }
    for s in SHARES:
        chosen = np.zeros(len(keep), dtype=bool)
        chosen[targets[share == s]] = True
        chosen &= keep
        result["by_share"].append(
            {
                "share": s,
                "words": int(chosen.sum()),
                "auc": {name: auc(score[chosen], score[others]) for name, score in scores.items()},
                "found": [float((shift[chosen] >= t).mean()) for t in THRESHOLDS],
                "found_by_frequency": [float((shift[chosen & (band == i)] >= FLAG).mean()) for i in range(3)],
            }
        )
    return result


def report(r: dict) -> str:
    names = list(r["by_share"][0]["auc"])
    lines = [
        f"{r['lens']}  {r['a']} -> {r['b']}: {r['planted']} planted among {r['scored']} scored words",
        "",
        "AUC      " + "".join(f"{n:>11}" for n in names),
        *(f"{row['share']:<9}" + "".join(f"{row['auc'][n]:11.3f}" for n in names) for row in r["by_share"]),
        "",
        "found at shift >=" + "".join(f"{t:>8g}" for t in THRESHOLDS) + f"    rare/mid/frequent at {FLAG:g}",
        *(
            f"{row['share']:<17}"
            + "".join(f"{x:8.2f}" for x in row["found"])
            + "    "
            + " ".join(f"{x:.2f}" for x in row["found_by_frequency"])
            for row in r["by_share"]
        ),
        "unplanted words  " + "".join(f"{x:8.3f}" for x in r["false_alarms"]),
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    parser.add_argument("a")
    parser.add_argument("b")
    args = parser.parse_args()
    lens = LENSES[args.lens]
    result = evaluate(lens, lens.labels.index(args.a), lens.labels.index(args.b))
    out = ROOT / lens.name / "planted.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=1))
    print(report(result))
