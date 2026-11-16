import json
from collections import Counter
from datetime import date

from idhist import text, web
from idhist.sources import ccnews, hathitrust, openalex


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


def test_news_publisher_and_date():
    assert web.publisher("https://pontianak.tribunnews.com/2019/01/02/x") == "tribunnews.com"
    assert web.publisher("https://www.pikiran-rakyat.co.id/a") == "pikiran-rakyat.co.id"
    crawled = date(2019, 1, 5)
    assert ccnews.published("https://x.com/2019/01/02/a", crawled) == date(2019, 1, 2)
    assert ccnews.published("https://x.com/2031/01/02/a", crawled) == crawled  # a date after the crawl is not a date
    assert ccnews.published("https://x.com/a", crawled) == crawled


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
