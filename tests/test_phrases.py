"""Wikipedia titles decide which words are counted as one."""

import gzip
from collections import Counter

from idhist import phrases, web
from idhist.sources import wikipedia

TITLES = {
    "joko widodo": "Joko Widodo",
    "jokowi": "Joko Widodo",
    "presiden joko widodo": "Joko Widodo",  # says no more than the name inside it
    "medan": "Kota Medan",
    "kota medan": "Kota Medan",
    "ibu kota": "Ibu kota",
    "ibu kota nusantara": "Nusantara (kota)",
    "yang terdalam": "Yang Terdalam",
    "covid-19": "Covid-19",  # not made of words
    "satu dua tiga empat lima": "Lagu",  # too long
}


def test_titles_that_add_nothing_to_a_shorter_title_are_not_phrases():
    assert phrases.candidates(TITLES) == {"joko widodo", "ibu kota", "ibu kota nusantara", "yang terdalam"}


def test_the_longest_phrase_wins_and_capitals_must_be_on_every_word():
    known = frozenset({"ibu kota", "ibu kota nusantara", "joko widodo"})
    counts, caps = web.bag("Presiden Joko Widodo ke Ibu Kota Nusantara, bukan ibu kota lama. Kata Joko, Widodo.", known)
    assert counts["joko widodo"] == counts["ibu kota nusantara"] == counts["ibu kota"] == 1
    assert counts["presiden"] == counts["joko"] == counts["widodo"] == 1  # a comma keeps words apart
    assert caps["joko widodo"] == 1 and "ibu kota" not in caps
    assert "kota" not in counts


def test_rare_phrases_and_phrases_edged_by_common_words_are_dropped(monkeypatch):
    monkeypatch.setattr(phrases, "MIN_COUNT", 3)
    monkeypatch.setattr(phrases, "COMMON", 1)
    seen = Counter({"yang": 100, "terdalam": 5, "yang terdalam": 9, "ibu kota": 3, "tol laut": 2, "kata": 50})
    assert phrases.learn(seen) == {"ibu kota"}


def test_wikipedia_tables_are_read_with_their_redirects(tmp_path, monkeypatch):
    monkeypatch.setattr(wikipedia, "ROOT", tmp_path)
    monkeypatch.setattr(wikipedia, "TITLES", tmp_path / "titles.parquet")
    pages = b"INSERT INTO `page` VALUES\n(1,0,'Joko_Widodo',0,0,0.1),\n(2,0,'Jokowi',1,0,0.2),(3,1,'Jokowi',0,0,0.3),\n(4,0,'Jum\\'at',0,0,0.4);\n"
    redirects = b"INSERT INTO `redirect` VALUES (2,0,'Joko_Widodo','',''),(9,4,'Lain','','');\n"
    for name, rows in (("page", pages), ("redirect", redirects)):
        with gzip.open(wikipedia._table(name), "wb") as f:
            f.write(rows)
    wikipedia.build_titles()
    assert wikipedia.titles() == {"joko widodo": "Joko Widodo", "jokowi": "Joko Widodo", "jum'at": "Jum'at"}


def test_kinds_follow_three_plain_rules():
    human = {"P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}], "P625": [{}]}
    assert wikipedia._kind(human) == "person"
    assert wikipedia._kind({"P159": [{}], "P625": [{}]}) == "organisation"
    assert wikipedia._kind({"P625": [{}], "P31": [{"mainsnak": {}}]}) == "place"
    assert wikipedia._kind({"P571": [{}]}) is None
