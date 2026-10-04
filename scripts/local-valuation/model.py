"""Frozen bounded percentage model; private inputs never leave this host."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'bounded-percentage-2026-10-05'
SOURCE_SHA = 'cc8836460add0297ce56629a7425527c330200d2758e0e6fce8e5e6f0d0b56d9'
STATE_SHA = 'f23da023abefacc23c5cde8b7fe56d4f3505b3ba8d5462d4ac531bea962c9242'
ARTIFACT = ROOT / 'work/bounded-percentage-2026-10-05'
FIT_PARAMS = dict(bounded_baselines=True, effect_regularization=3., season_smoothing=.5)


def load_data():
    raw = (ARTIFACT / 'frozen.private.json').read_bytes()
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
    raw = (ARTIFACT / 'candidate.joblib').read_bytes()
    if hashlib.sha256(raw).hexdigest() != STATE_SHA:
        raise ValueError('Private artifact digest mismatch')
    # Only our fixed, locally generated artifact is accepted, never uploads.
    model = recipe().PercentagePriceModel()
    model.__dict__.update(joblib.load(ARTIFACT / 'candidate.joblib'))
    if model.baseline_mode != 'bounded' or model.fit_params != FIT_PARAMS:
        raise ValueError('Bounded recipe mismatch')
    return model, STATE_SHA


def manifest():
    rows, seasons, digest = load_data()
    model, state_digest = artifact()
    categorical = ['season', 'breakClass', 'packageTier', *sorted({k for k, _ in model.bindings})]
    return dict(schemaVersion=1, modelRevision=REVISION, method='bounded-percentage', sourceDigest=digest,
                stateSha256=state_digest, columns=[*categorical, *model.resources],
                categorical=categorical, seasons=seasons,
                sampleCount=len(rows), seasonCounts={s:sum(r.get('season') == s for r in rows) for s in seasons},
                asOf='2026-10-05', status='unvalidated')


class Predictor:
    def __init__(self):
        self.meta = manifest()
        published = json.loads((ROOT / 'app/valuation-tabpfn-manifest.json').read_text(encoding='utf-8'))
        if self.meta != published:
            raise ValueError('Private model / public manifest mismatch')
        self.model, _ = artifact()
        # Package effects are centered at the medium/many geometric midpoint.
        prices = self.predict_many([dict(season=s, breakClass='none') for s in self.meta['seasons']])
        self.bands = [dict(slug=s, median=p, low=None, high=None, status='unvalidated',
                           method='bounded-percentage', confidence='inferred', sampleCount=self.meta['seasonCounts'][s],
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
