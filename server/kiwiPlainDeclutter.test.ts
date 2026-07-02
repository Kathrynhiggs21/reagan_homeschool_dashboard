import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Just Kiwi" declutter contract (Katy, 2026-07-01).
 *
 * Katy asked for Kiwi to be *just Kiwi* — the plain animated budgie on the
 * perch, bottom-right — with none of the surrounding clutter:
 *   - no daily costume (bow / sunglasses / vacation glyphs)
 *   - no dress-up wardrobe layers on the live perch
 *   - no bird props (suitcase / pool / berry / huddle)
 *   - no flock cameos (Lychee / duck squad flying in)
 *   - no drifting feathers, no per-day visit badge, no "Dress me up" tab
 *   - no stray grad-cap BudgieOverlay mounted in the shell
 *
 * The underlying systems stay in the codebase (so situational awareness can be
 * re-enabled later) but must NOT render on the perch. These string-level
 * assertions lock that so a refactor can't quietly bring the clutter back.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const perch = read("client/src/components/KiwiPerch.tsx");
const shell = read("client/src/components/CozyShell.tsx");

describe("KiwiPerch — plain animated Kiwi only", () => {
  it("renders the sprite with no costume and no wardrobe layers", () => {
    expect(perch).toContain('costume="none"');
    expect(perch).toMatch(/wardrobeLayers=\{\[\]\}/);
  });

  it("keeps the sprite animated (animate prop still passed)", () => {
    // The KiwiSprite must still breathe/blink/pose — declutter is about props,
    // not about freezing the bird.
    expect(perch).toMatch(/<KiwiSprite[^>]*\banimate\b/);
  });

  it("does not render bird props, flock cameos, feathers, or the visit badge", () => {
    // Each of these render blocks is guarded off with `false &&` so nothing
    // draws. If a guard is removed, this test fails.
    expect(perch).toMatch(/\{false && activeProp &&/);
    expect(perch).toMatch(/\{false && cameo &&/);
    expect(perch).toMatch(/\{false && feathers\.map/);
    expect(perch).toMatch(/\{false && visitSummary\.total > 0 &&/);
  });

  it("has no on-perch dress-up / closet launcher tab", () => {
    // The "Dress me up" 🧥 launcher tab must be gone from the perch. (The
    // KiwiWardrobe dialog may still exist, but nothing on the perch opens it.)
    expect(perch).not.toContain("Dress me up");
    expect(perch).not.toContain("\u{1F9E5}"); // 🧥
  });
});

describe("CozyShell — no stray grad-cap budgie", () => {
  it("does not mount the BudgieOverlay grad-cap budgie", () => {
    expect(shell).not.toContain("<BudgieOverlay />");
  });
});
