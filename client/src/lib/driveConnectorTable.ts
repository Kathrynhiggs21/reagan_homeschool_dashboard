/**
 * Drive Connector recent-rows filter + sort (v3.23, 2026-05-31)
 * =============================================================
 *
 * Pure helpers used by ConnectorPushCard so all filter/sort behavior is
 * unit-tested without rendering React. The card just owns the input
 * state and renders the filtered+sorted result.
 *
 * Tests live in `client/src/lib/driveConnectorTable.test.ts`.
 */

export type RecentRow = {
  id: number;
  fileName: string;
  status: string;
  targetFolder: string;
  targetSubpath: string | null;
  /** Unix-ms or ISO; we normalize via Date(). May be null on legacy rows. */
  createdAt: string | number | Date | null;
};

export type ConnectorStatusFilter =
  | "all"
  | "pushed"
  | "pending"
  | "skipped"
  | "failed";

export type ConnectorSortKey = "newest" | "oldest" | "status" | "folder" | "id";

export type ConnectorTableFilters = {
  status: ConnectorStatusFilter;
  /** Empty string = no folder filter. */
  folder: string;
  /** Search-by-name; case-insensitive, trimmed. */
  search: string;
  sortBy: ConnectorSortKey;
};

export const EMPTY_FILTERS: ConnectorTableFilters = {
  status: "all",
  folder: "",
  search: "",
  sortBy: "newest",
};

export function filtersAreActive(f: ConnectorTableFilters): boolean {
  return (
    f.status !== "all" ||
    f.folder.trim().length > 0 ||
    f.search.trim().length > 0 ||
    f.sortBy !== "newest"
  );
}

function tsOf(row: RecentRow): number {
  if (row.createdAt == null) return 0;
  if (typeof row.createdAt === "number") return row.createdAt;
  const d = new Date(row.createdAt);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Pure: apply status/folder/search to a row list, then sort by sortBy.
 * Stable: row id is the final tiebreaker (descending) so the ordering
 * is deterministic in tests and never re-shuffles between renders.
 */
export function applyFiltersAndSort(
  rows: RecentRow[],
  filters: ConnectorTableFilters,
): RecentRow[] {
  if (!Array.isArray(rows)) return [];
  const needle = filters.search.trim().toLowerCase();
  const folder = filters.folder.trim();
  let out = rows.filter((r) => {
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (folder.length > 0 && r.targetFolder !== folder) return false;
    if (needle.length > 0) {
      const hay = (r.fileName || "").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const cmp = (a: RecentRow, b: RecentRow): number => {
    switch (filters.sortBy) {
      case "newest":
        return tsOf(b) - tsOf(a) || b.id - a.id;
      case "oldest":
        return tsOf(a) - tsOf(b) || a.id - b.id;
      case "status": {
        const s = (a.status || "").localeCompare(b.status || "");
        return s !== 0 ? s : b.id - a.id;
      }
      case "folder": {
        const s = (a.targetFolder || "").localeCompare(b.targetFolder || "");
        return s !== 0 ? s : b.id - a.id;
      }
      case "id":
        return b.id - a.id;
      default:
        return b.id - a.id;
    }
  };
  out = [...out].sort(cmp);
  return out;
}

/**
 * Pure: unique target-folder labels from a row list, sorted alphabetically.
 * Used to populate the folder dropdown.
 */
export function listKnownFolders(rows: RecentRow[]): string[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.targetFolder) seen.add(r.targetFolder);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Pure: format "N of M rows" for the result-count line. Handles the
 * edge cases where everything matches or nothing matches.
 */
export function formatResultCount(
  filtered: number,
  total: number,
  filtersActive: boolean,
): string {
  if (total === 0) return "no rows yet";
  if (!filtersActive) return `${total} ${total === 1 ? "row" : "rows"}`;
  return `${filtered} of ${total} ${total === 1 ? "row" : "rows"} match`;
}
