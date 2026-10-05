"""Explicit real-model smoke check; outputs timings, never training text or secrets."""
import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from model import ROOT, manifest, Predictor


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = json.loads((ROOT / "work/local-valuation/config.json").read_text())["token"]
    meta = manifest()
    # This public-shaped probe has no private source row or user data.
    features = {key: None for key in meta["columns"]}
    features.update({"season": "enchantment", "breakClass": "none", "packageTier": "medium"})
    body = {"schemaVersion": 1, "features": features}
    def call(body, auth=True, client="smoke"):
        start = time.monotonic()
        headers = {"Content-Type": "application/json", "X-Valuation-Client": hashlib.sha256(client.encode()).hexdigest()}
        if auth:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(args.url + "/predict", data=json.dumps(body).encode(), headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=47) as r:
                return r.status, json.load(r), time.monotonic() - start
        except urllib.error.HTTPError as e:
            return e.code, json.load(e), time.monotonic() - start
    assert call(body, False)[0] == 401
    assert call({"schemaVersion": 1, "features": {"price": 3500}})[0] == 400
    a = call(body)
    b = call(body)
    assert a[0] == b[0] == 200 and a[1] == b[1]
    assert a[2] < 45 and len(a[1]["seasonBands"]) == 30 and a[1]["range"] is None
    predictor = Predictor()
    assert a[1]["midpoint"] == predictor.predict(features)["midpoint"], "Serving/artifact prediction drift"
    for count in (0, 100, 150, 191, 200):
        probe = {"season": "enchantment", "breakClass": "none", "packageCount": count}
        result = call({"schemaVersion": 1, "features": probe}, client="curve-parity")
        assert result[0] == 200 and result[1] == predictor.predict(probe), "Count curve API drift"
    for _ in range(6):
        assert call(body, client="rate-check")[0] == 200
    assert call(body, client="rate-check")[0] == 429
    print(json.dumps({"realModel": True, "parity": True, "packageTierParityCases": 5, "predictionSeconds": a[2], "cachedSeconds": b[2], "authentication": True, "rateLimit": True}))


if __name__ == "__main__":
    main()
