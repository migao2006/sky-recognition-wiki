import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec=importlib.util.spec_from_file_location('percentage',Path(__file__).resolve().parents[1]/'scripts/percentage-price-model.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ProgressiveTests(unittest.TestCase):
    def setUp(self):
        rows=[dict(season='test',price=10000,priceKind='ask',currency='TWD',market='taiwan')]
        self.model=m.PercentagePriceModel().fit(rows,['test'],{'test':10000},progressive_packages=True)
        # Synthetic increasing factors test the adapter, not market accuracy.
        self.model.weights[self.model.nbase+3:self.model.nbase+6]=[.2,.1,.4]

    def test_integer_grid_and_boundaries(self):
        values=self.model.predict([dict(features={'packageCount':n}) for n in range(401)])
        self.assertTrue(np.all(np.diff(values)>=0))
        self.assertTrue(np.all(np.isfinite(values)))
        for n in (30,60,75,90,95,100,150,200):
            f=self.model.package_log_multiplier
            self.assertLess(abs(f(n-1e-7)-f(n+1e-7)),1e-7)
        f=self.model.package_log_multiplier
        self.assertGreater(f(201)-f(200),f(301)-f(300))

    def test_preserves_reference_and_no_double_counting(self):
        self.assertAlmostEqual(self.model.package_log_multiplier(75)+self.model.package_log_multiplier(95),0)
        a,b=self.model.predict([dict(packageTier=t,features={'packageCount':100}) for t in ('few','hundred')])
        self.assertEqual(a,b)
        self.assertEqual(self.model.explain([{'features':{'packageCount':100}}])[0]['packageBasis'],'count')

    def test_unknown_zero_and_invalid(self):
        unknown,zero=self.model.explain([{},dict(features={'packageCount':0})])
        self.assertEqual(unknown['factors']['packages'],1)
        self.assertLess(zero['factors']['packages'],1)
        for v in (-1,1.5,True,'100',float('nan'),float('inf'),100000):
            with self.assertRaises(ValueError):
                self.model.predict([dict(features={'packageCount':v})])

    def test_count_absent_keeps_legacy_tier(self):
        rows=[dict(packageTier=p) for p in m.PACKAGES]
        progressive=self.model.predict(rows)
        self.model.progressive_packages=False
        np.testing.assert_array_equal(progressive,self.model.predict(rows))


if __name__=='__main__':
    unittest.main()
