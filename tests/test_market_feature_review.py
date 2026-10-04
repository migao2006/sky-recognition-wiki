import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('review', Path(__file__).resolve().parents[1] / 'scripts/apply-market-feature-review.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.data = {'seasons': ['flight'], 'rows': [{'postKey': 'a', 'summary': '飛行中禮', 'season': None, 'price': 6100}]}
        self.patch = dict(postKey='a', field='season', value='flight', quote='飛行中禮', reason='explicit account headline')

    def apply(self, patches=None, digest='digest'):
        return m.apply_review(self.data, {'sourceDigest': digest, 'patches': patches or [self.patch]}, 'digest')

    def test_only_reviewed_field_changes_and_input_immutable(self):
        original = copy.deepcopy(self.data)
        result = self.apply()
        self.assertEqual(self.data, original)
        self.assertEqual(result['rows'][0]['season'], 'flight')
        self.assertEqual(result['rows'][0]['price'], 6100)
        self.assertNotIn('packageTier', result['rows'][0])

    def test_rejects_stale_source_missing_quote_and_duplicate(self):
        with self.assertRaises(ValueError): self.apply(digest='stale')
        with self.assertRaises(ValueError): self.apply([{**self.patch, 'quote': '偽造'}])
        with self.assertRaises(ValueError): self.apply([self.patch, self.patch])

    def test_rejects_overwrite_reviewed_unknown_bad_enum_and_price(self):
        for extra in [{'season': 'flight'}, {'reviewedFields': ['season']}]:
            self.data['rows'][0].update(extra)
            with self.assertRaises(ValueError): self.apply()
            self.data['rows'][0] = {'postKey': 'a', 'summary': '飛行中禮', 'season': None}
        for patch in [{**self.patch, 'value': 'invented'}, {**self.patch, 'field': 'price', 'value': 3500}]:
            with self.assertRaises(ValueError): self.apply([patch])

    def test_exclusion_preserves_original_row(self):
        result = self.apply([{**self.patch, 'field': 'exclude_from_model', 'value': True}])
        self.assertTrue(result['rows'][0]['exclude_from_model'])
        self.assertEqual(result['rows'][0]['summary'], '飛行中禮')
        with self.assertRaises(ValueError): self.apply([{**self.patch, 'field': 'exclude_from_model', 'value': False}])


if __name__ == '__main__':
    unittest.main()
