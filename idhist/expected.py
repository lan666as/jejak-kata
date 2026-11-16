"""Do the words we expected to change stand out from those we expected not to?

    python -m idhist.expected id-books

Reads validation/expected.tsv, which was written before the results were looked
at; validation/README.md fixes what is computed here. Writes
data/evaluation/<lens>/expected.json.
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np

from idhist.counts import Counts
from idhist.lenses import LENSES, Lens
from idhist.measure import FLAG, Measures
from idhist.planted import ROOT, auc

LIST = Path("validation/expected.tsv")


def expected(lens: Lens) -> dict:
    counts, measures = Counts(lens), Measures.load(lens)
    with open(LIST, encoding="utf-8", newline="") as f:
        rows = [r for r in csv.DictReader(f, delimiter="\t") if lens.name.startswith(r["lens"])]

    changes, windows = [], set()
    for r in (r for r in rows if r["kind"] == "change"):
        a, b = lens.labels.index(r["from"]), lens.labels.index(r["to"])
        windows.add((a, b))
        word = counts.row.get(r["word"])
        shift = float("nan") if word is None else float(measures.shift(a, b)[word])
        changes.append(
            {"word": r["word"], "from": r["from"], "to": r["to"], "shift": None if np.isnan(shift) else shift}
        )
    stable = [
        float(s)
        for a, b in sorted(windows)
        for s in measures.shift(a, b)[
            [counts.row[r["word"]] for r in rows if r["kind"] == "stable" and r["word"] in counts.row]
        ]
        if not np.isnan(s)
    ]
    scored = np.array([c["shift"] for c in changes if c["shift"] is not None])
    return {
        "lens": lens.name,
        "auc": auc(scored, np.array(stable)),
        "change_flagged": float((scored >= FLAG).mean()),
        "stable_flagged": float((np.array(stable) >= FLAG).mean()),
        "too_rare": [c["word"] for c in changes if c["shift"] is None],
        "changes": sorted((c for c in changes if c["shift"] is not None), key=lambda c: -c["shift"]),
        "stable_median": float(np.median(stable)),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lens", choices=LENSES)
    lens = LENSES[parser.parse_args().lens]
    if not any(lens.name.startswith(row.split("\t")[0]) for row in LIST.read_text().splitlines()[1:]):
        raise SystemExit(f"{lens.name}: no expectations are registered for this lens")
    result = expected(lens)
    (ROOT / lens.name).mkdir(parents=True, exist_ok=True)
    (ROOT / lens.name / "expected.json").write_text(json.dumps(result, indent=1, ensure_ascii=False))
    print(
        f"{lens.name}: AUC {result['auc']:.3f}; flagged {result['change_flagged']:.0%} of {len(result['changes'])} "
        f"expected changes and {result['stable_flagged']:.0%} of stable words; too rare: {' '.join(result['too_rare']) or '-'}"
    )
    for c in result["changes"]:
        print(f"  {c['shift']:6.1f}  {c['word']}  {c['from']} -> {c['to']}")
