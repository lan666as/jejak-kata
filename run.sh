#!/usr/bin/env bash
# Rebuild everything from the sources, in order.
#   ./run.sh                 all stages
#   ./run.sh measure export  some stages
# Each stage uses IDHIST_WORKERS processes (default: all cores). The stages up to
# `counts` are heavy for the large lenses: hours on one core, minutes on a rented
# many-core machine.
set -euo pipefail

# lens : the two periods its planted-change test is run on
LENSES="
id-books:2000-2004:2005-2009
jv-books:1970-1989:1990-2019
su-books:1980-1989:1990-2019
id-abstracts:2017-2018:2019-2020
id-web-news:2018:2019
id-web-news-kompas:2018:2019
id-web-eras-kompas:2015-2019:2020-2024
id-web-eras-tempo:2015-2019:2020-2024
id-web-eras-tribun:2015-2019:2020-2024
id-web-blogs:2013-2014:2015-2016
"
COUNTED="tempo tribun bisnis okezone detik liputan6 viva polri tni"  # publishers counted year by year, not scored (idhist/lenses.py)
EXPECTED="id-books id-web-news id-web-news-kompas id-web-eras-kompas id-web-eras-tempo id-web-eras-tribun"  # lenses that validation/expected.tsv covers

each() { for entry in $LENSES; do python -m "idhist.$1" "${entry%%:*}"; done; }

stage_fetch() {
  for source in hathitrust openalex wikipedia hplt; do python -m idhist.sources.$source fetch; done
}
stage_units() {
  python -m idhist.sources.hathitrust units
  python -m idhist.sources.openalex units
  python -m idhist.sources.wikipedia titles
  for step in furniture copies phrases units text; do python -m idhist.sources.hplt $step; done
}
stage_counts()   {
  each counts
  for name in $COUNTED; do python -m idhist.counts "id-web-news-$name"; done
}
stage_measure()  { each measure; }
stage_validate() {
  for entry in $LENSES; do python -m idhist.planted ${entry//:/ }; done
  for lens in $EXPECTED; do python -m idhist.expected "$lens"; done
}
stage_export()   { each export; each highlights; python -m idhist.together; }
stage_look()     {  # the site used like a reader, in a real browser; needs `npm install` in tests/site once
  for f in site/*.js; do node --check "$f"; done
  node tests/site/stories.mjs && node tests/site/pages.mjs && node tests/site/hero.mjs && node tests/site/webkit.mjs  # webkit: skips where WebKit cannot run
}
stage_deploy()   {  # publish site/ (with its data and its generated pages) as the gh-pages branch, if it passes `look` and meta.mjs; not part of a plain ./run.sh
  stage_look
  local tree; tree=$(mktemp -d)
  cp -r site/. "$tree" && touch "$tree/.nojekyll"
  # Every story and main page as an address of its own (its page, share image, place in the sitemap and the feeds),
  # made from the site as it is now, then checked as link previews and search engines read it.
  node tests/site/publish.mjs "$tree" && node tests/site/meta.mjs "$tree"
  git -C "$tree" init -q -b gh-pages && git -C "$tree" add -A
  git -C "$tree" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Site built $(date -u +%F)"
  git -C "$tree" push -q -f "$(git remote get-url origin)" gh-pages
  rm -rf "$tree"
}

for stage in "${@:-fetch units counts measure validate export}"; do
  echo "== $stage $(date -u +%FT%TZ)"
  "stage_$stage"
done
