export type ConnectionHint = {
  effectiveType?: string;
  saveData?: boolean;
};

export const shouldIdlePreload = (connection?: ConnectionHint) =>
  !connection?.saveData &&
  !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
