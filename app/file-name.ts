const windowsReservedNames = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

/** Produces a portable, non-empty suffix for downloaded account files. */
export const safeFileName = (name: string) => {
  const normalized = name
    .replace(/[\u0000-\u001F\u007F\\/:*?"<>|]/g, "-")
    .trim()
    .replace(/[. ]+$/g, "");
  if (!normalized) return "未命名";
  const baseName = normalized.split(".")[0]?.toUpperCase();
  return (baseName && windowsReservedNames.has(baseName))
    ? `${normalized}-帳號`
    : normalized;
};
