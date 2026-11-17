"""Candidates for the two word lists of manifests/, found in the text by a rule.

    python -m idhist.lexicon      # writes data/lexicon/adjectives.tsv and verbs.tsv

An adjective is a word that can follow "sangat", "amat", "terlalu", "paling" or "agak"; a verb one that can follow
"telah", "sudah", "akan", "sedang", "belum", "pernah", "langsung", "segera", "terus", "enggan" or "berhasil", or
stand before "bahwa" (a verb of saying). Each word is listed with how often it was seen so, in one page in SAMPLE of
the three papers read by term, and whether it is a context word of the Kompas lens (only those can be shown).
The lists themselves are then chosen by hand from these candidates: the rule finds what is an adjective or a
verb, not which of them say something about a person or an institution.
"""

import re
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq

from idhist.counts import ROOT, read_words
from idhist.sources.hplt import TEXT

OUT = Path("data/lexicon")
PAPERS = ("kompas.com", "tempo.co", "tribunnews.com")
SAMPLE = 4  # one file of the kept text in this many
MIN_SEEN = 40
CUES = {
    "adjectives": re.compile(r"\b(?:sangat|amat|terlalu|paling|agak) ([a-z]+(?:-[a-z]+)?)\b"),
    "verbs": re.compile(
        r"\b(?:telah|sudah|akan|sedang|belum|pernah|langsung|segera|terus|enggan|berhasil) ([a-z]+(?:-[a-z]+)?)\b"
        r"|\b([a-z]+(?:-[a-z]+)?) bahwa\b"
    ),
}


def candidates() -> dict[str, Counter]:
    seen = {kind: Counter() for kind in CUES}
    for paper in PAPERS:
        for path in sorted((TEXT / paper).glob("*"))[::SAMPLE]:
            for text in pq.read_table(path, columns=["text"])["text"].to_pylist():
                text = text.lower()
                for kind, cue in CUES.items():
                    seen[kind].update(
                        a or b for a, b in (m if isinstance(m, tuple) else (m, "") for m in cue.findall(text))
                    )
    return seen


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    shown = set(read_words(ROOT / "id-web-news-kompas" / "contexts.txt"))
    for kind, seen in candidates().items():
        rows = [f"{word}\t{n}\t{int(word in shown)}" for word, n in seen.most_common() if n >= MIN_SEEN]
        (OUT / f"{kind}.tsv").write_text("\n".join(rows) + "\n")
        print(f"{kind}: {len(rows)} candidates, {sum(r.endswith('1') for r in rows)} of them context words")
