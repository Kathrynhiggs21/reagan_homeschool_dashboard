import { describe, it, expect } from "vitest";
import {
  computeAppLinkPlacement,
  __FOR_TEST__,
  type AppLinkSignInTag,
  type SubjectFocus,
} from "./_lib/appLinkPlacementHints";

function tag(
  key: string,
  name: string,
  signInMethod: AppLinkSignInTag["signInMethod"],
  role: AppLinkSignInTag["preferredAccountRole"],
  email: string | null,
): AppLinkSignInTag {
  return {
    key,
    name,
    signInMethod,
    preferredAccountRole: role,
    preferredAccountEmail: email,
    badge: "",
    adultNote: null,
  };
}

function seed(): AppLinkSignInTag[] {
  return [
    tag("khan", "Khan Academy", "google_sso", "mom", "spear.cpt@gmail.com"),
    tag("ixl", "IXL", "google_sso", "mom", "spear.cpt@gmail.com"),
    tag("pear", "Pear Classes", "class_code", "reagan", null),
    tag("brainpop", "BrainPOP", "email_password", "mom", "spear.cpt@gmail.com"),
    tag("vocab", "Vocab.com", "email_password", "mom", "spear.cpt@gmail.com"),
    tag("bookcreator", "Book Creator", "google_sso", "reagan", "reaganhiggs910@gmail.com"),
    tag("canva", "Canva", "google_sso", "reagan", "reaganhiggs910@gmail.com"),
    tag("inaturalist", "iNaturalist", "google_sso", "reagan", "reaganhiggs910@gmail.com"),
    tag("blooket", "Blooket", "email_password", "mom", "spear.cpt@gmail.com"),
    tag("merlin", "Merlin", "google_sso", "reagan", "reaganhiggs910@gmail.com"),
  ];
}

