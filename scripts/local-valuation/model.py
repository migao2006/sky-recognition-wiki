"""Frozen local percentage listing model; private inputs never leave this host."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'percentage-listing-2026-10-05'
SOURCE_SHA = 'b274d6e02763b029ab0fff0c4f724f4a9761e0d277ca7bafc2d75b8962d0bb79'
ARTIFACT = ROOT / 'work/percentage-candidate-2026-10-05'


def load_data():
    raw = (ROOT / 'work/current-information-2026-10-05.private.json').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SOURCE_SHA:
        raise ValueError('Frozen source changed')
    data = json.loads(raw)
    return data['rows'], data['seasons'], digest


def recipe():
    spec = importlib.util.spec_from_file_location('percentage', ROOT / 'scripts/percentage-price-model.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def artifact():
    import joblib
    report = json.loads((ARTIFACT / 'report.private.json').read_text(encoding='utf-8'))
    raw = (ARTIFACT / 'state.joblib').read_bytes()
    if report['sourceDigest'] != SOURCE_SHA or hashlib.sha256(raw).hexdigest() != report['stateDigest']:
        raise ValueError('Private artifact digest mismatch')
    # Only our fixed, locally generated artifact is accepted, never uploads.
    model = recipe().PercentagePriceModel()
    model.__dict__.update(joblib.load(ARTIFACT / 'state.joblib'))
    return model, report['stateDigest']


def manifest():
    rows, seasons, digest = load_data()
    model, state_digest = artifact()
    bindings = sorted({k for k, _ in model.bindings})
    return dict(schemaVersion=1, modelRevision=REVISION, method='percentage', sourceDigest=digest,
                stateSha256=state_digest, columns=['season', 'breakClass', 'packageTier', *bindings, *model.resources],
                categorical=['season', 'breakClass', 'packageTier', *bindings], seasons=seasons,
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
                           method='percentage', confidence='inferred', sampleCount=self.meta['seasonCounts'][s],
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
