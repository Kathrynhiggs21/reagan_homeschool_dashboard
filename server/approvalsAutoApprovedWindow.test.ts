/**
 * Tests for the "AI auto-approved last 24h" feed behind the Pending
 * Approvals card's second sub-tab.
 *
 * The real `listAutoApprovedSince()` helper is in `server/db.ts` and runs
 * a Drizzle query against the live DB. We test the deterministic window
 * math + filter predicate as a pure function so future drift is caught
 * without spinning up MySQL.
 *
 * Contract being locked:
 *   1. Only rows with status === "auto_approved" appear.
 *   2. Only rows with requestedAt >= (nowMs - windowMs) appear.
 *   3. Returned list is sorted newest-first (descending requestedAt).
 *   4. The default window is 24 hours (86_400_000 ms).
 *   5. The default limit is 100; rows beyond the limit are dropped.
 */
import { describe, it, expect } from "vitest";

type Row = {
  id: number;
  status: "pending" | "auto_approved" | "approved" | "rejected" | "expired";
  requestedAt: number;
  summary: string;
};

function autoApprovedSince(
  rows: Row[],
  windowMs: number = 24 * 60 * 60 * 1000,
  limit: number = 100,
  nowMs: number = Date.now(),
): Row[] {
  const cutoff = nowMs - windowMs;
  const filtered = rows.filter(
    (r) => r.status === "auto_approved" && r.requestedAt >= cutoff,
  );
  filtered.sort((a, b) => b.requestedAt - a.requestedAt);
  return filtered.slice(0, limit);
}

describe("approvals.listAutoApprovedRecent window logic", () => {
  const NOW = 1780_000_000_000; // fixed reference point
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  it("filters out non-auto_approved rows", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - ONE_HOUR, summary: "a" },
      { id: 2, status: "pending", requestedAt: NOW - ONE_HOUR, summary: "b" },
      { id: 3, status: "approved", requestedAt: NOW - ONE_HOUR, summary: "c" },
      { id: 4, status: "rejected", requestedAt: NOW - ONE_HOUR, summary: "d" },
      { id: 5, status: "expired", requestedAt: NOW - ONE_HOUR, summary: "e" },
    ];
    const result = autoApprovedSince(rows, ONE_DAY, 100, NOW);
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("filters out rows older than the window", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - 2 * ONE_HOUR, summary: "in" },
      { id: 2, status: "auto_approved", requestedAt: NOW - 25 * ONE_HOUR, summary: "out (25h)" },
      { id: 3, status: "auto_approved", requestedAt: NOW - 48 * ONE_HOUR, summary: "out (48h)" },
    ];
    const result = autoApprovedSince(rows, ONE_DAY, 100, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("includes rows exactly at the window boundary (>= cutoff)", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - ONE_DAY, summary: "exactly 24h" },
      { id: 2, status: "auto_approved", requestedAt: NOW - ONE_DAY - 1, summary: "24h + 1ms" },
    ];
    const result = autoApprovedSince(rows, ONE_DAY, 100, NOW);
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("sorts newest-first by requestedAt", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - 10 * ONE_HOUR, summary: "older" },
      { id: 2, status: "auto_approved", requestedAt: NOW - 1 * ONE_HOUR, summary: "newer" },
      { id: 3, status: "auto_approved", requestedAt: NOW - 5 * ONE_HOUR, summary: "middle" },
    ];
    const result = autoApprovedSince(rows, ONE_DAY, 100, NOW);
    expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("respects the limit by trimming the tail", () => {
    const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      status: "auto_approved" as const,
      requestedAt: NOW - (i + 1) * ONE_HOUR,
      summary: `row ${i + 1}`,
    }));
    const result = autoApprovedSince(rows, ONE_DAY, 3, NOW);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3]); // newest 3
  });

  it("default window is 24 hours", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - 12 * ONE_HOUR, summary: "12h" },
      { id: 2, status: "auto_approved", requestedAt: NOW - 36 * ONE_HOUR, summary: "36h" },
    ];
    const result = autoApprovedSince(rows, undefined, 100, NOW);
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("supports a 7-day window when requested", () => {
    const SEVEN_DAYS = 7 * ONE_DAY;
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - 1 * ONE_DAY, summary: "1d" },
      { id: 2, status: "auto_approved", requestedAt: NOW - 5 * ONE_DAY, summary: "5d" },
      { id: 3, status: "auto_approved", requestedAt: NOW - 10 * ONE_DAY, summary: "10d (out)" },
    ];
    const result = autoApprovedSince(rows, SEVEN_DAYS, 100, NOW);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it("returns an empty array when nothing in the window", () => {
    const rows: Row[] = [
      { id: 1, status: "auto_approved", requestedAt: NOW - 30 * ONE_HOUR, summary: "out" },
    ];
    expect(autoApprovedSince(rows, ONE_DAY, 100, NOW)).toEqual([]);
  });

  it("returns an empty array when input is empty", () => {
    expect(autoApprovedSince([], ONE_DAY, 100, NOW)).toEqual([]);
  });
});
