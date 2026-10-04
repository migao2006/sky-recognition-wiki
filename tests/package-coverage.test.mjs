import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
const { packageCoverage } = await tsImport('../app/package-coverage.ts', import.meta.url);
const item = (guid, wiki, name = guid) => ({ guid, name, wiki, collection: '', group: '' });
const first = item('one', 'https://example.test/First_Pack');
const second = item('two', first.wiki);
const third = item('three', 'https://example.test/Second_Pack');

test('full collection checks package membership, not count or 200 threshold', () => {
  const catalog = [first, second, third, item('free', 'https://example.test/Free')];
  assert.deepEqual(packageCoverage(catalog, new Set(['one','two','three']), {}, true), { total: 2, complete: 2, full: true });
  assert.equal(packageCoverage(catalog, new Set(['one','three']), {}, true).full, false);
  assert.equal(packageCoverage(catalog, new Set(['one','two','three']), {}, false).full, false);
  assert.equal(packageCoverage([], new Set(), {}, true).full, false);
  assert.equal(packageCoverage([...catalog,item('new','https://example.test/New_Pack')],new Set(['one','two','three']),{},true).full,false);
});

test('China items do not enter the denominator and blocked platforms prevent full transferable collection', () => {
  const china = item('cn', 'https://example.test/China_Pack', 'China Pack');
  const platform = item('ns', 'https://example.test/Nintendo_Pack', 'Nintendo Pack');
  assert.equal(packageCoverage([first,china],new Set(['one']),{},true).full,true);
  assert.equal(packageCoverage([first,platform],new Set(['one','ns']),{nintendo:'keep'},true).full,false);
});
