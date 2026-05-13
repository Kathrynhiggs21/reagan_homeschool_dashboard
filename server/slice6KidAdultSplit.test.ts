/**
 * Push 64 (2026-05-13) — Slice 6 kid/adult split reconciliation.
 *
 * Slice 6 in todo.md asked for "Reagan marks her own block complete (no
 * adult sign-off for completion; adults still grade)" and "Reagan can
 * drag-reorder her own day; she cannot change start/end times — Mom +
 * Grandma can change ANY field, including start/end (no exceptions)."
 *
 * Both server pieces shipped earlier (Push 43: blocks.selfComplete;
 * Push 55: blocks.selfReorder). This test reconciles the contract:
 *
 *   1. blocks.update is family-admin (Mom + Grandma) and STILL accepts
 *      every field Mom needs — title, status, durationMin, startTime,
 *      blockType, subjectSlug, sortOrder, curriculumTopicId/code.
 *   2. blocks.selfComplete remains a publicProcedure (kid-callable).
 *   3. blocks.selfReorder is on protectedProcedure and never touches
 *      startTime or durationMin (those are adult-only).
 *
 * This file is intentionally a separate guard from
 * reaganSelfComplete.test.ts / reaganSelfReorder.test.ts so we lock the
 * SHAPE of the split, not just each procedure in isolation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Slice 6 kid/adult split — push 64 reconciliation", () => {
  const routers = readFileSync(
    join(__dirname, "routers.ts"),
    "utf8",
  );

  it("blocks.update is family-admin", () => {
    expect(routers).toMatch(/update: familyAdminProcedure\.input\(z\.object\(\{/);
  });

  it("blocks.update accepts every field Mom + Grandma may need to change", () => {
    const idx = routers.indexOf("update: familyAdminProcedure.input(z.object({");
    expect(idx).toBeGreaterThan(0);
    // Take the slice up to the next procedure to lock signature shape.
    const end = routers.indexOf("complete: familyAdminProcedure", idx);
    expect(end).toBeGreaterThan(idx);
    const signature = routers.slice(idx, end);
    for (const field of [
      "title",
      "status",
      "durationMin",
      "startTime",
      "blockType",
      "subjectSlug",
      "sortOrder",
      "curriculumTopicId",
      "curriculumTopicCode",
    ]) {
      expect(signature, `field ${field} missing from blocks.update input`).toContain(`${field}`);
    }
  });

  it("blocks.selfComplete remains a publicProcedure (kid can mark her own block done)", () => {
    expect(routers).toContain("selfComplete: publicProcedure");
  });

  it("blocks.selfReorder remains a protectedProcedure (logged-in, kid-callable)", () => {
    expect(routers).toContain("selfReorder: protectedProcedure");
  });

  it("blocks.selfReorder never writes startTime or durationMin", () => {
    const idx = routers.indexOf("selfReorder: protectedProcedure");
    expect(idx).toBeGreaterThan(0);
    const end = routers.indexOf("delete: familyAdminProcedure", idx);
    expect(end).toBeGreaterThan(idx);
    const body = routers
      .slice(idx, end)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(body).not.toMatch(/startTime\s*:/);
    expect(body).not.toMatch(/durationMin\s*:/);
  });

  it("blocks.move and blocks.reorder (adult-only) stay family-admin", () => {
    expect(routers).toContain("move: familyAdminProcedure");
    expect(routers).toContain("reorder: familyAdminProcedure");
  });
});
