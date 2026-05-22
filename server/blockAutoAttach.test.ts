/**
 * blockAutoAttach.test.ts — v2.86
 *
 * Locks the contract Mom asked for: every Today block ends up with at
 * least one resource after the auto-attach pass.
 */
import { describe, it, expect, vi } from "vitest";
import {
  runAutoAttachForBlock,
  runAutoAttachForBlocks,
  inferPreferredTypeForBlock,
  finderTypeToLibraryType,
  buildFinderQueryForBlock,
  type AutoAttachDeps,
} from "./_lib/blockAutoAttach";
import type { FinderResultLike } from "./_lib/agendaEditorAutoAttach";

const MAY_21 = "2026-05-21";

function libResult(over: Partial<FinderResultLike>): FinderResultLike {
  return {
    source: "library",
    title: "Library result",
    url: "https://example.org/x",
    snippet: "snippet",
    type: "worksheet",
    subjectSlug: null,
    estimatedMinutes: 20,
    curriculumTopicCode: null,
    curriculumTopicId: null,
    ageAppropriate: true,
    ...over,
  };
}

function makeDeps(over: Partial<AutoAttachDeps> = {}): AutoAttachDeps {
  return {
    listAssignmentsForBlock: vi.fn(async () => []),
    listPrintablesForBlock: vi.fn(async () => []),
    finder: vi.fn(async () => []),
    addAssignmentLibrary: vi.fn(async () => ({ id: 999 })),
    ...over,
  };
}

describe("blockAutoAttach helpers", () => {
  describe("inferPreferredTypeForBlock", () => {
    it("infers 'video' from title containing 'video'", () => {
      expect(inferPreferredTypeForBlock({ id: 1, title: "Watch fractions video" })).toBe("video");
    });
    it("infers 'worksheet' from blockType=practice", () => {
      expect(
        inferPreferredTypeForBlock({ id: 1, title: "Times tables", blockType: "practice" }),
      ).toBe("worksheet");
    });
    it("infers 'reading' from 'read aloud'", () => {
      expect(inferPreferredTypeForBlock({ id: 1, title: "Read aloud chapter 4" })).toBe("reading");
    });
    it("returns null when no signal", () => {
      expect(inferPreferredTypeForBlock({ id: 1, title: "Mystery box" })).toBeNull();
    });
  });

  describe("finderTypeToLibraryType", () => {
    it("maps app_activity → app_activity", () => {
      expect(finderTypeToLibraryType("app_activity")).toBe("app_activity");
    });
    it("maps 'other' → 'other'", () => {
      expect(finderTypeToLibraryType("other")).toBe("other");
    });
  });

  describe("buildFinderQueryForBlock", () => {
    it("strips 'Custom worksheet:' prefix", () => {
      expect(
        buildFinderQueryForBlock({ id: 1, title: "Custom worksheet: long division" }),
      ).toBe("long division");
    });
    it("collapses whitespace", () => {
      expect(buildFinderQueryForBlock({ id: 1, title: "   times    tables   " })).toBe(
        "times tables",
      );
    });
  });
});

