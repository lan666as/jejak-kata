"""What counts as a word, which language a stretch of text is in, and how
spelling is brought to one standard.

A word is a lowercased surface form. Nothing is stemmed: `pembangunan` and
`membangun` have different histories. Two things are normalised because they
are spelling, not meaning:

* reduplication written with a 2 (`anak2`, `anak²`) becomes `anak-anak`;
* the spelling in use before 1972 (`tj dj nj sj ch j`, and the older `oe`) is
  converted to the current one, per document, when the document itself is in
  old spelling. Indonesian, Javanese and Sundanese were all written this way.
"""

import re
from collections import Counter

WORD = re.compile(r"[a-z]{2,}(?:-[a-z]{2,})?")
_REDUP = re.compile(r"([a-z]{2,})[2²]")

# Old digraphs first, then the bare `j` that is left (old `j` is today's `y`).
_OLD = re.compile(r"tj|dj|nj|sj|ch|j")
_OLD_MAP = {"tj": "c", "dj": "j", "nj": "ny", "sj": "sy", "ch": "kh", "j": "y"}
_OLD_ONLY = re.compile(r"tj|dj")  # never written in current spelling
_NEW_ONLY = re.compile(r"c(?!h)")  # never written in old spelling

# Very common function words that the languages do not share, old spellings included.
_MARKERS = {
    "id": "yang dan dengan untuk pada dari ini itu dalam adalah tidak akan oleh telah jang oentoek itoe",
    "jv": "ing lan sing kang iku ora marang saka karo wis ingkang punika kaliyan dhateng sampun menika uga yen dening"
    " saking kangge wonten poenika kalijan dateng sampoen oega jen",
    "su": "anu nu jeung teh mah dina ku henteu geus aya eta ieu kana tina sareng pikeun nyaeta keur djeung noe anoe koe",
    "nl": "de het een van en dat niet zijn op te voor met",
    "en": "the of and to in is that for was with",
}
_LANGUAGE_OF = {word: language for language, words in _MARKERS.items() for word in words.split()}
MIN_MARKERS = 5  # fewer function words than this and a text has no language


def normalise(token: str) -> str | None:
    """Lowercase one raw token; None if it is not a word."""
    t = token.lower()
    m = _REDUP.fullmatch(t)
    if m:
        t = f"{m[1]}-{m[1]}"
    return t if WORD.fullmatch(t) else None


def language(counts: Counter) -> str | None:
    """`id`, `jv`, `su`, `nl` or `en`, when one has at least twice the function words of any other."""
    hits = Counter()
    for word, n in counts.items():
        if word in _LANGUAGE_OF:
            hits[_LANGUAGE_OF[word]] += n
    (first, n), (_, runner_up) = (hits.most_common(2) + [(None, 0)] * 2)[:2]
    return first if n >= MIN_MARKERS and n >= 2 * runner_up else None


def orthography(counts: Counter) -> tuple[bool, bool]:
    """Detect (pre-1972 spelling, pre-1947 `oe`) from a document's own words.

    `tj` and `dj` exist only in the old spelling and a bare `c` only in the new
    one; `oe` gave way to `u`. Whichever is more common settles it, without
    trusting a catalogue date and in the same way for every language.
    """
    old = sum(n for w, n in counts.items() if _OLD_ONLY.search(w)) > sum(
        n for w, n in counts.items() if _NEW_ONLY.search(w)
    )
    oe = sum(n for w, n in counts.items() if "oe" in w) > sum(n for w, n in counts.items() if "u" in w)
    return old or oe, oe


def modernise(word: str, old: bool, oe: bool) -> str:
    if oe:
        word = word.replace("oe", "u")
    if old:
        word = _OLD.sub(lambda m: _OLD_MAP[m[0]], word)
    return word
