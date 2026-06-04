/**
 * v3.31 (2026-06-04) — Agenda-link readiness joiner contract.
 */
import { describe, it, expect } from "vitest";
import {
  buildAgendaLinkReadiness,
  buildAgendaLinkReadinessBatch,
} from "./_lib/agendaLinkReadiness";

describe("v3.31 — buildAgendaLinkReadiness", () => {
  it("Khan math + verified topic → verified deep URL, kid can open", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "khan_academy",
      provider: "khan",
      subject: "math",
      topic: "fractions",
    });
    expect(r.urlConfidence).toBe("verified");
    expect(r.isDeeplink).toBe(true);
    expect(r.url).toContain("/imp-add-and-subtract-fractions");
    // Khan = Reagan Google SSO → tap-and-go.
    expect(r.canKidOpenNow).toBe(true);
    expect(r.readinessLabel).toBe("Reagan can open this");
  });

  it("Khan math + UNVERIFIED topic → subject-root-fallback (no 404)", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "khan_academy",
      provider: "khan",
      subject: "math",
      topic: "some-made-up-topic",
    });
    expect(r.urlConfidence).toBe("subject-root-fallback");
    expect(r.isDeeplink).toBe(true);
    expect(r.url).toBe(
      "https://www.khanacademy.org/math/cc-fifth-grade-math",
    );
  });

  it("IXL is email/password (dad) → grown-up signs in first", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "ixl",
      provider: "ixl",
      subject: "math",
      topic: "fractions",
    });
    expect(r.urlConfidence).toBe("verified");
    expect(r.canKidOpenNow).toBe(false);
    expect(r.readinessLabel).toBe("Grown-up signs in first");
  });

  it("non-Khan/IXL link passes its own URL through untouched", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "merlin",
      url: "https://merlin.allaboutbirds.org/",
    });
    expect(r.urlConfidence).toBe("passthrough");
    expect(r.isDeeplink).toBe(false);
    expect(r.url).toBe("https://merlin.allaboutbirds.org/");
    // Merlin = Reagan Google SSO → tap-and-go.
    expect(r.canKidOpenNow).toBe(true);
  });

  it("class-code app (Blooket) → Reagan can open, uses class code", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "blooket",
      url: "https://blooket.com/",
    });
    expect(r.canKidOpenNow).toBe(true);
    expect(r.readinessLabel).toBe("Reagan can open this");
    expect(r.kidBadge.toLowerCase()).toContain("class code");
  });

  it("NEVER surfaces the blocked ihsd.us email for Reagan", () => {
    // School Gmail row → role 'none', email null, grown-up sign-in.
    const r = buildAgendaLinkReadiness({
      appKey: "ihsd_gmail",
      url: "https://mail.google.com/",
      isReaganView: true,
    });
    // null is the safe outcome; if any email is surfaced it must not be ihsd.us
    if (typeof r.preferredAccountEmail === "string") {
      expect(r.preferredAccountEmail).not.toContain("ihsd.us");
    } else {
      expect(r.preferredAccountEmail).toBeNull();
    }
    expect(r.canKidOpenNow).toBe(false);
  });

  it("provider present but subject missing → passthrough (no bad deep link)", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "khan_academy",
      url: "https://www.khanacademy.org/",
      provider: "khan",
      // no subject
    });
    expect(r.urlConfidence).toBe("passthrough");
    expect(r.isDeeplink).toBe(false);
    expect(r.url).toBe("https://www.khanacademy.org/");
  });

  it("unknown subject string degrades to passthrough", () => {
    const r = buildAgendaLinkReadiness({
      appKey: "khan_academy",
      url: "https://www.khanacademy.org/",
      provider: "khan",
      subject: "art",
    });
    expect(r.urlConfidence).toBe("passthrough");
    expect(r.isDeeplink).toBe(false);
  });

  it("never throws on hostile input", () => {
    expect(() =>
      buildAgendaLinkReadiness({ appKey: undefined as any, url: 42 as any }),
    ).not.toThrow();
  });

  it("batch maps every row and tolerates a non-array", () => {
    const rows = buildAgendaLinkReadinessBatch([
      { appKey: "khan_academy", provider: "khan", subject: "math", topic: "fractions" },
      { appKey: "ixl", provider: "ixl", subject: "math" },
    ]);
    expect(rows.length).toBe(2);
    expect(buildAgendaLinkReadinessBatch(null as any)).toEqual([]);
  });
});
