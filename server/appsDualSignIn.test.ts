/**
 * Locks the per-app dual sign-in URL contract used by the Apps page:
 *
 *   - Default tap on the card (Student) wraps the URL with the student's
 *     Google account hint so the right account picker pre-fills.
 *   - The labeled "Parent" chip wraps the same URL with the parent's email
 *     instead.
 *   - Both helpers are pure (no side effects), safe to call with null/empty
 *     emails (returns the URL unchanged), and only rewrite Google /
 *     allowlisted SSO URLs (other URLs returned unchanged).
 */
import { describe, it, expect } from "vitest";
import { withGoogleSsoHint, supportsGoogleSso } from "../client/src/lib/googleAuthLink";

const STUDENT = "reaganhiggs910@gmail.com";
const PARENT = "spear.cpt@gmail.com";

describe("Apps dual sign-in URL contract", () => {
  it("returns the URL unchanged when email is null", () => {
    const u = "https://docs.google.com/spreadsheets/d/123";
    expect(withGoogleSsoHint(u, null)).toBe(u);
    expect(withGoogleSsoHint(u, undefined)).toBe(u);
    expect(withGoogleSsoHint(u, "")).toBe(u);
    expect(withGoogleSsoHint(u, "   ")).toBe(u);
  });

  it("wraps Google URLs with /u/ for the student email", () => {
    const u = "https://docs.google.com/spreadsheets/d/123";
    const wrapped = withGoogleSsoHint(u, STUDENT);
    // Either authuser= (the chooser hint param) or /u/{email}/ is acceptable
    // depending on internal helper choice — both pre-fill the right account.
    expect(
      wrapped.includes(`authuser=${encodeURIComponent(STUDENT)}`) ||
      wrapped.includes(`/u/${encodeURIComponent(STUDENT)}/`),
    ).toBe(true);
  });

  it("wraps Google URLs with /u/ for the parent email (different from student)", () => {
    const u = "https://docs.google.com/spreadsheets/d/123";
    const wrappedStudent = withGoogleSsoHint(u, STUDENT);
    const wrappedParent = withGoogleSsoHint(u, PARENT);
    expect(wrappedParent).not.toBe(wrappedStudent);
    expect(
      wrappedParent.includes(`authuser=${encodeURIComponent(PARENT)}`) ||
      wrappedParent.includes(`/u/${encodeURIComponent(PARENT)}/`),
    ).toBe(true);
  });

  it("returns non-SSO URLs unchanged regardless of email", () => {
    // A plain learning app URL that isn't Google and isn't on the allowlist.
    const u = "https://example-non-sso-site.test/some/path";
    expect(withGoogleSsoHint(u, STUDENT)).toBe(u);
    expect(withGoogleSsoHint(u, PARENT)).toBe(u);
  });

  it("returns malformed URLs unchanged", () => {
    expect(withGoogleSsoHint("not-a-url", STUDENT)).toBe("not-a-url");
  });

  it("supportsGoogleSso identifies Google-hosted URLs", () => {
    expect(supportsGoogleSso("https://docs.google.com/x")).toBe(true);
    expect(supportsGoogleSso("https://classroom.google.com/x")).toBe(true);
    expect(supportsGoogleSso("https://example.test/x")).toBe(false);
  });

  it("dual-identity contract: the same URL produces two distinct wrappers, one per email", () => {
    const u = "https://classroom.google.com/h";
    const s = withGoogleSsoHint(u, STUDENT);
    const p = withGoogleSsoHint(u, PARENT);
    expect(s).not.toBe(p);
    // The wrappers may URL-encode the email; decode before asserting.
    const sDec = decodeURIComponent(s).toLowerCase();
    const pDec = decodeURIComponent(p).toLowerCase();
    expect(sDec.includes(STUDENT.toLowerCase())).toBe(true);
    expect(sDec.includes(PARENT.toLowerCase())).toBe(false);
    expect(pDec.includes(PARENT.toLowerCase())).toBe(true);
    expect(pDec.includes(STUDENT.toLowerCase())).toBe(false);
  });
});
