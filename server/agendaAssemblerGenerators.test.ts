import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Push 74 (2026-05-13) — agendaAssembler wires per-type block generators.
 *
 * We mock db helpers + tutorOfDay + hydrateLessonForBlock and assert that
 * the resulting AgendaPdfBlock[] now includes the `generated` payload for
 * the three supported block types: read_aloud, adventure, math.
 */

vi.mock("../server/db", () => {
  return {
    getPlanByDate: vi.fn(async () => ({ id: 7, date: "2026-05-13" })),
    listBlocksForPlan: vi.fn(async () => [
      {
        id: 101,
        sortOrder: 1,
        blockType: "read_aloud",
        title: "Read",
        subjectName: "ELA",
        durationMin: 20,
      },
      {
        id: 102,
        sortOrder: 2,
        blockType: "adventure",
        title: "Adventure",
        subjectName: "Science",
        durationMin: 45,
      },
      {
        id: 103,
        sortOrder: 3,
        blockType: "math",
        title: "Math practice",
        subjectName: "Math",
        durationMin: 25,
      },
      {
        id: 104,
        sortOrder: 4,
        blockType: "custom",
        title: "Free choice",
        subjectName: null,
        durationMin: 30,
      },
    ]),
    listBookAssignmentsForBlock: vi.fn(async (blockId: number) => {
      if (blockId === 101) {
        return [{ bookTitle: "Tuck Everlasting", fromPage: 24, toPage: 28 }];
      }
      return [];
    }),
    listTutorDayNotes: vi.fn(async () => []),
    getProfile: vi.fn(async () => ({ studentName: "Reagan" })),
    getDb: vi.fn(() => ({
      execute: vi.fn(async () => [[]]),
    })),
  };
});

vi.mock("../server/_lib/tutorOfDay", () => ({
  resolveTutorOfDay: vi.fn(async () => null),
}));

vi.mock("../server/_lib/hydrateLessonForBlock", () => ({
  hydrateLessonForBlock: vi.fn(async () => null),
}));

describe("Push 74 — generators wired into agendaAssembler", () => {
  let assemble: typeof import("../server/_lib/agendaAssembler").assembleAgendaForDate;

  beforeEach(async () => {
    const mod = await import("../server/_lib/agendaAssembler");
    assemble = mod.assembleAgendaForDate;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("populates generated payload for read_aloud blocks with a known book", async () => {
    const out = await assemble("2026-05-13");
    expect(out).not.toBeNull();
    const reading = out!.blocks.find((b) => b.title === "Read")!;
    expect(reading.generated).toBeTruthy();
    expect(reading.generated!.kind).toBe("reading");
    // Should reference Tuck Everlasting
    expect(reading.generated!.printable).toContain("Tuck Everlasting");
  });

  it("populates generated payload for adventure blocks", async () => {
    const out = await assemble("2026-05-13");
    const adv = out!.blocks.find((b) => b.title === "Adventure")!;
    expect(adv.generated).toBeTruthy();
    expect(adv.generated!.kind).toBe("adventure");
    expect(adv.generated!.operable.supplyList).toBeDefined();
    expect(adv.generated!.operable.supplyList!.length).toBeGreaterThan(0);
  });

  it("populates generated payload for math blocks (practice)", async () => {
    const out = await assemble("2026-05-13");
    const math = out!.blocks.find((b) => b.title === "Math practice")!;
    expect(math.generated).toBeTruthy();
    expect(math.generated!.kind).toBe("practice");
    // Operable practice block exposes a URL to the drill
    expect(math.generated!.operable.url).toBeTruthy();
  });

  it("leaves unknown block types (custom) without a generated payload", async () => {
    const out = await assemble("2026-05-13");
    const custom = out!.blocks.find((b) => b.title === "Free choice")!;
    expect(custom.generated).toBeNull();
  });

  it("generated payload is back-compat optional on AgendaPdfBlock", async () => {
    const out = await assemble("2026-05-13");
    // canonicalText (PDF hash) doesn't reference `generated`, so legacy
    // hashes still hold. Spot-check the field exists on the type.
    expect(typeof out!.blocks[0]).toBe("object");
    expect("generated" in out!.blocks[0]).toBe(true);
  });

  it("deterministic seed: same block id → same primary practice drill across runs", async () => {
    // v3.28 (2026-06-01): the math-practice generator may now reach into
    // invokeLLM (not mocked here) which can take several seconds. Bump
    // the per-test timeout to 60s so two sequential assembles fit.
    const a = await assemble("2026-05-13");
    const b = await assemble("2026-05-13");
    const mathA = a!.blocks.find((b) => b.title === "Math practice")!.generated!;
    const mathB = b!.blocks.find((b) => b.title === "Math practice")!.generated!;
    expect(mathA.title).toBe(mathB.title);
    expect(mathA.operable.url).toBe(mathB.operable.url);
  }, 60_000);
});
