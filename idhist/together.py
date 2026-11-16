"""Of the units that contain one word, the share that also contain another: the plainest number there is.

    python -m idhist.together      # for the pairs asked for in site/together.json

The stories on the site rest on sentences like "of the pages that name him in 2021, 43% also say
*menteri pertahanan*". That is a count of pages, not a score, and anyone can check it against the counts.
The second word has to be one of the lens's context words; one that is not is left out. Writes site/data/together.json:

    "<lens>/<word>": {"pages": [per period], "with": {"<other>": [share per period, null below MIN_PAGES]}}
"""

import json
from pathlib import Path

from idhist.counts import Counts
from idhist.lenses import LENSES

ASKED = Path("site/together.json")  # [{"lens": ..., "word": ..., "with": [...]}, ...]
OUT = Path("site/data/together.json")
MIN_PAGES = 80  # with fewer pages than this in a period, a share is not given


def together() -> None:
    found = {}
    for ask in json.loads(ASKED.read_text()):
        counts = Counts(LENSES[ask["lens"]])
        word = counts.row[ask["word"]]
        pages = counts.df.sum(1)[:, word]
        both = counts.cooc([word]).sum(1)[:, 0, :]  # period x context
        column = {other: counts.contexts.index(other) for other in ask["with"] if other in counts.contexts}
        found[f"{ask['lens']}/{ask['word']}"] = {
            "pages": pages.tolist(),
            "with": {
                other: [
                    round(float(both[p, c] / pages[p]), 4) if pages[p] >= MIN_PAGES else None for p in range(len(pages))
                ]
                for other, c in column.items()
            },
        }
    OUT.write_text(json.dumps(found, separators=(",", ":")))
    print(f"{len(found)} words with their company counted")


if __name__ == "__main__":
    together()
