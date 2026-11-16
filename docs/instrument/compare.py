import sys, numpy as np
from idhist.measure import SPLITS, standardise
from idhist.planted import auc, SHARES
z = np.load(sys.argv[1])
own_all = z["own"]

def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return np.divide(v, n, out=v, where=n > 0)

def zero_own(v, own):
    w = np.flatnonzero(own >= 0); v[..., w, own[w]] = 0; return v

def ppmi(cooc, dfw, dfc, units, own, min_pairs=3, cds=1.0, shift=0.0):
    with np.errstate(divide="ignore", invalid="ignore"):
        pc = dfc.astype(np.float64) ** cds; pc = pc / pc.sum(-1, keepdims=True) if cds != 1 else dfc / units[..., None]
        pmi = np.log(cooc / (dfw[..., :, None] * pc[..., None, :]), dtype=np.float32) - shift
    pmi[~(pmi > 0) | (cooc < min_pairs)] = 0
    return unit(zero_own(pmi, own))

def sqrt_lift(cooc, dfw, dfc, units, own):
    with np.errstate(divide="ignore", invalid="ignore"):
        v = np.sqrt(cooc / dfc[..., None, :], dtype=np.float32)
    v[~np.isfinite(v)] = 0
    return unit(zero_own(v, own))

def sqrt_prob(cooc, dfw, dfc, units, own):
    return unit(zero_own(np.sqrt(cooc, dtype=np.float32), own))

def lift(cooc, dfw, dfc, units, own):
    with np.errstate(divide="ignore", invalid="ignore"):
        v = (cooc / dfc[..., None, :]).astype(np.float32)
    v[~np.isfinite(v)] = 0
    return unit(zero_own(v, own))

def log1p_lift(cooc, dfw, dfc, units, own):
    with np.errstate(divide="ignore", invalid="ignore"):
        v = np.log1p(cooc * units[..., None, None] / (dfw[..., :, None] * dfc[..., None, :]), dtype=np.float32)
    v[~np.isfinite(v)] = 0
    return unit(zero_own(v, own))

def sqrt_excess(cooc, dfw, dfc, units, own):
    # variance-stabilised residual: sqrt(observed) - sqrt(expected), positive part
    with np.errstate(divide="ignore", invalid="ignore"):
        e = dfw[..., :, None] * (dfc / units[..., None])[..., None, :]
        v = (np.sqrt(cooc) - np.sqrt(e)).astype(np.float32)
    v[~(v > 0)] = 0
    return unit(zero_own(v, own))

def sqrt_resid(cooc, dfw, dfc, units, own):
    # signed variance-stabilised residual
    with np.errstate(divide="ignore", invalid="ignore"):
        e = dfw[..., :, None] * (dfc / units[..., None])[..., None, :]
        v = (np.sqrt(cooc) - np.sqrt(e)).astype(np.float32)
    v[~np.isfinite(v)] = 0
    return unit(zero_own(v, own))

def distances(fn, cooc, dfw, dfc, units, own):
    total, support = 0, np.inf
    for split in SPLITS:
        one, two = (fn(cooc[:, h].sum(1, dtype=np.float32), dfw[:, h].sum(1), dfc[:, h].sum(1), units[:, h].sum(1), own).swapaxes(0, 1) for h in split)
        sim = one @ two.swapaxes(1, 2)
        total += 1 - (sim + sim.swapaxes(1, 2)) / 2
        support = np.minimum(support, np.minimum(*(dfw[:, h].sum(1) for h in split)))
    return np.moveaxis(total / len(SPLITS), 0, 2), support

