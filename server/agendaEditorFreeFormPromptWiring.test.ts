/**
 * v2.16 (2026-05-17) — AgendaEditor FreeFormPromptPanel wiring tests.
 *
 * Source-pattern (string-grep) tests because vitest is configured for
 * the node environment (no jsdom). Locks the integration shape so the
 * per-decision Accept/Reject UI keeps using the new tRPC procedures
 * and the panel cannot be silently dropped from AgendaEditor.
 *
 * Asserts:
 *  1. FreeFormPromptPanel.tsx exists.
 *  2. It calls trpc.plans.aiPropose (the new free-form propose proc).
 *  3. It calls trpc.plans.aiApplyProposal (commit accepted decisions).
 *  4. It accepts a `date: string` prop and forwards it as { date, ... }.
 *  5. It renders all four decision kinds (keep/modify/remove/add).
 *  6. It exposes a per-decision Accept toggle (Checkbox) and an Apply
 *     button whose count reflects accepted (non-keep) decisions only.
 *  7. AgendaEditor.tsx imports and mounts <FreeFormPromptPanel.
 *  8. routers.ts still exposes plans.aiPropose + plans.aiApplyProposal
 *     gated by familyAdminProcedure (regression guard).
 *  9. Apply mutation invalidates agendaEditor.snapshot for the date.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const PANEL_PATH = path.join(ROOT, "client/src/components/FreeFormPromptPanel.tsx");
const EDITOR_PATH = path.join(ROOT, "client/src/pages/AgendaEditor.tsx");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("v2.16 — FreeFormPromptPanel wiring", () => {
  it("FreeFormPromptPanel.tsx exists on disk", () => {
    expect(fs.existsSync(PANEL_PATH)).toBe(true);
  });

  it("FreeFormPromptPanel calls trpc.plans.aiPropose for proposal generation", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/plans\.aiPropose\.useMutation/);
  });

  it("FreeFormPromptPanel calls trpc.plans.aiApplyProposal to commit accepted decisions", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/plans\.aiApplyProposal\.useMutation/);
  });

  it("FreeFormPromptPanel takes a date prop and sends it on both mutations", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/date\s*:\s*string/);
    // Both mutate calls must include `date`.
    expect(src).toMatch(/proposeM\.mutate\(\s*\{\s*date,/);
    expect(src).toMatch(/applyM\.mutate\(\s*\{\s*date,/);
  });

  it("FreeFormPromptPanel renders all four decision kinds", () => {
    const src = read(PANEL_PATH);
    // Branches in the DiffCard.
    expect(src).toMatch(/d\.kind\s*===\s*"keep"/);
    expect(src).toMatch(/d\.kind\s*===\s*"modify"/);
    expect(src).toMatch(/d\.kind\s*===\s*"remove"/);
    expect(src).toMatch(/d\.kind\s*===\s*"add"/);
  });

  it("FreeFormPromptPanel exposes a per-decision accept toggle via Checkbox", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/from\s+["']@\/components\/ui\/checkbox["']/);
    expect(src).toMatch(/<Checkbox\b/);
    // Test ID for finding the per-decision accept control.
    expect(src).toMatch(/diff-card-accept-/);
  });

  it("FreeFormPromptPanel filters out 'keep' decisions before committing", () => {
    const src = read(PANEL_PATH);
    // Acceptance pipeline should explicitly skip kind === "keep".
    expect(src).toMatch(/d\.kind\s*!==\s*"keep"/);
  });

  it("FreeFormPromptPanel surfaces partial-apply results per decision", () => {
    const src = read(PANEL_PATH);
    // The component must read the per-decision results array from the
    // applyM response and render success/failure on each card.
    expect(src).toMatch(/data\?\.results/);
    expect(src).toMatch(/results\?\.find/);
    expect(src).toMatch(/result\?\.ok/);
  });

  it("FreeFormPromptPanel invalidates agendaEditor.snapshot on apply success", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/agendaEditor\.snapshot\.invalidate/);
  });

  it("FreeFormPromptPanel component file ships at the expected path (mount in AgendaEditor deferred)", () => {
    // v3.28 (2026-06-01): the AgendaEditor was simplified per Mom's
    // homepage cleanup; FreeFormPromptPanel.tsx still ships and the tRPC
    // procedures are still wired, but it is not currently mounted in
    // AgendaEditor.tsx. Re-mounting is a one-line change if the panel
    // becomes useful again.
    const panelSrc = read(PANEL_PATH);
    expect(panelSrc).toMatch(/export\s+function\s+FreeFormPromptPanel/);
    expect(panelSrc).toMatch(/export\s+default\s+FreeFormPromptPanel/);
  });

  it("routers.ts still gates plans.aiPropose + plans.aiApplyProposal with familyAdminProcedure", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/aiPropose:\s*familyAdminProcedure/);
    expect(src).toMatch(/aiApplyProposal:\s*familyAdminProcedure/);
  });
});
