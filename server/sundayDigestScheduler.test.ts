/**
 * Push 85 (2026-05-13) — Sunday digest scheduler contract.
 *
 * Locks the pure send-time policy + idempotency math so the eventual
 * production scheduler (heartbeat cron) can call decideDigestSends safely.
 */
import { describe, it, expect } from "vitest";
import {
  isDigestSendWindow,
  weekStartFor,
  digestIdempotencyKey,
  decideDigestSends,
} from "./_lib/sundayDigestScheduler";

// Helper: make a local-time Date at the given Y-M-D H:M (zero-indexed month).
function localAt(y: number, mZero: number, d: number, h: number, min: number): Date {
  return new Date(y, mZero, d, h, min, 0, 0);
}

describe("Push 85 — isDigestSendWindow", () => {
  // 2026-05-17 is a Sunday.
  it("opens at 7:00 PM Sunday local time", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 17, 19, 0))).toBe(true);
  });
  it("stays open at 7:30 PM Sunday", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 17, 19, 30))).toBe(true);
  });
  it("stays open at 7:59 PM Sunday", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 17, 19, 59))).toBe(true);
  });
  it("closes at 8:00 PM Sunday", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 17, 20, 0))).toBe(false);
  });
  it("rejects 6:59 PM Sunday (before window opens)", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 17, 18, 59))).toBe(false);
  });
  it("rejects 7:00 PM Saturday (wrong day)", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 16, 19, 30))).toBe(false);
  });
  it("rejects 7:00 PM Monday (wrong day)", () => {
    expect(isDigestSendWindow(localAt(2026, 4, 18, 19, 30))).toBe(false);
  });
  it("respects custom day/hour overrides", () => {
    // Override to Saturday 9 PM.
    expect(
      isDigestSendWindow(localAt(2026, 4, 16, 21, 30), {
        dayOfWeek: 6,
        hour: 21,
      }),
    ).toBe(true);
  });
  it("respects custom durationMin (window of 5 min only)", () => {
    expect(
      isDigestSendWindow(localAt(2026, 4, 17, 19, 4), { durationMin: 5 }),
    ).toBe(true);
    expect(
      isDigestSendWindow(localAt(2026, 4, 17, 19, 5), { durationMin: 5 }),
    ).toBe(false);
  });
});

describe("Push 85 — weekStartFor", () => {
  it("returns same date when already Sunday", () => {
    expect(weekStartFor(localAt(2026, 4, 17, 19, 30))).toBe("2026-05-17");
  });
  it("returns previous Sunday for Wednesday", () => {
    expect(weekStartFor(localAt(2026, 4, 20, 12, 0))).toBe("2026-05-17");
  });
  it("returns previous Sunday for Saturday", () => {
    expect(weekStartFor(localAt(2026, 4, 23, 8, 0))).toBe("2026-05-17");
  });
  it("crosses month boundaries", () => {
    // 2026-06-01 is a Monday → previous Sunday is 2026-05-31.
    expect(weekStartFor(localAt(2026, 5, 1, 12, 0))).toBe("2026-05-31");
  });
  it("crosses year boundaries", () => {
    // 2027-01-01 is a Friday → previous Sunday is 2026-12-27.
    expect(weekStartFor(localAt(2027, 0, 1, 12, 0))).toBe("2026-12-27");
  });
});

describe("Push 85 — digestIdempotencyKey", () => {
  it("is stable for identical inputs", () => {
    const a = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const b = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    expect(a).toBe(b);
  });
  it("case-folds email so casing variants share the same key", () => {
    const lower = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const upper = digestIdempotencyKey("2026-05-17", "Marcy.Spear@Gmail.COM");
    expect(lower).toBe(upper);
  });
  it("trims whitespace in email", () => {
    const trimmed = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const padded = digestIdempotencyKey("2026-05-17", "  marcy.spear@gmail.com  ");
    expect(trimmed).toBe(padded);
  });
  it("differs between recipients in the same week", () => {
    const mom = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const grandma = digestIdempotencyKey("2026-05-17", "spear.cpt@gmail.com");
    expect(mom).not.toBe(grandma);
  });
  it("differs between weeks for the same recipient", () => {
    const wk1 = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const wk2 = digestIdempotencyKey("2026-05-24", "marcy.spear@gmail.com");
    expect(wk1).not.toBe(wk2);
  });
  it("emits a short hex string (12 chars)", () => {
    const key = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    expect(key).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("Push 85 — decideDigestSends", () => {
  const RECIPIENTS = [
    { email: "marcy.spear@gmail.com", role: "mom" as const },
    { email: "spear.cpt@gmail.com", role: "grandma" as const },
  ];

  it("returns empty outside send window even with recipients", () => {
    const plans = decideDigestSends(
      localAt(2026, 4, 18, 19, 0), // Monday 7 PM
      RECIPIENTS,
      new Set<string>(),
    );
    expect(plans).toEqual([]);
  });

  it("returns one plan per recipient when in window with no prior sends", () => {
    const plans = decideDigestSends(
      localAt(2026, 4, 17, 19, 15),
      RECIPIENTS,
      new Set<string>(),
    );
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.recipient.email)).toEqual([
      "marcy.spear@gmail.com",
      "spear.cpt@gmail.com",
    ]);
    for (const p of plans) {
      expect(p.weekStartISO).toBe("2026-05-17");
      expect(p.idempotencyKey).toMatch(/^[0-9a-f]{12}$/);
    }
  });

  it("skips recipients whose idempotency key was already enqueued", () => {
    const momKey = digestIdempotencyKey("2026-05-17", "marcy.spear@gmail.com");
    const plans = decideDigestSends(
      localAt(2026, 4, 17, 19, 30),
      RECIPIENTS,
      new Set([momKey]),
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].recipient.email).toBe("spear.cpt@gmail.com");
  });

  it("returns empty when all recipients already sent (idempotency)", () => {
    const week = "2026-05-17";
    const seen = new Set([
      digestIdempotencyKey(week, "marcy.spear@gmail.com"),
      digestIdempotencyKey(week, "spear.cpt@gmail.com"),
    ]);
    const plans = decideDigestSends(
      localAt(2026, 4, 17, 19, 30),
      RECIPIENTS,
      seen,
    );
    expect(plans).toEqual([]);
  });

  it("preserves recipient order in the dispatch plan list", () => {
    const reversed = [...RECIPIENTS].reverse();
    const plans = decideDigestSends(
      localAt(2026, 4, 17, 19, 30),
      reversed,
      new Set<string>(),
    );
    expect(plans.map((p) => p.recipient.email)).toEqual([
      "spear.cpt@gmail.com",
      "marcy.spear@gmail.com",
    ]);
  });
});
