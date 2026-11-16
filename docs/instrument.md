# Choosing the instrument (2026-11-16)

Question: which way of turning co-occurrence counts into a word profile best
separates words with a planted change from all other words? Test as in
`idhist/planted.py`: in the later of two real periods, a share of a word's
occurrences is replaced with those of a random donor word; 600 planted words,
3,000 unplanted words as background; every candidate gets the same split-half
noise floor and the same standardisation against words of similar frequency.
Scripts: `docs/instrument/dump.py` (builds the test set once) and
`compare.py` (scores the candidates). They are a record, not part of the build.

Each cell: AUC / share of planted words found at a threshold that flags 2.5% of
unplanted words. About 120 planted words per column, so differences under
about 0.03 AUC or 0.05 found are noise.

## News, 2018 -> 2019

| profile | 5% | 10% | 20% | 40% | 80% |
|---|---|---|---|---|---|
| PPMI, pairs >= 3 (first build) | .526/.01 | .506/.03 | .583/.02 | .765/.10 | .953/.61 |
| PPMI, pairs >= 1 | .525/.01 | .507/.03 | .580/.02 | .774/.08 | .950/.61 |
| PPMI, context smoothing 0.75 | .524/.02 | .534/.04 | .550/.03 | .721/.07 | .915/.35 |
| sqrt of lift (Hellinger on lift) | .527/.02 | .521/.02 | .547/.03 | .758/.12 | .941/.53 |
| sqrt of probability (Hellinger) | .546/.02 | .531/.02 | .535/.02 | .741/.08 | .931/.40 |
| lift | .513/.00 | .515/.02 | .544/.01 | .752/.13 | .935/.45 |
| log(1 + lift) | .533/.01 | .520/.02 | .556/.01 | .764/.13 | .949/.59 |
| sqrt(obs) - sqrt(exp), positive part | .540/.02 | .511/.02 | .583/.02 | .780/.10 | .955/.62 |
| **sqrt(obs) - sqrt(exp), signed** | .528/.02 | .524/.03 | .624/.02 | .818/.16 | .962/.70 |
| L1 on probability | .547/.03 | .528/.02 | .534/.02 | .746/.08 | .935/.43 |
| L1 on lift | .533/.02 | .520/.01 | .545/.03 | .752/.09 | .939/.49 |
| Jensen-Shannon on probability | .547/.02 | .531/.02 | .535/.02 | .742/.08 | .932/.39 |
| Jensen-Shannon on lift | .529/.02 | .522/.01 | .547/.02 | .757/.09 | .941/.50 |

## Books, 2000-2004 -> 2005-2009

| profile | 5% | 10% | 20% | 40% | 80% |
|---|---|---|---|---|---|
| PPMI, pairs >= 3 | .517/.04 | .584/.01 | .707/.12 | .883/.40 | .987/.91 |
| sqrt of lift | .538/.04 | .607/.02 | .683/.12 | .912/.35 | .980/.84 |
| sqrt(obs) - sqrt(exp), positive part | .515/.03 | .577/.00 | .719/.11 | .904/.40 | .989/.92 |
| **sqrt(obs) - sqrt(exp), signed** | .512/.02 | .586/.00 | .743/.11 | .929/.54 | .986/.93 |

Reducing the PPMI profiles by truncated SVD and aligning them with orthogonal
Procrustes, as embedding methods do, scored within noise of plain PPMI on news
(.805 at 40%, .960 at 80%).

## What this says

1. **The form of the profile barely matters; the background does.** Thirteen
   variants land within a few points of each other. What limits detection is
   how much ordinary words move anyway: in yearly news, the typical word moves
   about as much as a word with a third of its usage replaced. Books are much
   calmer, and the same planted change is far easier to see there.
2. **Small changes are not detectable by any of them.** A new sense that takes
   20% of a word's usage is found about one time in ten in books and not at all
   in news. The site can only claim large changes.
3. **The signed square-root residual is adopted.** It is the best or equal-best
   in both sources (ahead of PPMI by about two standard errors at 40% in each),
   and it is simpler: no logarithm of zero, no minimum pair count, and every
   entry of the profile has the same noise.
