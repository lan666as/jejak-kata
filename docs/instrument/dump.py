"""Dump planted targets + a background sample for one pair, to compare instruments quickly."""

import sys, numpy as np
from idhist.counts import Counts
from idhist.lenses import LENSES
from idhist.measure import Measures
from idhist import planted as P

lensname, A, B, out = sys.argv[1:5]
lens = LENSES[lensname]
a, b = lens.labels.index(A), lens.labels.index(B)
counts, real = Counts(lens), Measures.load(lens)
rng = np.random.default_rng(0)
scored = np.flatnonzero(real.scored(a, b))
df_b = counts.df[b].sum(0)
targets = np.sort(rng.choice(scored, 600, replace=False))
share = rng.choice(P.SHARES, len(targets))
donors = np.array([rng.choice(scored[(df_b[scored] >= s * df_b[t]) & (scored != t)]) for t, s in zip(targets, share)])
rate = share * df_b[targets] / df_b[donors]
cooc = counts.cooc(targets, [a, b])
clean = cooc.copy()
cooc[1] = rng.binomial(cooc[1], 1 - share[:, None]) + rng.binomial(counts.cooc(donors, [b])[0], rate[:, None])
df = counts.df[[a, b]][:, :, targets]
df_clean = df.copy()
df[1] = rng.binomial(df[1], 1 - share) + rng.binomial(counts.df[b][:, donors], rate)
bg = np.sort(rng.choice(np.setdiff1d(scored, targets), 3000, replace=False))
np.savez(
    out,
    cooc=cooc,
    df=df,
    clean=clean,
    df_clean=df_clean,
    share=share,
    targets=targets,
    bg=bg,
    cooc_bg=counts.cooc(bg, [a, b]),
    df_bg=counts.df[[a, b]][:, :, bg],
    df_contexts=counts.df[[a, b]][:, :, counts.columns],
    units=counts.units[[a, b]],
    own=counts.own,
)
