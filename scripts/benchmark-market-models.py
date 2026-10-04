"""Private, local, grouped development comparison. Never writes production models."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import subprocess
import time

os.environ.setdefault("TABPFN_DISABLE_TELEMETRY", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
ROOT = Path(__file__).resolve().parents[1]
SEED = 42
COMMON = ["season", "breakClass", "packageTier"]


def metrics(pairs):
    import numpy as np
    errors = [abs(p["predicted"] - p["actual"]) / p["actual"]
              if p["predicted"] is not None and math.isfinite(p["predicted"]) and p["predicted"] > 0
              else math.inf for p in pairs]
    def q(percent):
        if not errors or not all(math.isfinite(x) for x in errors):
            return None
        return float(np.quantile(errors, percent))
    return {"count": len(errors), "failed": sum(not math.isfinite(e) for e in errors),
            **{f"hit{n}": sum(e <= n / 100 + 1e-12 for e in errors) / len(errors) if errors else None
               for n in [10, 20, 30]}, "medianApe": q(.5), "p90Ape": q(.9)}


def feature_table(train, test, extended):
    import numpy as np
    import pandas as pd
    # Select extensions with training data only (also inside inner CV).
    allowed = {"accountStyle", "packageCount", "candles", "hearts", "ascended", "passes"}
    candidates = {k for r in train for k in r.get("features", {})
                  if k in allowed or k.startswith(("item:", "binding:", "progress:"))} if extended else set()
    counts = {k: sum(r.get("features", {}).get(k) is not None for r in train) for k in candidates}
    extra = [k for k in sorted(candidates, key=lambda k: (-counts[k], k)) if counts[k] >= 5][:40]
    columns = COMMON + extra
    categorical = COMMON + [k for k in extra if k == "accountStyle" or k.startswith(("item:", "binding:"))]
    def frame(rows):
        data = [{k: r.get(k) if k in COMMON else r.get("features", {}).get(k) for k in columns} for r in rows]
        df = pd.DataFrame(data, columns=columns)
        for k in columns:
            if k in categorical:
                df[k] = df[k].fillna("unknown").astype(str)
            else:
                df[k] = pd.to_numeric(df[k], errors="coerce").astype(float).fillna(np.nan)
        return df
    return frame(train), frame(test), categorical


def cat_predict(train, test, extended, params):
    import numpy as np
    from catboost import CatBoostRegressor
    x, xt, cat = feature_table(train, test, extended)
    model = CatBoostRegressor(iterations=300, learning_rate=.04, loss_function="RMSE",
                             one_hot_max_size=64, random_seed=SEED, thread_count=4,
                             verbose=False, allow_writing_files=False, **params)
    model.fit(x, np.log([r["price"] for r in train]), cat_features=cat)
    return np.exp(model.predict(xt)).tolist(), list(x.columns)


def tune_cat(train, extended):
    from sklearn.model_selection import GroupKFold
    import numpy as np
    options = [{"depth": d, "l2_leaf_reg": reg} for d in [3, 5] for reg in [3, 10]]
    groups = [r.get("splitGroup", r["accountKey"]) for r in train]
    splits = list(GroupKFold(n_splits=3).split(train, groups=groups))
    scores = []
    for params in options:
        errors = []
        for ti, vi in splits:
            a, b = [train[i] for i in ti], [train[i] for i in vi]
            pred, _ = cat_predict(a, b, extended, params)
            errors.extend(abs(p - r["price"]) / r["price"] for p, r in zip(pred, b))
        scores.append(float(np.median(errors)))
    return options[min(range(len(options)), key=lambda i: scores[i])]


def tab_predict(train, test, extended):
    import numpy as np
    import torch
    from sklearn.preprocessing import OrdinalEncoder
    from tabpfn import TabPFNRegressor
    from tabpfn.constants import ModelVersion
    torch.set_num_threads(4)
    x, xt, categorical = feature_table(train, test, extended)
    enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    # Training-only category vocabulary. No text, source, identity or price.
    encoded, encoded_test = x.copy(), xt.copy()
    encoded[categorical] = enc.fit_transform(x[categorical])
    encoded_test[categorical] = enc.transform(xt[categorical])
    model = TabPFNRegressor.create_default_for_version(ModelVersion.V2,
        device="cpu", n_estimators=4, random_state=SEED,
        categorical_features_indices=[x.columns.get_loc(k) for k in categorical])
    model.fit(encoded.to_numpy(dtype=float), np.log([r["price"] for r in train]))
    return np.exp(model.predict(encoded_test.to_numpy(dtype=float))).tolist(), list(x.columns)


def baseline_predict(train, test, seasons, original):
    def row(r):
        return {**r, **(r["originalFeatures"] if original else {})}
    payload = {"train": [row(r) for r in train], "test": [row(r) for r in test],
               "seasons": seasons, "priceKind": train[0]["priceKind"]}
    process = subprocess.run(["node", "scripts/benchmark-baseline.mjs"], cwd=ROOT,
                             input=json.dumps(payload), text=True, encoding="utf-8", capture_output=True, check=True)
    return json.loads(process.stdout), COMMON


def evaluate(train, test, model, seasons):
    params, columns = {}, []
    started = time.monotonic()
    error = None
    try:
        if len(train) < 10:
            raise ValueError("Fewer than 10 comparable training accounts")
        if set(r.get("splitGroup", r["accountKey"]) for r in train) & set(r.get("splitGroup", r["accountKey"]) for r in test):
            raise ValueError("Identity leakage")
        if model.startswith("baseline"):
            predictions, columns = baseline_predict(train, test, seasons, model == "baseline_original")
        elif model.startswith("catboost"):
            params = tune_cat(train, model.endswith("extended"))
            predictions, columns = cat_predict(train, test, model.endswith("extended"), params)
        else:
            predictions, columns = tab_predict(train, test, model.endswith("extended"))
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        predictions = [None] * len(test)
    pairs = [{"accountKey": r["accountKey"], "postKey": r["postKey"], "actual": r["price"],
              "predicted": float(p) if p is not None and math.isfinite(p) else None,
              **{k: r.get(k) for k in COMMON + ["sourceFamily", "sourceGroup", "priceBasis"]}}
             for r, p in zip(test, predictions)]
    return {"pairs": pairs, "metrics": metrics(pairs), "params": params, "columns": columns,
            "error": error, "seconds": time.monotonic() - started, "trainCount": len(train)}


def summary(pairs, seasons):
    result = {"overall": metrics(pairs)}
    for field in COMMON + ["sourceFamily", "sourceGroup", "priceBasis"]:
        values = sorted(set([str(r.get(field) or "unknown") for r in pairs] + (seasons if field == "season" else [])))
        result[field] = {v: metrics([r for r in pairs if str(r.get(field) or "unknown") == v]) for v in values}
    return result


def qualifies(candidate, baseline):
    return (candidate["count"] == baseline["count"] and candidate["count"] > 0
            and candidate["failed"] == baseline["failed"] == 0
            and candidate["medianApe"] <= .9 * baseline["medianApe"]
            and candidate["hit10"] >= baseline["hit10"] and candidate["p90Ape"] <= baseline["p90Ape"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--skip-tabpfn", action="store_true", help="Explicitly report not attempted, never substitute a model")
    args = parser.parse_args()
    target = Path(args.output).resolve()
    if not target.is_relative_to((ROOT / "work").resolve()) or target.exists():
        raise ValueError("New private output directory must be inside work")
    target.mkdir()
    source = Path(args.input).read_bytes()
    data = json.loads(source)
    os.environ["TABPFN_MODEL_CACHE_DIR"] = str(ROOT / "work" / "tabpfn-cache")
    models = ["baseline_original", "baseline_enriched", "catboost_common", "catboost_extended"]
    if not args.skip_tabpfn:
        models += ["tabpfn_v2_common", "tabpfn_v2_extended"]
    report = {"validation": "development_only", "productionChanged": False, "target": "asking_price_not_transaction",
              "sourceDigest": hashlib.sha256(source).hexdigest(), "foldCommitment": data["foldCommitment"],
              "seed": SEED, "tabpfnVersion": "V2", "tabpfnSkipped": args.skip_tabpfn,
              "catboostFixed": {"iterations": 300, "learning_rate": .04, "one_hot_max_size": 64, "thread_count": 4},
              "packages": {p: importlib.metadata.version(p) for p in ["catboost", "tabpfn", "scikit-learn", "numpy", "torch"]},
              "cohorts": {}}
    for kind in ["ask", "sold_proxy", "sold"]:
        rows = [r for r in data["rows"] if r["priceKind"] == kind]
        cohort = {"count": len(rows), "models": {}}
        report["cohorts"][kind] = cohort
        if len(rows) < 15:
            cohort["status"] = "pending_data"
            continue
        for model in models:
            results = []
            for fold in range(5):
                result = evaluate([r for r in rows if r["fold"] != fold], [r for r in rows if r["fold"] == fold], model, data["seasons"])
                result["fold"] = fold
                results.append(result)
                print(json.dumps({"kind": kind, "model": model, "fold": fold, "metrics": result["metrics"], "error": result["error"]}, ensure_ascii=True), flush=True)
            pairs = [p for r in results for p in r["pairs"]]
            cross = {}
            for family in sorted(set(r["sourceFamily"] for r in rows)):
                test = [r for r in rows if r["sourceFamily"] == family]
                held_groups = {r.get("splitGroup", r["accountKey"]) for r in test}
                train = [r for r in rows if r["sourceFamily"] != family and r.get("splitGroup", r["accountKey"]) not in held_groups]
                cross[family] = evaluate(train, test, model, data["seasons"])
            cohort["models"][model] = {"folds": results, "summary": summary(pairs, data["seasons"]), "crossSource": cross}
            (target / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
        baseline = cohort["models"]["baseline_enriched"]["summary"]["overall"]
        eligible = [m for m in models if not m.startswith("baseline") and qualifies(cohort["models"][m]["summary"]["overall"], baseline)]
        cohort["suggestedCandidate"] = min(eligible, key=lambda m: cohort["models"][m]["summary"]["overall"]["medianApe"]) if eligible else None
        cohort["recommendation"] = "private_candidate_only" if eligible else "retain_baseline"
    # Complete transitive dependency versions; no private data is sent externally.
    installed = subprocess.run([os.sys.executable, "-m", "pip", "freeze"], capture_output=True, text=True, check=True).stdout
    (target / "environment.txt").write_text(installed, encoding="utf-8")
    cache = ROOT / "work" / "tabpfn-cache"
    report["checkpoints"] = {str(p.relative_to(cache)): hashlib.sha256(p.read_bytes()).hexdigest()
                             for p in cache.rglob("*") if p.is_file() and p.suffix in [".ckpt", ".safetensors"]} if cache.exists() else {}
    (target / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({k: {"count": v["count"], "suggestedCandidate": v.get("suggestedCandidate")} for k, v in report["cohorts"].items()}))


if __name__ == "__main__":
    main()
