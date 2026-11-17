"""News of detik.com's news channel, from the site's own index by date (which starts on 28 March 2004).

    python -m idhist.sources.detik fetch 2008-10-01 2008-10-31    # one file per day under data/raw/detik

The index lists every story of a day; each story's page carries its time of publication to the second.
The site's robots file allows every client everywhere. LINES requests are open at a time, each line
waiting PAUSE seconds before every request (three to four requests a second in all), pages come compressed,
and a day already fetched is not fetched again. A story the index lists but the site no longer has (readers'
letters, mostly) is left out. The text is kept as it is on the page (paragraphs as
lines); what is furniture is decided later, as for every web source (`idhist/web.py`).
"""

import argparse
import gzip
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path("data/raw/detik")
INDEX = "https://news.detik.com/indeks?page={page}&date={day:%m/%d/%Y}"
AGENT = "idhist/0.1 (research; counts of words in dated text)"
PAUSE = 1.0  # seconds a line waits before each request
LINES = 6  # requests open at a time
TRIES = 4

_STORY = re.compile(r'href="(https://news\.detik\.com/[\w-]+/d-(\d+)/[^"?#]+)"')
_PAGE = re.compile(r"indeks\?page=(\d+)")
_PUBLISHED = re.compile(r'<meta name="publishdate" content="([^"]+)"')
_TITLE = re.compile(r'<meta property="og:title" content="([^"]*)"')
_BLOCKS = {"p", "div", "br", "li", "h2", "h3", "table", "tr"}
_SKIPPED = {"script", "style", "iframe", "figure", "table"}
_VOID = {"br", "img", "input", "meta", "link", "hr", "source", "wbr"}


def _get(url: str) -> str:
    for attempt in range(TRIES):
        time.sleep(PAUSE * (1 + 4 * attempt))
        try:
            asked = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(asked, timeout=40) as r:
                page = r.read()
                return (gzip.decompress(page) if r.headers.get("Content-Encoding") == "gzip" else page).decode(
                    "utf-8", errors="replace"
                )
        except OSError as error:  # refused, timed out, 4xx, 5xx
            if getattr(error, "code", None) == 404:
                return ""
            last = error
    raise RuntimeError(f"{url}: {last}")


class _Body(HTMLParser):
    """The text inside the story's body element, one line per paragraph."""

    def __init__(self) -> None:
        super().__init__()
        self.depth = self.skip = 0  # depth inside the body; depth inside something skipped
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if not self.depth:
            self.depth = "detail__body-text" in (dict(attrs).get("class") or "")
            return
        if tag in _VOID:
            self.parts.append("\n" if tag == "br" else "")
            return
        self.depth += 1
        if self.skip or tag in _SKIPPED:
            self.skip += 1
        elif tag in _BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self.depth and tag not in _VOID:
            self.depth -= 1
            self.skip -= bool(self.skip)
            if tag in _BLOCKS:
                self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.depth and not self.skip:
            self.parts.append(data)


def story(page: str) -> tuple[str, str, str]:
    """(published, title, text) of a story's page; the text is "" when the page has no body."""
    body = _Body()
    body.feed(page)
    lines = (re.sub(r"\s+", " ", line).strip() for line in "".join(body.parts).split("\n"))
    published, title = _PUBLISHED.search(page), _TITLE.search(page)
    return published[1] if published else "", unescape(title[1]) if title else "", "\n".join(filter(None, lines))


def listed(day: date) -> dict[str, str]:
    """Every story the index lists for a day: id -> address. The index sometimes serves a page twice, so a page
    with nothing new does not end the day: only the last page the index itself links to does."""
    found: dict[str, str] = {}
    page = last = 1
    while page <= min(last, 400):
        listing = _get(INDEX.format(page=page, day=day))
        stories = {i: url for url, i in _STORY.findall(listing)}
        if not stories:  # a day the index has nothing for still links to pages, of some other day
            break
        found |= stories
        last = max(last, *(int(n) for n in _PAGE.findall(listing)))
        page += 1
    return found


def fetch(first: date, last: date) -> None:
    for n in range((last - first).days + 1):
        day = first + timedelta(n)
        out = ROOT / f"{day.year}" / f"{day}.parquet"
        if out.exists():
            continue
        found = listed(day)
        with ThreadPoolExecutor(LINES) as lines:
            pages = lines.map(lambda url: story(_get(url + "?single=1")), found.values())
        rows = [
            {"id": int(i), "url": url, "published": published, "title": title, "text": text}
            for (i, url), (published, title, text) in zip(found.items(), pages)
            if published
        ]
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        pq.write_table(pa.Table.from_pylist(rows), tmp, compression="zstd")
        tmp.rename(out)
        print(
            f"{day}: {len(rows)} stories of {len(found)} listed, {sum(not r['text'] for r in rows)} without text",
            flush=True,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["fetch"])
    parser.add_argument("first", type=date.fromisoformat)
    parser.add_argument("last", type=date.fromisoformat)
    args = parser.parse_args()
    fetch(args.first, args.last)
