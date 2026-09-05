import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const observationTime = (observation) => observation.row.snapshot_collected_at
  ?? observation.row.observed_at
  ?? observation.collectedAt;

export const mergeListingObservations = (observations) => {
  const ordered = [...observations].sort((left, right) =>
    observationTime(left).localeCompare(observationTime(right))
      || left.snapshotId.localeCompare(right.snapshotId));
  const snapshotIds = new Set();
  const priceHistory = [];
  let seenInCompleteSnapshot = false;

  for (const observation of ordered) {
    snapshotIds.add(observation.snapshotId);
    seenInCompleteSnapshot ||= Boolean(observation.snapshotComplete);
    const price = {
      observed_at: observationTime(observation),
      price_original: observation.row.price_original,
      currency_original: observation.row.currency_original,
    };
    const previous = priceHistory.at(-1);
    if (Number.isFinite(price.price_original)
      && price.currency_original
      && (!previous
        || previous.price_original !== price.price_original
        || previous.currency_original !== price.currency_original)) {
      priceHistory.push(price);
    }
  }

  const first = ordered[0];
  const last = ordered.at(-1);
  const evidence = [...ordered].reverse().find((observation) => observation.row.description) ?? last;
  return {
    ...evidence.row,
    ...last.row,
    first_seen_at: observationTime(first),
    last_seen_at: observationTime(last),
    observation_count: snapshotIds.size,
    seen_in_complete_snapshot: seenInCompleteSnapshot,
    latest_snapshot_complete: Boolean(last.snapshotComplete),
    ...(priceHistory.length > 1 ? { price_history: priceHistory } : {}),
  };
};

const countBy = (rows, valueFor) => Object.fromEntries([...Map.groupBy(rows, valueFor)]
  .sort(([left], [right]) => String(left).localeCompare(String(right)))
  .map(([key, values]) => [key, values.length]));

const atomicWrite = async (destination, content) => {
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, destination);
};

export const consolidateMarketListingSnapshots = async (outputDirectory = "work/market-listings") => {
  const resolvedOutput = path.resolve(outputDirectory);
  const workRoot = path.resolve("work");
  if (resolvedOutput !== workRoot && !resolvedOutput.startsWith(`${workRoot}${path.sep}`)) {
    throw new Error("Consolidated market listings must stay inside work/");
  }
  const snapshotsRoot = path.join(resolvedOutput, "snapshots");
  const entries = await readdir(snapshotsRoot, { withFileTypes: true });
  const snapshotIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const observations = new Map();
  let completeSnapshotCount = 0;

  for (const snapshotId of snapshotIds) {
    const snapshotDirectory = path.join(snapshotsRoot, snapshotId);
    const summary = JSON.parse(await readFile(path.join(snapshotDirectory, "summary.json"), "utf8"));
    const lines = (await readFile(path.join(snapshotDirectory, "public-listings.jsonl"), "utf8"))
      .split(/\r?\n/).filter(Boolean);
    if (summary.snapshot_complete) completeSnapshotCount += 1;
    for (const line of lines) {
      const row = JSON.parse(line);
      if (!row.source || row.listing_id === undefined || row.listing_id === null) continue;
      const key = `${row.source}:${row.listing_id}`;
      const values = observations.get(key) ?? [];
      values.push({
        snapshotId,
        snapshotComplete: summary.snapshot_complete,
        collectedAt: summary.collected_at,
        row,
      });
      observations.set(key, values);
    }
  }

  const rows = [...observations.values()].map(mergeListingObservations)
    .sort((left, right) => left.source.localeCompare(right.source)
      || String(left.listing_id).localeCompare(String(right.listing_id)));
  const combinedDirectory = path.join(resolvedOutput, "combined");
  await mkdir(combinedDirectory, { recursive: true });
  const mentionedSeasons = rows.flatMap((row) => row.season_mentions ?? []);
  const startSeasons = rows.map((row) => row.start_season_candidate).filter(Boolean);
  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    evidence_kind: "deduplicated_public_asking_price",
    snapshot_count: snapshotIds.length,
    complete_snapshot_count: completeSnapshotCount,
    unique_listings: rows.length,
    relative_price_candidates: rows.filter((row) => row.relative_price_candidate).length,
    ratio_candidates: rows.filter((row) => row.ratio_candidate).length,
    repeated_listings: rows.filter((row) => row.observation_count > 1).length,
    listings_with_price_changes: rows.filter((row) => row.price_history?.length > 1).length,
    seen_in_complete_snapshot: rows.filter((row) => row.seen_in_complete_snapshot).length,
    by_source: countBy(rows, (row) => row.source),
    by_mentioned_season: countBy(mentionedSeasons, (slug) => slug),
    by_start_season: countBy(startSeasons, (slug) => slug),
    by_start_season_relative: countBy(
      rows.filter((row) => row.start_season_candidate && row.relative_price_candidate),
      (row) => row.start_season_candidate,
    ),
    warning: "Rows are deduplicated asking-price observations, not confirmed transactions or Taiwan market estimates.",
  };
  await atomicWrite(path.join(combinedDirectory, "public-listings.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await atomicWrite(path.join(combinedDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  consolidateMarketListingSnapshots(process.argv[2]).then((summary) => {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
