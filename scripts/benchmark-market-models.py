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
PACKAGE_TIERS = ["few", "medium", "many", "hundred"]
BREAK_CLASSES = ["none", "slight", "medium", "large"]
# This grid belongs to the private benchmark only.  The actual site estimator
# is deliberately not tuned from a benchmark's outer validation folds.
BASELINE_RIDGE_GRID = [.03, .1, .3, .5, 1, 2]
EMPIRICAL_RESIDUAL_ALPHA = 3
BINDING_RESIDUAL_ALPHA = 1
TITLE_BINDING_BLEND_WEIGHT = .5
HIERARCHICAL_LOOKUP_GRID = [
    {"seasonAlpha": 1., "poolAlpha": 3., "neighborAlpha": .3},
    {"seasonAlpha": 3., "poolAlpha": 3., "neighborAlpha": 1.},
    {"seasonAlpha": 3., "poolAlpha": 10., "neighborAlpha": 1.},
    {"seasonAlpha": 10., "poolAlpha": 10., "neighborAlpha": 3.},
    {"seasonAlpha": 10., "poolAlpha": 30., "neighborAlpha": 3.},
    {"seasonAlpha": 30., "poolAlpha": 30., "neighborAlpha": 10.},
]


def installed_version(package):
    """Return an optional local dependency version without blocking other models."""
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return None


def eligible_for_formal_baseline(row):
    """Match valuation-fresh-core's whole-account fit contract exactly.

    Rows with an unknown server remain useful in the broader private evidence
    pool, but cannot be compared to the strict baseline until that field is
    evidenced.  Filtering the entire benchmark cohort keeps every candidate
    on the same rows instead of failing only the baseline model.
    """
    return (row.get("market") == "taiwan" and row.get("server") == "international"
            and row.get("currency") == "TWD" and row.get("converted") is not True
            and row.get("accountOnly") is not False)


def eligible_for_season_evidenced(row):
    """A whole-account ask whose start season is explicit in its text.

    A price-only or resource-only listing cannot validate the title-driven
    estimator: it has no season signal for either training or prediction.
    Keep it in the broad cohort, but report this cohort separately instead of
    letting unknown-season rows obscure title-estimator accuracy.
    """
    return eligible_for_formal_baseline(row) and row.get("season") is not None


def eligible_for_title_evidenced(row):
    """A season, break class and package tier were all explicit in the title."""
    return (eligible_for_season_evidenced(row)
            and row.get("breakClass") is not None
            and row.get("packageTier") is not None)


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


def cat_predict(train, test, extended, params, loss="RMSE"):
    import numpy as np
    from catboost import CatBoostRegressor
    x, xt, cat = feature_table(train, test, extended)
    model = CatBoostRegressor(iterations=300, learning_rate=.04, loss_function=loss,
                             one_hot_max_size=64, random_seed=SEED, thread_count=4,
                             verbose=False, allow_writing_files=False, **params)
    model.fit(x, np.log([r["price"] for r in train]), cat_features=cat)
    return np.exp(model.predict(xt)).tolist(), list(x.columns)


def tune_cat(train, extended, loss):
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
            pred, _ = cat_predict(a, b, extended, params, loss)
            errors.extend(abs(p - r["price"]) / r["price"] for p, r in zip(pred, b))
        scores.append(float(np.median(errors)))
    return options[min(range(len(options)), key=lambda i: scores[i])]


def tab_predict(train, test, extended, estimators=4):
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
        device="cpu", n_estimators=estimators, random_state=SEED,
        categorical_features_indices=[x.columns.get_loc(k) for k in categorical])
    model.fit(encoded.to_numpy(dtype=float), np.log([r["price"] for r in train]))
    return np.exp(model.predict(encoded_test.to_numpy(dtype=float))).tolist(), list(x.columns)


