import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * Regression guards for two fixes shipped 2026-06-18:
 *  1. Reagan's profile avatar must never fall back to the old
 *     "https://example.com/reagan.jpg" placeholder. KiwiContext sanitizes any
 *     placeholder/empty/non-url value to the bundled avatar at init, on the
 *     localStorage self-heal, and when accepting a server photo.
 *  2. The adult QuickAddFab must not sit on top of the kid ResourceDock
 *     (both were pinned bottom-center). QuickAddFab now lives bottom-right.
 */
describe("avatar placeholder sanitizer (KiwiContext)", () => {
  const src = read("client/src/contexts/KiwiContext.tsx");

  it("defines the bundled default avatar", () => {
    expect(src).toContain("/manus-storage/reagan_avatar_d8d25131.png");
  });

  it("has a sanitizePhoto guard that rejects example.com", () => {
    expect(src).toContain("sanitizePhoto");
    expect(src).toContain("example.com");
  });

  it("seeds initial photoUrl through the sanitizer (not raw localStorage)", () => {
    expect(src).toMatch(/useState<string \| null>\(\s*sanitizePhoto\(/);
  });

  it("self-heals a stale localStorage value on load", () => {
    expect(src).toContain('localStorage.getItem("reaganPhotoUrl")');
    expect(src).toMatch(/sanitizePhoto\(cached\)\s*!==\s*cached/);
  });

  it("only accepts a server photo when it passes the sanitizer", () => {
    expect(src).toMatch(/sanitizePhoto\(prof\.photoUrl\)\s*===\s*prof\.photoUrl/);
  });
});

describe("QuickAddFab does not overlap the kid ResourceDock", () => {
  const fab = read("client/src/components/QuickAddFab.tsx");
  const dock = read("client/src/components/ResourceDock.tsx");

  it("ResourceDock stays pinned bottom-center", () => {
    expect(dock).toMatch(/fixed[^"'`]*left-1\/2/);
  });

  it("QuickAddFab is pinned bottom-right, not bottom-center", () => {
    // Look only at the actual className string, not explanatory comments.
    const cls = fab.match(/className="(fixed[^"]*)"/)?.[1] ?? "";
    expect(cls).toContain("fixed");
    expect(cls).toMatch(/right-/);
    // must NOT be center-anchored (the old collision with the dock)
    expect(cls).not.toContain("left-1/2");
  });
});