describe("runAutoAttachForBlock — single block behavior", () => {
  it("skips blocks that already have a pinned library row", async () => {
    const addSpy = vi.fn(async () => ({ id: 1 }));
    const deps = makeDeps({
      listAssignmentsForBlock: vi.fn(async () => [{ id: 5, type: "worksheet" }]),
      addAssignmentLibrary: addSpy,
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Anything" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("skipped_already_has_resources");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("skips blocks that already have a pinned daily printable", async () => {
    const addSpy = vi.fn(async () => ({ id: 1 }));
    const deps = makeDeps({
      listPrintablesForBlock: vi.fn(async () => [{ id: 9 }]),
      addAssignmentLibrary: addSpy,
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Anything" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("skipped_already_has_resources");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("attaches a pinned worksheet when block has no resources", async () => {
    const addSpy = vi.fn(async () => ({ id: 42 }));
    const deps = makeDeps({
      finder: vi.fn(async () => [
        libResult({ title: "Long division practice", url: "https://k.org/ld", type: "worksheet" }),
      ]),
      addAssignmentLibrary: addSpy,
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Long division", subjectSlug: "math", blockType: "practice" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("attached");
    expect(r.attachedType).toBe("worksheet");
    expect(r.attachedUrl).toBe("https://k.org/ld");
    expect(addSpy).toHaveBeenCalledTimes(1);
    const call = (addSpy as any).mock.calls[0][0];
    expect(call.blockId).toBe(10);
    expect(call.dateFor).toBe(MAY_21);
    expect(call.fromSource).toBe("auto_attach");
    expect(call.subjectSlug).toBe("math");
  });

  it("returns 'no_finder_result' when finder returns empty", async () => {
    const addSpy = vi.fn(async () => ({ id: 1 }));
    const deps = makeDeps({
      finder: vi.fn(async () => []),
      addAssignmentLibrary: addSpy,
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Mystery topic" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("no_finder_result");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("returns 'no_finder_result' when title is empty", async () => {
    const addSpy = vi.fn(async () => ({ id: 1 }));
    const deps = makeDeps({ addAssignmentLibrary: addSpy });
    const r = await runAutoAttachForBlock({ id: 10, title: "" }, MAY_21, deps);
    expect(r.action).toBe("no_finder_result");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("returns 'error' when finder throws", async () => {
    const deps = makeDeps({
      finder: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Times tables" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("error");
    expect(r.errorMessage).toContain("network down");
  });

  it("returns 'error' when addAssignmentLibrary throws", async () => {
    const deps = makeDeps({
      finder: vi.fn(async () => [libResult({})]),
      addAssignmentLibrary: vi.fn(async () => {
        throw new Error("constraint failed");
      }),
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Times tables" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("error");
    expect(r.errorMessage).toContain("constraint failed");
  });

  it("filters out non-age-appropriate finder results", async () => {
    const addSpy = vi.fn(async () => ({ id: 1 }));
    const deps = makeDeps({
      finder: vi.fn(async () => [libResult({ ageAppropriate: false })]),
      addAssignmentLibrary: addSpy,
    });
    const r = await runAutoAttachForBlock(
      { id: 10, title: "Times tables" },
      MAY_21,
      deps,
    );
    expect(r.action).toBe("no_finder_result");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("is idempotent — second run on the same block no-ops because the row now exists", async () => {
    let pinned: any[] = [];
    const deps = makeDeps({
      listAssignmentsForBlock: vi.fn(async () => pinned),
      finder: vi.fn(async () => [libResult({})]),
      addAssignmentLibrary: vi.fn(async (input: any) => {
        pinned = [{ id: 1, type: input.type }];
        return { id: 1 };
      }),
    });
    const r1 = await runAutoAttachForBlock({ id: 10, title: "X" }, MAY_21, deps);
    const r2 = await runAutoAttachForBlock({ id: 10, title: "X" }, MAY_21, deps);
    expect(r1.action).toBe("attached");
    expect(r2.action).toBe("skipped_already_has_resources");
  });
});

describe("runAutoAttachForBlocks — bulk orchestrator", () => {
  it("attaches only to empty blocks; skips populated ones", async () => {
    const populatedBlockIds = new Set([2]);
    const addSpy = vi.fn(async () => ({ id: 99 }));
    const deps = makeDeps({
      listAssignmentsForBlock: vi.fn(async (blockId: number) =>
        populatedBlockIds.has(blockId) ? [{ id: 1, type: "worksheet" }] : [],
      ),
      finder: vi.fn(async () => [libResult({})]),
      addAssignmentLibrary: addSpy,
    });
    const result = await runAutoAttachForBlocks(
      [
        { id: 1, title: "Math practice", blockType: "practice" },
        { id: 2, title: "Already has worksheet", blockType: "practice" },
        { id: 3, title: "Watch cells video", blockType: "lesson" },
      ],
      MAY_21,
      deps,
    );
    expect(result.totalBlocks).toBe(3);
    expect(result.attached).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.noResult).toBe(0);
    expect(result.errors).toBe(0);
    expect(addSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a per-block report for every input block", async () => {
    const deps = makeDeps({ finder: vi.fn(async () => [libResult({})]) });
    const result = await runAutoAttachForBlocks(
      [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
        { id: 3, title: "C" },
      ],
      MAY_21,
      deps,
    );
    expect(result.reports).toHaveLength(3);
    expect(result.reports.map(r => r.blockId)).toEqual([1, 2, 3]);
  });

  it("the contract Mom asked for: after the pass every block is non-empty (when finder has results)", async () => {
    let pinnedByBlock: Record<number, any[]> = {};
    const deps = makeDeps({
      listAssignmentsForBlock: vi.fn(async (blockId: number) => pinnedByBlock[blockId] ?? []),
      finder: vi.fn(async () => [libResult({})]),
      addAssignmentLibrary: vi.fn(async (input: any) => {
        pinnedByBlock[input.blockId] = [{ id: input.blockId * 10, type: input.type }];
        return { id: input.blockId * 10 };
      }),
    });
    const blocks = [
      { id: 1, title: "Math" },
      { id: 2, title: "Reading" },
      { id: 3, title: "Science video" },
    ];
    await runAutoAttachForBlocks(blocks, MAY_21, deps);
    // Every block now has at least one pinned row.
    for (const b of blocks) {
      expect(pinnedByBlock[b.id]).toBeDefined();
      expect((pinnedByBlock[b.id] ?? []).length).toBeGreaterThan(0);
    }
  });
});
