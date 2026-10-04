"""Frozen local monotone listing model; private inputs never leave this host."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'monotone-listing-2026-10-05'
SOURCE_SHA = 'cc8836460add0297ce56629a7425527c330200d2758e0e6fce8e5e6f0d0b56d9'
STATE_SHA = '96cbc0a37f0a0ab432da70048b039f25cf1cec5237cde47700f442378b87f588'
ARTIFACT = ROOT / 'work/historical-model-review-verified-2026-10-05'


def load_data():
    raw = (ROOT / 'work/percentage-review-round3-2026-10-05/frozen.private.json').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SOURCE_SHA:
        raise ValueError('Frozen source changed')
    data = json.loads(raw)
    return data['rows'], data['seasons'], digest


def recipe():
    spec = importlib.util.spec_from_file_location('listing', ROOT / 'scripts/listing-price-model.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def artifact():
    import joblib
    raw = (ARTIFACT / 'previous-monotone.joblib').read_bytes()
    if hashlib.sha256(raw).hexdigest() != STATE_SHA:
        raise ValueError('Private artifact digest mismatch')
    # Only our fixed, locally generated artifact is accepted, never uploads.
    model = recipe().ListingPriceModel()
    model.__dict__.update(joblib.load(ARTIFACT / 'previous-monotone.joblib'))
    return model, STATE_SHA


def manifest():
    rows, seasons, digest = load_data()
    model, state_digest = artifact()
    return dict(schemaVersion=1, modelRevision=REVISION, method='monotone', sourceDigest=digest,
                stateSha256=state_digest, columns=['season', 'breakClass', 'packageTier', *model.extra],
                categorical=['season', 'breakClass', 'packageTier', *model.cats], seasons=seasons,
                sampleCount=len(rows), seasonCounts={s:sum(r.get('season') == s for r in rows) for s in seasons},
                asOf='2026-10-05', status='unvalidated')


class Predictor:
    def __init__(self):
        self.meta = manifest()
        published = json.loads((ROOT / 'app/valuation-tabpfn-manifest.json').read_text(encoding='utf-8'))
        if self.meta != published:
            raise ValueError('Private model / public manifest mismatch')
        self.model, _ = artifact()
        prices = self.predict_many([dict(season=s, breakClass='none') for s in self.meta['seasons']])
        self.bands = [dict(slug=s, median=p, low=None, high=None, status='unvalidated',
                           method='monotone', confidence='inferred', sampleCount=self.meta['seasonCounts'][s],
                           asOf=self.meta['asOf']) for s, p in zip(self.meta['seasons'], prices)]

    def predict_many(self, inputs):
        common = ('season', 'breakClass', 'packageTier')
        rows = [{**{k:v for k,v in f.items() if k in common},
                 'features': {k:v for k,v in f.items() if k not in common}} for f in inputs]
        return [max(1, round(float(p))) for p in self.model.predict(rows)]

    def predict(self, features):
        return dict(schemaVersion=1, modelRevision=REVISION, status='unvalidated',
                    midpoint=self.predict_many([features])[0], currency='TWD', range=None, seasonBands=self.bands)


if __name__ == '__main__':
    # Read-only check; publish reviewed manifest via normal file editing.
    print(json.dumps(manifest(), ensure_ascii=False, indent=2))
