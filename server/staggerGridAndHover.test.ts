import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Staggered card layout + interactive hover contract (Katy, 2026-07-02).
 *
 * Katy asked to break the uniform "rows of equal boxes" look with a staggered
 * layout, and to add interactive hover effects. This locks:
 *   1. A reusable `.stagger-grid` / `.stagger-cell` masonry system in index.css
 *      (multi-column + break-inside:avoid + alternating offset).
 *   2. An upgraded glass-card hover (lift + scale + glow) that is pointer-only
 *      and reduced-motion safe, with keyboard-focus parity.
 *   3. The three variable-height content grids actually adopting the system.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const css = read("client/src/index.css");

describe("Staggered masonry grid CSS", () => {
  it("defines a reusable .stagger-grid using multi-column masonry", () => {
    expect(css).toMatch(/\.stagger-grid\s*\{[\s\S]*?column-count/);
  });

  it("bumps column-count responsively (2 then 3 columns)", () => {
    const gridBlock = css.slice(css.indexOf(".stagger-grid"));
    expect(gridBlock).toMatch(/column-count:\s*2/);
    expect(gridBlock).toMatch(/column-count:\s*3/);
  });

  it("keeps each cell whole with break-inside: avoid", () => {
    expect(css).toMatch(/\.stagger-cell[\s\S]*?break-inside:\s*avoid/);
  });

  it("applies an alternating vertical offset so top edges don't line up", () => {
    expect(css).toMatch(/\.stagger-offset[\s\S]*?nth-child\([\s\S]*?margin-top/);
  });
});

describe("Interactive glass-card hover", () => {
  it("gives cards a transition covering transform + box-shadow + filter", () => {
    expect(css).toMatch(/transition:\s*transform[^;]*box-shadow[^;]*filter/);
  });

  it("only lifts on real pointers (hover:hover + pointer:fine)", () => {
    expect(css).toMatch(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
  });

  it("hover applies a lift (translateY) and scale", () => {
    const hoverBlock = css.slice(css.indexOf("@media (hover: hover)"));
    expect(hoverBlock).toMatch(/transform:\s*translateY\(-6px\)\s*scale\(/);
  });

  it("adds an accent glow on hover", () => {
    const hoverBlock = css.slice(css.indexOf("@media (hover: hover)"));
    expect(hoverBlock).toMatch(/rgba\(var\(--scene-accent\)/);
  });

  it("gives keyboard focus the same affordance (focus-within)", () => {
    expect(css).toMatch(/\.card:focus-within[\s\S]*?transform:\s*translateY/);
  });

  it("is reduced-motion safe (no transform lift under reduce)", () => {
    const rm = css.slice(css.lastIndexOf("prefers-reduced-motion"));
    // Somewhere in a reduced-motion block the hover transform is neutralized.
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transform:\s*none/);
  });
});

describe("Pages adopt the staggered system", () => {
  it("IdeaLibrary results use stagger-grid + stagger-cell", () => {
    const p = read("client/src/pages/IdeaLibrary.tsx");
    expect(p).toContain("stagger-grid");
    expect(p).toContain("stagger-cell");
  });

  it("Bookshelf Watch & Learn videos use stagger-grid + stagger-cell", () => {
    const p = read("client/src/pages/Bookshelf.tsx");
    expect(p).toContain("stagger-grid");
    expect(p).toContain("stagger-cell");
  });

  it("PracticeHub concepts use stagger-grid and no longer rely on col-span-3 empty state", () => {
    const p = read("client/src/pages/PracticeHub.tsx");
    expect(p).toContain("stagger-grid");
    expect(p).toContain("stagger-cell");
    expect(p).not.toContain("col-span-3");
  });
});
