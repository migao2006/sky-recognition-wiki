import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location('tuning', Path(__file__).resolve().parents[1] / 'scripts/tune-listing-price-model.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class TuningTests(unittest.TestCase):
    def test_grouped_selection_rejects_lower_error_unsafe_candidate(self):
        rows = [dict(splitGroup=str(i//2), price=1000) for i in range(18)]
        calls = []
        class Model:
            def fit(self, train, seasons, *, params):
                self.groups = {r['splitGroup'] for r in train}
                self.params = params
                calls.append(self.groups)
                return self
            def predict(self, test):
                assert not self.groups & {r['splitGroup'] for r in test}
                return np.full(len(test), 1000 if self.params else 1200)
        with patch.object(m.listing, 'ListingPriceModel', Model), \
             patch.object(m, 'OPTIONS', [{}, {'max_leaf_nodes':3}]), \
             patch.object(m, 'constraint_check', side_effect=lambda model, _: {'passed':not model.params}):
            chosen, trials = m.select_params(rows, ['early'])
        self.assertEqual(chosen, {})
        self.assertEqual(len(calls), 6)
        self.assertFalse(trials[1]['eligible'])
        self.assertTrue(all(g < {r['splitGroup'] for r in rows} for g in calls))

    def test_constraint_probe_detects_wrong_direction(self):
        class Model:
            rows = [{'features':{'candles': 10}}]
            def predict(self, rows):
                return np.array([100 if r['breakClass'] == 'none' else 200 for r in rows])
        result = m.constraint_check(Model(), ['early', 'late'])
        self.assertFalse(result['passed'])
        self.assertGreater(result['violations']['breaks'], 0)
        self.assertEqual(result['probeCount'], 64)

    def test_invalid_params_cannot_override_safety_controls(self):
        for params in [{'early_stopping':True}, {'monotonic_cst':None}, {'random_state':2},
                       {'max_iter':True}, {'max_leaf_nodes':1}, {'learning_rate':0},
                       {'min_samples_leaf':2.5}, {'l2_regularization':float('nan')}]:
            with self.assertRaises(ValueError):
                m.listing.ListingPriceModel().fit([], [], params=params)


if __name__ == '__main__':
    unittest.main()
