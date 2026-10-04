"""Compare the previous monotone model against percentage pricing on identical folds.

Robust-loss selection happens only inside each training fold, not on outer results.
No serving files are changed. All records and predictions remain private.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from sklearn.model_selection import GroupKFold
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comparison', ROOT / 'scripts/compare-percentage-models.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
listing = c.load_module('listing', 'listing-price-model.py')


def select_loss(rows, seasons):
    splits = list(GroupKFold(n_splits=3).split(rows, groups=[r['splitGroup'] for r in rows]))
    scores = {}
    for loss in ('squared_error', 'absolute_error'):
        errors = []
        for ti, vi in splits:
            train, test = [rows[i] for i in ti], [rows[i] for i in vi]
            assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
            model = listing.ListingPriceModel().fit(train, seasons, loss=loss)
            errors.extend(abs(p-r['price'])/r['price'] for p,r in zip(model.predict(test), test))
        scores[loss] = float(np.median(errors))
    return min(scores, key=scores.get), scores


def run(source, output):
    output = output.resolve()
    if output.exists() or not output.is_relative_to((ROOT / 'work').resolve()):
        raise ValueError('Use a new private work/ directory')
    raw = source.read_bytes()
    data = json.loads(raw)
    rows, ledger = c.audit_rows(data['rows'])
    pairs = {k:[] for k in ('percentage', 'previous_monotone', 'nested_robust')}
    tuning = []
    for fold in range(5):
        train = [r for r in rows if r['fold'] != fold]
        test = [r for r in rows if r['fold'] == fold]
        assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
        loss, scores = select_loss(train, data['seasons'])
        tuning.append(dict(fold=fold, selected=loss, trainingOnlyScores=scores))
        models = {
            'percentage':c.model_module.PercentagePriceModel().fit(train, data['seasons']),
            'previous_monotone':listing.ListingPriceModel().fit(train, data['seasons']),
            'nested_robust':listing.ListingPriceModel().fit(train, data['seasons'], loss=loss)}
        for name, model in models.items():
            pairs[name].extend({**{k:r.get(k) for k in ('postKey','season','breakClass','packageTier','priceKind')},
                                'fold':fold, 'actual':r['price'], 'predicted':float(p)}
                               for r,p in zip(test, model.predict(test)))
        print(json.dumps({'completedFold':fold, 'loss':loss}), flush=True)
    scores = {k:c.strata(v, data['seasons']) for k,v in pairs.items()}
    report = dict(validation='nested_grouped_development_not_blind', productionChanged=False,
                  sourceDigest=hashlib.sha256(raw).hexdigest(), rowCount=len(rows),
                  groupCount=len({r['splitGroup'] for r in rows}), ledger=ledger, tuning=tuning,
                  metrics=scores, pairs=pairs,
                  gates={k:c.acceptance(scores['percentage'], scores[k]) for k in scores if k != 'percentage'},
                  robustVsPrevious=c.acceptance(scores['previous_monotone'], scores['nested_robust']))
    output.mkdir(parents=True)
    # Final training uses the same inner-selection recipe; outer outcomes never
    # choose this loss. Save only our local state, never accept uploaded pickle.
    import joblib
    loss, full_scores = select_loss(rows, data['seasons'])
    candidate = listing.ListingPriceModel().fit(rows, data['seasons'], loss=loss)
    state = output / 'candidate.joblib'
    joblib.dump(vars(candidate), state)
    restored = listing.ListingPriceModel()
    restored.__dict__.update(joblib.load(state))
    probes = [dict(season=s, breakClass=b, packageTier=p)
              for s in data['seasons'] for b in ('none','slight','medium','large')
              for p in ('few','medium','many','hundred')]
    prices = restored.predict(probes)
    np.testing.assert_allclose(prices, candidate.predict(probes), rtol=0, atol=0)
    grid = prices.reshape(len(data['seasons']), 4, 4)
    violations = {'season': int((np.diff(grid, axis=0) > 1e-8).sum()),
                  'breaks': int((np.diff(grid, axis=1) > 1e-8).sum()),
                  'packages': int((np.diff(grid, axis=2) < -1e-8).sum())}
    report['candidate'] = dict(loss=loss, trainingOnlyScores=full_scores,
                               stateSha256=hashlib.sha256(state.read_bytes()).hexdigest(),
                               replayVerified=True, monotoneProbeCount=len(probes),
                               violations=violations, usable=not any(violations.values()))
    if any(violations.values()):
        report['gates']['nested_robust']['passed'] = False
        report['gates']['nested_robust']['reasons'].append('full-fit conditional monotonicity failed')
    previous = listing.ListingPriceModel().fit(rows, data['seasons'])
    previous_grid = previous.predict(probes).reshape(len(data['seasons']), 4, 4)
    assert (np.diff(previous_grid, axis=0) <= 1e-8).all()
    assert (np.diff(previous_grid, axis=1) <= 1e-8).all()
    assert (np.diff(previous_grid, axis=2) >= -1e-8).all()
    previous_state = output / 'previous-monotone.joblib'
    joblib.dump(vars(previous), previous_state)
    report['previousArtifact'] = dict(stateSha256=hashlib.sha256(previous_state.read_bytes()).hexdigest(),
                                      monotoneProbeCount=len(probes), constraintsPassed=True)
    (output / 'report.private.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:{s:v[s] for s in ('overall','knownSeason','unknownSeason')} for k,v in scores.items()}))
    print(json.dumps(report['gates']))
    print(json.dumps(report['robustVsPrevious']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    run(args.source, args.output)
