/**
 * Push 106 (2026-05-13) — Grandma viewer audience contract.
 */
import { describe, it, expect } from "vitest";
import {
  GRANDMA_EMAILS,
  grandmaAudienceFor,
  isGrandmaEmail,
  shouldRenderGrandmaCopy,
} from "./_lib/grandmaAudience";

describe("Push 106 — Grandma viewer audience", () => {
  it("Marcy's email is the canonical Grandma list of one", () => {
    expect([...GRANDMA_EMAILS]).toEqual(["marcy.spear@gmail.com"]);
  });

  it("isGrandmaEmail is case-insensitive and trims", () => {
    expect(isGrandmaEmail("marcy.spear@gmail.com")).toBe(true);
    expect(isGrandmaEmail("  Marcy.Spear@GMAIL.com  ")).toBe(true);
    expect(isGrandmaEmail("MARCY.spear@gmail.com")).toBe(true);
  });

  it("isGrandmaEmail returns false for everyone else (Mom, Dad, Reagan, tutors, viewers)", () => {
    for (const e of [
      "spear.cpt@gmail.com",
      "blakehiggs@hotmail.com",
      "reaganhiggs910@gmail.com",
      "madison@tbd.local",
      "random@example.com",
      "",
      null,
      undefined,
    ]) {
      expect(isGrandmaEmail(e as any)).toBe(false);
    }
  });

  it("grandmaAudienceFor surfaces Grandma + digest + recap recipients flags", () => {
    const r = grandmaAudienceFor("marcy.spear@gmail.com");
    expect(r.audience).toBe("grandma");
    expect(r.email).toBe("marcy.spear@gmail.com");
    expect(r.homeRole).toBe("editor");
    expect(r.isDigestRecipient).toBe(true);
    expect(r.isRecapEmailRecipient).toBe(true);
  });

  it("Mom is not-grandma but still the primary parent in the home matrix", () => {
    const r = grandmaAudienceFor("spear.cpt@gmail.com");
    expect(r.audience).toBe("not-grandma");
    expect(r.homeRole).toBe("parent");
    expect(r.isDigestRecipient).toBe(false);
    expect(r.isRecapEmailRecipient).toBe(false);
  });

  it("Reagan is not-grandma and is student in home matrix", () => {
    const r = grandmaAudienceFor("reaganhiggs910@gmail.com");
    expect(r.audience).toBe("not-grandma");
    expect(r.homeRole).toBe("student");
    expect(r.isDigestRecipient).toBe(false);
  });

  it("null/empty email falls through to not-grandma + viewer", () => {
    const r = grandmaAudienceFor(null);
    expect(r.audience).toBe("not-grandma");
    expect(r.email).toBeNull();
    expect(r.homeRole).toBe("viewer");
  });

  it("shouldRenderGrandmaCopy gates Grandma-specific UI surfaces", () => {
    expect(shouldRenderGrandmaCopy("marcy.spear@gmail.com")).toBe(true);
    expect(shouldRenderGrandmaCopy("spear.cpt@gmail.com")).toBe(false);
    expect(shouldRenderGrandmaCopy(null)).toBe(false);
  });

  it("non-string email types are rejected (defense)", () => {
    for (const v of [123, {}, [], true]) {
      expect(isGrandmaEmail(v as any)).toBe(false);
    }
  });
});
