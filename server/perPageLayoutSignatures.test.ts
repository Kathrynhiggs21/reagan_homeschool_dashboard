/**
 * Contract test for the per-page layout signatures (Katy 2026-07-02: "give each
 * page a distinct layout"). Each route family gets its own frame treatment via
 * the data-page attribute PageTheme sets on <html>, so pages read as distinct
 * spaces without rewriting the tested page components. This pins the signatures
 * so a future CSS edit can't silently flatten every page back to identical.
 * Pure file-content checks — no DOM/browser needed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cssPath = join(__dirname, "..", "client", "src", "index.css");
const css = readFileSync(cssPath, "utf8");
const pageThemePath = join(__dirname, "..", "client", "src", "components", "PageTheme.tsx");
const pageTheme = readFileSync(pageThemePath, "utf8");

describe("per-page layout signatures", () => {
  it("PageTheme sets a data-page key + per-page accent on <html>", () => {
    expect(pageTheme).toMatch(/setAttribute\("data-page"/);
    expect(pageTheme).toMatch(/--scene-accent/);
  });

  it("renders a distinct accent hero band behind each page title row", () => {
    expect(css).toMatch(/\[data-page\][\s\S]{0,120}\.page-title-row::before/);
  });

  const pages = ["today", "schedule", "books", "apps", "practice", "ideas", "rewards", "curriculum", "settings"];
  for (const p of pages) {
    it(`has a signature rule scoped to data-page="${p}"`, () => {
      expect(css).toContain(`[data-page="${p}"]`);
    });
  }

  it("gives structurally different pages their own frame (not just accents)", () => {
    // Schedule = tighter column + left accent rail
    expect(css).toMatch(/\[data-page="schedule"\][\s\S]{0,200}border-left/);
    // Curriculum = centered narrower document column
    expect(css).toMatch(/\[data-page="curriculum"\][\s\S]{0,200}margin-left:\s*auto/);
    // Books = shelf underline
    expect(css).toMatch(/\[data-page="books"\][\s\S]{0,120}::after/);
    // Apps = hover lift
    expect(css).toMatch(/\[data-page="apps"\][\s\S]{0,160}translateY/);
  });

  it("keeps every signature scoped to the glass theme (default look untouched)", () => {
    // each per-page rule sits under html[data-rtheme="glass"]
    const idx = css.indexOf('[data-page="schedule"]');
    expect(idx).toBeGreaterThan(-1);
    expect(css.slice(Math.max(0, idx - 60), idx)).toMatch(/data-rtheme="glass"/);
  });
});
