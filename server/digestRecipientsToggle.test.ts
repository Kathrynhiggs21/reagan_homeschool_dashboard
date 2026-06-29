/**
 * Push 94 (2026-05-13) — Weekly digest recipient toggle contract.
 *
 * Locks the Mom-permanent / Grandma-toggleable / extras-appended rule
 * so the WeeklyDigestCard and the Sunday send queue always agree.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveDigestRecipients,
  grandmaMuteBanner,
} from "./_lib/digestRecipientsToggle";
import { setGrandmaEmailPaused } from "./_lib/grandmaAudience";

describe("Push 94 — digest recipients toggle", () => {
  // The toggle ORDERING contract requires the global pause OFF. The
  // 2026-06-18 global pause is verified in its own case below.
  beforeEach(() => setGrandmaEmailPaused(false));
  afterEach(() => setGrandmaEmailPaused(false));

  it("2026-06-18 PAUSE: global pause forces Mom-only even when grandmaEnabled", () => {
    setGrandmaEmailPaused(true);
    const r = resolveDigestRecipients({ grandmaEnabled: true });
    expect(r.recipients).toHaveLength(1);
    expect(r.recipients[0].role).toBe("mom");
    expect(r.grandmaIncluded).toBe(false);
    expect(r.summary).not.toContain("Grandma");
  });

  it("Grandma on (default) → Mom + Grandma in that order", () => {
    const r = resolveDigestRecipients({ grandmaEnabled: true });
    expect(r.recipients.map((x) => x.role)).toEqual(["mom", "grandma"]);
    expect(r.recipients[0].email).toBe("reaganhiggs910@gmail.com");
    expect(r.recipients[1].email).toBe("marcy.spear@gmail.com");
    expect(r.grandmaIncluded).toBe(true);
    expect(r.summary).toContain("Mom (Reagan)");
    expect(r.summary).toContain("Grandma Marcy");
  });

  it("Grandma off → Mom only (Mom is permanent)", () => {
    const r = resolveDigestRecipients({ grandmaEnabled: false });
    expect(r.recipients).toHaveLength(1);
    expect(r.recipients[0].role).toBe("mom");
    expect(r.grandmaIncluded).toBe(false);
    expect(r.summary).not.toContain("Grandma");
  });

  it("extras append after Mom + Grandma without re-ordering", () => {
    const r = resolveDigestRecipients({
      grandmaEnabled: true,
      extras: [
        { email: "dad@example.com", displayName: "Dad", role: "family-admin" },
      ],
    });
    expect(r.recipients.map((x) => x.role)).toEqual(["mom", "grandma", "family-admin"]);
    expect(r.recipients[2].email).toBe("dad@example.com");
  });

  it("extras de-dupe against base (case-insensitive)", () => {
    const r = resolveDigestRecipients({
      grandmaEnabled: true,
      extras: [
        { email: "MARCY.SPEAR@gmail.com", displayName: "Marcy dup", role: "grandma" },
        { email: "dad@example.com", displayName: "Dad", role: "family-admin" },
      ],
    });
    // Grandma stays as base "Grandma Marcy", dup is dropped, Dad appended.
    expect(r.recipients.map((x) => x.email.toLowerCase())).toEqual([
      "reaganhiggs910@gmail.com",
      "marcy.spear@gmail.com",
      "dad@example.com",
    ]);
    expect(r.recipients[1].displayName).toBe("Grandma Marcy");
  });

  it("grandmaMuteBanner shows when Grandma is off", () => {
    const b = grandmaMuteBanner({ grandmaEnabled: false });
    expect(b.show).toBe(true);
    if (b.show) expect(b.message).toMatch(/Grandma.*muted/i);
  });

  it("grandmaMuteBanner hidden when Grandma is on", () => {
    const b = grandmaMuteBanner({ grandmaEnabled: true });
    expect(b.show).toBe(false);
  });
});
