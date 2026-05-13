import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Push 25 (2026-05-12) — Phase 4 follow-up audit.
 *
 * Locks down three already-implemented items in todo Phase 4 + EXPANDED
 * Phase 1 so they don't regress:
 *
 * 1. Prize ladder seed stays at ≤10 rungs (Mom: "keep ~10 rungs max").
 * 2. knowledgeBundle helper exists, loads files at boot, and is wired
 *    into aiScheduleGenerator.
 * 3. Curriculum.tsx / AI Assistant surfaces have no "Paste an email/doc"
 *    extraction box and no "Auto-Sync Sources" stub.
 */

const ROOT = resolve(__dirname, "..");

function read(rel: string): string {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

describe("Phase 4 follow-up — contract (push 25)", () => {
  it("seedDefaultPrizesIfEmpty contains ≤10 rungs", () => {
    const src = read("server/db.ts");
    const block = src.match(/seedDefaultPrizesIfEmpty[\s\S]*?const defaults = \[([\s\S]*?)\];/);
    expect(block, "must find seed block").not.toBeNull();
    if (block) {
      // Count slug entries (one per rung).
      const slugMatches = block[1].match(/slug:\s*"/g) ?? [];
      expect(slugMatches.length).toBeGreaterThan(0);
      expect(slugMatches.length).toBeLessThanOrEqual(10);
    }
  });

  it("knowledgeBundle helper file exists with loadKnowledgeBundle export", () => {
    const src = read("server/_lib/knowledgeBundle.ts");
    expect(src.length).toBeGreaterThan(200);
    expect(src).toMatch(/export\s+function\s+loadKnowledgeBundle/);
  });

  it("knowledgeBundle is wired into aiScheduleGenerator", () => {
    const src = read("server/_lib/aiScheduleGenerator.ts");
    expect(src).toMatch(/loadKnowledgeBundle/);
    expect(src).toMatch(/from\s+["']\.\/knowledgeBundle["']/);
  });

  it("knowledge directory contains the 5 source files Mom uploaded", () => {
    for (const fname of [
      "server/_knowledge/q4_standards.txt",
      "server/_knowledge/hs_catalog.txt",
      "server/_knowledge/scope_sequence.md",
      "server/_knowledge/iep_snapshot.md",
      "server/_knowledge/assignment_tracker.csv",
    ]) {
      expect(existsSync(resolve(ROOT, fname)), `missing ${fname}`).toBe(true);
    }
  });

  it("Curriculum.tsx has no 'Paste an email/doc' extraction box", () => {
    const src = read("client/src/pages/Curriculum.tsx");
    if (!src) return;
    expect(src).not.toMatch(/Paste an email\b/i);
    expect(src).not.toMatch(/Paste a doc\b/i);
    expect(src).not.toMatch(/Auto[-\s]?Sync Sources?/i);
  });

  it("Settings.tsx has no 'Auto-Sync Sources' stub", () => {
    const src = read("client/src/pages/Settings.tsx");
    if (!src) return;
    expect(src).not.toMatch(/Auto[-\s]?Sync Sources?/i);
  });
});
