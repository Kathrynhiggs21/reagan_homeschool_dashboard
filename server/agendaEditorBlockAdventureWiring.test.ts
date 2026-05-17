/**
 * v2.18 (2026-05-17) — BlockAdventurePanel UI wiring vitest.
 *
 * Source-pattern (string-grep) tests on the new client component and
 * its mount site in AgendaEditor.tsx. Locks the contract:
 *   1. BlockAdventurePanel.tsx exists.
 *   2. It short-circuits when adventureId is missing (no panel render).
 *   3. It uses trpc.adventures.get and trpc.adventures.updateMaterials.
 *   4. It invalidates the adventures.get cache on save success.
 *   5. It enforces the 50-cap client-side too (UX parity with server).
 *   6. AgendaEditor imports it and mounts it inside ManualBlockRow,
 *      forwarding `block.adventureId`.
 *   7. The corresponding server procedure is still gated by
 *      familyAdminProcedure (no accidental downgrade).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const PANEL_PATH = path.join(ROOT, "client/src/components/BlockAdventurePanel.tsx");
const AGENDA_EDITOR_PATH = path.join(ROOT, "client/src/pages/AgendaEditor.tsx");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("v2.18 — BlockAdventurePanel UI wiring", () => {
  it("BlockAdventurePanel.tsx exists on disk", () => {
    expect(fs.existsSync(PANEL_PATH)).toBe(true);
  });

  it("panel short-circuits when adventureId is null/undefined", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/if\s*\(\s*!adventureId\s*\)\s*return\s+null/);
  });

  it("panel reads adventure via trpc.adventures.get.useQuery", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.adventures\.get\.useQuery/);
  });

  it("panel writes via trpc.adventures.updateMaterials.useMutation", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.adventures\.updateMaterials\.useMutation/);
  });

  it("panel invalidates adventures.get on successful save", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/utils\.adventures\.get\.invalidate/);
  });

  it("panel enforces the 50-cap client-side (parity with server)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/materials\.length\s*>=\s*50/);
  });

  it("panel surfaces explicit error UI when the get query fails", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/Couldn't load adventure/);
    expect(src).toMatch(/role=\{?"alert"\}?/);
  });

  it("AgendaEditor imports BlockAdventurePanel", () => {
    const src = read(AGENDA_EDITOR_PATH);
    expect(src).toMatch(
      /import\s*\{\s*BlockAdventurePanel\s*\}\s*from\s+["']@\/components\/BlockAdventurePanel["']/,
    );
  });

  it("AgendaEditor mounts the panel inside ManualBlockRow with block.adventureId", () => {
    const src = read(AGENDA_EDITOR_PATH);
    expect(src).toMatch(/<BlockAdventurePanel\s+adventureId=\{[^}]*adventureId[^}]*\}/);
  });

  it("server procedure adventures.updateMaterials remains familyAdmin-gated", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/updateMaterials:\s*familyAdminProcedure/);
  });

  it("panel exposes test ids the QA harness expects", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/block-adventure-panel-\$\{adventureId\}/);
    expect(src).toMatch(/data-testid="adventure-material-input"/);
    expect(src).toMatch(/data-testid="adventure-material-add"/);
    expect(src).toMatch(/data-testid="adventure-material-save"/);
  });
});
