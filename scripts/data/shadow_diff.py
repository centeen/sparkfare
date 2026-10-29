#!/usr/bin/env python3
"""Shadow diff (Addendum N, N10): the shadow serving files against the ones the site serves today, counts only.

Per file and per origin: records on each side, records only in the served file (missing) or only in the shadow (added), verdict
(status) changes, price differences, `pct_below` differences above 0.1 point (the mean-based figure and the median-based one the
badge states), and the counts the site shows (deals, typical, building history, no data).  No prices, no routes beyond counts.
`diff_files()` returns the numbers, `render_markdown()` the short summary written to docs/data/shadow_diffs/.

  python scripts/data/shadow_diff.py --pair NAME SHADOW.json SERVED.json [--pair ...] --date YYYY-MM-DD --out DIFF.md [--json-out DIFF.json]
                                     [--records-out RECORDS.md] [--records-json RECORDS.json]

`--records-out` adds the record-level report (explain_records): every route whose verdict or price differs, with both sides' numbers, and a check of each
shadow deal against the deal rules (D-021: at least 15% below the 30-day median, at least 10 distinct observation days over at least 14 days). Routes and prices
are public data; the counts-only summary above stays what the workflow commits.
"""
import argparse
import json
import sys
from pathlib import Path

BUCKETS = ("deals", "featured", "priced_no_deal", "insufficient_history", "no_data")
PCT_TOLERANCE_POINTS = 0.1
# The deal rules the shadow must keep (Phase 1 Deal Ranking Script: MIN_DEAL_PCT_BELOW, MIN_HISTORY_POINTS, MIN_HISTORY_SPAN_DAYS).
RULE_MIN_PCT_BELOW = 0.15
RULE_MIN_DISTINCT_DAYS = 10
RULE_MIN_SPAN_DAYS = 14
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


def observation_days(rec):
    """(distinct days, span in days) of a record's observations, one per calendar date, the same way the ranking script counts them."""
    dates = sorted({str(o.get("date", ""))[:10] for o in rec.get("observations") or [] if o.get("date") and isinstance(o.get("price"), (int, float))})
    if not dates:
        return 0, 0
    from datetime import date as _d
    span = (_d.fromisoformat(dates[-1]) - _d.fromisoformat(dates[0])).days
    return len(dates), span


def deal_rule_check(rec):
    """Why a record shown as a deal would break the D-021 rules, as a list of strings. Empty means it holds."""
    out = []
    pct = median_pct(rec)
    if pct is None:
        out.append("no median to compare with")
    elif pct < RULE_MIN_PCT_BELOW * 100:
        out.append(f"only {pct:.1f}% below the median (needs {RULE_MIN_PCT_BELOW * 100:.0f}%)")
    days, span = observation_days(rec)
    if days < RULE_MIN_DISTINCT_DAYS:
        out.append(f"{days} distinct days (needs {RULE_MIN_DISTINCT_DAYS})")
    if span < RULE_MIN_SPAN_DAYS:
        out.append(f"span {span} days (needs {RULE_MIN_SPAN_DAYS})")
    if rec.get("is_stale_fallback"):
        out.append("carried-forward price")
    return out


def _side(rec):
    if rec is None:
        return None
    days, span = observation_days(rec)
    pct = median_pct(rec)
    return {"status": rec.get("status"), "price": rec.get("price"), "median": rec.get("median_baseline"),
            "pct_below_median": None if pct is None else round(pct, 1), "distinct_days": days, "span_days": span,
            "history_points": rec.get("history_points"), "stale": bool(rec.get("is_stale_fallback")), "basis": rec.get("basis_text")}


def explain_records(shadow, served):
    """Record-level detail for one pair: routes whose verdict or price differs, and every shadow deal that is not a deal today, each checked against the deal rules.
    {'changes': [...], 'price_diffs': [...], 'rule_failures': [...], 'summary': {...}}"""
    s, v = index(shadow), index(served)
    changes, price_diffs, rule_failures = [], [], []
    for key in sorted(set(s) | set(v)):
        a, b = v.get(key), s.get(key)
        row = {"route": key, "served": _side(a), "shadow": _side(b)}
        if a is not None and b is not None and a.get("status") != b.get("status"):
            row["transition"] = f"{a.get('status')} -> {b.get('status')}"
            if b.get("status") == "deal":
                row["shadow_rule_failures"] = deal_rule_check(b)
            changes.append(row)
        elif a is not None and b is not None and a.get("price") != b.get("price"):
            price_diffs.append(row)
        if b is not None and b.get("status") == "deal":
            why = deal_rule_check(b)
            if why:
                rule_failures.append({"route": key, "problems": why, "shadow": _side(b)})
    gained = [c for c in changes if c["shadow"] and c["shadow"]["status"] == "deal"]
    return {"changes": changes, "price_diffs": price_diffs, "rule_failures": rule_failures,
            "summary": {"verdict_changes": len(changes), "price_diffs": len(price_diffs), "new_deals_in_shadow": len(gained),
                        "new_deals_breaking_rules": sum(1 for c in gained if c["shadow_rule_failures"]), "shadow_deals_breaking_rules": len(rule_failures)}}


