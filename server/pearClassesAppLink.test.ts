import { describe, it, expect } from "vitest";
import { computePearClassesAppLink } from "./_lib/pearClassesAppLink";

/**
 * Push 183 (Wave-15) — Pear Classes / Giant Steps Library appLink helper.
 * Locks every house-rule invariant before the OAuth-consent step happens.
 */
describe("Push 183 — Pear Classes appLink helper", () => {
  it("returns the canonical landing URL and stable key", () => {
    const out = computePearClassesAppLink();
    expect(out.url).toBe("https://support.giantsteps.app/s/my-library");
    expect(out.key).toBe("pear_classes_giant_steps");
    expect(out.label).toBe("Pear Classes");
    expect(out.category).toBe("reading");
    expect(out.signInMethod).toBe("google_sso");
    expect(out.railGroup).toBe("reading_helpers");
  });

  it("locks the allowed identity to spear.cpt@gmail.com", () => {
    const out = computePearClassesAppLink();
    expect(out.allowedAccount).toBe("spear.cpt@gmail.com");
  });

  it("renders 'needs_grownup_signin' when nobody is signed in", () => {
    const out = computePearClassesAppLink({});
    expect(out.consentState).toBe("needs_grownup_signin");
    expect(out.canKidOpenNow).toBe(false);
    expect(out.kidBadge).toBe("Ask a grown-up to set this up");
  });

  it("renders 'needs_grownup_signin' when consent has not been granted yet, even if Mom is signed in", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "spear.cpt@gmail.com",
      oauthConsentGranted: false,
    });
    expect(out.consentState).toBe("needs_grownup_signin");
    expect(out.canKidOpenNow).toBe(false);
  });

  it("renders 'granted' only when Mom is signed in AND consent is granted", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "spear.cpt@gmail.com",
      oauthConsentGranted: true,
    });
    expect(out.consentState).toBe("granted");
    expect(out.canKidOpenNow).toBe(true);
    expect(out.kidBadge).toBe("Open Pear Classes");
  });

  it("treats wrong-but-non-blocked accounts as 'needs_grownup_signin' (not 'blocked')", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "marcy.spear@gmail.com",
      oauthConsentGranted: true,
    });
    expect(out.consentState).toBe("needs_grownup_signin");
    expect(out.canKidOpenNow).toBe(false);
  });

  it("hard-blocks reagan.higgs33@ihsd.us regardless of consent flag", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "reagan.higgs33@ihsd.us",
      oauthConsentGranted: true,
    });
    expect(out.consentState).toBe("blocked");
    expect(out.canKidOpenNow).toBe(false);
  });

  it("normalizes case + whitespace on the signed-in email", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "  Spear.CPT@Gmail.COM  ",
      oauthConsentGranted: true,
    });
    expect(out.consentState).toBe("granted");
  });

  it("hides adult-only details on Reagan view (Don't show if no info rule)", () => {
    const out = computePearClassesAppLink({
      signedInGoogleAccount: "spear.cpt@gmail.com",
      oauthConsentGranted: true,
      isReaganView: true,
    });
    expect(out.adultNote).toBeNull();
    // Kid badge always non-empty so the chip is never a grey-box.
    expect(out.kidBadge.length).toBeGreaterThan(0);
  });

  it("never uses punitive or scolding language in the kid badge", () => {
    const states = [
      computePearClassesAppLink({}),
      computePearClassesAppLink({ signedInGoogleAccount: "spear.cpt@gmail.com" }),
      computePearClassesAppLink({
        signedInGoogleAccount: "spear.cpt@gmail.com",
        oauthConsentGranted: true,
      }),
      computePearClassesAppLink({
        signedInGoogleAccount: "reagan.higgs33@ihsd.us",
        oauthConsentGranted: true,
      }),
    ];
    const banned = ["error", "denied", "blocked", "no", "can't", "cannot", "fail"];
    for (const out of states) {
      const lower = out.kidBadge.toLowerCase();
      for (const word of banned) {
        expect(lower.includes(word)).toBe(false);
      }
    }
  });

  it("sortOrder places the chip after Khan (10) and IXL (20) on the reading rail", () => {
    const out = computePearClassesAppLink();
    expect(out.sortOrder).toBeGreaterThan(20);
    expect(out.sortOrder).toBeLessThan(100);
  });

  it("returns the same shape across all inputs (stable contract for UI)", () => {
    const keys = Object.keys(computePearClassesAppLink()).sort();
    const keysGranted = Object.keys(
      computePearClassesAppLink({
        signedInGoogleAccount: "spear.cpt@gmail.com",
        oauthConsentGranted: true,
      }),
    ).sort();
    expect(keys).toEqual(keysGranted);
  });

  it("never throws on malformed inputs (null, undefined, numbers)", () => {
    expect(() =>
      computePearClassesAppLink({
        signedInGoogleAccount: null as any,
      }),
    ).not.toThrow();
    expect(() =>
      computePearClassesAppLink({
        signedInGoogleAccount: undefined,
        oauthConsentGranted: undefined,
        isReaganView: undefined,
      }),
    ).not.toThrow();
    expect(() =>
      computePearClassesAppLink({
        signedInGoogleAccount: 42 as any,
      }),
    ).not.toThrow();
  });
});
