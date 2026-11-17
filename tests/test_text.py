import json
from collections import Counter
from datetime import date

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from idhist import pages, text, web
from idhist.sources import hathitrust, openalex


def test_words_and_reduplication():
    assert text.normalise("Anak2") == "anak-anak"
    assert text.normalise("anak²") == "anak-anak"
    assert text.normalise("Kupu-Kupu") == "kupu-kupu"
    assert text.normalise("1945") is None
    assert text.normalise("a") is None


def test_old_spelling_is_detected_per_document_and_modernised():
    assert text.orthography(Counter({"tjinta": 9, "djalan": 9, "boekoe": 9, "itoe": 9, "atau": 3})) == (True, True)
    assert text.orthography(Counter({"tjinta": 9, "djalan": 9, "buku": 9, "itu": 9})) == (True, False)
    assert text.orthography(Counter({"cinta": 9, "jalan": 9, "buku": 9, "achmad": 1, "djoko": 1})) == (False, False)
    for before, after in [
        ("tjinta", "cinta"),
        ("djalan", "jalan"),
        ("jang", "yang"),
        ("njonja", "nyonya"),
        ("sjarat", "syarat"),
        ("achir", "akhir"),
        ("boekoe", "buku"),
        ("kalijan", "kaliyan"),
    ]:
        assert text.modernise(before, True, True) == after
    assert text.modernise("jalan", False, False) == "jalan"


def test_language_needs_a_clear_winner():
    indonesian = Counter(
        [
            "anak",
            "itu",
            "pergi",
            "ke",
            "pasar",
            "dengan",
            "ibu",
            "yang",
            "baik",
            "dan",
            "pulang",
            "dari",
            "sana",
            "untuk",
            "makan",
        ]
    )
    javanese = Counter(
        [
            "bocah",
            "iku",
            "lunga",
            "menyang",
            "pasar",
            "karo",
            "ibune",
            "sing",
            "apik",
            "lan",
            "mulih",
            "saka",
            "kono",
            "ora",
            "suwe",
            "wis",
        ]
    )
    sundanese = Counter(
        [
            "budak",
            "teh",
            "indit",
            "ka",
            "pasar",
            "jeung",
            "indungna",
            "anu",
            "bageur",
            "mah",
            "geus",
            "balik",
            "ti",
            "dinya",
            "ku",
            "sabab",
            "eta",
        ]
    )
    assert text.language(indonesian) == "id" and text.language(javanese) == "jv" and text.language(sundanese) == "su"
    assert text.language(indonesian + javanese) is None  # mixed
    assert text.language(Counter({"tabel": 40, "dan": 2})) is None  # too little to tell


def test_publisher_is_the_registered_domain():
    assert web.publisher("https://pontianak.tribunnews.com/2019/01/02/x") == "tribunnews.com"
    assert web.publisher("https://www.pikiran-rakyat.co.id/a") == "pikiran-rakyat.co.id"


def test_hathitrust_path():
    assert hathitrust.ef_path("mdp.39015012345678") == "mdp/31147/mdp.39015012345678.json.bz2"
    assert hathitrust.ef_path("uc1.$b123456") == "uc1/$25/uc1.$b123456.json.bz2"


def test_abstracts_keep_indonesian_only():
    def row(words, **more):
        index = {}
        for position, word in enumerate(words):
            index.setdefault(word, []).append(position)
        return {"id": "W1", "year": 2015, "venue": "S9", "abstract": json.dumps(index), **more}

    indonesian = [
        "Penelitian",
        "ini",
        "bertujuan",
        "untuk",
        "mengetahui",
        "pengaruh",
        "pupuk",
        "yang",
        "diberikan",
        "pada",
        "tanaman",
        "padi",
        "dan",
        "jagung",
        "di",
        "lahan",
        "kering",
    ] * 4
    english = [
        "The",
        "purpose",
        "of",
        "this",
        "study",
        "is",
        "to",
        "determine",
        "the",
        "effect",
        "of",
        "fertilizer",
        "that",
        "was",
        "given",
        "to",
        "rice",
        "in",
        "the",
        "dry",
        "land",
    ] * 4
    kept = openalex.unit(row(indonesian))
    assert (
        kept.group == "S9/2015"
        and kept.year == 2015
        and kept.counts["penelitian"] == 4
        and kept.caps["penelitian"] == 4
    )
    assert openalex.unit(row(english)) is None
    assert openalex.unit(row(indonesian + english)) is None  # printed in both languages
    assert openalex.unit(row(indonesian[:20])) is None  # too short
    assert openalex.unit(row(indonesian, venue=None)).group == "W1/2015"


def test_copies_of_a_story_are_found_and_the_earliest_kept():
    rng = np.random.default_rng(0)
    story = [f"w{i}" for i in rng.integers(0, 5000, 300)]
    other = [f"w{i}" for i in rng.integers(0, 5000, 300)]
    edited = story[:140] + ["ralat", "baru"] + story[150:] + ["tambahan"] * 3  # nine runs in ten survive
    pages = [
        ("a", other),
        ("a", edited),
        ("a", story),
        ("b", story),
        ("a", list(story)),
        ("a", story[:150] + other[:150]),
    ]
    keys = np.array([web.signature(source, words) for source, words in pages])
    order = np.array([5, 3, 1, 0, 2, 4])  # the third page is the earliest of publisher a
    assert web.copies(order, keys).tolist() == [False, True, False, False, True, False]
    # another publisher's copy is its own page; half a story is not a copy
    assert not web.copies(np.arange(2), np.array([web.signature("a", ["x"] * 3), web.signature("a", ["y"] * 3)])).any()


def test_pages_are_counted_from_the_kept_text(tmp_path, monkeypatch):
    monkeypatch.setattr(pages, "TEXT", tmp_path)
    monkeypatch.setattr(pages, "MIN_PAGES", 5)
    rows = [
        {
            "day": date(2020 + i % 2, 1 + i % 12, 1 + i % 28),
            "text": ("Oknum polisi " if i % 4 == 0 else "Polisi ") + f"cerita {i}",
        }
        for i in range(400)
    ] + [{"day": date(2020, 5, 5), "text": "tanpa keduanya"}] * 100
    (tmp_path / "koran.id").mkdir()
    pq.write_table(pa.Table.from_pylist(rows), tmp_path / "koran.id" / "000.parquet")
    ask = {"publishers": ["koran.id"], "by": "year", "first": "2020-01", "last": "2021-12"}
    ask |= {
        "patterns": {"oknum": r"\boknum\b", "polisi": r"\bpolisi\b"},
        "shares": [["polisi", "oknum"], ["*", "oknum"]],
    }
    found = pages.answer(ask)
    assert found["periods"] == ["2020", "2021"] and found["pages"] == {"polisi": [[200, 200]], "*": [[300, 200]]}
    assert found["share"]["polisi|oknum"] == [[0.5, 0.0]] and found["share"]["*|oknum"][0][0] == round(100 / 300, 4)
    assert 0 < found["off"]["polisi|oknum"][0][0] < 0.3
    assert pages.periods("2020-11", "2021-02", "month") == ["2020-11", "2020-12", "2021-01", "2021-02"]
