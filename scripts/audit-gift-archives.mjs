import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { tsImport } from "tsx/esm/api";

// Diagnostic only. Never execute archived scripts, fetch images, or infer a
// payment receipt from a displayed price. Reports may contain private inventory.
export function auditGiftHtml(html, mapping, iaps) {
  const $ = load(html);
  const rows = $("#gl .g-item");
  const count = $("#gc").text().trim();
  if (!/^\d+$/.test(count) || Number(count) !== rows.length || !rows.length || rows.length > 1000)
    throw new Error("Incomplete gift list");
  const byGuid = new Map(iaps.map(item => [item.guid, item]));
  return rows.toArray().map(row => {
    const name = $(row).find(".nm").text().trim();
    const rawPrice = $(row).find(".pr").text().trim();
    const icons = $(row).find(".g-unlocks img").toArray().map(icon => $(icon).attr("alt") ?? "");
    const members = [...new Set(icons)].map(icon => {
      const guid = Object.hasOwn(mapping, icon) ? mapping[icon] : null;
      const item = byGuid.get(guid);
      return { icon, guid, paid: item?.paid === true, packageKey: item?.packageKey ?? null };
    });
    const prices = [...rawPrice.matchAll(/(NT\$|US\$|\$|¥|₫)\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?![\d.,])/g)]
      .map(([, symbol, amount]) => ({
        // Bare $ and yen symbols do not establish an ISO currency.
        currency: symbol === "NT$" ? "TWD" : symbol === "US$" ? "USD" : symbol === "₫" ? "VND" : null,
        symbol, amount: Number(amount.replaceAll(",", "")), kind: "displayed-reference",
      }));
    const keys = [...new Set(members.map(member => member.packageKey).filter(Boolean))];
    const known = members.length > 0 && members.every(member => member.guid && member.paid);
    const canonicalMembers = keys.length === 1 ? iaps.filter(item => item.packageKey === keys[0]).map(item => item.guid).sort() : [];
    const guids = members.map(member => member.guid).filter(Boolean).sort();
    const exactPackage = known && keys.length === 1 && JSON.stringify(canonicalMembers) === JSON.stringify(guids);
    return {
      name, members, rawPrice, prices,
      extrasText: $(row).find(".g-extras").text().trim(),
      memberSignature: known ? JSON.stringify(guids) : null,
      canonicalPackageKey: exactPackage ? keys[0] : null,
      status: !known ? "unknown-member" : exactPackage ? "exact-members" : "review-package-members",
      // A one-item offer may still have a generic sales label (e.g. starter
      // pack); exact membership does not make that label an item name.
      nameCandidate: exactPackage && members.length === 1 && name && !/禮包|套組|套裝/.test(name)
        ? { guid: guids[0], name } : null,
    };
  });
}

export function summarizeGiftAudits(audits) {
  const signatures = new Map();
  let unresolvedRows = 0;
  const guids = new Set();
  for (const rows of audits) for (const row of rows) {
    row.members.forEach(member => { if (member.guid) guids.add(member.guid); });
    if (!row.memberSignature) { unresolvedRows++; continue; }
    const entries = signatures.get(row.memberSignature) ?? [];
    entries.push(row);
    signatures.set(row.memberSignature, entries);
  }
  const groups = [...signatures.values()].map(entries => ({
    members: entries[0].members.map(member => member.guid).sort(),
    names: [...new Set(entries.map(row => row.name))],
    priceVariants: [...new Set(entries.map(row => row.rawPrice))],
    occurrences: entries.length,
  }));
  return {
    schemaVersion: 1, evidenceKind: "archive-displayed-reference-not-receipt",
    archiveRowCounts: audits.map(rows => rows.length),
    uniqueMemberSets: signatures.size, uniqueItems: guids.size, unresolvedRows,
    conflicts: groups.filter(group => group.names.length > 1 || group.priceVariants.length > 1),
    warning: "Member sets are not guaranteed purchase SKUs. No current resources, actual spending, or resale value are inferred.",
  };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Usage: node scripts/audit-gift-archives.mjs <archive.webarchive> [...]");
  const { readWebarchive } = await tsImport("../app/webarchive.ts", import.meta.url);
  const mapping = JSON.parse(await readFile(new URL("../app/sky-info-item-guids.json", import.meta.url), "utf8"));
  const { items } = JSON.parse(await readFile(new URL("../app/iap-catalog.json", import.meta.url), "utf8"));
  const audits = [];
  for (const file of files) audits.push(auditGiftHtml(readWebarchive(await readFile(file)), mapping, items));
  process.stdout.write(JSON.stringify({ ...summarizeGiftAudits(audits), archives: audits }, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
