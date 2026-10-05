"""Frozen strict-title hybrid model; private inputs never leave this host."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = "strict-title-binding-hybrid-2026-10-05"
SOURCE_SHA = "1e7f2204ff6f3299bcf4d2b1720506d15911aad46d7465b1b96f8a4252bd7400"
STATE_SHA = "2f35f73ad35d08de9ae5d7e957e9128ed70983dc33c8662aa5d93ba7af709fb1"
ARTIFACT = ROOT / "work/strict-title-binding-hybrid-2026-10-05-r5/model.private.json"
COMMON = ("season", "breakClass", "packageTier")
PACKAGE_TIERS = ("few", "medium", "many", "hundred")
BREAK_CLASSES = ("none", "slight", "medium", "large")


def artifact():
    raw = ARTIFACT.read_bytes()
    if hashlib.sha256(raw).hexdigest() != STATE_SHA:
        raise ValueError("Private artifact digest mismatch")
    model = json.loads(raw)
    required = {"schemaVersion", "revision", "method", "target", "sourceDigest", "strictRows",
                "strictGroups", "seasons", "seasonCounts", "titleAlpha", "bindingAlpha", "blendWeight",
                "correctedRidge", "plain",
                "corrected", "titleResiduals", "bindingResiduals", "bindingFallback"}
    if (set(model) != required or model["schemaVersion"] != 1 or model["revision"] != REVISION
            or model["method"] != "strict-title-binding-hybrid" or model["target"] != "asking_price_not_transaction"
            or model["sourceDigest"] != SOURCE_SHA or model["strictRows"] < 15 or model["strictGroups"] < 10
            or model["correctedRidge"] != .3 or not 0 <= model["blendWeight"] <= 1):
        raise ValueError("Strict hybrid recipe mismatch")
    for name in ("plain", "corrected"):
        fitted = model[name]
        if (not isinstance(fitted, dict) or len(fitted.get("centers", [])) != 6
                or len(fitted.get("coefficients", [])) != 6 or not isinstance(fitted.get("seasons"), dict)
                or not isinstance(fitted.get("pooled"), dict)):
            raise ValueError("Invalid strict hybrid state")
    return model


def manifest():
    model = artifact()
    categorical = ["season", "breakClass", "packageTier", "binding:FB", "binding:GC", "binding:GG", "binding:NS"]
    return dict(schemaVersion=1, modelRevision=REVISION, method="strict-title-binding-hybrid",
                sourceDigest=SOURCE_SHA, stateSha256=STATE_SHA, columns=[*categorical, "candles", "hearts", "packageCount"],
                categorical=categorical, seasons=model["seasons"], sampleCount=model["strictRows"],
                seasonCounts=model["seasonCounts"], asOf="2026-10-05", status="unvalidated")


def tier_for_count(value):
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        return None
    return "hundred" if value >= 100 else "many" if value >= 90 else "medium" if value >= 60 else "few"


def vector(features, centers):
    tier = features.get("packageTier") or tier_for_count(features.get("packageCount"))
    break_class = "large" if features.get("breakClass") == "big" else features.get("breakClass")
    levels = (PACKAGE_TIERS.index(tier) if tier in PACKAGE_TIERS else -1,
              BREAK_CLASSES.index(break_class) if break_class in BREAK_CLASSES else -1)
    values = []
    for group, level in enumerate(levels):
        for threshold in (1, 2, 3):
            values.append((float(level >= threshold) - centers[group * 3 + threshold - 1]) if level >= 0 else 0.)
    return values


def raw_prediction(fitted, features):
    season = fitted["pooled"] if features.get("season") is None else fitted["seasons"].get(features.get("season"))
    if not season:
        raise ValueError("Unknown model season")
    log_price = season["logBase"] + sum(value * coefficient for value, coefficient in zip(vector(features, fitted["centers"]), fitted["coefficients"]))
    value = math.exp(log_price)
    if not math.isfinite(value) or value <= 0:
        raise ValueError("Invalid strict hybrid prediction")
    return value


def title_key(features):
    return "|".join(str(features.get(key) or "unknown") for key in COMMON)


def lock_count(features):
    return sum(1 for key, value in features.items() if key.startswith("binding:") and value not in (None, "transferable", "unbound"))


def round_price(value):
    unit = 100 if value >= 1000 else 10 if value >= 100 else 1
    return max(1, round(value / unit) * unit)


class Predictor:
    def __init__(self):
        self.model = artifact()
        published = json.loads((ROOT / "app/valuation-tabpfn-manifest.json").read_text(encoding="utf-8"))
        self.meta = manifest()
        if self.meta != published:
            raise ValueError("Private model / public manifest mismatch")
        self.bands = [dict(slug=season, median=self.predict_many([dict(season=season, breakClass="none", packageTier="medium")])[0],
                           low=None, high=None, status="unvalidated", method=self.meta["method"], confidence="inferred",
                           sampleCount=self.meta["seasonCounts"][season], asOf=self.meta["asOf"])
                      for season in self.meta["seasons"]]

    def price(self, features):
        plain = raw_prediction(self.model["plain"], features)
        corrected = raw_prediction(self.model["corrected"], features)
        title = self.model["titleResiduals"].get(title_key(features), 0.)
        binding = self.model["bindingResiduals"].get(str(lock_count(features)), self.model["bindingFallback"])
        corrected *= math.exp(title + binding)
        weight = self.model["blendWeight"]
        return math.exp((1 - weight) * math.log(plain) + weight * math.log(corrected))

    def predict_many(self, inputs):
        return [round_price(self.price(features)) for features in inputs]

    def predict(self, features):
        count = features.get("packageCount") if isinstance(features.get("packageCount"), int) else None
        tier = features.get("packageTier") or tier_for_count(count)
        neutral = {**features, "packageTier": None, "packageCount": None}
        multiplier = self.price(features) / self.price(neutral)
        basis = "count" if count is not None else "tier" if tier in PACKAGE_TIERS else "unknown"
        return dict(schemaVersion=1, modelRevision=REVISION, status="unvalidated",
                    packageAdjustment=dict(count=count if basis == "count" else None, multiplier=multiplier, basis=basis),
                    midpoint=self.predict_many([features])[0], currency="TWD", range=None, seasonBands=self.bands)


if __name__ == "__main__":
    print(json.dumps(manifest(), ensure_ascii=False, indent=2))
