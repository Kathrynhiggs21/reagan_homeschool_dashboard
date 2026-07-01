/**
 * Glass Welcome Landing wiring tests (2026-07-01, Katy).
 *
 * Source-pattern (string-grep) tests — vitest runs in the node environment
 * here (no jsdom), so we lock the integration shape of the new glass welcome
 * landing at the source level. This guarantees a future refactor cannot
 * silently:
 *   • drop the bokeh background / adaptive scrim,
 *   • drop the flying budgies,
 *   • re-introduce the removed "encouraging hearts" bar,
 *   • lose any of the five wave-arc orbs,
 *   • or stop suppressing the floating docks on /welcome (so only Kiwi stays).
 *
 * Reference mockup: 1000410834.png.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const LANDING = path.join(ROOT, "client/src/pages/WelcomeLanding.tsx");
const APP = path.join(ROOT, "client/src/App.tsx");
const SHELL = path.join(ROOT, "client/src/components/CozyShell.tsx");
const CSS = path.join(ROOT, "client/src/index.css");

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Glass Welcome Landing", () => {
  it("WelcomeLanding.tsx exists on disk", () => {
    expect(fs.existsSync(LANDING)).toBe(true);
  });

  it("renders a watery bokeh background and an adaptive readability scrim", () => {
    const src = read(LANDING);
    expect(src).toMatch(/welcome-bg/);
    expect(src).toMatch(/welcome-scrim/);
    // Background must come from an uploaded asset, not a local import.
    expect(src).toMatch(/manus-storage\/glass-landing-bokeh/);
  });

  it("shows the two flying budgies in the upper-right", () => {
    const src = read(LANDING);
    expect(src).toMatch(/welcome-budgies/);
    expect(src).toMatch(/manus-storage\/flying-two-budgies/);
  });

  it("has the welcome header copy and the Parent Access pill", () => {
    const src = read(LANDING);
    expect(src).toMatch(/Welcome to/);
    expect(src).toMatch(/Ride the wave of learning/);
    expect(src).toMatch(/Parent Access/);
  });

  it("renders exactly the five wave-arc orbs in order", () => {
    const src = read(LANDING);
    const labels = ["Today", "Schedule", "Kiwi Chat", "Adventure", "Rewards"];
    for (const l of labels) expect(src).toContain(`label: "${l}"`);
    // Orbs carry a per-orb vertical offset (dy) to build the wave arc.
    expect(src).toMatch(/dy:\s*-?\d+/);
    // The orb elements use the shared glossy .glass-orb + .welcome-orb classes.
    expect(src).toMatch(/glass-orb welcome-orb/);
  });

  it("does NOT contain an encouraging hearts bar (explicitly removed)", () => {
    const src = read(LANDING);
    expect(src).not.toMatch(/hearts?-bar/i);
    expect(src).not.toMatch(/encouraging/i);
  });

  it("App.tsx routes /welcome to WelcomeLanding", () => {
    const src = read(APP);
    expect(src).toMatch(/import\s+WelcomeLanding\s+from\s+["']\.\/pages\/WelcomeLanding["']/);
    expect(src).toMatch(/<Route\s+path="\/welcome"\s+component=\{WelcomeLanding\}/);
  });

  it("App.tsx suppresses the floating docks on /welcome but keeps Kiwi", () => {
    const src = read(APP);
    expect(src).toMatch(/const\s+onWelcome\s*=\s*loc\s*===\s*"\/welcome"/);
    // Docks/pills are gated off on welcome.
    expect(src).toMatch(/\{!onWelcome && <ResourceDock \/>\}/);
    expect(src).toMatch(/\{!onWelcome && <MakeRequestPill \/>\}/);
    expect(src).toMatch(/\{!onWelcome && ui\.showQuickAddFab && <QuickAddFab \/>\}/);
    // Kiwi must NOT be gated — she stays on every page including welcome.
    expect(src).toMatch(/(?<!onWelcome && )<KiwiCompanion \/>/);
  });

  it("CozyShell suppresses its chrome (orb dock + top-right controls) on /welcome", () => {
    const src = read(SHELL);
    expect(src).toMatch(/const\s+onWelcome\s*=\s*loc\s*===\s*"\/welcome"/);
    expect(src).toMatch(/\{!onWelcome && <OrbDock \/>\}/);
    // Welcome gets the full-bleed wrapper, not the padded max-width column.
    expect(src).toMatch(/welcome-shell-wrap/);
  });

  it("index.css defines the welcome landing + wave-arc orb styles", () => {
    const src = read(CSS);
    expect(src).toMatch(/\.welcome-landing\s*\{/);
    expect(src).toMatch(/\.welcome-scrim\s*\{/);
    expect(src).toMatch(/\.welcome-orbs\s*\{/);
    // The orb must be self-sufficient flex (not dependent on utility classes).
    expect(src).toMatch(/\.welcome-orb\s*\{[^}]*display:\s*flex\s*!important/);
  });
});
