"""Private grouped development comparison. Never publishes a model."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

model_module = load_module('percentage', 'percentage-price-model.py')
benchmark = load_module('benchmark', 'benchmark-market-models.py')


def audit_rows(source):
    """Union known identity links before exclusions and splitting; no fuzzy guesses."""
    parents = list(range(len(source)))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    seen = {}
    for i, r in enumerate(source):
        keys = [(k, str(r[k])) for k in ('splitGroup', 'accountKey', 'postKey', 'stablePost', 'textKey') if r.get(k)]
        keys += [('alias', str(v)) for v in r.get('identityAliases', []) if v]
        if not keys:
            raise ValueError('Missing source identity')
        for key in keys:
            if key in seen:
                parents[root(i)] = root(seen[key])
            seen[key] = i
    components = {}
    for i in range(len(source)):
        components.setdefault(root(i), []).append(i)
    rows, ledger = [], []
    for members in components.values():
        isolated = any(source[i].get('knownAnswer') or source[i].get('excludeFromModel') or
                       source[i].get('exclude_from_model') for i in members)
        group = hashlib.sha256('|'.join(sorted(str(source[i].get('accountKey') or source[i]['postKey']) for i in members)).encode()).hexdigest()
        fingerprints = set()
        for i in members:
            r = source[i]
            reason = 'isolated_identity' if isolated else None
            if not reason and (r.get('currency') != 'TWD' or r.get('market') != 'taiwan' or
                               r.get('server') not in (None, 'unknown', 'international') or
                               r.get('priceKind') not in ('ask', 'sold_proxy') or
                               not isinstance(r.get('price'), (int, float)) or isinstance(r['price'], bool) or
                               not np.isfinite(r['price']) or r['price'] <= 0):
                reason = 'invalid_market_or_target'
            # Only identical records of the same identity are removed. Conflicting
            # prices/traits stay grouped and visible, never averaged or overwritten.
            fingerprint = json.dumps({k:r.get(k) for k in ('summary', 'price', 'priceKind', 'season', 'breakClass', 'packageTier', 'features')}, sort_keys=True)
            if not reason and fingerprint in fingerprints:
                reason = 'identical_identity_record'
            fingerprints.add(fingerprint)
            ledger.append(dict(index=i, accountKey=r.get('accountKey'), group=group, excluded=reason))
            if not reason:
                rows.append({**r, 'splitGroup': group, 'fold': int(group[:8], 16) % 5})
    return rows, ledger


def strata(pairs, seasons):
    result = {'overall':benchmark.metrics(pairs),
              'knownSeason':benchmark.metrics([r for r in pairs if r.get('season')]),
              'unknownSeason':benchmark.metrics([r for r in pairs if not r.get('season')])}
    for field, values in [('season', seasons), ('breakClass', list(model_module.BREAKS) + [None]),
                          ('packageTier', list(model_module.PACKAGES) + [None]), ('priceKind', ['ask', 'sold_proxy'])]:
        for value in values:
            result[f'{field}:{value or "unknown"}'] = benchmark.metrics([r for r in pairs if r.get(field) == value])
    return result


def acceptance(old, new):
    reasons = []
    for key in ('overall', 'knownSeason'):
        a, b = old[key]['medianApe'], new[key]['medianApe']
        if a is None or b is None or b > a + 1e-9:
            reasons.append(f'{key}: median regression or missing metric')
    if not any(old[k]['medianApe'] is not None and old[k]['medianApe'] > 0 and
               new[k]['medianApe'] is not None and new[k]['medianApe'] <= .95 * old[k]['medianApe']
               for k in ('overall', 'knownSeason')):
        reasons.append('no 5% relative median improvement')
    for key in old:
        if old[key]['count'] >= 10 and (new[key]['medianApe'] is None or old[key]['medianApe'] is None or
                                       new[key]['medianApe'] > old[key]['medianApe'] + .05 + 1e-9):
            reasons.append(f'{key}: subgroup worsened over 5 percentage points')
    if old['overall']['p90Ape'] is None or new['overall']['p90Ape'] is None or new['overall']['p90Ape'] > old['overall']['p90Ape'] + 1e-9:
        reasons.append('overall tail regression or missing metric')
    return dict(passed=not reasons, reasons=reasons, autoPublish=False)


def run(source, target):
    target = target.resolve()
    if not target.is_relative_to((ROOT / 'work').resolve()) or target.exists():
        raise ValueError('Output must be a new private work/ directory')
    raw = source.read_bytes()
    data = json.loads(raw)
    rows, ledger = audit_rows(data['rows'])
    seasons = data['seasons']
    pairs = {'fixed': [], 'adjustable': []}
    fold_support = []
    for fold in range(5):
        train = [r for r in rows if r['fold'] != fold]
        test = [r for r in rows if r['fold'] == fold]
        if not train or not test:
            raise ValueError('Empty development fold')
        assert not {r['splitGroup'] for r in train} & {r['splitGroup'] for r in test}
        for name in pairs:
            model = model_module.PercentagePriceModel().fit(train, seasons, adjust_baselines=name == 'adjustable')
            if name == 'adjustable':
                fold_support.append(dict(fold=fold, support=model.baseline_support))
            pairs[name].extend({**{k:r.get(k) for k in ('accountKey','season','breakClass','packageTier','priceKind')},
                                'fold':fold, 'actual':r['price'], 'predicted':float(p)} for r,p in zip(test, model.predict(test)))
    scores = {name:strata(p, seasons) for name,p in pairs.items()}
    full = {name:model_module.PercentagePriceModel().fit(rows, seasons, adjust_baselines=name == 'adjustable') for name in pairs}
    probes = [dict(season=s, breakClass='none') for s in seasons]
    baseline = [{**dict(season=s, support=full['adjustable'].baseline_support[s]),
                 **{name:float(model.predict([probe])[0]) for name,model in full.items()}}
                for s,probe in zip(seasons, probes)]
    report = dict(validation='grouped_development_not_blind', productionChanged=False,
                  sourceDigest=hashlib.sha256(raw).hexdigest(), inputCount=len(data['rows']), rowCount=len(rows),
                  groupCount=len({r['splitGroup'] for r in rows}), identityQuality='source_links_not_verified_unique_accounts',
                  exclusions=dict(Counter(r['excluded'] for r in ledger if r['excluded'])),
                  missing={k:sum(r.get(k) is None for r in rows) for k in ('season','breakClass','packageTier')},
                  priceKinds=dict(Counter(r['priceKind'] for r in rows)), metrics=scores,
                  gate=acceptance(scores['fixed'], scores['adjustable']), pairs=pairs, ledger=ledger,
                  foldSupport=fold_support, baselines=baseline,
                  factors={name:{field:{v:model.explain([{'season':seasons[0],field:v}])[0]['factors'][factor]
                                       for v in values} for field,values,factor in
                                [('breakClass',model_module.BREAKS,'breaks'),('packageTier',model_module.PACKAGES,'packages')]}
                           for name,model in full.items()})
    target.mkdir(parents=True)
    frozen = json.dumps(dict(seasons=seasons, rows=rows), ensure_ascii=False, sort_keys=True, indent=2)
    report['frozenDigest'] = hashlib.sha256(frozen.encode()).hexdigest()
    (target / 'frozen.private.json').write_text(frozen, encoding='utf-8')
    (target / 'report.private.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    import joblib
    joblib.dump(vars(full['adjustable']), target / 'candidate.joblib')
    print(json.dumps({k:report[k] for k in ('rowCount','groupCount','exclusions','missing','gate')}))
    print(json.dumps({n:{k:scores[n][k] for k in ('overall','knownSeason','unknownSeason')} for n in pairs}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    run(args.source, args.output)
