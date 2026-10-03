import assert from "node:assert/strict";
import test from "node:test";
import { auditGiftHtml, summarizeGiftAudits } from "../scripts/audit-gift-archives.mjs";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { approvedArchiveNames } from "./helpers/archive-name-expectations.mjs";

const mapping = { CharSkyKid_A: "a", CharSkyKid_B: "b" };
const items = ["a", "b"].map(guid => ({ guid, paid: true, packageKey: "iap:pair" }));
const html = (icons, name = "雙件套") => `<div id="gc">1</div><div id="gl"><div class="g-item"><div class="nm">${name}</div><div class="pr">$20<span>¥148 / NT$690</span><span>₫599,000</span></div><div class="g-extras">蠟燭 ×75</div><div class="g-unlocks">${icons.map(icon => `<img alt="${icon}" src="https://invalid.example">`).join("")}</div></div></div>`;

test("archive prices remain references; multi-item package names never rename members", () => {
  const [row] = auditGiftHtml(html(Object.keys(mapping)), mapping, items);
  assert.equal(row.status, "exact-members");
  assert.equal(row.nameCandidate, null);
  assert.deepEqual(row.prices.map(price => [price.currency, price.amount]), [[null, 20], [null, 148], ["TWD", 690], ["VND", 599000]]);
  assert.equal(row.extrasText, "蠟燭 ×75");
  assert.equal(row.currentResources, undefined);
});
test("partial, missing and unknown members cannot propose names", () => {
  for (const icons of [["CharSkyKid_A"], ["unknown"], []]) {
    const [row] = auditGiftHtml(html(icons), mapping, items);
    assert.notEqual(row.status, "exact-members");
    assert.equal(row.nameCandidate, null);
  }
});
test("single confirmed member can propose a name without changing the catalog", () => {
  const [row] = auditGiftHtml(html(["CharSkyKid_A"], "單件"), mapping, [items[0]]);
  assert.deepEqual(row.nameCandidate, { guid: "a", name: "單件" });
  assert.equal(items[0].name, undefined);
  const [generic] = auditGiftHtml(html(["CharSkyKid_A"], "超值禮包"), mapping, [items[0]]);
  assert.equal(generic.nameCandidate, null);
});
test("deduplication is order independent and retains conflicting evidence", () => {
  const first = auditGiftHtml(html(Object.keys(mapping)), mapping, items);
  const second = auditGiftHtml(html(Object.keys(mapping).reverse(), "另一名稱"), mapping, items);
  const report = summarizeGiftAudits([first, second]);
  assert.equal(report.uniqueMemberSets, 1);
  assert.equal(report.uniqueItems, 2);
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].occurrences, 2);
});
test("incomplete and empty archives fail closed", () => {
  assert.throws(() => auditGiftHtml(html([]).replace('id="gc">1', 'id="gc">2'), mapping, items));
  assert.throws(() => auditGiftHtml('<div id="gc">0</div><div id="gl"></div>', mapping, items));
});
test("confirmed archive name preserves old search term and official identity", async () => {
  const catalog = await loadRuntimeCatalog();
  const item = catalog.wikiItems.find(item => item.guid === "_Y4tdDzZYL");
  assert.equal(item.name, "Starry Night's Kiss");
  assert.equal(catalog.zhItemName(item), "星夜之吻");
  assert.ok(catalog.zhItemSearchNames(item).includes("星光夜晚親吻"));
  assert.ok(catalog.isPaidItem(item));
});
test("all approved single-item archive labels resolve to paid official identities", async () => {
  const catalog = await loadRuntimeCatalog();
  assert.equal(approvedArchiveNames.size, 124);
  for (const [guid, [display, sale]] of approvedArchiveNames) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.ok(item, guid);
    assert.ok(catalog.isPaidItem(item), guid);
    assert.equal(catalog.zhItemName(item), display, guid);
    assert.equal(catalog.saleItemName(item), sale, guid);
  }
});