def extra_trees_predict(train, test, extended):
    """Local non-parametric comparison with train-only categorical encoding."""
    import numpy as np
    from sklearn.ensemble import ExtraTreesRegressor
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import OrdinalEncoder
    x, xt, categorical = feature_table(train, test, extended)
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    encoded, encoded_test = x.copy(), xt.copy()
    encoded[categorical] = encoder.fit_transform(x[categorical])
    encoded_test[categorical] = encoder.transform(xt[categorical])
    imputer = SimpleImputer(strategy="median")
    model = ExtraTreesRegressor(n_estimators=400, min_samples_leaf=2, max_features=1.0,
                                random_state=SEED, n_jobs=4)
    model.fit(imputer.fit_transform(encoded), np.log([r["price"] for r in train]))
    return np.exp(model.predict(imputer.transform(encoded_test))).tolist(), list(x.columns)


def hist_gradient_predict(train, test, extended):
    """Histogram gradient boosting with native missing-value and category support.

    Categories are encoded from the training fold only.  A category unseen in
    that fold becomes missing rather than an invented ordinal relationship.
    """
    import numpy as np
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.preprocessing import OrdinalEncoder
    x, xt, categorical = feature_table(train, test, extended)
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    encoded, encoded_test = x.copy(), xt.copy()
    encoded[categorical] = encoder.fit_transform(x[categorical])
    test_categories = encoder.transform(xt[categorical])
    encoded_test[categorical] = np.where(test_categories == -1, np.nan, test_categories)
    categorical_mask = [column in categorical for column in encoded.columns]
    model = HistGradientBoostingRegressor(max_leaf_nodes=7, min_samples_leaf=10,
                                          l2_regularization=10.0, learning_rate=.06,
                                          max_iter=250, categorical_features=categorical_mask,
                                          random_state=SEED)
    model.fit(encoded.to_numpy(dtype=float), np.log([r["price"] for r in train]))
    return np.exp(model.predict(encoded_test.to_numpy(dtype=float))).tolist(), list(x.columns)


def lightgbm_predict(train, test, extended):
    """Local LightGBM comparison with fold-local categorical vocabularies."""
    import numpy as np
    from lightgbm import LGBMRegressor
    x, xt, categorical = feature_table(train, test, extended)
    for column in categorical:
        x[column] = x[column].astype("category")
        # Unknown test values become missing, never a made-up ordinal category.
        xt[column] = xt[column].astype("category").cat.set_categories(x[column].cat.categories)
    # LightGBM serializes feature names as JSON and rejects our audited
    # `item:`/`binding:` prefixes.  Keep the mapping local to this fit.
    safe_names = {column: f"f{index}" for index, column in enumerate(x.columns)}
    x, xt = x.rename(columns=safe_names), xt.rename(columns=safe_names)
    safe_categorical = [safe_names[column] for column in categorical]
    model = LGBMRegressor(n_estimators=300, learning_rate=.03, num_leaves=15,
                          min_child_samples=10, reg_lambda=10.0,
                          random_state=SEED, n_jobs=4, verbosity=-1)
    model.fit(x, np.log([r["price"] for r in train]), categorical_feature=safe_categorical)
    return np.exp(model.predict(xt)).tolist(), list(x.columns)


def baseline_predict(train, test, seasons, original, ridge=1):
    def row(r):
        return {**r, **(r["originalFeatures"] if original else {})}
    payload = {"train": [row(r) for r in train], "test": [row(r) for r in test],
               "seasons": seasons, "priceKind": train[0]["priceKind"], "ridge": ridge}
    process = subprocess.run(["node", "scripts/benchmark-baseline.mjs"], cwd=ROOT,
                             input=json.dumps(payload), text=True, encoding="utf-8", capture_output=True, check=True)
    return json.loads(process.stdout), COMMON


def tune_baseline_ridge(train, seasons, original):
    """Select regularization using only an outer fold's training accounts.

    A lower ridge lets observed seasons keep more of their own market level;
    it must never be selected using the held-out outer fold.
    """
    import numpy as np
    from sklearn.model_selection import GroupKFold
    groups = [r.get("splitGroup", r["accountKey"]) for r in train]
    unique_groups = len(set(groups))
    if unique_groups < 3:
        return 1
    splits = list(GroupKFold(n_splits=min(3, unique_groups)).split(train, groups=groups))
    scores = []
    for ridge in BASELINE_RIDGE_GRID:
        errors = []
        for ti, vi in splits:
            fit_rows, validation_rows = [train[i] for i in ti], [train[i] for i in vi]
            predictions, _ = baseline_predict(fit_rows, validation_rows, seasons, original, ridge)
            errors.extend(abs(prediction - row["price"]) / row["price"]
                          for prediction, row in zip(predictions, validation_rows))
        scores.append(float(np.median(errors)))
    return BASELINE_RIDGE_GRID[min(range(len(scores)), key=lambda index: scores[index])]


