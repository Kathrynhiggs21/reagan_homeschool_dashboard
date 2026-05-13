/**
 * Push 93 (2026-05-13) — Tutor identity + dual sign-in contract.
 *
 * Locks:
 *   - Canonical roster is exactly Madison, Sophie, Keith.
 *   - Placeholder emails route to *@tbd.local so permissions.roleForEmail
 *     treats them as Editor-tier (see permissions.test.ts).
 *   - Dual sign-in policy: confirmed only when BOTH tutor and family
 *     admin have signed in for the day.
 *   - Unknown tutor names are rejected with `tutor-not-on-roster`.
 */
import { describe, it, expect } from "vitest";
import {
  CANONICAL_TUTORS,
  canonicalTutorEmail,
  isCanonicalTutorName,
  listCanonicalTutorNames,
  evaluateDualSignIn,
} from "./_lib/tutorIdentity";

describe("Push 93 — tutor identity", () => {
  it("CANONICAL_TUTORS is exactly Madison + Sophie + Keith", () => {
    expect(listCanonicalTutorNames()).toEqual(["Madison", "Sophie", "Keith"]);
    expect(CANONICAL_TUTORS).toHaveLength(3);
  });

  it("emails route to @tbd.local placeholders (Editor-tier in permissions)", () => {
    expect(canonicalTutorEmail("Madison")).toBe("madison@tbd.local");
    expect(canonicalTutorEmail("Sophie")).toBe("sophie@tbd.local");
    expect(canonicalTutorEmail("Keith")).toBe("keith@tbd.local");
  });

  it("isCanonicalTutorName accepts roster, rejects anything else", () => {
    expect(isCanonicalTutorName("Madison")).toBe(true);
    expect(isCanonicalTutorName("Sophie")).toBe(true);
    expect(isCanonicalTutorName("Keith")).toBe(true);
    expect(isCanonicalTutorName("madison")).toBe(false); // case-sensitive
    expect(isCanonicalTutorName("Mom")).toBe(false);
    expect(isCanonicalTutorName("")).toBe(false);
    expect(isCanonicalTutorName(null)).toBe(false);
    expect(isCanonicalTutorName(undefined)).toBe(false);
  });

  it("canonicalTutorEmail throws for unknown names", () => {
    expect(() => canonicalTutorEmail("Mom" as any)).toThrow();
  });
});

describe("Push 93 — dual sign-in policy", () => {
  const T_NOW = Date.now();

  it("both signed in → confirmed", () => {
    const r = evaluateDualSignIn({
      tutorName: "Madison",
      tutorSignedInAtMs: T_NOW - 1000,
      familyAdminSignedInAtMs: T_NOW - 500,
    });
    expect(r).toEqual({ ok: true, reason: "confirmed" });
  });

  it("only tutor → needs-family-admin", () => {
    const r = evaluateDualSignIn({
      tutorName: "Sophie",
      tutorSignedInAtMs: T_NOW,
      familyAdminSignedInAtMs: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("needs-family-admin");
  });

  it("only family admin → needs-tutor", () => {
    const r = evaluateDualSignIn({
      tutorName: "Keith",
      tutorSignedInAtMs: null,
      familyAdminSignedInAtMs: T_NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("needs-tutor");
  });

  it("neither → needs-both", () => {
    const r = evaluateDualSignIn({
      tutorName: "Madison",
      tutorSignedInAtMs: null,
      familyAdminSignedInAtMs: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("needs-both");
  });

  it("unknown tutor name short-circuits to tutor-not-on-roster", () => {
    const r = evaluateDualSignIn({
      tutorName: "Maddison",
      tutorSignedInAtMs: T_NOW,
      familyAdminSignedInAtMs: T_NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("tutor-not-on-roster");
  });

  it("null tutor name + both signins still confirmed (open day, no tutor expected)", () => {
    const r = evaluateDualSignIn({
      tutorName: null,
      tutorSignedInAtMs: T_NOW,
      familyAdminSignedInAtMs: T_NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("zero/negative timestamps treated as not-signed-in", () => {
    const r = evaluateDualSignIn({
      tutorName: "Madison",
      tutorSignedInAtMs: 0,
      familyAdminSignedInAtMs: -1,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("needs-both");
  });
});
