"""Compare count-curve adapter on the same frozen folds, without moving baselines."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bounded', ROOT/'scripts/tune-bounded-percentage-model.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def check_curve(model):
    b.check(model)
    grid = [dict(season=s,breakClass=br,features={'packageCount':n}) for s in model.seasons
            for br in b.c.model_module.BREAKS for n in range(351)]
    values = model.predict(grid).reshape(len(model.seasons),4,351)
    assert np.all(np.diff(values,axis=0)<=1e-6)
    assert np.all(np.diff(values,axis=1)<=1e-6)
    assert np.all(np.diff(values,axis=2)>=-1e-6)
    for n in (30,75,95,150):
        assert abs(model.package_log_multiplier(n-1e-6)-model.package_log_multiplier(n+1e-6))<1e-6
    assert abs(model.package_log_multiplier(75)+model.package_log_multiplier(95))<1e-10
    return dict(passed=True,gridCount=len(grid),continuous=True)


def run(source, previous_report, output):
    output=output.resolve()
    if output.exists() or not output.is_relative_to((ROOT/'work').resolve()):
        raise ValueError('Use a new private output directory')
    raw=source.read_bytes()
    data=json.loads(raw)
    old=json.loads(previous_report.read_bytes())
    if hashlib.sha256(raw).hexdigest()!=old['frozenDigest']:
        raise ValueError('Comparison source mismatch')
    rows,seasons=data['rows'],data['seasons']
    pairs={'tier':[],'progressive':[]}
    for fold in old['folds']:
        train=[r for r in rows if r['fold']!=fold['fold']]
        test=[r for r in rows if r['fold']==fold['fold']]
        assert not {r['splitGroup'] for r in train}&{r['splitGroup'] for r in test}
        model=b.fit(train,seasons,fold['selected'])
        for name in pairs:
            model.progressive_packages=name=='progressive'
            check_curve(model) if model.progressive_packages else b.check(model)
            pairs[name].extend({**{k:r.get(k) for k in ('season','breakClass','packageTier','priceKind')},
                                'actual':r['price'],'predicted':float(p),'exactCount':model.package_count(r) is not None}
                               for r,p in zip(test,model.predict(test)))
    model=b.fit(rows,seasons,old['selected'])
    model.progressive_packages=True
    safety=check_curve(model)
    output.mkdir(parents=True)
    state=output/'candidate.joblib'
    joblib.dump(vars(model),state)
    restored=copy.copy(model)
    restored.__dict__.update(joblib.load(state))
    np.testing.assert_array_equal(model.predict(rows),restored.predict(rows))
    report=dict(validation='grouped_development_not_blind',rowCount=len(rows),groupCount=len({r['splitGroup'] for r in rows}),
                frozenDigest=hashlib.sha256(raw).hexdigest(),stateSha256=hashlib.sha256(state.read_bytes()).hexdigest(),
                previousReportDigest=hashlib.sha256(previous_report.read_bytes()).hexdigest(),selected=old['selected'],
                safety=safety,replayVerified=True,pairs=pairs,
                metrics={k:b.c.strata(v,seasons) for k,v in pairs.items()},
                exactCountMetrics={k:b.c.benchmark.metrics([p for p in v if p['exactCount']]) for k,v in pairs.items()},
                curve={n:float(np.exp(model.package_log_multiplier(n))) for n in (0,30,60,75,90,95,99,100,150,200,250,300)})
    (output/'report.private.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('safety','stateSha256','exactCountMetrics','curve')}))
    print(json.dumps({k:v['overall'] for k,v in report['metrics'].items()}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('previous_report',type=Path)
    parser.add_argument('output',type=Path)
    a=parser.parse_args()
    run(a.source,a.previous_report,a.output)
