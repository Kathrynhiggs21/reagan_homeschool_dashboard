import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Canonical design-direction contract for the Glassmorphism ("glass") theme.
 * Katy 2026-07-01: clear · minimal · 3D liquid glass over realistic nature,
 * with two budgies. These assertions pin the pieces that make the theme read
 * as genuine clear glass over a photorealistic scene, so a future edit can't
 * silently regress the look. Pure file-content checks — no DOM/browser needed.
 */
const cssPath = join(__dirname, "..", "client", "src", "index.css");
const css = readFileSync(cssPath, "utf8");

// Isolate the glass-theme rules (including their full bodies) for scoped
// assertions: keep every line from a glass selector through its closing brace.
function extractGlassRules(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let depth = 0;
  let capturing = false;
  for (const line of lines) {
    if (!capturing && line.includes('data-rtheme="glass"')) {
      capturing = true;
    }
    if (capturing) {
      out.push(line);
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (depth <= 0 && line.includes("}")) {
        capturing = false;
        depth = 0;
      }
    }
  }
  return out.join("\n");
}
const glassRules = extractGlassRules(css);

describe("glass theme — canonical clear-3D-glass design contract", () => {
  it("registers glass rules in index.css", () => {
    expect(glassRules.length).toBeGreaterThan(0);
  });

  it("uses a full-bleed photorealistic nature background asset (not a flat gradient only)", () => {
    // The scene layer must reference the generated vibrant nature photo (a
    // fixed full-viewport layer, not a flat gradient). Renamed forest -> vibrant
    // on 2026-07-01 when the background was made brighter + full-cover.
    expect(css).toMatch(/data-rtheme="glass"\][\s\S]{0,400}url\(/);
    expect(css).toContain("glass-bg-vibrant");
  });

  it("renders genuine clear glass: translucent fill + backdrop blur (not opaque cards)", () => {
    expect(glassRules).toMatch(/backdrop-filter:\s*blur\(/);
    // fill opacity should be low (<= 0.2) so the scene shows through
    expect(glassRules).toMatch(/rgba\(255,255,255,0\.1[0-6]\)/);
  });

  it("has a beveled top light-rim + inner specular highlight (3D glass, not flat)", () => {
    expect(glassRules).toMatch(/border-top-color:\s*rgba\(255,255,255,0\.[45]/);
    expect(glassRules).toMatch(/inset/); // inner specular / rim highlights
  });

  it("has a soft realistic drop shadow so panes float above the scene", () => {
    expect(glassRules).toMatch(/box-shadow:[\s\S]{0,200}rgba\(4,10,24,0\.[0-9]+\)/);
  });

  it("styles primary nav as floating clear-glass gem pills with an active glow", () => {
    expect(glassRules).toMatch(/aside nav a\s*\{/);
    expect(glassRules).toMatch(/bg-sidebar-primary[\s\S]{0,300}rgba\(125,211,252/); // active glow
  });

  it("keeps a slim translucent glass top bar treatment", () => {
    expect(glassRules).toMatch(/main >\s*\.sticky|header\.sticky/);
  });

  it("keeps headings legible over the photo (text-shadow scrim)", () => {
    expect(glassRules).toMatch(/h1,[\s\S]{0,120}text-shadow/);
  });

  it("forces hardcoded dark text utilities light so nothing sinks into the glass (NO GREY BOXES)", () => {
    expect(glassRules).toContain(".text-gray-900");
    expect(glassRules).toContain(".text-slate-800");
    expect(glassRules).toContain(".text-foreground");
    // they must resolve to a light color
    expect(glassRules).toMatch(/\.text-foreground\s*\{\s*color:\s*#eef2fb/);
  });
});