def _cell(x):
    if x is None:
        return "-"
    pct = "" if x["pct_below_median"] is None else f", {x['pct_below_median']}% below"
    price = "no price" if x["price"] is None else f"${x['price']}"
    return f"{x['status']} {price} (median {x['median']}{pct}; {x['distinct_days']}d/{x['span_days']}span; hp {x['history_points']})"


def render_records_markdown(date, explained):
    """explained: {file name: explain_records() output, or None}."""
    lines = [f"# Shadow diff, record level, {date}", "",
             "Each row is a route whose verdict or price differs. 'd/span' is distinct observation days and the days between first and last; 'hp' is the stored history_points.",
             "A shadow deal must be at least 15% below its median, with 10 distinct days over 14 or more (D-021). Rows marked BREAKS RULES need an explanation before any flip.", ""]
    for name, e in explained.items():
        lines.append(f"## {name}")
        if e is None:
            lines += ["", "Not compared: a side was unavailable.", ""]
            continue
        m = e["summary"]
        lines += ["", f"- Verdict changes {m['verdict_changes']}, price differences {m['price_diffs']}; deals the shadow adds {m['new_deals_in_shadow']} "
                      f"(of which breaking the rules: {m['new_deals_breaking_rules']}); shadow deals breaking the rules anywhere: {m['shadow_deals_breaking_rules']}.", ""]
        if e["changes"]:
            lines += ["| Route | Change | Served | Shadow | Rule check |", "|---|---|---|---|---|"]
            for c in e["changes"]:
                why = c.get("shadow_rule_failures")
                note = "BREAKS RULES: " + "; ".join(why) if why else ("holds" if "shadow_rule_failures" in c else "")
                lines.append(f"| {c['route']} | {c['transition']} | {_cell(c['served'])} | {_cell(c['shadow'])} | {note} |")
            lines.append("")
        if e["price_diffs"]:
            lines += ["Price differences (same verdict):", "", "| Route | Served | Shadow |", "|---|---|---|"]
            lines += [f"| {c['route']} | {_cell(c['served'])} | {_cell(c['shadow'])} |" for c in e["price_diffs"]]
            lines.append("")
        other = [r for r in e["rule_failures"] if r["route"] not in {c["route"] for c in e["changes"]}]
        if other:
            lines += ["Shadow deals that break the rules but are not verdict changes:", ""]
            lines += [f"- {r['route']}: {'; '.join(r['problems'])}" for r in other]
            lines.append("")
    return "\n".join(lines)


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
    ap.add_argument("--records-out")
    ap.add_argument("--records-json")
    a = ap.parse_args(argv)
    results, explained = {}, {}
    for name, sh, sv in a.pair:
        shp, svp = Path(sh), Path(sv)
        ok = shp.exists() and svp.exists()
        sd, vd = (json.loads(shp.read_text(encoding="utf-8")), json.loads(svp.read_text(encoding="utf-8"))) if ok else (None, None)
        results[name] = diff_files(sd, vd) if ok else None
        explained[name] = explain_records(sd, vd) if ok and (a.records_out or a.records_json) else None
    if a.records_out:
        Path(a.records_out).write_text(render_records_markdown(a.date, explained), encoding="utf-8")
    if a.records_json:
        Path(a.records_json).write_text(json.dumps({"date": a.date, "files": explained}, indent=2), encoding="utf-8")
    Path(a.out).write_text(render_markdown(a.date, results), encoding="utf-8")
    if a.json_out:
        Path(a.json_out).write_text(json.dumps({"date": a.date, "files": summary(results)}, indent=2), encoding="utf-8")
    print(json.dumps(summary(results)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
