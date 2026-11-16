# Expected changes, written down before looking

`expected.tsv` was written on 2026-11-16, before the all-pairs measurement was
run and before any of its words had been looked up. It is the nearest thing to a
gold standard this project has: no labelled set of changed words exists for
Indonesian.

| kind | meaning |
|---|---|
| `change` | a word whose usage is documented or widely known to have changed between the periods `from` and `to`; `expect` says what its new company should be |
| `stable` | a word expected not to change in any window |
| `seen` | a word whose results had already been inspected; shown on the site, never counted |

`basis` points to `documented-changes.md` (with the source number there) where a source was found, `event` for a dated event, and `common` where
the only basis is that the change is common knowledge. A row for `id-news`
applies to every news lens.

## The test, fixed in advance

`python -m idhist.expected <lens>` computes, with no tuning afterwards:

1. For every `change` word, its shift between `from` and `to`. A word too rare
   to score in that window is reported as such and left out.
2. For every `stable` word, its shift in each distinct window used above.
3. **Primary outcome:** the AUC of change words against stable words.
4. **Secondary:** the share of each kind at or above the flagging threshold,
   which is fixed beforehand from the planted-change test (`idhist.planted`).

The list may gain rows later, but only with a new date in this file and only
for words not yet looked at. Rows are not removed or edited after results are
seen; a wrong expectation stays and is reported as a miss.

## Additions of 2026-11-16 (second registration)

Written before the web lenses (`id-web-news`, `id-web-eras`) were counted or measured; nothing of
them had been seen but page counts.

- **`id-web-news`**: the `id-news` rows again, word for word and window for window. The text is
  independent (the main Common Crawl and Internet Archive crawls via HPLT, not the news crawl),
  but the words are no longer unseen: this is a replication, and is reported as one.
- **`id-web-eras`**: 44 expectations about the decade of Joko Widodo's presidency (October 2014
  to October 2024), with presidential terms as periods. They include names (`jokowi`, `ahok`,
  `kpk`) and phrases (`ibu kota`), which the web lenses can count. Several are guesses and are
  marked `common`; one (`pindah`) is registered as expected *not* to reach the flag.
