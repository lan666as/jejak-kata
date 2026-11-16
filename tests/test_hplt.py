"""Web pages are dated by what they say about themselves, met once, and cut into units by year."""

from datetime import date

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from idhist import phrases, units
from idhist.sources import hplt, wikipedia

CRAWLED = date(2020, 6, 1)


def test_a_page_is_dated_by_its_address_or_its_opening_lines():
    assert hplt.address_date("https://x.id/read/2015/03/02/judul", CRAWLED) == date(2015, 3, 2)
    assert hplt.address_date("https://x.blogspot.com/2015/03/judul.html", CRAWLED) == date(2015, 3, 1)
    assert hplt.address_date("https://x.id/nasional/20150302123456-12-345/judul", CRAWLED) == date(2015, 3, 2)
    assert hplt.address_date("https://x.id/foto/1920/1080/a", CRAWLED) is None  # month 80 is not a month
    assert hplt.address_date("https://x.id/2031/01/02/a", CRAWLED) is None  # after the crawl
    assert hplt.address_date("https://2015.x.id/03/a", CRAWLED) is None  # only the path counts
    assert hplt.text_date("Jakarta - Senin, 2 Maret 2015 10:20 WIB. Isi.", CRAWLED) == date(2015, 3, 2)
    assert hplt.text_date("Diposting 02/03/2015 oleh admin", CRAWLED) == date(2015, 3, 2)
    assert hplt.text_date("x " * 400 + "2 Maret 2015", CRAWLED) is None  # too far down to be the page's own date
    assert hplt.text_date("Pada 17 Agustus 1945 Indonesia merdeka", CRAWLED) is None  # before the web


def test_two_captures_of_a_page_share_a_key():
    assert hplt.key("https://www.Koran.id/a/b/?utm=1") == hplt.key("http://m.koran.id/a/b#top") == "koran.id/a/b"


def doc(url: str, text: str, crawled: str = "2020-06-01", **over) -> dict:
    labels = {"ne": 0.9, "NA": 0.8, "MT": 0.1, "nb": 0.2}
    row = {"u": url, "ts": f"{crawled}T00:00:00Z", "text": text, "filter": "keep", "lang": "['ind_Latn', 'zsm_Latn']"}
    return row | {"prob": "[0.98, 0.01]", "web-register": str(labels)} | over


def test_pages_that_are_filtered_translated_unsure_or_undated_are_dropped():
    reason = lambda **over: hplt.keep(doc("https://x.id/2019/01/02/a", "isi", **over))[1]
    assert reason() == "kept"
    assert reason(filter="short") == "filtered by HPLT"
    assert reason(prob="[0.4, 0.3]") == "language unsure"
    assert reason(lang="['zsm_Latn', 'ind_Latn']") == "language unsure"
    assert reason(**{"web-register": "{'MT': 0.7, 'ne': 0.6}"}) == "machine translated"
    assert reason(u="https://x.id/a") == "undated"


@pytest.fixture
def release(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    story = " ".join(f"kata{chr(97 + i % 26)}{chr(97 + i // 26)}" for i in range(60))
    docs = [
        doc(
            f"https://daerah{i}.koran.co.id/{2019 + i % 2}/03/0{1 + i % 9}/berita-{i}",
            f"Menu Olahraga Politik\nBaca juga: Gosip artis\n{story} unik{chr(97 + i)}. Kata Joko Widodo, ibu kota pindah.\n"
            f"(Penulis: Wartawan{chr(97 + i)} | Editor: Redaktur{chr(97 + i)})\nArtikel ini telah tayang di Koran dengan judul Kabar{chr(97 + i)}\n"
            f"Jakarta: {story} lagi{chr(97 + i)} sumber https://koran.co.id/berita-{i}",
        )
        for i in range(30)
    ]
    docs.append(
        doc(docs[0]["u"] + "?halaman=2", "tangkapan kemudian " + story, crawled="2021-01-01")
    )  # a later capture
    docs.append(doc("https://blog.id/2019/03/01/a", story, **{"web-register": "{'nb': 0.9}"}))  # a blog by its register
    docs.append(doc("https://saya.blogspot.com/2019/03/a.html", story))  # a blog by its platform, though labelled news
    docs.append(
        doc("https://blog.id/tanpa-tanggal", "Ditulis 5 Maret 2019. " + story, **{"web-register": "{'ob': 0.9}"})
    )
    docs.append(doc("https://koran.co.id/berita/31", "Jakarta, 5 Maret 2019. " + story))  # dated by its text
    monkeypatch.setattr(hplt, "_files", lambda: ["release/1_1.jsonl.zst", "release/1_2.jsonl.zst"])
    monkeypatch.setattr(
        hplt, "_documents", lambda url: docs[: len(docs) // 2] if "1_1" in url else docs[len(docs) // 2 :]
    )
    monkeypatch.setattr(hplt, "LEARN_FROM", 1)
    monkeypatch.setattr(phrases, "MIN_COUNT", 5)
    wikipedia.TITLES.parent.mkdir(parents=True)
    titles = {"joko widodo": "Joko Widodo", "ibu kota": "Ibu kota", "gosip artis": "Gosip"}
    pq.write_table(pa.table({"title": list(titles), "article": list(titles.values())}), wikipedia.TITLES)
    wikipedia.titles.cache_clear()


def test_from_the_release_to_units(release):
    hplt.fetch()
    hplt.census()
    hplt.find_furniture()
    hplt.find_phrases()
    hplt.build_units()
    assert hplt.PHRASES.read_text().split("\n")[:-1] == ["ibu kota", "joko widodo"]  # the teaser's phrase is never seen
    shards = units.shards(hplt.NEWS)
    assert {s.stem.split("-")[0] for s in shards} == {"2019", "2020"}
    found = [u for shard in shards for u in units.read_shard(shard)]
    assert len(found) == 31  # 30 stories once each, and the one dated by its text
    words = set().union(*(u.counts for u in found))
    assert {"kataaa", "unikh", "joko widodo", "ibu kota"} <= words
    assert not words & {"menu", "olahraga", "gosip", "tangkapan", "joko", "kota"}
    assert not words & {
        "penulis",
        "editor",
        "wartawana",
        "artikel",
        "judul",
        "kabara",
        "https",
        "koran",
    }  # labels, notices, addresses
    assert "jakarta" in words  # a long line that opens with a word and a colon is text
    assert all(u.caps["joko widodo"] == 1 and u.caps["ibu kota"] == 0 for u in found if "joko widodo" in u.counts)
    assert {u.source for u in found} == {"koran.co.id"}
    assert min(u.group for u in found) == "koran.co.id/2019-03-01"
    blogs = [u for shard in units.shards(hplt.BLOGS) for u in units.read_shard(shard)]
    assert sorted(u.source for u in blogs) == ["blog.id", "blogspot.com"]  # a blog is not dated by its text
    census = pq.read_table(hplt.ROOT / "census" / "registers.parquet").to_pylist()
    assert sum(r["pages"] for r in census if r["register"] == "nb") == 1
