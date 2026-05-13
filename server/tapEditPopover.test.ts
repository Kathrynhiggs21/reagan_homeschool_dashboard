/**
 * Push 87 (2026-05-13) — Tap-block inline edit contract.
 *
 * Locks:
 *   1. New procedure blocks.canInlineEdit exists, is a public query, and
 *      mirrors familyAdminProcedure's role gate.
 *   2. blocks.update remains familyAdminProcedure (defense-in-depth — kid
 *      can never write times even if she pokes the UI gate).
 *   3. TapEditPopover component file exists, gates on canInlineEdit, only
 *      patches startTime + durationMin (never title/description/status).
 *   4. Today.tsx imports and mounts TapEditPopover on the block row.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTERS_SRC = readFileSync(join(ROOT, "server", "routers.ts"), "utf8");
const POPOVER_SRC = readFileSync(
  join(ROOT, "client", "src", "components", "TapEditPopover.tsx"),
  "utf8",
);
const TODAY_SRC = readFileSync(
  join(ROOT, "client", "src", "pages", "Today.tsx"),
  "utf8",
);

describe("Push 87 — tap-block inline edit contract", () => {
  it("registers blocks.canInlineEdit as a public query mirroring familyAdmin gate", () => {
    // Procedure body, not just any mention.
    expect(ROUTERS_SRC).toMatch(/canInlineEdit:\s*publicProcedure\.query/);
    // Mirrors familyAdminProcedure logic: dbRoleOk admin/tutor, familyOk parent/editor/tutor.
    const slice = ROUTERS_SRC.slice(
      ROUTERS_SRC.indexOf("canInlineEdit"),
      ROUTERS_SRC.indexOf("canInlineEdit") + 600,
    );
    expect(slice).toContain("admin");
    expect(slice).toContain("tutor");
    expect(slice).toContain("parent");
    expect(slice).toContain("editor");
    expect(slice).toMatch(/allowed/);
  });

  it("keeps blocks.update behind familyAdminProcedure (defense-in-depth)", () => {
    expect(ROUTERS_SRC).toMatch(/\n\s*update:\s*familyAdminProcedure\.input/);
  });

  it("TapEditPopover queries canInlineEdit and hides when !allowed", () => {
    expect(POPOVER_SRC).toContain("trpc.blocks.canInlineEdit.useQuery()");
    expect(POPOVER_SRC).toMatch(/if\s*\(\s*!gate\?\.allowed\s*\)\s*return null/);
  });

  it("TapEditPopover patch object only carries startTime and durationMin", () => {
    // Build the patch literal — look for the exact shape declaration.
    expect(POPOVER_SRC).toMatch(
      /patch:\s*\{[^}]*id:\s*number[^}]*startTime\?:[^}]*durationMin\?:/,
    );
    // Explicitly assert: no title / description / status / grade in popover.
    for (const field of ["title", "description", "status", "grade", "subjectSlug"]) {
      expect(POPOVER_SRC).not.toContain(`patch.${field}`);
    }
  });

  it("TapEditPopover invalidates today coverage after save", () => {
    expect(POPOVER_SRC).toContain("utils.today.coverageWithActuals.invalidate");
    expect(POPOVER_SRC).toContain("utils.blocks.list.invalidate");
  });

  it("Today.tsx imports and mounts TapEditPopover on the block row", () => {
    expect(TODAY_SRC).toContain('from "@/components/TapEditPopover"');
    expect(TODAY_SRC).toMatch(/<TapEditPopover[\s\S]*blockId=\{b\.id\}/);
    // Mounted near time-chip line so adults see it next to the time.
    const timeChipIdx = TODAY_SRC.indexOf("time-chip-v2");
    const tapEditIdx = TODAY_SRC.indexOf("<TapEditPopover");
    expect(timeChipIdx).toBeGreaterThan(-1);
    expect(tapEditIdx).toBeGreaterThan(timeChipIdx);
    expect(tapEditIdx - timeChipIdx).toBeLessThan(500);
  });

  it("popover never writes status:complete (locked separation from blocks.complete)", () => {
    expect(POPOVER_SRC).not.toContain('"complete"');
    expect(POPOVER_SRC).not.toContain("status:");
  });
});
