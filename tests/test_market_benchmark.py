"""Run with the isolated benchmark Python, not the production npm suite."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).resolve().parents[1] / "scripts/benchmark-market-models.py")
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)


class BenchmarkTest(unittest.TestCase):
    def test_failed_predictions_stay_in_denominator(self):
        m = bench.metrics([{"actual": 100, "predicted": 100}, {"actual": 100, "predicted": None}])
        self.assertEqual(m["hit10"], .5)
        self.assertEqual(m["failed"], 1)
        self.assertIsNone(m["medianApe"])

    def test_training_only_feature_selection_and_no_price_text(self):
        train = [{"season": "rhythm", "price": i * 100, "sourceFamily": "facebook", "summary": "answer 3500",
                  "features": {"item:known": "present", "price": 3500, "summary": "answer"}} for i in range(8)]
        test = [{"season": "new", "features": {"item:heldout": "present", "hearts": 99999}}]
        x, xt, cat = bench.feature_table(train, test, True)
        self.assertEqual(list(x.columns), ["season", "breakClass", "packageTier", "item:known"])
        self.assertEqual(list(xt.columns), list(x.columns))
        self.assertIn("item:known", cat)
        self.assertEqual(xt["item:known"].iloc[0], "unknown")

    def test_group_leakage_is_a_failure_not_a_score(self):
        train = [{"accountKey": str(i), "splitGroup": "post1"} for i in range(10)]
        test = [{"accountKey": "different-account", "splitGroup": "post1", "price": 100, "postKey": "post"}]
        result = bench.evaluate(train, test, "catboost_common", ["rhythm"])
        self.assertIn("Identity leakage", result["error"])
        self.assertEqual(result["metrics"]["failed"], 1)

    def test_gate_requires_all_three_improvements(self):
        base = {"count": 20, "failed": 0, "medianApe": .4, "p90Ape": 1, "hit10": .2}
        self.assertTrue(bench.qualifies({**base, "medianApe": .35}, base))
        self.assertFalse(bench.qualifies({**base, "medianApe": .35, "p90Ape": 1.01}, base))
        self.assertFalse(bench.qualifies({**base, "medianApe": .35, "hit10": .19}, base))

    def test_model_ranking_excludes_failed_runs(self):
        summaries = {
            "complete": {"overall": {"failed": 0, "medianApe": .3, "hit20": .4}},
            "failed": {"overall": {"failed": 1, "medianApe": .0, "hit20": 1}},
            "other": {"overall": {"failed": 0, "medianApe": .2, "hit20": .3}},
        }
        self.assertEqual(bench.rank_model(list(summaries), summaries, "medianApe"), "other")
        self.assertEqual(bench.rank_model(list(summaries), summaries, "hit20", reverse=True), "complete")

    def test_strict_baseline_contract_requires_provenance(self):
        valid = {"market": "taiwan", "server": "international", "currency": "TWD", "accountOnly": True}
        self.assertTrue(bench.eligible_for_formal_baseline(valid))
        self.assertFalse(bench.eligible_for_formal_baseline({**valid, "server": "unknown"}))
        self.assertFalse(bench.eligible_for_formal_baseline({**valid, "converted": True}))

    def test_evidenced_cohorts_do_not_treat_missing_title_as_a_season(self):
        valid = {"market": "taiwan", "server": "international", "currency": "TWD", "accountOnly": True}
        self.assertFalse(bench.eligible_for_season_evidenced(valid))
        self.assertTrue(bench.eligible_for_season_evidenced({**valid, "season": "rhythm"}))
        self.assertFalse(bench.eligible_for_title_evidenced({**valid, "season": "rhythm"}))
        self.assertTrue(bench.eligible_for_title_evidenced({
            **valid, "season": "rhythm", "breakClass": "none", "packageTier": "many"
        }))

    def test_binding_lock_count_does_not_invent_missing_binding_status(self):
        self.assertEqual(bench.binding_lock_count({"features": {}}), 0)
        self.assertEqual(bench.binding_lock_count({"features": {
            "binding:GG": "transferable", "binding:NS": "unbound"
        }}), 0)
        self.assertEqual(bench.binding_lock_count({"features": {
            "binding:GG": "not_transferable", "binding:NS": "unbound", "binding:GC": "locked"
        }}), 2)

    def test_geometric_blend_preserves_endpoints_and_rejects_invalid_weight(self):
        self.assertEqual(bench.geometric_blend([100], [400], 0), [100.0])
        self.assertEqual(bench.geometric_blend([100], [400], 1), [400.0])
        self.assertAlmostEqual(bench.geometric_blend([100], [400], .5)[0], 200.0)
        with self.assertRaises(ValueError):
            bench.geometric_blend([100], [400], 1.1)


if __name__ == "__main__":
    unittest.main()
