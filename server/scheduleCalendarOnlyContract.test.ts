/**
 * scheduleCalendarOnlyContract.test.ts — v2.86 (2026-05-21)
 *
 * Mom's "single editor rule" simplification: /schedule must remain a
 * calendar surface. The only block-level interaction is tapping the title
 * to deep-link into AgendaEditor. No inline TapEditPopover, no inline
 * pencils, no second editor surface.
 *
 * Locked at the source level so the regression can't sneak back via a
 * future PR re-importing the popover. (UI-level vitest would need
 * happy-dom + lots of trpc mocking; the source contract is enough to
 * catch the regression that matters.)
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SCHEDULE_TSX = path.join(
  __dirname,
  "..",
  "client",
  "src",
  "pages",
  "Schedule.tsx",
);

describe("/schedule — calendar-only contract", () => {
  const src = fs.readFileSync(SCHEDULE_TSX, "utf8");

  it("does NOT import TapEditPopover", () => {
    expect(src).not.toMatch(
      /import\s*\{\s*TapEditPopover\s*\}\s*from\s*['"]@\/components\/TapEditPopover['"]/,
    );
  });

  it("does NOT mount any <TapEditPopover ...> element", () => {
    expect(src).not.toMatch(/<TapEditPopover\b/);
  });

  it("still deep-links the block title to the AgendaEditor for non-today edits", () => {
    // The single editor surface for non-today is reached via the title button.
    expect(src).toContain("/agenda-editor?date=");
    expect(src).toMatch(/data-testid=\{`schedule-block-tap-edit-/);
  });

  it("does NOT import AgendaEditor inline (Schedule must stay a thin calendar shell)", () => {
    // Prevent someone from accidentally embedding the full editor inside
    // the schedule page.
    expect(src).not.toMatch(
      /import\s+\w*\s+from\s*['"]@\/pages\/AgendaEditor['"]/,
    );
    expect(src).not.toMatch(
      /import\s+\w*\s+from\s*['"]\.\.\/pages\/AgendaEditor['"]/,
    );
  });

  it("retains the human-readable comment explaining the single-editor rule", () => {
    // If someone re-adds inline editing, our comment must be removed —
    // this is a tripwire so the deletion doesn't go unnoticed in review.
    expect(src).toContain("v2.86 (2026-05-21) — Removed inline TapEditPopover");
    expect(src).toContain("single-editor rule");
  });
});
