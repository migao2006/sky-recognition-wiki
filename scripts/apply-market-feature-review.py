"""Apply human-reviewed, quoted evidence to a new PRIVATE dataset, never production.

The ledger is a review decision, not an automatic semantic verifier. Default is
check only; --write creates a new output and cannot overwrite the source.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def apply_review(data, ledger, digest):
    if ledger.get('sourceDigest') != digest:
        raise ValueError('Source digest mismatch')
    result = copy.deepcopy(data)
    by_key = {}
    for row in result['rows']:
        key = row.get('postKey')
        if not key or key in by_key:
            raise ValueError('Missing or duplicate postKey')
        by_key[key] = row
    allowed = {'season': set(data['seasons']),
               'breakClass': {'none', 'slight', 'medium', 'large'},
               'packageTier': {'few', 'medium', 'many', 'hundred'}}
    changes, seen = [], set()
    for patch in ledger['patches']:
        row = by_key[patch['postKey']]
        field = patch['field']
        identity = (patch['postKey'], field)
        if identity in seen:
            raise ValueError('Duplicate patch')
        seen.add(identity)
        quote = patch.get('quote')
        if not isinstance(quote, str) or not quote.strip() or quote not in row.get('summary', ''):
            raise ValueError('Evidence quote not found in original summary')
        if not patch.get('reason', '').strip():
            raise ValueError('Review reason required')
        value = patch['value']
        if field == 'exclude_from_model':
            if value is not True:
                raise ValueError('Review may only add exclusions')
        elif field not in allowed or value not in allowed[field]:
            raise ValueError('Invalid feature or enum')
        elif row.get(field) is not None or field in (row.get('reviewedFields') or []):
            raise ValueError('Cannot overwrite known or previously reviewed feature')
        before = row.get(field)
        row[field] = value
        row['reviewedFields'] = list(dict.fromkeys([*(row.get('reviewedFields') or []), field]))
        changes.append({**patch, 'before': before})
    result['featureReview'] = {'sourceDigest': digest, 'changes': changes,
                              'validation': 'manual_quotes_not_blind', 'productionChanged': False}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('ledger', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    target = args.output.resolve()
    if not target.is_relative_to((ROOT / 'work').resolve()) or target.exists():
        raise ValueError('Output must be a new private work/ file')
    raw = args.source.read_bytes()
    result = apply_review(json.loads(raw), json.loads(args.ledger.read_text(encoding='utf-8')),
                          hashlib.sha256(raw).hexdigest())
    print(json.dumps({'changes': len(result['featureReview']['changes']),
                      'rows': len(result['rows']), 'write': args.write}))
    if args.write:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x', encoding='utf-8') as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
