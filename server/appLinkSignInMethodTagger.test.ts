import { describe, it, expect } from "vitest";
import { tagAppLinkSignInMethod } from "./_lib/appLinkSignInMethodTagger";

/**
 * Push 184 (Wave-15) — appLink sign-in-method tagger contract.
 */
describe("Push 184 — appLink sign-in-method tagger", () => {
  it("tags Khan Academy as Google SSO with Reagan account", () => {
    const out = tagAppLinkSignInMethod({ appKey: "khan_academy" });
    expect(out.signInMethod).toBe("google_sso");
    expect(out.preferredAccountRole).toBe("reagan");
    expect(out.preferredAccountEmail).toBe("reaganhiggs910@gmail.com");
    expect(out.canKidOpenNow).toBe(true);
  });

  it("tags IXL as email/password with Dad role + null email", () => {
    const out = tagAppLinkSignInMethod({ appKey: "ixl" });
    expect(out.signInMethod).toBe("email_password");
    expect(out.preferredAccountRole).toBe("dad");
    expect(out.preferredAccountEmail).toBeNull();
    expect(out.canKidOpenNow).toBe(false);
  });

  it("tags Blooket as class_code with Reagan role + canKidOpenNow=true", () => {
    const out = tagAppLinkSignInMethod({ appKey: "blooket" });
    expect(out.signInMethod).toBe("class_code");
    expect(out.canKidOpenNow).toBe(true);
    expect(out.kidBadge.toLowerCase()).toContain("class code");
  });

  it("tags Pear Classes as Google SSO with Mom role", () => {
    const out = tagAppLinkSignInMethod({ appKey: "pear_classes_giant_steps" });
    expect(out.signInMethod).toBe("google_sso");
    expect(out.preferredAccountRole).toBe("mom");
    expect(out.preferredAccountEmail).toBe("spear.cpt@gmail.com");
    expect(out.canKidOpenNow).toBe(false);
  });

  it("tags Google Classroom + IHSD Gmail as 'none' role (no ihsd.us leak)", () => {
    for (const key of ["google_classroom", "ihsd_gmail"]) {
      const out = tagAppLinkSignInMethod({ appKey: key });
      expect(out.preferredAccountRole).toBe("none");
      expect(out.preferredAccountEmail).toBeNull();
      expect(out.canKidOpenNow).toBe(false);
    }
  });

  it("falls back to URL host hint when appKey is unknown", () => {
    const out = tagAppLinkSignInMethod({
      appKey: "some_random_key",
      url: "https://www.khanacademy.org/profile/me",
    });
    expect(out.signInMethod).toBe("google_sso");
    expect(out.preferredAccountRole).toBe("reagan");
  });

  it("falls back to name alias when appKey is unknown", () => {
    const out = tagAppLinkSignInMethod({ appKey: "x", name: "Pear Classes" });
    expect(out.preferredAccountRole).toBe("mom");
  });

  it("unknown app defaults to email_password + role=none + canKidOpenNow=false", () => {
    const out = tagAppLinkSignInMethod({
      appKey: "totally_unknown",
      name: "??",
      url: "https://example.com",
    });
    expect(out.signInMethod).toBe("email_password");
    expect(out.preferredAccountRole).toBe("none");
    expect(out.canKidOpenNow).toBe(false);
  });

  it("hides adult-only details on Reagan view", () => {
    const out = tagAppLinkSignInMethod({
      appKey: "khan_academy",
      isReaganView: true,
    });
    expect(out.adultNote).toBeNull();
    expect(out.kidBadge.length).toBeGreaterThan(0);
  });

  it("never returns the blocked reagan.higgs33@ihsd.us email — house rule", () => {
    const reaganApps = [
      "khan_academy", "brainpop", "edpuzzle", "seesaw", "code_org",
      "book_creator", "inaturalist", "merlin", "vocab_com", "canva",
      "blooket", "wayground",
    ];
    for (const key of reaganApps) {
      const out = tagAppLinkSignInMethod({ appKey: key });
      if (out.preferredAccountEmail) {
        expect(out.preferredAccountEmail).not.toBe("reagan.higgs33@ihsd.us");
      }
    }
  });

  it("never uses punitive language in the kid badge", () => {
    const apps = [
      "khan_academy", "ixl", "blooket", "pear_classes_giant_steps",
      "google_classroom", "ihsd_gmail", "totally_unknown",
    ];
    const banned = ["error", "denied", "blocked", "fail", "can't", "cannot"];
    for (const key of apps) {
      const out = tagAppLinkSignInMethod({ appKey: key });
      const lower = out.kidBadge.toLowerCase();
      for (const word of banned) {
        expect(lower.includes(word)).toBe(false);
      }
    }
  });

  it("returns the same shape across all inputs (stable contract for UI)", () => {
    const ref = Object.keys(tagAppLinkSignInMethod({ appKey: "khan_academy" })).sort();
    for (const key of ["ixl", "blooket", "pear_classes_giant_steps", "unknown"]) {
      const k = Object.keys(tagAppLinkSignInMethod({ appKey: key })).sort();
      expect(k).toEqual(ref);
    }
  });

  it("never throws on malformed input (null, undefined, numbers)", () => {
    expect(() => tagAppLinkSignInMethod({ appKey: undefined as any })).not.toThrow();
    expect(() => tagAppLinkSignInMethod({ appKey: 42 as any, name: null, url: null })).not.toThrow();
    expect(() => tagAppLinkSignInMethod({ appKey: "" })).not.toThrow();
  });

  it("aliases 'khan' / 'khanacademy' / 'code.org' to canonical keys", () => {
    expect(tagAppLinkSignInMethod({ appKey: "khan" }).preferredAccountRole).toBe("reagan");
    expect(tagAppLinkSignInMethod({ appKey: "khanacademy" }).preferredAccountRole).toBe("reagan");
    expect(tagAppLinkSignInMethod({ appKey: "code.org" }).preferredAccountRole).toBe("reagan");
  });
});
