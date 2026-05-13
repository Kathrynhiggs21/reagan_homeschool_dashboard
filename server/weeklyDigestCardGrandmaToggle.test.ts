/**
 * Push 97 (2026-05-13) — WeeklyDigestCard Grandma toggle wiring contract.
 *
 * Locks that the kid-facing weekly digest preview surface in
 * client/src/components/WeeklyDigestCard.tsx contains:
 *   - a Grandma toggle button with stable test ids
 *   - the mute-banner copy that matches Push 94's grandmaMuteBanner()
 *   - Mom-is-permanent helper text in the header
 *
 * Pure file-content assertions so the contract holds in CI without
 * spinning up the React tree.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FILE = path.resolve(
  __dirname,
  "..",
  "client",
  "src",
  "components",
  "WeeklyDigestCard.tsx",
);

let src = "";
try {
  src = readFileSync(FILE, "utf8");
} catch {
  src = "";
}

describe("Push 97 — WeeklyDigestCard Grandma toggle", () => {
  it("WeeklyDigestCard.tsx exists", () => {
    expect(src.length).toBeGreaterThan(0);
  });

  it("toggle row + button carry stable test ids", () => {
    expect(src).toContain('data-testid="grandma-toggle-row"');
    expect(src).toContain('data-testid="grandma-toggle-btn"');
  });

  it("mute banner copy matches the Push 94 helper's message contract", () => {
    expect(src).toContain('data-testid="grandma-mute-banner"');
    // Same phrasing the helper returns — the UI does not need to share
    // the string at runtime, but they must stay in sync for Mom's UX.
    expect(src).toMatch(/muted for this Sunday/i);
    expect(src).toMatch(/Toggle her back on/i);
  });

  it("header copy says Mom is always on the recipient list", () => {
    expect(src).toMatch(/Mom is always on the recipient list/i);
  });

  it("toggle is uncontrolled by an external prop — local useState default true", () => {
    expect(src).toMatch(/useState\(true\)/);
    expect(src).toMatch(/grandmaEnabled/);
  });

  it("a11y: button has aria-pressed bound to grandmaEnabled", () => {
    expect(src).toMatch(/aria-pressed=\{grandmaEnabled\}/);
  });
});
