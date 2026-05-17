/**
 * v2.18 (2026-05-17) — adventures.update + updateMaterials + delete wiring.
 *
 * Source-pattern (string-grep) tests on routers.ts and db.ts to lock:
 *   1. The three new procedures exist and are gated by familyAdminProcedure.
 *   2. Each calls the matching db helper (no inline SQL).
 *   3. The db helpers strip undefined keys and update by primary key.
 *   4. The duration sanity check is enforced server-side.
 *   5. Materials array has a sane upper bound (50 entries) so a typo in
 *      the UI can't try to insert 10k rows of materials.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");
const DB_PATH = path.join(ROOT, "server/db.ts");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("v2.18 — adventures update wiring", () => {
  it("db.ts exports updateAdventure helper", () => {
    const src = read(DB_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+updateAdventure\b/);
  });

  it("db.ts exports updateAdventureMaterials helper", () => {
    const src = read(DB_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+updateAdventureMaterials\b/);
  });

  it("db.ts exports deleteAdventure helper", () => {
    const src = read(DB_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+deleteAdventure\b/);
  });

  it("updateAdventure strips undefined patch keys before .set()", () => {
    const src = read(DB_PATH);
    // The helper must explicitly skip undefined values so Drizzle
    // doesn't try to overwrite columns to NULL.
    expect(src).toMatch(/if\s*\(\s*v\s*!==\s*undefined\s*\)/);
  });

  it("routers.ts exposes adventures.update gated by familyAdminProcedure", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/update:\s*familyAdminProcedure\.input/);
    // Anchor that this is the adventures.update, not e.g. appLinks.update.
    const adventuresSection = src.split(/adventures:\s*router\(/)[1] ?? "";
    expect(adventuresSection).toMatch(/update:\s*familyAdminProcedure/);
  });

  it("routers.ts exposes adventures.updateMaterials gated by familyAdminProcedure", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/updateMaterials:\s*familyAdminProcedure/);
  });

  it("routers.ts exposes adventures.delete gated by familyAdminProcedure", () => {
    const src = read(ROUTERS_PATH);
    const adventuresSection = src.split(/adventures:\s*router\(/)[1] ?? "";
    expect(adventuresSection).toMatch(/delete:\s*familyAdminProcedure/);
  });

  it("adventures.update calls db.updateAdventure (no inline SQL)", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/db\.updateAdventure\(\s*id\s*,\s*patch\s*as any\s*\)/);
  });

  it("adventures.updateMaterials calls db.updateAdventureMaterials", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/db\.updateAdventureMaterials\(\s*input\.id\s*,\s*input\.materials\s*\)/);
  });

  it("adventures.delete calls db.deleteAdventure", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/db\.deleteAdventure\(\s*input\.id\s*\)/);
  });

  it("adventures.update enforces minDurationMin <= maxDurationMin server-side", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(
      /minDurationMin\s+cannot\s+be\s+greater\s+than\s+maxDurationMin/,
    );
  });

  it("adventures.updateMaterials caps the array at 50 entries", () => {
    const src = read(ROUTERS_PATH);
    // The actual code is `materials: z.array(z.string().min(1).max(200)).max(50)`,
    // so we look for `.max(50)` appearing after a `materials:` line.
    const adventuresSection = src.split(/adventures:\s*router\(/)[1] ?? "";
    const updateMatBlock = adventuresSection.split(/updateMaterials:/)[1]?.split(/delete:/)[0] ?? "";
    expect(updateMatBlock).toMatch(/materials:\s*z\.array/);
    expect(updateMatBlock).toMatch(/\.max\(50\)/);
  });

  it("adventures.update accepts every editable column from the schema", () => {
    const src = read(ROUTERS_PATH);
    // Anchor that we forward title/description/materials/instructions/etc.
    const adventuresSection = src.split(/adventures:\s*router\(/)[1] ?? "";
    const updateBlock = adventuresSection.split(/updateMaterials:/)[0];
    expect(updateBlock).toMatch(/title:\s*z\.string\(\)/);
    expect(updateBlock).toMatch(/description:\s*z\.string\(\)/);
    expect(updateBlock).toMatch(/materials:\s*z\.array\(z\.string\(\)\)/);
    expect(updateBlock).toMatch(/instructions:\s*z\.string\(\)/);
    expect(updateBlock).toMatch(/setting:\s*z\.enum/);
    expect(updateBlock).toMatch(/energyLevel:\s*z\.enum/);
    expect(updateBlock).toMatch(/topicTags:\s*z\.array\(z\.string\(\)\)/);
    expect(updateBlock).toMatch(/interestTags:\s*z\.array\(z\.string\(\)\)/);
  });
});