def empirical_residual_predict(train, test, seasons, original, ridge, alpha=EMPIRICAL_RESIDUAL_ALPHA):
    """Apply a smoothed, training-only title-cell residual correction.

    It can refine an observed season × break × package cell, but starts at
    zero for an unseen cell and shrinks a singleton strongly.  The caller
    must pass only the current outer training fold as ``train``.
    """
    import numpy as np
    if not isinstance(alpha, (int, float)) or not np.isfinite(alpha) or alpha < 0:
        raise ValueError("Invalid empirical residual alpha")
    train_predictions, columns = baseline_predict(train, train, seasons, original, ridge)
    test_predictions, _ = baseline_predict(train, test, seasons, original, ridge)
    residuals = {}
    for row, prediction in zip(train, train_predictions):
        key = tuple(row.get(field) for field in COMMON)
        residuals.setdefault(key, []).append(math.log(row["price"] / prediction))
    corrected = []
    for row, prediction in zip(test, test_predictions):
        values = residuals.get(tuple(row.get(field) for field in COMMON), [])
        correction = float(np.median(values)) * len(values) / (len(values) + alpha) if values else 0.
        corrected.append(prediction * math.exp(correction))
    return corrected, columns


def binding_lock_count(row):
    """Count only explicitly recorded non-transferable platform bindings.

    Missing binding fields deliberately count as no *evidence*, not as an
    unbound account.  The residual layer below is pooled and strongly shrunk,
    so those rows receive the ordinary title-model estimate rather than a
    made-up transferability premium or penalty.
    """
    features = row.get("features", {})
    return sum(1 for key, value in features.items()
               if key.startswith("binding:") and value not in {"transferable", "unbound"})


def title_binding_residual_predict(train, test, seasons, ridge,
                                   title_alpha=EMPIRICAL_RESIDUAL_ALPHA,
                                   binding_alpha=BINDING_RESIDUAL_ALPHA):
    """Smooth a binding-lock residual after the title-cell correction.

    Both residual sets come only from the current outer training fold.  This
    candidate remains a private comparison; it is not a serving estimator.
    """
    import numpy as np
    if not isinstance(binding_alpha, (int, float)) or not np.isfinite(binding_alpha) or binding_alpha < 0:
        raise ValueError("Invalid binding residual alpha")
    train_predictions, columns = empirical_residual_predict(
        train, train, seasons, False, ridge, title_alpha)
    test_predictions, _ = empirical_residual_predict(
        train, test, seasons, False, ridge, title_alpha)
    residuals = {}
    for row, prediction in zip(train, train_predictions):
        residuals.setdefault(binding_lock_count(row), []).append(math.log(row["price"] / prediction))
    pooled = [value for values in residuals.values() for value in values]
    fallback = float(np.median(pooled)) if pooled else 0.
    corrections = {
        locks: (float(np.median(values)) * len(values) + fallback * binding_alpha) /
               (len(values) + binding_alpha)
        for locks, values in residuals.items()
    }
    return [prediction * math.exp(corrections.get(binding_lock_count(row), fallback))
            for row, prediction in zip(test, test_predictions)], columns


def geometric_blend(first, second, weight):
    """Blend two positive price estimates without changing their price scale."""
    if not 0 <= weight <= 1:
        raise ValueError("Invalid blend weight")
    if weight == 0:
        return [float(value) for value in first]
    if weight == 1:
        return [float(value) for value in second]
    return [math.exp((1 - weight) * math.log(a) + weight * math.log(b))
            for a, b in zip(first, second)]


