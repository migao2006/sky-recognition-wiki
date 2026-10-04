"""Local-only serving of the exact v2 extended benchmark recipe."""
import hashlib
import importlib.util
import importlib.metadata
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = "tabpfn-v2-extended-2026-10-04"
CHECKPOINT_SHA = "2ab5a07d5c41dfe6db9aa7ae106fc6de898326c2765be66505a07e2868c10736"


def load_data():
    path = ROOT / "work/market-benchmark-v4.private.json"
    raw = path.read_bytes()
    data = json.loads(raw)
    rows = [r for r in data["rows"] if r["priceKind"] == "ask"]
    if len(rows) != 218:
        raise ValueError("Frozen asking-price cohort changed; rebuild and review manifest")
    return rows, data["seasons"], hashlib.sha256(raw).hexdigest()


def recipe():
    spec = importlib.util.spec_from_file_location("benchmark", ROOT / "scripts/benchmark-market-models.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def manifest():
    rows, seasons, digest = load_data()
    x, _, categorical = recipe().feature_table(rows, rows[:1], True)
    return {"schemaVersion": 1, "modelRevision": REVISION, "sourceDigest": digest,
            "checkpointSha256": CHECKPOINT_SHA, "columns": list(x.columns),
            "categorical": categorical, "seasons": seasons, "sampleCount": len(rows),
            "seasonCounts": {s: sum(r.get("season") == s for r in rows) for s in seasons},
            "asOf": "2026-10-04", "status": "unvalidated"}


class Predictor:
    def __init__(self):
        for line in Path(__file__).with_name("requirements.txt").read_text().splitlines():
            if "==" in line:
                package, expected = line.split("==")
                if importlib.metadata.version(package) != expected:
                    raise ValueError("Pinned runtime dependency mismatch")
        os.environ["TABPFN_DISABLE_TELEMETRY"] = "1"
        os.environ["DO_NOT_TRACK"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        os.environ["HF_HUB_OFFLINE"] = "1"
        cache = ROOT / "work/tabpfn-cache"
        os.environ["TABPFN_MODEL_CACHE_DIR"] = str(cache)
        if hashlib.sha256((cache / "tabpfn-v2-regressor.ckpt").read_bytes()).hexdigest() != CHECKPOINT_SHA:
            raise ValueError("Unexpected v2 checkpoint")
        import numpy as np
        import torch
        from sklearn.preprocessing import OrdinalEncoder
        from tabpfn import TabPFNRegressor
        from tabpfn.constants import ModelVersion
        torch.set_num_threads(4)
        self.meta = manifest()
        published = json.loads((ROOT / "app/valuation-tabpfn-manifest.json").read_text(encoding="utf-8"))
        if self.meta != published:
            raise ValueError("Private dataset / public manifest mismatch")
        self.rows, _, _ = load_data()
        self.bench = recipe()
        x, _, self.cats = self.bench.feature_table(self.rows, self.rows[:1], True)
        self.encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        x[self.cats] = self.encoder.fit_transform(x[self.cats])
        self.model = TabPFNRegressor.create_default_for_version(ModelVersion.V2, device="cpu",
            n_estimators=4, random_state=42, categorical_features_indices=[x.columns.get_loc(k) for k in self.cats])
        self.model.fit(x.to_numpy(dtype=float), np.log([r["price"] for r in self.rows]))
        prices = self.predict_many([{"season": s, "breakClass": "none", "packageTier": "few"}
                                    for s in self.meta["seasons"]])
        self.bands = [{"slug": s, "median": p, "low": None, "high": None,
                       "status": "unvalidated", "method": "tabpfn", "confidence": "inferred",
                       "sampleCount": self.meta["seasonCounts"][s], "asOf": self.meta["asOf"]}
                      for s, p in zip(self.meta["seasons"], prices)]

    def predict_many(self, inputs):
        import numpy as np
        rows = [{**{k: v for k, v in f.items() if k in self.bench.COMMON},
                 "features": {k: v for k, v in f.items() if k not in self.bench.COMMON}} for f in inputs]
        _, x, _ = self.bench.feature_table(self.rows, rows, True)
        x[self.cats] = self.encoder.transform(x[self.cats])
        values = np.exp(self.model.predict(x.to_numpy(dtype=float)))
        if not np.isfinite(values).all() or (values <= 0).any():
            raise ValueError("Non-finite model prediction")
        return [max(1, round(float(v))) for v in values]

    def predict(self, features):
        return {"schemaVersion": 1, "modelRevision": REVISION, "status": "unvalidated",
                "midpoint": self.predict_many([features])[0], "currency": "TWD",
                "range": None, "seasonBands": self.bands}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-manifest", action="store_true")
    args = parser.parse_args()
    value = manifest()
    path = ROOT / "app/valuation-tabpfn-manifest.json"
    changed = not path.exists() or json.loads(path.read_text(encoding="utf-8")) != value
    print(json.dumps({"changed": changed, "sampleCount": value["sampleCount"], "columns": len(value["columns"])}))
    if args.write_manifest:
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
