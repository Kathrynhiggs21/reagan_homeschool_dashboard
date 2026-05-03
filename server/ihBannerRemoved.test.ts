import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reagan no longer attends Indian Hill (school account dead).
 * The "At Indian Hill this week" banner must not render anywhere kid-facing.
 */
describe("IH this-week banner removed", () => {
  const root = join(__dirname, "..", "client", "src");

  it("IHThisWeekStrip early-returns null", () => {
    const src = readFileSync(join(root, "components", "IHThisWeekStrip.tsx"), "utf8");
    // The early return must come before any other logic in the body.
    const bodyStart = src.indexOf("export default function IHThisWeekStrip()");
    expect(bodyStart).toBeGreaterThan(0);
    const body = src.slice(bodyStart, bodyStart + 600);
    expect(body).toMatch(/return null;/);
  });

  it("SkillBuilderTile no longer renders the IH-this-week pill", () => {
    const src = readFileSync(join(root, "components", "SkillBuilderTile.tsx"), "utf8");
    expect(src).not.toContain("At Indian Hill this week");
    expect(src).not.toContain("_matchedIhWeek");
  });
});
