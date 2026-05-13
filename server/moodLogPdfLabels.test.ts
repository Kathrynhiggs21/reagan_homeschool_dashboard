/**
 * Push 99 (2026-05-13) — Mood-log paper-trail PDF labels contract.
 *
 * Locks the badge text + hex colors + bucket boundaries + Grandma-share
 * footer so the IEP PDF and any in-app pill stays in lockstep.
 */
import { describe, it, expect } from "vitest";
import {
  bucketMoodRows,
  dayBucketFor,
  grandmaShareFooter,
  labelForMoodRow,
} from "./_lib/moodLogPdfLabels";

describe("Push 99 — mood-log PDF labels", () => {
  it("zone badges are exactly Green · Calm / Yellow · Watch / Red · Crisis", () => {
    const g = labelForMoodRow({
      loggedAt: "2026-05-13T09:14:00",
      zone: "green",
      source: "kid-self",
    });
    expect(g.badge).toBe("Green · Calm");
    const y = labelForMoodRow({
      loggedAt: "2026-05-13T13:00:00",
      zone: "yellow",
      source: "mom",
    });
    expect(y.badge).toBe("Yellow · Watch");
    const r = labelForMoodRow({
      loggedAt: "2026-05-13T17:30:00",
      zone: "red",
      source: "grandma",
    });
    expect(r.badge).toBe("Red · Crisis");
  });

  it("hex palette matches dashboard tokens (Tailwind 500 scale)", () => {
    expect(
      labelForMoodRow({
        loggedAt: "2026-05-13T09:14:00",
        zone: "green",
        source: "ai",
      }).hex,
    ).toBe("#10b981");
    expect(
      labelForMoodRow({
        loggedAt: "2026-05-13T09:14:00",
        zone: "yellow",
        source: "ai",
      }).hex,
    ).toBe("#f59e0b");
    expect(
      labelForMoodRow({
        loggedAt: "2026-05-13T09:14:00",
        zone: "red",
        source: "ai",
      }).hex,
    ).toBe("#ef4444");
  });

  it("dayBucketFor splits at 11 / 14 / 18 boundaries", () => {
    expect(dayBucketFor(new Date("2026-05-13T07:00:00"))).toBe("morning");
    expect(dayBucketFor(new Date("2026-05-13T10:59:00"))).toBe("morning");
    expect(dayBucketFor(new Date("2026-05-13T11:00:00"))).toBe("midday");
    expect(dayBucketFor(new Date("2026-05-13T13:59:00"))).toBe("midday");
    expect(dayBucketFor(new Date("2026-05-13T14:00:00"))).toBe("afternoon");
    expect(dayBucketFor(new Date("2026-05-13T17:59:00"))).toBe("afternoon");
    expect(dayBucketFor(new Date("2026-05-13T18:00:00"))).toBe("evening");
    expect(dayBucketFor(new Date("2026-05-13T22:00:00"))).toBe("evening");
  });

  it("bucketMoodRows preserves canonical morning→evening order", () => {
    const out = bucketMoodRows([
      { loggedAt: "2026-05-13T17:30:00", zone: "red", source: "mom" },
      { loggedAt: "2026-05-13T09:00:00", zone: "green", source: "kid-self" },
      { loggedAt: "2026-05-13T19:30:00", zone: "yellow", source: "grandma" },
      { loggedAt: "2026-05-13T13:15:00", zone: "yellow", source: "ai" },
    ]);
    expect(out.map((b) => b.bucket)).toEqual([
      "morning",
      "midday",
      "afternoon",
      "evening",
    ]);
    expect(out[0].rows).toHaveLength(1);
    expect(out[1].rows).toHaveLength(1);
    expect(out[2].rows).toHaveLength(1);
    expect(out[3].rows).toHaveLength(1);
  });

  it("malformed timestamps are silently dropped from bucketMoodRows", () => {
    const out = bucketMoodRows([
      { loggedAt: "not-a-date", zone: "green", source: "ai" },
      { loggedAt: "2026-05-13T09:00:00", zone: "green", source: "ai" },
    ]);
    const total = out.reduce((acc, b) => acc + b.rows.length, 0);
    expect(total).toBe(1);
  });

  it("labelForMoodRow throws on malformed loggedAt", () => {
    expect(() =>
      labelForMoodRow({
        loggedAt: "definitely-not-a-date",
        zone: "green",
        source: "ai",
      }),
    ).toThrow();
  });

  it("grandmaShareFooter mentions kid name + IEP paper trail + don't-repost", () => {
    const f = grandmaShareFooter({ dateLabel: "May 13, 2026" });
    expect(f).toContain("Reagan");
    expect(f).toContain("May 13, 2026");
    expect(f).toMatch(/IEP meetings/i);
    expect(f).toMatch(/don't repost/i);
  });

  it("grandmaShareFooter respects kidName override", () => {
    const f = grandmaShareFooter({ dateLabel: "May 13, 2026", kidName: "Reagan H." });
    expect(f).toContain("Reagan H.");
  });
});