def hierarchical_lookup_predict(train, test, seasons, params):
    """Fit a monotone, partially pooled season × break × package lookup.

    The model works in log-price space.  Each season has its own ordered
    package increments and break penalties, but augmented ridge rows shrink
    them toward shared market increments and adjacent seasons.  Non-negative
    bounds guarantee earlier seasons cannot be cheaper, larger breaks cannot
    increase price and larger package tiers cannot decrease it.
    """
    import numpy as np
    from scipy.optimize import lsq_linear

    season_count = len(seasons)
    season_index = {season: index for index, season in enumerate(seasons)}
    if season_count < 2 or any(key not in params for key in ("seasonAlpha", "poolAlpha", "neighborAlpha")):
        raise ValueError("Invalid hierarchical lookup configuration")

    cursor = 1
    season_delta = slice(cursor, cursor + season_count - 1)
    cursor = season_delta.stop
    package_global = slice(cursor, cursor + 3)
    cursor = package_global.stop
    break_global = slice(cursor, cursor + 3)
    cursor = break_global.stop
    package_season = slice(cursor, cursor + season_count * 3)
    cursor = package_season.stop
    break_season = slice(cursor, cursor + season_count * 3)
    cursor = break_season.stop
    binding_penalty = cursor
    feature_count = cursor + 1

    def vector(row):
        values = np.zeros(feature_count, dtype=float)
        values[0] = 1.
        index = season_index.get(row.get("season"))
        if index is not None and index < season_count - 1:
            values[season_delta.start + index:season_delta.stop] = 1.
        tier = row.get("packageTier")
        tier_level = PACKAGE_TIERS.index(tier) if tier in PACKAGE_TIERS else 0
        break_class = row.get("breakClass")
        break_level = BREAK_CLASSES.index(break_class) if break_class in BREAK_CLASSES else 0
        for threshold in range(tier_level):
            target = package_global.start + threshold if index is None else package_season.start + index * 3 + threshold
            values[target] = 1.
        for threshold in range(break_level):
            target = break_global.start + threshold if index is None else break_season.start + index * 3 + threshold
            values[target] = -1.
        values[binding_penalty] = -binding_lock_count(row)
        return values

    design = [vector(row) for row in train]
    targets = [math.log(row["price"]) for row in train]

    def penalty(weight, entries):
        if weight <= 0:
            return
        row = np.zeros(feature_count, dtype=float)
        for index, coefficient in entries:
            row[index] = coefficient * math.sqrt(weight)
        design.append(row)
        targets.append(0.)

    for index in range(season_delta.start, season_delta.stop):
        penalty(params["seasonAlpha"], [(index, 1.)])
    for threshold in range(3):
        global_package = package_global.start + threshold
        global_break = break_global.start + threshold
        penalty(1., [(global_package, 1.)])
        penalty(1., [(global_break, 1.)])
        for season in range(season_count):
            package_value = package_season.start + season * 3 + threshold
            break_value = break_season.start + season * 3 + threshold
            penalty(params["poolAlpha"], [(package_value, 1.), (global_package, -1.)])
            penalty(params["poolAlpha"], [(break_value, 1.), (global_break, -1.)])
            if season + 1 < season_count:
                next_package = package_season.start + (season + 1) * 3 + threshold
                next_break = break_season.start + (season + 1) * 3 + threshold
                penalty(params["neighborAlpha"], [(package_value, 1.), (next_package, -1.)])
                penalty(params["neighborAlpha"], [(break_value, 1.), (next_break, -1.)])
    penalty(10., [(binding_penalty, 1.)])

    lower = np.zeros(feature_count, dtype=float)
    lower[0] = -np.inf
    upper = np.full(feature_count, np.inf, dtype=float)
    fitted = lsq_linear(np.vstack(design), np.asarray(targets), bounds=(lower, upper),
                        method="trf", lsmr_tol="auto", max_iter=2000)
    if not fitted.success or not np.all(np.isfinite(fitted.x)):
        raise ValueError(f"Hierarchical lookup fit failed: {fitted.message}")
    predictions = np.exp(np.vstack([vector(row) for row in test]) @ fitted.x)
    if not np.all(np.isfinite(predictions)) or np.any(predictions <= 0):
        raise ValueError("Invalid hierarchical lookup prediction")
    return predictions.tolist(), ["season", "breakClass", "packageTier", "bindingLockCount"]


