import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location('historical', Path(__file__).resolve().parents[1] / 'scripts/compare-historical-price-models.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class HistoricalComparisonTests(unittest.TestCase):
    def test_selection_is_grouped_and_uses_only_passed_training_rows(self):
        rows = [dict(splitGroup=str(i//2), postKey=str(i), price=1000) for i in range(18)]
        calls = []
        class Model:
            def fit(self, train, seasons, *, loss):
                self.groups = {r['splitGroup'] for r in train}
                self.loss = loss
                calls.append((loss, {r['postKey'] for r in train}))
                return self
            def predict(self, test):
                assert not self.groups & {r['splitGroup'] for r in test}
                return np.full(len(test), 1000 if self.loss == 'absolute_error' else 2000)
        with patch.object(m.listing, 'ListingPriceModel', Model):
            selected, scores = m.select_loss(rows, ['early'])
        self.assertEqual(selected, 'absolute_error')
        self.assertEqual(scores['absolute_error'], 0)
        self.assertEqual(len(calls), 6)
        self.assertTrue(all(keys < {r['postKey'] for r in rows} for _,keys in calls))


if __name__ == '__main__':
    unittest.main()
