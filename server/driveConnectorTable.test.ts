/**
 * driveConnectorTable (v3.23) — filter/sort vitest spec
 * =====================================================
 *
 * Locks the pure filter/sort helpers used by the recent-rows table on
 * the Settings → Drive Connector card. The card itself just wires the
 * input state to these helpers, so testing the pure surface here covers
 * the bulk of the behavior without rendering React.
 */

import { describe, it, expect } from "vitest";
import {
  applyFiltersAndSort,
  EMPTY_FILTERS,
  filtersAreActive,
  formatResultCount,
  listKnownFolders,
  type ConnectorTableFilters,
  type RecentRow,
} from "@/lib/driveConnectorTable";

const T0 = 1_780_000_000_000;
const mkRow = (over: Partial<RecentRow>): RecentRow => ({
  id: over.id ?? 1,
  fileName: over.fileName ?? "untitled.txt",
  status: over.status ?? "pushed",
  targetFolder: over.targetFolder ?? "day_logs",
  targetSubpath: over.targetSubpath ?? null,
  createdAt: over.createdAt ?? T0,
});

const fixtureRows: RecentRow[] = [
  mkRow({ id: 1, fileName: "alpha.md", status: "pushed", targetFolder: "day_logs", createdAt: T0 + 1_000 }),
  mkRow({ id: 2, fileName: "Bravo.PDF", status: "pending", targetFolder: "printables", createdAt: T0 + 2_000 }),
  mkRow({ id: 3, fileName: "charlie.png", status: "skipped", targetFolder: "day_logs", createdAt: T0 + 3_000 }),
  mkRow({ id: 4, fileName: "Delta-report.md", status: "failed", targetFolder: "analytics", createdAt: T0 + 4_000 }),
  mkRow({ id: 5, fileName: "echo.md", status: "pushed", targetFolder: "printables", createdAt: T0 + 5_000 }),
  mkRow({ id: 6, fileName: "foxtrot.md", status: "pushed", targetFolder: "day_logs", createdAt: T0 + 6_000 }),
];

describe("EMPTY_FILTERS + filtersAreActive", () => {
  it("EMPTY_FILTERS is not active", () => {
    expect(filtersAreActive(EMPTY_FILTERS)).toBe(false);
  });
  it("status != all → active", () => {
    expect(filtersAreActive({ ...EMPTY_FILTERS, status: "pushed" })).toBe(true);
  });
  it("non-empty folder → active", () => {
    expect(filtersAreActive({ ...EMPTY_FILTERS, folder: "day_logs" })).toBe(true);
  });
  it("non-empty search → active", () => {
    expect(filtersAreActive({ ...EMPTY_FILTERS, search: "alpha" })).toBe(true);
  });
  it("whitespace-only folder/search are NOT active", () => {
    expect(
      filtersAreActive({ ...EMPTY_FILTERS, folder: "  ", search: "   " }),
    ).toBe(false);
  });
  it("sortBy != newest → active", () => {
    expect(filtersAreActive({ ...EMPTY_FILTERS, sortBy: "oldest" })).toBe(true);
  });
});

describe("applyFiltersAndSort", () => {
  it("returns [] for non-array input", () => {
    expect(applyFiltersAndSort(null as any, EMPTY_FILTERS)).toEqual([]);
    expect(applyFiltersAndSort(undefined as any, EMPTY_FILTERS)).toEqual([]);
  });

  it("returns all rows sorted newest-first by default", () => {
    const r = applyFiltersAndSort(fixtureRows, EMPTY_FILTERS);
    expect(r.map((x) => x.id)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("filters by status=pushed", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      status: "pushed",
    });
    expect(r.map((x) => x.id)).toEqual([6, 5, 1]);
  });

  it("filters by folder=day_logs", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      folder: "day_logs",
    });
    expect(r.map((x) => x.id)).toEqual([6, 3, 1]);
  });

  it("filters by search (case-insensitive substring on fileName)", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      search: "PdF",
    });
    expect(r.map((x) => x.id)).toEqual([2]);
  });

  it("ignores whitespace-only search", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      search: "   ",
    });
    expect(r).toHaveLength(fixtureRows.length);
  });

  it("composes status + folder + search", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      status: "pushed",
      folder: "day_logs",
      search: "o", // alpha (no 'o'), foxtrot (yes), echo would match but folder excludes
    });
    expect(r.map((x) => x.id)).toEqual([6]);
  });

  it("sortBy=oldest reverses newest", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      sortBy: "oldest",
    });
    expect(r.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("sortBy=status sorts alphabetically (then by id desc)", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      sortBy: "status",
    });
    // failed, pending, pushed (×3, ordered 6>5>1), skipped
    expect(r.map((x) => x.id)).toEqual([4, 2, 6, 5, 1, 3]);
  });

  it("sortBy=folder sorts alphabetically (then by id desc)", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      sortBy: "folder",
    });
    // analytics, day_logs (6>3>1), printables (5>2)
    expect(r.map((x) => x.id)).toEqual([4, 6, 3, 1, 5, 2]);
  });

  it("sortBy=id sorts by id desc", () => {
    const r = applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      sortBy: "id",
    });
    expect(r.map((x) => x.id)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("rows with null createdAt sort to the end on newest", () => {
    const rows: RecentRow[] = [
      mkRow({ id: 10, createdAt: null }),
      mkRow({ id: 11, createdAt: T0 + 1_000 }),
    ];
    const r = applyFiltersAndSort(rows, EMPTY_FILTERS);
    expect(r.map((x) => x.id)).toEqual([11, 10]);
  });

  it("does not mutate input", () => {
    const before = fixtureRows.map((r) => r.id);
    applyFiltersAndSort(fixtureRows, {
      ...EMPTY_FILTERS,
      sortBy: "folder",
    });
    expect(fixtureRows.map((r) => r.id)).toEqual(before);
  });

  it("status='all' is the default and matches everything", () => {
    const r = applyFiltersAndSort(fixtureRows, EMPTY_FILTERS);
    expect(r).toHaveLength(fixtureRows.length);
  });

  it("unknown status filter excludes everything (defensive)", () => {
    const f = { ...EMPTY_FILTERS, status: "nonsense" as any };
    const r = applyFiltersAndSort(fixtureRows, f as ConnectorTableFilters);
    expect(r).toEqual([]);
  });
});

describe("listKnownFolders", () => {
  it("returns unique folders sorted alphabetically", () => {
    expect(listKnownFolders(fixtureRows)).toEqual([
      "analytics",
      "day_logs",
      "printables",
    ]);
  });
  it("returns [] for non-array", () => {
    expect(listKnownFolders(null as any)).toEqual([]);
  });
  it("ignores empty/falsy folder strings", () => {
    const rows: RecentRow[] = [
      mkRow({ id: 1, targetFolder: "x" }),
      mkRow({ id: 2, targetFolder: "" }),
    ];
    expect(listKnownFolders(rows)).toEqual(["x"]);
  });
});

describe("formatResultCount", () => {
  it("empty total → 'no rows yet'", () => {
    expect(formatResultCount(0, 0, false)).toBe("no rows yet");
  });
  it("filters inactive → total rows", () => {
    expect(formatResultCount(5, 5, false)).toBe("5 rows");
    expect(formatResultCount(1, 1, false)).toBe("1 row");
  });
  it("filters active → N of M match", () => {
    expect(formatResultCount(3, 7, true)).toBe("3 of 7 rows match");
    expect(formatResultCount(0, 1, true)).toBe("0 of 1 row match");
  });
});
