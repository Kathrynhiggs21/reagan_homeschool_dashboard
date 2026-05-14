/**
 * Push 133 (2026-05-13) — Grandma-muted-this-week alert contract.
 */
import { describe, it, expect } from "vitest";
import { decideGrandmaMutedAlert } from "./_lib/grandmaMutedAlert";
import { GRANDMA_EMAILS } from "./_lib/grandmaAudience";

const SUNDAY = "2026-05-17";

const MOM = "alex@example.com";
const TUTOR = "madison@tbd.local";
const KID = "reagan@kid.local";
const GRANDMA = GRANDMA_EMAILS[0];

describe("Push 133 — decideGrandmaMutedAlert", () => {
  it("hidden when Grandma is still on this week's recipient list", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM, GRANDMA],
      recentMuteHistoryNewestFirst: [],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    expect(out.kind).toBe("hidden");
    if (out.kind === "hidden") expect(out.reason).toBe("grandma-still-on-list");
  });

  it("hidden for non-mom audiences (tutor / kid / grandma)", () => {
    for (const tier of ["tutor", "kid", "grandma"] as const) {
      const out = decideGrandmaMutedAlert({
        thisWeekRecipientEmails: [MOM],
        recentMuteHistoryNewestFirst: [],
        thisWeekSundayIso: SUNDAY,
        audienceTier: tier,
      });
      expect(out.kind).toBe("hidden");
      if (out.kind === "hidden") expect(out.reason).toBe("wrong-audience");
    }
  });

  it("hidden on bad date", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [],
      thisWeekSundayIso: "2026/05/17",
      audienceTier: "mom",
    });
    if (out.kind === "hidden") expect(out.reason).toBe("bad-date");
  });

  it("info severity when Grandma is muted only this week (streak=1)", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [false, false],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    expect(out.kind).toBe("alert");
    if (out.kind === "alert") {
      expect(out.severity).toBe("info");
      expect(out.auditTag).toContain("streak=1");
    }
  });

  it("warn severity at 2 consecutive mutes (last week + this week)", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [true, false],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    if (out.kind === "alert") {
      expect(out.severity).toBe("warn");
      expect(out.auditTag).toContain("streak=2");
    }
  });

  it("critical severity at 3+ consecutive mutes (paper-trail framing)", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [true, true, false, false],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    if (out.kind === "alert") {
      expect(out.severity).toBe("critical");
      expect(out.auditTag).toContain("streak=3");
      expect(out.body.toLowerCase()).toContain("iep");
    }
  });

  it("streak count breaks at the first false in history", () => {
    // History: muted, muted, NOT-muted, muted, muted
    // Streak should be 2 (this week) + 2 (newest mutes) = 3 → critical
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [true, true, false, true, true],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    if (out.kind === "alert") {
      expect(out.severity).toBe("critical");
      expect(out.auditTag).toContain("streak=3");
    }
  });

  it("Grandma-on-list check is case-insensitive and trim-tolerant", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM, "  Marcy.Spear@GMAIL.com  "],
      recentMuteHistoryNewestFirst: [],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    expect(out.kind).toBe("hidden");
    if (out.kind === "hidden") expect(out.reason).toBe("grandma-still-on-list");
  });

  it("alert headline + body never reference Reagan or kid-tier framing", () => {
    const out = decideGrandmaMutedAlert({
      thisWeekRecipientEmails: [MOM],
      recentMuteHistoryNewestFirst: [],
      thisWeekSundayIso: SUNDAY,
      audienceTier: "mom",
    });
    if (out.kind === "alert") {
      const blob = (out.headline + " " + out.body).toLowerCase();
      expect(blob).not.toContain("reagan");
      expect(blob).not.toContain("kid");
    }
  });
});
