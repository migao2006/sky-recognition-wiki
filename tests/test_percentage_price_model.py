import importlib.util
import itertools
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('percentage', Path(__file__).resolve().parents[1] / 'scripts/percentage-price-model.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class PercentageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seasons = ['early', 'late']
        cls.rows = [dict(season=s, breakClass=b, packageTier=p, priceKind='ask',
                         currency='TWD', market='taiwan', price=(10000 if s == 'early' else 5000) * .8**j * 1.3**(k-1.5))
                    for s, (j, b), (k, p) in itertools.product(cls.seasons, enumerate(m.BREAKS), enumerate(m.PACKAGES))]
        cls.model = m.PercentagePriceModel().fit(cls.rows, cls.seasons, {'early': 10000, 'late': 5000})

    def test_baseline_and_reference(self):
        values = self.model.predict([dict(season='early', breakClass='none', packageTier=p) for p in ('medium', 'many')])
        self.assertAlmostEqual(float(np.sqrt(values.prod())), 10000, places=5)

    def test_monotonicity(self):
        values = self.model.predict(self.rows).reshape(2, 4, 4)
        self.assertTrue((np.diff(values, axis=0) <= 0).all())
        self.assertTrue((np.diff(values, axis=1) <= 1e-7).all())
        self.assertTrue((np.diff(values, axis=2) >= -1e-7).all())

    def test_product_and_proportionality(self):
        explanations = self.model.explain([dict(season=s, breakClass='slight', packageTier='hundred') for s in self.seasons])
        for e in explanations:
            self.assertAlmostEqual(e['price'], e['basePrice'] * np.prod(list(e['factors'].values())))
        self.assertAlmostEqual(explanations[0]['price'] / explanations[1]['price'], 2)

    def test_unknown_is_neutral_and_flagged(self):
        e = self.model.explain([{}])[0]
        self.assertFalse(e['seasonKnown'])
        self.assertFalse(e['breakKnown'])
        self.assertFalse(e['packageKnown'])
        self.assertEqual(e['factors'], dict(breaks=1, packages=1, bindings=1, resources=1))

    def test_price_not_input_and_package_count_not_double_counted(self):
        a, b = self.model.predict([dict(season='early', price=1), dict(season='early', price=999999, features={'packageCount': 200})])
        self.assertEqual(a, b)

    def test_reject_excluded(self):
        for patch in ({'knownAnswer': True}, {'currency': 'CNY'}, {'priceKind': 'sold'}, {'excludeFromModel': True}, {'exclude_from_model': True}):
            with self.assertRaises(ValueError):
                m.PercentagePriceModel().fit([{**self.rows[0], **patch}], self.seasons)

    def test_bounded_anchor_and_geometric_reference(self):
        for multiplier, boundary in ((.01, .9), (100, 1.1)):
            rows = [{**r, 'price':r['price']*multiplier} for r in self.rows]
            model = m.PercentagePriceModel().fit(rows, self.seasons, {'early':10000,'late':5000}, bounded_baselines=True)
            for season, anchor in model.anchors.items():
                values = model.predict([dict(season=season,breakClass='none',packageTier=p) for p in ('medium','many')])
                base = np.sqrt(values.prod())
                self.assertAlmostEqual(base, anchor*boundary, delta=.01)
            self.assertEqual(model.baseline_mode,'bounded')
            self.assertFalse(model.explain([{}])[0]['seasonKnown'])

    def test_bounded_mode_cannot_be_overridden(self):
        with self.assertRaises(ValueError):
            m.PercentagePriceModel().fit(self.rows,self.seasons,bounded_baselines=True,adjust_baselines=True)
        for value in (-1,0,float('nan'),True):
            with self.assertRaises(ValueError):
                m.PercentagePriceModel().fit(self.rows,self.seasons,effect_regularization=value)

    def test_six_approved_centers_and_resource_direction(self):
        seasons = list(m.ANCHORS)
        rows = [dict(season=s, price=v, currency='TWD',market='taiwan',priceKind='ask',
                     features={'candles':i*100}) for s,v in m.ANCHORS.items() for i in range(6)]
        model = m.PercentagePriceModel().fit(rows,seasons,bounded_baselines=True)
        for s,v in m.ANCHORS.items():
            base = model.predict([dict(season=s)])[0]
            self.assertGreaterEqual(base,v*.9-1e-6)
            self.assertLessEqual(base,v*1.1+1e-6)
        self.assertTrue((np.diff(model.predict([dict(features={'candles':v}) for v in (0,100,10000)]))>=-1e-6).all())


if __name__ == '__main__':
    unittest.main()
