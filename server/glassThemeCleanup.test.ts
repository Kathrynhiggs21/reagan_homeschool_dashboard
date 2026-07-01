import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Post-audit cleanup guards (2026-07-01).
 *
 * 1. The runtime theme provider is hard-pinned to data-rtheme="glass".
 *    All legacy-theme CSS (chalkboard/galaxy/sunshine/white/cream/notebook/
 *    starry) was pruned as dead code. This test fails if any of those
 *    selectors ever reappear in the shipped stylesheet.
 *
 * 2. Reagan's custom background (data-rbg="color"|"image") must NEVER be able
 *    to flatten the live scene photo under the canonical glass theme. Both
 *    override rules must carry the :not([data-rtheme="glass"]) guard.
 */

const CSS_PATH = join(__dirname, "..", "client", "src", "index.css");
const css = readFileSync(CSS_PATH, "utf-8");

const DEAD_THEMES = [
  "chalkboard",
  "galaxy",
  "sunshine",
  "white",
  "cream",
  "notebook",
  "starry",
] as const;

describe("glass-only theme cleanup", () => {
  it("ships zero legacy-theme selectors in index.css", () => {
    for (const theme of DEAD_THEMES) {
      const needle = `data-rtheme="${theme}"`;
      expect(
        css.includes(needle),
        `legacy theme selector ${needle} should have been pruned`,
      ).toBe(false);
    }
  });

  it("still ships the canonical glass theme selectors", () => {
    expect(css.includes('data-rtheme="glass"')).toBe(true);
    // A meaningful number of glass rules must survive the prune.
    const glassCount = (css.match(/data-rtheme="glass"/g) ?? []).length;
    expect(glassCount).toBeGreaterThan(20);
  });

  it("has balanced braces after pruning (no orphaned blocks)", () => {
    const open = (css.match(/\{/g) ?? []).length;
    const close = (css.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });
});

describe("custom background cannot flatten the glass scene", () => {
  it("guards the data-rbg=color override with :not([data-rtheme=\"glass\"])", () => {
    // The color override rule must be scoped so it is inert under glass.
    const rule = css.match(/html\[data-rbg="color"\][^\{]*\{/);
    expect(rule, "data-rbg=color body rule must exist").not.toBeNull();
    expect(
      rule![0].includes(':not([data-rtheme="glass"])'),
      "data-rbg=color rule must exclude the glass theme",
    ).toBe(true);
  });

  it("guards the data-rbg=image override with :not([data-rtheme=\"glass\"])", () => {
    const rule = css.match(/html\[data-rbg="image"\][^\{]*\{/);
    expect(rule, "data-rbg=image body rule must exist").not.toBeNull();
    expect(
      rule![0].includes(':not([data-rtheme="glass"])'),
      "data-rbg=image rule must exclude the glass theme",
    ).toBe(true);
  });

  it("does not leave an unguarded html[data-rbg=...] body background rule", () => {
    // Every data-rbg body override must carry the glass guard.
    const overrides = css.match(/html\[data-rbg="(?:color|image)"\][^\{]*\{/g) ?? [];
    expect(overrides.length).toBeGreaterThanOrEqual(2);
    for (const o of overrides) {
      expect(
        o.includes(':not([data-rtheme="glass"])'),
        `custom-bg override "${o.trim()}" must exclude glass`,
      ).toBe(true);
    }
  });
});
