/**
 * Push 109 (2026-05-13) — Grandma-aware Sunday digest body contract.
 */
import { describe, it, expect } from "vitest";
import {
  audienceFromEmail,
  composeSundayDigestBody,
  type DigestSnapshot,
} from "./_lib/sundayDigestBody";

const SNAP: DigestSnapshot = {
  weekStartIso: "2026-05-04T00:00:00Z",
  weekEndIso: "2026-05-10T23:59:00Z",
  subjectHours: { math: 3.5, ela: 4, science: 2 },
  moodSummary: { greenShare: 0.7, yellowShare: 0.25, redShare: 0.05, headline: "Mostly green week" },
  iepCoverageNote: "On track for fractions + nonfiction reading.",
  offPlanCaptures: ["Crystal growing — science off-plan"],
  mondayPreview: "Math: long division. ELA: chapter 7.",
};

describe("Push 109 — Sunday digest body composer", () => {
  it("audienceFromEmail recognizes Mom, Grandma, tutor, viewer", () => {
    expect(audienceFromEmail("spear.cpt@gmail.com")).toBe("mom");
    expect(audienceFromEmail("blakehiggs@hotmail.com")).toBe("mom");
    expect(audienceFromEmail("marcy.spear@gmail.com")).toBe("grandma");
    expect(audienceFromEmail("madison@tbd.local")).toBe("tutor");
    expect(audienceFromEmail("random@example.com")).toBe("viewer");
    expect(audienceFromEmail(null)).toBe("viewer");
  });

  it("Grandma body opens with greeting + mood-snapshot before subject hours", () => {
    const body = composeSundayDigestBody({ audience: "grandma", snapshot: SNAP });
    expect(body.audience).toBe("grandma");
    const kinds = body.sections.map((s) => s.kind);
    expect(kinds[0]).toBe("greeting");
    expect(kinds.indexOf("moodSnapshot")).toBeLessThan(kinds.indexOf("subjectHours"));
    // No Monday preview for Grandma.
    expect(kinds).not.toContain("mondayPreview");
  });

  it("Mom body leads with subject hours and includes mondayPreview", () => {
    const body = composeSundayDigestBody({ audience: "mom", snapshot: SNAP });
    const kinds = body.sections.map((s) => s.kind);
    // Mom does not get a top greeting line.
    expect(kinds[0]).toBe("subjectHours");
    expect(kinds.indexOf("subjectHours")).toBeLessThan(kinds.indexOf("moodSnapshot"));
    expect(kinds).toContain("mondayPreview");
  });

  it("Grandma close line references the IEP paper-trail framing", () => {
    const body = composeSundayDigestBody({ audience: "grandma", snapshot: SNAP });
    const close = body.sections.find((s) => s.kind === "close");
    expect(close).toBeDefined();
    if (close && close.kind === "close") {
      expect(close.text.toLowerCase()).toMatch(/iep/);
    }
  });

  it("Subject line is audience-aware and includes the date range", () => {
    const grandma = composeSundayDigestBody({ audience: "grandma", snapshot: SNAP });
    const mom = composeSundayDigestBody({ audience: "mom", snapshot: SNAP });
    expect(grandma.subject).toMatch(/Grandma|week with Mom/i);
    expect(grandma.subject).toContain("2026-05-04");
    expect(grandma.subject).toContain("2026-05-10");
    expect(mom.subject).toMatch(/Weekly digest/);
  });

  it("Sections for IEP / off-plan are omitted when snapshot has none", () => {
    const empty: DigestSnapshot = { ...SNAP, iepCoverageNote: null, offPlanCaptures: [] };
    const body = composeSundayDigestBody({ audience: "grandma", snapshot: empty });
    const kinds = body.sections.map((s) => s.kind);
    expect(kinds).not.toContain("iepCoverage");
    expect(kinds).not.toContain("offPlanCaptures");
  });

  it("tutor audience gets neither Grandma greeting nor Monday preview", () => {
    const body = composeSundayDigestBody({ audience: "tutor", snapshot: SNAP });
    const kinds = body.sections.map((s) => s.kind);
    expect(kinds).not.toContain("greeting");
    expect(kinds).not.toContain("mondayPreview");
    expect(body.subject).toMatch(/Tutor/i);
  });

  it("viewer audience close line invites them to talk to Mom", () => {
    const body = composeSundayDigestBody({ audience: "viewer", snapshot: SNAP });
    const close = body.sections.find((s) => s.kind === "close");
    if (close && close.kind === "close") {
      expect(close.text.toLowerCase()).toMatch(/mom/);
    }
  });

  it("mondayPreview is dropped even for Mom if snapshot omits it", () => {
    const noPrev: DigestSnapshot = { ...SNAP, mondayPreview: undefined };
    const body = composeSundayDigestBody({ audience: "mom", snapshot: noPrev });
    expect(body.sections.map((s) => s.kind)).not.toContain("mondayPreview");
  });
});
