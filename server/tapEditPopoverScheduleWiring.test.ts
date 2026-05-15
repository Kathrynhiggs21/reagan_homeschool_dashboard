/**
 * May 15, 2026 — Schedule.tsx TapEditPopover wire-up contract.
 *
 * Phase 2 of the AI Agenda Editor edits push: tap-block inline start/duration
 * edit must also appear on the Schedule page (not just Today). Push 87
 * (2026-05-13) already shipped TapEditPopover + Today.tsx wiring + server gate;
 * this test locks in the Schedule.tsx parity.
 *
 * Locks:
 *   1. Schedule.tsx imports TapEditPopover from the shared component path.
 *   2. The top-level day card list renders <TapEditPopover blockId=… startTime=… durationMin=… />.
 *   3. The DayPreview dialog list also renders <TapEditPopover />.
 *   4. Defense-in-depth: the component's existing client-side gate
 *      (blocks.canInlineEdit) AND server gate (familyAdminProcedure on
 *      blocks.update) are unchanged.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const SCHEDULE_SRC = readFileSync(
  join(ROOT, "client", "src", "pages", "Schedule.tsx"),
  "utf8",
);
const POPOVER_SRC = readFileSync(
  join(ROOT, "client", "src", "components", "TapEditPopover.tsx"),
  "utf8",
);
const ROUTERS_SRC = readFileSync(
  join(ROOT, "server", "routers.ts"),
  "utf8",
);

describe("May 15 2026 — Schedule.tsx tap-edit wire-up", () => {
  it("imports TapEditPopover from the shared component path", () => {
    expect(SCHEDULE_SRC).toContain('from "@/components/TapEditPopover"');
  });

  it("mounts <TapEditPopover /> in the schedule block list (at least once)", () => {
    const occurrences = SCHEDULE_SRC.match(/<TapEditPopover\b/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
  });

  it("mounts <TapEditPopover /> in BOTH the day card AND the DayPreview dialog", () => {
    // Phase 2 calls for both surfaces. The two block.map() iterations in
    // Schedule.tsx are the day card list and the DayPreview dialog list.
    const occurrences = SCHEDULE_SRC.match(/<TapEditPopover\b/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it("each mount passes blockId, startTime, durationMin (the exact 3 props the popover accepts)", () => {
    // Capture every <TapEditPopover ... /> block and assert all 3 prop names appear.
    const popoverBlocks = SCHEDULE_SRC.match(/<TapEditPopover[\s\S]*?\/>/g) || [];
    expect(popoverBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of popoverBlocks) {
      expect(block).toContain("blockId={b.id}");
      expect(block).toContain("startTime=");
      expect(block).toContain("durationMin=");
    }
  });

  it("never lets Schedule.tsx pass title/description/status props to the popover (locks the limited contract)", () => {
    const popoverBlocks = SCHEDULE_SRC.match(/<TapEditPopover[\s\S]*?\/>/g) || [];
    for (const block of popoverBlocks) {
      expect(block).not.toContain("title=");
      expect(block).not.toContain("description=");
      expect(block).not.toContain("status=");
      expect(block).not.toContain("grade=");
    }
  });

  it("defense-in-depth: TapEditPopover still hides on !canInlineEdit (the May-13 Push-87 gate is intact)", () => {
    expect(POPOVER_SRC).toContain("trpc.blocks.canInlineEdit.useQuery()");
    expect(POPOVER_SRC).toMatch(/if\s*\(\s*!gate\?\.allowed\s*\)\s*return null/);
  });

  it("defense-in-depth: blocks.update is still familyAdminProcedure (Reagan cannot write times)", () => {
    expect(ROUTERS_SRC).toMatch(/\n\s*update:\s*familyAdminProcedure\.input/);
  });

  it("Schedule.tsx does NOT call blocks.update directly (always via TapEditPopover -> single-source-of-truth)", () => {
    // The popover owns the mutation. Schedule.tsx should never have its own
    // useMutation on blocks.update; otherwise the gate could be bypassed
    // accidentally in a future refactor.
    expect(SCHEDULE_SRC).not.toMatch(/trpc\.blocks\.update\.useMutation/);
  });
});
