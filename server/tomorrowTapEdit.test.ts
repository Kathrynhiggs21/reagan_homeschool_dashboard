import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Push 48 (2026-05-13) — Curriculum hub tap-block inline editor.
 *
 * Source-level contract: the new tRPC query is defined, the front-end
 * editor exists and is mounted inside the tomorrow strip, the editor
 * sends a `blocks.update` patch with only `startTime` and `durationMin`,
 * and the duration is clamped to 5..180 to match the zod schema in
 * `blocks.update` (`z.number().min(1).max(240)` — UI tightens further).
 */
describe("Tomorrow tap-block inline editor (Push 48)", () => {
  const routerSrc = readFileSync(
    resolve(__dirname, "routers.ts"),
    "utf8",
  );
  const pageSrc = readFileSync(
    resolve(__dirname, "..", "client", "src", "pages", "Curriculum.tsx"),
    "utf8",
  );

  it("exposes curriculum.tomorrowBlocks query (sorted)", () => {
    expect(routerSrc).toMatch(/tomorrowBlocks:\s*protectedProcedure\.query/);
    expect(routerSrc).toMatch(/listBlocksForPlan/);
    expect(routerSrc).toMatch(/sortOrder/);
  });

  it("mounts <TomorrowTapEditList /> inside the tomorrow strip", () => {
    expect(pageSrc).toMatch(/TomorrowTapEditList/);
    expect(pageSrc).toMatch(/data-testid="tomorrow-tap-edit"/);
  });

  it("inline editor restricts patch to startTime + durationMin only", () => {
    const idx = pageSrc.indexOf("Push 48");
    expect(idx).toBeGreaterThan(0);
    const slice = pageSrc.slice(idx);
    // It reads tomorrowBlocks.useQuery
    expect(slice).toMatch(/tomorrowBlocks\?\.useQuery/);
    // The mutation surface is blocks.update
    expect(slice).toMatch(/blocks\?\.update\?\.useMutation/);
    // Patch shape: only startTime + durationMin
    expect(slice).toMatch(/startTime\?\s*:\s*string\s*\|\s*null;\s*durationMin\?\s*:\s*number/);
    // No title / status / grade fields leak in
    const editorSlice = slice.slice(0, 4500);
    expect(editorSlice).not.toMatch(/title:\s*string/);
    expect(editorSlice).not.toMatch(/grade:/);
    expect(editorSlice).not.toMatch(/status:\s*['"]/);
  });

  it("clamps duration to 5..180 and validates HH:MM start time before submit", () => {
    const idx = pageSrc.indexOf("Push 48");
    const slice = pageSrc.slice(idx);
    expect(slice).toMatch(/Math\.max\(5,\s*Math\.min\(180,/);
    expect(slice).toMatch(/\^\\d\{1,2\}:\\d\{2\}\$/);
  });

  it("invalidates curriculum.tomorrowBlocks + tomorrowPreview on success", () => {
    const idx = pageSrc.indexOf("Push 48");
    const slice = pageSrc.slice(idx);
    expect(slice).toMatch(/tomorrowBlocks\?\.invalidate/);
    expect(slice).toMatch(/tomorrowPreview\?\.invalidate/);
  });
});