def run(name, fn):
    out = {}
    for key, c, d, ids in (("t", z["cooc"], z["df"], z["targets"]), ("bg", z["cooc_bg"], z["df_bg"], z["bg"]), ("clean", z["clean"], z["df_clean"], z["targets"])):
        dist, sup = [], []
        for s in range(0, c.shape[2], 600):
            r = slice(s, s + 600)
            a, b = distances(fn, c[:, :, r], d[:, :, r], z["df_contexts"], z["units"], own_all[ids[r]])
            dist.append(a); sup.append(b)
        dist = np.concatenate(dist, 2); sup = np.concatenate(sup, 1)
        out[key] = (dist[0, 1] - (dist[0, 0] + dist[1, 1]) / 2, sup.min(0), dist)
    e = np.concatenate([out["t"][0], out["bg"][0]]); f = np.concatenate([out["t"][1], out["bg"][1]])
    import idhist.measure as M; M.PEERS = 301
    sh = standardise(e, f); n = len(out["t"][0]); st, sb = sh[:n], sh[n:]
    thr = np.quantile(sb, 0.975)
    floor = np.median(out["bg"][2][0, 0]); exb = np.median(out["bg"][0])
    row = f"{name:22}"
    for s in SHARES:
        m = z["share"] == s
        row += f" {auc(st[m], sb):.3f}/{(st[m] >= thr).mean():.2f}"
    # effect of planting on the same word, in units of background spread
    eff = (out["t"][0] - out["clean"][0]) / (1.4826 * np.median(np.abs(out["bg"][0] - np.median(out["bg"][0]))))
    row += "  | effect/bg-spread: " + " ".join(f"{np.median(eff[z['share'] == s]):5.1f}" for s in SHARES)
    row += f" | floor {floor:.3f} bg-excess {exb:.3f}"
    print(row, flush=True)

print("instrument              " + " ".join(f"{s:>10}" for s in SHARES) + "   (AUC / found at 2.5% false alarms)")
todo = {
 "ppmi (current)": ppmi,
 "ppmi min_pairs=1": lambda *a: ppmi(*a, min_pairs=1),
 "ppmi cds .75": lambda *a: ppmi(*a, cds=0.75),
 "sqrt lift": sqrt_lift,
 "sqrt prob": sqrt_prob,
 "lift": lift,
 "log1p lift": log1p_lift,
 "sqrt excess +": sqrt_excess,
 "sqrt resid signed": sqrt_resid,
}
for k in (sys.argv[2:] or todo): run(k, todo[k])

# ---- L1-type distances (linear in the planted share) ----
def dist_prob(cooc, dfw, dfc, units, own, lift=False):
    v = cooc.astype(np.float32)
    if lift:
        with np.errstate(divide="ignore", invalid="ignore"):
            v = v / dfc[..., None, :] * units[..., None, None]
        v[~np.isfinite(v)] = 0
    v = zero_own(v, own)
    s = v.sum(-1, keepdims=True)
    return np.divide(v, s, out=v, where=s > 0)

def l1(p, q): return 0.5 * np.abs(p - q).sum(-1)
def jsd(p, q):
    m = (p + q) / 2
    def kl(x):
        with np.errstate(divide="ignore", invalid="ignore"):
            t = x * np.log2(x / m)
        t[~np.isfinite(t)] = 0
        return t.sum(-1)
    return 0.5 * (kl(p) + kl(q))

def distances2(fn, metric, cooc, dfw, dfc, units, own):
    P = cooc.shape[0]; total = np.zeros((P, P, cooc.shape[2])); support = np.inf
    for split in SPLITS:
        one, two = (fn(cooc[:, h].sum(1, dtype=np.float32), dfw[:, h].sum(1), dfc[:, h].sum(1), units[:, h].sum(1), own) for h in split)
        for p in range(P):
            for q in range(P):
                total[p, q] += (metric(one[p], two[q]) + metric(two[p], one[q])) / 2
        support = np.minimum(support, np.minimum(*(dfw[:, h].sum(1) for h in split)))
    return total / len(SPLITS), support

_d = distances
def run2(name, fn, metric):
    global distances
    distances = lambda f, *a: distances2(fn, metric, *a)
    run(name, None)
    distances = _d

if not sys.argv[2:]:
    run2("L1 prob", dist_prob, l1)
    run2("L1 lift", lambda *a: dist_prob(*a, lift=True), l1)
    run2("JSD prob", dist_prob, jsd)
    run2("JSD lift", lambda *a: dist_prob(*a, lift=True), jsd)
