/**
 * v2.37 (2026-05-18) — Contract lock for the BlockAdventurePanel slice.
 *
 * The full slice (server `adventures.updateMaterials` familyAdminProcedure +
 * `BlockAdventurePanel` component + AgendaEditor mount) shipped earlier in
 * Push v2.18. This file locks the contract so a future refactor that drops
 * any of the moving parts trips a red test instead of silently regressing
 * Mom + Grandma's ability to edit adventure materials from inside the
 * AgendaEditor block row.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const PANEL_PATH = resolve(ROOT, "client/src/components/BlockAdventurePanel.tsx");
const AGENDA_EDITOR_PATH = resolve(ROOT, "client/src/pages/AgendaEditor.tsx");
const ROUTERS_PATH = resolve(ROOT, "server/routers.ts");

const panel = readFileSync(PANEL_PATH, "utf8");
const agendaEditor = readFileSync(AGENDA_EDITOR_PATH, "utf8");
const routers = readFileSync(ROUTERS_PATH, "utf8");

describe("v2.37 BlockAdventurePanel contract", () => {
  it("BlockAdventurePanel.tsx exists on disk", () => {
    expect(existsSync(PANEL_PATH)).toBe(true);
  });

  it("Panel reads via trpc.adventures.get.useQuery", () => {
    expect(panel).toMatch(/trpc\.adventures\.get\.useQuery/);
  });

  it("Panel mutates via trpc.adventures.updateMaterials.useMutation", () => {
    expect(panel).toMatch(/trpc\.adventures\.updateMaterials\.useMutation/);
  });

  it("Panel short-circuits to null when no adventureId is provided", () => {
    expect(panel).toMatch(/if\s*\(!adventureId\)\s*return\s+null/);
  });

  it("Panel invalidates the adventures.get cache after a successful save", () => {
    expect(panel).toMatch(/utils\.adventures\.get\.invalidate/);
  });

  it("Panel enforces the 50-material server cap client-side", () => {
    expect(panel).toMatch(/materials\.length\s*>=\s*50/);
  });

  it("Panel exposes the full add/remove/save UX with stable test ids", () => {
    expect(panel).toMatch(/data-testid="adventure-material-input"/);
    expect(panel).toMatch(/data-testid="adventure-material-add"/);
    expect(panel).toMatch(/data-testid="adventure-material-save"/);
    expect(panel).toMatch(/data-testid={`adventure-material-remove-/);
  });

  it("Panel surfaces explicit loading + error states (not silent fail)", () => {
    expect(panel).toMatch(/Loading\u2026|Loading…/);
    expect(panel).toMatch(/role="alert"/);
    expect(panel).toMatch(/Couldn't load adventure/);
  });

  it("Panel tracks dirty state with Save + Reset buttons", () => {
    expect(panel).toMatch(/dirty/);
    expect(panel).toMatch(/Reset/);
    expect(panel).toMatch(/disabled=\{!dirty/);
  });

  it("AgendaEditor imports BlockAdventurePanel from @/components", () => {
    expect(agendaEditor).toMatch(
      /import\s*\{\s*BlockAdventurePanel\s*\}\s*from\s*"@\/components\/BlockAdventurePanel"/,
    );
  });

  it("AgendaEditor mounts BlockAdventurePanel keyed off block.adventureId", () => {
    expect(agendaEditor).toMatch(
      /<BlockAdventurePanel\s+adventureId={\(block as any\)\.adventureId\s*\?\?\s*null}/,
    );
  });

  it("Server routers.ts exposes adventures.updateMaterials gated by familyAdminProcedure", () => {
    // The procedure signature lives on a single line: `updateMaterials: familyAdminProcedure.input(...)`.
    expect(routers).toMatch(/updateMaterials:\s*familyAdminProcedure\.input\(z\.object\(\{/);
  });

  it("Server caps materials at 50 strings × 200 chars each (defense-in-depth)", () => {
    // Same line continues with the input shape.
    expect(routers).toMatch(/materials:\s*z\.array\(z\.string\(\)\.min\(1\)\.max\(200\)\)\.max\(50\)/);
  });

  it("Server adventures.get is reachable so the panel can read materials", () => {
    expect(routers).toMatch(/get:\s*publicProcedure\.input\(z\.object\(\{\s*id:\s*z\.number\(\)\s*\}\)\)\.query\(\(\{\s*input\s*\}\)\s*=>\s*db\.getAdventure/);
  });

  it("Panel calls updateMaterials with the strict { id, materials } payload (matches server zod)", () => {
    expect(panel).toMatch(
      /updateMaterials\.mutateAsync\(\{\s*id:\s*adventureId,\s*materials:\s*draft!\s*\}\)/,
    );
  });
});
