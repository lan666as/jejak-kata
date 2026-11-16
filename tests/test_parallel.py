"""A worker that dies must end the run, not leave it waiting."""

import os
from concurrent.futures.process import BrokenProcessPool

import pytest

from idhist import parallel


def _double(x: int) -> int:
    return 2 * x


def _die(x: int) -> int:
    os._exit(1)


def test_results_come_back_in_order_when_asked():
    assert list(parallel(_double, range(20), ordered=True)) == [2 * x for x in range(20)]
    assert sorted(parallel(_double, range(20))) == [2 * x for x in range(20)]


def test_a_dead_worker_raises():
    with pytest.raises(BrokenProcessPool):
        list(parallel(_die, range(3)))