def tune_hierarchical_lookup(train, seasons):
    """Choose shrinkage using only the current outer training groups."""
    import numpy as np
    from sklearn.model_selection import GroupKFold
    groups = [row.get("splitGroup", row["accountKey"]) for row in train]
    unique_groups = len(set(groups))
    if unique_groups < 3:
        return HIERARCHICAL_LOOKUP_GRID[-1]
    splits = list(GroupKFold(n_splits=min(3, unique_groups)).split(train, groups=groups))
    scores = []
    for params in HIERARCHICAL_LOOKUP_GRID:
        errors = []
        for train_indices, validation_indices in splits:
            fit_rows = [train[index] for index in train_indices]
            validation_rows = [train[index] for index in validation_indices]
            predictions, _ = hierarchical_lookup_predict(fit_rows, validation_rows, seasons, params)
            errors.extend(abs(prediction - row["price"]) / row["price"]
                          for prediction, row in zip(predictions, validation_rows))
        ordered = sorted(errors)
        scores.append((float(np.median(ordered)), float(np.quantile(ordered, .9))))
    return HIERARCHICAL_LOOKUP_GRID[min(range(len(scores)), key=lambda index: scores[index])]


def evaluate(train, test, model, seasons):
    params, columns = {}, []
    started = time.monotonic()
    error = None
    try:
        if len(train) < 10:
            raise ValueError("Fewer than 10 comparable training accounts")
        if set(r.get("splitGroup", r["accountKey"]) for r in train) & set(r.get("splitGroup", r["accountKey"]) for r in test):
            raise ValueError("Identity leakage")
        if model == "baseline_enriched_title_binding_blend":
            params = {"ridge": tune_baseline_ridge(train, seasons, False),
                      "residualAlpha": EMPIRICAL_RESIDUAL_ALPHA,
                      "bindingResidualAlpha": BINDING_RESIDUAL_ALPHA,
                      "blendWeight": TITLE_BINDING_BLEND_WEIGHT}
            plain, columns = baseline_predict(train, test, seasons, False, 1)
            corrected, _ = title_binding_residual_predict(
                train, test, seasons, params["ridge"], params["residualAlpha"], params["bindingResidualAlpha"])
            predictions = geometric_blend(plain, corrected, params["blendWeight"])
        elif model == "baseline_enriched_title_binding_residual":
            params = {"ridge": tune_baseline_ridge(train, seasons, False),
                      "residualAlpha": EMPIRICAL_RESIDUAL_ALPHA,
                      "bindingResidualAlpha": BINDING_RESIDUAL_ALPHA}
            predictions, columns = title_binding_residual_predict(
                train, test, seasons, params["ridge"], params["residualAlpha"], params["bindingResidualAlpha"])
        elif model == "baseline_enriched_empirical_residual":
            params = {"ridge": tune_baseline_ridge(train, seasons, False), "residualAlpha": EMPIRICAL_RESIDUAL_ALPHA}
            predictions, columns = empirical_residual_predict(train, test, seasons, False, params["ridge"], params["residualAlpha"])
        elif model.startswith("baseline"):
            original = model == "baseline_original"
            if model == "baseline_enriched_tuned_ridge":
                params = {"ridge": tune_baseline_ridge(train, seasons, original)}
            predictions, columns = baseline_predict(train, test, seasons, original, params.get("ridge", 1))
        elif model == "hierarchical_lookup":
            params = tune_hierarchical_lookup(train, seasons)
            predictions, columns = hierarchical_lookup_predict(train, test, seasons, params)
        elif model.startswith("catboost"):
            loss = "MAE" if model.startswith("catboost_mae") else "RMSE"
            params = tune_cat(train, model.endswith("extended"), loss)
            predictions, columns = cat_predict(train, test, model.endswith("extended"), params, loss)
        elif model.startswith("extra_trees"):
            predictions, columns = extra_trees_predict(train, test, model.endswith("extended"))
        elif model.startswith("hist_gradient"):
            predictions, columns = hist_gradient_predict(train, test, model.endswith("extended"))
        elif model.startswith("lightgbm"):
            predictions, columns = lightgbm_predict(train, test, model.endswith("extended"))
        else:
            estimators = 8 if model.endswith("_8") else 4
            predictions, columns = tab_predict(train, test, "extended" in model, estimators)
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


