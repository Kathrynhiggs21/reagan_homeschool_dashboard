/**
 * Push 95 (2026-05-13) — Recap-email composer contract.
 *
 * Locks the Mom-protocol: when a day has no logged work, the dashboard
 * emails Grandma Marcy at marcy.spear@gmail.com asking for a brief
 * overview. Tone shifts between noon (heads-up) and evening (final ask).
 */
import { describe, it, expect } from "vitest";
import {
  composeRecapEmail,
  recapEmailIdempotencyKey,
} from "./_lib/recapEmailComposer";

describe("Push 95 — recap email composer", () => {
  it("always addresses Grandma Marcy at marcy.spear@gmail.com", () => {
    const r = composeRecapEmail({ dateISO: "2026-05-13", cadence: "evening" });
    expect(r.toEmail).toBe("marcy.spear@gmail.com");
    expect(r.toDisplayName).toBe("Grandma Marcy");
    expect(r.body).toContain("Hi Grandma Marcy,");
  });

  it("noon cadence uses 'Quick check-in' subject + softer body", () => {
    const r = composeRecapEmail({ dateISO: "2026-05-13", cadence: "noon" });
    expect(r.subject).toMatch(/^Quick check-in:/);
    expect(r.body).toMatch(/heads-up|mid-day/i);
    expect(r.body).not.toMatch(/no work was logged/i);
  });

  it("evening cadence uses 'End-of-day recap' subject + ask for overview", () => {
    const r = composeRecapEmail({ dateISO: "2026-05-13", cadence: "evening" });
    expect(r.subject).toMatch(/^End-of-day recap:/);
    expect(r.body).toMatch(/no work was logged/i);
    expect(r.body).toMatch(/brief overview/i);
  });

  it("defaults kid name to Reagan; respects override", () => {
    const a = composeRecapEmail({ dateISO: "2026-05-13", cadence: "noon" });
    expect(a.subject).toContain("Reagan");
    const b = composeRecapEmail({
      dateISO: "2026-05-13",
      cadence: "noon",
      kidName: "Reagan Higgs",
    });
    expect(b.subject).toContain("Reagan Higgs");
  });

  it("plannedSubjects render as comma list", () => {
    const r = composeRecapEmail({
      dateISO: "2026-05-13",
      cadence: "evening",
      plannedSubjects: ["math", "ELA", "science"],
    });
    expect(r.body).toContain("Planned subjects today were: math, ELA, science.");
  });

  it("observedSignals render as bulleted list", () => {
    const r = composeRecapEmail({
      dateISO: "2026-05-13",
      cadence: "evening",
      observedSignals: ["mood log at 10:14 was yellow", "photo upload at 11:02"],
    });
    expect(r.body).toContain("Things the dashboard noticed but couldn't confirm:");
    expect(r.body).toContain("  - mood log at 10:14 was yellow");
    expect(r.body).toContain("  - photo upload at 11:02");
  });

  it("no plannedSubjects / observedSignals → those sections are omitted", () => {
    const r = composeRecapEmail({ dateISO: "2026-05-13", cadence: "evening" });
    expect(r.body).not.toContain("Planned subjects today were:");
    expect(r.body).not.toContain("Things the dashboard noticed");
  });

  it("subject embeds the human date label", () => {
    const r = composeRecapEmail({ dateISO: "2026-05-13", cadence: "evening" });
    expect(r.subject).toMatch(/May 13/);
  });

  it("rejects bad date strings", () => {
    expect(() => composeRecapEmail({ dateISO: "13-05-2026", cadence: "noon" })).toThrow();
    expect(() => composeRecapEmail({ dateISO: "", cadence: "noon" })).toThrow();
  });

  it("idempotency key is recap:<date>:<cadence>", () => {
    expect(
      recapEmailIdempotencyKey({ dateISO: "2026-05-13", cadence: "noon" }),
    ).toBe("recap:2026-05-13:noon");
    expect(
      recapEmailIdempotencyKey({ dateISO: "2026-05-13", cadence: "evening" }),
    ).toBe("recap:2026-05-13:evening");
  });
});
