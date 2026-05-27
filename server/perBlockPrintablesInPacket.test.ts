/**
 * v2.21 (2026-05-17) — Per-block printables (v2.19) flow into the
 * nightly agenda packet via hydrateLessonForBlock.
 *
 * Verifies (mocked DB, no real connection needed):
 *   - hydrateLessonForBlock(blockId, dateStr) reads from BOTH
 *     listAssignmentsLibrary AND listDailyPrintablesForBlock
 *   - per-block printables show up in lesson.worksheets[]
 *   - URL dedupe: a printable whose URL matches an assignmentsLibrary
 *     worksheet is NOT rendered twice
 *   - if assignmentsLibrary is empty BUT block printables exist, the
 *     lesson is still hydrated (returns non-null)
 *   - if both are empty, returns null (PDF skips the lesson page)
 *   - backward compat: omit forDate → behaves as before, no printables
 *     query made
 *   - source-pattern: agendaAssembler.ts forwards dateStr into the
 *     hydrator (otherwise the merge would silently no-op).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");

vi.mock("./db", () => ({
  listAssignmentsLibrary: vi.fn(),
  listDailyPrintablesForBlock: vi.fn(),
}));

import { hydrateLessonForBlock } from "./_lib/hydrateLessonForBlock";
import * as db from "./db";

const mockedListAssignments = db.listAssignmentsLibrary as unknown as ReturnType<typeof vi.fn>;
const mockedListBlockPrintables = db.listDailyPrintablesForBlock as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedListAssignments.mockReset();
  mockedListBlockPrintables.mockReset();
});

describe("v2.21 — hydrateLessonForBlock merges per-block printables", () => {
  it("appends per-block printables to lesson.worksheets[]", async () => {
    mockedListAssignments.mockResolvedValueOnce([
      {
        type: "lesson_plan",
        title: "Math: Fractions",
        notes: "Recap halves and quarters before warm-up.",
      },
    ]);
    mockedListBlockPrintables.mockResolvedValueOnce([
      {
        title: "Fractions practice — set A",
        sourceUrl: "https://drive.google.com/file/d/abc",
        description: "10 problems, mixed.",
        bucket: "have_to_do",
      },
      {
        title: "Number-line warm-up",
        sourceUrl: "https://drive.google.com/file/d/xyz",
        description: null,
        bucket: "optional",
      },
    ]);

    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).not.toBeNull();
    expect(lesson!.instructions).toContain("Recap halves and quarters");
    expect(lesson!.worksheets!.length).toBe(2);
    const titles = lesson!.worksheets!.map((w) => w.title);
    expect(titles).toContain("Fractions practice — set A");
    expect(titles).toContain("Number-line warm-up");
    const a = lesson!.worksheets!.find((w) => w.title === "Fractions practice — set A")!;
    expect(a.printableUrl).toBe("https://drive.google.com/file/d/abc");
    expect(a.description).toBe("10 problems, mixed.");
  });

  it("dedupes printables whose URL matches an existing assignmentsLibrary worksheet", async () => {
    mockedListAssignments.mockResolvedValueOnce([
      {
        type: "worksheet",
        title: "Library worksheet",
        notes: "from assignmentsLibrary",
        fileLink: "https://drive.google.com/file/d/SHARED",
      },
    ]);
    mockedListBlockPrintables.mockResolvedValueOnce([
      {
        title: "Same worksheet, attached via printables panel",
        sourceUrl: "https://drive.google.com/file/d/SHARED",
        description: null,
        bucket: "have_to_do",
      },
    ]);

    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).not.toBeNull();
    expect(lesson!.worksheets!.length).toBe(1);
    // The library row wins because it was added first.
    expect(lesson!.worksheets![0].title).toBe("Library worksheet");
  });

  it("hydrates from block printables alone when assignmentsLibrary is empty", async () => {
    mockedListAssignments.mockResolvedValueOnce([]);
    mockedListBlockPrintables.mockResolvedValueOnce([
      {
        title: "Phonics packet (Tuesday)",
        sourceUrl: "https://drive.google.com/file/d/zzz",
        description: "8 cards.",
        bucket: "have_to_do",
      },
    ]);
    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).not.toBeNull();
    expect(lesson!.worksheets!.length).toBe(1);
    expect(lesson!.worksheets![0].title).toBe("Phonics packet (Tuesday)");
  });

  it("returns null when both sources are empty (PDF skips the lesson page)", async () => {
    mockedListAssignments.mockResolvedValueOnce([]);
    mockedListBlockPrintables.mockResolvedValueOnce([]);
    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).toBeNull();
  });

  it("backward-compat: when forDate is omitted, no per-block printables query is made", async () => {
    mockedListAssignments.mockResolvedValueOnce([
      { type: "lesson_plan", title: "Plan", notes: "go" },
    ]);
    const lesson = await hydrateLessonForBlock(42);
    expect(lesson).not.toBeNull();
    // The whole point: legacy callers don't trigger a printables query.
    expect(mockedListBlockPrintables).not.toHaveBeenCalled();
  });

  it("titles default to 'Printable' when a row has no title", async () => {
    mockedListAssignments.mockResolvedValueOnce([]);
    mockedListBlockPrintables.mockResolvedValueOnce([
      { title: "", sourceUrl: "https://x", description: null, bucket: "extra" },
    ]);
    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).not.toBeNull();
    expect(lesson!.worksheets![0].title).toBe("Printable");
  });

  it("does not throw if listDailyPrintablesForBlock fails", async () => {
    mockedListAssignments.mockResolvedValueOnce([
      { type: "lesson_plan", title: "Plan", notes: "go" },
    ]);
    mockedListBlockPrintables.mockRejectedValueOnce(new Error("DB blip"));
    const lesson = await hydrateLessonForBlock(42, "2026-05-18");
    expect(lesson).not.toBeNull();
    expect(lesson!.instructions).toBe("go");
  });
});

describe("v2.21 — agendaAssembler.ts forwards dateStr to the hydrator", () => {
  // Source-pattern test so that any future refactor that drops the date
  // argument trips this red. Without the dateStr forward, the merge
  // silently no-ops because hydrateLessonForBlock falls back to its
  // legacy single-arg branch and never queries daily_printables.
  const ASSEMBLER_PATH = path.join(ROOT, "server/_lib/agendaAssembler.ts");
  const src = fs.readFileSync(ASSEMBLER_PATH, "utf8");

  it("calls hydrateLessonForBlock with at least (b.id, dateStr)", () => {
    // v2.98: now also passes curriculumTopicId as 3rd arg — accept 2- or 3-arg call.
    expect(src).toMatch(/hydrateLessonForBlock\(\s*b\.id\s*,\s*dateStr/);
  });
});