def rank_model(models, summaries, metric, reverse=False):
    """Rank only complete candidates; the result is not a promotion decision."""
    complete = [model for model in models if summaries[model]["overall"]["failed"] == 0]
    return (min(complete, key=lambda model: summaries[model]["overall"][metric]) if not reverse
            else max(complete, key=lambda model: summaries[model]["overall"][metric])) if complete else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--skip-tabpfn", action="store_true", help="Explicitly report not attempted, never substitute a model")
    parser.add_argument("--models", help="Comma-separated private candidates; baseline_enriched is always included")
    parser.add_argument("--cohorts", help="Comma-separated cohort keys; omitted means every available cohort")
    args = parser.parse_args()
    target = Path(args.output).resolve()
    if not target.is_relative_to((ROOT / "work").resolve()) or target.exists():
        raise ValueError("New private output directory must be inside work")
    target.mkdir()
    source = Path(args.input).read_bytes()
    data = json.loads(source)
    os.environ["TABPFN_MODEL_CACHE_DIR"] = str(ROOT / "work" / "tabpfn-cache")
    models = ["baseline_original", "baseline_enriched", "baseline_enriched_tuned_ridge",
              "baseline_enriched_empirical_residual", "baseline_enriched_title_binding_residual",
              "baseline_enriched_title_binding_blend", "hierarchical_lookup"]
    unavailable = []
    if installed_version("catboost") is None:
        unavailable.extend(["catboost_common", "catboost_extended", "catboost_mae_common", "catboost_mae_extended"])
    else:
        models += ["catboost_common", "catboost_extended", "catboost_mae_common", "catboost_mae_extended"]
    models += ["extra_trees_common", "extra_trees_extended"]
    models += ["hist_gradient_common", "hist_gradient_extended"]
    if installed_version("lightgbm") is None:
        unavailable.extend(["lightgbm_common", "lightgbm_extended"])
    else:
        models += ["lightgbm_common", "lightgbm_extended"]
    if not args.skip_tabpfn:
        models += ["tabpfn_v2_common", "tabpfn_v2_extended", "tabpfn_v2_extended_8"]
    if args.models:
        requested = list(dict.fromkeys(filter(None, args.models.split(","))))
        unknown = sorted(set(requested) - set(models))
        if unknown:
            raise ValueError(f"Unknown or unavailable models: {', '.join(unknown)}")
        models = list(dict.fromkeys(["baseline_enriched", *requested]))
    report = {"validation": "development_only", "productionChanged": False, "target": "asking_price_not_transaction",
              "sourceDigest": hashlib.sha256(source).hexdigest(), "foldCommitment": data["foldCommitment"],
              "seed": SEED, "tabpfnVersion": "V2", "tabpfnEstimators": [4, 8], "tabpfnSkipped": args.skip_tabpfn,
              "baselineRidgeGrid": BASELINE_RIDGE_GRID, "empiricalResidualAlpha": EMPIRICAL_RESIDUAL_ALPHA,
              "bindingResidualAlpha": BINDING_RESIDUAL_ALPHA,
              "hierarchicalLookupGrid": HIERARCHICAL_LOOKUP_GRID,
              "catboostFixed": {"iterations": 300, "learning_rate": .04, "one_hot_max_size": 64, "thread_count": 4,
                                "logTargetLosses": ["RMSE", "MAE"]},
              "extraTreesFixed": {"estimators": 400, "min_samples_leaf": 2, "max_features": 1.0, "thread_count": 4},
              "histGradientFixed": {"max_leaf_nodes": 7, "min_samples_leaf": 10, "l2_regularization": 10.0,
                                    "learning_rate": .06, "max_iter": 250},
              "lightgbmFixed": {"estimators": 300, "learning_rate": .03, "num_leaves": 15,
                                "min_child_samples": 10, "l2_regularization": 10.0, "thread_count": 4},
              "packages": {p: installed_version(p) for p in ["catboost", "lightgbm", "tabpfn", "scikit-learn", "numpy", "torch"]},
              "selectedModels": models,
              "unavailableModels": unavailable,
              "cohorts": {}}
    cohort_filters = [
        ("", eligible_for_formal_baseline, "strict_whole_account"),
        ("_season_evidenced", eligible_for_season_evidenced, "season_explicit"),
        ("_title_evidenced", eligible_for_title_evidenced, "season_break_package_explicit"),
    ]
    all_cohorts = {f"{kind}{suffix}" for kind in ["ask", "sold_proxy", "sold"]
                   for suffix, _, _ in cohort_filters}
    selected_cohorts = set(filter(None, args.cohorts.split(","))) if args.cohorts else all_cohorts
    unknown_cohorts = sorted(selected_cohorts - all_cohorts)
    if unknown_cohorts:
        raise ValueError(f"Unknown cohorts: {', '.join(unknown_cohorts)}")
    report["selectedCohorts"] = sorted(selected_cohorts)
    for kind in ["ask", "sold_proxy", "sold"]:
        source_rows = [r for r in data["rows"] if r["priceKind"] == kind]
        for suffix, predicate, evidence_requirement in cohort_filters:
            rows = [r for r in source_rows if predicate(r)]
            cohort_key = f"{kind}{suffix}"
            if cohort_key not in selected_cohorts:
                continue
            cohort = {"count": len(rows), "sourceCount": len(source_rows),
                      "evidenceRequirement": evidence_requirement,
                      "excludedByCohortContract": len(source_rows) - len(rows), "models": {}}
            report["cohorts"][cohort_key] = cohort
            if len(rows) < 15:
                cohort["status"] = "pending_data"
                continue
            for model in models:
                results = []
                for fold in range(5):
                    result = evaluate([r for r in rows if r["fold"] != fold], [r for r in rows if r["fold"] == fold], model, data["seasons"])
                    result["fold"] = fold
                    results.append(result)
                    print(json.dumps({"kind": cohort_key, "model": model, "fold": fold, "metrics": result["metrics"], "error": result["error"]}, ensure_ascii=True), flush=True)
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
            summaries = {model: cohort["models"][model]["summary"] for model in models}
            eligible = [m for m in models if not m.startswith("baseline") and qualifies(summaries[m]["overall"], baseline)]
            cohort["suggestedCandidate"] = min(eligible, key=lambda m: cohort["models"][m]["summary"]["overall"]["medianApe"]) if eligible else None
            cohort["bestByMedianApe"] = rank_model(models, summaries, "medianApe")
            cohort["bestByHit20"] = rank_model(models, summaries, "hit20", reverse=True)
            # The user-facing target is ±20%; an improved private experiment is
            # never labelled promotable when it has not met that target.
            promotion = [m for m in eligible if summaries[m]["overall"]["medianApe"] <= .20]
            cohort["promotionCandidate"] = min(promotion, key=lambda m: summaries[m]["overall"]["medianApe"]) if promotion else None
            cohort["recommendation"] = "private_candidate_only" if eligible else "retain_baseline"
    # Complete transitive dependency versions; no private data is sent externally.
    installed = subprocess.run([os.sys.executable, "-m", "pip", "freeze"], capture_output=True, text=True, check=True).stdout
    (target / "environment.txt").write_text(installed, encoding="utf-8")
    cache = ROOT / "work" / "tabpfn-cache"
    report["checkpoints"] = {str(p.relative_to(cache)): hashlib.sha256(p.read_bytes()).hexdigest()
                             for p in cache.rglob("*") if p.is_file() and p.suffix in [".ckpt", ".safetensors"]} if cache.exists() else {}
    (target / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({k: {"count": v["count"], "suggestedCandidate": v.get("suggestedCandidate"),
                          "bestByMedianApe": v.get("bestByMedianApe"), "bestByHit20": v.get("bestByHit20"),
                          "promotionCandidate": v.get("promotionCandidate")} for k, v in report["cohorts"].items()}))


if __name__ == "__main__":
    main()
