"""News articles become units without the furniture of the page around them."""

import json

import pytest
import zstandard

from idhist import units
from idhist.sources import ccnews


@pytest.fixture
def articles(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (ccnews.ROOT / "data").mkdir(parents=True)
    story = " ".join(f"kata{chr(97 + i % 26)}{chr(97 + i // 26)}" for i in range(60))
    docs = [
        {
            "url": f"https://daerah{i}.koran.co.id/2020/03/0{1 + i % 9}/berita-{i}",
            "timestamp": "2020-03-20T00:00:00",
            "text": f"Menu Olahraga Politik\nBaca juga: Gosip artis terbaru\n{story} unik{chr(97 + i)} sumber https://koran.co.id/berita-{i} dan Tribunnews.com\nIkuti kami di media sosial",
        }
        for i in range(30)
    ]
    docs.append(dict(docs[0], url="https://lain.koran.co.id/salinan"))  # the same article posted twice
    with zstandard.open(ccnews.ROOT / "data" / "cc_news_2020_id.jsonl.zst", "wt", encoding="utf-8") as f:
        f.writelines(json.dumps(d) + "\n" for d in docs)


def test_furniture_and_teasers_are_removed(articles):
    ccnews.find_furniture()
    ccnews.build_units()
    found = [u for shard in units.shards(ccnews.LENS) for u in units.read_shard(shard)]
    assert len(found) == 30  # the copy is dropped
    words = set().union(*(u.counts for u in found))
    assert {"kataaa", "unikh"} <= words
    assert not words & {"menu", "olahraga", "gosip", "artis", "ikuti", "sosial", "https", "koran", "com", "tribunnews"}
    assert {u.source for u in found} == {"koran.co.id"} and {u.year for u in found} == {2020}
    assert found[0].group.startswith("koran.co.id/2020-03-0")