describe("Push 192 — appLinkPlacementHints", () => {
  it("never surfaces an app with the blocked IHSD email", () => {
    const bad = [
      ...seed(),
      tag("ghost", "Ghost App", "google_sso", "reagan", "reagan.higgs33@ihsd.us"),
    ];
    const r = computeAppLinkPlacement(bad, "free_choice");
    expect(r.ordered.find((s) => s.key === "ghost")).toBeUndefined();
  });

  it("reading subject pins pear first, then khan", () => {
    const r = computeAppLinkPlacement(seed(), "reading");
    expect(r.ordered[0].key).toBe("pear");
    expect(r.ordered[0].pinnedForSubject).toBe(true);
    expect(r.ordered[0].pinReason).toContain("primary pick for reading");
    expect(r.ordered[1].key).toBe("khan");
    expect(r.ordered[1].pinReason).toContain("secondary pick for reading");
  });

  it("math subject pins ixl + khan", () => {
    const r = computeAppLinkPlacement(seed(), "math");
    expect(r.ordered[0].key).toBe("ixl");
    expect(r.ordered[1].key).toBe("khan");
  });

  it("writing subject pins bookcreator + vocab", () => {
    const r = computeAppLinkPlacement(seed(), "writing");
    expect(r.ordered[0].key).toBe("bookcreator");
    expect(r.ordered[1].key).toBe("vocab");
  });

  it("science subject pins brainpop + inaturalist", () => {
    const r = computeAppLinkPlacement(seed(), "science");
    expect(r.ordered[0].key).toBe("brainpop");
    expect(r.ordered[1].key).toBe("inaturalist");
  });

  it("art subject pins canva + bookcreator", () => {
    const r = computeAppLinkPlacement(seed(), "art");
    expect(r.ordered[0].key).toBe("canva");
    expect(r.ordered[1].key).toBe("bookcreator");
  });

  it("social_studies subject pins brainpop + khan", () => {
    const r = computeAppLinkPlacement(seed(), "social_studies");
    expect(r.ordered[0].key).toBe("brainpop");
    expect(r.ordered[1].key).toBe("khan");
  });

  it("free_choice has no pins; ordering is alphabetical", () => {
    const r = computeAppLinkPlacement(seed(), "free_choice");
    const names = r.ordered.map((s) => s.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    for (const slot of r.ordered) {
      expect(slot.pinnedForSubject).toBe(false);
      expect(slot.pinReason).toBeNull();
    }
  });

  it("non-pinned apps follow pinned ones in alphabetical order", () => {
    const r = computeAppLinkPlacement(seed(), "reading");
    const rest = r.ordered.slice(2).map((s) => s.name);
    const sortedRest = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sortedRest);
  });

  it("rail position is 1-indexed and strictly increasing", () => {
    const r = computeAppLinkPlacement(seed(), "math");
    for (let i = 0; i < r.ordered.length; i++) {
      expect(r.ordered[i].railPosition).toBe(i + 1);
    }
  });

  it("hero strip is exactly the first 3", () => {
    const r = computeAppLinkPlacement(seed(), "reading");
    expect(r.heroStrip).toHaveLength(3);
    expect(r.heroStrip.map((s) => s.key)).toEqual(
      r.ordered.slice(0, 3).map((s) => s.key),
    );
  });

  it("hero strip caps at the available count when fewer than 3 apps", () => {
    const tiny = [
      tag("pear", "Pear Classes", "class_code", "reagan", null),
      tag("khan", "Khan Academy", "google_sso", "mom", "spear.cpt@gmail.com"),
    ];
    const r = computeAppLinkPlacement(tiny, "reading");
    expect(r.heroStrip).toHaveLength(2);
  });

  it("rail cap is 8; overflow marked + counted", () => {
    const big: AppLinkSignInTag[] = [];
    for (let i = 0; i < 12; i++) {
      big.push(
        tag(`x${i}`, `App ${String.fromCharCode(65 + i)}`, "google_sso", "reagan", "reaganhiggs910@gmail.com"),
      );
    }
    const r = computeAppLinkPlacement(big, "free_choice");
    expect(r.ordered).toHaveLength(12);
    expect(r.ordered.filter((s) => s.overflow)).toHaveLength(4);
    expect(r.overflowCount).toBe(4);
    expect(r.ordered[7].overflow).toBe(false);
    expect(r.ordered[8].overflow).toBe(true);
  });

  it("badge color: class_code => yellow", () => {
    const r = computeAppLinkPlacement(
      [tag("pear", "Pear Classes", "class_code", "reagan", null)],
      "free_choice",
    );
    expect(r.ordered[0].badgeColor).toBe("yellow");
  });

  it("badge color: google_sso + reagan role => green", () => {
    const r = computeAppLinkPlacement(
      [tag("merlin", "Merlin", "google_sso", "reagan", "reaganhiggs910@gmail.com")],
      "free_choice",
    );
    expect(r.ordered[0].badgeColor).toBe("green");
  });

  it("badge color: google_sso + mom role => blue", () => {
    const r = computeAppLinkPlacement(
      [tag("khan", "Khan Academy", "google_sso", "mom", "spear.cpt@gmail.com")],
      "free_choice",
    );
    expect(r.ordered[0].badgeColor).toBe("blue");
  });

  it("badge color: email_password => purple", () => {
    const r = computeAppLinkPlacement(
      [tag("blooket", "Blooket", "email_password", "mom", "spear.cpt@gmail.com")],
      "free_choice",
    );
    expect(r.ordered[0].badgeColor).toBe("purple");
  });

  it("pinned apps that don't exist in the input are skipped silently", () => {
    const missingPins = seed().filter((t) => t.key !== "ixl");
    const r = computeAppLinkPlacement(missingPins, "math");
    expect(r.ordered[0].key).toBe("khan");
    expect(r.ordered[0].pinReason).toContain("secondary pick for math");
  });

  it("subject focus is echoed back unchanged", () => {
    const subjects: SubjectFocus[] = [
      "reading", "math", "writing", "science", "art", "social_studies", "free_choice",
    ];
    for (const s of subjects) {
      const r = computeAppLinkPlacement(seed(), s);
      expect(r.subject).toBe(s);
    }
  });

  it("deterministic — same input ⇒ same output", () => {
    const a = computeAppLinkPlacement(seed(), "reading");
    const b = computeAppLinkPlacement(seed(), "reading");
    expect(a).toEqual(b);
  });

  it("empty input => empty hints", () => {
    const r = computeAppLinkPlacement([], "math");
    expect(r.ordered).toHaveLength(0);
    expect(r.heroStrip).toHaveLength(0);
    expect(r.overflowCount).toBe(0);
  });

  it("BLOCKED_KID_EMAIL + HERO_LIMIT + RAIL_LIMIT constants pin to spec", () => {
    expect(__FOR_TEST__.BLOCKED_KID_EMAIL).toBe("reagan.higgs33@ihsd.us");
    expect(__FOR_TEST__.HERO_LIMIT).toBe(3);
    expect(__FOR_TEST__.RAIL_LIMIT).toBe(8);
  });
});
