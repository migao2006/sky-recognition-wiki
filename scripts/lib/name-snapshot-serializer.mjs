// Both player-name sync commands write these snapshots. Keep this exact
// compact layout stable so review diffs contain only name data changes.
const compactEntry = (entry) => {
  const json = JSON.stringify(entry);
  return `{ ${json.slice(1, -1).replaceAll(":", ": ").replaceAll(",", ", ")} }`;
};

export const serializeNameSnapshot = (snapshot) => {
  const entries = Object.entries(snapshot.items);
  return [
    "{",
    `  "description": ${JSON.stringify(snapshot.description)},`,
    '  "items": {',
    ...entries.map(
      ([guid, entry], index) =>
        `    ${JSON.stringify(guid)}: ${compactEntry(entry)}${index + 1 < entries.length ? "," : ""}`,
    ),
    "  }",
    "}",
    "",
  ].join("\n");
};
