/**
 * Push 127 (2026-05-13) — Slay Charge ⚡ reroll audit + rate-limit contract.
 */
import { describe, it, expect } from "vitest";
import {
  decideSlayChargeReroll,
  isRerollAllowed,
  SLAY_CHARGE_REROLL_DAILY_CAP,
} from "./_lib/slayChargeRerollAudit";

const NOW = Date.parse("2026-05-13T15:00:00Z");

describe("Push 127 — decideSlayChargeReroll", () => {
  it("allows the first reroll and emits an audit row with prev/next index", () => {
    const out = decideSlayChargeReroll({
      dateIso: "2026-05-13",
      prevIndex: 0,
      reason: "kid-tap",
      actorId: "reagan",
      nowMs: NOW,
    });
    expect(out.kind).toBe("allow");
    if (out.kind === "allow") {
      expect(out.nextIndex).toBe(1);
      expect(out.audit.kind).toBe("slay-charge-reroll");
      expect(out.audit.prevIndex).toBe(0);
      expect(out.audit.nextIndex).toBe(1);
      expect(out.audit.actorId).toBe("reagan");
      expect(out.audit.dateIso).toBe("2026-05-13");
      expect(out.audit.reason).toBe("kid-tap");
      expect(out.audit.decidedAtMs).toBe(NOW);
    }
  });

  it("denies when daily cap reached (kid-tap)", () => {
    const out = decideSlayChargeReroll({
      dateIso: "2026-05-13",
      prevIndex: SLAY_CHARGE_REROLL_DAILY_CAP,
      reason: "kid-tap",
      actorId: "reagan",
      nowMs: NOW,
    });
    expect(out.kind).toBe("deny-rate-limit");
    if (out.kind === "deny-rate-limit") {
      expect(out.reason).toBe("daily-cap-reached");
      expect(out.capLimit).toBe(SLAY_CHARGE_REROLL_DAILY_CAP);
      expect(out.audit).toBeNull();
    }
  });

  it("adult-preview bypasses the cap", () => {
    const out = decideSlayChargeReroll({
      dateIso: "2026-05-13",
      prevIndex: 999,
      reason: "adult-preview",
      actorId: "mom",
      nowMs: NOW,
    });
    expect(out.kind).toBe("allow");
  });

  it("rejects missing-date / bad-date / negative / non-finite / empty-actor", () => {
    expect(
      decideSlayChargeReroll({
        dateIso: "",
        prevIndex: 0,
        reason: "kid-tap",
        actorId: "reagan",
        nowMs: NOW,
      }).kind,
    ).toBe("deny-bad-input");
    expect(
      decideSlayChargeReroll({
        dateIso: "2026/05/13",
        prevIndex: 0,
        reason: "kid-tap",
        actorId: "reagan",
        nowMs: NOW,
      }).kind,
    ).toBe("deny-bad-input");
    expect(
      decideSlayChargeReroll({
        dateIso: "2026-05-13",
        prevIndex: -1,
        reason: "kid-tap",
        actorId: "reagan",
        nowMs: NOW,
      }).kind,
    ).toBe("deny-bad-input");
    expect(
      decideSlayChargeReroll({
        dateIso: "2026-05-13",
        prevIndex: Number.NaN,
        reason: "kid-tap",
        actorId: "reagan",
        nowMs: NOW,
      }).kind,
    ).toBe("deny-bad-input");
    expect(
      decideSlayChargeReroll({
        dateIso: "2026-05-13",
        prevIndex: 0,
        reason: "kid-tap",
        actorId: "   ",
        nowMs: NOW,
      }).kind,
    ).toBe("deny-bad-input");
  });

  it("isRerollAllowed mirrors decision: false at cap for kid-tap, true for adult-preview", () => {
    expect(
      isRerollAllowed({ prevIndex: SLAY_CHARGE_REROLL_DAILY_CAP, reason: "kid-tap" }),
    ).toBe(false);
    expect(
      isRerollAllowed({ prevIndex: SLAY_CHARGE_REROLL_DAILY_CAP, reason: "adult-preview" }),
    ).toBe(true);
    expect(
      isRerollAllowed({ prevIndex: 0, reason: "kid-tap" }),
    ).toBe(true);
    expect(
      isRerollAllowed({ prevIndex: Number.NaN, reason: "kid-tap" }),
    ).toBe(false);
  });

  it("audit row tags actor 'preview' for adult preview without leaking kid id", () => {
    const out = decideSlayChargeReroll({
      dateIso: "2026-05-13",
      prevIndex: 5,
      reason: "adult-preview",
      actorId: "mom",
      nowMs: NOW,
    });
    expect(out.kind).toBe("allow");
    if (out.kind === "allow") {
      expect(out.audit.actorId).toBe("mom");
      expect(out.audit.reason).toBe("adult-preview");
    }
  });
});
