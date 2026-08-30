import { readFile } from "node:fs/promises";
import { asModuleUrl } from "./transpile.mjs";

export async function injectSeasonItems(source) {
  const seasonSource = await readFile(
    new URL("../../app/season-items.ts", import.meta.url),
    "utf8",
  );
  const seasonUrl = asModuleUrl(
    seasonSource.replace('import type { WikiItem } from "./wiki-data";', ""),
  );
  return source
    .replace('export { isPaidItem } from "./valuation-items";', "")
    .replace(
      'export {\n  isGraduationGift,\n  isSeasonPendant,\n  isSeasonUltimate,\n} from "./season-items";',
      `export { isGraduationGift, isSeasonPendant, isSeasonUltimate } from ${JSON.stringify(seasonUrl)};`,
    )
    .replace(
      'import { isSeasonUltimate } from "./season-items";',
      `const { isSeasonUltimate } = await import(${JSON.stringify(seasonUrl)});`,
    )
    .replace(
      'import {\n  isGraduationGift,\n  isSeasonPendant,\n  isSeasonUltimate,\n} from "./season-items";',
      `const { isGraduationGift, isSeasonPendant, isSeasonUltimate } = await import(${JSON.stringify(seasonUrl)});`,
    );
}
