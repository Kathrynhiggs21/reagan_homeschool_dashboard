/**
 * Push 98 (2026-05-13) — Recap email send queue contract.
 *
 * Locks the gating rules: recap emails only fire when the day has no
 * actual entries AND no Reagan-voice confirmation. Each (date, cadence)
 * is sent at most once via idempotency key dedup.
 */
import { describe, it, expect } from "vitest";
import { planRecapSend } from "./_lib/recapEmailQueue";

describe("Push 98 — recap email send queue", () => {
  const baseInput = {
    dateISO: "2026-05-13",
    cadence: "evening" as const,
    actualEntryCount: 0,
    reaganListeningConfirmed: false,
  };

  it("happy path: empty day → one Grandma-only send", () => {
    const r = planRecapSend(baseInput);
    expect(r.sends).toHaveLength(1);
    expect(r.sends[0].toEmail).toBe("marcy.spear@gmail.com");
    expect(r.sends[0].toDisplayName).toBe("Grandma Marcy");
    expect(r.sends[0].cadence).toBe("evening");
    expect(r.sends[0].dateISO).toBe("2026-05-13");
    expect(r.sends[0].idempotencyKey).toBe("recap:2026-05-13:evening");
    expect(r.skipReason).toBeUndefined();
  });

  it("skips when actual entries already exist for the day", () => {
    const r = planRecapSend({ ...baseInput, actualEntryCount: 3 });
    expect(r.sends).toEqual([]);
    expect(r.skipReason).toBe("actual-entries-exist");
  });

  it("skips when Reagan-voice listening confirmed school chunks", () => {
    const r = planRecapSend({ ...baseInput, reaganListeningConfirmed: true });
    expect(r.sends).toEqual([]);
    expect(r.skipReason).toBe("reagan-voice-confirmed");
  });

  it("skips when this (date, cadence) is already queued", () => {
    const r = planRecapSend({
      ...baseInput,
      alreadyQueuedKeys: ["recap:2026-05-13:evening"],
    });
    expect(r.sends).toEqual([]);
    expect(r.skipReason).toBe("already-queued");
  });

  it("noon cadence and evening cadence are independent idempotency slots", () => {
    const noon = planRecapSend({ ...baseInput, cadence: "noon" });
    expect(noon.sends[0].idempotencyKey).toBe("recap:2026-05-13:noon");
    // A noon send already on the queue must not block the evening one.
    const eveningStillSends = planRecapSend({
      ...baseInput,
      cadence: "evening",
      alreadyQueuedKeys: ["recap:2026-05-13:noon"],
    });
    expect(eveningStillSends.sends).toHaveLength(1);
  });

  it("propagates plannedSubjects + observedSignals into the email body", () => {
    const r = planRecapSend({
      ...baseInput,
      plannedSubjects: ["math", "science"],
      observedSignals: ["photo at 11:02"],
    });
    expect(r.sends[0].body).toContain("Planned subjects today were: math, science.");
    expect(r.sends[0].body).toContain("photo at 11:02");
  });

  it("rejects malformed date string with bad-input skip reason", () => {
    const r = planRecapSend({ ...baseInput, dateISO: "13-05-2026" });
    expect(r.sends).toEqual([]);
    expect(r.skipReason).toBe("bad-input");
  });

  it("never plans a send to anyone other than Grandma Marcy", () => {
    const r = planRecapSend({ ...baseInput });
    // Strict invariant: this queue is for Grandma ONLY by Mom's protocol.
    for (const s of r.sends) {
      expect(s.toEmail.toLowerCase()).toBe("marcy.spear@gmail.com");
    }
  });
});
