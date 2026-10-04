import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location('bounded_tuning',Path(__file__).resolve().parents[1]/'scripts/tune-bounded-percentage-model.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class BoundedTuningTests(unittest.TestCase):
    def test_predeclared_grid_and_group_isolation(self):
        self.assertEqual(len(m.OPTIONS),9)
        rows = [dict(splitGroup=str(i//2),price=100,season='early') for i in range(18)]
        class Model:
            def __init__(self,train,params):
                self.groups={r['splitGroup'] for r in train}
                self.params=params
            def predict(self,test):
                assert not self.groups & {r['splitGroup'] for r in test}
                return np.array([100+self.params['effect_regularization']]*len(test))
        with patch.object(m,'fit',side_effect=lambda train,seasons,params:Model(train,params)),patch.object(m,'check'):
            selected,trials=m.select_params(rows,['early'])
        self.assertEqual(selected,m.OPTIONS[0])
        self.assertEqual(len(trials),9)

    def test_real_direction_and_bounds(self):
        rows=[dict(season=s,price=v,priceKind='ask',market='taiwan',currency='TWD')
              for s,v in m.c.model_module.ANCHORS.items()]
        model=m.fit(rows,list(m.c.model_module.ANCHORS),m.OPTIONS[0])
        self.assertTrue(m.check(model)['passed'])
        model.weights[0]+=1
        with self.assertRaises(ValueError):
            m.check(model)


if __name__=='__main__':
    unittest.main()
