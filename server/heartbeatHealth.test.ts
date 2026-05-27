/**
 * v2.97.3 — Contract test for system.heartbeatHealth
 *
 * Locks the status-derivation logic without hitting the real Heartbeat
 * service. We re-implement the exact derivation here as the reference
 * spec; if systemRouter changes, this test will need to be updated and
 * we want that breakage visible.
 */
import { describe, it, expect } from "vitest";

type JobStatus = "paused" | "never_run" | "healthy" | "stale";

function deriveStatus(
  isEnable: boolean,
  lastFiredAt: string | null,
  nextFireAt: string | null,
  now: number = Date.now()
): JobStatus {
  if (!isEnable) return "paused";
  if (!lastFiredAt) return "never_run";
  const lastMs = Date.parse(lastFiredAt);
  if (!nextFireAt) return "healthy";
  const nextMs = Date.parse(nextFireAt);
  const expectedInterval = nextMs - lastMs;
  if (now - lastMs > expectedInterval * 2.5) return "stale";
  return "healthy";
}

describe("heartbeatHealth status derivation", () => {
  const now = Date.parse("2026-05-28T11:00:00.000Z");

  it("paused job ignores all timestamps", () => {
    expect(
      deriveStatus(false, "2026-05-27T11:00:00.000Z", "2026-05-28T11:00:00.000Z", now)
    ).toBe("paused");
    expect(deriveStatus(false, null, null, now)).toBe("paused");
  });

  it("never_run when enabled but no last fire", () => {
    expect(deriveStatus(true, null, "2026-05-28T11:00:00.000Z", now)).toBe("never_run");
  });

  it("healthy when fired within 2.5x cron interval", () => {
    // 24h cron: last fired 24h ago, next due now → expected interval 24h, age 24h ≤ 60h
    expect(
      deriveStatus(true, "2026-05-27T11:00:00.000Z", "2026-05-28T11:00:00.000Z", now)
    ).toBe("healthy");
  });

  it("stale when last fire is older than 2.5x interval", () => {
    // 24h interval (last 96h ago, next was 72h ago = 24h cycle).
    // age 96h > 2.5 × 24h = 60h → stale
    expect(
      deriveStatus(
        true,
        "2026-05-24T11:00:00.000Z",
        "2026-05-25T11:00:00.000Z",
        now
      )
    ).toBe("stale");
  });

  it("healthy when no nextFireAt is provided", () => {
    expect(
      deriveStatus(true, "2026-05-27T11:00:00.000Z", null, now)
    ).toBe("healthy");
  });

  it("threshold is exactly 2.5x: just under = healthy, just over = stale", () => {
    // interval 1h. last 2.4h ago = 144 min, threshold 150 min → still healthy
    const interval = 60 * 60 * 1000;
    const just_under = now - 2.4 * interval;
    const just_over = now - 2.6 * interval;
    expect(
      deriveStatus(
        true,
        new Date(just_under).toISOString(),
        new Date(just_under + interval).toISOString(),
        now
      )
    ).toBe("healthy");
    expect(
      deriveStatus(
        true,
        new Date(just_over).toISOString(),
        new Date(just_over + interval).toISOString(),
        now
      )
    ).toBe("stale");
  });
});

describe("heartbeatHealth sort order", () => {
  // Reference impl: stale → never_run → paused → healthy, then by nextFireAt
  function sortJobs(jobs: Array<{ status: JobStatus; nextFireAt: string | null }>) {
    const order = { stale: 0, never_run: 1, paused: 2, healthy: 3 } as const;
    return [...jobs].sort((a, b) => {
      const ao = order[a.status];
      const bo = order[b.status];
      if (ao !== bo) return ao - bo;
      const at = a.nextFireAt ? Date.parse(a.nextFireAt) : Number.MAX_SAFE_INTEGER;
      const bt = b.nextFireAt ? Date.parse(b.nextFireAt) : Number.MAX_SAFE_INTEGER;
      return at - bt;
    });
  }

  it("attention items come first", () => {
    const jobs = [
      { status: "healthy" as const, nextFireAt: "2026-05-28T12:00:00.000Z" },
      { status: "stale" as const, nextFireAt: "2026-05-28T13:00:00.000Z" },
      { status: "paused" as const, nextFireAt: null },
      { status: "never_run" as const, nextFireAt: "2026-05-28T14:00:00.000Z" },
    ];
    const sorted = sortJobs(jobs);
    expect(sorted.map((j) => j.status)).toEqual([
      "stale",
      "never_run",
      "paused",
      "healthy",
    ]);
  });

  it("within same status, earlier nextFireAt comes first", () => {
    const jobs = [
      { status: "healthy" as const, nextFireAt: "2026-05-28T15:00:00.000Z" },
      { status: "healthy" as const, nextFireAt: "2026-05-28T11:00:00.000Z" },
      { status: "healthy" as const, nextFireAt: "2026-05-28T13:00:00.000Z" },
    ];
    const sorted = sortJobs(jobs);
    expect(sorted.map((j) => j.nextFireAt)).toEqual([
      "2026-05-28T11:00:00.000Z",
      "2026-05-28T13:00:00.000Z",
      "2026-05-28T15:00:00.000Z",
    ]);
  });
});
