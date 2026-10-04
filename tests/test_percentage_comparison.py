import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('comparison', Path(__file__).resolve().parents[1] / 'scripts/compare-percentage-models.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def row(key, **kwargs):
    return dict(accountKey=key, postKey=key, splitGroup=key, summary=key,
                price=10000, currency='TWD', market='taiwan', priceKind='ask', **kwargs)


class ComparisonTests(unittest.TestCase):
    def test_identity_union_precedes_exclusion(self):
        rows, ledger = m.audit_rows([row('a', identityAliases=['shared'], knownAnswer=True), row('b', identityAliases=['shared'])])
        self.assertEqual(rows, [])
        self.assertTrue(all(x['excluded'] == 'isolated_identity' for x in ledger))

    def test_same_price_not_duplicate_and_group_does_not_split(self):
        a, b = row('a'), row('b')
        b['splitGroup'] = 'a'
        rows, _ = m.audit_rows([a, b])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['fold'], rows[1]['fold'])
        b['summary'] = 'a'
        rows, ledger = m.audit_rows([a, b])
        self.assertEqual(len(rows), 1)
        self.assertEqual(ledger[1]['excluded'], 'identical_identity_record')

    def test_market_exclusion_unknown_stays_unknown(self):
        a, b, c = row('a', server='unknown'), row('b', server='china'), row('c')
        c['currency'] = 'CNY'
        rows, _ = m.audit_rows([a, b, c])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['server'], 'unknown')
        self.assertNotIn('season', rows[0])

    def test_support_counts_groups_not_rows(self):
        rows = [{**row(str(i), season='early', breakClass='none', packageTier='few' if i % 2 else 'many'), 'splitGroup':'one'} for i in range(12)]
        baseline = m.model_module.PercentagePriceModel().fit(rows, ['early'], {'early':20000})
        model = m.model_module.PercentagePriceModel().fit(rows, ['early'], {'early':20000}, adjust_baselines=True)
        self.assertFalse(model.baseline_support['early']['adjustable'])
        np.testing.assert_allclose(model.weights[0], baseline.weights[0], atol=1e-9)
        for i, r in enumerate(rows):
            r['splitGroup'] = str(i)
        model = m.model_module.PercentagePriceModel().fit(rows, ['early'], {'early':20000}, adjust_baselines=True)
        self.assertTrue(model.baseline_support['early']['adjustable'])
        self.assertLess(model.explain([{'season':'early'}])[0]['basePrice'], 20000)

    def test_gate_rejects_subgroup_and_no_improvement(self):
        def score(median, tail=1):
            return dict(count=20, medianApe=median, p90Ape=tail)
        old = {k:score(.5) for k in ['overall','knownSeason','season:early']}
        self.assertFalse(m.acceptance(old, old)['passed'])
        new = {k:score(.45) for k in old}
        self.assertTrue(m.acceptance(old, new)['passed'])
        new['season:early'] = score(.56)
        self.assertFalse(m.acceptance(old, new)['passed'])


if __name__ == '__main__':
    unittest.main()
