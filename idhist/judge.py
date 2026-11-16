"""A blind sample for a native speaker to judge.

    python -m idhist.judge

Draws, from what the site shows, pairs of periods for words across the range of
shift, and writes them without the shift:

    data/judge/items.json   what the judge sees: the word, the two periods, its company in each
    data/judge/key.json     item id -> lens, word, periods, shift; not shown until the judging is done

The judge answers two things per item: how different the word's company is in
the two periods, and, if it differs, whether that is a new use of the word, an
event or topic of the time, or debris (spelling, abbreviations, page furniture).
Words on the pre-registered list are left out; they have their own test.
"""

import csv
import json
import random
from pathlib import Path

from idhist.expected import LIST
from idhist.export import MOVER_LETTERS, ROOT

OUT = Path("data/judge")
LENSES = ("id-books", "id-news-tribun", "id-abstracts")
# (lowest shift, highest shift, items per lens): well clear of the flag, just over it, under it, unmoved.
STRATA = ((6, 1e9, 12), (4, 6, 8), (2, 4, 6), (-1e9, 1, 10))
MIN_COMPANY = 6  # an item needs this many collocates in both periods to be judged at all
SEED = 20261116


def candidates(lens: str, skip: set[str]) -> list[dict]:
    meta = json.loads((ROOT / lens / "meta.json").read_text())
    words = meta["words"]
    found = []
    for path in sorted((ROOT / lens / "words").glob("*.json")):
        for entry in json.loads(path.read_text()):
            word = words[entry["word"]]
            if word in skip or len(word) < MOVER_LETTERS:
                continue
            for (a, b), shift in zip(meta["pairs"], entry["shift"]):
                if shift is not None and min(len(entry["with"][a]), len(entry["with"][b])) >= MIN_COMPANY:
                    found.append(
                        {
                            "lens": lens,
                            "word": word,
                            "a": meta["periods"][a],
                            "b": meta["periods"][b],
                            "shift": shift,
                            "with": [[words[i] for i in entry["with"][p]] for p in (a, b)],
                            "like": [[words[i] for i in entry["like"][p]] for p in (a, b)],
                        }
                    )
    return found


def sample() -> None:
    rng = random.Random(SEED)
    with open(LIST, encoding="utf-8", newline="") as f:
        skip = {row["word"] for row in csv.DictReader(f, delimiter="\t")}
    items = []
    for lens in LENSES:
        pool = candidates(lens, skip)
        for low, high, n in STRATA:
            chosen, used = [], set()
            for item in rng.sample([c for c in pool if low <= c["shift"] < high], k=len(pool) and 50 * n):
                if item["word"] not in used and len(chosen) < n:  # a word appears once per stratum
                    chosen.append(item)
                    used.add(item["word"])
            items += chosen
    rng.shuffle(items)
    OUT.mkdir(parents=True, exist_ok=True)
    key = {f"i{n:03d}": item for n, item in enumerate(items)}
    hidden = ("shift",)
    (OUT / "items.json").write_text(
        json.dumps(
            [{"id": i, **{k: v for k, v in item.items() if k not in hidden}} for i, item in key.items()],
            ensure_ascii=False,
        )
    )
    (OUT / "key.json").write_text(json.dumps(key, ensure_ascii=False, indent=1))
    print(f"{len(items)} items in {OUT}")


if __name__ == "__main__":
    sample()
