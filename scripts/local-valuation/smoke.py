"""Explicit real-model smoke check; outputs timings, never training text or secrets."""
import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from model import ROOT, load_data, recipe, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    token = json.loads((ROOT / "work/local-valuation/config.json").read_text())["token"]
    meta = manifest()
    rows, _, _ = load_data()
    row = rows[0]
    features = {key: row.get(key) if key in ["season", "breakClass", "packageTier"] else row.get("features", {}).get(key) for key in meta["columns"]}
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
    raw = recipe().PercentagePriceModel().fit(rows, meta["seasons"]).predict([row])
    assert a[1]["midpoint"] == max(1, round(raw[0])), "Serving/benchmark prediction drift"
    for _ in range(6):
        assert call(body, client="rate-check")[0] == 200
    assert call(body, client="rate-check")[0] == 429
    print(json.dumps({"realModel": True, "parity": True, "predictionSeconds": a[2], "cachedSeconds": b[2], "authentication": True, "rateLimit": True}))


if __name__ == "__main__":
    main()
