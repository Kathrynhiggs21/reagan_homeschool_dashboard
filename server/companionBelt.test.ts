import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static contract tests for the CompanionBelt + KiwiCompanion wiring.
 *
 * The belt must:
 *   - Render every flock member from FLOCK_MEMBERS as a clickable button
 *   - Persist the active companion via setActiveCompanionId (localStorage)
 *   - Emit "kiwi:active-companion-changed" so KiwiCompanion picks up the change
 *
 * KiwiCompanion must:
 *   - Subscribe to "kiwi:active-companion-changed"
 *   - Render KiwiSprite for kiwi, FlockSprite for the others
 *   - Use speakAs(activeCompanion, ...) when not Kiwi
 *
 * CozyShell must mount the belt under "For Reagan".
 */
describe("Companion belt + KiwiCompanion wiring", () => {
  const root = join(__dirname, "..");
  const belt = readFileSync(join(root, "client/src/components/CompanionBelt.tsx"), "utf8");
  const companion = readFileSync(join(root, "client/src/components/KiwiCompanion.tsx"), "utf8");
  const shell = readFileSync(join(root, "client/src/components/CozyShell.tsx"), "utf8");

  it("CompanionBelt iterates FLOCK_MEMBERS and uses setActiveCompanionId", () => {
    expect(belt).toContain("FLOCK_MEMBERS.map");
    expect(belt).toContain("setActiveCompanionId(");
  });

  it("CompanionBelt is keyboard-accessible (radiogroup + radio roles)", () => {
    expect(belt).toContain('role="radiogroup"');
    expect(belt).toContain('role="radio"');
  });

  it("CompanionBelt subscribes to active-companion change events", () => {
    expect(belt).toContain('"kiwi:active-companion-changed"');
  });

  it("KiwiCompanion subscribes to active-companion changes and uses speakAs", () => {
    expect(companion).toContain("kiwi:active-companion-changed");
    expect(companion).toContain("speakAs(activeCompanion");
    // For Kiwi we keep the original chirp+bird voice, others use companion voice.
    expect(companion).toMatch(/activeCompanion === "kiwi"/);
  });

  it("KiwiCompanion swaps sprite based on active companion", () => {
    expect(companion).toContain("FlockSprite");
    expect(companion).toContain("KiwiSprite");
  });

  it("CozyShell mounts CompanionBelt under For Reagan", () => {
    expect(shell).toContain("CompanionBelt");
    expect(shell).toMatch(/My Flock/);
  });
});
