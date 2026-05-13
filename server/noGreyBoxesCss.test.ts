import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 18 (2026-05-12): "STANDING RULE — NO GREY BOXES, ANYWHERE" lock.
 *
 * The CSS sweep at index.css ~989-1056 must:
 *   1. Define the warm-surface CSS variables for both the dark
 *      (starry/chalkboard) and light (cream/notebook) themes.
 *   2. Override every Tailwind grey-family surface (bg-muted, bg-slate-*,
 *      bg-gray-*, bg-zinc-*, bg-neutral-*) with the warm surface.
 *   3. Override grey text (text-slate-*, text-gray-*, etc.) with readable ink.
 *   4. Override grey borders (border-slate-200, etc.) with warm edge color.
 *
 * If any of these regress (eg. someone removes the !important or the
 * theme variable block), this test fails loudly so the sweep stays intact.
 */

const CSS = readFileSync(
  path.join(__dirname, "..", "client", "src", "index.css"),
  "utf8",
);

describe("STANDING RULE — NO GREY BOXES (CSS sweep)", () => {
  it("defines warm-surface variables on starry/chalkboard themes", () => {
    expect(CSS).toMatch(/html\[data-rtheme="starry"\][^{]*,?\s*html\[data-rtheme="chalkboard"\][^{]*\{[^}]*--no-grey-surface/s);
  });

  it("defines warm-surface variables on cream/notebook themes", () => {
    expect(CSS).toMatch(/html\[data-rtheme="cream"\][^{]*,?\s*html\[data-rtheme="notebook"\][^{]*\{[^}]*--no-grey-surface/s);
  });

  it("provides a :root fallback so non-themed pages also get warmed", () => {
    expect(CSS).toMatch(/:root\s*\{[^}]*--no-grey-surface/s);
  });

  it("overrides every bg-muted variant", () => {
    expect(CSS).toContain(".bg-muted,");
    expect(CSS).toContain(".bg-muted\\/50");
    // The override must apply the warm surface var.
    expect(CSS).toMatch(/\.bg-muted[\s\S]*?background:\s*var\(--no-grey-surface\)\s*!important/);
  });

  it("overrides bg-slate, bg-gray, bg-zinc, bg-neutral at 50/100/200 levels", () => {
    for (const family of ["slate", "gray", "zinc", "neutral"]) {
      for (const step of ["50", "100", "200"]) {
        expect(CSS).toContain(`.bg-${family}-${step}`);
      }
    }
  });

  it("overrides bg-slate, bg-gray, bg-zinc, bg-neutral at 300/400/500 levels with stronger surface", () => {
    for (const family of ["slate", "gray", "zinc", "neutral"]) {
      for (const step of ["300", "400", "500"]) {
        expect(CSS).toContain(`.bg-${family}-${step}`);
      }
    }
    expect(CSS).toMatch(/\.bg-slate-300[\s\S]*?background:\s*var\(--no-grey-surface-strong\)\s*!important/);
  });

  it("overrides grey text colors so they remain readable", () => {
    for (const family of ["slate", "gray", "zinc", "neutral"]) {
      expect(CSS).toContain(`.text-${family}-400`);
      expect(CSS).toContain(`.text-${family}-500`);
      expect(CSS).toContain(`.text-${family}-600`);
    }
    expect(CSS).toMatch(/\.text-slate-400[\s\S]*?color:\s*var\(--no-grey-ink-soft\)\s*!important/);
  });

  it("overrides grey borders with the warm edge color", () => {
    for (const family of ["slate", "gray", "zinc", "neutral"]) {
      expect(CSS).toContain(`.border-${family}-200`);
      expect(CSS).toContain(`.border-${family}-300`);
    }
    expect(CSS).toMatch(/\.border-slate-200[\s\S]*?border-color:\s*var\(--no-grey-edge\)\s*!important/);
  });

  it("the [data-grey-box] escape hatch ALSO maps to the warm surface", () => {
    expect(CSS).toContain("[data-grey-box]");
    expect(CSS).toMatch(/\[data-grey-box\][\s\S]*?background:\s*var\(--no-grey-surface\)\s*!important/);
  });
});
