"""Small, predeclared nested grouped search. Private artifacts only; never deploys."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
from sklearn.model_selection import GroupKFold

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comparison', ROOT / 'scripts/compare-percentage-models.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
listing = c.load_module('listing', 'listing-price-model.py')

# Keep the approved baseline first (stable tie-break), no outer-fold tuning.
OPTIONS = [{}, {'max_leaf_nodes': 3}, {'max_leaf_nodes': 15},
           {'min_samples_leaf': 5}, {'min_samples_leaf': 20}, {'min_samples_leaf': 30},
           {'l2_regularization': 1}, {'l2_regularization': 30},
           {'learning_rate': .03, 'max_iter': 250},
           {'learning_rate': .08, 'max_iter': 100}]


def constraint_check(model, seasons):
    # Test neutral plus observed feature contexts without consulting any prices.
    contexts = [{}]
    for row in model.rows:
        features = row.get('features', {})
        if features and features not in contexts:
            contexts.append(features)
        if len(contexts) == 4:
            break
    probes = [dict(season=s, breakClass=b, packageTier=p, features=f)
              for f in contexts for s in seasons
              for b in ('none', 'slight', 'medium', 'large')
              for p in ('few', 'medium', 'many', 'hundred')]
    grid = model.predict(probes).reshape(len(contexts), len(seasons), 4, 4)
    violations = dict(season=int((np.diff(grid, axis=1) > 1e-8).sum()),
                      breaks=int((np.diff(grid, axis=2) > 1e-8).sum()),
                      packages=int((np.diff(grid, axis=3) < -1e-8).sum()))
    return dict(passed=not any(violations.values()), probeCount=len(probes), violations=violations)


def select_params(rows, seasons):
    splits = list(GroupKFold(n_splits=3).split(rows, groups=[r['splitGroup'] for r in rows]))
    trials = []
    for params in OPTIONS:
        errors, checks = [], []
        for ti, vi in splits:
            train, test = [rows[i] for i in ti], [rows[i] for i in vi]
            assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
            model = listing.ListingPriceModel().fit(train, seasons, params=params)
            checks.append(constraint_check(model, seasons))
            errors.extend(abs(p-r['price'])/r['price'] for p,r in zip(model.predict(test), test))
        trials.append(dict(params=params, medianApe=float(np.median(errors)),
                           p90Ape=float(np.quantile(errors, .9)), constraints=checks,
                           eligible=all(check['passed'] for check in checks)))
    eligible = [t for t in trials if t['eligible']]
    if not eligible:
        raise ValueError('No constraint-safe training candidate')
    selected = min(eligible, key=lambda t:(t['medianApe'], t['p90Ape']))
    return selected['params'], trials


def run(source, output):
    output = output.resolve()
    if output.exists() or not output.is_relative_to((ROOT / 'work').resolve()):
        raise ValueError('Use a new private work/ directory')
    raw = source.read_bytes()
    data = json.loads(raw)
    rows, ledger = c.audit_rows(data['rows'])
    seasons = data['seasons']
    pairs = {'baseline': [], 'tuned': []}
    folds = []
    for fold in range(5):
        train, test = [r for r in rows if r['fold'] != fold], [r for r in rows if r['fold'] == fold]
        if not train or not test:
            raise ValueError('Empty outer fold')
        assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
        params, trials = select_params(train, seasons)
        models = {name:listing.ListingPriceModel().fit(train, seasons, params=p)
                  for name,p in [('baseline', {}), ('tuned', params)]}
        checks = {name:constraint_check(model, seasons) for name,model in models.items()}
        for name, model in models.items():
            pairs[name].extend({**{k:r.get(k) for k in ('postKey','season','breakClass','packageTier','priceKind')},
                                'fold':fold, 'actual':r['price'], 'predicted':float(p)}
                               for r,p in zip(test, model.predict(test)))
        folds.append(dict(fold=fold, selected=params, innerTrials=trials, constraints=checks))
        print(json.dumps({'completedFold':fold, 'selected':params}), flush=True)
    scores = {name:c.strata(value, seasons) for name,value in pairs.items()}
    gate = c.acceptance(scores['baseline'], scores['tuned'])
    params, trials = select_params(rows, seasons)
    model = listing.ListingPriceModel().fit(rows, seasons, params=params)
    check = constraint_check(model, seasons)
    if not check['passed'] or any(not f['constraints']['tuned']['passed'] for f in folds):
        gate['passed'] = False
        gate['reasons'].append('candidate conditional monotonicity failed')
    output.mkdir(parents=True)
    import joblib
    state = output / 'candidate.joblib'
    joblib.dump(vars(model), state)
    restored = listing.ListingPriceModel()
    restored.__dict__.update(joblib.load(state))
    np.testing.assert_allclose(model.predict(rows), restored.predict(rows), rtol=0, atol=0)
    report = dict(validation='nested_grouped_development_not_blind', productionChanged=False,
                  sourceDigest=hashlib.sha256(raw).hexdigest(), rowCount=len(rows),
                  groupCount=len({r['splitGroup'] for r in rows}), options=OPTIONS, ledger=ledger,
                  folds=folds, metrics=scores, pairs=pairs, gate=gate, selected=params,
                  fullTrainingTrials=trials, fullConstraints=check, replayVerified=True,
                  stateSha256=hashlib.sha256(state.read_bytes()).hexdigest())
    (output / 'report.private.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({name:{k:v[k] for k in ('overall','knownSeason','unknownSeason')} for name,v in scores.items()}))
    print(json.dumps({'gate':gate, 'selected':params, 'constraints':check}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    run(args.source, args.output)
