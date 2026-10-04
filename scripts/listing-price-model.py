"""Offline monotone listing-price candidate; never writes serving configuration."""
import importlib.util
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('benchmark', ROOT / 'scripts/benchmark-market-models.py')
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class ListingPriceModel:
    """Same remaining inputs: earlier season >= later, fewer breaks >= more, more packages >= fewer."""

    def fit(self, rows, seasons):
        if not rows or any(r.get('priceKind') not in ('ask', 'sold_proxy') or
                           not np.isfinite(r['price']) or r['price'] <= 0 for r in rows):
            raise ValueError('Expected positive listing prices, not transaction targets')
        self.rows, self.seasons = rows, seasons
        x, _, cats = benchmark.feature_table(rows, rows[:1], True)
        # Per-season progress must not act as a second unrestricted season input.
        self.extra = [k for k in x if k not in benchmark.COMMON and not k.startswith('progress:')]
        self.cats = [k for k in cats if k in self.extra]
        self.nums = [k for k in self.extra if k not in self.cats]
        self.encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        if self.cats:
            self.encoder.fit(x[self.cats])
        a = self._matrix(rows)
        self.model = HistGradientBoostingRegressor(loss='squared_error', learning_rate=.05,
            max_iter=150, max_leaf_nodes=7, min_samples_leaf=10, l2_regularization=10,
            early_stopping=False, random_state=42,
            monotonic_cst=[-1, -1, 1] + [0] * (a.shape[1] - 3))
        self.model.fit(a, np.log([r['price'] for r in rows]))
        return self

    def _matrix(self, rows):
        _, x, _ = benchmark.feature_table(self.rows, rows, True)
        maps = [dict((s, i) for i, s in enumerate(self.seasons)),
                {'none': 0, 'slight': 1, 'medium': 2, 'large': 3},
                {'few': 0, 'medium': 1, 'many': 2, 'hundred': 3}]
        core = np.array([[m.get(r.get(k), np.nan) for k, m in zip(benchmark.COMMON, maps)]
                         for r in rows], dtype=float)
        parts = [core]
        if self.nums:
            parts.append(x[self.nums].to_numpy(dtype=float))
        if self.cats:
            parts.append(self.encoder.transform(x[self.cats]))
        return np.concatenate(parts, axis=1)

    def predict(self, rows):
        values = np.exp(self.model.predict(self._matrix(rows)))
        if not np.isfinite(values).all() or (values <= 0).any():
            raise ValueError('Invalid listing-price prediction')
        return values


if __name__ == '__main__':
    import argparse
    import hashlib
    import json
    import joblib

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    target = args.output.resolve()
    if not target.is_relative_to((ROOT / 'work').resolve()) or target.exists():
        raise ValueError('Use a new output directory under private work/')
    raw = args.input.read_bytes()
    data = json.loads(raw)
    rows = [r for r in data['rows'] if not r.get('excludeFromModel') and not r.get('knownAnswer')]
    if any(r.get('currency') != 'TWD' or r.get('market') != 'taiwan' for r in rows):
        raise ValueError('Separate foreign currencies and markets before training')
    model = ListingPriceModel().fit(rows, data['seasons'])
    target.mkdir(parents=True)
    # Save data/state, not a __main__ class instance. Contains private training rows.
    joblib.dump(vars(model), target / 'state.joblib')
    restored = ListingPriceModel()
    restored.__dict__.update(joblib.load(target / 'state.joblib'))
    probe = [{'season': s, 'breakClass': 'none', 'packageTier': 'few'} for s in data['seasons']]
    np.testing.assert_allclose(model.predict(probe), restored.predict(probe))
    meta = {'revision': 'listing-monotone-candidate-2026-10-05', 'status': 'unvalidated',
            'target': 'listing_price', 'sampleCount': len(rows), 'productionChanged': False,
            'sourceDigest': hashlib.sha256(raw).hexdigest(),
            'stateDigest': hashlib.sha256((target / 'state.joblib').read_bytes()).hexdigest(),
            'seasonBands': [dict(season=r['season'], price=round(float(p))) for r, p in zip(probe, model.predict(probe))]}
    (target / 'manifest.private.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in meta.items() if k != 'seasonBands'}))
