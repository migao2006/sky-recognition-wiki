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
        for patch in ({'knownAnswer': True}, {'currency': 'CNY'}, {'priceKind': 'sold'}, {'excludeFromModel': True}):
            with self.assertRaises(ValueError):
                m.PercentagePriceModel().fit([{**self.rows[0], **patch}], self.seasons)


if __name__ == '__main__':
    unittest.main()
