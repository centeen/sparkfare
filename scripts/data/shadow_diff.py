#!/usr/bin/env python3
"""Shadow diff (Addendum N, N10): the shadow serving files against the ones the site serves today, counts only.

Per file and per origin: records on each side, records only in the served file (missing) or only in the shadow (added), verdict
(status) changes, price differences, `pct_below` differences above 0.1 point (the mean-based figure and the median-based one the
badge states), and the counts the site shows (deals, typical, building history, no data).  No prices, no routes beyond counts.
`diff_files()` returns the numbers, `render_markdown()` the short summary written to docs/data/shadow_diffs/.

  python scripts/data/shadow_diff.py --pair NAME SHADOW.json SERVED.json [--pair ...] --date YYYY-MM-DD --out DIFF.md [--json-out DIFF.json]
"""
import argparse
import json
import sys
from pathlib import Path

BUCKETS = ("deals", "featured", "priced_no_deal", "insufficient_history", "no_data")
PCT_TOLERANCE_POINTS = 0.1
SHOWN = {"deals": "deals", "priced_no_deal": "typical fares", "featured": "featured", "insufficient_history": "building history", "no_data": "no data"}
CHECKS = ("missing", "added", "status_changes", "price_diffs", "pct_mean_diffs", "pct_median_diffs")


def index(doc):
    out = {}
    for b in BUCKETS:
        for r in doc.get(b, []):
            out[r.get("route_key") or r.get("display_name")] = r
    return out


def median_pct(r):
    m, p = r.get("median_baseline"), r.get("price")
    return (m - p) / m * 100 if isinstance(m, (int, float)) and m > 0 and isinstance(p, (int, float)) else None


def mean_pct(r):
    v = r.get("pct_below_avg")
    return v * 100 if isinstance(v, (int, float)) else None


def differs(a, b, tol=PCT_TOLERANCE_POINTS):
    if a is None or b is None:
        return (a is None) != (b is None)
    return abs(a - b) > tol


def blank():
    return {"served": 0, "shadow": 0, **{c: 0 for c in CHECKS},
            **{f"served_{b}": 0 for b in BUCKETS}, **{f"shadow_{b}": 0 for b in BUCKETS}}


def diff_files(shadow, served):
    """{origin: counts, '_all': counts, 'transitions': {'a -> b': n}} for one pair of serving files (served is the baseline)."""
    s, v = index(shadow), index(served)
    out = {"_all": blank()}
    transitions = {}

    def row(origin):
        return out.setdefault(origin or "?", blank())

    for bucket in BUCKETS:
        for r in served.get(bucket, []):
            for t in (row(r.get("origin")), out["_all"]):
                t["served"] += 1
                t[f"served_{bucket}"] += 1
        for r in shadow.get(bucket, []):
            for t in (row(r.get("origin")), out["_all"]):
                t["shadow"] += 1
                t[f"shadow_{bucket}"] += 1
    for key, rec in v.items():
        tgts = (row(rec.get("origin")), out["_all"])
        other = s.get(key)
        if other is None:
            for t in tgts:
                t["missing"] += 1
            continue
        if other.get("status") != rec.get("status"):
            for t in tgts:
                t["status_changes"] += 1
            k = f"{rec.get('status')} -> {other.get('status')}"
            transitions[k] = transitions.get(k, 0) + 1
        if other.get("price") != rec.get("price"):
            for t in tgts:
                t["price_diffs"] += 1
        if differs(mean_pct(rec), mean_pct(other)):
            for t in tgts:
                t["pct_mean_diffs"] += 1
        if differs(median_pct(rec), median_pct(other)):
            for t in tgts:
                t["pct_median_diffs"] += 1
    for key, rec in s.items():
        if key not in v:
            for t in (row(rec.get("origin")), out["_all"]):
                t["added"] += 1
    out["transitions"] = dict(sorted(transitions.items()))
    return out


def clean(d):
    return all(d[c] == 0 for c in CHECKS)


def render_markdown(date, results):
    """results: {file name: diff_files() output, or None when a side was unavailable}."""
    lines = [f"# Shadow diff {date}", "",
             "Counts only. The shadow files are ranked from the curated store (`fare_daily`); the served files are the ones in git today.",
             "A difference is expected where the old script used a per-pipeline history trimmed to 30 days; every difference needs an explanation in the PR or the approval pack.", ""]
    for name, d in results.items():
        lines.append(f"## {name}")
        if d is None:
            lines += ["", "Not compared: a side was unavailable.", ""]
            continue
        a = d["_all"]
        shown = ", ".join(f"{label} {a['served_' + b]}/{a['shadow_' + b]}" for b, label in SHOWN.items())
        lines += ["",
                  f"- Records: served {a['served']}, shadow {a['shadow']}; only in served {a['missing']}, only in shadow {a['added']}.",
                  f"- Verdict changes {a['status_changes']}, price differences {a['price_diffs']}, "
                  f"pct below (mean) differing over {PCT_TOLERANCE_POINTS} point {a['pct_mean_diffs']}, (median) {a['pct_median_diffs']}.",
                  f"- Shown on the site (served / shadow): {shown}.",
                  "- Result: " + ("**identical**" if clean(a) else "**differences below**")]
        if d["transitions"]:
            lines.append("- Verdict transitions (served -> shadow): " + ", ".join(f"{k}: {n}" for k, n in d["transitions"].items()))
        origins = sorted(o for o in d if o not in ("_all", "transitions"))
        bad = [o for o in origins if not clean(d[o])]
        if bad:
            lines += ["", "| Origin | served | shadow | missing | added | verdict changes | price diffs | pct (mean) | pct (median) | deals served/shadow |",
                      "|---|---|---|---|---|---|---|---|---|---|"]
            for o in bad:
                x = d[o]
                lines.append(f"| {o} | {x['served']} | {x['shadow']} | {x['missing']} | {x['added']} | {x['status_changes']} | {x['price_diffs']} | "
                             f"{x['pct_mean_diffs']} | {x['pct_median_diffs']} | {x['served_deals']}/{x['shadow_deals']} |")
        lines.append("")
    return "\n".join(lines)


def summary(results):
    """Small JSON for the Monday standup and the R2 pointer."""
    keys = ("served", "shadow") + CHECKS
    return {name: (None if d is None else {"clean": clean(d["_all"]), **{k: d["_all"][k] for k in keys}}) for name, d in results.items()}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pair", nargs=3, action="append", metavar=("NAME", "SHADOW", "SERVED"), required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--json-out")
    a = ap.parse_args(argv)
    results = {}
    for name, sh, sv in a.pair:
        shp, svp = Path(sh), Path(sv)
        ok = shp.exists() and svp.exists()
        results[name] = diff_files(json.loads(shp.read_text(encoding="utf-8")), json.loads(svp.read_text(encoding="utf-8"))) if ok else None
    Path(a.out).write_text(render_markdown(a.date, results), encoding="utf-8")
    if a.json_out:
        Path(a.json_out).write_text(json.dumps({"date": a.date, "files": summary(results)}, indent=2), encoding="utf-8")
    print(json.dumps(summary(results)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
