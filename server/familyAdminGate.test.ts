/**
 * familyAdminGate — Slice "Mom+Grandma always-edit" (May 11 2026)
 *
 * Mom (spear.cpt@gmail.com) and Grandma Marcy (marcy.spear@gmail.com)
 * MUST pass familyAdminProcedure regardless of their DB-level role,
 * with NO date check, NO approval check, no exceptions.
 *
 * Reagan (student) and viewers MUST be rejected.
 */
import { describe, it, expect } from "vitest";
import { roleForEmail } from "./_lib/permissions";

describe("Family-admin gate: Mom + Grandma always edit", () => {
  it("Mom (spear.cpt@gmail.com) maps to parent role", () => {
    expect(roleForEmail("spear.cpt@gmail.com")).toBe("parent");
  });

  it("Mom is treated case-insensitively", () => {
    expect(roleForEmail("SPEAR.CPT@gmail.com")).toBe("parent");
    expect(roleForEmail("  Spear.Cpt@Gmail.com  ")).toBe("parent");
  });

  it("Grandma Marcy (marcy.spear@gmail.com) maps to editor role", () => {
    expect(roleForEmail("marcy.spear@gmail.com")).toBe("editor");
  });

  it("Reagan (reaganhiggs910@gmail.com) maps to student (NOT family-admin)", () => {
    expect(roleForEmail("reaganhiggs910@gmail.com")).toBe("student");
  });

  it("Random viewer email does not map to family-admin", () => {
    expect(roleForEmail("stranger@example.com")).toBe("viewer");
  });

  it("null/empty email maps to viewer", () => {
    expect(roleForEmail(null)).toBe("viewer");
    expect(roleForEmail("")).toBe("viewer");
    expect(roleForEmail(undefined)).toBe("viewer");
  });

  it("blocked Indian Hill account does NOT grant any edit role", () => {
    // Sanity: the inactive school account is not in any family role bucket.
    expect(roleForEmail("reagan.higgs33@ihsd.us")).toBe("viewer");
  });
});

/**
 * familyAdminProcedure middleware contract — the gate must allow:
 *   1. ctx.user.role === "admin"  (DB admin)
 *   2. ctx.user.role === "tutor"  (DB tutor)
 *   3. familyRole === "parent"    (Mom, Dad)
 *   4. familyRole === "editor"    (Grandma Marcy)
 *   5. familyRole === "tutor"     (placeholder tutor emails)
 *
 * And must reject:
 *   - any user not authenticated
 *   - student / viewer roles whose DB role is also "user"
 *
 * This is a contract test — we re-import the gate's role-resolution logic
 * (the middleware itself is wired through tRPC and can't be invoked
 * standalone without a context shim, so we lock in the role map).
 */
describe("Family-admin gate role allowlist", () => {
  const FAMILY_ADMIN_OK = new Set(["parent", "editor", "tutor"]);

  it("parent passes", () => {
    expect(FAMILY_ADMIN_OK.has(roleForEmail("spear.cpt@gmail.com"))).toBe(true);
  });

  it("editor (Grandma) passes", () => {
    expect(FAMILY_ADMIN_OK.has(roleForEmail("marcy.spear@gmail.com"))).toBe(true);
  });

  it("student (Reagan) is rejected", () => {
    expect(FAMILY_ADMIN_OK.has(roleForEmail("reaganhiggs910@gmail.com"))).toBe(false);
  });

  it("viewer is rejected", () => {
    expect(FAMILY_ADMIN_OK.has(roleForEmail("random@example.com"))).toBe(false);
  });
});
