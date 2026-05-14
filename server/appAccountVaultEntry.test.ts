import { describe, it, expect } from "vitest";
import {
  buildAppAccountVaultEntry,
  __FOR_TEST__,
  type AppLinkSignInTag,
} from "./_lib/appAccountVaultEntry";

const idEncrypt = (p: string) => `enc(${p})`;

function baseTag(over: Partial<AppLinkSignInTag> = {}): AppLinkSignInTag {
  return {
    key: "khan",
    name: "Khan Academy",
    signInMethod: "google_sso",
    preferredAccountRole: "reagan",
    preferredAccountEmail: "reaganhiggs910@gmail.com",
    badge: "Khan Academy — Reagan's account",
    adultNote: null,
    ...over,
  };
}

describe("Push 186 — appAccountVaultEntry pure helper", () => {
  it("returns null on empty plaintext", () => {
    expect(
      buildAppAccountVaultEntry({
        tag: baseTag(),
        plaintext: "",
        encrypt: idEncrypt,
        nowIso: "2026-05-14T20:00:00Z",
      })
    ).toBeNull();
  });

  it("returns null on whitespace-only plaintext", () => {
    expect(
      buildAppAccountVaultEntry({
        tag: baseTag(),
        plaintext: "   \t  \n",
        encrypt: idEncrypt,
        nowIso: "2026-05-14T20:00:00Z",
      })
    ).toBeNull();
  });

  it("hard-blocks reagan.higgs33@ihsd.us — returns null even with valid plaintext", () => {
    const tag = baseTag({
      preferredAccountEmail: "reagan.higgs33@ihsd.us",
      preferredAccountRole: "reagan",
    });
    expect(
      buildAppAccountVaultEntry({
        tag,
        plaintext: "hunter2",
        encrypt: idEncrypt,
        nowIso: "2026-05-14T20:00:00Z",
      })
    ).toBeNull();
  });

  it("kid-managed (reagan) row: visibleToReagan=true, rotateDays=null even for google_sso", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({ signInMethod: "google_sso", preferredAccountRole: "reagan" }),
      plaintext: "p4ssw0rd!",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r).not.toBeNull();
    expect(r.visibleToReagan).toBe(true);
    expect(r.rotateDays).toBeNull();
    expect(r.ownerRole).toBe("reagan");
    expect(r.ownerEmail).toBe("reaganhiggs910@gmail.com");
  });

  it("Mom google_sso row: visibleToReagan=false, rotateDays=90", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        preferredAccountRole: "mom",
        preferredAccountEmail: "spear.cpt@gmail.com",
        badge: "Khan Academy — Mom's account",
      }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.visibleToReagan).toBe(false);
    expect(r.rotateDays).toBe(90);
    expect(r.ownerRole).toBe("mom");
    expect(r.ownerEmail).toBe("spear.cpt@gmail.com");
  });

  it("Grandma email_password row: visibleToReagan=false, rotateDays=180", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        signInMethod: "email_password",
        preferredAccountRole: "grandma",
        preferredAccountEmail: "marcy.spear@gmail.com",
        badge: "Edpuzzle — Grandma's account",
        name: "Edpuzzle",
        key: "edpuzzle",
      }),
      plaintext: "x",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.rotateDays).toBe(180);
    expect(r.visibleToReagan).toBe(false);
    expect(r.ownerRole).toBe("grandma");
  });

  it("class_code rows are never rotated by us (rotateDays=null)", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        signInMethod: "class_code",
        preferredAccountRole: "mom",
        preferredAccountEmail: null,
        badge: "Prodigy — Mom's account",
        name: "Prodigy",
        key: "prodigy",
      }),
      plaintext: "ABCD12",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.rotateDays).toBeNull();
  });

  it("Dad row (no email yet): visibleToReagan=false, ownerEmail=null, rotateDays=90 for google_sso", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        preferredAccountRole: "dad",
        preferredAccountEmail: null,
        badge: "Khan Academy — Dad's account",
      }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.ownerEmail).toBeNull();
    expect(r.visibleToReagan).toBe(false);
    expect(r.rotateDays).toBe(90);
  });

  it("reagan role with null email is sanitized to reaganhiggs910@gmail.com", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({ preferredAccountRole: "reagan", preferredAccountEmail: null }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.ownerEmail).toBe("reaganhiggs910@gmail.com");
  });

  it("kidSafeLabel drops the em-dash role suffix", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        preferredAccountRole: "mom",
        preferredAccountEmail: "spear.cpt@gmail.com",
        badge: "Pear Classes — Mom's account",
        name: "Pear Classes",
        key: "pear_classes",
      }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.kidSafeLabel).toBe("Pear Classes");
  });

  it("kidSafeLabel handles ASCII '-' fallback too", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        preferredAccountRole: "mom",
        preferredAccountEmail: "spear.cpt@gmail.com",
        badge: "Code.org - Mom's account",
        name: "Code.org",
        key: "code_org",
      }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.kidSafeLabel).toBe("Code.org");
  });

  it("secretCiphertext is whatever encrypt() returned (helper stays pure)", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({ preferredAccountRole: "mom", preferredAccountEmail: "spear.cpt@gmail.com" }),
      plaintext: "hunter2",
      encrypt: (p) => `CIPHER:${p.split("").reverse().join("")}`,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.secretCiphertext).toBe("CIPHER:2retnuh");
  });

  it("returns null if encrypt() returns empty string", () => {
    expect(
      buildAppAccountVaultEntry({
        tag: baseTag({ preferredAccountRole: "mom", preferredAccountEmail: "spear.cpt@gmail.com" }),
        plaintext: "p",
        encrypt: () => "",
        nowIso: "2026-05-14T20:00:00Z",
      })
    ).toBeNull();
  });

  it("createdAtIso uses injected nowIso for determinism", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({ preferredAccountRole: "mom", preferredAccountEmail: "spear.cpt@gmail.com" }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.createdAtIso).toBe("2026-05-14T20:00:00Z");
  });

  it("adultNote names the role correctly", () => {
    const r = buildAppAccountVaultEntry({
      tag: baseTag({
        preferredAccountRole: "grandma",
        preferredAccountEmail: "marcy.spear@gmail.com",
        signInMethod: "email_password",
      }),
      plaintext: "p",
      encrypt: idEncrypt,
      nowIso: "2026-05-14T20:00:00Z",
    })!;
    expect(r.adultNote).toContain("Grandma");
    expect(r.adultNote).toContain("email password");
  });

  it("rotateDaysFor honours kid-override regardless of method", () => {
    expect(__FOR_TEST__.rotateDaysFor("reagan", "google_sso")).toBeNull();
    expect(__FOR_TEST__.rotateDaysFor("reagan", "email_password")).toBeNull();
    expect(__FOR_TEST__.rotateDaysFor("reagan", "class_code")).toBeNull();
    expect(__FOR_TEST__.rotateDaysFor("mom", "google_sso")).toBe(90);
    expect(__FOR_TEST__.rotateDaysFor("mom", "email_password")).toBe(180);
    expect(__FOR_TEST__.rotateDaysFor("mom", "class_code")).toBeNull();
  });

  it("dropRoleSuffix handles plain (no suffix) badges", () => {
    expect(__FOR_TEST__.dropRoleSuffix("Khan Academy")).toBe("Khan Academy");
  });
});
