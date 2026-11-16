"""The whole path from units to scores, on a corpus with one planted change."""

import json

import numpy as np
import pytest

from idhist import counts, export, measure, planted, units
from idhist.lenses import Lens, bins

TOPICS = 8
WORDS_PER_TOPIC = 30
LENS = Lens("toy", "toy", bins(2000, 2002, 1), vocab=1000, contexts=200, skip=10)


def corpus(rng: np.random.Generator):
    """Units of two topics each. `mover` belongs to topic 0, then to topic 1 in the last year."""
    for year in range(2000, 2003):
        for i in range(3000):
            topics = rng.choice(TOPICS, 2, replace=False)
            words = {f"t{t}w{w}" for t in topics for w in rng.choice(WORDS_PER_TOPIC, 12, replace=False)}
            words |= {f"common{w}" for w in rng.choice(12, 8, replace=False)}
            if (1 if year == 2002 else 0) in topics and rng.random() < 0.5:
                words.add("mover")
            bag = dict.fromkeys(words, 1)
            yield units.Unit(f"{year}-{i // 5}", "s", year, units.Counter(bag), units.Counter())


@pytest.fixture(scope="module")
def measures(tmp_path_factory):
    with pytest.MonkeyPatch.context() as patch:
        patch.chdir(tmp_path_factory.mktemp("data"))
        units.write_shard("toy", "0000", corpus(np.random.default_rng(0)))
        out = counts.ROOT / LENS.name
        out.mkdir(parents=True)
        for step in (counts.build_frequencies, counts.build_parts, counts.merge_parts):
            step(LENS, out)
        measure.measure(LENS)
        yield counts.Counts(LENS), measure.Measures.load(LENS)


def test_counts_add_up(measures):
    c, _ = measures
    assert c.units.sum() == 9000
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
