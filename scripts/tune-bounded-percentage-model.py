"""Bounded baseline comparison; private grouped development, never auto-publishes."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.model_selection import GroupKFold

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comparison', ROOT / 'scripts/compare-percentage-models.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
listing = c.load_module('listing', 'listing-price-model.py')
OPTIONS = [dict(effect_regularization=e, season_smoothing=s)
           for e in (3., 10., 30.) for s in (.1, .5, 1.)]


def fit(rows, seasons, params):
    return c.model_module.PercentagePriceModel().fit(
        rows, seasons, bounded_baselines=True, progressive_packages=True, package_season_scaling=True, **params,
    )


def check(model):
    seasons = model.seasons
    probes = [dict(season=s, breakClass=b, packageTier=p)
              for s in seasons for b in c.model_module.BREAKS for p in c.model_module.PACKAGES]
    grid = model.predict(probes).reshape(len(seasons), 4, 4)
    if (np.diff(grid, axis=0) > 1e-6).any() or (np.diff(grid, axis=1) > 1e-6).any() or (np.diff(grid, axis=2) < -1e-6).any():
        raise ValueError('Direction failed')
    for season, anchor in model.anchors.items():
        prices = model.predict([dict(season=season, breakClass='none', packageTier=p) for p in ('medium', 'many')])
        baseline = float(np.sqrt(prices.prod()))
        if not anchor * .9 - 1e-6 <= baseline <= anchor * 1.1 + 1e-6:
            raise ValueError('Baseline escaped approved band')
        np.testing.assert_allclose(baseline, model.predict([dict(season=season)])[0], rtol=1e-12)
    for resource in model.resources:
        values = model.predict([dict(features={resource:v}) for v in (0, 1, 100, 1000000)])
        if (np.diff(values) < -1e-6).any():
            raise ValueError('Resource direction failed')
    unknown = model.explain([{}])[0]
    if unknown['seasonKnown'] or unknown['breakKnown'] or unknown['packageKnown']:
        raise ValueError('Unknown input changed')
    return dict(passed=True, probes=len(probes), anchorCount=len(model.anchors))


def select_params(rows, seasons):
    splits = list(GroupKFold(n_splits=3).split(rows, groups=[r['splitGroup'] for r in rows]))
    trials = []
    for params in OPTIONS:
        errors = []
        for ti, vi in splits:
            train, test = [rows[i] for i in ti], [rows[i] for i in vi]
            assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
            model = fit(train, seasons, params)
            check(model)
            errors.extend(abs(p-r['price'])/r['price'] for p,r in zip(model.predict(test), test))
        trials.append(dict(params=params, medianApe=float(np.median(errors)), p90Ape=float(np.quantile(errors,.9))))
    best = min(trials, key=lambda t:(t['medianApe'],t['p90Ape']))
    return best['params'], trials


def run(source, output):
    output = output.resolve()
    if output.exists() or not output.is_relative_to((ROOT/'work').resolve()):
        raise ValueError('Use a new private work/ directory')
    raw = source.read_bytes()
    data = json.loads(raw)
    rows, ledger = c.audit_rows(data['rows'])
    seasons = data['seasons']
    pairs, folds = {'baseline':[], 'bounded':[]}, []
    for fold in range(5):
        train, test = [r for r in rows if r['fold'] != fold], [r for r in rows if r['fold'] == fold]
        if not train or not test:
            raise ValueError('Empty outer fold')
        assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
        params, trials = select_params(train,seasons)
        models = dict(baseline=listing.ListingPriceModel().fit(train,seasons), bounded=fit(train,seasons,params))
        check(models['bounded'])
        for name, model in models.items():
            pairs[name].extend({**{k:r.get(k) for k in ('postKey','season','breakClass','packageTier','priceKind')},
                                'fold':fold,'actual':r['price'],'predicted':float(p)} for r,p in zip(test,model.predict(test)))
        folds.append(dict(fold=fold,selected=params,innerTrials=trials))
        print(json.dumps(dict(completedFold=fold,selected=params)),flush=True)
    params,trials = select_params(rows,seasons)
    model = fit(rows,seasons,params)
    safety = check(model)
    scores = {name:c.strata(p,seasons) for name,p in pairs.items()}
    output.mkdir(parents=True)
    state = output/'candidate.joblib'
    joblib.dump(vars(model),state)
    restored = c.model_module.PercentagePriceModel()
    restored.__dict__.update(joblib.load(state))
    np.testing.assert_array_equal(model.predict(rows),restored.predict(rows))
    frozen = json.dumps(dict(seasons=seasons,rows=rows),ensure_ascii=False,sort_keys=True,indent=2)
    (output/'frozen.private.json').write_text(frozen,encoding='utf-8')
    report = dict(validation='nested_grouped_development_not_blind',productionChanged=False,
                  sourceDigest=hashlib.sha256(raw).hexdigest(),frozenDigest=hashlib.sha256((output/'frozen.private.json').read_bytes()).hexdigest(),
                  stateSha256=hashlib.sha256(state.read_bytes()).hexdigest(),rowCount=len(rows),
                  groupCount=len({r['splitGroup'] for r in rows}),ledger=ledger,options=OPTIONS,folds=folds,
                  selected=params,fullTrainingTrials=trials,metrics=scores,pairs=pairs,safety=safety,replayVerified=True,
                  accuracyGate=c.acceptance(scores['baseline'],scores['bounded']),baselinePriorityAuthorized=True,
                  baselines={s:float(model.predict([dict(season=s)])[0]) for s in seasons})
    (output/'report.private.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('selected','safety','frozenDigest','stateSha256','baselines')}))
    print(json.dumps({n:{k:v[k] for k in ('overall','knownSeason','unknownSeason')} for n,v in scores.items()}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args = parser.parse_args()
    run(args.source,args.output)
