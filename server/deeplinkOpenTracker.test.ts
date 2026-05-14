/**
 * Push 132 (2026-05-13) — Khan/IXL deeplink open-tracker contract.
 */
import { describe, it, expect } from "vitest";
import { planDeeplinkOpen } from "./_lib/deeplinkOpenTracker";

const REAGAN = "kid_reagan_open_id";
const ADULT = "adult_mom_open_id";

describe("Push 132 — planDeeplinkOpen", () => {
  it("kid school-time open earns 1 coin by default", () => {
    const out = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "math",
      provider: "khan",
      topic: "fractions",
      dateIso: "2026-05-13", // Wednesday
    });
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.coinDelta).toBe(1);
      expect(out.auditTag).toBe("kid-school-open");
      expect(out.url).toContain("khanacademy.org");
      expect(out.url).toContain("fractions");
      expect(out.coinReason).toMatch(/^school-time-open:khan:math$/);
    }
  });

  it("kid weekend open does NOT earn coins (school-time only)", () => {
    const out = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "math",
      provider: "ixl",
      topic: "place-value",
      dateIso: "2026-05-16", // Saturday
    });
    if (out.kind === "ready") {
      expect(out.coinDelta).toBe(0);
      expect(out.auditTag).toBe("kid-out-of-school");
      expect(out.coinReason).toBeNull();
    }
  });

  it("adult open never earns coins (preview/QA tag)", () => {
    const out = planDeeplinkOpen({
      userOpenId: ADULT,
      audienceTier: "adult",
      subject: "ela",
      provider: "ixl",
      dateIso: "2026-05-13",
    });
    if (out.kind === "ready") {
      expect(out.coinDelta).toBe(0);
      expect(out.auditTag).toBe("adult-preview");
    }
  });

  it("openId is deterministic — same inputs produce same id", () => {
    const a = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "math",
      provider: "khan",
      topic: "fractions",
      dateIso: "2026-05-13",
      openSlot: "blk_math",
    });
    const b = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "math",
      provider: "khan",
      topic: "fractions",
      dateIso: "2026-05-13",
      openSlot: "blk_math",
    });
    if (a.kind === "ready" && b.kind === "ready") {
      expect(a.openId).toBe(b.openId);
    }
  });

  it("openId differs across slot / topic / provider / date / kid", () => {
    const base = {
      userOpenId: REAGAN,
      audienceTier: "kid" as const,
      subject: "math" as const,
      provider: "khan" as const,
      topic: "fractions",
      dateIso: "2026-05-13",
      openSlot: "blk_math",
    };
    const baseId = (planDeeplinkOpen(base) as any).openId;

    const variants = [
      { ...base, openSlot: "blk_math_2" },
      { ...base, topic: "decimals" },
      { ...base, provider: "ixl" as const },
      { ...base, dateIso: "2026-05-12" },
      { ...base, userOpenId: "other_kid" },
    ];
    for (const v of variants) {
      const out = planDeeplinkOpen(v);
      if (out.kind === "ready") {
        expect(out.openId).not.toBe(baseId);
      }
    }
  });

  it("blocks on bad date / missing user / non-positive reward / bad subject", () => {
    expect(
      planDeeplinkOpen({
        userOpenId: REAGAN,
        audienceTier: "kid",
        subject: "math",
        provider: "khan",
        dateIso: "2026/05/13",
      }).kind,
    ).toBe("blocked");
    expect(
      planDeeplinkOpen({
        userOpenId: "",
        audienceTier: "kid",
        subject: "math",
        provider: "khan",
        dateIso: "2026-05-13",
      }).kind,
    ).toBe("blocked");
    expect(
      planDeeplinkOpen({
        userOpenId: REAGAN,
        audienceTier: "kid",
        subject: "math",
        provider: "khan",
        dateIso: "2026-05-13",
        schoolTimeOpenCoinReward: 0,
      }).kind,
    ).toBe("blocked");
    expect(
      planDeeplinkOpen({
        userOpenId: REAGAN,
        audienceTier: "kid",
        subject: "art" as any, // unknown
        provider: "khan",
        dateIso: "2026-05-13",
      }).kind,
    ).toBe("blocked");
    expect(
      planDeeplinkOpen({
        userOpenId: REAGAN,
        audienceTier: "kid",
        subject: "math",
        provider: "duo" as any, // unknown
        dateIso: "2026-05-13",
      }).kind,
    ).toBe("blocked");
  });

  it("topic-less open routes to subject root URL (no /undefined leak)", () => {
    const out = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "ela",
      provider: "khan",
      dateIso: "2026-05-13",
    });
    if (out.kind === "ready") {
      expect(out.url).not.toContain("undefined");
      expect(out.url.endsWith("/")).toBe(false);
    }
  });

  it("custom reward respected for school-time kid open", () => {
    const out = planDeeplinkOpen({
      userOpenId: REAGAN,
      audienceTier: "kid",
      subject: "spelling",
      provider: "ixl",
      dateIso: "2026-05-13",
      schoolTimeOpenCoinReward: 3,
    });
    if (out.kind === "ready") {
      expect(out.coinDelta).toBe(3);
    }
  });
});
