"""The whole path from units to scores, on a corpus with one planted change."""

import json

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from idhist import counts, export, measure, planted, units
from idhist.lenses import Lens, bins
from idhist.sources import wikipedia

TOPICS = 8
WORDS_PER_TOPIC = 30
LENS = Lens("toy", "toy", bins(2000, 2002, 1), vocab=1000, contexts=200, skip=10)


def corpus(rng: np.random.Generator):
    """Units of two topics each. `mover` belongs to topic 0, then to topic 1 in the last year.

    `tokoh` and `warga` are always capitalised: two names, of which only the first has a Wikipedia article.
    """
    for year in range(2000, 2003):
        for i in range(3000):
            topics = rng.choice(TOPICS, 2, replace=False)
            words = {f"t{t}w{w}" for t in topics for w in rng.choice(WORDS_PER_TOPIC, 12, replace=False)}
            words |= {f"common{w}" for w in rng.choice(12, 8, replace=False)}
            if (1 if year == 2002 else 0) in topics and rng.random() < 0.5:
                words.add("mover")
            names = {name for name in ("tokoh", "warga") if rng.random() < 0.3}
            bag = dict.fromkeys(words | names, 1)
            yield units.Unit(f"{year}-{i // 5}", "s", year, units.Counter(bag), units.Counter(dict.fromkeys(names, 1)))


@pytest.fixture(scope="module")
def measures(tmp_path_factory):
    with pytest.MonkeyPatch.context() as patch:
        patch.chdir(tmp_path_factory.mktemp("data"))
        patch.setattr(counts, "RUN", 1)  # so that the shard below is a run of its own
        units.write_shard("toy", "0000", corpus(np.random.default_rng(0)))
        before = units.Unit("1990-0", "s", 1990, units.Counter({"kuno": 1}), units.Counter())
        units.write_shard("toy", "1990", [before] * 3)  # a shard from before the lens's periods counts for nothing
        out = counts.ROOT / LENS.name
        out.mkdir(parents=True)
        for step in (counts.build_frequencies, counts.build_parts, counts.merge_parts):
            step(LENS, out)
        measure.measure(LENS)
        wikipedia.TITLES.parent.mkdir(parents=True)
        pq.write_table(pa.table({"title": ["tokoh"], "article": ["Tokoh (orang)"]}), wikipedia.TITLES)
        pq.write_table(pa.table({"article": ["Tokoh (orang)"], "kind": ["person"]}), wikipedia.KINDS)
        wikipedia.titles.cache_clear()
        yield counts.Counts(LENS), measure.Measures.load(LENS)


def test_counts_add_up(measures):
    c, _ = measures
    assert c.units.sum() == 9000 and "kuno" not in c.row
    assert c.cooc(slice(0, 5)).shape == (3, counts.FOLDS, 5, len(c.contexts))
    i, j = c.row["t3w1"], c.contexts.index("t3w2")
    assert 0 < c.cooc([i])[:, :, 0, j].sum() <= c.df[:, :, i].sum()


def test_planted_change_stands_out(measures):
    c, m = measures
    mover = c.row["mover"]
    assert m.scored(0, 2)[mover]
    assert np.nanargmax(m.shift(0, 2)) == mover
    assert np.nanargmax(m.shift(1, 2)) == mover
    assert m.excess(0, 2)[mover] > 0.3
    assert abs(m.excess(0, 1)[mover]) < 0.1  # nothing happened between the first two years


def test_noise_floor_is_the_diagonal(measures):
    _, m = measures
    assert np.allclose(m.distance, m.distance.swapaxes(0, 1), atol=1e-6)
    stable = m.scored(0, 2)
    assert np.median(m.excess(0, 2)[stable]) < 0.05


def test_planted_changes_are_found(measures, monkeypatch):
    monkeypatch.setattr(planted, "SHARES", (0.8,))
    result = planted.evaluate(LENS, 0, 1)
    assert result["by_share"][0]["auc"]["shift"] > 0.85  # one donor in eight shares the topic


def test_export_writes_what_the_site_reads(measures):
    c, _ = measures
    export.export(LENS)
    out = export.ROOT / LENS.name
    meta = json.loads((out / "meta.json").read_text())
    assert meta["words"] == c.words and meta["pairs"] == [[0, 1], [0, 2], [1, 2]]
    mover = c.row["mover"]
    entry = next(
        e for e in json.loads((out / "words" / f"{mover // export.BUCKET}.json").read_text()) if e["word"] == mover
    )
    assert entry["shift"][1] > entry["shift"][0]  # 2000 -> 2002 moved, 2000 -> 2001 did not
    company = lambda period: {c.words[i][:2] for i in entry["with"][period]}
    assert company(0) == {"t0"} and company(2) == {"t1"}
    assert json.loads((out / "movers.json").read_text())[-1]["words"][0][0] == mover


def test_a_name_is_an_entry_only_if_wikipedia_knows_it(measures):
    c, _ = measures
    out = export.ROOT / LENS.name
    meta = json.loads((out / "meta.json").read_text())
    assert meta["entities"] == {str(c.row["tokoh"]): "Tokoh (orang)"} and meta["names"] == [c.row["warga"]]
    assert meta["kinds"] == {str(c.row["tokoh"]): "person"}
    entries = {e["word"] for path in (out / "words").glob("*.json") for e in json.loads(path.read_text())}
    assert c.row["tokoh"] in entries and c.row["warga"] not in entries


def test_highlights_name_a_periods_own_words(measures, tmp_path, monkeypatch):
    c, _ = measures
    monkeypatch.setattr(export, "ADJECTIVES", tmp_path / "adjectives.txt")
    export.ADJECTIVES.write_text("# none of these occur\nbagus tegas\n")
    export.highlights(LENS)
    found = json.loads((export.ROOT / LENS.name / "highlights.json").read_text())
    assert len(found["peaks"]) == 3 and c.row["warga"] not in {w for period in found["peaks"] for w in period}
    assert found["traits"] == {str(c.row["tokoh"]): [[], [], []]}  # the toy corpus has no adjectives
    mover = c.row["mover"]
    path = next(
        p
        for p in json.loads((export.ROOT / LENS.name / "paths" / f"{mover // export.BUCKET}.json").read_text())
        if p["word"] == mover
    )
    near = [c.words[i][:2] for i in path["near"]]
    assert near[: path["early"]] == ["t0"] * path["early"] and set(near[path["early"] :]) == {"t1"}
    distance = lambda at, group: min(np.hypot(*np.subtract(at, xy)) for xy, n in zip(path["at"], near) if n == group)
    assert distance(path["path"][0], "t0") < distance(path["path"][0], "t1")  # it starts among its old neighbours
    assert distance(path["path"][2], "t1") < distance(path["path"][2], "t0")  # and ends among its new ones
