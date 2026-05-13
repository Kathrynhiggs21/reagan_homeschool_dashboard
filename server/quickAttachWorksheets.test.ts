/**
 * Push 38 — Quick-attach worksheets sidebar (AgendaEditor).
 *
 * Contract checks:
 *   1. The library router already supports filter-by-blockId=null + by
 *      dateFor — no new procedure needed, but we lock it in so a refactor
 *      that drops those filters can't silently break the strip.
 *   2. AgendaEditor.tsx mounts QuickAttachWorksheets only when there are
 *      live blocks to pin to.
 *   3. The component is built on top of trpc.library.list / library.update
 *      (no shortcut to raw fetch / no new server endpoint).
 *   4. The "Don't show if no info" house rule is honored — the component
 *      early-returns null when nothing is unpinned and nothing is pinned.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Quick-attach worksheets sidebar — push 38", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const agendaSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "AgendaEditor.tsx"),
    "utf-8",
  );

  it("library.list still accepts blockId nullable filter", () => {
    expect(routersSrc).toContain("blockId: z.number().nullable().optional()");
  });

  it("library.list still accepts dateFor nullable filter", () => {
    expect(routersSrc).toContain("dateFor: z.string().nullable().optional()");
  });

  it("library.update accepts a free-form patch (so { blockId } can be set/cleared)", () => {
    expect(routersSrc).toContain(
      "patch: z.record(z.string(), z.any())",
    );
  });

  it("AgendaEditor mounts QuickAttachWorksheets only when there are live blocks", () => {
    expect(agendaSrc).toMatch(
      /!editPlan && liveBlocks\.length > 0 && \(\s*<QuickAttachWorksheets/,
    );
  });

  it("QuickAttachWorksheets component is defined in AgendaEditor.tsx", () => {
    expect(agendaSrc).toContain("function QuickAttachWorksheets({");
  });

  it("QuickAttachWorksheets fetches unpinned items via trpc.library.list with blockId: null", () => {
    expect(agendaSrc).toMatch(/library\?\.list\?\.useQuery\?\.\(\{[\s\S]*?blockId: null/);
  });

  it("QuickAttachWorksheets writes through trpc.library.update with { blockId }", () => {
    expect(agendaSrc).toContain('updateM.mutate({ id: it.id, patch: { blockId } })');
  });

  it("QuickAttachWorksheets supports unpinning (patch.blockId = null)", () => {
    expect(agendaSrc).toContain(
      "updateM.mutate({ id: it.id, patch: { blockId: null } })",
    );
  });

  it("QuickAttachWorksheets renders the stable data-testid for E2E", () => {
    expect(agendaSrc).toContain('data-testid="quick-attach-worksheets"');
  });

  it("QuickAttachWorksheets honors 'Don't show if no info' (returns null when both lists empty)", () => {
    const idx = agendaSrc.indexOf("function QuickAttachWorksheets({");
    const slice = agendaSrc.slice(idx, idx + 3000);
    expect(slice).toMatch(
      /if \(unpinnedForToday\.length === 0 && pinnedForToday\.length === 0\) \{[\s\S]*return null/,
    );
  });
});
