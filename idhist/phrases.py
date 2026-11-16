"""Words that belong together are counted as one: `ibu kota`, `tol laut`, `joko widodo`.

Which words belong together is not guessed from the texts. A phrase is the
title of a Wikipedia article (or of a redirect to one), of two to MAX_WORDS
words. Three kinds of title are not used:

* one that says no more than a shorter title inside it: `presiden joko widodo`
  and `kota medan` lead to the same articles as `joko widodo` and `medan`, so
  those words stay apart and the shorter name collects all its mentions;
* one that begins or ends with one of the COMMON most frequent words, since a
  song called `yang terdalam` should not swallow every use of those two words;
* one seen fewer than MIN_COUNT times in the pages the phrases are learned from.

A phrase is capitalised when all its words are, which is how names are told
from other phrases downstream.
"""

from collections import Counter
from collections.abc import Iterable

from idhist import text

MAX_WORDS = 4
MIN_COUNT = 50
COMMON = 20

Run = list[tuple[str, bool]]  # (word, capitalised), with nothing but spaces between them


def candidates(titles: dict[str, str]) -> frozenset[str]:
    """The titles that could be phrases, before any text is seen."""
    found = set()
    for title, article in titles.items():
        words = title.split(" ")
        if 2 <= len(words) <= MAX_WORDS and all(text.WORD.fullmatch(w) for w in words):
            inside = (" ".join(words[i:j]) for i in range(len(words)) for j in range(i + 1, len(words) + 1))
            if not any(titles.get(part) == article for part in inside if part != title):
                found.add(title)
    return frozenset(found)


def join(run: Run, known: frozenset[str]) -> Run:
    """Replace the words of each known phrase by the phrase: left to right, the longest first."""
    joined, i = [], 0
    while i < len(run):
        for n in range(min(MAX_WORDS, len(run) - i), 1, -1):
            phrase = " ".join(word for word, _ in run[i : i + n])
            if phrase in known:
                joined.append((phrase, all(capitalised for _, capitalised in run[i : i + n])))
                i += n
                break
        else:
            joined.append(run[i])
            i += 1
    return joined


def count(runs: Iterable[Run], known: frozenset[str]) -> Counter:
    """Occurrences of every word and phrase."""
    return Counter(word for run in runs for word, _ in (join(run, known) if known else run))


def learn(seen: Counter) -> frozenset[str]:
    """The phrases worth keeping, given counts made with every candidate joined."""
    common = {word for word, _ in Counter({w: n for w, n in seen.items() if " " not in w}).most_common(COMMON)}
    return frozenset(
        phrase
        for phrase, n in seen.items()
        if " " in phrase and n >= MIN_COUNT and not {phrase.split(" ")[0], phrase.rsplit(" ", 1)[1]} & common
    )
