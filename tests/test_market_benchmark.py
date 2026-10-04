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


if __name__ == "__main__":
    unittest.main()
