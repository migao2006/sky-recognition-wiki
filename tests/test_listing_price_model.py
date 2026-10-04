import importlib.util
import itertools
import os
from pathlib import Path
import unittest

os.environ.setdefault('OMP_NUM_THREADS', '4')
spec = importlib.util.spec_from_file_location('listing_model', Path(__file__).resolve().parents[1] / 'scripts/listing-price-model.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ListingModelTests(unittest.TestCase):
    def setUp(self):
        self.seasons = ['early', 'middle', 'late']
        self.rows = [dict(season=s, breakClass=b, packageTier=t, priceKind='ask',
                          price=1000 * (4 - i) * (1 + k / 4) / (1 + j / 4),
                          features={'accountStyle': 'regular', 'candles': i * 10})
                     for (i, s), (j, b), (k, t) in itertools.product(enumerate(self.seasons),
                        enumerate(['none', 'slight', 'medium', 'large']), enumerate(['few', 'medium', 'many', 'hundred']))]

    def test_conditional_monotonicity(self):
        model = m.ListingPriceModel().fit(self.rows, self.seasons)
        grid = [{k: r[k] for k in ['season', 'breakClass', 'packageTier']} for r in self.rows]
        p = model.predict(grid).reshape(3, 4, 4)
        self.assertTrue((m.np.diff(p, axis=0) <= 1e-8).all())
        self.assertTrue((m.np.diff(p, axis=1) <= 1e-8).all())
        self.assertTrue((m.np.diff(p, axis=2) >= -1e-8).all())

    def test_unknown_does_not_become_latest(self):
        model = m.ListingPriceModel().fit(self.rows, self.seasons)
        self.assertTrue(m.np.isnan(model._matrix([{'season': None}])[0, 0]))
        self.assertTrue(m.np.isfinite(model.predict([{'features': {'accountStyle': 'resource'}}])).all())

    def test_input_price_never_changes_prediction(self):
        model = m.ListingPriceModel().fit(self.rows, self.seasons)
        p = model.predict([{'season': 'early', 'price': 1}, {'season': 'early', 'price': 999999}])
        self.assertEqual(p[0], p[1])

    def test_accepts_sold_listing_but_not_transaction_label(self):
        self.rows[0]['priceKind'] = 'sold_proxy'
        m.ListingPriceModel().fit(self.rows, self.seasons)
        self.rows[0]['priceKind'] = 'sold'
        with self.assertRaises(ValueError):
            m.ListingPriceModel().fit(self.rows, self.seasons)


if __name__ == '__main__':
    unittest.main()
