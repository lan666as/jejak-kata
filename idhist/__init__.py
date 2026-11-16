"""Diachronic word profiles for Indonesian and the regional languages of Indonesia."""

import os
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ProcessPoolExecutor, as_completed

import pyarrow

# Parallel workers for the heavy stages. Set IDHIST_WORKERS=1 on a shared machine.
WORKERS = int(os.environ.get("IDHIST_WORKERS", os.cpu_count() or 1))

# One process is one worker: parallelism comes from WORKERS processes, not from threads inside them.
pyarrow.set_cpu_count(1)
pyarrow.set_io_thread_count(1)


def parallel(function: Callable, jobs: Iterable, ordered: bool = False) -> Iterator:
    """`function(job)` for every job, on WORKERS processes; results as they finish unless `ordered`.

    If a worker dies (out of memory, usually) this raises, where `multiprocessing.Pool` would wait for ever.
    """
    with ProcessPoolExecutor(WORKERS) as pool:
        if ordered:
            yield from pool.map(function, jobs)
        else:
            for future in as_completed([pool.submit(function, job) for job in jobs]):
                yield future.result()
